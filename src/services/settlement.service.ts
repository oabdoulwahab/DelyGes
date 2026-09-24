import { Share } from "react-native";
import { DatabaseService } from "../database/db";
import { Delivery } from "../types";
import { MerchantRepository } from "../repositories/merchant.repository";
import { DeliveryRepository } from "../repositories/delivery.repository";
import { Formatters } from "../utils/formatters";
import { detectCommune } from "../utils/communes";

export type SettlementChannel = "WAVE" | "ORANGE" | "MTN" | "CASH";

export const CHANNEL_META: Record<
  SettlementChannel,
  { label: string; color: string; bg: string; icon: string }
> = {
  WAVE: {
    label: "Wave",
    color: "#006398",
    bg: "#DBEAFE",
    icon: "account-balance-wallet",
  },
  ORANGE: {
    label: "Orange Money",
    color: "#D97706",
    bg: "#FFEDD5",
    icon: "contactless",
  },
  MTN: {
    label: "MTN MoMo",
    color: "#A16207",
    bg: "#FEF3C7",
    icon: "phone-android",
  },
  CASH: {
    label: "Espèces",
    color: "#00A859",
    bg: "#D1FAE5",
    icon: "payments",
  },
};

export interface SettlementRow {
  id: number;
  merchant_id: number;
  merchant_name: string;
  amount: number;
  channel: SettlementChannel;
  reference: string | null;
  settled_at: string;
}

export interface SettledParcel {
  id: number;
  merchant_name: string;
  recipient_name: string;
  address: string;
  amount_to_return: number;
  amount_collected: number;
  delivered_at: string;
  reversed: boolean;
}

export interface MerchantBalance {
  merchantId: number;
  name: string;
  phone?: string;
  deliveries: Delivery[];
  count: number;
  commune: string;
  collected: number;
  pendingAmount: number;
  settledLifetime: number;
  due: number;
}

function monthBounds(d: Date): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const to = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;
  return { from, to };
}

