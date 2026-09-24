import { Share } from "react-native";
import { DatabaseService } from "../database/db";
import { Delivery } from "../types";
import { MerchantRepository } from "../repositories/merchant.repository";
import { DeliveryRepository } from "../repositories/delivery.repository";
import { Formatters } from "../utils/formatters";

export type ReportGranularity = "week" | "month" | "year";

export interface BucketDatum {
  key: string;
  label: string;
  value: number;
}

export interface PaymentChannel {
  key: string;
  label: string;
  sub: string;
  amount: number;
  count: number;
  pct: number;
  color: string;
  bg: string;
  icon: string;
}

export interface MerchantRank {
  id: number;
  name: string;
  deliveries: number;
  profit: number;
}

export interface ZoneShare {
  name: string;
  deliveries: number;
  pct: number;
  color: string;
}

export interface MonthClosure {
  closed: boolean;
  closedAt: string | null;
  id: number | null;
}

export interface PeriodReport {
  granularity: ReportGranularity;
  refYear: number;
  refMonth: number; // 1-12
  rangeStart: string;
  rangeEndExclusive: string;
  profit: number;
  prevProfit: number;
  changePct: number;
  count: number;
  totalCreated: number;
  successRate: number;
  avg: number;
  totalKm: number;
  avgKmPerDay: number;
  buckets: BucketDatum[];
  picIndex: number;
  bucketsTotal: number;
  treasury: number;
  payments: PaymentChannel[];
  merchants: MerchantRank[];
  zones: ZoneShare[];
  goal: number;
  goalProgress: number;
  goalRemaining: number;
  audit: {
    collected: number;
    toReturn: number;
    reversed: number;
    pending: number;
    ecart: number;
  };
  closure: MonthClosure | null;
}

// Communes d'Abidjan reconnues dans les adresses libres
const COMMUNES = [
  "Port-Bouët",
  "Port-Bouet",
  "Grand-Bassam",
  "Attécoubé",
  "Attecoube",
  "Bingerville",
  "Treichville",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Yopougon",
  "Cocody",
  "Adjamé",
  "Adjame",
  "Abobo",
  "Anyama",
  "Songon",
];

const ZONE_COLORS = ["#00A859", "#5BB8FE", "#FFB95F", "#B9BEC9"];

const PAYMENT_META: Record<
  string,
  { label: string; sub: string; color: string; bg: string; icon: string }
