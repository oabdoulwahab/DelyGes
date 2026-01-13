import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { db } from "../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

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
  const [monthGoal] = useState(400000); // 4000€ en FCFA
  const [todayDeliveries, setTodayDeliveries] = useState<Delivery[]>([]);
  const [userName, setUserName] = useState("");

  const formattedDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Charger le nom de l'utilisateur
  useEffect(() => {
    const loadUser = async () => {
      const user = await db.getFirstAsync<User>("SELECT name FROM user LIMIT 1");
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
      ["LIVREE", `${today}%`]
    );
    setTodayEarnings(earningsResult?.total || 0);

    // Revenus de la semaine (exemple simplifié)
    const weekResult = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(delivery_fee) as total FROM deliveries 
       WHERE status = ? AND date(delivered_at) >= date('now', '-7 days')`,
      ["LIVREE"]
    );
    setWeekEarnings(weekResult?.total || 85000);

    // Revenus du mois
    const monthResult = await db.getFirstAsync<{ total: number }>(
      `SELECT SUM(delivery_fee) as total FROM deliveries 
       WHERE status = ? AND strftime('%Y-%m', delivered_at) = strftime('%Y-%m', 'now')`,
      ["LIVREE"]
    );
    setMonthEarnings(monthResult?.total || 320000);

    // Livraisons du jour pour le planning
    const deliveriesResult = await db.getAllAsync<Delivery>(
      `SELECT * FROM deliveries 
       WHERE (status = 'A_LIVRER' OR status = 'LIVREE') 
       AND date(created_at) = date('now')
       ORDER BY created_at LIMIT 3`
    );
    setTodayDeliveries(deliveriesResult || []);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const monthProgress = Math.min((monthEarnings / monthGoal) * 100, 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "LIVREE":
        return { backgroundColor: "#10b98120", color: "#10b981" };
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
    <View style={styles.container}>
      <BlurView intensity={95} tint="dark" style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.profileSection}>
            <View style={styles.profileImage} />
            <View>
              <Text style={styles.greeting}>Bonjour,</Text>
              <Text style={styles.name}>{userName}</Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.availabilityButton, available && styles.available]}
              onPress={() => setAvailable(!available)}
            >
              <MaterialIcons 
                name={available ? "toggle-on" : "toggle-off"} 
                size={18} 
                color={available ? "#13ec13" : "#ccc"} 
              />
              <Text style={styles.availabilityText}>
                {available ? "Disponible" : "Indisponible"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.notificationButton}>
              <MaterialIcons name="notifications" size={20} color="#94A3B8" />
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
            <MaterialIcons name="chevron-right" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Cartes de revenus */}
        <View style={styles.statsGrid}>
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Revenus du jour</Text>
              <View style={styles.iconContainer}>
                <MaterialIcons name="euro-symbol" size={20} color="#13ec13" />
              </View>
            </View>
            <Text style={styles.mainAmount}>
              {(todayEarnings || 0).toLocaleString("fr-FR")} FCFA
            </Text>
            <View style={styles.trendContainer}>
              <View style={styles.trendBadge}>
                <MaterialIcons name="trending-up" size={14} color="#13ec13" />
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
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalTitle}>Objectif mensuel</Text>
              <Text style={styles.goalSubtitle}>Continuez comme ça ! Vous y êtes presque.</Text>
            </View>
            <View style={styles.goalStats}>
              <Text style={styles.goalPercentage}>{Math.round(monthProgress)}%</Text>
              <Text style={styles.goalNumbers}>
                {(monthEarnings || 0).toLocaleString("fr-FR")} / {monthGoal.toLocaleString("fr-FR")}
              </Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${monthProgress}%` }]} />
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsSection}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Statistiques</Text>
            <Text style={styles.deliveryCount}>
              {todayDeliveries.length} Livraison{todayDeliveries.length > 1 ? "s" : ""}
            </Text>
          </View>
          
          {/* Graphique simplifié - à implémenter */}
          <View style={styles.graphPlaceholder}>
            <Text style={styles.graphText}>Graphique hebdomadaire à implémenter</Text>
          </View>
        </View>

        {/* Planning du jour */}
        <View style={styles.scheduleSection}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleTitle}>Planning du jour</Text>
            <TouchableOpacity style={styles.calendarButton}>
              <MaterialIcons name="calendar-today" size={20} color="#94A3B8" />
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
                      {new Date(delivery.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={styles.deliveryInfo}>
                    <Text style={styles.deliveryName}>{delivery.recipient_name}</Text>
                    <Text style={styles.deliveryAddress}>{delivery.address}</Text>
                  </View>
                  <View style={styles.deliveryRight}>
                    <Text style={styles.deliveryFee}>{delivery.delivery_fee} FCFA</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: statusColor.backgroundColor }
                    ]}>
                      <Text style={[styles.statusText, { color: statusColor.color }]}>
                        {statusText}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.noDeliveries}>Aucune livraison planifiée aujourd'hui</Text>
          )}
        </View>
      </ScrollView>

      {/* Bouton flottant */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => router.push("/add-delivery")}
      >
        <MaterialIcons name="add" size={24} color="#000" />
        <Text style={styles.floatingButtonText}>Ajouter une livraison</Text>
      </TouchableOpacity>

  
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#102210" },
  header: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16 },
  headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  profileSection: { flexDirection: "row", gap: 12, alignItems: "center" },
  profileImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1a2a1a" },
  greeting: { color: "#94A3B8", fontSize: 12 },
  name: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  availabilityButton: { 
    flexDirection: "row", 
    gap: 4, 
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1a2a1a",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#13ec13",
  },
  available: { backgroundColor: "rgba(19, 236, 19, 0.1)" },
  availabilityText: { 
    color: "#13ec13", 
    fontSize: 12, 
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  notificationButton: { 
    padding: 8, 
    borderRadius: 20,
  },
  content: { padding: 16, marginTop: 20 },
  dateHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-end",
    marginBottom: 20,
  },
  sectionTitle: { 
    color: "#13ec13", 
    fontSize: 12, 
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dateText: { 
    color: "#fff", 
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
    color: "#94A3B8", 
    fontSize: 12,
  },
  statsGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 12,
    marginBottom: 16,
  },
  mainCard: { 
    backgroundColor: "#1a2a1a", 
    padding: 20, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ffffff0d",
    width: "100%",
  },
  cardHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-start",
  },
  cardLabel: { 
    color: "#94A3B8", 
    fontSize: 14, 
    fontWeight: "500",
  },
  iconContainer: { 
    padding: 8, 
    backgroundColor: "rgba(19, 236, 19, 0.1)", 
    borderRadius: 8,
  },
  mainAmount: { 
    color: "#fff", 
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
    color: "#13ec13", 
    fontSize: 12, 
    fontWeight: "bold",
  },
  trendLabel: { 
    color: "#94A3B8", 
    fontSize: 12,
  },
  secondaryCard: { 
    backgroundColor: "#1a2a1a", 
    padding: 16, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff0d",
    flex: 1,
    minWidth: "45%",
  },
  secondaryLabel: { 
    color: "#94A3B8", 
    fontSize: 12, 
    fontWeight: "500",
  },
  secondaryAmount: { 
    color: "#fff", 
    fontSize: 20, 
    fontWeight: "bold",
    marginTop: 4,
  },
  goalCard: { 
    backgroundColor: "#1a2a1a", 
    padding: 20, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff0d",
    marginBottom: 20,
  },
  goalHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-end",
    marginBottom: 16,
  },
  goalTitle: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "600",
  },
  goalSubtitle: { 
    color: "#94A3B8", 
    fontSize: 12, 
    marginTop: 4,
  },
  goalStats: { 
    alignItems: "flex-end",
  },
  goalPercentage: { 
    color: "#13ec13", 
    fontSize: 14, 
    fontWeight: "bold",
  },
  goalNumbers: { 
    color: "#94A3B8", 
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
    backgroundColor: "#13ec13",
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
    color: "#fff", 
    fontSize: 18, 
    fontWeight: "bold",
  },
  deliveryCount: { 
    color: "#13ec13", 
    fontSize: 12, 
    fontWeight: "500",
  },
  graphPlaceholder: { 
    backgroundColor: "#1a2a1a", 
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff0d",
    alignItems: "center",
    justifyContent: "center",
  },
  graphText: { 
    color: "#94A3B8", 
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
    color: "#fff", 
    fontSize: 18, 
    fontWeight: "bold",
  },
  calendarButton: { 
    padding: 8, 
    borderRadius: 8,
    backgroundColor: "#1a2a1a",
  },
  deliveryCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 16,
    padding: 16,
    backgroundColor: "#1a2a1a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff0d",
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
    color: "#94A3B8", 
    fontSize: 12, 
    fontWeight: "bold",
  },
  deliveryInfo: { 
    flex: 1,
  },
  deliveryName: { 
    color: "#fff", 
    fontSize: 14, 
    fontWeight: "bold",
  },
  deliveryAddress: { 
    color: "#94A3B8", 
    fontSize: 12,
    marginTop: 2,
  },
  deliveryRight: { 
    alignItems: "flex-end",
  },
  deliveryFee: { 
    color: "#13ec13", 
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
    color: "#94A3B8", 
    textAlign: "center", 
    padding: 20,
  },
  floatingButton: {
    position: "absolute",
    bottom: 90,
    right: 16,
    flexDirection: "row",
    backgroundColor: "#13ec13",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonText: { 
    fontWeight: "bold", 
    fontSize: 14,
  },
  bottomNavContainer: { 
    position: "absolute", 
    bottom: 0, 
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#ffffff0d",
  },
  bottomNav: { 
    flexDirection: "row", 
    justifyContent: "space-around", 
    paddingVertical: 12,
  },
  navItem: { 
    alignItems: "center", 
    gap: 4,
  },
  navText: { 
    color: "#94A3B8", 
    fontSize: 10, 
    fontWeight: "500",
  },
});