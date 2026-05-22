import { db } from "../database/db";
import { auth, db as firestore } from "../config/firebase";
import NetInfo from "@react-native-community/netinfo";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  getDoc,
  type DocumentData,
  serverTimestamp,
} from "firebase/firestore";
import { Delivery, Merchant } from "../types";

interface SyncQueueItem {
  id: number;
  table_name: string;
  record_id: number;
  operation: string;
  retry_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
}

const MAX_RETRIES = 5;
const BATCH_SIZE = 10;
const SYNC_DEBOUNCE = 2000;
const SYNC_COOLDOWN = 5000;

class SyncService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private lastSyncTime: number = 0;
  private syncQueue: Array<{ table: string; id: number }> = [];
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        console.log("📶 Connexion rétablie - synchronisation...");
        this.processPersistentQueue();
        this.processSyncQueue();
      }
    });
  }

  // === RETRY / BACKOFF ===

  private getBackoffDelay(retryCount: number): number {
    const delays = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1min, 5min
    return delays[Math.min(retryCount, delays.length - 1)];
  }

  private async addToPersistentQueue(table: string, recordId: number) {
    try {
      // Vérifier si déjà dans la file
      const existing = await db.getFirstAsync<SyncQueueItem>(
        "SELECT id FROM sync_queue WHERE table_name = ? AND record_id = ?",
        [table, recordId],
      );
      if (existing) return;

      await db.runAsync(
        `INSERT INTO sync_queue (table_name, record_id, operation, next_retry_at)
         VALUES (?, ?, 'upsert', datetime('now'))`,
        [table, recordId],
      );
    } catch (error) {
      console.error("❌ Erreur ajout file persistance:", error);
    }
  }

  private async markSyncCompleted(table: string, recordId: number) {
    try {
      await db.runAsync(
        "DELETE FROM sync_queue WHERE table_name = ? AND record_id = ?",
        [table, recordId],
      );
    } catch (error) {
      console.error("❌ Erreur suppression file:", error);
    }
  }

  private async markSyncFailed(table: string, recordId: number, errorMsg: string) {
    try {
      const item = await db.getFirstAsync<SyncQueueItem>(
        "SELECT * FROM sync_queue WHERE table_name = ? AND record_id = ?",
        [table, recordId],
      );
      if (!item) return;

      const newRetryCount = (item.retry_count || 0) + 1;

      if (newRetryCount >= MAX_RETRIES) {
        console.error(`❌ Abandon sync ${table}/${recordId} après ${MAX_RETRIES} tentatives`);
        await db.runAsync(
          "DELETE FROM sync_queue WHERE id = ?",
          [item.id],
        );
        return;
      }

      const backoffDelay = this.getBackoffDelay(newRetryCount);
      const nextRetry = new Date(Date.now() + backoffDelay).toISOString();

      await db.runAsync(
        `UPDATE sync_queue SET
          retry_count = ?, last_error = ?, next_retry_at = ?, updated_at = datetime('now')
        WHERE id = ?`,
        [newRetryCount, errorMsg, nextRetry, item.id],
      );

      console.log(`⏳ Retry ${table}/${recordId} dans ${backoffDelay}ms (tentative ${newRetryCount}/${MAX_RETRIES})`);
    } catch (error) {
      console.error("❌ Erreur marquage échec:", error);
    }
  }

  private async processPersistentQueue() {
    try {
      const items = await db.getAllAsync<SyncQueueItem>(
        `SELECT * FROM sync_queue
         WHERE next_retry_at <= datetime('now')
         ORDER BY created_at ASC
         LIMIT 20`,
      );

      for (const item of items) {
        if (item.table_name === "merchants") {
          const merchant = await this.getMerchantById(item.record_id);
          if (merchant) await this.syncSingleMerchant(merchant);
        } else if (item.table_name === "deliveries") {
          const delivery = await this.getDeliveryById(item.record_id);
          if (delivery) await this.syncSingleDelivery(delivery);
        }
      }
    } catch (error) {
      console.error("❌ Erreur traitement file persistante:", error);
    }
  }

  private async getMerchantById(id: number): Promise<Merchant | null> {
    return await db.getFirstAsync<Merchant>(
      "SELECT * FROM merchants WHERE id = ?",
      [id],
    );
  }

  private async getDeliveryById(id: number): Promise<Delivery | null> {
    return await db.getFirstAsync<Delivery>(
      "SELECT * FROM deliveries WHERE id = ?",
      [id],
    );
  }

  // === CONFLICT RESOLUTION ===

  private async resolveConflict(
    localUpdatedAt: string | null | undefined,
    remoteUpdatedAt: string | undefined,
    localData: Record<string, unknown>,
    remoteData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Stratégie: last-write-wins basé sur les timestamps
    const localTime = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
    const remoteTime = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;

    if (localTime >= remoteTime) {
      return localData;
    }
    return remoteData;
  }

  // === DELETION ===

  async deleteFromFirebase(table: string, firebaseId: string) {
    if (!this.isOnline || !auth.currentUser) {
      console.log("⏭️ Suppression Firebase ignorée: hors ligne");
      return;
    }

    try {
      console.log(`🗑️ Suppression ${table} ${firebaseId} de Firebase...`);
      await deleteDoc(doc(firestore, table, firebaseId));
      console.log(`✅ ${table} supprimé de Firebase`);
    } catch (error) {
      console.error(`❌ Erreur suppression ${table}:`, error);
    }
  }

  // === IMPORT FROM FIREBASE ===

  async importFromFirebase() {
    if (!auth.currentUser) {
      console.log("⏭️ Import ignoré: utilisateur non connecté");
      return;
    }

    if (this.syncInProgress) {
      console.log("⏭️ Import déjà en cours");
      return;
    }

    if (Date.now() - this.lastSyncTime < 30000) {
      console.log("⏭️ Import récent ignoré");
      return;
    }

    this.syncInProgress = true;
    console.log("📥 Import des données depuis Firebase...");

    try {
      const localMerchantIds = new Set<string>();
      const localDeliveryIds = new Set<string>();

      const localMerchants = await db.getAllAsync<{ firebase_id: string }>(
        "SELECT firebase_id FROM merchants WHERE firebase_id IS NOT NULL",
      );
      localMerchants.forEach((m) => localMerchantIds.add(m.firebase_id));

      const localDeliveries = await db.getAllAsync<{ firebase_id: string }>(
        "SELECT firebase_id FROM deliveries WHERE firebase_id IS NOT NULL",
      );
      localDeliveries.forEach((d) => localDeliveryIds.add(d.firebase_id));

      // Importer les commerçants
      console.log("📦 Import des commerçants...");
      const merchantsQuery = query(
        collection(firestore, "merchants"),
        where("user_id", "==", auth.currentUser.uid),
      );
      const merchantsSnapshot = await getDocs(merchantsQuery);

      let merchantCount = 0;
      let merchantBatch: Array<{ firebaseId: string; data: DocumentData }> = [];

      for (const docSnapshot of merchantsSnapshot.docs) {
        const data = docSnapshot.data();
        if (localMerchantIds.has(docSnapshot.id)) {
          await this.updateLocalMerchant(docSnapshot.id, data);
          continue;
        }
        merchantBatch.push({
          firebaseId: docSnapshot.id,
          data: data,
        });

        if (merchantBatch.length >= BATCH_SIZE) {
          await this.processMerchantBatch(merchantBatch);
          merchantCount += merchantBatch.length;
          merchantBatch = [];
        }
      }

      if (merchantBatch.length > 0) {
        await this.processMerchantBatch(merchantBatch);
        merchantCount += merchantBatch.length;
      }

      console.log(`✅ ${merchantCount} commerçants importés, ${localMerchantIds.size} existants`);

      // Importer les livraisons
      console.log("📦 Import des livraisons...");
      const deliveriesQuery = query(
        collection(firestore, "deliveries"),
        where("user_id", "==", auth.currentUser.uid),
      );
      const deliveriesSnapshot = await getDocs(deliveriesQuery);

      let deliveryCount = 0;
      let deliveryBatch: Array<{ firebaseId: string; data: DocumentData }> = [];

      for (const docSnapshot of deliveriesSnapshot.docs) {
        const data = docSnapshot.data();
        if (localDeliveryIds.has(docSnapshot.id)) {
          await this.updateLocalDelivery(docSnapshot.id, data);
          continue;
        }
        deliveryBatch.push({
          firebaseId: docSnapshot.id,
          data: data,
        });

        if (deliveryBatch.length >= BATCH_SIZE) {
          await this.processDeliveryBatch(deliveryBatch);
          deliveryCount += deliveryBatch.length;
          deliveryBatch = [];
        }
      }

      if (deliveryBatch.length > 0) {
        await this.processDeliveryBatch(deliveryBatch);
        deliveryCount += deliveryBatch.length;
      }

      console.log(`✅ ${deliveryCount} livraisons importées, ${localDeliveryIds.size} existantes`);
      console.log("📥 Import terminé avec succès");
    } catch (error) {
      console.error("❌ Erreur import:", error);
    } finally {
      this.syncInProgress = false;
      this.lastSyncTime = Date.now();
    }
  }

  private async processMerchantBatch(
    batch: Array<{ firebaseId: string; data: DocumentData }>,
  ) {
    const queries = batch.map(async (item) => {
      return db.runAsync(
        `INSERT INTO merchants
         (name, phone, address, firebase_id, user_id, created_at, needs_sync, sync_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          item.data.name || "",
          item.data.phone || "",
          item.data.address || "",
          item.firebaseId,
          auth.currentUser?.uid,
          item.data.created_at || new Date().toISOString(),
          item.data.updated_at || item.data.sync_updated_at || new Date().toISOString(),
        ],
      );
    });

    await Promise.all(queries);
  }

  private async processDeliveryBatch(
    batch: Array<{ firebaseId: string; data: DocumentData }>,
  ) {
    const queries = batch.map(async (item) => {
      let localMerchantId = null;
      if (item.data.merchant_id) {
        const merchant = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM merchants WHERE firebase_id = ?",
          [item.data.merchant_id],
        );
        localMerchantId = merchant?.id || null;
      }

      return db.runAsync(
        `INSERT INTO deliveries
         (recipient_name, phone, address, parcel_value, delivery_fee,
          merchant_id, payment_type, amount_collected, amount_to_return,
          profit, status, created_at, delivered_at, user_id, firebase_id, needs_sync, sync_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          item.data.recipient_name || "",
          item.data.phone || "",
          item.data.address || "",
          item.data.parcel_value || 0,
          item.data.delivery_fee || 0,
          localMerchantId,
          item.data.payment_type || "CLIENT_PAYE_TOUT",
          item.data.amount_collected || 0,
          item.data.amount_to_return || 0,
          item.data.profit || 0,
          item.data.status || "A_LIVRER",
          item.data.created_at || new Date().toISOString(),
          item.data.delivered_at || null,
          auth.currentUser?.uid,
          item.firebaseId,
          item.data.updated_at || item.data.sync_updated_at || new Date().toISOString(),
        ],
      );
    });

    await Promise.all(queries);
  }

  private async updateLocalMerchant(firebaseId: string, data: DocumentData) {
    try {
      const existing = await db.getFirstAsync<{ sync_updated_at: string }>(
        "SELECT sync_updated_at FROM merchants WHERE firebase_id = ?",
        [firebaseId],
      );

      const winner = await this.resolveConflict(
        existing?.sync_updated_at,
        data.updated_at || data.sync_updated_at,
        { name: data.name, phone: data.phone, address: data.address },
        data,
      );

      await db.runAsync(
        `UPDATE merchants SET
          name = ?, phone = ?, address = ?,
          sync_updated_at = ?, updated_at = ?
        WHERE firebase_id = ?`,
        [
          winner.name || "",
          winner.phone || "",
          winner.address || "",
          data.updated_at || new Date().toISOString(),
          new Date().toISOString(),
          firebaseId,
        ],
      );
    } catch (error) {
      console.error(`❌ Erreur mise à jour commerçant ${firebaseId}:`, error);
    }
  }

  private async updateLocalDelivery(firebaseId: string, data: DocumentData) {
    try {
      let localMerchantId = null;
      if (data.merchant_id) {
        const merchant = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM merchants WHERE firebase_id = ?",
          [data.merchant_id],
        );
        localMerchantId = merchant?.id || null;
      }

      await db.runAsync(
        `UPDATE deliveries SET
          recipient_name = ?, phone = ?, address = ?,
          parcel_value = ?, delivery_fee = ?, merchant_id = ?,
          payment_type = ?, amount_collected = ?, amount_to_return = ?,
          profit = ?, status = ?, delivered_at = ?,
          sync_updated_at = ?
        WHERE firebase_id = ?`,
        [
          data.recipient_name || "",
          data.phone || "",
          data.address || "",
          data.parcel_value || 0,
          data.delivery_fee || 0,
          localMerchantId,
          data.payment_type || "CLIENT_PAYE_TOUT",
          data.amount_collected || 0,
          data.amount_to_return || 0,
          data.profit || 0,
          data.status || "A_LIVRER",
          data.delivered_at || null,
          data.updated_at || new Date().toISOString(),
          firebaseId,
        ],
      );
    } catch (error) {
      console.error(`❌ Erreur mise à jour livraison ${firebaseId}:`, error);
    }
  }

  // === SYNC ALL ===

  async syncAll() {
    if (this.syncInProgress || !this.isOnline || !auth.currentUser) {
      return;
    }

    this.syncInProgress = true;
    console.log("🔄 Début synchronisation pour:", auth.currentUser.uid);

    try {
      await this.syncMerchants();
      await this.syncDeliveries();
    } catch (error) {
      console.error("❌ Erreur synchronisation:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // === MARK FOR SYNC ===

  async markForSync(table: string, id: number) {
    const now = new Date().toISOString();
    const syncCol = table === "merchants" ? "sync_updated_at" : "sync_updated_at";

    await db.runAsync(
      `UPDATE ${table} SET needs_sync = 1, ${syncCol} = ? WHERE id = ?`,
      [now, id],
    );

    // Ajouter à la file persistante
    await this.addToPersistentQueue(table, id);

    // Ajouter à la queue mémoire
    this.syncQueue.push({ table, id });

    // Debounce
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.processSyncQueue();
    }, SYNC_DEBOUNCE);
  }

  // === SYNC MERCHANT NOW (IMMEDIATE) ===

  async syncMerchantNow(merchantId: number) {
    if (!this.isOnline || !auth.currentUser) {
      console.log("⏭️ Sync commerçant ignorée: hors ligne");
      return null;
    }

    try {
      const merchant = await db.getFirstAsync<Merchant>(
        "SELECT * FROM merchants WHERE id = ?",
        [merchantId],
      );

      if (!merchant) {
        console.log(`❌ Commerçant ${merchantId} non trouvé`);
        return null;
      }

      if (merchant.firebase_id) {
        return merchant.firebase_id;
      }

      const firebaseUid = auth.currentUser.uid;

      if (merchant.user_id !== firebaseUid) {
        await db.runAsync("UPDATE merchants SET user_id = ? WHERE id = ?", [
          firebaseUid,
          merchantId,
        ]);
      }

      const firestoreData: Record<string, unknown> = {
        name: merchant.name,
        phone: merchant.phone || null,
        address: merchant.address || null,
        user_id: firebaseUid,
        created_at: merchant.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const docRef = doc(collection(firestore, "merchants"));
      await setDoc(docRef, firestoreData);

      await db.runAsync(
        `UPDATE merchants SET firebase_id = ?, needs_sync = 0, user_id = ?, sync_updated_at = ? WHERE id = ?`,
        [docRef.id, firebaseUid, new Date().toISOString(), merchantId],
      );

      // Nettoyer la file persistante
      await this.markSyncCompleted("merchants", merchantId);

      return docRef.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue";
      await this.markSyncFailed("merchants", merchantId, msg);
      return null;
    }
  }

  // === PROCESS SYNC QUEUE ===

  private async processSyncQueue() {
    if (this.syncQueue.length === 0 || !this.isOnline) return;

    console.log(`🔄 Traitement de ${this.syncQueue.length} éléments en mémoire...`);
    const queue = [...this.syncQueue];
    this.syncQueue = [];
    await this.syncAll();
  }

  // === SYNC DELIVERIES ===

  private async syncDeliveries() {
    const items = await db.getAllAsync<Delivery>(
      `SELECT * FROM deliveries WHERE needs_sync = 1 LIMIT 20`,
    );

    if (items.length === 0) return;
    console.log(`🔄 Synchronisation de ${items.length} livraisons...`);

    for (const item of items) {
      await this.syncSingleDelivery(item);
    }
  }

  private async syncSingleDelivery(item: Delivery) {
    try {
      let merchantFirebaseId = null;
      if (item.merchant_id) {
        const merchant = await db.getFirstAsync<{ firebase_id: string }>(
          "SELECT firebase_id FROM merchants WHERE id = ?",
          [item.merchant_id],
        );

        if (merchant) {
          if (!merchant.firebase_id) {
            merchantFirebaseId = await this.syncMerchantNow(item.merchant_id);
          } else {
            merchantFirebaseId = merchant.firebase_id;
          }
        }
      }

      const now = new Date().toISOString();
      const firestoreData: Record<string, unknown> = {
        recipient_name: item.recipient_name,
        phone: item.phone,
        address: item.address,
        parcel_value: item.parcel_value,
        delivery_fee: item.delivery_fee,
        merchant_id: merchantFirebaseId,
        payment_type: item.payment_type,
        amount_collected: item.amount_collected,
        amount_to_return: item.amount_to_return,
        profit: item.profit,
        status: item.status,
        created_at: item.created_at,
        delivered_at: item.delivered_at,
        user_id: auth.currentUser?.uid,
        updated_at: now,
        sync_updated_at: now,
      };

      if (item.firebase_id) {
        // Vérifier conflit avec la version distante
        const remoteDoc = await getDoc(doc(firestore, "deliveries", item.firebase_id));
        if (remoteDoc.exists()) {
          const remoteData = remoteDoc.data();
          const resolvedData = await this.resolveConflict(
            item.sync_updated_at,
            remoteData.updated_at,
            firestoreData,
            remoteData,
          );
          await updateDoc(doc(firestore, "deliveries", item.firebase_id), resolvedData);
        } else {
          // Document distant supprimé, recréer
          await setDoc(doc(firestore, "deliveries", item.firebase_id), firestoreData);
        }

        await db.runAsync(
          `UPDATE deliveries SET needs_sync = 0, sync_updated_at = ? WHERE id = ?`,
          [now, item.id],
        );
      } else {
        const docRef = doc(collection(firestore, "deliveries"));
        await setDoc(docRef, firestoreData);

        await db.runAsync(
          `UPDATE deliveries SET firebase_id = ?, needs_sync = 0, sync_updated_at = ? WHERE id = ?`,
          [docRef.id, now, item.id],
        );
      }

      // Nettoyer la file persistante
      await this.markSyncCompleted("deliveries", item.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue";
      await this.markSyncFailed("deliveries", item.id, msg);
    }
  }

  // === SYNC MERCHANTS ===

  private async syncMerchants() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const items = await db.getAllAsync<Merchant>(
      `SELECT * FROM merchants
       WHERE user_id = ? AND needs_sync = 1`,
      [userId],
    );

    if (items.length === 0) return;
    console.log(`🔄 Synchronisation de ${items.length} commerçants...`);

    for (const item of items) {
      await this.syncSingleMerchant(item);
    }
  }

  private async syncSingleMerchant(item: Merchant) {
    try {
      const now = new Date().toISOString();
      const firestoreData: Record<string, unknown> = {
        name: item.name,
        phone: item.phone,
        user_id: auth.currentUser?.uid,
        updated_at: now,
        sync_updated_at: now,
      };

      if (item.address) {
        firestoreData.address = item.address;
      }

      if (item.firebase_id) {
        const remoteDoc = await getDoc(doc(firestore, "merchants", item.firebase_id));
        if (remoteDoc.exists()) {
          const remoteData = remoteDoc.data();
          const resolvedData = await this.resolveConflict(
            item.sync_updated_at,
            remoteData.updated_at,
            firestoreData,
            remoteData,
          );
          await updateDoc(doc(firestore, "merchants", item.firebase_id), resolvedData);
        } else {
          await setDoc(doc(firestore, "merchants", item.firebase_id), firestoreData);
        }

        await db.runAsync(
          `UPDATE merchants SET needs_sync = 0, sync_updated_at = ? WHERE id = ?`,
          [now, item.id],
        );
      } else {
        const docRef = doc(collection(firestore, "merchants"));
        await setDoc(docRef, {
          ...firestoreData,
          created_at: item.created_at || now,
        });

        await db.runAsync(
          `UPDATE merchants SET firebase_id = ?, needs_sync = 0, sync_updated_at = ? WHERE id = ?`,
          [docRef.id, now, item.id],
        );
      }

      await this.markSyncCompleted("merchants", item.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue";
      await this.markSyncFailed("merchants", item.id, msg);
    }
  }

  clearQueue() {
    this.syncQueue = [];
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }
}

export const syncService = new SyncService();
