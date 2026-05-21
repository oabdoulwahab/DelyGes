import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  StatusBar,
  Modal,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { commonStyles } from "../styles/common";
import { deliveriesStyles } from "../styles/deliveriesStyles";
import { COLORS } from "../styles/colors";
import { useModal } from "../providers/ModalProvider";
import { sendDeliveryCompletedNotification } from "../src/services/notification.service";
import { useAuth } from "../src/context/AuthContext";
import { useSync } from "../src/hooks/useSync";
import { DeliveryRepository } from "../src/repositories/delivery.repository";
import { DeliveryService } from "../src/services/delivery.service";
import { Delivery } from "../src/types";

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
  const { showConfirm, showSuccess, showError } = useModal();
  const { user } = useAuth();
  const { markAndSync } = useSync();

  const loadDeliveryDates = async () => {
    try {
      const dates = await DeliveryRepository.getDeliveryDates();
      setDeliveryDates(dates.map((d) => new Date(d)));
    } catch (error) {
      console.error("Erreur lors du chargement des dates de livraison:", error);
    }
  };

  const loadDeliveries = async () => {
    let query = "";
    let params: any[] = [];

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
          dateCondition = "date(created_at) BETWEEN ? AND ?";
          params = [weekStart.toISOString().split("T")[0], weekEnd.toISOString().split("T")[0], ...params];
          break;
        case "month":
          const monthStart = startOfMonth(selectedDate);
          const monthEnd = endOfMonth(selectedDate);
          dateCondition = "date(created_at) BETWEEN ? AND ?";
          params = [monthStart.toISOString().split("T")[0], monthEnd.toISOString().split("T")[0], ...params];
          break;
        case "custom":
          if (selectedEndDate) {
            dateCondition = "date(created_at) BETWEEN ? AND ?";
            params = [selectedDate.toISOString().split("T")[0], selectedEndDate.toISOString().split("T")[0], ...params];
          } else {
            dateCondition = "date(created_at) = ?";
            params = [selectedDate.toISOString().split("T")[0], ...params];
          }
          break;
      }

      if (dateCondition) {
        query = query.replace("WHERE", `WHERE ${dateCondition} AND`);
      }
    }

    if (searchQuery.trim()) {
      const searchCondition = "(recipient_name LIKE ? OR address LIKE ? OR phone LIKE ?)";
      query = query.replace("WHERE", `WHERE ${searchCondition} AND`);
      params = [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, ...params];
    }

    query += activeTab === "LIVREE" ? " ORDER BY delivered_at DESC" : " ORDER BY created_at DESC";

    try {
      const result = await DeliveryRepository.queryDeliveries(query, params);
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
  }, [
    activeTab,
    searchQuery,
    dateFilterEnabled,
    selectedDate,
    selectedEndDate,
    activePeriod,
  ]);

  const toggleDeliverySelection = (id: number) => {
    const delivery = deliveries.find((d) => d.id === id);

    if (
      delivery &&
      (delivery.status === "LIVREE" || delivery.status === "ANNULEE")
    ) {
      return;
    }

    setSelectedDeliveries((prev) =>
      prev.includes(id)
        ? prev.filter((deliveryId) => deliveryId !== id)
        : [...prev, id],
    );
  };

  const markAsDelivered = async (id: number) => {
    setSelectedDeliveries((prev) =>
      prev.filter((deliveryId) => deliveryId !== id),
    );

    const delivery = deliveries.find((d) => d.id === id);
    const amount = delivery?.delivery_fee || 0;

    try {
      await DeliveryService.markAsDelivered(id);
      await markAndSync("deliveries", id);

      if (user?.id) {
        await sendDeliveryCompletedNotification(user.id, amount);
      }

      showSuccess("Succès", "Livraison marquée comme livrée");
      loadDeliveries();
    } catch (error) {
      console.error("Erreur markAsDelivered:", error);
      showError("Erreur", "Impossible de marquer comme livrée");
    }
  };

  const markSelectedAsPaid = async () => {
    if (selectedDeliveries.length === 0) return;

    const validDeliveries = deliveries.filter(
      (d) => selectedDeliveries.includes(d.id) && d.status !== "ANNULEE",
    );

    if (validDeliveries.length === 0) return;

    showConfirm(
      "Marquer comme payé",
      `Marquer ${validDeliveries.length} livraison(s) comme payée(s) ?`,
      () => {
        showSuccess("Succès", "Livraisons marquées comme payées");
        setSelectedDeliveries([]);
      },
    );
  };

  const markAsCancelled = async (id: number) => {
    setSelectedDeliveries((prev) =>
      prev.filter((deliveryId) => deliveryId !== id),
    );

    showConfirm(
      "Annuler la livraison",
      "Êtes-vous sûr de vouloir annuler cette livraison ?",
      async () => {
        try {
          await DeliveryService.cancelDelivery(id);
          await markAndSync("deliveries", id);
          showSuccess("Succès", "Livraison annulée");
          loadDeliveries();
        } catch (error) {
          console.error("Erreur cancel:", error);
          showError("Erreur", "Impossible d'annuler la livraison");
        }
      },
      "Oui, annuler",
      "Non",
    );
  };

  const getStatusConfig = (status: string, isSelected?: boolean) => {
    switch (status) {
      case "LIVREE":
        return {
          backgroundColor: COLORS.successSoft,
          borderColor: COLORS.success + "30",
          textColor: COLORS.success,
          text: "Terminée",
          icon: "check-circle",
        };
      case "A_LIVRER":
        return {
          backgroundColor: isSelected ? COLORS.warningSoft : COLORS.card,
          borderColor: isSelected ? COLORS.warning + "30" : COLORS.borderLight,
          textColor: COLORS.warning,
          text: "En attente",
          icon: "schedule",
        };
      case "ANNULEE":
        return {
          backgroundColor: COLORS.dangerSoft,
          borderColor: COLORS.danger + "30",
          textColor: COLORS.danger,
          text: "Annulée",
          icon: "cancel",
        };
      default:
        return {
          backgroundColor: COLORS.card,
          borderColor: COLORS.borderLight,
          textColor: COLORS.muted,
          text: "Prévu",
          icon: "pending",
        };
    }
  };

  const groupDeliveriesByTime = () => {
    const morning: Delivery[] = [];
    const afternoon: Delivery[] = [];
    const evening: Delivery[] = [];

    deliveries.forEach((delivery) => {
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
        <View key={`prev-${i}`} style={deliveriesStyles.calendarDayInactive}>
          <Text style={deliveriesStyles.calendarDayTextInactive}>
            {date.getDate()}
          </Text>
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
            deliveriesStyles.calendarDay,
            isToday && deliveriesStyles.calendarDayToday,
            isSelected && deliveriesStyles.calendarDaySelected,
            hasDeliveries &&
              !isSelected &&
              deliveriesStyles.calendarDayHasDeliveries,
          ]}
          onPress={() => {
            setSelectedDate(date);
            setSelectedEndDate(null);
            setActivePeriod("custom");
          }}
        >
          <Text
            style={[
              deliveriesStyles.calendarDayText,
              isToday && deliveriesStyles.calendarDayTextToday,
              isSelected && deliveriesStyles.calendarDayTextSelected,
            ]}
          >
            {i}
          </Text>
          {hasDeliveries && !isSelected && (
            <View style={deliveriesStyles.deliveryIndicator} />
          )}
        </TouchableOpacity>,
      );
    }

    const totalCells = 42;
    const remainingCells = totalCells - days.length;

    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <View key={`next-${i}`} style={deliveriesStyles.calendarDayInactive}>
          <Text style={deliveriesStyles.calendarDayTextInactive}>{i}</Text>
        </View>,
      );
    }

    return days;
  };

  const renderDeliveryCard = (delivery: Delivery) => {
    const isSelected = selectedDeliveries.includes(delivery.id);
    const statusConfig = getStatusConfig(delivery.status, isSelected);
    const isToday =
      new Date(delivery.created_at).toDateString() ===
      new Date().toDateString();
    const isCheckboxDisabled =
      delivery.status === "LIVREE" || delivery.status === "ANNULEE";
    const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";
    const isClientPaysLivraison =
      delivery.payment_type === "CLIENT_PAYE_LIVRAISON";
    const isColisDejaPaye = delivery.payment_type === "COLIS_DEJA_PAYE";

    const montantEncaisse =
      delivery.delivery_fee + (isClientPaysTout ? (delivery.parcel_value ?? 0) : 0);

    const montantAReverser = isClientPaysTout ? (delivery.parcel_value ?? 0) : 0;

    const profit = delivery.delivery_fee;

    return (
      <TouchableOpacity
        style={[
          deliveriesStyles.deliveryCard,
          {
            backgroundColor: statusConfig.backgroundColor,
            borderColor: statusConfig.borderColor,
            opacity: delivery.status === "ANNULEE" ? 0.6 : 1,
          },
        ]}
        onPress={() => router.push(`/delivery/${delivery.id}`)}
        onLongPress={() =>
          !isCheckboxDisabled && toggleDeliverySelection(delivery.id)
        }
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={deliveriesStyles.checkboxContainer}
          onPress={() =>
            !isCheckboxDisabled && toggleDeliverySelection(delivery.id)
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={isCheckboxDisabled}
        >
          <View
            style={[
              deliveriesStyles.checkbox,
              isSelected && deliveriesStyles.checkboxSelected,
              isCheckboxDisabled && deliveriesStyles.checkboxDisabled,
            ]}
          >
            {isSelected && !isCheckboxDisabled && (
              <MaterialIcons name="check" size={14} color="#FFFFFF" />
            )}
            {isCheckboxDisabled && delivery.status === "LIVREE" && (
              <MaterialIcons name="check" size={14} color={COLORS.success} />
            )}
            {isCheckboxDisabled && delivery.status === "ANNULEE" && (
              <MaterialIcons name="close" size={14} color={COLORS.danger} />
            )}
          </View>
        </TouchableOpacity>

        <View style={deliveriesStyles.deliveryContent}>
          <View style={deliveriesStyles.deliveryHeader}>
            <View style={deliveriesStyles.statusTimeContainer}>
              <View
                style={[
                  deliveriesStyles.statusBadge,
                  { backgroundColor: `${statusConfig.textColor}20` },
                ]}
              >
                <MaterialIcons
                  name={statusConfig.icon as any}
                  size={12}
                  color={statusConfig.textColor}
                />
                <Text
                  style={[
                    deliveriesStyles.statusText,
                    { color: statusConfig.textColor },
                  ]}
                >
                  {statusConfig.text}
                </Text>
              </View>

              <Text style={deliveriesStyles.timeText}>
                {new Date(delivery.created_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {isToday && " • Aujourd'hui"}
              </Text>
            </View>

            <Text style={deliveriesStyles.feeText}>
              +{delivery.delivery_fee.toLocaleString("fr-FR")} FCFA
            </Text>
          </View>

          <View style={deliveriesStyles.addressContainer}>
            <View style={deliveriesStyles.addressLine}>
              <View
                style={[
                  deliveriesStyles.addressDot,
                  { backgroundColor: COLORS.muted },
                ]}
              />
              <Text style={deliveriesStyles.addressText} numberOfLines={1}>
                {delivery.address || "Adresse non spécifiée"}
              </Text>
            </View>

            <View style={deliveriesStyles.addressLine}>
              <View
                style={[
                  deliveriesStyles.addressDot,
                  { backgroundColor: COLORS.primary },
                ]}
              />
              <Text style={deliveriesStyles.addressText} numberOfLines={1}>
                {delivery.recipient_name}
                {delivery.phone ? ` • ${delivery.phone}` : ""}
              </Text>
            </View>
          </View>

          <View style={deliveriesStyles.deliveryDetails}>
            <Text style={deliveriesStyles.paymentTypeText}>
              {isClientPaysTout && "💰 Client paie colis + livraison"}
              {isClientPaysLivraison && "🚚 Client paie livraison seulement"}
              {isColisDejaPaye && "📦 Colis déjà payé"}
            </Text>

            <Text style={deliveriesStyles.encaisseText}>
              Encaissé : {montantEncaisse.toLocaleString("fr-FR")} FCFA
            </Text>

            {montantAReverser > 0 && (
              <Text style={deliveriesStyles.reverserText}>
                À reverser : {montantAReverser.toLocaleString("fr-FR")} FCFA
              </Text>
            )}
          </View>

          {delivery.status === "A_LIVRER" && (
            <View style={deliveriesStyles.actionsContainer}>
              <TouchableOpacity
                style={[
                  deliveriesStyles.actionButton,
                  { backgroundColor: COLORS.primary },
                ]}
                onPress={() => markAsDelivered(delivery.id)}
              >
                <MaterialIcons name="check" size={16} color="#FFFFFF" />
                <Text style={deliveriesStyles.actionButtonText}>
                  Marquer livrée
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  deliveriesStyles.actionButton,
                  deliveriesStyles.actionButtonDanger,
                ]}
                onPress={() => markAsCancelled(delivery.id)}
              >
                <MaterialIcons name="close" size={16} color={COLORS.danger} />
                <Text
                  style={[
                    deliveriesStyles.actionButtonText,
                    { color: COLORS.danger },
                  ]}
                >
                  Annuler
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const { morning, afternoon, evening } = groupDeliveriesByTime();

  const totalSelectedAmount = deliveries
    .filter((d) => selectedDeliveries.includes(d.id) && d.status !== "ANNULEE")
    .reduce((sum, d) => sum + d.delivery_fee, 0);

  return (
    <View style={commonStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <BlurView intensity={95} style={deliveriesStyles.header}>
        <View style={deliveriesStyles.headerContent}>
          <Text style={deliveriesStyles.headerTitle}>
            Historique et Planning
          </Text>
          <TouchableOpacity style={deliveriesStyles.doneButton}>
            {/* <Text style={deliveriesStyles.doneButtonText}>Terminé</Text> */}
          </TouchableOpacity>
        </View>
      </BlurView>

      <ScrollView
        style={deliveriesStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={deliveriesStyles.scrollContent}
      >
        <View style={deliveriesStyles.searchContainer}>
          <View style={deliveriesStyles.searchInputContainer}>
            <MaterialIcons
              name="search"
              size={20}
              color={COLORS.muted}
              style={deliveriesStyles.searchIcon}
            />
            <TextInput
              style={deliveriesStyles.searchInput}
              placeholder="Rechercher un client..."
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity
            style={[
              deliveriesStyles.filterButton,
              dateFilterEnabled && deliveriesStyles.filterButtonActive,
            ]}
            onPress={() => setShowFilterModal(true)}
          >
            <MaterialIcons
              name="filter-list"
              size={20}
              color={dateFilterEnabled ? COLORS.primary : COLORS.muted}
            />
            {dateFilterEnabled && (
              <View style={deliveriesStyles.filterIndicator} />
            )}
          </TouchableOpacity>
        </View>

        {dateFilterEnabled && (
          <View style={deliveriesStyles.dateFilterContainer}>
            <View style={deliveriesStyles.dateFilterContent}>
              <MaterialIcons
                name="calendar-today"
                size={16}
                color={COLORS.primary}
              />
              <Text style={deliveriesStyles.dateFilterText}>
                {formatDateForDisplay()}
              </Text>
              <TouchableOpacity onPress={clearDateFilter}>
                <MaterialIcons name="close" size={16} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={deliveriesStyles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={deliveriesStyles.tabsScroll}
          >
            {(["A_LIVRER", "AUJOURDHUI", "LIVREE", "ANNULEE"] as TabType[]).map(
              (tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    deliveriesStyles.tab,
                    activeTab === tab && deliveriesStyles.activeTab,
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text
                    style={[
                      deliveriesStyles.tabText,
                      activeTab === tab && deliveriesStyles.activeTabText,
                    ]}
                  >
                    {tab === "A_LIVRER" && "En cours"}
                    {tab === "AUJOURDHUI" && "Aujourd'hui"}
                    {tab === "LIVREE" && "Terminées"}
                    {tab === "ANNULEE" && "Annulées"}
                  </Text>
                  <View
                    style={[
                      deliveriesStyles.tabIndicator,
                      activeTab === tab && deliveriesStyles.activeTabIndicator,
                    ]}
                  />
                </TouchableOpacity>
              ),
            )}
          </ScrollView>
        </View>

        {activeTab === "AUJOURDHUI" ? (
          <View style={deliveriesStyles.deliveriesList}>
            {morning.length > 0 && (
              <View style={commonStyles.section}>
                <Text style={deliveriesStyles.sectionTitle}>
                  Tournées du matin
                </Text>
                {morning.map((delivery) => (
                  <View key={delivery.id}>{renderDeliveryCard(delivery)}</View>
                ))}
                {afternoon.length > 0 && morning.length > 0 && (
                  <View style={deliveriesStyles.sectionSeparator} />
                )}
              </View>
            )}

            {afternoon.length > 0 && (
              <View style={commonStyles.section}>
                <Text style={deliveriesStyles.sectionTitle}>
                  Bloc après-midi
                </Text>
                {afternoon.map((delivery) => (
                  <View key={delivery.id}>{renderDeliveryCard(delivery)}</View>
                ))}
                {evening.length > 0 && afternoon.length > 0 && (
                  <View style={deliveriesStyles.sectionSeparator} />
                )}
              </View>
            )}

            {evening.length > 0 && (
              <View style={commonStyles.section}>
                <Text style={deliveriesStyles.sectionTitle}>Soirée</Text>
                {evening.map((delivery) => (
                  <View key={delivery.id}>{renderDeliveryCard(delivery)}</View>
                ))}
              </View>
            )}

            {deliveries.length === 0 && (
              <View style={deliveriesStyles.emptyState}>
                <MaterialIcons
                  name="local-shipping"
                  size={48}
                  color={COLORS.muted}
                />
                <Text style={deliveriesStyles.emptyStateText}>
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
          <View style={deliveriesStyles.deliveriesList}>
            {deliveries.map((delivery, index) => (
              <View key={delivery.id}>
                {renderDeliveryCard(delivery)}
                {index < deliveries.length - 1 && (
                  <View style={deliveriesStyles.sectionSeparator} />
                )}
              </View>
            ))}

            {deliveries.length === 0 && (
              <View style={deliveriesStyles.emptyState}>
                <MaterialIcons
                  name={
                    activeTab === "A_LIVRER"
                      ? "schedule"
                      : activeTab === "LIVREE"
                        ? "check-circle"
                        : "cancel"
                  }
                  size={48}
                  color={COLORS.muted}
                />
                <Text style={deliveriesStyles.emptyStateText}>
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
        <View style={deliveriesStyles.selectionBar}>
          <View style={deliveriesStyles.selectionInfo}>
            <Text style={deliveriesStyles.selectionCount}>
              {selectedDeliveries.length} élément
              {selectedDeliveries.length > 1 ? "s" : ""} sélectionné
              {selectedDeliveries.length > 1 ? "s" : ""}
            </Text>
            <Text style={deliveriesStyles.selectionAmount}>
              +{totalSelectedAmount.toLocaleString("fr-FR")} FCFA total
            </Text>
          </View>

          <View style={deliveriesStyles.selectionActions}>
            <TouchableOpacity style={deliveriesStyles.pdfButton}>
              <MaterialIcons
                name="picture-as-pdf"
                size={20}
                color={COLORS.white}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={deliveriesStyles.markPaidButton}
              onPress={markSelectedAsPaid}
            >
              <Text style={deliveriesStyles.markPaidButtonText}>
                Marquer comme payé
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={deliveriesStyles.modalOverlay}>
          <BlurView intensity={95} style={deliveriesStyles.modalContent}>
            <View style={deliveriesStyles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={deliveriesStyles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={COLORS.muted} />
              </TouchableOpacity>

              <Text style={deliveriesStyles.modalTitle}>Filtres</Text>

              <TouchableOpacity
                onPress={clearDateFilter}
                style={deliveriesStyles.modalResetButton}
              >
                <Text style={deliveriesStyles.modalResetText}>
                  Réinitialiser
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={deliveriesStyles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              <View style={deliveriesStyles.modalSection}>
                <Text style={deliveriesStyles.modalSectionTitle}>Période</Text>

                <View style={deliveriesStyles.periodButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      deliveriesStyles.periodButton,
                      activePeriod === "today" &&
                        deliveriesStyles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("today")}
                  >
                    <Text
                      style={[
                        deliveriesStyles.periodButtonText,
                        activePeriod === "today" &&
                          deliveriesStyles.periodButtonTextActive,
                      ]}
                    >
                      Aujourd'hui
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      deliveriesStyles.periodButton,
                      activePeriod === "week" &&
                        deliveriesStyles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("week")}
                  >
                    <Text
                      style={[
                        deliveriesStyles.periodButtonText,
                        activePeriod === "week" &&
                          deliveriesStyles.periodButtonTextActive,
                      ]}
                    >
                      Cette semaine
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      deliveriesStyles.periodButton,
                      activePeriod === "month" &&
                        deliveriesStyles.periodButtonActive,
                    ]}
                    onPress={() => selectPeriod("month")}
                  >
                    <Text
                      style={[
                        deliveriesStyles.periodButtonText,
                        activePeriod === "month" &&
                          deliveriesStyles.periodButtonTextActive,
                      ]}
                    >
                      Ce mois
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      deliveriesStyles.periodButton,
                      deliveriesStyles.periodButtonCustom,
                      activePeriod === "custom" &&
                        deliveriesStyles.periodButtonCustomActive,
                    ]}
                    onPress={() => selectPeriod("custom")}
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text style={deliveriesStyles.periodButtonCustomText}>
                      Personnalisé
                    </Text>
                  </TouchableOpacity>
                </View>

                {activePeriod === "custom" && (
                  <View style={deliveriesStyles.calendarContainer}>
                    <View style={deliveriesStyles.calendarHeader}>
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

                      <Text style={deliveriesStyles.calendarTitle}>
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

                    <View style={deliveriesStyles.weekDaysContainer}>
                      {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                        <Text key={index} style={deliveriesStyles.weekDayText}>
                          {day}
                        </Text>
                      ))}
                    </View>

                    <View style={deliveriesStyles.datesContainer}>
                      {generateCalendarDays()}
                    </View>

                    {selectedDate && (
                      <View style={deliveriesStyles.selectedDateInfo}>
                        <Text style={deliveriesStyles.selectedDateText}>
                          Date sélectionnée :{" "}
                          {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={deliveriesStyles.modalActions}>
              <TouchableOpacity
                style={deliveriesStyles.resetButton}
                onPress={clearDateFilter}
              >
                <Text style={deliveriesStyles.resetButtonText}>
                  Réinitialiser
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={deliveriesStyles.applyButton}
                onPress={handleApplyFilters}
              >
                <Text style={deliveriesStyles.applyButtonText}>
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
