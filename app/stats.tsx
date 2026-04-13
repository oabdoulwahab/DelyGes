import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Svg, {
  Path,
  Line,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Circle,
  G,
} from "react-native-svg";
import { commonStyles } from "../styles/common";
import { statsStyles } from "../styles/statsStyles";
import { COLORS } from "../styles/colors";
import { useAuth } from "../src/context/AuthContext";
import { StatsService, Period, StatsData } from "../src/services/stats.service";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 32;
const CHART_HEIGHT = 220;

export default function Stats() {
  const { user, isAuthenticated } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("day");
  const [statsData, setStatsData] = useState<StatsData>({
    totalRevenue: 0,
    revenueChange: 0,
    totalDeliveries: 0,
    deliveriesChange: 0,
    avgPerDelivery: 0,
    totalKm: 0,
    kmChange: 0,
    chartData: [],
    chartLabels: [],
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
    trend: 'stable',
    trendPercentage: 0
  });

  useEffect(() => {
    loadStatsData();
  }, [selectedPeriod]);

  const loadStatsData = async () => {
  if (!isAuthenticated || !user) return;

  try {
    const data = await StatsService.getStats(selectedPeriod);
    console.log(`📊 Données pour ${selectedPeriod}:`, {
      totalRevenue: data.totalRevenue,
      chartData: data.chartData,
      chartLabels: data.chartLabels,
      sources: data.sourcesData
    });
    setStatsData(data);
  } catch (error) {
    console.error("❌ Erreur chargement stats:", error);
  }
};

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString("fr-FR")} FCFA`;
  };

  const getPeriodLabel = (period: Period) => {
    switch (period) {
      case "day":
        return "Aujourd'hui";
      case "week":
        return "Cette semaine";
      case "month":
        return "Ce mois";
      case "year":
        return "Cette année";
    }
  };

  const getDateRange = (period: Period) => {
    const now = new Date();
    switch (period) {
      case "day":
        return now.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        return `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} - ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
      case "month":
        return now.toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        });
      case "year":
        return now.getFullYear().toString();
    }
  };

  // Générer le chemin du graphique
  const generateChartPath = () => {
    if (!statsData || statsData.chartData.length === 0) return "";

    const points = statsData.chartData;

    // Si un seul point, on crée une ligne plate
    if (points.length === 1) {
      const x = CHART_WIDTH / 2;
      const y =
        CHART_HEIGHT -
        ((points[0] - 0) / (Math.max(...points, 1) || 1)) *
          (CHART_HEIGHT - 40) -
        20;
      return `M ${x} ${y} L ${x} ${y}`;
    }

    const step = CHART_WIDTH / (points.length - 1);
    const maxValue = Math.max(...points, 1);
    const minValue = Math.min(...points, 0);
    const range = maxValue - minValue || 1;

    let path = "";
    points.forEach((value, index) => {
      const x = index * step;
      const y =
        CHART_HEIGHT - ((value - minValue) / range) * (CHART_HEIGHT - 40) - 20;

      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevX = (index - 1) * step;
        const prevY =
          CHART_HEIGHT -
          ((points[index - 1] - minValue) / range) * (CHART_HEIGHT - 40) -
          20;

        const cp1x = prevX + step * 0.3;
        const cp1y = prevY;
        const cp2x = x - step * 0.3;
        const cp2y = y;

        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y}`;
      }
    });
    return path;
  };

  // Générer le chemin de l'aire
  const generateAreaPath = () => {
    const linePath = generateChartPath();
    if (!linePath) return "";

    const lastPoint = statsData!.chartData.length - 1;
    const step = CHART_WIDTH / (statsData!.chartData.length - 1 || 1);
    const lastX = lastPoint * step;

    return `${linePath} L ${lastX} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return "trending-up";
      case "down":
        return "trending-down";
      default:
        return "trending-flat";
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return COLORS.success;
      case "down":
        return COLORS.danger;
      default:
        return COLORS.muted;
    }
  };

  return (
    <View style={commonStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} style={statsStyles.header}>
        <Text style={statsStyles.headerTitle}>Statistiques</Text>
      </BlurView>

      <ScrollView
        style={statsStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={statsStyles.scrollContent}
      >
        {/* Sélecteur de période - Style comme deliveries */}
        <View style={statsStyles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={statsStyles.tabsScroll}
          >
            {(["day", "week", "month", "year"] as Period[]).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  statsStyles.tab,
                  selectedPeriod === period && statsStyles.activeTab,
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text
                  style={[
                    statsStyles.tabText,
                    selectedPeriod === period && statsStyles.activeTabText,
                  ]}
                >
                  {getPeriodLabel(period)}
                </Text>
                <View
                  style={[
                    statsStyles.tabIndicator,
                    selectedPeriod === period && statsStyles.activeTabIndicator,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Évolution des revenus */}
        <View style={statsStyles.revenueSection}>
          <View>
            <Text style={statsStyles.revenueTitle}>Revenus</Text>
            <View style={statsStyles.revenueHeader}>
              <Text style={statsStyles.revenueAmount}>
                {formatCurrency(statsData.totalRevenue)}
              </Text>
              <View
                style={[
                  statsStyles.revenueBadge,
                  { backgroundColor: getTrendColor(statsData.trend) + "20" },
                ]}
              >
                <MaterialIcons
                  name={getTrendIcon(statsData.trend)}
                  size={16}
                  color={getTrendColor(statsData.trend)}
                />
                <Text
                  style={[
                    statsStyles.revenueBadgeText,
                    { color: getTrendColor(statsData.trend) },
                  ]}
                >
                  {statsData.revenueChange > 0 ? "+" : ""}
                  {statsData.revenueChange}%
                </Text>
              </View>
            </View>
            <Text style={statsStyles.revenueDate}>
              {getDateRange(selectedPeriod)}
            </Text>
          </View>

          {/* Graphique */}
          <View style={statsStyles.chartContainer}>
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
              <Defs>
                <SvgGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                  <Stop
                    offset="0%"
                    stopColor={COLORS.primary}
                    stopOpacity="0.3"
                  />
                  <Stop
                    offset="100%"
                    stopColor={COLORS.primary}
                    stopOpacity="0"
                  />
                </SvgGradient>
              </Defs>

              {/* Lignes de grille */}
              {[0, 1, 2, 3].map((i) => (
                <Line
                  key={`grid-${i}`}
                  x1="0"
                  x2={CHART_WIDTH}
                  y1={i * (CHART_HEIGHT / 4)}
                  y2={i * (CHART_HEIGHT / 4)}
                  stroke={COLORS.muted}
                  strokeDasharray="4 4"
                  strokeOpacity="0.2"
                />
              ))}

              {/* Aire du graphique - conditionnel */}
              {statsData.chartData.length > 0 && (
                <>
                  <Path
                    d={generateAreaPath()}
                    fill="url(#chartGradient)"
                    opacity={statsData.chartData.some((v) => v > 0) ? 1 : 0.3}
                  />
                  <Path
                    d={generateChartPath()}
                    fill="none"
                    stroke={COLORS.primary}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={statsData.chartData.some((v) => v > 0) ? 1 : 0.3}
                  />
                </>
              )}
            </Svg>

            {/* Labels de l'axe X - toujours affichés */}
            <View style={statsStyles.chartLabels}>
              {statsData.chartLabels.length > 0 ? (
                statsData.chartLabels.map((label, index) => (
                  <Text key={index} style={statsStyles.chartLabel}>
                    {label}
                  </Text>
                ))
              ) : (
                // Labels par défaut
                ["S1", "S2", "S3", "S4"].map((label, index) => (
                  <Text key={index} style={statsStyles.chartLabel}>
                    {label}
                  </Text>
                ))
              )}
            </View>
          </View>
        </View>

        {/* Grille KPI */}
        <View style={statsStyles.kpiGrid}>
          {/* Revenu Total */}
          <View style={statsStyles.kpiCard}>
            <View style={statsStyles.kpiIconContainer}>
              <MaterialIcons name="payments" size={20} color={COLORS.primary} />
            </View>
            <Text style={statsStyles.kpiLabel}>Revenu Total</Text>
            <Text style={statsStyles.kpiValue}>
              {formatCurrency(statsData.totalRevenue)}
            </Text>
            <Text
              style={[
                statsStyles.kpiChange,
                {
                  color:
                    statsData.revenueChange >= 0
                      ? COLORS.success
                      : COLORS.danger,
                },
              ]}
            >
              {statsData.revenueChange > 0 ? "+" : ""}
              {statsData.revenueChange}%
            </Text>
          </View>

          {/* Livraisons */}
          <View style={statsStyles.kpiCard}>
            <View
              style={[
                statsStyles.kpiIconContainer,
                { backgroundColor: COLORS.primarySoft },
              ]}
            >
              <MaterialIcons
                name="local-shipping"
                size={20}
                color={COLORS.primary}
              />
            </View>
            <Text style={statsStyles.kpiLabel}>Livraisons</Text>
            <Text style={statsStyles.kpiValue}>
              {statsData.totalDeliveries}
            </Text>
            <Text
              style={[
                statsStyles.kpiChange,
                {
                  color:
                    statsData.deliveriesChange >= 0
                      ? COLORS.success
                      : COLORS.danger,
                },
              ]}
            >
              {statsData.deliveriesChange > 0 ? "+" : ""}
              {statsData.deliveriesChange}%
            </Text>
          </View>

          {/* Moyenne par livraison */}
          <View style={statsStyles.kpiCard}>
            <View
              style={[
                statsStyles.kpiIconContainer,
                { backgroundColor: COLORS.warningSoft },
              ]}
            >
              <MaterialIcons name="receipt" size={20} color={COLORS.warning} />
            </View>
            <Text style={statsStyles.kpiLabel}>Moy. / Liv.</Text>
            <Text style={statsStyles.kpiValue}>
              {formatCurrency(statsData.avgPerDelivery)}
            </Text>
            <Text style={statsStyles.kpiChange}>par livraison</Text>
          </View>

          {/* Kilométrage */}
          <View style={statsStyles.kpiCard}>
            <View
              style={[
                statsStyles.kpiIconContainer,
                { backgroundColor: COLORS.dangerSoft },
              ]}
            >
              <MaterialIcons name="speed" size={20} color={COLORS.danger} />
            </View>
            <Text style={statsStyles.kpiLabel}>Kilométrage</Text>
            <Text style={statsStyles.kpiValue}>{statsData.totalKm} km</Text>
            <Text
              style={[
                statsStyles.kpiChange,
                {
                  color:
                    statsData.kmChange >= 0 ? COLORS.warning : COLORS.muted,
                },
              ]}
            >
              {statsData.kmChange > 0 ? "+" : ""}
              {statsData.kmChange}%
            </Text>
          </View>
        </View>

        {/* Sources de revenus */}
        <View style={statsStyles.sourcesSection}>
          <Text style={statsStyles.sourcesTitle}>Sources de Revenus</Text>

          <View style={statsStyles.sourcesContainer}>
            {/* Graphique donut */}
            <View style={statsStyles.donutContainer}>
              <Svg width={120} height={120} viewBox="0 0 100 100">
                <G rotation="-90" origin="50, 50">
                  {/* Cercle de fond */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={COLORS.borderLight}
                    strokeWidth="12"
                  />

                  {/* Client paie tout */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={COLORS.primary}
                    strokeWidth="12"
                    strokeDasharray={`${(statsData.sourcesData.clientPayeTout / 100) * 251} 251`}
                    strokeDashoffset="0"
                  />

                  {/* Client paie livraison */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={COLORS.warning}
                    strokeWidth="12"
                    strokeDasharray={`${(statsData.sourcesData.clientPayeLivraison / 100) * 251} 251`}
                    strokeDashoffset={
                      -((statsData.sourcesData.clientPayeTout / 100) * 251)
                    }
                  />

                  {/* Colis déjà payé */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={COLORS.success}
                    strokeWidth="12"
                    strokeDasharray={`${(statsData.sourcesData.colisDejaPaye / 100) * 251} 251`}
                    strokeDashoffset={
                      -(
                        ((statsData.sourcesData.clientPayeTout +
                          statsData.sourcesData.clientPayeLivraison) /
                          100) *
                        251
                      )
                    }
                  />
                </G>
              </Svg>

              <View style={statsStyles.donutCenter}>
                <Text style={statsStyles.donutTotalLabel}>Total</Text>
                <Text style={statsStyles.donutTotal}>100%</Text>
              </View>
            </View>

            {/* Légende */}
            <View style={statsStyles.legendContainer}>
              <View style={statsStyles.legendItem}>
                <View
                  style={[
                    statsStyles.legendColor,
                    { backgroundColor: COLORS.primary },
                  ]}
                />
                <Text style={statsStyles.legendLabel}>Client paie tout</Text>
                <Text style={statsStyles.legendValue}>
                  {statsData.sourcesData.clientPayeTout}%
                </Text>
              </View>

              <View style={statsStyles.legendItem}>
                <View
                  style={[
                    statsStyles.legendColor,
                    { backgroundColor: COLORS.warning },
                  ]}
                />
                <Text style={statsStyles.legendLabel}>
                  Client paie livraison
                </Text>
                <Text style={statsStyles.legendValue}>
                  {statsData.sourcesData.clientPayeLivraison}%
                </Text>
              </View>

              <View style={statsStyles.legendItem}>
                <View
                  style={[
                    statsStyles.legendColor,
                    { backgroundColor: COLORS.success },
                  ]}
                />
                <Text style={statsStyles.legendLabel}>Colis déjà payé</Text>
                <Text style={statsStyles.legendValue}>
                  {statsData.sourcesData.colisDejaPaye}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Zones Top */}
        {statsData.topZones[0]?.deliveries > 0 && (
          <View style={statsStyles.zonesSection}>
            <Text style={statsStyles.zonesTitle}>Zones Top</Text>

            {statsData.topZones.map((zone, index) => (
              <View key={zone.id} style={statsStyles.zoneItem}>
                <View style={statsStyles.zoneRank}>
                  <Text style={statsStyles.zoneRankText}>{index + 1}</Text>
                </View>

                <View style={statsStyles.zoneContent}>
                  <View style={statsStyles.zoneHeader}>
                    <Text style={statsStyles.zoneName}>{zone.name}</Text>
                    <Text style={statsStyles.zoneDeliveries}>
                      {zone.deliveries}
                    </Text>
                  </View>

                  <View style={statsStyles.progressBar}>
                    <View
                      style={[
                        statsStyles.progressFill,
                        { width: `${zone.percentage}%` },
                      ]}
                    />
                  </View>

                  <Text style={statsStyles.zoneDeliveriesLabel}>
                    livraisons
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}