// src/services/stats.service.ts
import { db } from "../database/db";
import { auth } from "../config/firebase";

export type Period = "day" | "week" | "month" | "year";

export interface StatsData {
  // Revenus
  totalRevenue: number;
  revenueChange: number;

  // Livraisons
  totalDeliveries: number;
  deliveriesChange: number;
  avgPerDelivery: number;

  // Kilométrage (simulé pour l'instant)
  totalKm: number;
  kmChange: number;

  // Données pour les graphiques
  chartData: number[];
  chartLabels: string[];

  // Sources de revenus (par type de paiement)
  sourcesData: {
    clientPayeTout: number; // Client paie colis + livraison
    clientPayeLivraison: number; // Client paie livraison seulement
    colisDejaPaye: number; // Colis déjà payé
  };

  // Zones top (adresses les plus fréquentes)
  topZones: Array<{
    id: number;
    name: string;
    deliveries: number;
    percentage: number;
  }>;

  // Tendances
  trend: "up" | "down" | "stable";
  trendPercentage: number;
}

export class StatsService {
  // Récupérer les statistiques pour une période donnée
  // src/services/stats.service.ts - Dans getStats()
  static async getStats(period: Period = "month"): Promise<StatsData> {
    const user = auth.currentUser;
    if (!user) throw new Error("Utilisateur non connecté");

    try {
      const { startDate, endDate, previousStartDate } =
        this.getDateRange(period);

      console.log("📊 Période sélectionnée:", period);
      console.log("📅 Date début:", startDate.toISOString());
      console.log("📅 Date fin:", endDate.toISOString());

      const currentPeriodDeliveries = await this.getDeliveriesInRange(
        startDate,
        endDate,
      );
      console.log("📦 Livraisons trouvées:", currentPeriodDeliveries.length);

      if (currentPeriodDeliveries.length > 0) {
        console.log("💵 Exemple livraison:", currentPeriodDeliveries[0]);
      }

      const previousPeriodDeliveries = await this.getDeliveriesInRange(
        previousStartDate,
        startDate,
      );

      const stats = this.calculateStats(
        currentPeriodDeliveries,
        previousPeriodDeliveries,
        period,
      );

      const allDeliveries = await db.getAllAsync<any>(
        "SELECT id, status, delivered_at, delivery_fee, payment_type FROM deliveries",
      );
      console.log("📋 Toutes les livraisons:", allDeliveries);

      return stats;
    } catch (error) {
      console.error("❌ Erreur StatsService.getStats:", error);
      return this.getDefaultStats(period);
    }
  }

  // Récupérer les livraisons dans une plage de dates
  private static async getDeliveriesInRange(startDate: Date, endDate: Date) {
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    console.log("🔍 Requête SQL:", `BETWEEN ${startStr} AND ${endStr}`);

    const result = await db.getAllAsync<any>(
      `SELECT * FROM deliveries 
     WHERE status = 'LIVREE' 
     AND delivered_at BETWEEN ? AND ?
     ORDER BY delivered_at ASC`,
      [startStr, endStr],
    );

    return result;
  }

  // Calculer toutes les statistiques
  private static calculateStats(
    current: any[],
    previous: any[],
    period: Period,
  ): StatsData {
    // Revenus totaux (somme des frais de livraison)
    const totalRevenue = current.reduce(
      (sum, d) => sum + (d.delivery_fee || 0),
      0,
    );
    const previousRevenue = previous.reduce(
      (sum, d) => sum + (d.delivery_fee || 0),
      0,
    );

    // Nombre de livraisons
    const totalDeliveries = current.length;
    const previousDeliveries = previous.length;

    // Moyenne par livraison
    const avgPerDelivery =
      totalDeliveries > 0 ? totalRevenue / totalDeliveries : 0;

    // Calcul des changements en pourcentage
    const revenueChange = this.calculatePercentageChange(
      previousRevenue,
      totalRevenue,
    );
    const deliveriesChange = this.calculatePercentageChange(
      previousDeliveries,
      totalDeliveries,
    );

    // Données pour le graphique (grouper par jour/semaine/mois)
    const { chartData, chartLabels } = this.generateChartData(current, period);

    // Sources de revenus (par type de paiement)
    const sourcesData = this.calculateSources(current);

    // Zones top (adresses les plus fréquentes)
    const topZones = this.calculateTopZones(current);

    // Tendances
    const trend =
      revenueChange > 0 ? "up" : revenueChange < 0 ? "down" : "stable";
    const trendPercentage = Math.abs(revenueChange);

    // Kilométrage (simulé pour l'instant - à remplacer par des données réelles plus tard)
    const totalKm = totalDeliveries * 5; // Estimation: 5km par livraison
    const previousKm = previousDeliveries * 5;
    const kmChange = this.calculatePercentageChange(previousKm, totalKm);

    return {
      totalRevenue,
      revenueChange,
      totalDeliveries,
      deliveriesChange,
      avgPerDelivery,
      totalKm,
      kmChange,
      chartData,
      chartLabels,
      sourcesData,
      topZones,
      trend,
      trendPercentage,
    };
  }

  // Calculer le pourcentage de changement
  private static calculatePercentageChange(
    previous: number,
    current: number,
  ): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  // Générer les données du graphique

