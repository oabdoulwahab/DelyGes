import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { db } from "../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from 'expo-blur';

export default function Dashboard() {
  const [toDeliver, setToDeliver] = useState(0);
  const [deliveredToday, setDeliveredToday] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [monthGoal, setMonthGoal] = useState(4000);
  const [todayDeliveries, setTodayDeliveries] = useState(45);

  const today = new Date().toISOString().split("T")[0];
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const loadStats = async () => {
    // 📦 À livrer
    const toDeliverResult = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM deliveries WHERE status = ?",
      ["A_LIVRER"]
    );

    // ✅ Livrées aujourd'hui
    const deliveredResult = await db.getFirstAsync<{ count: number }>(
      `
      SELECT COUNT(*) as count 
      FROM deliveries 
      WHERE status = ? 
      AND delivered_at LIKE ?
      `,
      ["LIVREE", `${today}%`]
    );

    // 💰 Gains du jour
    const earningsResult = await db.getFirstAsync<{ total: number }>(
      `
      SELECT SUM(delivery_fee) as total 
      FROM deliveries 
      WHERE status = ? 
      AND delivered_at LIKE ?
      `,
      ["LIVREE", `${today}%`]
    );

    setToDeliver(toDeliverResult?.count || 0);
    setDeliveredToday(deliveredResult?.count || 0);
    setTodayEarnings(earningsResult?.total || 0);
    
    // Pour l'exemple, je mets des valeurs par défaut
    setWeekEarnings(850);
    setMonthEarnings(3200);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const weekData = [
    { day: 'L', value: 40 },
    { day: 'M', value: 65 },
    { day: 'M', value: 30 },
    { day: 'J', value: 85 },
    { day: 'V', value: 50 },
    { day: 'S', value: 90 },
    { day: 'D', value: 20 },
  ];

  const todaySchedule = [
    { time: "10:00 AM", title: "Livraison de fleurs", location: "Centre-ville · Rose & Cie", price: "15,00 €", status: "En attente", statusColor: "#60A5FA" },
    { time: "11:30 AM", title: "Livraison Traiteur", location: "Parc Tech · Événements Corp", price: "40,00 €", status: "Ramassage", statusColor: "#FB923C" },
    { time: "01:00 PM", title: "Ramassage de Colis", location: "Banlieue · Résidentiel", price: "12,50 €", status: "Prévu", statusColor: "#94A3B8" },
  ];

  const monthProgress = (monthEarnings / monthGoal) * 100;

  return (
    <View style={styles.container}>
      {/* En-tête avec effet flou */}
      <BlurView intensity={95} tint="dark" style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.profileImage} />
          <View>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.name}>Alex</Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.statusButton}>
            <MaterialIcons name="toggle-on" size={20} color="#13ec13" />
            <Text style={styles.statusText}>Disponible</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="notifications" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </BlurView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Aperçu du jour */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionSubtitle}>APERÇU DU JOUR</Text>
            <Text style={styles.sectionTitle}>{formattedDate}</Text>
          </View>
          <TouchableOpacity style={styles.historyButton}>
            <Text style={styles.historyText}>Voir l'historique</Text>
            <MaterialIcons name="chevron-right" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Cartes de revenus */}
        <View style={styles.revenueGrid}>
          {/* Carte principale des revenus du jour */}
          <View style={styles.mainCard}>
            {/* Effet de glow simplifié sans blurRadius */}
            <View style={styles.cardGlow} />
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardLabel}>Revenus du jour</Text>
                <Text style={styles.mainAmount}>
                  {todayEarnings.toLocaleString('fr-FR')}
                  <Text style={styles.currency}>,00 €</Text>
                </Text>
              </View>
              <View style={styles.iconContainer}>
                <MaterialIcons name="euro-symbol" size={24} color="#13ec13" />
              </View>
            </View>
            <View style={styles.trendContainer}>
              <View style={styles.trendBadge}>
                <MaterialIcons name="trending-up" size={14} color="#13ec13" />
                <Text style={styles.trendText}>+12%</Text>
              </View>
              <Text style={styles.trendLabel}>vs hier</Text>
            </View>
          </View>

          {/* Cartes secondaires */}
          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryLabel}>Semaine</Text>
            <Text style={styles.secondaryAmount}>{weekEarnings.toLocaleString('fr-FR')},00 €</Text>
          </View>

          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryLabel}>Mois</Text>
            <Text style={styles.secondaryAmount}>{monthEarnings.toLocaleString('fr-FR')} €</Text>
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
              <Text style={styles.goalPercent}>{Math.round(monthProgress)}%</Text>
              <Text style={styles.goalAmount}>{monthEarnings.toLocaleString('fr-FR')} / {monthGoal.toLocaleString('fr-FR')} €</Text>
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
            <Text style={styles.statsCount}>{todayDeliveries} Livraisons</Text>
          </View>
          
          <View style={styles.chartContainer}>
            <View style={styles.chartBars}>
              {weekData.map((item, index) => (
                <View key={index} style={styles.chartColumn}>
                  <View style={styles.chartBarContainer}>
                    <View style={[styles.chartBar, { height: `${item.value}%` }]} />
                  </View>
                  <Text style={styles.chartDay}>{item.day}</Text>
                </View>
              ))}
            </View>
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

          <View style={styles.scheduleList}>
            {todaySchedule.map((item, index) => (
              <TouchableOpacity key={index} style={styles.scheduleItem}>
                <View style={styles.timeContainer}>
                  <Text style={styles.timeHour}>{item.time.split(' ')[0]}</Text>
                  <Text style={styles.timePeriod}>{item.time.split(' ')[1]}</Text>
                </View>
                
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleTitleText}>{item.title}</Text>
                  <Text style={styles.scheduleLocation}>{item.location}</Text>
                </View>
                
                <View style={styles.schedulePrice}>
                  <Text style={styles.priceText}>{item.price}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${item.statusColor}20` }]}>
                    <Text style={[styles.statusTextBadge, { color: item.statusColor }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bouton flottant */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity 
          style={styles.floatingButton}
          onPress={() => router.push("/add-delivery")}
        >
          <MaterialIcons name="add" size={24} color="#000" />
          <Text style={styles.floatingButtonText}>Ajouter une livraison</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation en bas avec effet flou */}
      <BlurView intensity={95} tint="dark" style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem}>
            <MaterialIcons name="dashboard" size={24} color="#13ec13" />
            <Text style={[styles.navLabel, styles.navLabelActive]}>Tableau de bord</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navItem}>
            <MaterialIcons name="calendar-month" size={24} color="#94A3B8" />
            <Text style={styles.navLabel}>Livraisons</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navItem}>
            <MaterialIcons name="bar-chart" size={24} color="#94A3B8" />
            <Text style={styles.navLabel}>Stats</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navItem}>
            <MaterialIcons name="settings" size={24} color="#94A3B8" />
            <Text style={styles.navLabel}>Paramètres</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#102210',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(19, 236, 19, 0.1)',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a2a1a',
    borderWidth: 2,
    borderColor: 'rgba(19, 236, 19, 0.2)',
  },
  greeting: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(19, 236, 19, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(19, 236, 19, 0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#13ec13',
    textTransform: 'uppercase',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 108, // Pour laisser de l'espace pour l'en-tête fixe
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#13ec13',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  revenueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  mainCard: {
    width: '100%',
    backgroundColor: '#1a2a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(19, 236, 19, 0.1)',
    // blurRadius a été supprimé
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 4,
  },
  mainAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  currency: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '600',
  },
  iconContainer: {
    padding: 8,
    backgroundColor: 'rgba(19, 236, 19, 0.1)',
    borderRadius: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(19, 236, 19, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#13ec13',
  },
  trendLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  secondaryCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  secondaryAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  goalCard: {
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  goalStats: {
    alignItems: 'flex-end',
  },
  goalPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#13ec13',
  },
  goalAmount: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#374151',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#13ec13',
    borderRadius: 5,
  },
  statsSection: {
    marginBottom: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statsCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#13ec13',
  },
  chartContainer: {
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 128,
    gap: 8,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBarContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(19, 236, 19, 0.2)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#13ec13',
  },
  chartDay: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 4,
  },
  scheduleSection: {
    marginBottom: 100,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  calendarButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1a2a1a',
  },
  scheduleList: {
    gap: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 16,
  },
  timeContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeHour: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D1D5DB',
  },
  timePeriod: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  scheduleLocation: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  schedulePrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#13ec13',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  statusTextBadge: {
    fontSize: 10,
    fontWeight: '500',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13ec13',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#13ec13',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  floatingButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 24,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
  },
  navLabelActive: {
    color: '#13ec13',
  },
});