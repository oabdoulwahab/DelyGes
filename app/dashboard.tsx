import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { db } from "../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { commonStyles } from "../styles/common";
import { dashboardStyles } from "../styles/dashboardStyles";
import { COLORS } from "../styles/colors";
import { useModal } from "../providers/ModalProvider";

// Définition des types
type User = {
  name: string;
  phone?: string;
  created_at: string;
};

type Delivery = {
  id: number;
  recipient_name: string;
  phone?: string;
  address: string;
  parcel_value?: number;
  delivery_fee: number;
  status: string;
  created_at: string;
  delivered_at?: string;
};

export default function Dashboard() {
  const [available, setAvailable] = useState(true);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [monthGoal, setMonthGoal] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [userName, setUserName] = useState("");
  const { showAlert } = useModal();
  const [todayEncaisse, setTodayEncaisse] = useState(0);
  const [todayAReverser, setTodayAReverser] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [pendingReversal, setPendingReversal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [trendPercent, setTrendPercent] = useState(0);

  const formattedDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Charger le nom de l'utilisateur
  useEffect(() => {
    const loadUser = async () => {
      const user = await db.getFirstAsync<User>(
        "SELECT name FROM user LIMIT 1",
      );
      if (user) setUserName(user.name || "Livreur");
    };
    loadUser();
  }, []);

  const loadStats = async () => {
    const today = new Date().toISOString().split("T")[0];

    const deliveries = await db.getAllAsync<any>(
      `SELECT * FROM deliveries 
       WHERE status = 'LIVREE' 
       AND delivered_at LIKE ?`,
      [`${today}%`],
    );

    let encaisse = 0;
    let aReverser = 0;
    let profit = 0;

    deliveries.forEach((delivery) => {
      const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";

      const montantEncaisse =
        delivery.delivery_fee + (isClientPaysTout ? delivery.parcel_value : 0);

      const montantAReverser = isClientPaysTout ? delivery.parcel_value : 0;

      encaisse += montantEncaisse;
      aReverser += montantAReverser;
      profit += delivery.delivery_fee;
    });

    setTodayEncaisse(encaisse);
    setTodayAReverser(aReverser);
    setTodayProfit(profit);
    setTodayEarnings(profit);
    setTodayCount(deliveries.length);

    // Solde total non reversé (tous jours confondus)
    const pending = await db.getAllAsync<any>(
      `SELECT * FROM deliveries 
       WHERE status = 'LIVREE' 
       AND reversed = 0`,
    );

    let pendingTotal = 0;

    pending.forEach((delivery) => {
      if (delivery.payment_type === "CLIENT_PAYE_TOUT") {
        pendingTotal += delivery.parcel_value;
      }
    });

    setPendingReversal(pendingTotal);

    // Total hier
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const yesterdayResult = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(delivery_fee) as total FROM deliveries 
      WHERE status = ? AND delivered_at LIKE ?`,
      ["LIVREE", `${yesterdayStr}%`],
    );

    const totalYesterday = yesterdayResult?.total || 0;
    const variation =
      totalYesterday === 0
        ? 0
        : Math.round(((todayEarnings - totalYesterday) / totalYesterday) * 100);

    setTrendPercent(variation);

    // Revenus de la semaine (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const weekResult = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(delivery_fee) as total 
        FROM deliveries 
        WHERE status = 'LIVREE'
        AND date(delivered_at) >= date('now', '-7 days')`,
    );
    setWeekEarnings(weekResult?.total || 0);

    // Revenus du mois (mois en cours)
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfMonthStr = firstDayOfMonth.toISOString();

    const monthResult = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(delivery_fee) as total 
      FROM deliveries 
      WHERE status = 'LIVREE'
      AND strftime('%Y-%m', delivered_at) = strftime('%Y-%m', 'now')`,
    );

    setMonthEarnings(monthResult?.total || 0);
    console.log("Week:", weekResult);
    console.log("Month:", monthResult);

    // Livraisons du jour pour le planning
    const deliveriesResult = await db.getAllAsync<Delivery>(
      `SELECT * FROM deliveries 
       WHERE (status = 'A_LIVRER' OR status = 'LIVREE') 
       AND date(created_at) = date('now')
       ORDER BY created_at LIMIT 3`,
    );

    // Objectif mensuel de l'utilisateur
    try {
      const userGoalResult = await db.getFirstAsync<{ monthly_goal: number }>(
        `SELECT monthly_goal FROM user LIMIT 1`,
      );
      if (userGoalResult && userGoalResult.monthly_goal) {
        setMonthGoal(userGoalResult.monthly_goal);
      }
    } catch (error) {
      console.log(
        "Objectif mensuel non trouvé, utilisation de la valeur par défaut",
      );
    }
    setTodayDeliveries(deliveriesResult || []);
  };

  // Charger les stats au montage + intervalle
  useEffect(() => {
    loadStats();

    // Recharger toutes les 30 secondes
    const interval = setInterval(loadStats, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Recharger quand l'écran reçoit le focus
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, []),
  );

  const monthProgress = Math.min((monthEarnings / monthGoal) * 100, 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "LIVREE":
        return { backgroundColor: COLORS.successSoft, color: COLORS.success };
      case "A_LIVRER":
        return { backgroundColor: "#3b82f620", color: "#3b82f6" };
      default:
        return { backgroundColor: "#6b728020", color: "#6b7280" };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "LIVREE":
        return "Livrée";
      case "A_LIVRER":
        return "En attente";
      default:
        return "Prévu";
    }
  };

  return (
    <View style={commonStyles.container}>
      <BlurView intensity={95} style={dashboardStyles.header}>
        <View style={dashboardStyles.headerContent}>
          <View style={dashboardStyles.profileSection}>
            <View style={dashboardStyles.profileImage} />
            <View>
              <Text style={dashboardStyles.greeting}>Bonjour,</Text>
              <Text style={dashboardStyles.name}>{userName}</Text>
            </View>
          </View>

          <View style={dashboardStyles.headerActions}>
            <TouchableOpacity style={dashboardStyles.notificationButton}>
              <MaterialIcons
                name="notifications"
                size={20}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      <ScrollView style={dashboardStyles.content} showsVerticalScrollIndicator={false}>
        {/* En-tête avec date */}
        <View style={dashboardStyles.dateHeader}>
          <View>
            <Text style={dashboardStyles.sectionTitle}>APERÇU DU JOUR</Text>
            <Text style={dashboardStyles.dateText}>{formattedDate}</Text>
          </View>
          <TouchableOpacity
            style={dashboardStyles.historyButton}
            onPress={() => router.push("/deliveries")}
          >
            <Text style={dashboardStyles.historyText}>Voir l'historique</Text>
            <MaterialIcons
              name="chevron-right"
              size={16}
              color={COLORS.muted}
            />
          </TouchableOpacity>
        </View>

        {/* Cartes de revenus */}
        <View style={dashboardStyles.statsGrid}>
          <View style={dashboardStyles.mainCard}>
            <View style={dashboardStyles.cardHeader}>
              <Text style={dashboardStyles.cardLabel}>Revenus du jour</Text>
              <View style={dashboardStyles.iconContainer}>
                <MaterialIcons
                  name="account-balance-wallet"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
            </View>
            
            <TouchableOpacity
              style={dashboardStyles.accountingButton}
              onPress={() => router.push("/merchant-accounting")}
            >
              <MaterialIcons
                name="account-balance"
                size={20}
                color="#FFFFFF"
              />
              <Text style={dashboardStyles.accountingText}>
                Comptabilité des commerçants
              </Text>
            </TouchableOpacity>
            
            <View style={dashboardStyles.financeCard}>
              <Text style={dashboardStyles.financeTitle}>Résumé Financier</Text>

              <View style={dashboardStyles.financeRow}>
                <Text style={dashboardStyles.financeLabel}>Total encaissé</Text>
                <Text style={dashboardStyles.financeValue}>
                  {todayEncaisse.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              <View style={dashboardStyles.financeRow}>
                <Text style={dashboardStyles.financeLabel}>À reverser</Text>
                <Text style={[dashboardStyles.financeValue, { color: COLORS.warning }]}>
                  {todayAReverser.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              <View style={dashboardStyles.financeRow}>
                <Text style={dashboardStyles.financeLabel}>Profit réel</Text>
                <Text style={[dashboardStyles.financeValue, { color: COLORS.success }]}>
                  {todayProfit.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              <View style={dashboardStyles.financeRow}>
                <Text style={dashboardStyles.financeLabel}>
                  En attente de reversement
                </Text>
                <Text style={[dashboardStyles.financeValue, { color: COLORS.primary }]}>
                  {pendingReversal.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              <View style={dashboardStyles.financeRow}>
                <Text style={dashboardStyles.financeLabel}>Livraisons aujourd’hui</Text>
                <Text style={dashboardStyles.financeValue}>{todayCount}</Text>
              </View>
            </View>

            <Text style={dashboardStyles.mainAmount}>
              {(todayEarnings || 0).toLocaleString("fr-FR")} FCFA
            </Text>
            
            <View style={dashboardStyles.trendContainer}>
              <View
                style={[
                  dashboardStyles.trendBadge,
                  {
                    backgroundColor:
                      trendPercent >= 0 ? dashboardStyles.trendBadgeUp.backgroundColor : dashboardStyles.trendBadgeDown.backgroundColor,
                  },
                ]}
              >
                <MaterialIcons
                  name={trendPercent >= 0 ? "trending-up" : "trending-down"}
                  size={14}
                  color={trendPercent >= 0 ? COLORS.success : COLORS.danger}
                />
                <Text
                  style={[
                    dashboardStyles.trendText,
                    {
                      color: trendPercent >= 0 ? COLORS.success : COLORS.danger,
                    },
                  ]}
                >
                  {trendPercent >= 0 ? `+${trendPercent}%` : `${trendPercent}%`}
                </Text>
              </View>
              <Text style={dashboardStyles.trendLabel}>vs hier</Text>
            </View>
          </View>

          <View style={dashboardStyles.secondaryCard}>
            <Text style={dashboardStyles.secondaryLabel}>Semaine</Text>
            <Text style={dashboardStyles.secondaryAmount}>
              {(weekEarnings || 0).toLocaleString("fr-FR")} FCFA
            </Text>
          </View>

          <View style={dashboardStyles.secondaryCard}>
            <Text style={dashboardStyles.secondaryLabel}>Mois</Text>
            <Text style={dashboardStyles.secondaryAmount}>
              {(monthEarnings || 0).toLocaleString("fr-FR")} FCFA
            </Text>
          </View>
        </View>

        {/* Planning du jour */}
        <View style={dashboardStyles.scheduleSection}>
          <View style={dashboardStyles.scheduleHeader}>
            <Text style={dashboardStyles.scheduleTitle}>Planning du jour</Text>
            <TouchableOpacity style={dashboardStyles.calendarButton}>
              <MaterialIcons
                name="calendar-today"
                size={20}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>

          {todayDeliveries.length > 0 ? (
            todayDeliveries.map((delivery) => {
              const statusColor = getStatusColor(delivery.status);
              const statusText = getStatusText(delivery.status);

              return (
                <TouchableOpacity
                  key={delivery.id}
                  style={dashboardStyles.deliveryCard}
                  onPress={() => router.push(`/delivery/${delivery.id}`)}
                >
                  <View style={dashboardStyles.timeContainer}>
                    <Text style={dashboardStyles.timeText}>
                      {new Date(delivery.created_at).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </Text>
                  </View>
                  <View style={dashboardStyles.deliveryInfo}>
                    <Text style={dashboardStyles.deliveryName}>
                      {delivery.recipient_name}
                    </Text>
                    <Text style={dashboardStyles.deliveryAddress}>
                      {delivery.address}
                    </Text>
                  </View>
                  <View style={dashboardStyles.deliveryRight}>
                    <Text style={dashboardStyles.deliveryFee}>
                      {delivery.delivery_fee} FCFA
                    </Text>
                    <View
                      style={[
                        dashboardStyles.statusBadge,
                        { backgroundColor: statusColor.backgroundColor },
                      ]}
                    >
                      <Text
                        style={[
                          dashboardStyles.statusText,
                          { color: statusColor.color },
                        ]}
                      >
                        {statusText}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={dashboardStyles.noDeliveries}>
              Aucune livraison planifiée aujourd'hui
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Bouton flottant */}
      {/* <TouchableOpacity
        style={dashboardStyles.floatingButton}
        onPress={() => router.push("/add-delivery")}
      >
        <MaterialIcons name="add" size={24} color="#FFFFFF" />
        <Text style={dashboardStyles.floatingButtonText}>
          Ajouter une livraison
        </Text>
      </TouchableOpacity> */}
    </View>
  );
}