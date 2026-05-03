import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Modal,
  RefreshControl,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
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
  eachMonthOfInterval,
  subMonths,
  getYear,
  getMonth,
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

// Nouveau type pour les données regroupées par mois
type MonthlyData = {
  monthKey: string;
  monthName: string;
  year: number;
  totalEncaisse: number;
  totalAReverser: number;
  totalProfit: number;
  totalDeliveries: number;
  merchants: MerchantSummary[];
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

type PeriodType = "month" | "custom";
type ViewMode = "monthly" | "merchant";

export default function MerchantAccounting() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [filteredMonthlyData, setFilteredMonthlyData] = useState<MonthlyData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [expandedMerchants, setExpandedMerchants] = useState<number[]>([]);
  const { showConfirm, showSuccess, showError } = useModal();
  const [refreshing, setRefreshing] = useState(false);
  
  // États pour les filtres
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [activePeriod, setActivePeriod] = useState<PeriodType>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [deliveryDates, setDeliveryDates] = useState<Date[]>([]);

  // Charger les données groupées par mois
  const loadAccounting = async () => {
    try {
      let query = `
        SELECT 
          d.*,
          strftime('%Y-%m', d.delivered_at) as month_key,
          strftime('%Y', d.delivered_at) as year,
          strftime('%m', d.delivered_at) as month
        FROM deliveries d
        WHERE d.status = 'LIVREE'
      `;
      let params: any[] = [];

      // Appliquer les filtres de date si activés
      if (dateFilterEnabled && selectedDate) {
        switch (activePeriod) {
          case "month":
            const monthStart = startOfMonth(selectedDate);
            const monthEnd = endOfMonth(selectedDate);
            const monthStartStr = monthStart.toISOString().split("T")[0];
            const monthEndStr = monthEnd.toISOString().split("T")[0];
            query += " AND date(d.delivered_at) BETWEEN ? AND ?";
            params = [monthStartStr, monthEndStr];
            break;

          case "custom":
            if (selectedEndDate) {
              const customStartStr = selectedDate!.toISOString().split("T")[0];
              const customEndStr = selectedEndDate.toISOString().split("T")[0];
              query += " AND date(d.delivered_at) BETWEEN ? AND ?";
              params = [customStartStr, customEndStr];
            } else {
              const customStr = selectedDate!.toISOString().split("T")[0];
              query += " AND date(d.delivered_at) = ?";
              params = [customStr];
            }
            break;
        }
      }

      query += " ORDER BY d.delivered_at DESC";

      const deliveries = await db.getAllAsync<Delivery & { month_key: string; year: string; month: string }>(query, params);

      // Récupérer tous les commerçants
      const merchants = await db.getAllAsync<Merchant>(
        "SELECT * FROM merchants ORDER BY name ASC"
      );

      const merchantMap: Record<number, Merchant> = {};
      merchants.forEach((merchant) => {
        merchantMap[merchant.id] = merchant;
      });

      // Grouper par mois
      const monthlyGroups: Record<string, {
        monthName: string;
        year: number;
        merchants: Record<number, MerchantSummary>;
      }> = {};

      deliveries.forEach((delivery) => {
        const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";
        const montantEncaisse = delivery.delivery_fee + (isClientPaysTout ? delivery.parcel_value : 0);
        const montantAReverser = isClientPaysTout ? delivery.parcel_value : 0;
        const profit = delivery.delivery_fee;
        
        const deliveryDate = new Date(delivery.delivered_at || delivery.created_at);
        const monthKey = format(deliveryDate, "yyyy-MM");
        const monthName = format(deliveryDate, "MMMM yyyy", { locale: fr });
        const year = deliveryDate.getFullYear();

        if (!monthlyGroups[monthKey]) {
          monthlyGroups[monthKey] = {
            monthName,
            year,
            merchants: {},
          };
        }

        if (!monthlyGroups[monthKey].merchants[delivery.merchant_id]) {
          monthlyGroups[monthKey].merchants[delivery.merchant_id] = {
            merchant_id: delivery.merchant_id,
            merchant_name: merchantMap[delivery.merchant_id]?.name || "Inconnu",
            merchant_phone: merchantMap[delivery.merchant_id]?.phone,
            merchant_address: merchantMap[delivery.merchant_id]?.address,
            totalDeliveries: 0,
            totalEncaisse: 0,
            totalAReverser: 0,
            totalProfit: 0,
            isClosed: true,
            deliveries: [],
          };
        }

        const merchantData = monthlyGroups[monthKey].merchants[delivery.merchant_id];
        merchantData.totalDeliveries += 1;
        merchantData.totalEncaisse += montantEncaisse;
        merchantData.totalAReverser += montantAReverser;
        merchantData.totalProfit += profit;
        merchantData.deliveries.push(delivery);
        
        if (delivery.reversed !== 1) {
          merchantData.isClosed = false;
        }
      });

      // Convertir en tableau pour l'affichage (tri par date décroissante)
      const monthlyDataArray: MonthlyData[] = Object.entries(monthlyGroups)
        .map(([monthKey, data]) => ({
          monthKey,
          monthName: data.monthName,
          year: data.year,
          totalEncaisse: Object.values(data.merchants).reduce((sum, m) => sum + m.totalEncaisse, 0),
          totalAReverser: Object.values(data.merchants).reduce((sum, m) => sum + m.totalAReverser, 0),
          totalProfit: Object.values(data.merchants).reduce((sum, m) => sum + m.totalProfit, 0),
          totalDeliveries: Object.values(data.merchants).reduce((sum, m) => sum + m.totalDeliveries, 0),
          merchants: Object.values(data.merchants),
        }))
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey)); // Tri décroissant

      setMonthlyData(monthlyDataArray);
      setFilteredMonthlyData(monthlyDataArray);
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      showError("Erreur", "Impossible de charger les données");
    }
  };

  const loadDeliveryDates = async () => {
    try {
      const result = await db.getAllAsync<{ delivered_at: string }>(
        "SELECT DISTINCT date(delivered_at) as delivered_at FROM deliveries WHERE status = 'LIVREE' ORDER BY delivered_at DESC",
      );
      const dates = result.map((item) => new Date(item.delivered_at));
      setDeliveryDates(dates);
    } catch (error) {
      console.error("Erreur lors du chargement des dates:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAccounting();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAccounting();
    loadDeliveryDates();
  }, []);

  useEffect(() => {
    if (dateFilterEnabled && (selectedDate || selectedEndDate)) {
      loadAccounting();
    }
  }, [dateFilterEnabled, selectedDate, selectedEndDate, activePeriod]);

  // Filtrer par recherche
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = monthlyData.map(month => ({
        ...month,
        merchants: month.merchants.filter(merchant =>
          merchant.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          merchant.merchant_phone?.includes(searchQuery) ||
          merchant.merchant_address?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(month => month.merchants.length > 0);
      setFilteredMonthlyData(filtered);
    } else {
      setFilteredMonthlyData(monthlyData);
    }
  }, [searchQuery, monthlyData]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) =>
      prev.includes(monthKey)
        ? prev.filter((m) => m !== monthKey)
        : [...prev, monthKey]
    );
  };

  const toggleMerchant = (merchantId: number) => {
    setExpandedMerchants((prev) =>
      prev.includes(merchantId)
        ? prev.filter((id) => id !== merchantId)
        : [...prev, merchantId]
    );
  };

  const handleCloseMerchant = async (merchantId: number, merchantName: string, monthKey: string) => {
    showConfirm(
      "Clôturer le commerçant",
      `Voulez-vous marquer toutes les livraisons de ${merchantName} pour cette période comme reversées ?`,
      async () => {
        try {
          // Récupérer les dates du mois
          const [year, month] = monthKey.split("-");
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate = new Date(parseInt(year), parseInt(month), 0);
          const startStr = startDate.toISOString().split("T")[0];
          const endStr = endDate.toISOString().split("T")[0];

          await db.runAsync(
            `UPDATE deliveries SET reversed = 1 
             WHERE merchant_id = ? 
             AND status = 'LIVREE'
             AND date(delivered_at) BETWEEN ? AND ?`,
            [merchantId, startStr, endStr]
          );

          showSuccess("Succès", `Comptabilité de ${merchantName} clôturée pour cette période`);
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

  // Calcul des totaux globaux
  const totalGlobalEncaisse = filteredMonthlyData.reduce(
    (sum, month) => sum + month.totalEncaisse, 0
  );
  const totalGlobalAReverser = filteredMonthlyData.reduce(
    (sum, month) => sum + month.totalAReverser, 0
  );
  const totalGlobalProfit = filteredMonthlyData.reduce(
    (sum, month) => sum + month.totalProfit, 0
  );
  const totalGlobalDeliveries = filteredMonthlyData.reduce(
    (sum, month) => sum + month.totalDeliveries, 0
  );

  const formatDateForDisplay = () => {
    if (!dateFilterEnabled || !selectedDate) return "Aucun filtre actif";

    switch (activePeriod) {
      case "month":
        return format(selectedDate, "MMMM yyyy", { locale: fr });
      case "custom":
        if (selectedEndDate) {
          return `${format(selectedDate, "dd/MM/yyyy")} - ${format(selectedEndDate, "dd/MM/yyyy")}`;
        }
        return format(selectedDate, "dd MMMM yyyy", { locale: fr });
      default:
        return format(selectedDate, "dd/MM/yyyy");
    }
  };

  const clearDateFilter = () => {
    setSelectedDate(new Date());
    setSelectedEndDate(null);
    setActivePeriod("month");
    setDateFilterEnabled(false);
    setCalendarDate(new Date());
    setShowFilterModal(false);
  };

  const selectPeriod = (period: PeriodType) => {
    const today = new Date();
    setActivePeriod(period);

    switch (period) {
      case "month":
        setSelectedDate(today);
        setSelectedEndDate(null);
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
      const isTodayDate = isSameDay(date, new Date());

      days.push(
        <TouchableOpacity
          key={`day-${i}`}
          style={[
            merchantAccountingStyles.calendarDay,
            isTodayDate && merchantAccountingStyles.calendarDayToday,
            isSelected && merchantAccountingStyles.calendarDaySelected,
            hasDeliveries && !isSelected && merchantAccountingStyles.calendarDayHasDeliveries,
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
              isTodayDate && merchantAccountingStyles.calendarDayTextToday,
              isSelected && merchantAccountingStyles.calendarDayTextSelected,
            ]}
          >
            {i}
          </Text>
          {hasDeliveries && !isSelected && <View style={merchantAccountingStyles.deliveryIndicator} />}
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
          <Text style={merchantAccountingStyles.headerTitle}>Comptabilité</Text>
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
            <MaterialIcons name="calendar-today" size={16} color={COLORS.primary} />
            <Text style={merchantAccountingStyles.dateFilterText}>
              {formatDateForDisplay()}
            </Text>
            <TouchableOpacity onPress={clearDateFilter}>
              <MaterialIcons name="close" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Switch de mode d'affichage */}
      <View style={merchantAccountingStyles.modeSwitchContainer}>
        <TouchableOpacity
          style={[
            merchantAccountingStyles.modeButton,
            viewMode === "monthly" && merchantAccountingStyles.modeButtonActive,
          ]}
          onPress={() => setViewMode("monthly")}
        >
          <MaterialIcons
            name="calendar-view-month"
            size={20}
            color={viewMode === "monthly" ? COLORS.background : COLORS.muted}
          />
          <Text
            style={[
              merchantAccountingStyles.modeButtonText,
              viewMode === "monthly" && merchantAccountingStyles.modeButtonTextActive,
            ]}
          >
            Par mois
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            merchantAccountingStyles.modeButton,
            viewMode === "merchant" && merchantAccountingStyles.modeButtonActive,
          ]}
          onPress={() => setViewMode("merchant")}
        >
          <MaterialIcons
            name="store"
            size={20}
            color={viewMode === "merchant" ? COLORS.background : COLORS.muted}
          />
          <Text
            style={[
              merchantAccountingStyles.modeButtonText,
              viewMode === "merchant" && merchantAccountingStyles.modeButtonTextActive,
            ]}
          >
            Par commerçant
          </Text>
        </TouchableOpacity>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {filteredMonthlyData.length > 0 ? (
          filteredMonthlyData.map((month) => {
            const isMonthExpanded = expandedMonths.includes(month.monthKey);
            
            return (
              <View key={month.monthKey} style={merchantAccountingStyles.monthCard}>
                {/* En-tête du mois */}
                <TouchableOpacity
                  style={merchantAccountingStyles.monthHeader}
                  onPress={() => toggleMonth(month.monthKey)}
                  activeOpacity={0.7}
                >
                  <View style={merchantAccountingStyles.monthHeaderLeft}>
                    <MaterialIcons
                      name="calendar-today"
                      size={20}
                      color={COLORS.primary}
                    />
                    <Text style={merchantAccountingStyles.monthName}>
                      {month.monthName}
                    </Text>
                  </View>
                  <View style={merchantAccountingStyles.monthStats}>
                    <Text style={merchantAccountingStyles.monthTotalEncaisse}>
                      {month.totalEncaisse.toLocaleString("fr-FR")} FCFA
                    </Text>
                    <MaterialIcons
                      name={isMonthExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                      size={24}
                      color={COLORS.muted}
                    />
                  </View>
                </TouchableOpacity>

                {/* Détails du mois */}
                {isMonthExpanded && (
                  <View style={merchantAccountingStyles.monthDetails}>
                    {/* Résumé du mois */}
                    <View style={merchantAccountingStyles.monthSummary}>
                      <View style={merchantAccountingStyles.monthSummaryItem}>
                        <Text style={merchantAccountingStyles.monthSummaryLabel}>Livraisons</Text>
                        <Text style={merchantAccountingStyles.monthSummaryValue}>
                          {month.totalDeliveries}
                        </Text>
                      </View>
                      <View style={merchantAccountingStyles.monthSummaryItem}>
                        <Text style={merchantAccountingStyles.monthSummaryLabel}>À reverser</Text>
                        <Text style={[merchantAccountingStyles.monthSummaryValue, { color: COLORS.warning }]}>
                          {month.totalAReverser.toLocaleString("fr-FR")} FCFA
                        </Text>
                      </View>
                      <View style={merchantAccountingStyles.monthSummaryItem}>
                        <Text style={merchantAccountingStyles.monthSummaryLabel}>Profit</Text>
                        <Text style={[merchantAccountingStyles.monthSummaryValue, { color: COLORS.success }]}>
                          {month.totalProfit.toLocaleString("fr-FR")} FCFA
                        </Text>
                      </View>
                    </View>

                    {/* Liste des commerçants du mois */}
                    {month.merchants.map((merchant) => {
                      const isMerchantExpanded = expandedMerchants.includes(merchant.merchant_id);
                      
                      return (
                        <View key={merchant.merchant_id} style={merchantAccountingStyles.merchantCard}>
                          <TouchableOpacity
                            style={merchantAccountingStyles.merchantHeader}
                            onPress={() => toggleMerchant(merchant.merchant_id)}
                            activeOpacity={0.7}
                          >
                            <View style={merchantAccountingStyles.merchantAvatar}>
                              <Text style={merchantAccountingStyles.merchantInitial}>
                                {merchant.merchant_name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={merchantAccountingStyles.merchantInfo}>
                              <Text style={merchantAccountingStyles.merchantName}>
                                {merchant.merchant_name}
                              </Text>
                              <View style={merchantAccountingStyles.merchantStats}>
                                <Text style={merchantAccountingStyles.merchantStatText}>
                                  {merchant.totalDeliveries} livraison(s)
                                </Text>
                                <Text style={merchantAccountingStyles.merchantStatAmount}>
                                  {merchant.totalEncaisse.toLocaleString("fr-FR")} FCFA
                                </Text>
                              </View>
                            </View>
                            <MaterialIcons
                              name={isMerchantExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                              size={20}
                              color={COLORS.muted}
                            />
                          </TouchableOpacity>

                          {isMerchantExpanded && (
                            <View style={merchantAccountingStyles.merchantDetails}>
                              <View style={merchantAccountingStyles.financialSection}>
                                <View style={merchantAccountingStyles.financialRow}>
                                  <Text style={merchantAccountingStyles.financialLabel}>Total encaissé</Text>
                                  <Text style={merchantAccountingStyles.financialValue}>
                                    {merchant.totalEncaisse.toLocaleString("fr-FR")} FCFA
                                  </Text>
                                </View>
                                <View style={merchantAccountingStyles.financialRow}>
                                  <Text style={[merchantAccountingStyles.financialLabel, { color: COLORS.warning }]}>
                                    À reverser
                                  </Text>
                                  <Text style={[merchantAccountingStyles.financialValue, { color: COLORS.warning }]}>
                                    {merchant.totalAReverser.toLocaleString("fr-FR")} FCFA
                                  </Text>
                                </View>
                                <View style={merchantAccountingStyles.financialRow}>
                                  <Text style={[merchantAccountingStyles.financialLabel, { color: COLORS.success }]}>
                                    Profit réalisé
                                  </Text>
                                  <Text style={[merchantAccountingStyles.financialValue, { color: COLORS.success }]}>
                                    {merchant.totalProfit.toLocaleString("fr-FR")} FCFA
                                  </Text>
                                </View>
                              </View>

                              {merchant.deliveries.length > 0 && (
                                <View style={merchantAccountingStyles.recentDeliveries}>
                                  <Text style={merchantAccountingStyles.recentDeliveriesTitle}>
                                    Livraisons
                                  </Text>
                                  {merchant.deliveries.slice(0, 3).map((delivery) => (
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
                                  {merchant.deliveries.length > 3 && (
                                    <Text style={merchantAccountingStyles.moreDeliveries}>
                                      +{merchant.deliveries.length - 3} autres livraisons
                                    </Text>
                                  )}
                                </View>
                              )}

                              {!merchant.isClosed && (
                                <TouchableOpacity
                                  style={merchantAccountingStyles.closeButton}
                                  onPress={() => handleCloseMerchant(merchant.merchant_id, merchant.merchant_name, month.monthKey)}
                                >
                                  <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
                                  <Text style={merchantAccountingStyles.closeButtonText}>
                                    Clôturer pour ce mois
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={merchantAccountingStyles.emptyState}>
            <MaterialIcons name="store" size={48} color={COLORS.muted} />
            <Text style={merchantAccountingStyles.emptyStateTitle}>
              Aucune donnée disponible
            </Text>
            <Text style={merchantAccountingStyles.emptyStateText}>
              {searchQuery
                ? "Aucun commerçant ne correspond à votre recherche"
                : dateFilterEnabled
                  ? `Aucune livraison pour ${formatDateForDisplay().toLowerCase()}`
                  : "Aucune livraison trouvée"}
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
                    <MaterialIcons name="calendar-today" size={16} color={COLORS.primary} />
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
                        <MaterialIcons name="chevron-left" size={20} color={COLORS.muted} />
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
                        <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
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