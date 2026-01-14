import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  StatusBar,
  Modal,
} from "react-native";
import { useEffect, useState } from "react";
import { db } from "../src/database/db";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale';

type Delivery = {
  id: number;
  recipient_name: string;
  address: string;
  delivery_fee: number;
  status: string;
  created_at: string;
  phone?: string;
  parcel_value?: number;
  delivered_at?: string;
};

type TabType = "A_LIVRER" | "AUJOURDHUI" | "LIVREE" | "ANNULEE";

type PeriodType = "today" | "week" | "month" | "custom";

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("AUJOURDHUI");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [activePeriod, setActivePeriod] = useState<PeriodType>("today");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [deliveryDates, setDeliveryDates] = useState<Date[]>([]);
  
  // Charger les dates des livraisons pour le calendrier
  const loadDeliveryDates = async () => {
    try {
      const result = await db.getAllAsync<{created_at: string}>(
        "SELECT DISTINCT date(created_at) as created_at FROM deliveries ORDER BY created_at DESC"
      );
      
      const dates = result.map(item => new Date(item.created_at));
      setDeliveryDates(dates);
    } catch (error) {
      console.error("Erreur lors du chargement des dates de livraison:", error);
    }
  };
  
  // Charger les livraisons en fonction des filtres
  const loadDeliveries = async () => {
    let query = "";
    let params: any[] = [];
    
    // Construire la requête selon l'onglet actif
    switch (activeTab) {
      case "A_LIVRER":
        query = "SELECT * FROM deliveries WHERE status = ?";
        params = ["A_LIVRER"];
        break;
      case "AUJOURDHUI":
        const today = new Date().toISOString().split("T")[0];
        query = "SELECT * FROM deliveries WHERE date(created_at) = ?";
        params = [today];
        break;
      case "LIVREE":
        query = "SELECT * FROM deliveries WHERE status = ?";
        params = ["LIVREE"];
        break;
      case "ANNULEE":
        query = "SELECT * FROM deliveries WHERE status = ?";
        params = ["ANNULEE"];
        break;
    }
    
    // Ajouter le filtre par période si activé
    if (dateFilterEnabled && selectedDate) {
      let dateCondition = "";
      
      switch (activePeriod) {
        case "today":
          const todayStr = selectedDate.toISOString().split("T")[0];
          dateCondition = "date(created_at) = ?";
          params = [todayStr, ...params];
          break;
          
        case "week":
          const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
          const weekStartStr = weekStart.toISOString().split("T")[0];
          const weekEndStr = weekEnd.toISOString().split("T")[0];
          dateCondition = "date(created_at) BETWEEN ? AND ?";
          params = [weekStartStr, weekEndStr, ...params];
          break;
          
        case "month":
          const monthStart = startOfMonth(selectedDate);
          const monthEnd = endOfMonth(selectedDate);
          const monthStartStr = monthStart.toISOString().split("T")[0];
          const monthEndStr = monthEnd.toISOString().split("T")[0];
          dateCondition = "date(created_at) BETWEEN ? AND ?";
          params = [monthStartStr, monthEndStr, ...params];
          break;
          
        case "custom":
          if (selectedEndDate) {
            const customStartStr = selectedDate.toISOString().split("T")[0];
            const customEndStr = selectedEndDate.toISOString().split("T")[0];
            dateCondition = "date(created_at) BETWEEN ? AND ?";
            params = [customStartStr, customEndStr, ...params];
          } else {
            const customStr = selectedDate.toISOString().split("T")[0];
            dateCondition = "date(created_at) = ?";
            params = [customStr, ...params];
          }
          break;
      }
      
      if (dateCondition) {
        if (query.includes("WHERE")) {
          query = query.replace("WHERE", `WHERE ${dateCondition} AND`);
        } else {
          query += ` WHERE ${dateCondition}`;
        }
      }
    }
    
    // Ajouter la recherche si nécessaire
    if (searchQuery.trim()) {
      const searchCondition = "(recipient_name LIKE ? OR address LIKE ? OR phone LIKE ?)";
      if (query.includes("WHERE")) {
        query = query.replace("WHERE", `WHERE ${searchCondition} AND`);
      } else {
        query += ` WHERE ${searchCondition}`;
      }
      params = [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, ...params];
    }
    
    // Ajouter le tri
    if (activeTab === "LIVREE") {
      query += " ORDER BY delivered_at DESC";
    } else {
      query += " ORDER BY created_at DESC";
    }
    
    try {
      const result = await db.getAllAsync<Delivery>(query, params);
      setDeliveries(result);
      setSelectedDeliveries([]);
    } catch (error) {
      console.error("Erreur lors du chargement des livraisons:", error);
      Alert.alert("Erreur", "Impossible de charger les livraisons");
    }
  };
  
  useEffect(() => {
    loadDeliveries();
    loadDeliveryDates();
  }, [activeTab, searchQuery, dateFilterEnabled, selectedDate, selectedEndDate, activePeriod]);
  
  // Fonctions existantes inchangées...
  const toggleDeliverySelection = (id: number) => {
    const delivery = deliveries.find(d => d.id === id);
    
    if (delivery && (delivery.status === "LIVREE" || delivery.status === "ANNULEE")) {
      return;
    }
    
    setSelectedDeliveries(prev => 
      prev.includes(id) 
        ? prev.filter(deliveryId => deliveryId !== id)
        : [...prev, id]
    );
  };
  
  const markAsDelivered = async (id: number) => {
    setSelectedDeliveries(prev => prev.filter(deliveryId => deliveryId !== id));
    
    await db.runAsync(
      "UPDATE deliveries SET status = ?, delivered_at = ? WHERE id = ?",
      ["LIVREE", new Date().toISOString(), id]
    );
    
    Alert.alert("Succès", "Livraison marquée comme livrée");
    loadDeliveries();
  };
  
  const markSelectedAsPaid = async () => {
    if (selectedDeliveries.length === 0) return;
    
    const validDeliveries = deliveries.filter(d => 
      selectedDeliveries.includes(d.id) && 
      d.status !== "ANNULEE"
    );
    
    if (validDeliveries.length === 0) return;
    
    Alert.alert(
      "Marquer comme payé",
      `Marquer ${validDeliveries.length} livraison(s) comme payée(s) ?`,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Confirmer", 
          onPress: () => {
            Alert.alert("Succès", "Livraisons marquées comme payées");
            setSelectedDeliveries([]);
          }
        }
      ]
    );
  };
  
  const markAsCancelled = async (id: number) => {
    setSelectedDeliveries(prev => prev.filter(deliveryId => deliveryId !== id));
    
    Alert.alert(
      "Annuler la livraison",
      "Êtes-vous sûr de vouloir annuler cette livraison ?",
      [
        { text: "Non", style: "cancel" },
        { 
          text: "Oui, annuler", 
          style: "destructive",
          onPress: async () => {
            await db.runAsync(
              "UPDATE deliveries SET status = ? WHERE id = ?",
              ["ANNULEE", id]
            );
            Alert.alert("Succès", "Livraison annulée");
            loadDeliveries();
          }
        }
      ]
    );
  };
  
  const getStatusConfig = (status: string, isSelected?: boolean) => {
    switch (status) {
      case "LIVREE":
        return {
          backgroundColor: "#10b98110",
          borderColor: "#10b98130",
          textColor: "#10b981",
          text: "Terminée",
          icon: "check-circle"
        };
      case "A_LIVRER":
        return {
          backgroundColor: isSelected ? "#fbbf2410" : "#fbbf2400",
          borderColor: isSelected ? "#fbbf2430" : "#e5e7eb",
          textColor: "#f59e0b",
          text: "En attente",
          icon: "schedule"
        };
      case "ANNULEE":
        return {
          backgroundColor: "#ef444410",
          borderColor: "#ef444430",
          textColor: "#ef4444",
          text: "Annulée",
          icon: "cancel"
        };
      default:
        return {
          backgroundColor: "#6b728010",
          borderColor: "#6b728030",
          textColor: "#6b7280",
          text: "Prévu",
          icon: "pending"
        };
    }
  };
  
  const groupDeliveriesByTime = () => {
    const morning: Delivery[] = [];
    const afternoon: Delivery[] = [];
    const evening: Delivery[] = [];
    
    deliveries.forEach(delivery => {
      const hour = new Date(delivery.created_at).getHours();
      if (hour < 12) morning.push(delivery);
      else if (hour < 18) afternoon.push(delivery);
      else evening.push(delivery);
    });
    
    return { morning, afternoon, evening };
  };
  
  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setSelectedEndDate(null);
      setActivePeriod("custom");
      setDateFilterEnabled(true);
    }
  };
  
  const clearDateFilter = () => {
    setSelectedDate(null);
    setSelectedEndDate(null);
    setActivePeriod("today");
    setDateFilterEnabled(false);
    setCalendarDate(new Date());
  };
  
  const formatDateForDisplay = () => {
    if (!dateFilterEnabled || !selectedDate) return "Aucun filtre actif";
    
    switch (activePeriod) {
      case "today":
        return `Aujourd'hui (${format(selectedDate, "dd/MM/yyyy")})`;
        
      case "week":
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `Semaine du ${format(weekStart, "dd/MM")} au ${format(weekEnd, "dd/MM/yyyy")}`;
        
      case "month":
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        return `${format(selectedDate, "MMMM yyyy", { locale: fr })} (${format(monthStart, "dd/MM")} - ${format(monthEnd, "dd/MM")})`;
        
      case "custom":
        if (selectedEndDate) {
          return `${format(selectedDate, "dd/MM/yyyy")} - ${format(selectedEndDate, "dd/MM/yyyy")}`;
        } else {
          return format(selectedDate, "dd MMMM yyyy", { locale: fr });
        }
        
      default:
        return format(selectedDate, "dd/MM/yyyy");
    }
  };
  
  const selectPeriod = (period: PeriodType) => {
    const today = new Date();
    setActivePeriod(period);
    
    switch (period) {
      case "today":
        setSelectedDate(today);
        setSelectedEndDate(null);
        setDateFilterEnabled(true);
        setShowFilterModal(false);
        break;
        
      case "week":
        setSelectedDate(startOfWeek(today, { weekStartsOn: 1 }));
        setSelectedEndDate(endOfWeek(today, { weekStartsOn: 1 }));
        setDateFilterEnabled(true);
        setShowFilterModal(false);
        break;
        
      case "month":
        setSelectedDate(startOfMonth(today));
        setSelectedEndDate(endOfMonth(today));
        setDateFilterEnabled(true);
        setShowFilterModal(false);
        break;
        
      case "custom":
        // Pour personnalisé, on ouvre juste le calendrier dans le modal
        // L'utilisateur sélectionnera la/les dates
        setSelectedDate(today);
        setSelectedEndDate(null);
        setDateFilterEnabled(false);
        break;
    }
  };
  
  const handleApplyFilters = () => {
    if (activePeriod === "custom" && selectedDate) {
      setDateFilterEnabled(true);
    }
    setShowFilterModal(false);
  };
  
  // Vérifier si une date a des livraisons
  const hasDeliveriesOnDate = (date: Date) => {
    return deliveryDates.some(deliveryDate => 
      isSameDay(deliveryDate, date)
    );
  };
  
  // Générer les jours du calendrier
  const generateCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    
    const days = [];
    
    // Jours du mois précédent
    for (let i = 0; i < startDay; i++) {
      const date = new Date(year, month, -i);
      days.push(
        <View key={`prev-${i}`} style={styles.calendarDayInactive}>
          <Text style={styles.calendarDayTextInactive}>
            {date.getDate()}
          </Text>
        </View>
      );
    }
    
    // Jours du mois actuel
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const hasDeliveries = hasDeliveriesOnDate(date);
      const isSelected = selectedDate && isSameDay(selectedDate, date);
      const isToday = isSameDay(date, new Date());
      
      days.push(
        <TouchableOpacity
          key={`day-${i}`}
          style={[
            styles.calendarDay,
            isToday && styles.calendarDayToday,
            isSelected && styles.calendarDaySelected,
            hasDeliveries && styles.calendarDayHasDeliveries
          ]}
          onPress={() => {
            setSelectedDate(date);
            setSelectedEndDate(null);
            setActivePeriod("custom");
          }}
        >
          <Text style={[
            styles.calendarDayText,
            isToday && styles.calendarDayTextToday,
            isSelected && styles.calendarDayTextSelected
          ]}>
            {i}
          </Text>
          {hasDeliveries && <View style={styles.deliveryIndicator} />}
        </TouchableOpacity>
      );
    }
    
    // Remplir les jours restants
    const totalCells = 42;
    const remainingCells = totalCells - days.length;
    
    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <View key={`next-${i}`} style={styles.calendarDayInactive}>
          <Text style={styles.calendarDayTextInactive}>{i}</Text>
        </View>
      );
    }
    
    return days;
  };
  
  const renderDeliveryCard = (delivery: Delivery) => {
    const isSelected = selectedDeliveries.includes(delivery.id);
    const statusConfig = getStatusConfig(delivery.status, isSelected);
    const isToday = new Date(delivery.created_at).toDateString() === new Date().toDateString();
    const isCheckboxDisabled = delivery.status === "LIVREE" || delivery.status === "ANNULEE";
    
    return (
      <TouchableOpacity
        style={[
          styles.deliveryCard,
          {
            backgroundColor: statusConfig.backgroundColor,
            borderColor: statusConfig.borderColor,
            opacity: delivery.status === "ANNULEE" ? 0.6 : 1
          }
        ]}
        onPress={() => router.push(`/delivery/${delivery.id}`)}
        onLongPress={() => !isCheckboxDisabled && toggleDeliverySelection(delivery.id)}
        activeOpacity={0.7}
      >
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => !isCheckboxDisabled && toggleDeliverySelection(delivery.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={isCheckboxDisabled}
        >
          <View style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected,
            isCheckboxDisabled && styles.checkboxDisabled
          ]}>
            {isSelected && !isCheckboxDisabled && (
              <MaterialIcons name="check" size={14} color="#102210" />
            )}
            {isCheckboxDisabled && delivery.status === "LIVREE" && (
              <MaterialIcons name="check" size={14} color="#10b981" />
            )}
            {isCheckboxDisabled && delivery.status === "ANNULEE" && (
              <MaterialIcons name="close" size={14} color="#ef4444" />
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.deliveryContent}>
          <View style={styles.deliveryHeader}>
            <View style={styles.statusTimeContainer}>
              <View style={[
                styles.statusBadge,
                { backgroundColor: `${statusConfig.textColor}20` }
              ]}>
                <MaterialIcons 
                  name={statusConfig.icon as any} 
                  size={12} 
                  color={statusConfig.textColor} 
                />
                <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
                  {statusConfig.text}
                </Text>
              </View>
              
              <Text style={styles.timeText}>
                {new Date(delivery.created_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
                {isToday && " • Aujourd'hui"}
              </Text>
            </View>
            
            <Text style={styles.feeText}>
              +{delivery.delivery_fee.toLocaleString("fr-FR")} FCFA
            </Text>
          </View>
          
          <View style={styles.addressContainer}>
            <View style={styles.addressLine}>
              <View style={[styles.addressDot, { backgroundColor: "#6b7280" }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {delivery.address || "Adresse non spécifiée"}
              </Text>
            </View>
            
            <View style={styles.addressLine}>
              <View style={[styles.addressDot, { backgroundColor: "#13ec13" }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {delivery.recipient_name}
                {delivery.phone ? ` • ${delivery.phone}` : ""}
              </Text>
            </View>
          </View>
          
          {delivery.status === "A_LIVRER" && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#13ec13" }]}
                onPress={() => markAsDelivered(delivery.id)}
              >
                <MaterialIcons name="check" size={16} color="#000" />
                <Text style={styles.actionButtonText}>Marquer livrée</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#ef444410", borderColor: "#ef444430" }]}
                onPress={() => markAsCancelled(delivery.id)}
              >
                <MaterialIcons name="close" size={16} color="#ef4444" />
                <Text style={[styles.actionButtonText, { color: "#ef4444" }]}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  const { morning, afternoon, evening } = groupDeliveriesByTime();
  
  const totalSelectedAmount = deliveries
    .filter(d => selectedDeliveries.includes(d.id) && d.status !== "ANNULEE")
    .reduce((sum, d) => sum + d.delivery_fee, 0);
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#102210" />
      
      <BlurView intensity={95} tint="dark" style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Historique et Planning</Text>
          <TouchableOpacity style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Terminé</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un client..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.filterButton, dateFilterEnabled && styles.filterButtonActive]}
            onPress={() => setShowFilterModal(true)}
          >
            <MaterialIcons 
              name="filter-list" 
              size={20} 
              color={dateFilterEnabled ? "#13ec13" : "#94A3B8"} 
            />
            {dateFilterEnabled && <View style={styles.filterIndicator} />}
          </TouchableOpacity>
        </View>
        
        {dateFilterEnabled && (
          <View style={styles.dateFilterContainer}>
            <View style={styles.dateFilterContent}>
              <MaterialIcons name="calendar-today" size={16} color="#13ec13" />
              <Text style={styles.dateFilterText}>
                {formatDateForDisplay()}
              </Text>
              <TouchableOpacity onPress={clearDateFilter}>
                <MaterialIcons name="close" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
            {(["A_LIVRER", "AUJOURDHUI", "LIVREE", "ANNULEE"] as TabType[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === "A_LIVRER" && "À venir"}
                  {tab === "AUJOURDHUI" && "Aujourd'hui"}
                  {tab === "LIVREE" && "Terminées"}
                  {tab === "ANNULEE" && "Annulées"}
                </Text>
                <View style={[styles.tabIndicator, activeTab === tab && styles.activeTabIndicator]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {activeTab === "AUJOURDHUI" ? (
          <View style={styles.deliveriesList}>
            {morning.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tournées du matin</Text>
                {morning.map(delivery => (
                  <View key={delivery.id}>
                    {renderDeliveryCard(delivery)}
                  </View>
                ))}
              </View>
            )}
            
            {afternoon.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bloc après-midi</Text>
                {afternoon.map(delivery => (
                  <View key={delivery.id}>
                    {renderDeliveryCard(delivery)}
                  </View>
                ))}
              </View>
            )}
            
            {evening.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Soirée</Text>
                {evening.map(delivery => (
                  <View key={delivery.id}>
                    {renderDeliveryCard(delivery)}
                  </View>
                ))}
              </View>
            )}
            
            {deliveries.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="local-shipping" size={48} color="#94A3B8" />
                <Text style={styles.emptyStateText}>
                  {searchQuery 
                    ? "Aucune livraison trouvée" 
                    : dateFilterEnabled
                    ? `Aucune livraison pour ${formatDateForDisplay().toLowerCase()}`
                    : "Aucune livraison pour aujourd'hui"}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.deliveriesList}>
            {deliveries.map(delivery => (
              <View key={delivery.id}>
                {renderDeliveryCard(delivery)}
              </View>
            ))}
            
            {deliveries.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons 
                  name={
                    activeTab === "A_LIVRER" ? "schedule" :
                    activeTab === "LIVREE" ? "check-circle" :
                    "cancel"
                  } 
                  size={48} 
                  color="#94A3B8" 
                />
                <Text style={styles.emptyStateText}>
                  {activeTab === "A_LIVRER" && "Aucune livraison à venir"}
                  {activeTab === "LIVREE" && "Aucune livraison terminée"}
                  {activeTab === "ANNULEE" && "Aucune livraison annulée"}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      
      {selectedDeliveries.length > 0 && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionCount}>
              {selectedDeliveries.length} élément{selectedDeliveries.length > 1 ? "s" : ""} sélectionné{selectedDeliveries.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.selectionAmount}>
              +{totalSelectedAmount.toLocaleString("fr-FR")} FCFA total
            </Text>
          </View>
          
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.pdfButton}>
              <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.markPaidButton}
              onPress={markSelectedAsPaid}
            >
              <Text style={styles.markPaidButtonText}>Marquer comme payé</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* SUPPRIMER le DateTimePicker natif - on utilise notre calendrier custom */}
      
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={95} tint="dark" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => setShowFilterModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>Filtres</Text>
              
              <TouchableOpacity 
                onPress={clearDateFilter}
                style={styles.modalResetButton}
              >
                <Text style={styles.modalResetText}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Période</Text>
                
                <View style={styles.periodButtonsContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.periodButton, 
                      activePeriod === "today" && styles.periodButtonActive
                    ]}
                    onPress={() => selectPeriod("today")}
                  >
                    <Text style={[
                      styles.periodButtonText,
                      activePeriod === "today" && styles.periodButtonTextActive
                    ]}>
                      Aujourd'hui
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.periodButton,
                      activePeriod === "week" && styles.periodButtonActive
                    ]}
                    onPress={() => selectPeriod("week")}
                  >
                    <Text style={[
                      styles.periodButtonText,
                      activePeriod === "week" && styles.periodButtonTextActive
                    ]}>
                      Cette semaine
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.periodButton,
                      activePeriod === "month" && styles.periodButtonActive
                    ]}
                    onPress={() => selectPeriod("month")}
                  >
                    <Text style={[
                      styles.periodButtonText,
                      activePeriod === "month" && styles.periodButtonTextActive
                    ]}>
                      Ce mois
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.periodButton,
                      styles.periodButtonCustom,
                      activePeriod === "custom" && styles.periodButtonCustomActive
                    ]}
                    onPress={() => selectPeriod("custom")}
                  >
                    <MaterialIcons name="calendar-today" size={16} color="#13ec13" />
                    <Text style={styles.periodButtonCustomText}>Personnalisé</Text>
                  </TouchableOpacity>
                </View>

                {/* Calendrier pour sélection personnalisée */}
                {activePeriod === "custom" && (
                  <View style={styles.calendarContainer}>
                    <View style={styles.calendarHeader}>
                      <TouchableOpacity 
                        onPress={() => {
                          const prevMonth = new Date(calendarDate);
                          prevMonth.setMonth(prevMonth.getMonth() - 1);
                          setCalendarDate(prevMonth);
                        }}
                      >
                        <MaterialIcons name="chevron-left" size={20} color="#94A3B8" />
                      </TouchableOpacity>
                      
                      <Text style={styles.calendarTitle}>
                        {format(calendarDate, "MMMM yyyy", { locale: fr })}
                      </Text>
                      
                      <TouchableOpacity 
                        onPress={() => {
                          const nextMonth = new Date(calendarDate);
                          nextMonth.setMonth(nextMonth.getMonth() + 1);
                          setCalendarDate(nextMonth);
                        }}
                      >
                        <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.weekDaysContainer}>
                      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
                        <Text key={index} style={styles.weekDayText}>{day}</Text>
                      ))}
                    </View>
                    
                    <View style={styles.datesContainer}>
                      {generateCalendarDays()}
                    </View>
                    
                    {selectedDate && (
                      <View style={styles.selectedDateInfo}>
                        <Text style={styles.selectedDateText}>
                          Date sélectionnée : {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={clearDateFilter}
              >
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.applyButton}
                onPress={handleApplyFilters}
              >
                <Text style={styles.applyButtonText}>Appliquer les filtres</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#102210",
  },
  header: {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  doneButtonText: {
    color: "#13ec13",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  searchContainer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2a1a",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#2d3d2d",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: "#fff",
    fontSize: 16,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1a2a1a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2d3d2d",
    position: "relative",
  },
  filterButtonActive: {
    borderColor: "#13ec13",
  },
  filterIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#13ec13",
  },
  dateFilterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  dateFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1a2a1a",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#13ec1330",
  },
  dateFilterText: {
    flex: 1,
    color: "#13ec13",
    fontSize: 14,
    fontWeight: "500",
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff10",
    paddingBottom: 8,
  },
  tabsScroll: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 24,
    alignItems: "center",
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
    marginBottom: 6,
  },
  activeTabText: {
    color: "#13ec13",
    fontWeight: "700",
  },
  tabIndicator: {
    height: 3,
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: 1.5,
  },
  activeTabIndicator: {
    backgroundColor: "#13ec13",
  },
  deliveriesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  deliveryCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  checkboxContainer: {
    paddingRight: 12,
    paddingTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#6b7280",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#13ec13",
    borderColor: "#13ec13",
  },
  checkboxDisabled: {
    borderColor: "#6b728060",
    backgroundColor: "transparent",
  },
  deliveryContent: {
    flex: 1,
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  statusTimeContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  timeText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  feeText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#13ec13",
  },
  addressContainer: {
    gap: 8,
    marginBottom: 12,
  },
  addressLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#13ec13",
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
  },
  selectionBar: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: "#1a2a1a",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ffffff10",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  selectionInfo: {
    flex: 1,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  selectionAmount: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pdfButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#ffffff10",
    alignItems: "center",
    justifyContent: "center",
  },
  markPaidButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#13ec13",
  },
  markPaidButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a2a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    flex: 1,
  },
  modalResetButton: {
    width: 40,
    alignItems: "flex-end",
  },
  modalResetText: {
    color: "#13ec13",
    fontSize: 14,
    fontWeight: "600",
  },
  modalScrollView: {
    paddingHorizontal: 20,
    maxHeight: 500,
  },
  modalSection: {
    marginBottom: 32,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  periodButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  periodButton: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#2d3d2d",
    alignItems: "center",
    justifyContent: "center",
  },
  periodButtonActive: {
    backgroundColor: "#13ec13",
  },
  periodButtonCustom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#13ec13",
  },
  periodButtonCustomActive: {
    backgroundColor: "#13ec1310",
    borderWidth: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
  },
  periodButtonTextActive: {
    color: "#102210",
    fontWeight: "bold",
  },
  periodButtonCustomText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#13ec13",
  },
  calendarContainer: {
    backgroundColor: "#2d3d2d",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3d4d3d",
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  weekDaysContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  weekDayText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#94A3B8",
    width: 32,
    textAlign: "center",
  },
  datesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calendarDay: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
    borderRadius: 16,
    position: "relative",
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: "#13ec13",
  },
  calendarDaySelected: {
    backgroundColor: "#13ec13",
  },
  calendarDayHasDeliveries: {
    backgroundColor: "#13ec1310",
  },
  calendarDayInactive: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
  },
  calendarDayTextToday: {
    color: "#13ec13",
    fontWeight: "bold",
  },
  calendarDayTextSelected: {
    color: "#102210",
    fontWeight: "bold",
  },
  calendarDayTextInactive: {
    fontSize: 12,
    color: "#94A3B8",
  },
  deliveryIndicator: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#13ec13",
  },
  selectedDateInfo: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ffffff10",
  },
  selectedDateText: {
    fontSize: 12,
    color: "#13ec13",
    textAlign: "center",
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    paddingTop: 0,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#ffffff10",
  },
  resetButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#2d3d2d",
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  applyButton: {
    flex: 2,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#13ec13",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#13ec13",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#102210",
  },
});