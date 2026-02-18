import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Modal,
} from "react-native";
import { useEffect, useState } from "react";
import { db } from "../src/database/db";
import { COLORS } from "../styles/colors";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { useModal } from "../providers/ModalProvider";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isToday,
  isThisWeek,
  isThisMonth,
} from "date-fns";
import { fr } from "date-fns/locale";

type Delivery = {
  id: number;
  merchant_id: number;
  delivery_fee: number;
  parcel_value: number;
  payment_type: string;
  created_at: string;
  delivered_at?: string;
  recipient_name: string;
  address: string;
  phone?: string;
  status: string;
  reversed?: number;
};

type Merchant = {
  id: number;
  name: string;
  phone?: string;
  address?: string;
};

type MerchantSummary = {
  merchant_id: number;
  merchant_name: string;
  merchant_phone?: string;
  merchant_address?: string;
  totalDeliveries: number;
  totalEncaisse: number;
  totalAReverser: number;
  totalProfit: number;
  isClosed: boolean;
  deliveries: Delivery[];
};

type PeriodType = "today" | "week" | "month" | "custom";
type TabType = "EN_COURS" | "AUJOURDHUI" | "CLOTUREES";

export default function MerchantAccounting() {
  const [summaries, setSummaries] = useState<MerchantSummary[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<MerchantSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("EN_COURS");
  const { showConfirm, showSuccess, showError } = useModal();
  
  // États pour les filtres
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [activePeriod, setActivePeriod] = useState<PeriodType>("today");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [deliveryDates, setDeliveryDates] = useState<Date[]>([]);
  
  // États pour les cards pliables
  const [expandedCards, setExpandedCards] = useState<number[]>([]);

  const loadAccounting = async () => {
    try {
      // Récupérer toutes les livraisons livrées
      let query = "SELECT * FROM deliveries WHERE status = 'LIVREE'";
      let params: any[] = [];

      // Appliquer les filtres de date si activés
      if (dateFilterEnabled && selectedDate) {
        switch (activePeriod) {
          case "today":
            const todayStr = selectedDate.toISOString().split("T")[0];
            query += " AND date(delivered_at) = ?";
            params = [todayStr];
            break;

          case "week":
            const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
            const weekStartStr = weekStart.toISOString().split("T")[0];
            const weekEndStr = weekEnd.toISOString().split("T")[0];
            query += " AND date(delivered_at) BETWEEN ? AND ?";
            params = [weekStartStr, weekEndStr];
            break;

          case "month":
            const monthStart = startOfMonth(selectedDate);
            const monthEnd = endOfMonth(selectedDate);
            const monthStartStr = monthStart.toISOString().split("T")[0];
            const monthEndStr = monthEnd.toISOString().split("T")[0];
            query += " AND date(delivered_at) BETWEEN ? AND ?";
            params = [monthStartStr, monthEndStr];
            break;

          case "custom":
            if (selectedEndDate) {
              const customStartStr = selectedDate.toISOString().split("T")[0];
              const customEndStr = selectedEndDate.toISOString().split("T")[0];
              query += " AND date(delivered_at) BETWEEN ? AND ?";
              params = [customStartStr, customEndStr];
            } else {
              const customStr = selectedDate.toISOString().split("T")[0];
              query += " AND date(delivered_at) = ?";
              params = [customStr];
            }
            break;
        }
      }

      query += " ORDER BY delivered_at DESC";

      const deliveries = await db.getAllAsync<Delivery>(query, params);

      // Récupérer tous les commerçants
      const merchants = await db.getAllAsync<Merchant>(
        "SELECT * FROM merchants ORDER BY name ASC"
      );

      const merchantMap: Record<number, MerchantSummary> = {};

      // Initialiser la map avec tous les commerçants
      merchants.forEach((merchant) => {
        merchantMap[merchant.id] = {
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          merchant_phone: merchant.phone,
          merchant_address: merchant.address,
          totalDeliveries: 0,
          totalEncaisse: 0,
          totalAReverser: 0,
          totalProfit: 0,
          isClosed: true,
          deliveries: [],
        };
      });

      // Agréger les données des livraisons
      deliveries.forEach((delivery) => {
        const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";
        const montantEncaisse =
          delivery.delivery_fee + (isClientPaysTout ? delivery.parcel_value : 0);
        const montantAReverser = isClientPaysTout ? delivery.parcel_value : 0;
        const profit = delivery.delivery_fee;

        if (merchantMap[delivery.merchant_id]) {
          merchantMap[delivery.merchant_id].totalDeliveries += 1;
          merchantMap[delivery.merchant_id].totalEncaisse += montantEncaisse;
          merchantMap[delivery.merchant_id].totalAReverser += montantAReverser;
          merchantMap[delivery.merchant_id].totalProfit += profit;
          merchantMap[delivery.merchant_id].deliveries.push(delivery);
          
          // Vérifier si au moins une livraison n'est pas reversée
          if (delivery.reversed !== 1) {
            merchantMap[delivery.merchant_id].isClosed = false;
          }
        }
      });

      // Ne garder que les commerçants qui ont des livraisons
      let summariesArray = Object.values(merchantMap).filter(
        (summary) => summary.totalDeliveries > 0
      );

      // Filtrer par onglet
      summariesArray = summariesArray.filter((summary) => {
        switch (activeTab) {
          case "EN_COURS":
            return !summary.isClosed;
          case "CLOTUREES":
            return summary.isClosed;
          case "AUJOURDHUI":
            return summary.deliveries.some((delivery) => 
              isToday(new Date(delivery.delivered_at || delivery.created_at))
            );
          default:
            return true;
        }
      });

      setSummaries(summariesArray);
      setFilteredSummaries(summariesArray);
    } catch (error) {
      console.error("Erreur lors du chargement de la comptabilité:", error);
      showError("Erreur", "Impossible de charger les données");
    }
  };

  // Charger les dates des livraisons pour le calendrier
  const loadDeliveryDates = async () => {
    try {
      const result = await db.getAllAsync<{ delivered_at: string }>(
        "SELECT DISTINCT date(delivered_at) as delivered_at FROM deliveries WHERE status = 'LIVREE' ORDER BY delivered_at DESC",
      );

      const dates = result.map((item) => new Date(item.delivered_at));
      setDeliveryDates(dates);
    } catch (error) {
      console.error("Erreur lors du chargement des dates de livraison:", error);
    }
  };

  useEffect(() => {
    loadAccounting();
    loadDeliveryDates();
  }, []);

  // Recharger quand les filtres changent
  useEffect(() => {
    loadAccounting();
  }, [dateFilterEnabled, selectedDate, selectedEndDate, activePeriod, activeTab]);

  // Filtrer les commerçants par recherche
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = summaries.filter((summary) =>
        summary.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        summary.merchant_phone?.includes(searchQuery) ||
        summary.merchant_address?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSummaries(filtered);
    } else {
      setFilteredSummaries(summaries);
    }
  }, [searchQuery, summaries]);

  const toggleCard = (merchantId: number) => {
    setExpandedCards((prev) =>
      prev.includes(merchantId)
        ? prev.filter((id) => id !== merchantId)
        : [...prev, merchantId]
    );
  };

  const handleCloseMerchant = (merchantId: number, merchantName: string) => {
    showConfirm(
      "Clôturer le commerçant",
      `Voulez-vous marquer toutes les livraisons de ${merchantName} comme reversées ?`,
      async () => {
        try {
          await db.runAsync(
            "UPDATE deliveries SET reversed = 1 WHERE merchant_id = ? AND status = 'LIVREE'",
            [merchantId]
          );

          showSuccess("Succès", `Comptabilité de ${merchantName} clôturée`);
          loadAccounting();
        } catch (error) {
          console.error("Erreur lors de la clôture:", error);
          showError("Erreur", "Impossible de clôturer la comptabilité");
        }
      },
      "Oui, clôturer",
      "Annuler"
    );
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
          return `${format(selectedDate!, "dd/MM/yyyy")} - ${format(selectedEndDate, "dd/MM/yyyy")}`;
        } else {
          return format(selectedDate!, "dd MMMM yyyy", { locale: fr });
        }

      default:
        return format(selectedDate!, "dd/MM/yyyy");
    }
  };

  const clearDateFilter = () => {
    setSelectedDate(new Date());
    setSelectedEndDate(null);
    setActivePeriod("today");
    setDateFilterEnabled(false);
    setCalendarDate(new Date());
    setShowFilterModal(false);
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

  const hasDeliveriesOnDate = (date: Date) => {
    return deliveryDates.some((deliveryDate) => isSameDay(deliveryDate, date));
  };

  const generateCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const days = [];

    for (let i = 0; i < startDay; i++) {
      const date = new Date(year, month, -i);
      days.push(
        <View key={`prev-${i}`} style={styles.calendarDayInactive}>
          <Text style={styles.calendarDayTextInactive}>{date.getDate()}</Text>
        </View>,
      );
    }

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
            hasDeliveries && styles.calendarDayHasDeliveries,
          ]}
          onPress={() => {
            setSelectedDate(date);
            setSelectedEndDate(null);
            setActivePeriod("custom");
          }}
        >
          <Text
            style={[
              styles.calendarDayText,
              isToday && styles.calendarDayTextToday,
              isSelected && styles.calendarDayTextSelected,
            ]}
          >
            {i}
          </Text>
          {hasDeliveries && <View style={styles.deliveryIndicator} />}
        </TouchableOpacity>,
      );
    }

    const totalCells = 42;
    const remainingCells = totalCells - days.length;

    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <View key={`next-${i}`} style={styles.calendarDayInactive}>
          <Text style={styles.calendarDayTextInactive}>{i}</Text>
        </View>,
      );
    }

    return days;
  };

  // Calcul des totaux pour l'onglet actif
  const totalGlobalEncaisse = filteredSummaries.reduce(
    (sum, summary) => sum + summary.totalEncaisse,
    0
  );
  const totalGlobalAReverser = filteredSummaries.reduce(
    (sum, summary) => sum + summary.totalAReverser,
    0
  );
  const totalGlobalProfit = filteredSummaries.reduce(
    (sum, summary) => sum + summary.totalProfit,
    0
  );
  const totalGlobalDeliveries = filteredSummaries.reduce(
    (sum, summary) => sum + summary.totalDeliveries,
    0
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} tint="dark" style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Comptabilité Commerçants</Text>
          <View style={{ width: 40 }} />
        </View>
      </BlurView>

      {/* Barre de recherche et filtre */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons
            name="search"
            size={20}
            color={COLORS.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un commerçant..."
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            dateFilterEnabled && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilterModal(true)}
        >
          <MaterialIcons
            name="filter-list"
            size={20}
            color={dateFilterEnabled ? COLORS.primary : COLORS.muted}
          />
          {dateFilterEnabled && <View style={styles.filterIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Indicateur de filtre actif */}
      {dateFilterEnabled && (
        <View style={styles.dateFilterContainer}>
          <View style={styles.dateFilterContent}>
            <MaterialIcons
              name="calendar-today"
              size={16}
              color={COLORS.primary}
            />
            <Text style={styles.dateFilterText}>
              {formatDateForDisplay()}
            </Text>
            <TouchableOpacity onPress={clearDateFilter}>
              <MaterialIcons name="close" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Onglets */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
        >
          {(["EN_COURS", "AUJOURDHUI", "CLOTUREES"] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
              >
                {tab === "EN_COURS" && "En cours"}
                {tab === "AUJOURDHUI" && "Aujourd'hui"}
                {tab === "CLOTUREES" && "Clôturées"}
              </Text>
              <View
                style={[
                  styles.tabIndicator,
                  activeTab === tab && styles.activeTabIndicator,
                ]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Résumé global */}
      <View style={styles.globalSummary}>
        <View style={styles.globalCard}>
          <Text style={styles.globalLabel}>Livraisons</Text>
          <Text style={styles.globalValue}>{totalGlobalDeliveries}</Text>
        </View>
        <View style={styles.globalCard}>
          <Text style={styles.globalLabel}>Encaissé</Text>
          <Text style={styles.globalValue}>
            {totalGlobalEncaisse.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
        <View style={styles.globalCard}>
          <Text style={styles.globalLabel}>À reverser</Text>
          <Text style={[styles.globalValue, { color: COLORS.warning }]}>
            {totalGlobalAReverser.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
        <View style={styles.globalCard}>
          <Text style={styles.globalLabel}>Profit</Text>
          <Text style={[styles.globalValue, { color: COLORS.success }]}>
            {totalGlobalProfit.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredSummaries.length > 0 ? (
          filteredSummaries.map((summary) => {
            const isExpanded = expandedCards.includes(summary.merchant_id);
            
            return (
              <View 
                key={summary.merchant_id} 
                style={[
                  styles.merchantCard,
                  summary.isClosed && styles.merchantCardClosed
                ]}
              >
                {/* En-tête du commerçant - Toujours visible */}
                <TouchableOpacity 
                  style={styles.merchantHeader}
                  onPress={() => toggleCard(summary.merchant_id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.merchantAvatar}>
                    <Text style={styles.merchantInitial}>
                      {summary.merchant_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.merchantInfo}>
                    <View style={styles.merchantNameContainer}>
                      <Text style={styles.merchantName}>
                        {summary.merchant_name}
                      </Text>
                      {summary.isClosed && (
                        <View style={styles.closedBadge}>
                          <MaterialIcons name="check-circle" size={14} color={COLORS.success} />
                          <Text style={styles.closedBadgeText}>Clôturé</Text>
                        </View>
                      )}
                    </View>
                    {summary.merchant_phone && (
                      <View style={styles.merchantContact}>
                        <MaterialIcons name="phone" size={12} color={COLORS.muted} />
                        <Text style={styles.merchantContactText}>
                          {summary.merchant_phone}
                        </Text>
                      </View>
                    )}
                    {summary.merchant_address && (
                      <View style={styles.merchantContact}>
                        <MaterialIcons name="location-on" size={12} color={COLORS.muted} />
                        <Text style={styles.merchantContactText} numberOfLines={1}>
                          {summary.merchant_address}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.deliveryCount}>
                    <Text style={styles.deliveryCountNumber}>
                      {summary.totalDeliveries}
                    </Text>
                    <Text style={styles.deliveryCountLabel}>
                      livraison{summary.totalDeliveries > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <MaterialIcons 
                    name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                    size={24} 
                    color={COLORS.muted} 
                  />
                </TouchableOpacity>

                {/* Contenu pliable - Visible seulement si déplié */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Détails financiers */}
                    <View style={styles.financialSection}>
                      <View style={styles.financialRow}>
                        <Text style={styles.financialLabel}>Total encaissé</Text>
                        <Text style={styles.financialValue}>
                          {summary.totalEncaisse.toLocaleString("fr-FR")} FCFA
                        </Text>
                      </View>

                      <View style={styles.financialRow}>
                        <Text style={[styles.financialLabel, { color: COLORS.warning }]}>
                          À reverser
                        </Text>
                        <Text style={[styles.financialValue, { color: COLORS.warning }]}>
                          {summary.totalAReverser.toLocaleString("fr-FR")} FCFA
                        </Text>
                      </View>

                      <View style={styles.financialRow}>
                        <Text style={[styles.financialLabel, { color: COLORS.success }]}>
                          Profit réalisé
                        </Text>
                        <Text style={[styles.financialValue, { color: COLORS.success }]}>
                          {summary.totalProfit.toLocaleString("fr-FR")} FCFA
                        </Text>
                      </View>
                    </View>

                    {/* Aperçu des dernières livraisons */}
                    {summary.deliveries.length > 0 && (
                      <View style={styles.recentDeliveries}>
                        <Text style={styles.recentDeliveriesTitle}>
                          Dernières livraisons
                        </Text>
                        {summary.deliveries.slice(0, 3).map((delivery) => (
                          <TouchableOpacity
                            key={delivery.id}
                            style={styles.deliveryPreview}
                            onPress={() => router.push(`/delivery/${delivery.id}`)}
                          >
                            <View style={styles.deliveryPreviewHeader}>
                              <Text style={styles.deliveryPreviewName}>
                                {delivery.recipient_name}
                              </Text>
                              <Text style={styles.deliveryPreviewDate}>
                                {format(new Date(delivery.delivered_at || delivery.created_at), "dd/MM/yyyy")}
                              </Text>
                            </View>
                            <Text style={styles.deliveryPreviewAddress} numberOfLines={1}>
                              {delivery.address}
                            </Text>
                            <View style={styles.deliveryPreviewFooter}>
                              <Text style={styles.deliveryPreviewFee}>
                                +{delivery.delivery_fee.toLocaleString("fr-FR")} FCFA
                              </Text>
                              {delivery.reversed === 1 && (
                                <View style={styles.reversedBadge}>
                                  <MaterialIcons name="check-circle" size={12} color={COLORS.success} />
                                  <Text style={styles.reversedBadgeText}>Reversé</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                        {summary.deliveries.length > 3 && (
                          <Text style={styles.moreDeliveries}>
                            +{summary.deliveries.length - 3} autres livraisons
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Bouton de clôture - Visible seulement si non clôturé */}
                    {!summary.isClosed && (
                      <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => handleCloseMerchant(summary.merchant_id, summary.merchant_name)}
                      >
                        <MaterialIcons name="check-circle" size={18} color="#000" />
                        <Text style={styles.closeButtonText}>
                          Clôturer la comptabilité
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons
              name="store"
              size={48}
              color={COLORS.muted}
            />
            <Text style={styles.emptyStateTitle}>
              Aucune donnée disponible
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery
                ? "Aucun commerçant ne correspond à votre recherche"
                : dateFilterEnabled
                  ? `Aucune livraison pour ${formatDateForDisplay().toLowerCase()}`
                  : activeTab === "EN_COURS"
                    ? "Aucun commerçant en cours"
                    : activeTab === "AUJOURDHUI"
                      ? "Aucune livraison aujourd'hui"
                      : "Aucun commerçant clôturé"}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal de filtre */}
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
                <MaterialIcons name="close" size={24} color={COLORS.muted} />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Filtres</Text>

              <TouchableOpacity
                onPress={clearDateFilter}
                style={styles.modalResetButton}
              >
                <Text style={styles.modalResetText}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Période</Text>

                <View style={styles.periodButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      activePeriod === "today" && styles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("today")}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        activePeriod === "today" && styles.periodButtonTextActive,
                      ]}
                    >
                      Aujourd'hui
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      activePeriod === "week" && styles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("week")}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        activePeriod === "week" && styles.periodButtonTextActive,
                      ]}
                    >
                      Cette semaine
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      activePeriod === "month" && styles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("month")}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        activePeriod === "month" && styles.periodButtonTextActive,
                      ]}
                    >
                      Ce mois
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.periodButton,
                      styles.periodButtonCustom,
                      activePeriod === "custom" && styles.periodButtonCustomActive,
                    ]}
                    onPress={() => selectPeriod("custom")}
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text style={styles.periodButtonCustomText}>
                      Personnalisé
                    </Text>
                  </TouchableOpacity>
                </View>

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
                        <MaterialIcons
                          name="chevron-left"
                          size={20}
                          color={COLORS.muted}
                        />
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
                        <MaterialIcons
                          name="chevron-right"
                          size={20}
                          color={COLORS.muted}
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.weekDaysContainer}>
                      {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                        <Text key={index} style={styles.weekDayText}>
                          {day}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.datesContainer}>
                      {generateCalendarDays()}
                    </View>

                    {selectedDate && (
                      <View style={styles.selectedDateInfo}>
                        <Text style={styles.selectedDateText}>
                          Date sélectionnée :{" "}
                          {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
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
                <Text style={styles.applyButtonText}>
                  Appliquer les filtres
                </Text>
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
    backgroundColor: COLORS.background,
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
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
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: COLORS.white,
    fontSize: 16,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    position: "relative",
  },
  filterButtonActive: {
    borderColor: COLORS.primary,
  },
  filterIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  dateFilterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  dateFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#13ec1330",
  },
  dateFilterText: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
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
    color: COLORS.muted,
    marginBottom: 6,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  tabIndicator: {
    height: 3,
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: 1.5,
  },
  activeTabIndicator: {
    backgroundColor: COLORS.primary,
  },
  globalSummary: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  globalCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  globalLabel: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 2,
  },
  globalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  merchantCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: "hidden",
  },
  merchantCardClosed: {
    borderColor: COLORS.success + "30",
    opacity: 0.8,
  },
  merchantHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  merchantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  merchantInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
  },
  closedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.success + "20",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  closedBadgeText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: "600",
  },
  merchantContact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  merchantContactText: {
    fontSize: 12,
    color: COLORS.muted,
    flex: 1,
  },
  deliveryCount: {
    alignItems: "flex-end",
    marginRight: 8,
  },
  deliveryCountNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  deliveryCountLabel: {
    fontSize: 10,
    color: COLORS.muted,
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  financialSection: {
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  financialLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },
  financialValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.white,
  },
  recentDeliveries: {
    marginBottom: 16,
  },
  recentDeliveriesTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  deliveryPreview: {
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  deliveryPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  deliveryPreviewName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
  },
  deliveryPreviewDate: {
    fontSize: 11,
    color: COLORS.muted,
  },
  deliveryPreviewAddress: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 4,
  },
  deliveryPreviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deliveryPreviewFee: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  reversedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reversedBadgeText: {
    fontSize: 11,
    color: COLORS.success,
  },
  moreDeliveries: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#000",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.card,
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
    color: COLORS.white,
    textAlign: "center",
    flex: 1,
  },
  modalResetButton: {
    width: 40,
    alignItems: "flex-end",
  },
  modalResetText: {
    color: COLORS.primary,
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
    color: COLORS.white,
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
    backgroundColor: COLORS.primary,
  },
  periodButtonCustom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  periodButtonCustomActive: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
  },
  periodButtonTextActive: {
    color: COLORS.background,
    fontWeight: "bold",
  },
  periodButtonCustomText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
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
    color: COLORS.white,
  },
  weekDaysContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  weekDayText: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.muted,
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
    borderColor: COLORS.primary,
  },
  calendarDaySelected: {
    backgroundColor: COLORS.primary,
  },
  calendarDayHasDeliveries: {
    backgroundColor: COLORS.primarySoft,
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
    color: COLORS.white,
  },
  calendarDayTextToday: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  calendarDayTextSelected: {
    color: COLORS.background,
    fontWeight: "bold",
  },
  calendarDayTextInactive: {
    fontSize: 12,
    color: COLORS.muted,
  },
  deliveryIndicator: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  selectedDateInfo: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderVeryLight,
  },
  selectedDateText: {
    fontSize: 12,
    color: COLORS.primary,
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
    borderTopColor: COLORS.borderLight,
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
    color: COLORS.white,
  },
  applyButton: {
    flex: 2,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.background,
  },
});