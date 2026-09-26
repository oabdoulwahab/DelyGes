import { create } from "zustand";
import { Delivery, DeliveryCreateDTO } from "../types";
import { DeliveryRepository } from "../repositories/delivery.repository";
import { DeliveryService } from "../services/delivery.service";
import { MerchantService } from "../services/merchant.service";
import { syncService } from "../services/sync.service";
import {
  sendDeliveryCompletedNotification,
  sendDeliveryCreatedNotification,
} from "../services/notification.service";
import { cacheInvalidate } from "../cache/cache";

// Store partagé Livraisons (zustand) — source unique côté UI.
// - Lecture : liste chargée une fois (stale-while-revalidate 30 s), partagée
//   entre Dashboard, Livraisons, Détail, Saisie.
// - Écriture : chaque mutation persiste (SQLite), planifie la sync,
//   envoie la notification, recharge la liste et invalide le cache dashboard.
// La couche repository reste l'unique accès données ; le store orchestre.

const LIST_TTL_MS = 30_000;

export interface DeliveryInput extends Omit<DeliveryCreateDTO, "user_id" | "merchant_id"> {
  merchantName: string;
  merchantPhone?: string;
}

interface DeliveriesState {
  userId: number | null;
  items: Delivery[];
  loading: boolean;
  loadedAt: number;
  /** Incrémenté à chaque mutation : les écrans s'y abonnent pour recharger. */
  version: number;
  inflight: Promise<void> | null;

  ensureLoaded: (userId: number, opts?: { force?: boolean }) => Promise<void>;
  refresh: (userId: number) => Promise<void>;
  createDelivery: (userId: number, input: DeliveryInput) => Promise<Delivery>;
  markDelivered: (userId: number, id: number) => Promise<Delivery>;
  cancelDelivery: (
    userId: number,
    id: number,
    motif?: string,
  ) => Promise<Delivery>;
  /** À appeler après une mutation faite hors store (détail, clôture...). */
  notifyChanged: (userId?: number) => void;
}

async function markForSyncSafe(table: string, id: number): Promise<void> {
  try {
    await syncService.markForSync(table, id);
  } catch (e) {
    console.log(`⚠️ Sync différée ${table} #${id}:`, e);
  }
}

export const useDeliveriesStore = create<DeliveriesState>()((set, get) => {
  const reloadLocked = async (userId: number): Promise<void> => {
    if (get().inflight) {
      await get().inflight;
      return;
    }
    const job = (async () => {
      set({ loading: true });
      try {
        const items = await DeliveryRepository.findAll({ userId });
        set({ items, userId, loadedAt: Date.now(), loading: false });
      } catch (e) {
        console.error("❌ Store livraisons:", e);
        set({ loading: false });
        throw e;
      } finally {
        set({ inflight: null });
      }
    })();
    set({ inflight: job });
    await job;
  };

  const commitChanged = (userId?: number) => {
    if (userId != null) cacheInvalidate(`dashboard:${userId}`);
    set((s) => ({ version: s.version + 1 }));
  };

  return {
    userId: null,
    items: [],
    loading: false,
    loadedAt: 0,
    version: 0,
    inflight: null,

    ensureLoaded: async (userId, opts) => {
      const s = get();
      const fresh =
        s.userId === userId &&
        s.items.length >= 0 &&
        s.loadedAt > 0 &&
        Date.now() - s.loadedAt < LIST_TTL_MS;
      if (!opts?.force && fresh) return;
      await reloadLocked(userId);
    },

    refresh: async (userId) => {
      await reloadLocked(userId);
    },

    createDelivery: async (userId, input) => {
      const { merchantName, merchantPhone, ...rest } = input;
      // Commerçant : récupéré ou créé (logique métier inchangée)
      let merchantId: number | null = null;
      if (merchantName.trim()) {
        try {
          merchantId = await MerchantService.getOrCreate(
            merchantName.trim(),
            merchantPhone?.trim() || rest.phone?.trim() || undefined,
          );
          if (merchantId) await markForSyncSafe("merchants", merchantId);
        } catch (e) {
          console.error("❌ Store getOrCreateMerchant:", e);
        }
      }
      const created = await DeliveryRepository.create({
        ...rest,
        merchant_id: merchantId ?? undefined,
        user_id: userId,
      });
      await markForSyncSafe("deliveries", created.id);
      sendDeliveryCreatedNotification(userId, 1).catch((e) =>
        console.log("⚠️ Notification différée:", e),
      );
      await reloadLocked(userId);
      commitChanged(userId);
      return created;
    },

    markDelivered: async (userId, id) => {
      const updated = await DeliveryService.markAsDelivered(userId, id);
      await markForSyncSafe("deliveries", id);
      const gain =
        typeof updated.profit === "number"
          ? updated.profit
          : updated.delivery_fee;
      sendDeliveryCompletedNotification(userId, gain).catch(() => {});
      await reloadLocked(userId);
      commitChanged(userId);
      return updated;
    },

    cancelDelivery: async (userId, id, motif) => {
      if (motif?.trim()) {
        await DeliveryRepository.update(id, {
          notes: motif.trim(),
          needs_sync: 1,
        });
      }
      const updated = await DeliveryService.cancelDelivery(userId, id);
      await markForSyncSafe("deliveries", id);
      await reloadLocked(userId);
      commitChanged(userId);
      return updated;
    },

    notifyChanged: (userId) => {
      const s = get();
      if (userId != null && userId !== s.userId) {
        // Changement pour un autre utilisateur : force un rechargement propre.
        set({ userId, items: [], loadedAt: 0 });
      }
      commitChanged(userId);
    },
  };
});

// Sélecteurs purs (réutilisables sans abonnement)
export function selectByStatus(
  items: Delivery[],
  status: Delivery["status"],
): Delivery[] {
  return items.filter((d) => d.status === status);
}

export function selectDeliveredToday(items: Delivery[], now = new Date()): Delivery[] {
  const day = now.toDateString();
  return items.filter(
    (d) =>
      d.status === "LIVREE" &&
      new Date(d.delivered_at || d.created_at).toDateString() === day,
  );
}
