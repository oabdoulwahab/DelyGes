import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
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

    // Revenus du jour
    const earningsResult = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(delivery_fee) as total FROM deliveries 
       WHERE status = ? AND delivered_at LIKE ?`,
      ["LIVREE", `${today}%`],
    );
    setTodayEarnings(earningsResult?.total || 0);

    // Revenus de la semaine (exemple simplifié)
    const weekResult = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(delivery_fee) as total FROM deliveries 
       WHERE status = ? AND date(delivered_at) >= date('now', '-7 days')`,
      ["LIVREE"],
    );
    setWeekEarnings(weekResult?.total || 0);

    // Revenus du mois
    const monthResult = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(delivery_fee) as total FROM deliveries 
       WHERE status = ? AND strftime('%Y-%m', delivered_at) = strftime('%Y-%m', 'now')`,
      ["LIVREE"],
    );
    setMonthEarnings(monthResult?.total || 0);

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

  useEffect(() => {
    loadStats();
  }, []);

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
      <BlurView intensity={95} tint="dark" style={dashboardStyles.header}>
        <View style={styles.headerContent}>
          <View style={styles.profileSection}>
            <View style={styles.profileImage} />
            <View>
              <Text style={dashboardStyles.greeting}>Bonjour,</Text>
              <Text style={dashboardStyles.name}>{userName}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* <TouchableOpacity
              style={[styles.availabilityButton, available && styles.available]}
              onPress={() => setAvailable(!available)}
            >
              <MaterialIcons
                name={available ? "toggle-on" : "toggle-off"}
                size={18}
                color={available ? COLORS.primary : "#ccc"}
              />
              <Text style={styles.availabilityText}>
                {available ? "Disponible" : "Indisponible"}
              </Text>
            </TouchableOpacity> */}

            <TouchableOpacity style={styles.notificationButton}>
              <MaterialIcons
                name="notifications"
                size={20}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* En-tête avec date */}
        <View style={styles.dateHeader}>
          <View>
            <Text style={styles.sectionTitle}>APERÇU DU JOUR</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push("/deliveries")}
          >
            <Text style={styles.historyText}>Voir l'historique</Text>
            <MaterialIcons
              name="chevron-right"
              size={16}
              color={COLORS.muted}
            />
          </TouchableOpacity>
        </View>

        {/* Cartes de revenus */}
        <View style={styles.statsGrid}>
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Revenus du jour</Text>
              <View style={styles.iconContainer}>
                <MaterialIcons
                  name="account-balance-wallet"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
            </View>
            <Text style={styles.mainAmount}>
              {(todayEarnings || 0).toLocaleString("fr-FR")} FCFA
            </Text>
            <View style={styles.trendContainer}>
              <View style={styles.trendBadge}>
                <MaterialIcons
                  name="trending-up"
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.trendText}>+12%</Text>
              </View>
              <Text style={styles.trendLabel}>vs hier</Text>
            </View>
          </View>

          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryLabel}>Semaine</Text>
            <Text style={styles.secondaryAmount}>
              {(weekEarnings || 0).toLocaleString("fr-FR")} FCFA
            </Text>
          </View>

          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryLabel}>Mois</Text>
            <Text style={styles.secondaryAmount}>
              {(monthEarnings || 0).toLocaleString("fr-FR")} FCFA
            </Text>
          </View>
        </View>

        {/* Objectif mensuel */}
        {/* <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalTitle}>Objectif mensuel</Text>
              <Text style={styles.goalSubtitle}>
                Continuez comme ça ! Vous y êtes presque.
              </Text>
            </View>
            <View style={styles.goalStats}>
              <Text style={styles.goalPercentage}>
                {Math.round(monthProgress)}%
              </Text>
              <Text style={styles.goalNumbers}>
                {(monthEarnings || 0).toLocaleString("fr-FR")} /{" "}
                {monthGoal.toLocaleString("fr-FR")}
              </Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${monthProgress}%` }]}
            />
          </View>
        </View> */}

        {/* Statistiques */}
        {/* <View style={styles.statsSection}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Statistiques</Text>
            <Text style={styles.deliveryCount}>
              {todayDeliveries.length} Livraison
              {todayDeliveries.length > 1 ? "s" : ""}
            </Text>
          </View> */}

          {/* Graphique simplifié */}
          {/* <View style={styles.graphPlaceholder}>
            <Text style={styles.graphText}>
              Graphique hebdomadaire à implémenter
            </Text>
          </View>
        </View> */}

        {/* Planning du jour */}
        <View style={styles.scheduleSection}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleTitle}>Planning du jour</Text>
            <TouchableOpacity style={styles.calendarButton}>
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
                  style={styles.deliveryCard}
                  onPress={() => router.push(`/delivery/${delivery.id}`)}
                >
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>
                      {new Date(delivery.created_at).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </Text>
                  </View>
                  <View style={styles.deliveryInfo}>
                    <Text style={styles.deliveryName}>
                      {delivery.recipient_name}
                    </Text>
                    <Text style={styles.deliveryAddress}>
                      {delivery.address}
                    </Text>
                  </View>
                  <View style={styles.deliveryRight}>
                    <Text style={styles.deliveryFee}>
                      {delivery.delivery_fee} FCFA
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColor.backgroundColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
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
            <Text style={styles.noDeliveries}>
              Aucune livraison planifiée aujourd'hui
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Bouton flottant */}
      <TouchableOpacity
        style={dashboardStyles.floatingButton}
        onPress={() => router.push("/add-delivery")}
      >
        <MaterialIcons name="add" size={24} color="#000" />
        <Text style={dashboardStyles.floatingButtonText}>
          Ajouter une livraison
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileSection: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  availabilityButton: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  available: {
    backgroundColor: COLORS.primarySoft,
  },
  availabilityText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  notificationButton: {
    padding: 8,
    borderRadius: 20,
  },
  content: {
    padding: 16,
    marginTop: 20,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dateText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 4,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  historyText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  mainCard: {
    backgroundColor: COLORS.card,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    width: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardLabel: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  iconContainer: {
    padding: 8,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 8,
  },
  mainAmount: {
    color: COLORS.white,
    fontSize: 36,
    fontWeight: "800",
    marginTop: 8,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(19, 236, 19, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "bold",
  },
  trendLabel: {
    color: COLORS.muted,
    fontSize: 12,
  },
  secondaryCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    flex: 1,
    minWidth: "45%",
  },
  secondaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  secondaryAmount: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
  },
  goalCard: {
    backgroundColor: COLORS.card,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: 20,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  goalTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  goalSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  goalStats: {
    alignItems: "flex-end",
  },
  goalPercentage: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
  goalNumbers: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  progressBar: {
    height: 10,
    backgroundColor: "#374151",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  statsSection: {
    marginBottom: 20,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  deliveryCount: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "500",
  },
  graphPlaceholder: {
    backgroundColor: COLORS.card,
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  graphText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  scheduleSection: {
    marginBottom: 100,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  scheduleTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  calendarButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.card,
  },
  deliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: 12,
  },
  timeContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "bold",
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
  },
  deliveryAddress: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  deliveryRight: {
    alignItems: "flex-end",
  },
  deliveryFee: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
  },
  noDeliveries: {
    color: COLORS.muted,
    textAlign: "center",
    padding: 20,
  },
});