export class SettlementService {
  // Soldes par marchand : dû = montant à reverser non reversé − versements enregistrés.
  // Inclut aussi les marchands soldés (reçus ou clôtures legacy) pour
  // qu'aucun marchand avec activité ne disparaisse de "Par commerçant".
  static async getBalances(userId: number): Promise<MerchantBalance[]> {
    const [pendings, merchants, settledRows, reversedRows] = await Promise.all([
      DeliveryRepository.findPendingReversal(userId).catch((e) => {
        console.error("❌ findPendingReversal:", e);
        return [];
      }),
      MerchantRepository.findAll().catch((e) => {
        console.error("❌ Merchant findAll:", e);
        return [];
      }),
      DatabaseService.query<{ merchant_id: number; total: number }>(
        `SELECT merchant_id, COALESCE(SUM(amount), 0) as total FROM settlements
         WHERE merchant_id IS NOT NULL AND (user_id = ? OR user_id IS NULL OR user_id = 0)
         GROUP BY merchant_id`,
        [userId],
      ).catch((e) => {
        console.error("❌ settlements sum:", e);
        return [];
      }),
      DatabaseService.query<{
        merchant_id: number;
        cnt: number;
        total: number;
        collected: number;
      }>(
        `SELECT merchant_id, COUNT(*) as cnt,
          COALESCE(SUM(amount_to_return), 0) as total,
          COALESCE(SUM(amount_collected), 0) as collected
         FROM deliveries
         WHERE user_id = ? AND status = 'LIVREE' AND reversed = 1
         GROUP BY merchant_id`,
        [userId],
      ).catch((e) => {
        console.error("❌ reversed groups:", e);
        return [];
      }),
    ]);
    console.log(
      `📒 Soldes: ${pendings.length} livrée(s) non reversée(s), ${merchants.length} marchand(s), ${settledRows.length} avec reçu(s), ${reversedRows.length} avec clôture(s)`,
    );

    const nameMap = new Map<number, { name: string; phone?: string }>();
    merchants.forEach((m) =>
      nameMap.set(m.id, { name: m.name, phone: m.phone || undefined }),
    );
    const settledMap = new Map<number, number>();
    settledRows.forEach((r) => settledMap.set(r.merchant_id, r.total || 0));

    const byMerchant = new Map<number, Delivery[]>();
    pendings.forEach((d) => {
      const mid = d.merchant_id ?? 0;
      if (!byMerchant.has(mid)) byMerchant.set(mid, []);
      byMerchant.get(mid)!.push(d);
    });

    const balances: MerchantBalance[] = Array.from(byMerchant.entries()).map(
      ([mid, list]) => {
        const pendingAmount = list.reduce(
          (s, d) => s + (d.amount_to_return || 0),
          0,
        );
        const collected = list.reduce(
          (s, d) => s + (d.amount_collected || 0),
          0,
        );
        const settledLifetime = settledMap.get(mid) || 0;
        const communes = new Map<string, number>();
        list.forEach((d) => {
          const c = detectCommune(d.address);
          communes.set(c, (communes.get(c) || 0) + 1);
        });
        const commune =
          Array.from(communes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          "Abidjan";
        return {
          merchantId: mid,
          name: nameMap.get(mid)?.name || "Particulier",
          phone: nameMap.get(mid)?.phone,
          deliveries: list.sort(
            (a, b) =>
              +new Date(b.delivered_at || b.created_at) -
              +new Date(a.delivered_at || a.created_at),
          ),
          count: list.length,
          commune,
          collected,
          pendingAmount,
          settledLifetime,
          due: Math.max(Math.round(pendingAmount - settledLifetime), 0),
        };
      },
    );

    // Marchands soldés sans livraison en attente (reçus et/ou clôtures
    // legacy) : visibles dans "Par commerçant" avec pastille Soldé.
    const seen = new Set(balances.map((b) => b.merchantId));
    const withActivity = new Map<number, { cnt: number; collected: number }>();
    settledRows.forEach((r) => {
      if (r.merchant_id == null) return;
      const cur = withActivity.get(r.merchant_id) || { cnt: 0, collected: 0 };
      withActivity.set(r.merchant_id, cur);
    });
    reversedRows.forEach((r) => {
      const mid = r.merchant_id ?? 0;
      const cur = withActivity.get(mid) || { cnt: 0, collected: 0 };
      cur.cnt += r.cnt || 0;
      cur.collected += r.collected || 0;
      withActivity.set(mid, cur);
    });
    withActivity.forEach((v, mid) => {
      if (seen.has(mid)) return;
      balances.push({
        merchantId: mid,
        name: nameMap.get(mid)?.name || "Particulier",
        phone: nameMap.get(mid)?.phone,
        deliveries: [],
        count: v.cnt,
        commune: "Abidjan",
        collected: Math.round(v.collected),
        pendingAmount: 0,
        settledLifetime: settledMap.get(mid) || 0,
        due: 0,
      });
    });

    return balances.sort((a, b) => b.due - a.due);
  }

  // Total déjà reversé sur le mois (versements + clôtures legacy sans reçu)
  static async getSettledThisMonth(
    userId: number,
    ref: Date,
  ): Promise<{ settled: number; legacy: number; total: number }> {
    const { from, to } = monthBounds(ref);
    const [settledRow, reversedRows] = await Promise.all([
      DatabaseService.getOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM settlements
         WHERE (user_id = ? OR user_id IS NULL OR user_id = 0)
         AND date(settled_at) >= ? AND date(settled_at) < ?`,
        [userId, from, to],
      ).catch(() => null),
      DatabaseService.query<{
        merchant_id: number;
        total: number;
      }>(
        `SELECT merchant_id, COALESCE(SUM(amount_to_return), 0) as total
         FROM deliveries
         WHERE user_id = ? AND status = 'LIVREE' AND reversed = 1
         AND date(delivered_at) >= ? AND date(delivered_at) < ?
         GROUP BY merchant_id`,
        [userId, from, to],
      ).catch(() => []),
    ]);
    const settled = settledRow?.total || 0;
    // Évite le double comptage : les livraisons figées par un versement suivi
    // sont déjà comptées dans `settled` pour le même marchand.
    const settledByMerchant = await DatabaseService.query<{
      merchant_id: number;
      total: number;
    }>(
      `SELECT merchant_id, COALESCE(SUM(amount), 0) as total FROM settlements
       WHERE (user_id = ? OR user_id IS NULL OR user_id = 0)
       AND date(settled_at) >= ? AND date(settled_at) < ?
       GROUP BY merchant_id`,
      [userId, from, to],
    ).catch(() => []);
    const settledMap = new Map<number, number>();
    settledByMerchant.forEach((r) =>
      settledMap.set(r.merchant_id ?? 0, r.total || 0),
    );
    const legacy = reversedRows.reduce(
      (s, r) => s + Math.max((r.total || 0) - (settledMap.get(r.merchant_id ?? 0) || 0), 0),
      0,
    );
    return { settled, legacy, total: settled + legacy };
  }

  static async getHistory(
    userId: number,
    limit = 30,
  ): Promise<SettlementRow[]> {
    const merchants = await MerchantRepository.findAll().catch(() => []);
    const nameMap = new Map<number, string>();
    merchants.forEach((m) => nameMap.set(m.id, m.name));
    const rows = await DatabaseService.query<{
      id: number;
      merchant_id: number;
      amount: number;
      channel: string | null;
      reference: string | null;
      settled_at: string;
    }>(
      `SELECT id, merchant_id, amount, channel, reference, settled_at
       FROM settlements
       WHERE (user_id = ? OR user_id IS NULL OR user_id = 0)
       ORDER BY settled_at DESC LIMIT ?`,
      [userId, limit],
    ).catch(() => []);
    return rows.map((r) => ({
      id: r.id,
      merchant_id: r.merchant_id,
      merchant_name: nameMap.get(r.merchant_id) || "Commerçant",
      amount: r.amount,
      channel: (r.channel as SettlementChannel) || "CASH",
      reference: r.reference,
      settled_at: r.settled_at,
    }));
  }

  // Colis sans reversement : livrés, NON reversés, et sans montant à
  // restituer (ex : colis déjà payés). Les colis reversés sont couverts
  // par les reçus de versement et n'apparaissent pas ici.
  static async getSettledParcels(
    userId: number,
    limit = 50,
  ): Promise<SettledParcel[]> {
    const merchants = await MerchantRepository.findAll().catch((e) => {
      console.error("❌ Merchant findAll:", e);
      return [];
    });
    const nameMap = new Map<number, string>();
    merchants.forEach((m) => nameMap.set(m.id, m.name));
    const rows = await DatabaseService.query<{
      id: number;
      merchant_id: number;
      recipient_name: string;
      address: string;
      amount_to_return: number;
      amount_collected: number;
      delivered_at: string;
      reversed: number | null;
    }>(
      `SELECT id, merchant_id, recipient_name, address, amount_to_return,
        amount_collected, delivered_at, reversed
       FROM deliveries
       WHERE user_id = ? AND status = 'LIVREE'
       AND (reversed IS NULL OR reversed != 1)
       AND COALESCE(amount_to_return, 0) <= 0
       ORDER BY date(delivered_at) DESC, id DESC LIMIT ?`,
      [userId, limit],
    ).catch((e) => {
      console.error("❌ settled parcels:", e);
      return [];
    });
    return rows.map((r) => ({
      id: r.id,
      merchant_name: nameMap.get(r.merchant_id) || "Particulier",
      recipient_name: r.recipient_name,
      address: r.address || "",
      amount_to_return: r.amount_to_return || 0,
      amount_collected: r.amount_collected || 0,
      delivered_at: r.delivered_at,
      reversed: r.reversed === 1,
    }));
  }

  // Enregistre un versement (partiel ou total). Solde la dette si ramenée à 0.
  static async recordSettlement(
    userId: number,
    merchantId: number,
    amount: number,
    channel: SettlementChannel,
    reference: string,
  ): Promise<{ remaining: number; fullySettled: boolean; settlementId: number }> {
    const rounded = Math.round(amount);
    if (!rounded || rounded <= 0) throw new Error("INVALID_AMOUNT");

    const balances = await this.getBalances(userId);
    const balance = balances.find((b) => b.merchantId === merchantId);
    const due = balance?.due ?? 0;
    if (rounded > due) throw new Error("AMOUNT_EXCEEDS_DUE");

    const res = await DatabaseService.execute(
      `INSERT INTO settlements (merchant_id, amount, notes, channel, reference, user_id, needs_sync)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        merchantId,
        rounded,
        reference.trim() || null,
        channel,
        reference.trim() || null,
        userId,
      ],
    );
    const settlementId = res.lastInsertRowId ?? 0;
    const remaining = due - rounded;
    let fullySettled = false;
    if (remaining <= 0) {
      await DeliveryRepository.markReversedByMerchant(merchantId).catch(
        () => {},
      );
      fullySettled = true;
    }
    return { remaining: Math.max(remaining, 0), fullySettled, settlementId };
  }

  static buildReceiptText(
    merchantName: string,
    amount: number,
    channel: SettlementChannel,
    reference: string,
    remaining: number,
    dateLabel: string,
  ): string {
    const f = (n: number) => Formatters.formatNumber(Math.round(n));
    return [
      `🧾 DELYGEST — Reçu de reversement`,
      `━━━━━━━━━━━━━━━`,
      `🏪 Marchand : ${merchantName}`,
      `💰 Versé : ${f(amount)} FCFA (${CHANNEL_META[channel].label})`,
      reference.trim() ? `🔖 Réf : ${reference.trim()}` : null,
      `📅 Date : ${dateLabel}`,
      remaining > 0
        ? `⏳ Solde restant : ${f(remaining)} FCFA`
        : `✅ Compte soldé — merci pour ta confiance !`,
      `Reçu certifié Delygest ✔️`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  static async shareReceipt(
    merchantName: string,
    amount: number,
    channel: SettlementChannel,
    reference: string,
    remaining: number,
  ) {
    const dateLabel = Formatters.formatDate(new Date(), "d MMM yyyy à HH:mm");
    await Share.share({
      message: this.buildReceiptText(
        merchantName,
        amount,
        channel,
        reference,
        remaining,
        dateLabel,
      ),
      title: `Reçu ${merchantName}`,
    });
  }

  static buildSummaryText(
    totalDue: number,
    count: number,
    balances: MerchantBalance[],
    monthLabel: string,
  ): string {
    const f = (n: number) => Formatters.formatNumber(Math.round(n));
    return [
      `📋 DELYGEST — Récap reversements (${monthLabel})`,
      `━━━━━━━━━━━━━━━`,
      `💰 Total à reverser : ${f(totalDue)} FCFA (${count} commerçants)`,
      ``,
      ...balances
        .filter((b) => b.due > 0)
        .map(
          (b) =>
            `• ${b.name} : ${f(b.due)} F (${b.count} colis)`,
        ),
      ``,
      `Reçu certifié Delygest ✔️`,
    ].join("\n");
  }

  static async shareSummary(
    totalDue: number,
    count: number,
    balances: MerchantBalance[],
    monthLabel: string,
  ) {
    await Share.share({
      message: this.buildSummaryText(totalDue, count, balances, monthLabel),
      title: "Reçu récapitulatif",
    });
  }
}