> = {
  CLIENT_PAYE_TOUT: {
    label: "Cash à la livraison",
    sub: "Client paie tout",
    color: "#00A859",
    bg: "#D1FAE5",
    icon: "payments",
  },
  CLIENT_PAYE_LIVRAISON: {
    label: "Frais seuls",
    sub: "Colis déjà payé",
    color: "#006398",
    bg: "#DBEAFE",
    icon: "moped",
  },
  LIVRAISON_DEJA_PAYEE: {
    label: "Colis seul",
    sub: "Course prise en charge",
    color: "#B45309",
    bg: "#FFEDD5",
    icon: "inventory-2",
  },
  COLIS_DEJA_PAYE: {
    label: "100% prépayé",
    sub: "Sans encaissement",
    color: "#8A6D1B",
    bg: "#F5EBD7",
    icon: "verified",
  },
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sept",
  "Oct",
  "Nov",
  "Déc",
];

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export class PeriodReportService {
  static rangeOf(
    granularity: ReportGranularity,
    ref: Date,
  ): { start: Date; end: Date } {
    if (granularity === "week") {
      const day = ref.getDay(); // 0=Dim
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const start = new Date(ref);
      start.setDate(ref.getDate() + mondayOffset);
      start.setHours(0, 0, 0, 0);
      return { start, end: addDays(start, 7) };
    }
    if (granularity === "year") {
      const start = new Date(ref.getFullYear(), 0, 1);
      const end = new Date(ref.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    return { start, end };
  }

  static async getReport(
    userId: number,
    granularity: ReportGranularity,
    ref: Date,
  ): Promise<PeriodReport> {
    const { start, end } = this.rangeOf(granularity, ref);
    const startStr = toLocalDateStr(start);
    const endStr = toLocalDateStr(end);
    const prevEnd = start;
    const prevStart = new Date(start);
    const durationDays = Math.round(
      (end.getTime() - start.getTime()) / 86400000,
    );
    prevStart.setDate(prevStart.getDate() - durationDays);
    const prevStartStr = toLocalDateStr(prevStart);

    const [delivered, prevRow, createdRow, goalRow, merchants, closureRow] =
      await Promise.all([
        DatabaseService.query<Delivery>(
          `SELECT id, delivery_fee, parcel_value, payment_type, amount_collected,
            amount_to_return, profit, merchant_id, address, delivered_at,
            created_at, reversed
           FROM deliveries
           WHERE user_id = ? AND status = 'LIVREE'
           AND date(delivered_at) >= ? AND date(delivered_at) < ?
           ORDER BY delivered_at ASC`,
          [userId, startStr, endStr],
        ),
        DatabaseService.getOne<{ total: number }>(
          `SELECT COALESCE(SUM(delivery_fee), 0) as total FROM deliveries
           WHERE user_id = ? AND status = 'LIVREE'
           AND date(delivered_at) >= ? AND date(delivered_at) < ?`,
          [userId, prevStartStr, startStr],
        ),
        DatabaseService.getOne<{ total: number }>(
          `SELECT COUNT(*) as total FROM deliveries
           WHERE user_id = ? AND date(created_at) >= ? AND date(created_at) < ?`,
          [userId, startStr, endStr],
        ),
        DatabaseService.getOne<{ monthly_goal: number }>(
          `SELECT monthly_goal FROM user WHERE id = ?`,
          [userId],
        ),
        MerchantRepository.findAll().catch(() => []),
        granularity === "month"
          ? DatabaseService.getOne<{ id: number; closed_at: string }>(
              `SELECT id, closed_at FROM month_closures
               WHERE user_id = ? AND year = ? AND month = ?`,
              [userId, start.getFullYear(), start.getMonth() + 1],
            ).catch(() => null)
          : Promise.resolve(null),
      ]);

    const profit = delivered.reduce((s, d) => s + (d.delivery_fee || 0), 0);
    const prevProfit = prevRow?.total || 0;
    const changePct =
      prevProfit === 0
        ? profit > 0
          ? 100
          : 0
        : Math.round(((profit - prevProfit) / prevProfit) * 1000) / 10;
    const count = delivered.length;
    const totalCreated = createdRow?.total || 0;
    const successRate =
      totalCreated > 0 ? Math.round((count / totalCreated) * 1000) / 10 : 0;
    const avg = count > 0 ? profit / count : 0;

    const activeDays = new Set(
      delivered.map((d) =>
        (d.delivered_at || d.created_at || "").slice(0, 10),
      ),
    ).size;
    const totalKm = count * 5; // estimation : 5 km par livraison
    const avgKmPerDay = activeDays > 0 ? totalKm / activeDays : 0;

    const buckets = this.buildBuckets(granularity, start, delivered);
    const bucketsTotal = buckets.reduce((s, b) => s + b.value, 0);
    let picIndex = 0;
    buckets.forEach((b, i) => {
      if (b.value > buckets[picIndex].value) picIndex = i;
    });

    // Trésorerie + ventilation par mode de paiement (données réelles)
    const treasury = delivered.reduce(
      (s, d) => s + (d.amount_collected || 0),
      0,
    );
    const byType = new Map<string, { amount: number; count: number }>();
    delivered.forEach((d) => {
      const key = d.payment_type || "CLIENT_PAYE_TOUT";
      const cur = byType.get(key) || { amount: 0, count: 0 };
      cur.amount += d.amount_collected || 0;
      cur.count += 1;
      byType.set(key, cur);
    });
    const payments: PaymentChannel[] = Object.keys(PAYMENT_META)
      .map((key) => {
        const meta = PAYMENT_META[key];
        const cur = byType.get(key) || { amount: 0, count: 0 };
        return {
          key,
          label: meta.label,
          sub: meta.sub,
          amount: cur.amount,
          count: cur.count,
          pct: treasury > 0 ? (cur.amount / treasury) * 100 : 0,
          color: meta.color,
          bg: meta.bg,
          icon: meta.icon,
        };
      })
      .filter((p) => p.count > 0)
      .sort((a, b) => b.amount - a.amount);

    // Top marchands (noms réels)
    const nameMap = new Map<number, string>();
    merchants.forEach((m) => nameMap.set(m.id, m.name));
    const byMerchant = new Map<number, { count: number; profit: number }>();
    delivered.forEach((d) => {
      const mid = d.merchant_id ?? 0;
      const cur = byMerchant.get(mid) || { count: 0, profit: 0 };
      cur.count += 1;
      cur.profit += d.profit ?? d.delivery_fee ?? 0;
      byMerchant.set(mid, cur);
    });
    const merchantRanks: MerchantRank[] = Array.from(byMerchant.entries())
      .map(([mid, v]) => ({
        id: mid,
        name: nameMap.get(mid) || "Particulier",
        deliveries: v.count,
        profit: v.profit,
      }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 3);

    // Zones chaudes (communes détectées dans les adresses)
    const zoneCount = new Map<string, number>();
    delivered.forEach((d) => {
      const commune = this.detectCommune(d.address);
      zoneCount.set(commune, (zoneCount.get(commune) || 0) + 1);
    });
    const zones: ZoneShare[] = Array.from(zoneCount.entries())
      .map(([name, c]) => ({
        name,
        deliveries: c,
        pct: count > 0 ? (c / count) * 100 : 0,
        color: "",
      }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 4)
      .map((z, i) => ({ ...z, color: ZONE_COLORS[i % ZONE_COLORS.length] }));

    // Objectif mensuel
    const goal = goalRow?.monthly_goal || 0;
    const goalProgress =
      goal > 0 ? Math.min((profit / goal) * 100, 100) : 0;
    const goalRemaining = Math.max(goal - profit, 0);

    // Audit anti-litige (contrôle de concordance réel)
    const collected = treasury;
    const toReturn = delivered.reduce(
      (s, d) => s + (d.amount_to_return || 0),
      0,
    );
    const reversed = delivered
      .filter((d) => d.reversed === 1)
      .reduce((s, d) => s + (d.amount_to_return || 0), 0);
    const pending = toReturn - reversed;
    const ecart = Math.round(
      delivered.reduce(
        (s, d) =>
          s +
          (d.amount_collected || 0) -
          (d.amount_to_return || 0) -
          (d.profit ?? d.delivery_fee ?? 0),
        0,
      ),
    );

    return {
      granularity,
      refYear: start.getFullYear(),
      refMonth: start.getMonth() + 1,
      rangeStart: startStr,
      rangeEndExclusive: endStr,
      profit,
      prevProfit,
      changePct,
      count,
      totalCreated,
      successRate,
      avg,
      totalKm,
      avgKmPerDay,
      buckets,
      picIndex,
      bucketsTotal,
      treasury,
      payments,
      merchants: merchantRanks,
      zones,
      goal,
      goalProgress,
      goalRemaining,
      audit: { collected, toReturn, reversed, pending, ecart },
      closure: closureRow
        ? { closed: true, closedAt: closureRow.closed_at, id: closureRow.id }
        : granularity === "month"
          ? { closed: false, closedAt: null, id: null }
          : null,
    };
  }

  private static buildBuckets(
    granularity: ReportGranularity,
    start: Date,
    delivered: Delivery[],
  ): BucketDatum[] {
    if (granularity === "week") {
      const buckets: BucketDatum[] = DAY_LABELS.map((label, i) => ({
        key: `d${i}`,
        label,
        value: 0,
      }));
      delivered.forEach((d) => {
        const dt = new Date(d.delivered_at || d.created_at);
        const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
        buckets[idx].value += d.delivery_fee || 0;
      });
      return buckets;
    }
    if (granularity === "year") {
      const buckets: BucketDatum[] = MONTH_LABELS.map((label, i) => ({
        key: `m${i}`,
        label,
        value: 0,
      }));
      delivered.forEach((d) => {
        const dt = new Date(d.delivered_at || d.created_at);
        buckets[dt.getMonth()].value += d.delivery_fee || 0;
      });
      return buckets;
    }
    const daysInMonth = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    const n = Math.ceil(daysInMonth / 7);
    const buckets: BucketDatum[] = Array.from({ length: n }, (_, i) => ({
      key: `s${i + 1}`,
      label: `Sem ${i + 1}`,
      value: 0,
    }));
    delivered.forEach((d) => {
      const dt = new Date(d.delivered_at || d.created_at);
      const idx = Math.min(Math.ceil(dt.getDate() / 7) - 1, n - 1);
      if (idx >= 0) buckets[idx].value += d.delivery_fee || 0;
    });
    return buckets;
  }

  private static detectCommune(address?: string): string {
    const a = (address || "").toLowerCase();
    for (const commune of COMMUNES) {
      if (a.includes(commune.toLowerCase())) {
        // Normaliser les variantes sans accent
        if (commune === "Port-Bouet") return "Port-Bouët";
        if (commune === "Attecoube") return "Attécoubé";
        if (commune === "Adjame") return "Adjamé";
        return commune;
      }
    }
    return "Autre";
  }

  // Clôture mensuelle : fige les reversements + enregistre le certificat
  static async closeMonth(
    userId: number,
    year: number,
    month: number,
  ): Promise<{ closureId: number; marked: number; report: PeriodReport }> {
    const existing = await DatabaseService.getOne<{ id: number }>(
      `SELECT id FROM month_closures WHERE user_id = ? AND year = ? AND month = ?`,
      [userId, year, month],
    );
    if (existing) throw new Error("MONTH_ALREADY_CLOSED");

    const report = await this.getReport(
      userId,
      "month",
      new Date(year, month - 1, 1),
    );
    const marked = await DeliveryRepository.markReversedInRange(
      userId,
      report.rangeStart,
      report.rangeEndExclusive,
    );
    const res = await DatabaseService.execute(
      `INSERT OR IGNORE INTO month_closures
        (user_id, year, month, profit, deliveries, collected, reversed_total, needs_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        userId,
        year,
        month,
        Math.round(report.profit),
        report.count,
        Math.round(report.audit.collected),
        Math.round(report.audit.toReturn),
      ],
    );
    const row = await DatabaseService.getOne<{ id: number }>(
      `SELECT id FROM month_closures WHERE user_id = ? AND year = ? AND month = ?`,
      [userId, year, month],
    );
    return {
      closureId: row?.id ?? res.lastInsertRowId ?? 0,
      marked,
      report,
    };
  }

  // Pré-rapport partageable (WhatsApp / PDF via impression)
  static buildShareText(report: PeriodReport, monthLabel: string): string {
    const f = (n: number) => Formatters.formatNumber(Math.round(n));
    const lines = [
      `📊 DELYGEST — Bilan ${monthLabel}`,
      `━━━━━━━━━━━━━━━`,
      `💰 Bénéfice net : ${f(report.profit)} FCFA (${report.changePct >= 0 ? "+" : ""}${report.changePct}% vs période précédente)`,
      `🛵 Courses : ${report.count} (${report.successRate}% succès)`,
      `📦 Moy/course : ${f(report.avg)} F`,
      `💵 Trésorerie collectée : ${f(report.treasury)} FCFA`,
      ``,
      `💳 Encaissements :`,
      ...report.payments.map(
        (p) => `  • ${p.label} : ${f(p.amount)} F (${Math.round(p.pct)}%)`,
      ),
      ``,
      `🏪 Top marchands :`,
      ...report.merchants.map(
        (m) => `  • ${m.name} : ${m.deliveries} courses (+${f(m.profit)} F)`,
      ),
      ``,
      `📍 Zones :`,
      ...report.zones.map(
        (z) => `  • ${z.name} : ${Math.round(z.pct)}% (${z.deliveries})`,
      ),
      ``,
      `✅ Reversé : ${f(report.audit.reversed)} F | ⏳ En attente : ${f(report.audit.pending)} F`,
      `Certifié Delygest ✔️`,
    ];
    return lines.join("\n");
  }

  static async shareReport(report: PeriodReport, monthLabel: string) {
    await Share.share({
      message: this.buildShareText(report, monthLabel),
      title: `Pré-rapport ${monthLabel}`,
    });
  }
}
