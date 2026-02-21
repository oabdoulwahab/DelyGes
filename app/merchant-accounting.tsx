import {
  View,
  Text,
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
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { fr } from "date-fns/locale";
import { merchantAccountingStyles } from "../styles/merchantAccountingStyles";

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
        <View key={`prev-${i}`} style={merchantAccountingStyles.calendarDayInactive}>
          <Text style={merchantAccountingStyles.calendarDayTextInactive}>{date.getDate()}</Text>
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
            merchantAccountingStyles.calendarDay,
            isToday && merchantAccountingStyles.calendarDayToday,
            isSelected && merchantAccountingStyles.calendarDaySelected,
            hasDeliveries && merchantAccountingStyles.calendarDayHasDeliveries,
          ]}
          onPress={() => {
            setSelectedDate(date);
            setSelectedEndDate(null);
            setActivePeriod("custom");
          }}
        >
          <Text
            style={[
              merchantAccountingStyles.calendarDayText,
              isToday && merchantAccountingStyles.calendarDayTextToday,
              isSelected && merchantAccountingStyles.calendarDayTextSelected,
            ]}
          >
            {i}
          </Text>
          {hasDeliveries && <View style={merchantAccountingStyles.deliveryIndicator} />}
        </TouchableOpacity>,
      );
    }

    const totalCells = 42;
    const remainingCells = totalCells - days.length;

    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <View key={`next-${i}`} style={merchantAccountingStyles.calendarDayInactive}>
          <Text style={merchantAccountingStyles.calendarDayTextInactive}>{i}</Text>
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
    <View style={merchantAccountingStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} style={merchantAccountingStyles.header}>
        <View style={merchantAccountingStyles.headerContent}>
          <TouchableOpacity
            style={merchantAccountingStyles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={merchantAccountingStyles.headerTitle}>Comptabilité Commerçants</Text>
          <View style={{ width: 40 }} />
        </View>
      </BlurView>

      {/* Barre de recherche et filtre */}
      <View style={merchantAccountingStyles.searchContainer}>
        <View style={merchantAccountingStyles.searchInputContainer}>
          <MaterialIcons
            name="search"
            size={20}
            color={COLORS.muted}
            style={merchantAccountingStyles.searchIcon}
          />
          <TextInput
            style={merchantAccountingStyles.searchInput}
            placeholder="Rechercher un commerçant..."
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <TouchableOpacity
          style={[
            merchantAccountingStyles.filterButton,
            dateFilterEnabled && merchantAccountingStyles.filterButtonActive,
          ]}
          onPress={() => setShowFilterModal(true)}
        >
          <MaterialIcons
            name="filter-list"
            size={20}
            color={dateFilterEnabled ? COLORS.primary : COLORS.muted}
          />
          {dateFilterEnabled && <View style={merchantAccountingStyles.filterIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Indicateur de filtre actif */}
      {dateFilterEnabled && (
        <View style={merchantAccountingStyles.dateFilterContainer}>
          <View style={merchantAccountingStyles.dateFilterContent}>
            <MaterialIcons
              name="calendar-today"
              size={16}
              color={COLORS.primary}
            />
            <Text style={merchantAccountingStyles.dateFilterText}>
              {formatDateForDisplay()}
            </Text>
            <TouchableOpacity onPress={clearDateFilter}>
              <MaterialIcons name="close" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Onglets */}
      <View style={merchantAccountingStyles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={merchantAccountingStyles.tabsScroll}
        >
          {(["EN_COURS", "AUJOURDHUI", "CLOTUREES"] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[merchantAccountingStyles.tab, activeTab === tab && merchantAccountingStyles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  merchantAccountingStyles.tabText,
                  activeTab === tab && merchantAccountingStyles.activeTabText,
                ]}
              >
                {tab === "EN_COURS" && "En cours"}
                {tab === "AUJOURDHUI" && "Aujourd'hui"}
                {tab === "CLOTUREES" && "Clôturées"}
              </Text>
              <View
                style={[
                  merchantAccountingStyles.tabIndicator,
                  activeTab === tab && merchantAccountingStyles.activeTabIndicator,
                ]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Résumé global */}
      <View style={merchantAccountingStyles.globalSummary}>
        <View style={merchantAccountingStyles.globalCard}>
          <Text style={merchantAccountingStyles.globalLabel}>Livraisons</Text>
          <Text style={merchantAccountingStyles.globalValue}>{totalGlobalDeliveries}</Text>
        </View>
        <View style={merchantAccountingStyles.globalCard}>
          <Text style={merchantAccountingStyles.globalLabel}>Encaissé</Text>
          <Text style={merchantAccountingStyles.globalValue}>
            {totalGlobalEncaisse.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
        <View style={merchantAccountingStyles.globalCard}>
          <Text style={merchantAccountingStyles.globalLabel}>À reverser</Text>
          <Text style={[merchantAccountingStyles.globalValue, { color: COLORS.warning }]}>
            {totalGlobalAReverser.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
        <View style={merchantAccountingStyles.globalCard}>
          <Text style={merchantAccountingStyles.globalLabel}>Profit</Text>
          <Text style={[merchantAccountingStyles.globalValue, { color: COLORS.success }]}>
            {totalGlobalProfit.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
      </View>

      <ScrollView
        style={merchantAccountingStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={merchantAccountingStyles.scrollContent}
      >
        {filteredSummaries.length > 0 ? (
          filteredSummaries.map((summary) => {
            const isExpanded = expandedCards.includes(summary.merchant_id);
            
            return (
              <View 
                key={summary.merchant_id} 
                style={[
                  merchantAccountingStyles.merchantCard,
                  summary.isClosed && merchantAccountingStyles.merchantCardClosed
                ]}
              >
                {/* En-tête du commerçant - Toujours visible */}
                <TouchableOpacity 
                  style={merchantAccountingStyles.merchantHeader}
                  onPress={() => toggleCard(summary.merchant_id)}
                  activeOpacity={0.7}
                >
                  <View style={merchantAccountingStyles.merchantAvatar}>
                    <Text style={merchantAccountingStyles.merchantInitial}>
                      {summary.merchant_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={merchantAccountingStyles.merchantInfo}>
                    <View style={merchantAccountingStyles.merchantNameContainer}>
                      <Text style={merchantAccountingStyles.merchantName}>
                        {summary.merchant_name}
                      </Text>
                      {summary.isClosed && (
                        <View style={merchantAccountingStyles.closedBadge}>
                          <MaterialIcons name="check-circle" size={14} color={COLORS.success} />
                          <Text style={merchantAccountingStyles.closedBadgeText}>Clôturé</Text>
                        </View>
                      )}
                    </View>
                    {summary.merchant_phone && (
                      <View style={merchantAccountingStyles.merchantContact}>
                        <MaterialIcons name="phone" size={12} color={COLORS.muted} />
                        <Text style={merchantAccountingStyles.merchantContactText}>
                          {summary.merchant_phone}
                        </Text>
                      </View>
                    )}
                    {summary.merchant_address && (
                      <View style={merchantAccountingStyles.merchantContact}>
                        <MaterialIcons name="location-on" size={12} color={COLORS.muted} />
                        <Text style={merchantAccountingStyles.merchantContactText} numberOfLines={1}>
                          {summary.merchant_address}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={merchantAccountingStyles.deliveryCount}>
                    <Text style={merchantAccountingStyles.deliveryCountNumber}>
                      {summary.totalDeliveries}
                    </Text>
                    <Text style={merchantAccountingStyles.deliveryCountLabel}>
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
                  <View style={merchantAccountingStyles.expandedContent}>
                    {/* Détails financiers */}
                    <View style={merchantAccountingStyles.financialSection}>
                      <View style={merchantAccountingStyles.financialRow}>
                        <Text style={merchantAccountingStyles.financialLabel}>Total encaissé</Text>
                        <Text style={merchantAccountingStyles.financialValue}>
                          {summary.totalEncaisse.toLocaleString("fr-FR")} FCFA
                        </Text>
                      </View>

                      <View style={merchantAccountingStyles.financialRow}>
                        <Text style={[merchantAccountingStyles.financialLabel, { color: COLORS.warning }]}>
                          À reverser
                        </Text>
                        <Text style={[merchantAccountingStyles.financialValue, { color: COLORS.warning }]}>
                          {summary.totalAReverser.toLocaleString("fr-FR")} FCFA
                        </Text>
                      </View>

                      <View style={merchantAccountingStyles.financialRow}>
                        <Text style={[merchantAccountingStyles.financialLabel, { color: COLORS.success }]}>
                          Profit réalisé
                        </Text>
                        <Text style={[merchantAccountingStyles.financialValue, { color: COLORS.success }]}>
                          {summary.totalProfit.toLocaleString("fr-FR")} FCFA
                        </Text>
                      </View>
                    </View>

                    {/* Aperçu des dernières livraisons */}
                    {summary.deliveries.length > 0 && (
                      <View style={merchantAccountingStyles.recentDeliveries}>
                        <Text style={merchantAccountingStyles.recentDeliveriesTitle}>
                          Dernières livraisons
                        </Text>
                        {summary.deliveries.slice(0, 3).map((delivery) => (
                          <TouchableOpacity
                            key={delivery.id}
                            style={merchantAccountingStyles.deliveryPreview}
                            onPress={() => router.push(`/delivery/${delivery.id}`)}
                          >
                            <View style={merchantAccountingStyles.deliveryPreviewHeader}>
                              <Text style={merchantAccountingStyles.deliveryPreviewName}>
                                {delivery.recipient_name}
                              </Text>
                              <Text style={merchantAccountingStyles.deliveryPreviewDate}>
                                {format(new Date(delivery.delivered_at || delivery.created_at), "dd/MM/yyyy")}
                              </Text>
                            </View>
                            <Text style={merchantAccountingStyles.deliveryPreviewAddress} numberOfLines={1}>
                              {delivery.address}
                            </Text>
                            <View style={merchantAccountingStyles.deliveryPreviewFooter}>
                              <Text style={merchantAccountingStyles.deliveryPreviewFee}>
                                +{delivery.delivery_fee.toLocaleString("fr-FR")} FCFA
                              </Text>
                              {delivery.reversed === 1 && (
                                <View style={merchantAccountingStyles.reversedBadge}>
                                  <MaterialIcons name="check-circle" size={12} color={COLORS.success} />
                                  <Text style={merchantAccountingStyles.reversedBadgeText}>Reversé</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                        {summary.deliveries.length > 3 && (
                          <Text style={merchantAccountingStyles.moreDeliveries}>
                            +{summary.deliveries.length - 3} autres livraisons
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Bouton de clôture - Visible seulement si non clôturé */}
                    {!summary.isClosed && (
                      <TouchableOpacity
                        style={merchantAccountingStyles.closeButton}
                        onPress={() => handleCloseMerchant(summary.merchant_id, summary.merchant_name)}
                      >
                        <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
                        <Text style={merchantAccountingStyles.closeButtonText}>
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
          <View style={merchantAccountingStyles.emptyState}>
            <MaterialIcons
              name="store"
              size={48}
              color={COLORS.muted}
            />
            <Text style={merchantAccountingStyles.emptyStateTitle}>
              Aucune donnée disponible
            </Text>
            <Text style={merchantAccountingStyles.emptyStateText}>
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
        <View style={merchantAccountingStyles.modalOverlay}>
          <BlurView intensity={95} style={merchantAccountingStyles.modalContent}>
            <View style={merchantAccountingStyles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={merchantAccountingStyles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={COLORS.muted} />
              </TouchableOpacity>

              <Text style={merchantAccountingStyles.modalTitle}>Filtres</Text>

              <TouchableOpacity
                onPress={clearDateFilter}
                style={merchantAccountingStyles.modalResetButton}
              >
                <Text style={merchantAccountingStyles.modalResetText}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={merchantAccountingStyles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              <View style={merchantAccountingStyles.modalSection}>
                <Text style={merchantAccountingStyles.modalSectionTitle}>Période</Text>

                <View style={merchantAccountingStyles.periodButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      merchantAccountingStyles.periodButton,
                      activePeriod === "today" && merchantAccountingStyles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("today")}
                  >
                    <Text
                      style={[
                        merchantAccountingStyles.periodButtonText,
                        activePeriod === "today" && merchantAccountingStyles.periodButtonTextActive,
                      ]}
                    >
                      Aujourd'hui
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      merchantAccountingStyles.periodButton,
                      activePeriod === "week" && merchantAccountingStyles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("week")}
                  >
                    <Text
                      style={[
                        merchantAccountingStyles.periodButtonText,
                        activePeriod === "week" && merchantAccountingStyles.periodButtonTextActive,
                      ]}
                    >
                      Cette semaine
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      merchantAccountingStyles.periodButton,
                      activePeriod === "month" && merchantAccountingStyles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("month")}
                  >
                    <Text
                      style={[
                        merchantAccountingStyles.periodButtonText,
                        activePeriod === "month" && merchantAccountingStyles.periodButtonTextActive,
                      ]}
                    >
                      Ce mois
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      merchantAccountingStyles.periodButton,
                      merchantAccountingStyles.periodButtonCustom,
                      activePeriod === "custom" && merchantAccountingStyles.periodButtonCustomActive,
                    ]}
                    onPress={() => selectPeriod("custom")}
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text style={merchantAccountingStyles.periodButtonCustomText}>
                      Personnalisé
                    </Text>
                  </TouchableOpacity>
                </View>

                {activePeriod === "custom" && (
                  <View style={merchantAccountingStyles.calendarContainer}>
                    <View style={merchantAccountingStyles.calendarHeader}>
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

                      <Text style={merchantAccountingStyles.calendarTitle}>
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

                    <View style={merchantAccountingStyles.weekDaysContainer}>
                      {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                        <Text key={index} style={merchantAccountingStyles.weekDayText}>
                          {day}
                        </Text>
                      ))}
                    </View>

                    <View style={merchantAccountingStyles.datesContainer}>
                      {generateCalendarDays()}
                    </View>

                    {selectedDate && (
                      <View style={merchantAccountingStyles.selectedDateInfo}>
                        <Text style={merchantAccountingStyles.selectedDateText}>
                          Date sélectionnée :{" "}
                          {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={merchantAccountingStyles.modalActions}>
              <TouchableOpacity
                style={merchantAccountingStyles.resetButton}
                onPress={clearDateFilter}
              >
                <Text style={merchantAccountingStyles.resetButtonText}>Réinitialiser</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={merchantAccountingStyles.applyButton}
                onPress={handleApplyFilters}
              >
                <Text style={merchantAccountingStyles.applyButtonText}>
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