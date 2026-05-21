import { MaterialIcons } from "@expo/vector-icons";
import { endOfMonth, format, isSameDay, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useModal } from "../providers/ModalProvider";
import { COLORS } from "../styles/colors";
import { merchantAccountingStyles } from "../styles/merchantAccountingStyles";
import { DeliveryRepository } from "../src/repositories/delivery.repository";
import { MerchantRepository } from "../src/repositories/merchant.repository";
import { Delivery, Merchant } from "../src/types";

type DeliveryAccounting = Delivery & { month_key: string; year: string; month: string };

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
  dates?: Map<string, Delivery[]>;
};

type PeriodType = "month" | "custom";
type ViewMode = "monthly" | "merchant" | "pending";

export default function MerchantAccounting() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [filteredMonthlyData, setFilteredMonthlyData] = useState<MonthlyData[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [expandedMerchants, setExpandedMerchants] = useState<number[]>([]);
  const { showConfirm, showSuccess, showError } = useModal();
  const [refreshing, setRefreshing] = useState(false);

  // États pour les filtres de statut
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [showOnlyClosed, setShowOnlyClosed] = useState(false);

  // États pour les filtres de date
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [activePeriod, setActivePeriod] = useState<PeriodType>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [deliveryDates, setDeliveryDates] = useState<Date[]>([]);

  // 🔥 State pour les commerçants en attente (non reversés)
  const [pendingMerchants, setPendingMerchants] = useState<MerchantSummary[]>(
    [],
  );

  // ============================================================
  // CHARGEMENT DES DONNÉES REVERSÉES (vues "Par mois" et "Par commerçant")
  // ============================================================
  const loadAccounting = async () => {
    try {
      let dateFrom: string | undefined;
      let dateTo: string | undefined;

      if (dateFilterEnabled && selectedDate) {
        switch (activePeriod) {
          case "month":
            dateFrom = startOfMonth(selectedDate).toISOString().split("T")[0];
            dateTo = endOfMonth(selectedDate).toISOString().split("T")[0];
            break;
          case "custom":
            if (selectedEndDate) {
              dateFrom = selectedDate.toISOString().split("T")[0];
              dateTo = selectedEndDate.toISOString().split("T")[0];
            } else {
              dateFrom = selectedDate.toISOString().split("T")[0];
            }
            break;
        }
      }

      const deliveries = await DeliveryRepository.findReversedWithDates(dateFrom, dateTo);

      const merchants = await MerchantRepository.findAll();

      const merchantMap: Record<number, Merchant> = {};
      merchants.forEach((merchant) => {
        merchantMap[merchant.id] = merchant;
      });

      const monthlyGroups: Record<
        string,
        {
          monthName: string;
          year: number;
          merchants: Record<number, MerchantSummary>;
        }
      > = {};

      deliveries.forEach((delivery) => {
        const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";
        const montantEncaisse =
          delivery.delivery_fee +
          (isClientPaysTout ? (delivery.parcel_value ?? 0) : 0);
        const montantAReverser = isClientPaysTout ? (delivery.parcel_value ?? 0) : 0;
        const profit = delivery.delivery_fee;

        const deliveryDate = new Date(
          delivery.delivered_at || delivery.created_at,
        );
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

        const merchantId = delivery.merchant_id ?? 0;

        if (!monthlyGroups[monthKey].merchants[merchantId]) {
          monthlyGroups[monthKey].merchants[merchantId] = {
            merchant_id: merchantId,
            merchant_name: merchantMap[merchantId]?.name || "Inconnu",
            merchant_phone: merchantMap[merchantId]?.phone,
            merchant_address: merchantMap[merchantId]?.address,
            totalDeliveries: 0,
            totalEncaisse: 0,
            totalAReverser: 0,
            totalProfit: 0,
            isClosed: true,
            deliveries: [],
          };
        }

        const merchantData = monthlyGroups[monthKey].merchants[merchantId];
        merchantData.totalDeliveries += 1;
        merchantData.totalEncaisse += montantEncaisse;
        merchantData.totalAReverser += montantAReverser;
        merchantData.totalProfit += profit;
        merchantData.deliveries.push(delivery);
      });

      const monthlyDataArray: MonthlyData[] = Object.entries(monthlyGroups)
        .map(([monthKey, data]) => ({
          monthKey,
          monthName: data.monthName,
          year: data.year,
          totalEncaisse: Object.values(data.merchants).reduce(
            (sum, m) => sum + m.totalEncaisse,
            0,
          ),
          totalAReverser: Object.values(data.merchants).reduce(
            (sum, m) => sum + m.totalAReverser,
            0,
          ),
          totalProfit: Object.values(data.merchants).reduce(
            (sum, m) => sum + m.totalProfit,
            0,
          ),
          totalDeliveries: Object.values(data.merchants).reduce(
            (sum, m) => sum + m.totalDeliveries,
            0,
          ),
          merchants: Object.values(data.merchants),
        }))
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

      setMonthlyData(monthlyDataArray);
      setFilteredMonthlyData(monthlyDataArray);
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      showError("Erreur", "Impossible de charger les données");
    }
  };

  // ============================================================
  // CHARGEMENT DES LIVRAISONS NON REVERSÉES (vue "En cours")
  // ============================================================
  const loadPendingMerchants = async () => {
    try {
      const deliveries = await DeliveryRepository.findPendingReversal();

      const merchants = await MerchantRepository.findAll();

      const merchantMap: Record<number, Merchant> = {};
      merchants.forEach((merchant) => {
        merchantMap[merchant.id] = merchant;
      });

      const allMerchants = new Map<number, MerchantSummary>();

      deliveries.forEach((delivery) => {
        const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";
        const montantEncaisse =
          delivery.delivery_fee +
          (isClientPaysTout ? (delivery.parcel_value ?? 0) : 0);
        const montantAReverser = isClientPaysTout ? (delivery.parcel_value ?? 0) : 0;
        const profit = delivery.delivery_fee;

        const merchantId = delivery.merchant_id ?? 0;
        if (!allMerchants.has(merchantId)) {
          allMerchants.set(merchantId, {
            merchant_id: merchantId,
            merchant_name: merchantMap[merchantId]?.name || "Inconnu",
            merchant_phone: merchantMap[merchantId]?.phone,
            merchant_address: merchantMap[merchantId]?.address,
            totalDeliveries: 0,
            totalEncaisse: 0,
            totalAReverser: 0,
            totalProfit: 0,
            isClosed: false,
            deliveries: [],
          });
        }

        const merchantData = allMerchants.get(merchantId)!;
        merchantData.totalDeliveries += 1;
        merchantData.totalEncaisse += montantEncaisse;
        merchantData.totalAReverser += montantAReverser;
        merchantData.totalProfit += profit;
        merchantData.deliveries.push(delivery);
      });

      const pendingList = Array.from(allMerchants.values()).sort(
        (a, b) => b.totalAReverser - a.totalAReverser,
      );

      setPendingMerchants(pendingList);
    } catch (error) {
      console.error("Erreur loadPendingMerchants:", error);
    }
  };

  const loadDeliveryDates = async () => {
    try {
      const dates = await DeliveryRepository.getDeliveredDates();
      setDeliveryDates(dates.map((d) => new Date(d)));
    } catch (error) {
      console.error("Erreur lors du chargement des dates:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadAccounting(), loadPendingMerchants()]);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAccounting();
    loadDeliveryDates();
    loadPendingMerchants();
  }, []);

  useEffect(() => {
    if (dateFilterEnabled && (selectedDate || selectedEndDate)) {
      loadAccounting();
    }
  }, [dateFilterEnabled, selectedDate, selectedEndDate, activePeriod]);

  // Recharger les pending merchants quand monthlyData change (après clôture)
  useEffect(() => {
    loadPendingMerchants();
  }, [monthlyData]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = monthlyData
        .map((month) => ({
          ...month,
          merchants: month.merchants.filter(
            (merchant) =>
              merchant.merchant_name
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              merchant.merchant_phone?.includes(searchQuery) ||
              merchant.merchant_address
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()),
          ),
        }))
        .filter((month) => month.merchants.length > 0);
      setFilteredMonthlyData(filtered);
    } else {
      setFilteredMonthlyData(monthlyData);
    }
  }, [searchQuery, monthlyData]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) =>
      prev.includes(monthKey)
        ? prev.filter((m) => m !== monthKey)
        : [...prev, monthKey],
    );
  };

  const toggleMerchant = (merchantId: number) => {
    setExpandedMerchants((prev) =>
      prev.includes(merchantId)
        ? prev.filter((id) => id !== merchantId)
        : [...prev, merchantId],
    );
  };

  const handleCloseMerchant = async (
    merchantId: number,
    merchantName: string,
    monthKey: string,
  ) => {
    showConfirm(
      "Clôturer le commerçant",
      `Voulez-vous marquer toutes les livraisons de ${merchantName} pour cette période comme reversées ?`,
      async () => {
        try {
          const [year, month] = monthKey.split("-");
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate = new Date(parseInt(year), parseInt(month), 0);
          const startStr = startDate.toISOString().split("T")[0];
          const endStr = endDate.toISOString().split("T")[0];

          await DeliveryRepository.markReversedByMerchant(merchantId, startStr, endStr);

          showSuccess(
            "Succès",
            `Comptabilité de ${merchantName} clôturée pour cette période`,
          );

          await Promise.all([loadAccounting(), loadPendingMerchants()]);
          setExpandedMerchants([]);
          setExpandedMonths([]);
        } catch (error) {
          console.error("Erreur lors de la clôture:", error);
          showError("Erreur", "Impossible de clôturer la comptabilité");
        }
      },
      "Oui, clôturer",
      "Annuler",
    );
  };

  const handleCloseAllMerchant = (merchantId: number, merchantName: string) => {
    showConfirm(
      "Clôturer le commerçant",
      `Voulez-vous marquer TOUTES les livraisons non reversées de ${merchantName} (tous mois confondus) comme reversées ?`,
      async () => {
        try {
          await DeliveryRepository.markReversedByMerchant(merchantId);

          showSuccess(
            "Succès",
            `Toutes les livraisons de ${merchantName} ont été marquées comme reversées`,
          );

          await Promise.all([loadAccounting(), loadPendingMerchants()]);
          setExpandedMerchants([]);
          setExpandedMonths([]);
        } catch (error) {
          console.error("Erreur lors de la clôture:", error);
          showError("Erreur", "Impossible de clôturer la comptabilité");
        }
      },
      "Oui, tout clôturer",
      "Annuler",
    );
  };

  // Filtrer les commerçants par statut (utilisé dans vue "Par mois")
  const filterMerchantsByStatus = (merchants: MerchantSummary[]) => {
    if (showOnlyPending) return merchants.filter((m) => !m.isClosed);
    if (showOnlyClosed) return merchants.filter((m) => m.isClosed);
    return merchants;
  };

  // ============================================================
  // UNE SEULE fonction getDisplayTotals
  // ============================================================
  const getDisplayTotals = () => {
    if (viewMode === "pending") {
      return {
        encaisse: pendingMerchants.reduce((sum, m) => sum + m.totalEncaisse, 0),
        aReverser: pendingMerchants.reduce(
          (sum, m) => sum + m.totalAReverser,
          0,
        ),
        profit: pendingMerchants.reduce((sum, m) => sum + m.totalProfit, 0),
        deliveries: pendingMerchants.reduce(
          (sum, m) => sum + m.totalDeliveries,
          0,
        ),
      };
    }
    return {
      encaisse: filteredMonthlyData.reduce(
        (sum, m) => sum + m.totalEncaisse,
        0,
      ),
      aReverser: filteredMonthlyData.reduce(
        (sum, m) => sum + m.totalAReverser,
        0,
      ),
      profit: filteredMonthlyData.reduce((sum, m) => sum + m.totalProfit, 0),
      deliveries: filteredMonthlyData.reduce(
        (sum, m) => sum + m.totalDeliveries,
        0,
      ),
    };
  };

  const totals = getDisplayTotals();

  // ... (le reste du code : formatDateForDisplay, clearDateFilter, selectPeriod, etc. reste identique)

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
        <View
          key={`prev-${i}`}
          style={merchantAccountingStyles.calendarDayInactive}
        >
          <Text style={merchantAccountingStyles.calendarDayTextInactive}>
            {date.getDate()}
          </Text>
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
            hasDeliveries &&
              !isSelected &&
              merchantAccountingStyles.calendarDayHasDeliveries,
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
          {hasDeliveries && !isSelected && (
            <View style={merchantAccountingStyles.deliveryIndicator} />
          )}
        </TouchableOpacity>,
      );
    }

    const totalCells = 42;
    const remainingCells = totalCells - days.length;

    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <View
          key={`next-${i}`}
          style={merchantAccountingStyles.calendarDayInactive}
        >
          <Text style={merchantAccountingStyles.calendarDayTextInactive}>
            {i}
          </Text>
        </View>,
      );
    }

    return days;
  };

  // Rendu d'une livraison individuelle
  const renderDeliveryItem = (delivery: Delivery) => (
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
          {format(
            new Date(delivery.delivered_at || delivery.created_at),
            "dd/MM/yyyy",
          )}
        </Text>
      </View>
      <Text
        style={merchantAccountingStyles.deliveryPreviewAddress}
        numberOfLines={1}
      >
        {delivery.address}
      </Text>
      <View style={merchantAccountingStyles.deliveryPreviewFooter}>
        <Text style={merchantAccountingStyles.deliveryPreviewFee}>
          +{delivery.delivery_fee.toLocaleString("fr-FR")} FCFA
        </Text>
        {delivery.reversed === 1 ? (
          <View style={merchantAccountingStyles.reversedBadge}>
            <MaterialIcons
              name="check-circle"
              size={12}
              color={COLORS.success}
            />
            <Text style={merchantAccountingStyles.reversedBadgeText}>
              Reversé
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: COLORS.warning + "20",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 12,
              gap: 4,
            }}
          >
            <MaterialIcons name="pending" size={12} color={COLORS.warning} />
            <Text
              style={{ fontSize: 11, color: COLORS.warning, fontWeight: "500" }}
            >
              En attente
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Rendu d'une carte commerçant dans la vue "Par mois"
  const renderMerchantCardInMonth = (
    merchant: MerchantSummary,
    monthKey: string,
  ) => {
    const isMerchantExpanded = expandedMerchants.includes(merchant.merchant_id);

    return (
      <View
        key={merchant.merchant_id}
        style={merchantAccountingStyles.merchantCard}
      >
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialIcons
              name="check-circle"
              size={16}
              color={COLORS.success}
            />
            <MaterialIcons
              name={
                isMerchantExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"
              }
              size={20}
              color={COLORS.muted}
            />
          </View>
        </TouchableOpacity>

        {isMerchantExpanded && (
          <View style={merchantAccountingStyles.merchantDetails}>
            <View style={merchantAccountingStyles.financialSection}>
              <View style={merchantAccountingStyles.financialRow}>
                <Text style={merchantAccountingStyles.financialLabel}>
                  Total encaissé
                </Text>
                <Text style={merchantAccountingStyles.financialValue}>
                  {merchant.totalEncaisse.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>
              <View style={merchantAccountingStyles.financialRow}>
                <Text
                  style={[
                    merchantAccountingStyles.financialLabel,
                    { color: COLORS.warning },
                  ]}
                >
                  À reverser
                </Text>
                <Text
                  style={[
                    merchantAccountingStyles.financialValue,
                    { color: COLORS.warning },
                  ]}
                >
                  {merchant.totalAReverser.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>
              <View style={merchantAccountingStyles.financialRow}>
                <Text
                  style={[
                    merchantAccountingStyles.financialLabel,
                    { color: COLORS.success },
                  ]}
                >
                  Profit réalisé
                </Text>
                <Text
                  style={[
                    merchantAccountingStyles.financialValue,
                    { color: COLORS.success },
                  ]}
                >
                  {merchant.totalProfit.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>
            </View>

            {merchant.deliveries.length > 0 && (
              <View style={merchantAccountingStyles.recentDeliveries}>
                <Text style={merchantAccountingStyles.recentDeliveriesTitle}>
                  Livraisons reversées
                </Text>
                {merchant.deliveries.map((delivery) =>
                  renderDeliveryItem(delivery),
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ==================== RENDU PRINCIPAL ====================

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
          {dateFilterEnabled && (
            <View style={merchantAccountingStyles.filterIndicator} />
          )}
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

      {/* Switch de mode d'affichage */}
      <View style={merchantAccountingStyles.modeSwitchContainer}>
        <TouchableOpacity
          style={[
            merchantAccountingStyles.modeButton,
            viewMode === "pending" && merchantAccountingStyles.modeButtonActive,
          ]}
          onPress={() => {
            setViewMode("pending");
            setShowOnlyPending(true);
            setShowOnlyClosed(false);
          }}
        >
          <MaterialIcons
            name="pending-actions"
            size={20}
            color={viewMode === "pending" ? COLORS.background : COLORS.warning}
          />
          <Text
            style={[
              merchantAccountingStyles.modeButtonText,
              viewMode === "pending" &&
                merchantAccountingStyles.modeButtonTextActive,
            ]}
          >
            En cours
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            merchantAccountingStyles.modeButton,
            viewMode === "merchant" &&
              merchantAccountingStyles.modeButtonActive,
          ]}
          onPress={() => {
            setViewMode("merchant");
            setShowOnlyPending(false);
            setShowOnlyClosed(false);
          }}
        >
          <MaterialIcons
            name="store"
            size={20}
            color={viewMode === "merchant" ? COLORS.background : COLORS.muted}
          />
          <Text
            style={[
              merchantAccountingStyles.modeButtonText,
              viewMode === "merchant" &&
                merchantAccountingStyles.modeButtonTextActive,
            ]}
          >
            Par commerçant
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            merchantAccountingStyles.modeButton,
            viewMode === "monthly" && merchantAccountingStyles.modeButtonActive,
          ]}
          onPress={() => {
            setViewMode("monthly");
            setShowOnlyPending(false);
            setShowOnlyClosed(false);
          }}
        >
          <MaterialIcons
            name="calendar-view-month"
            size={20}
            color={viewMode === "monthly" ? COLORS.background : COLORS.muted}
          />
          <Text
            style={[
              merchantAccountingStyles.modeButtonText,
              viewMode === "monthly" &&
                merchantAccountingStyles.modeButtonTextActive,
            ]}
          >
            Par mois
          </Text>
        </TouchableOpacity>
      </View>

      {/* Résumé global */}
      <View style={merchantAccountingStyles.globalSummary}>
        <View style={merchantAccountingStyles.globalCard}>
          <Text style={merchantAccountingStyles.globalLabel}>Livraisons</Text>
          <Text style={merchantAccountingStyles.globalValue}>
            {totals.deliveries}
          </Text>
        </View>
        <View style={merchantAccountingStyles.globalCard}>
          <Text style={merchantAccountingStyles.globalLabel}>Encaissé</Text>
          <Text style={merchantAccountingStyles.globalValue}>
            {totals.encaisse.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
        <View style={merchantAccountingStyles.globalCard}>
          <Text style={merchantAccountingStyles.globalLabel}>À reverser</Text>
          <Text
            style={[
              merchantAccountingStyles.globalValue,
              { color: COLORS.warning },
            ]}
          >
            {totals.aReverser.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
        <View style={merchantAccountingStyles.globalCard}>
          <Text style={merchantAccountingStyles.globalLabel}>Profit</Text>
          <Text
            style={[
              merchantAccountingStyles.globalValue,
              { color: COLORS.success },
            ]}
          >
            {totals.profit.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>
      </View>

      <ScrollView
        style={merchantAccountingStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={merchantAccountingStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ========== VUE "EN COURS" ========== */}
        {viewMode === "pending" &&
          (pendingMerchants.length > 0 ? (
            <>
              <View
                style={{
                  backgroundColor: COLORS.warning + "10",
                  padding: 12,
                  marginHorizontal: 16,
                  marginBottom: 12,
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: COLORS.warning,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: COLORS.warning,
                    fontWeight: "500",
                  }}
                >
                  Ces commerçants ont des livraisons qui n'ont pas encore été
                  reversées. Clôturez-les une fois le reversement effectué.
                </Text>
              </View>

              {pendingMerchants.map((merchant) => {
                const isMerchantExpanded = expandedMerchants.includes(
                  merchant.merchant_id,
                );
                return (
                  <View
                    key={`pending-${merchant.merchant_id}`}
                    style={merchantAccountingStyles.merchantCard}
                  >
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
                        <Text
                          style={{
                            fontSize: 12,
                            color: COLORS.warning,
                            marginTop: 2,
                          }}
                        >
                          {merchant.totalDeliveries} livraison(s) en attente de
                          reversement
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: COLORS.warning,
                          }}
                        >
                          {merchant.totalAReverser.toLocaleString("fr-FR")} FCFA
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: COLORS.muted,
                            marginTop: 2,
                          }}
                        >
                          à reverser
                        </Text>
                      </View>
                      <MaterialIcons
                        name={
                          isMerchantExpanded
                            ? "keyboard-arrow-up"
                            : "keyboard-arrow-down"
                        }
                        size={20}
                        color={COLORS.muted}
                      />
                    </TouchableOpacity>

                    {isMerchantExpanded && (
                      <View style={merchantAccountingStyles.merchantDetails}>
                        <View style={merchantAccountingStyles.financialSection}>
                          <View style={merchantAccountingStyles.financialRow}>
                            <Text
                              style={merchantAccountingStyles.financialLabel}
                            >
                              Total encaissé
                            </Text>
                            <Text
                              style={merchantAccountingStyles.financialValue}
                            >
                              {merchant.totalEncaisse.toLocaleString("fr-FR")}{" "}
                              FCFA
                            </Text>
                          </View>
                          <View style={merchantAccountingStyles.financialRow}>
                            <Text
                              style={[
                                merchantAccountingStyles.financialLabel,
                                { color: COLORS.warning },
                              ]}
                            >
                              À reverser
                            </Text>
                            <Text
                              style={[
                                merchantAccountingStyles.financialValue,
                                { color: COLORS.warning },
                              ]}
                            >
                              {merchant.totalAReverser.toLocaleString("fr-FR")}{" "}
                              FCFA
                            </Text>
                          </View>
                        </View>

                        <View style={merchantAccountingStyles.recentDeliveries}>
                          <Text
                            style={
                              merchantAccountingStyles.recentDeliveriesTitle
                            }
                          >
                            Livraisons en attente ({merchant.deliveries.length})
                          </Text>
                          {merchant.deliveries.map((delivery) =>
                            renderDeliveryItem(delivery),
                          )}
                        </View>

                        <TouchableOpacity
                          style={[
                            merchantAccountingStyles.closeButton,
                            { marginTop: 16 },
                          ]}
                          onPress={() =>
                            handleCloseAllMerchant(
                              merchant.merchant_id,
                              merchant.merchant_name,
                            )
                          }
                        >
                          <MaterialIcons
                            name="check-circle"
                            size={18}
                            color="#FFFFFF"
                          />
                          <Text
                            style={merchantAccountingStyles.closeButtonText}
                          >
                            Tout clôturer (
                            {merchant.totalAReverser.toLocaleString("fr-FR")}{" "}
                            FCFA)
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          ) : (
            <View style={merchantAccountingStyles.emptyState}>
              <MaterialIcons
                name="check-circle"
                size={48}
                color={COLORS.success}
              />
              <Text style={merchantAccountingStyles.emptyStateTitle}>
                Tout est clôturé !
              </Text>
              <Text style={merchantAccountingStyles.emptyStateText}>
                Toutes les livraisons ont été reversées
              </Text>
            </View>
          ))}

        {/* ========== VUE "PAR COMMERÇANT" ========== */}
        {viewMode === "merchant" &&
          (() => {
            const allMerchantsMap = new Map<
              number,
              {
                merchant: MerchantSummary;
                dates: Map<string, Delivery[]>;
              }
            >();

            filteredMonthlyData.forEach((month) => {
              month.merchants.forEach((merchant) => {
                if (!allMerchantsMap.has(merchant.merchant_id)) {
                  allMerchantsMap.set(merchant.merchant_id, {
                    merchant: {
                      ...merchant,
                      totalEncaisse: 0,
                      totalAReverser: 0,
                      totalProfit: 0,
                      totalDeliveries: 0,
                      deliveries: [],
                      isClosed: true,
                    },
                    dates: new Map(),
                  });
                }

                const merchantData = allMerchantsMap.get(merchant.merchant_id)!;
                merchantData.merchant.totalEncaisse += merchant.totalEncaisse;
                merchantData.merchant.totalAReverser += merchant.totalAReverser;
                merchantData.merchant.totalProfit += merchant.totalProfit;
                merchantData.merchant.totalDeliveries +=
                  merchant.totalDeliveries;

                if (!merchant.isClosed) {
                  merchantData.merchant.isClosed = false;
                }

                merchant.deliveries.forEach((delivery) => {
                  const dateKey = format(
                    new Date(delivery.delivered_at || delivery.created_at),
                    "yyyy-MM-dd",
                  );
                  if (!merchantData.dates.has(dateKey)) {
                    merchantData.dates.set(dateKey, []);
                  }
                  merchantData.dates.get(dateKey)!.push(delivery);
                });
              });
            });

            type MerchantWithDates = MerchantSummary & {
              dates: Map<string, Delivery[]>;
            };

            let merchantsList: MerchantWithDates[] = Array.from(
              allMerchantsMap.values(),
            ).map(({ merchant, dates }) => ({ ...merchant, dates }));

            if (showOnlyPending) {
              merchantsList = merchantsList.filter((m) => !m.isClosed);
            } else if (showOnlyClosed) {
              merchantsList = merchantsList.filter((m) => m.isClosed);
            }

            if (merchantsList.length === 0) {
              return (
                <View style={merchantAccountingStyles.emptyState}>
                  <MaterialIcons name="store" size={48} color={COLORS.muted} />
                  <Text style={merchantAccountingStyles.emptyStateTitle}>
                    Aucun commerçant trouvé
                  </Text>
                  <Text style={merchantAccountingStyles.emptyStateText}>
                    Essayez de modifier vos filtres
                  </Text>
                </View>
              );
            }

            return merchantsList.map((merchant) => {
              const isMerchantExpanded = expandedMerchants.includes(
                merchant.merchant_id,
              );

              return (
                <View
                  key={`m-${merchant.merchant_id}`}
                  style={merchantAccountingStyles.merchantCard}
                >
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
                      <Text style={merchantAccountingStyles.merchantStatText}>
                        {merchant.totalDeliveries} livraisons •{" "}
                        {merchant.dates.size} date(s)
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {!merchant.isClosed && (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: COLORS.warning,
                          }}
                        />
                      )}
                      <MaterialIcons
                        name={
                          isMerchantExpanded
                            ? "keyboard-arrow-up"
                            : "keyboard-arrow-down"
                        }
                        size={20}
                        color={COLORS.muted}
                      />
                    </View>
                  </TouchableOpacity>

                  {isMerchantExpanded && (
                    <View style={merchantAccountingStyles.merchantDetails}>
                      <View style={merchantAccountingStyles.financialSection}>
                        <View style={merchantAccountingStyles.financialRow}>
                          <Text style={merchantAccountingStyles.financialLabel}>
                            Total encaissé
                          </Text>
                          <Text style={merchantAccountingStyles.financialValue}>
                            {merchant.totalEncaisse.toLocaleString("fr-FR")}{" "}
                            FCFA
                          </Text>
                        </View>
                        <View style={merchantAccountingStyles.financialRow}>
                          <Text
                            style={[
                              merchantAccountingStyles.financialLabel,
                              { color: COLORS.warning },
                            ]}
                          >
                            À reverser
                          </Text>
                          <Text
                            style={[
                              merchantAccountingStyles.financialValue,
                              { color: COLORS.warning },
                            ]}
                          >
                            {merchant.totalAReverser.toLocaleString("fr-FR")}{" "}
                            FCFA
                          </Text>
                        </View>
                        <View style={merchantAccountingStyles.financialRow}>
                          <Text
                            style={[
                              merchantAccountingStyles.financialLabel,
                              { color: COLORS.success },
                            ]}
                          >
                            Profit
                          </Text>
                          <Text
                            style={[
                              merchantAccountingStyles.financialValue,
                              { color: COLORS.success },
                            ]}
                          >
                            {merchant.totalProfit.toLocaleString("fr-FR")} FCFA
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: COLORS.primary,
                          marginTop: 12,
                          marginBottom: 8,
                        }}
                      >
                        Livraisons par date
                      </Text>

                      {Array.from(merchant.dates.entries())
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([dateKey, deliveries]) => {
                          const dateStr = format(
                            new Date(dateKey + "T00:00:00"),
                            "EEEE dd MMMM yyyy",
                            { locale: fr },
                          );

                          return (
                            <View
                              key={dateKey}
                              style={{
                                backgroundColor: COLORS.background,
                                borderRadius: 8,
                                padding: 10,
                                marginBottom: 12,
                                borderWidth: 1,
                                borderColor: COLORS.success + "40",
                                borderLeftWidth: 3,
                                borderLeftColor: COLORS.success,
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 6,
                                  marginBottom: 8,
                                  paddingBottom: 8,
                                  borderBottomWidth: 1,
                                  borderBottomColor: COLORS.borderLight,
                                }}
                              >
                                <MaterialIcons
                                  name="event"
                                  size={14}
                                  color={COLORS.primary}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: COLORS.primary,
                                    textTransform: "capitalize",
                                    flex: 1,
                                  }}
                                >
                                  {dateStr}
                                </Text>
                                <Text
                                  style={{ fontSize: 11, color: COLORS.muted }}
                                >
                                  {deliveries.length} livraison(s)
                                </Text>
                              </View>
                              {/* 🔥 Afficher directement les livraisons (elles sont déjà filtrées) */}
                              {deliveries.map((delivery: Delivery) =>
                                renderDeliveryItem(delivery),
                              )}
                            </View>
                          );
                        })}
                    </View>
                  )}
                </View>
              );
            });
          })()}

        {/* ========== VUE "PAR MOIS" ========== */}
        {viewMode === "monthly" &&
          (filteredMonthlyData.length > 0 ? (
            filteredMonthlyData.map((month) => {
              const isMonthExpanded = expandedMonths.includes(month.monthKey);
              const displayMerchants = filterMerchantsByStatus(month.merchants);

              if (
                displayMerchants.length === 0 &&
                (showOnlyPending || showOnlyClosed)
              )
                return null;

              return (
                <View
                  key={month.monthKey}
                  style={merchantAccountingStyles.monthCard}
                >
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
                        name={
                          isMonthExpanded
                            ? "keyboard-arrow-up"
                            : "keyboard-arrow-down"
                        }
                        size={24}
                        color={COLORS.muted}
                      />
                    </View>
                  </TouchableOpacity>

                  {isMonthExpanded && (
                    <View style={merchantAccountingStyles.monthDetails}>
                      <View style={merchantAccountingStyles.monthSummary}>
                        <View style={merchantAccountingStyles.monthSummaryItem}>
                          <Text
                            style={merchantAccountingStyles.monthSummaryLabel}
                          >
                            Livraisons
                          </Text>
                          <Text
                            style={merchantAccountingStyles.monthSummaryValue}
                          >
                            {month.totalDeliveries}
                          </Text>
                        </View>
                        <View style={merchantAccountingStyles.monthSummaryItem}>
                          <Text
                            style={merchantAccountingStyles.monthSummaryLabel}
                          >
                            À reverser
                          </Text>
                          <Text
                            style={[
                              merchantAccountingStyles.monthSummaryValue,
                              { color: COLORS.warning },
                            ]}
                          >
                            {month.totalAReverser.toLocaleString("fr-FR")} FCFA
                          </Text>
                        </View>
                        <View style={merchantAccountingStyles.monthSummaryItem}>
                          <Text
                            style={merchantAccountingStyles.monthSummaryLabel}
                          >
                            Profit
                          </Text>
                          <Text
                            style={[
                              merchantAccountingStyles.monthSummaryValue,
                              { color: COLORS.success },
                            ]}
                          >
                            {month.totalProfit.toLocaleString("fr-FR")} FCFA
                          </Text>
                        </View>
                      </View>

                      {displayMerchants.map((merchant) =>
                        renderMerchantCardInMonth(merchant, month.monthKey),
                      )}
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
          ))}
      </ScrollView>

      {/* Modal de filtre */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={merchantAccountingStyles.modalOverlay}>
          <BlurView
            intensity={95}
            style={merchantAccountingStyles.modalContent}
          >
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
                <Text style={merchantAccountingStyles.modalResetText}>
                  Réinitialiser
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={merchantAccountingStyles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              <View style={merchantAccountingStyles.modalSection}>
                <Text style={merchantAccountingStyles.modalSectionTitle}>
                  Période
                </Text>
                <View style={merchantAccountingStyles.periodButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      merchantAccountingStyles.periodButton,
                      activePeriod === "month" &&
                        merchantAccountingStyles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("month")}
                  >
                    <Text
                      style={[
                        merchantAccountingStyles.periodButtonText,
                        activePeriod === "month" &&
                          merchantAccountingStyles.periodButtonTextActive,
                      ]}
                    >
                      Ce mois
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      merchantAccountingStyles.periodButton,
                      merchantAccountingStyles.periodButtonCustom,
                      activePeriod === "custom" &&
                        merchantAccountingStyles.periodButtonCustomActive,
                    ]}
                    onPress={() => selectPeriod("custom")}
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text
                      style={merchantAccountingStyles.periodButtonCustomText}
                    >
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
                        <Text
                          key={index}
                          style={merchantAccountingStyles.weekDayText}
                        >
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
                <Text style={merchantAccountingStyles.resetButtonText}>
                  Réinitialiser
                </Text>
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
