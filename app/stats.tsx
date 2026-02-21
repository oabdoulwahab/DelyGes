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
import { useAuth } from "../src/hooks/useAuth";
import { db } from "../src/database/db";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 32;
const CHART_HEIGHT = 220;

type Period = "month" | "quarter" | "year";
type StatsData = {
  totalRevenue: number;
  revenueChange: number;
  totalKm: number;
  kmChange: number;
  avgPerDelivery: number;
  avgChange: string;
  totalHours: number;
  hoursChange: number;
  chartData: number[];
  sourcesData: {
    ubereats: number;
    deliveroo: number;
    stuart: number;
  };
  topZones: Array<{
    id: number;
    name: string;
    deliveries: number;
    percentage: number;
  }>;
};

export default function Stats() {
  const { user, isAuthenticated } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("month");
  const [statsData, setStatsData] = useState<StatsData>({
    totalRevenue: 2450,
    revenueChange: 12,
    totalKm: 850,
    kmChange: 2,
    avgPerDelivery: 8.5,
    avgChange: "Stable",
    totalHours: 124,
    hoursChange: 8,
    chartData: [120, 80, 140, 60, 90, 20],
    sourcesData: {
      ubereats: 45,
      deliveroo: 30,
      stuart: 25,
    },
    topZones: [
      { id: 1, name: "Paris Centre", deliveries: 142, percentage: 85 },
      { id: 2, name: "La Défense", deliveries: 98, percentage: 65 },
      { id: 3, name: "Montmartre", deliveries: 65, percentage: 45 },
    ],
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatsData();
  }, [selectedPeriod]);

  const loadStatsData = async () => {
    // Simuler un chargement
    setIsLoading(true);
    setTimeout(() => {
      // Ici vous chargeriez les données depuis la base de données
      setIsLoading(false);
    }, 500);
  };

  const formatCurrency = (value: number) => {
    return `€ ${value.toFixed(2)}`;
  };

  const getPeriodLabel = (period: Period) => {
    switch (period) {
      case "month":
        return "Ce mois";
      case "quarter":
        return "3 mois";
      case "year":
        return "Année";
    }
  };

  const getDateRange = (period: Period) => {
    const now = new Date();
    switch (period) {
      case "month":
        return `1 ${now.toLocaleString("fr-FR", { month: "short" })} - ${now.getDate()} ${now.toLocaleString("fr-FR", { month: "short" })}`;
      case "quarter":
        return "3 derniers mois";
      case "year":
        return "Cette année";
    }
  };

  // Générer le chemin du graphique
  const generateChartPath = () => {
    const points = statsData.chartData;
    const step = CHART_WIDTH / (points.length - 1);
    const maxValue = Math.max(...points);
    const minValue = Math.min(...points);
    const range = maxValue - minValue || 1;

    let path = "";
    points.forEach((value, index) => {
      const x = index * step;
      const y = CHART_HEIGHT - ((value - minValue) / range) * (CHART_HEIGHT - 40) - 20;
      
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevX = (index - 1) * step;
        const prevY = CHART_HEIGHT - ((points[index - 1] - minValue) / range) * (CHART_HEIGHT - 40) - 20;
        
        // Courbe lissée
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
    const lastPoint = statsData.chartData.length - 1;
    const step = CHART_WIDTH / (statsData.chartData.length - 1);
    const lastX = lastPoint * step;
    
    return `${linePath} L ${lastX} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;
  };

  return (
    <View style={commonStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} style={statsStyles.header}>
        <Text style={statsStyles.headerTitle}>Statistiques</Text>
        <TouchableOpacity style={statsStyles.headerButton}>
          <MaterialIcons name="settings" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </BlurView>

      <ScrollView
        style={statsStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={statsStyles.scrollContent}
      >
        {/* Sélecteur de période */}
        <View style={statsStyles.periodContainer}>
          <View style={statsStyles.periodSelector}>
            {(["month", "quarter", "year"] as Period[]).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  statsStyles.periodOption,
                  selectedPeriod === period && statsStyles.periodOptionActive,
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text
                  style={[
                    statsStyles.periodText,
                    selectedPeriod === period && statsStyles.periodTextActive,
                  ]}
                >
                  {getPeriodLabel(period)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Évolution des revenus */}
        <View style={statsStyles.revenueSection}>
          <View>
            <Text style={statsStyles.revenueTitle}>Évolution Revenus Nets</Text>
            <View style={statsStyles.revenueHeader}>
              <Text style={statsStyles.revenueAmount}>
                {formatCurrency(statsData.totalRevenue)}
              </Text>
              <View style={statsStyles.revenueBadge}>
                <MaterialIcons name="trending-up" size={16} color={COLORS.primary} />
                <Text style={statsStyles.revenueBadgeText}>
                  +{statsData.revenueChange}%
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
                  <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0" />
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

              {/* Aire du graphique */}
              <Path
                d={generateAreaPath()}
                fill="url(#chartGradient)"
              />

              {/* Ligne du graphique */}
              <Path
                d={generateChartPath()}
                fill="none"
                stroke={COLORS.primary}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Point actif */}
              <Circle
                cx={CHART_WIDTH * 0.8}
                cy={CHART_HEIGHT * 0.45}
                r="6"
                fill={COLORS.primary}
              />
              <Circle
                cx={CHART_WIDTH * 0.8}
                cy={CHART_HEIGHT * 0.45}
                r="3"
                fill={COLORS.white}
              />
            </Svg>

            {/* Labels de l'axe X */}
            <View style={statsStyles.chartLabels}>
              {["S1", "S2", "S3", "S4"].map((label, index) => (
                <Text key={index} style={statsStyles.chartLabel}>
                  {label}
                </Text>
              ))}
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
            <Text style={statsStyles.kpiValue}>{formatCurrency(statsData.totalRevenue)}</Text>
            <Text style={statsStyles.kpiChange}>+5% vs sem. dern.</Text>
          </View>

          {/* Kilométrage */}
          <View style={statsStyles.kpiCard}>
            <View style={[statsStyles.kpiIconContainer, { backgroundColor: COLORS.primarySoft }]}>
              <MaterialIcons name="speed" size={20} color={COLORS.primary} />
            </View>
            <Text style={statsStyles.kpiLabel}>Kilométrage</Text>
            <Text style={statsStyles.kpiValue}>{statsData.totalKm} km</Text>
            <Text style={statsStyles.kpiChange}>+2% vs sem. dern.</Text>
          </View>

          {/* Moyenne par livraison */}
          <View style={statsStyles.kpiCard}>
            <View style={[statsStyles.kpiIconContainer, { backgroundColor: COLORS.warningSoft }]}>
              <MaterialIcons name="local-shipping" size={20} color={COLORS.warning} />
            </View>
            <Text style={statsStyles.kpiLabel}>Moy. / Liv.</Text>
            <Text style={statsStyles.kpiValue}>{formatCurrency(statsData.avgPerDelivery)}</Text>
            <Text style={statsStyles.kpiChange}>Stable</Text>
          </View>

          {/* Heures actives */}
          <View style={statsStyles.kpiCard}>
            <View style={[statsStyles.kpiIconContainer, { backgroundColor: COLORS.dangerSoft }]}>
              <MaterialIcons name="schedule" size={20} color={COLORS.danger} />
            </View>
            <Text style={statsStyles.kpiLabel}>Heures Act.</Text>
            <Text style={statsStyles.kpiValue}>{statsData.totalHours}h</Text>
            <Text style={statsStyles.kpiChange}>+8% vs sem. dern.</Text>
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
                  
                  {/* UberEats (45%) */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={COLORS.primary}
                    strokeWidth="12"
                    strokeDasharray={`${(statsData.sourcesData.ubereats / 100) * 251} 251`}
                    strokeDashoffset="0"
                  />
                  
                  {/* Deliveroo (30%) */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#00CCBC"
                    strokeWidth="12"
                    strokeDasharray={`${(statsData.sourcesData.deliveroo / 100) * 251} 251`}
                    strokeDashoffset={-((statsData.sourcesData.ubereats / 100) * 251)}
                  />
                  
                  {/* Stuart (25%) */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#2D6DF6"
                    strokeWidth="12"
                    strokeDasharray={`${(statsData.sourcesData.stuart / 100) * 251} 251`}
                    strokeDashoffset={-((statsData.sourcesData.ubereats + statsData.sourcesData.deliveroo) / 100 * 251)}
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
                <View style={[statsStyles.legendColor, { backgroundColor: COLORS.primary }]} />
                <Text style={statsStyles.legendLabel}>UberEats</Text>
                <Text style={statsStyles.legendValue}>{statsData.sourcesData.ubereats}%</Text>
              </View>
              
              <View style={statsStyles.legendItem}>
                <View style={[statsStyles.legendColor, { backgroundColor: "#00CCBC" }]} />
                <Text style={statsStyles.legendLabel}>Deliveroo</Text>
                <Text style={statsStyles.legendValue}>{statsData.sourcesData.deliveroo}%</Text>
              </View>
              
              <View style={statsStyles.legendItem}>
                <View style={[statsStyles.legendColor, { backgroundColor: "#2D6DF6" }]} />
                <Text style={statsStyles.legendLabel}>Stuart</Text>
                <Text style={statsStyles.legendValue}>{statsData.sourcesData.stuart}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Zones Top */}
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
                  <Text style={statsStyles.zoneDeliveries}>{zone.deliveries}</Text>
                </View>
                
                <View style={statsStyles.progressBar}>
                  <View
                    style={[
                      statsStyles.progressFill,
                      { width: `${zone.percentage}%` },
                    ]}
                  />
                </View>
                
                <Text style={statsStyles.zoneDeliveriesLabel}>livraisons</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}