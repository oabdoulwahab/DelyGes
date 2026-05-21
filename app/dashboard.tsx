import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { commonStyles } from "../styles/common";
import { dashboardStyles } from "../styles/dashboardStyles";
import { COLORS } from "../styles/colors";
import { useModal } from "../providers/ModalProvider";
import NotificationBadge from "../components/NotificationBadge";
import { sendGoalAchievedNotification } from '../src/services/notification.service';
import { useAuth } from '../src/context/AuthContext';
import { DashboardService } from '../src/services/dashboard.service';
import { Delivery } from '../src/types';

export default function Dashboard() {
  const { user } = useAuth(); // 🔥 Récupérer l'utilisateur connecté
  const [available, setAvailable] = useState(true);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [monthGoal, setMonthGoal] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(15000);
  const [dailyProgress, setDailyProgress] = useState(0);
  const [goalAchievedToday, setGoalAchievedToday] = useState(false); // 🔥 NOUVEAU
  const [lastGoalCheck, setLastGoalCheck] = useState(''); // 🔥 NOUVEAU
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [userName, setUserName] = useState("");
  const [userInitial, setUserInitial] = useState("?");
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

  useEffect(() => {
    if (user) {
      setUserName(user.name || "Livreur");
      const initial = (user.name || "?").trim().charAt(0).toUpperCase() || "?";
      setUserInitial(initial);
    }
  }, [user]);

  // Fonction pour obtenir une couleur basée sur l'initiale
  const getAvatarColor = (initial: string) => {
    const colors = [
      COLORS.primary,
      "#00CCBC",
      "#2D6DF6",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
    ];
    const index = initial.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const loadStats = async () => {
    const todayDateStr = new Date().toDateString();

    try {
      const data = await DashboardService.getDashboardData(user?.id?.toString() || '1');

      setTodayEncaisse(data.todayEncaisse);
      setTodayAReverser(data.todayAReverser);
      setTodayProfit(data.todayProfit);
      setTodayEarnings(data.todayEarnings);
      setTodayCount(data.todayCount);
      setWeekEarnings(data.weekEarnings);
      setMonthEarnings(data.monthEarnings);
      setMonthGoal(data.monthGoal);
      setDailyGoal(data.dailyGoal);
      setDailyProgress(data.dailyProgress);
      setPendingReversal(data.pendingReversal);
      setTrendPercent(data.trendPercent);
      setTodayDeliveries(data.todayDeliveries);

      const wasAchieved = data.goalAchievedToday;
      if (wasAchieved && !goalAchievedToday && lastGoalCheck !== todayDateStr) {
        setGoalAchievedToday(true);
        setLastGoalCheck(todayDateStr);
        if (user?.id) {
          await sendGoalAchievedNotification(user.id, data.todayProfit, data.dailyGoal);
        }
      }
      if (!wasAchieved) {
        setGoalAchievedToday(false);
      }
    } catch (error) {
      console.error('❌ Erreur loadStats:', error);
    }
  };

  // Charger les stats au montage + intervalle
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
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
            <View
              style={[
                dashboardStyles.profileImage,
                { backgroundColor: getAvatarColor(userInitial) },
              ]}
            >
              <Text style={dashboardStyles.profileInitial}>{userInitial}</Text>
            </View>
            <View>
              <Text style={dashboardStyles.greeting}>Bonjour,</Text>
              <Text style={dashboardStyles.name}>{userName}</Text>
            </View>
          </View>

          <View style={dashboardStyles.headerActions}>
            <NotificationBadge />
          </View>
        </View>
      </BlurView>

      <ScrollView
        style={dashboardStyles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
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

        {/* Carte Objectif du jour */}
        <View style={dashboardStyles.goalCard}>
          <View style={dashboardStyles.goalHeader}>
            <View style={dashboardStyles.goalTitleContainer}>
              <MaterialIcons name="flag" size={20} color={COLORS.primary} />
              <Text style={dashboardStyles.goalTitle}>Objectif du jour</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push("/settings")}
              style={dashboardStyles.goalSettingsButton}
            >
              <MaterialIcons name="edit" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
          
          <View style={dashboardStyles.goalAmountContainer}>
            <Text style={dashboardStyles.goalCurrentAmount}>
              {todayEarnings.toLocaleString("fr-FR")} FCFA
            </Text>
            <Text style={dashboardStyles.goalTargetAmount}>
              / {dailyGoal.toLocaleString("fr-FR")} FCFA
            </Text>
          </View>
          
          {/* Barre de progression */}
          <View style={dashboardStyles.progressBarContainer}>
            <View 
              style={[
                dashboardStyles.progressBarFill,
                { width: `${Math.min(dailyProgress, 100)}%` }
              ]} 
            />
          </View>
          
          <View style={dashboardStyles.goalFooter}>
            <Text style={dashboardStyles.goalProgressText}>
              {dailyProgress.toFixed(0)}% atteint
            </Text>
            <Text style={dashboardStyles.goalRemainingText}>
              Reste : {(dailyGoal - todayEarnings) > 0 
                ? (dailyGoal - todayEarnings).toLocaleString("fr-FR") 
                : "0"} FCFA
            </Text>
          </View>
          
          {/* Message de motivation */}
          {dailyProgress >= 100 ? (
            <View style={dashboardStyles.goalAchievedBadge}>
              <MaterialIcons name="emoji-events" size={16} color="#FFFFFF" />
              <Text style={dashboardStyles.goalAchievedText}>Objectif atteint ! 🎉</Text>
            </View>
          ) : (
            <Text style={dashboardStyles.goalMotivationText}>
              Plus que {(dailyGoal - todayEarnings).toLocaleString("fr-FR")} FCFA à gagner !
            </Text>
          )}
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
              <MaterialIcons name="account-balance" size={20} color="#FFFFFF" />
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
                <Text
                  style={[
                    dashboardStyles.financeValue,
                    { color: COLORS.warning },
                  ]}
                >
                  {todayAReverser.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              <View style={dashboardStyles.financeRow}>
                <Text style={dashboardStyles.financeLabel}>Profit réel</Text>
                <Text
                  style={[
                    dashboardStyles.financeValue,
                    { color: COLORS.success },
                  ]}
                >
                  {todayProfit.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              <View style={dashboardStyles.financeRow}>
                <Text style={dashboardStyles.financeLabel}>
                  En attente de reversement
                </Text>
                <Text
                  style={[
                    dashboardStyles.financeValue,
                    { color: COLORS.primary },
                  ]}
                >
                  {pendingReversal.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              <View style={dashboardStyles.financeRow}>
                <Text style={dashboardStyles.financeLabel}>
                  Livraisons aujourd’hui
                </Text>
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
                      trendPercent >= 0
                        ? "rgba(16, 185, 129, 0.2)"
                        : "rgba(239, 68, 68, 0.2)",
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
            <TouchableOpacity onPress={() => router.push("/deliveries")} style={dashboardStyles.calendarButton}>
              <MaterialIcons
                name="calendar-today"
                size={20}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>

          <View style={dashboardStyles.scheduleScrollContainer}>
            <ScrollView 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={dashboardStyles.scheduleScrollContent}
              nestedScrollEnabled={true}
              scrollEnabled={true}
            >
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
            </ScrollView>
          </View>
        </View>
        <View style={dashboardStyles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}