  private static generateChartData(deliveries: any[], period: Period) {
    const chartData: number[] = [];
    const chartLabels: string[] = [];

    // Définir les labels par défaut selon la période
    const defaultLabels =
      period === "day"
        ? ["0-4h", "4-8h", "8-12h", "12-16h", "16-20h", "20-24h"]
        : period === "week"
          ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
          : ["S1", "S2", "S3", "S4"];

    // Initialiser avec des 0
    const defaultData = new Array(defaultLabels.length).fill(0);

    if (deliveries.length === 0) {
      return {
        chartData: defaultData,
        chartLabels: defaultLabels,
      };
    }

    // Grouper les livraisons
    const grouped = new Map<string, number>();

    deliveries.forEach((d) => {
      const date = new Date(d.delivered_at || d.created_at);
      let key: string;

      if (period === "day") {
        const hour = date.getHours();
        if (hour < 4) key = "0-4h";
        else if (hour < 8) key = "4-8h";
        else if (hour < 12) key = "8-12h";
        else if (hour < 16) key = "12-16h";
        else if (hour < 20) key = "16-20h";
        else key = "20-24h";
      } else if (period === "week") {
        const dayIndex = date.getDay(); // 0 = Dim, 1 = Lun, 2 = Mar, 3 = Mer, 4 = Jeu, 5 = Ven, 6 = Sam
        const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

        // Ajuster l'index pour avoir Lun=0, Mar=1, Mer=2, Jeu=3, Ven=4, Sam=5, Dim=6
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        key = days[adjustedIndex];

        console.log(
          `📅 Date: ${date.toLocaleDateString("fr-FR")} (jour ${dayIndex}) → ${key}`,
        );
      } else {
        const weekNum = Math.ceil(date.getDate() / 7);
        key = `S${weekNum}`;
      }

      grouped.set(key, (grouped.get(key) || 0) + (d.delivery_fee || 0));
    });

    // Construire les données dans l'ordre des labels par défaut
    const finalData = defaultLabels.map((label) => grouped.get(label) || 0);

    console.log(`📊 Période ${period}:`, {
      grouped: Object.fromEntries(grouped),
      finalData,
    });

    return {
      chartData: finalData,
      chartLabels: defaultLabels,
    };
  }

  // Calculer la répartition par source de revenus
  private static calculateSources(deliveries: any[]) {
    let clientPayeTout = 0;
    let clientPayeLivraison = 0;
    let colisDejaPaye = 0;

    deliveries.forEach((d) => {
      const amount = d.delivery_fee || 0;
      switch (d.payment_type) {
        case "CLIENT_PAYE_TOUT":
          clientPayeTout += amount;
          break;
        case "CLIENT_PAYE_LIVRAISON":
          clientPayeLivraison += amount;
          break;
        case "COLIS_DEJA_PAYE":
          colisDejaPaye += amount;
          break;
      }
    });

    const total = clientPayeTout + clientPayeLivraison + colisDejaPaye;

    return {
      clientPayeTout:
        total > 0 ? Math.round((clientPayeTout / total) * 100) : 33,
      clientPayeLivraison:
        total > 0 ? Math.round((clientPayeLivraison / total) * 100) : 33,
      colisDejaPaye: total > 0 ? Math.round((colisDejaPaye / total) * 100) : 34,
    };
  }

  // Calculer les zones top
  private static calculateTopZones(deliveries: any[]) {
    const zoneCount = new Map<string, { count: number; id: number }>();

    deliveries.forEach((d) => {
      // Extraire la ville/quartier de l'adresse (simplifié)
      const addressParts = d.address.split(",");
      const zone = addressParts[addressParts.length - 1]?.trim() || "Autre";

      if (!zoneCount.has(zone)) {
        zoneCount.set(zone, { count: 0, id: zoneCount.size + 1 });
      }
      zoneCount.get(zone)!.count++;
    });

    const total = deliveries.length;

    return Array.from(zoneCount.entries())
      .map(([name, data]) => ({
        id: data.id,
        name,
        deliveries: data.count,
        percentage: Math.round((data.count / total) * 100),
      }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 3);
  }

  // Définir les plages de dates selon la période
  private static getDateRange(period: Period) {
    const now = new Date();
    const startDate = new Date();
    const previousStartDate = new Date();

    switch (period) {
      case "day":
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousStartDate.setHours(0, 0, 0, 0);
        break;

      case "week":
        startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Lundi
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        previousStartDate.setHours(0, 0, 0, 0);
        break;

      case "month":
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setMonth(previousStartDate.getMonth() - 1);
        previousStartDate.setDate(1);
        previousStartDate.setHours(0, 0, 0, 0);
        break;

      case "year":
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
        previousStartDate.setMonth(0, 1);
        previousStartDate.setHours(0, 0, 0, 0);
        break;
    }

    const endDate = new Date();

    return { startDate, endDate, previousStartDate };
  }

  // Statistiques par défaut (quand pas de données)
  private static getDefaultStats(period: Period): StatsData {
    const defaultChartData =
      period === "day"
        ? Array(24).fill(0)
        : period === "week"
          ? Array(7).fill(0)
          : Array(4).fill(0);

    const defaultLabels =
      period === "day"
        ? Array.from({ length: 24 }, (_, i) => `${i}h`)
        : period === "week"
          ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
          : ["S1", "S2", "S3", "S4"];

    return {
      totalRevenue: 0,
      revenueChange: 0,
      totalDeliveries: 0,
      deliveriesChange: 0,
      avgPerDelivery: 0,
      totalKm: 0,
      kmChange: 0,
      chartData: defaultChartData,
      chartLabels: defaultLabels,
      sourcesData: {
        clientPayeTout: 33,
        clientPayeLivraison: 33,
        colisDejaPaye: 34,
      },
      topZones: [
        { id: 1, name: "Aucune donnée", deliveries: 0, percentage: 0 },
        { id: 2, name: "Aucune donnée", deliveries: 0, percentage: 0 },
        { id: 3, name: "Aucune donnée", deliveries: 0, percentage: 0 },
      ],
      trend: "stable",
      trendPercentage: 0,
    };
  }
}
