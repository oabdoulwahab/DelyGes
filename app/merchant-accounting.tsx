import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "../src/context/AuthContext";
import { NotificationStore } from "../src/services/notification.store";
import { Formatters } from "../src/utils/formatters";
import {
  SettlementService,
  MerchantBalance,
  SettlementRow,
  SettledParcel,
  SettlementChannel,
  CHANNEL_META,
} from "../src/services/settlement.service";
import { useTutorial } from "../src/hooks/useTutorial";
import TutorialOverlay from "../components/TutorialOverlay";
import { TutorialProvider } from "../src/context/TutorialContext";
import TutorialTarget from "../components/TutorialTarget";
import TutorialScrollRegistrar from "../components/TutorialScrollRegistrar";

type ViewMode = "pending" | "merchants" | "history";

const CHANNELS: SettlementChannel[] = ["WAVE", "ORANGE", "MTN", "CASH"];

const parseMoney = (text: string): number => {
  const digits = (text || "").replace(/[^0-9]/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
};

const capitalize = (s: string) =>
  s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export default function MerchantAccounting() {
  const scrollRef = useRef<any>(null);
  const { user } = useAuth();
  const { showSuccess, showError, showAlert } = useModal();

  const [balances, setBalances] = useState<MerchantBalance[]>([]);
  const [settledMonth, setSettledMonth] = useState(0);
  const [history, setHistory] = useState<SettlementRow[]>([]);
  const [settledParcels, setSettledParcels] = useState<SettledParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("pending");

  // Versement focus
  const [focusId, setFocusId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<SettlementChannel>("WAVE");
  const [reference, setReference] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    merchant: string;
    amount: number;
    channel: SettlementChannel;
    reference: string;
    remaining: number;
  } | null>(null);

  // Header
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [userName, setUserName] = useState("Livreur");

  // Cartes dépliables ("m12" = marchand, "h45" = versement historique)
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const toggleExpanded = useCallback((key: string) => {
    setExpandedIds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const {
    isVisible: isTutorialVisible,
    currentStep: tutorialStep,
    tutorial,
    nextStep: tutorialNext,
    prevStep: tutorialPrev,
    closeTutorial: tutorialClose,
    showTutorial: tutorialShow,
  } = useTutorial("merchant-accounting");

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    NetInfo.fetch().then((s) => setIsConnected(s.isConnected ?? true));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user?.name) setUserName(user.name);
  }, [user?.name]);

  const userInitial = useMemo(() => {
    const n = userName || "?";
    return n.trim().charAt(0).toUpperCase() || "?";
  }, [userName]);

  const monthLabel = useMemo(() => {
    try {
      return capitalize(Formatters.formatDate(new Date(), "MMMM yyyy"));
    } catch {
      return "";
    }
  }, []);

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [b, s, h, p] = await Promise.all([
        SettlementService.getBalances(user.id),
        SettlementService.getSettledThisMonth(user.id, new Date()),
        SettlementService.getHistory(user.id, 30),
        SettlementService.getSettledParcels(user.id, 50),
      ]);
      setBalances(b);
      setSettledMonth(s.total);
      setHistory(h);
      setSettledParcels(p);
      setFocusId((prev) => {
        if (prev != null && b.some((x) => x.merchantId === prev)) return prev;
        return b.find((x) => x.due > 0)?.merchantId ?? null;
      });
    } catch (e) {
      console.error("❌ Erreur chargement reversements:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadUnread = useCallback(async () => {
    try {
      if (!user) return;
      setUnreadCount(await NotificationStore.countUnread(user.id));
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    loadAll();
    loadUnread();
  }, [loadAll, loadUnread]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      loadUnread();
    }, [loadAll, loadUnread]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadAll(), loadUnread()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadAll, loadUnread]);

  const dueBalances = useMemo(() => balances.filter((b) => b.due > 0), [balances]);
  const totalDue = useMemo(
    () => dueBalances.reduce((s, b) => s + b.due, 0),
    [dueBalances],
  );
  const focus = useMemo(
    () => balances.find((b) => b.merchantId === focusId) ?? null,
    [balances, focusId],
  );

  // Calculateur dynamique du versement partiel
  const entered = parseMoney(amount);
  const dueAmount = focus?.due ?? 0;
  const exceeds = entered > dueAmount;
  const pct = dueAmount > 0 ? Math.min((entered / dueAmount) * 100, 100) : 0;
  const remaining = Math.max(dueAmount - entered, 0);
  const canConfirm =
    !!focus && entered > 0 && !exceeds && !isConfirming && dueAmount > 0;

  // Historique unifié : reçus + colis sans reversement, du plus récent
  type HistoryItem =
    | { kind: "receipt"; date: string; receipt: SettlementRow }
    | { kind: "parcel"; date: string; parcel: SettledParcel };
  const historyItems: HistoryItem[] = useMemo(() => {
    const items: HistoryItem[] = [
      ...history.map((h) => ({
        kind: "receipt" as const,
        date: h.settled_at,
        receipt: h,
      })),
      ...settledParcels.map((parcel) => ({
        kind: "parcel" as const,
        date: parcel.delivered_at,
        parcel,
      })),
    ];
    return items.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [history, settledParcels]);

  const selectFocus = useCallback((id: number) => {
    setFocusId(id);
    setAmount("");
    setReference("");
    setChannel("WAVE");
    setLastReceipt(null);
  }, []);

  const settleAll = useCallback(() => {
    if (!focus || focus.due <= 0) return;
    setAmount(String(focus.due));
  }, [focus]);

  const handleConfirm = useCallback(async () => {
    if (!user || !focus) return;
    if (!canConfirm) {
      if (exceeds)
        showError(
          "Montant trop élevé",
          `Le solde dû à ${focus.name} est de ${Formatters.formatNumber(focus.due)} FCFA.`,
        );
      return;
    }
    setIsConfirming(true);
    try {
      const res = await SettlementService.recordSettlement(
        user.id,
        focus.merchantId,
        entered,
        channel,
        reference,
      );
      setLastReceipt({
        merchant: focus.name,
        amount: entered,
        channel,
        reference,
        remaining: res.remaining,
      });
      setAmount("");
      showSuccess(
        res.fullySettled ? "Compte soldé ✅" : "Versement enregistré ✅",
        res.fullySettled
          ? `${focus.name} : totalité reversée via ${CHANNEL_META[channel].label}.`
          : `${Formatters.formatNumber(entered)} FCFA reversés à ${focus.name} via ${CHANNEL_META[channel].label}. Reste : ${Formatters.formatNumber(res.remaining)} FCFA.`,
      );
      await loadAll();
    } catch (e: unknown) {
      console.error("❌ Erreur versement:", e);
      if (e instanceof Error && e.message === "AMOUNT_EXCEEDS_DUE") {
        showError(
          "Montant trop élevé",
          `Le solde dû à ${focus.name} est de ${Formatters.formatNumber(focus.due)} FCFA.`,
        );
      } else {
        showError("Erreur", "Impossible d'enregistrer ce versement.");
      }
    } finally {
      setIsConfirming(false);
    }
  }, [user, focus, canConfirm, exceeds, entered, channel, reference, loadAll, showSuccess, showError]);

  const handleShareReceipt = useCallback(async () => {
    if (!lastReceipt) return;
    setIsSharing(true);
    try {
      await SettlementService.shareReceipt(
        lastReceipt.merchant,
        lastReceipt.amount,
        lastReceipt.channel,
        lastReceipt.reference,
        lastReceipt.remaining,
      );
    } catch {
      /* partage annulé */
    } finally {
      setIsSharing(false);
    }
  }, [lastReceipt]);

  const handleShareSummary = useCallback(async () => {
    if (totalDue <= 0) {
      showAlert("Rien à partager", "Aucun reversement en attente.");
      return;
    }
    setIsSharing(true);
    try {
      await SettlementService.shareSummary(
        totalDue,
        dueBalances.length,
        dueBalances,
        monthLabel,
      );
    } catch {
      /* partage annulé */
    } finally {
      setIsSharing(false);
    }
  }, [totalDue, dueBalances, monthLabel, showAlert]);

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} • ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return "";
    }
  };

  const formatShortDate = (iso?: string) => {
    try {
      if (!iso) return "";
      return new Date(iso).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      });
    } catch {
      return "";
    }
  };

  // Lignes de colis (tap → fiche livraison)
  const renderDeliveryRows = (balance: MerchantBalance) => (
    <View style={merchantAccountingStyles.expandedBox}>
      <Text style={merchantAccountingStyles.expandedTitle}>
        {balance.deliveries.length > 0
          ? `${balance.count} colis en attente — toucher pour ouvrir`
          : "Aucun colis en attente — compte soldé"}
      </Text>
      {balance.deliveries.map((d) => (
        <TouchableOpacity
          key={d.id}
          style={merchantAccountingStyles.miniDeliveryRow}
          onPress={() => router.push(`/delivery/${d.id}`)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={merchantAccountingStyles.miniDeliveryName}
              numberOfLines={1}
            >
              {d.recipient_name}
            </Text>
            <Text
              style={merchantAccountingStyles.miniDeliverySub}
              numberOfLines={1}
            >
              {d.address || "Adresse non spécifiée"} •{" "}
              {formatShortDate(d.delivered_at || d.created_at)}
            </Text>
          </View>
          <Text style={merchantAccountingStyles.miniDeliveryAmount}>
            {Formatters.formatNumber(d.amount_to_return || 0)} F
          </Text>
          <MaterialIcons name="chevron-right" size={18} color={COLORS.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );

  // Ligne reçu de versement (même carte que les colis ci-dessous)
  const renderReceiptRow = (h: SettlementRow) => {
    const meta = CHANNEL_META[h.channel] || CHANNEL_META.CASH;
    const open = expandedIds.includes(`h${h.id}`);
    return (
      <View
        key={`h${h.id}`}
        style={[
          merchantAccountingStyles.historyRow,
          { flexDirection: "column", alignItems: "stretch" },
        ]}
      >
        <TouchableOpacity
          onPress={() => toggleExpanded(`h${h.id}`)}
          activeOpacity={0.8}
          accessibilityLabel={`Reçu ${h.merchant_name}`}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={[
                merchantAccountingStyles.historyChannel,
                { backgroundColor: meta.bg },
              ]}
            >
              <MaterialIcons
                name={meta.icon as keyof typeof MaterialIcons.glyphMap}
                size={19}
                color={meta.color}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={merchantAccountingStyles.merchantName}
                numberOfLines={1}
              >
                {h.merchant_name}
              </Text>
              <Text style={merchantAccountingStyles.merchantSub} numberOfLines={1}>
                {meta.label}
                {h.reference ? ` • ${h.reference}` : ""} •{" "}
                {formatDateTime(h.settled_at)}
              </Text>
            </View>
            <Text style={merchantAccountingStyles.otherAmount}>
              {Formatters.formatNumber(h.amount)} F
            </Text>
            <MaterialIcons
              name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={20}
              color={COLORS.muted}
            />
          </View>
        </TouchableOpacity>
        {open && (
          <View style={merchantAccountingStyles.expandedBox}>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>Canal</Text>
              <Text style={merchantAccountingStyles.financeValue}>
                {meta.label}
              </Text>
            </View>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>Référence</Text>
              <Text
                style={merchantAccountingStyles.financeValue}
                numberOfLines={2}
              >
                {h.reference || "—"}
              </Text>
            </View>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>Date</Text>
              <Text style={merchantAccountingStyles.financeValue}>
                {formatDateTime(h.settled_at)}
              </Text>
            </View>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>Montant</Text>
              <Text
                style={[
                  merchantAccountingStyles.financeValue,
                  { color: COLORS.primaryDark },
                ]}
              >
                {Formatters.formatNumber(h.amount)} FCFA
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Ligne colis sans reversement (même carte que les reçus ci-dessus)
  const renderParcelRow = (parcel: SettledParcel) => {
    const open = expandedIds.includes(`p${parcel.id}`);
    return (
      <View
        key={`p${parcel.id}`}
        style={[
          merchantAccountingStyles.historyRow,
          { flexDirection: "column", alignItems: "stretch" },
        ]}
      >
        <TouchableOpacity
          onPress={() => toggleExpanded(`p${parcel.id}`)}
          activeOpacity={0.8}
          accessibilityLabel={`Colis ${parcel.recipient_name}`}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={[
                merchantAccountingStyles.historyChannel,
                { backgroundColor: COLORS.borderVeryLight },
              ]}
            >
              <MaterialIcons
                name="inventory-2"
                size={19}
                color={COLORS.muted}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={merchantAccountingStyles.merchantName}
                numberOfLines={1}
              >
                {parcel.recipient_name}
              </Text>
              <Text
                style={merchantAccountingStyles.merchantSub}
                numberOfLines={1}
              >
                {parcel.merchant_name} • {formatShortDate(parcel.delivered_at)}
              </Text>
            </View>
            <Text style={merchantAccountingStyles.otherAmount}>
              {Formatters.formatNumber(parcel.amount_to_return)} F
            </Text>
            <MaterialIcons
              name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={20}
              color={COLORS.muted}
            />
          </View>
        </TouchableOpacity>
        {open && (
          <View style={merchantAccountingStyles.expandedBox}>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>Marchand</Text>
              <Text
                style={merchantAccountingStyles.financeValue}
                numberOfLines={1}
              >
                {parcel.merchant_name}
              </Text>
            </View>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>Reversé</Text>
              <Text style={merchantAccountingStyles.financeValue}>
                {Formatters.formatNumber(parcel.amount_to_return)} FCFA
              </Text>
            </View>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>
                Encaissé client
              </Text>
              <Text style={merchantAccountingStyles.financeValue}>
                {Formatters.formatNumber(parcel.amount_collected)} FCFA
              </Text>
            </View>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>Livré le</Text>
              <Text style={merchantAccountingStyles.financeValue}>
                {formatDateTime(parcel.delivered_at)}
              </Text>
            </View>
            <View style={merchantAccountingStyles.financeLine}>
              <Text style={merchantAccountingStyles.financeLabel}>Statut</Text>
              <Text
                style={[
                  merchantAccountingStyles.financeValue,
                  { color: COLORS.muted },
                ]}
              >
                Sans reversement
              </Text>
            </View>
            <TouchableOpacity
              style={merchantAccountingStyles.reverseButton}
              onPress={() => router.push(`/delivery/${parcel.id}`)}
              activeOpacity={0.85}
            >
              <Text style={merchantAccountingStyles.reverseButtonText}>
                Ouvrir la fiche
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={15}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <TutorialProvider>
      <View style={merchantAccountingStyles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* En-tête */}
        <View style={merchantAccountingStyles.header}>
          <View style={merchantAccountingStyles.headerContent}>
            <View style={merchantAccountingStyles.brandRow}>
              <Text style={merchantAccountingStyles.brandName}>Delygest</Text>
              <View style={merchantAccountingStyles.versionPill}>
                <Text style={merchantAccountingStyles.versionText}>v1.0.3</Text>
              </View>
            </View>
            <View style={merchantAccountingStyles.headerActions}>
              <View style={merchantAccountingStyles.syncPill}>
                <View
                  style={[
                    merchantAccountingStyles.syncDot,
                    { backgroundColor: isConnected ? COLORS.primary : "#D97706" },
                  ]}
                />
                <Text style={merchantAccountingStyles.syncText}>
                  {isConnected ? "Sync" : "Off"}
                </Text>
              </View>
              <TouchableOpacity
                style={merchantAccountingStyles.notificationButton}
                onPress={() => router.push("/notifications")}
                accessibilityLabel="Notifications"
              >
                <MaterialIcons name="notifications" size={22} color={COLORS.white} />
                {unreadCount > 0 && (
                  <View style={merchantAccountingStyles.notifBadge}>
                    <Text style={merchantAccountingStyles.notifBadgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={merchantAccountingStyles.avatar}
                onPress={() => router.push("/settings")}
                accessibilityLabel="Profil"
              >
                <Text style={merchantAccountingStyles.avatarText}>{userInitial}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={tutorialShow}
                style={merchantAccountingStyles.notificationButton}
                accessibilityLabel="Aide"
              >
                <MaterialIcons name="help-outline" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TutorialScrollRegistrar scrollRef={scrollRef}>
          <ScrollView
            ref={scrollRef}
            style={merchantAccountingStyles.scrollView}
            contentContainerStyle={merchantAccountingStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
          >
            {/* Titre section */}
            <View style={merchantAccountingStyles.titleRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={merchantAccountingStyles.pageTitle}>
                  Reversements Commerçants
                </Text>
                <Text style={merchantAccountingStyles.pageSubtitle}>
                  <MaterialIcons name="calendar-month" size={14} color={COLORS.primary} />{" "}
                  {monthLabel} • Clôture périodique
                </Text>
              </View>
              <View style={merchantAccountingStyles.securePill}>
                <MaterialIcons name="shield" size={15} color={COLORS.infoText} />
                <Text style={merchantAccountingStyles.secureText}>Sécurisé</Text>
              </View>
            </View>

            {/* Hero sombre */}
            <View style={merchantAccountingStyles.heroCard}>
              <View style={merchantAccountingStyles.heroTopRow}>
                <Text style={merchantAccountingStyles.heroLabel} numberOfLines={1}>
                  Total à reverser actuellement
                </Text>
                <View style={merchantAccountingStyles.heroCountPill}>
                  <Text style={merchantAccountingStyles.heroCountText}>
                    {dueBalances.length} commerçants
                  </Text>
                </View>
              </View>
              <View style={merchantAccountingStyles.heroAmountRow}>
                <Text style={merchantAccountingStyles.heroAmount}>
                  {Formatters.formatNumber(totalDue)}
                </Text>
                <Text style={merchantAccountingStyles.heroCurrency}>FCFA</Text>
              </View>
              <View style={merchantAccountingStyles.heroInner}>
                <View style={merchantAccountingStyles.heroInnerLeft}>
                  <MaterialIcons name="verified" size={18} color="#9FF5C1" />
                  <Text
                    style={merchantAccountingStyles.heroInnerLabel}
                    numberOfLines={1}
                  >
                    Déjà reversé ce mois
                  </Text>
                </View>
                <Text style={merchantAccountingStyles.heroInnerValue}>
                  {Formatters.formatNumber(settledMonth)} FCFA
                </Text>
              </View>
            </View>

            {/* Onglets */}
            <View style={merchantAccountingStyles.tabsRow}>
              <TutorialTarget id="tab-pending">
                <TouchableOpacity
                  style={[
                    merchantAccountingStyles.tab,
                    viewMode === "pending" && merchantAccountingStyles.tabActive,
                  ]}
                  onPress={() => setViewMode("pending")}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      merchantAccountingStyles.tabText,
                      viewMode === "pending" && merchantAccountingStyles.tabTextActive,
                    ]}
                  >
                    En cours
                  </Text>
                  <View style={merchantAccountingStyles.tabCount}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: COLORS.successText,
                      }}
                    >
                      {dueBalances.length}
                    </Text>
                  </View>
                </TouchableOpacity>
              </TutorialTarget>
              <TutorialTarget id="tab-merchant">
                <TouchableOpacity
                  style={[
                    merchantAccountingStyles.tab,
                    viewMode === "merchants" && merchantAccountingStyles.tabActive,
                  ]}
                  onPress={() => setViewMode("merchants")}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      merchantAccountingStyles.tabText,
                      viewMode === "merchants" && merchantAccountingStyles.tabTextActive,
                    ]}
                  >
                    Par commerçant
                  </Text>
                </TouchableOpacity>
              </TutorialTarget>
              <TutorialTarget id="tab-monthly">
                <TouchableOpacity
                  style={[
                    merchantAccountingStyles.tab,
                    viewMode === "history" && merchantAccountingStyles.tabActive,
                  ]}
                  onPress={() => setViewMode("history")}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      merchantAccountingStyles.tabText,
                      viewMode === "history" && merchantAccountingStyles.tabTextActive,
                    ]}
                  >
                    Historique
                  </Text>
                </TouchableOpacity>
              </TutorialTarget>
            </View>

            {loading ? (
              <View style={merchantAccountingStyles.emptyCard}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={merchantAccountingStyles.emptyText}>
                  Chargement des reversements…
                </Text>
              </View>
            ) : (
              <>
                {/* ============ EN COURS ============ */}
                {viewMode === "pending" && (
                  <>
                    {focus && focus.due > 0 ? (
                      <View style={merchantAccountingStyles.card}>
                        <TouchableOpacity
                          onPress={() => toggleExpanded(`m${focus.merchantId}`)}
                          activeOpacity={0.8}
                          accessibilityLabel={`Détail ${focus.name}`}
                        >
                          <View style={merchantAccountingStyles.merchantHead}>
                            <View style={merchantAccountingStyles.merchantLeft}>
                              <View style={merchantAccountingStyles.merchantAvatar}>
                                <MaterialIcons
                                  name="storefront"
                                  size={26}
                                  color="#92400E"
                                />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={merchantAccountingStyles.merchantNameRow}>
                                  <Text
                                    style={merchantAccountingStyles.merchantName}
                                    numberOfLines={1}
                                  >
                                    {focus.name}
                                  </Text>
                                  <MaterialIcons
                                    name="check-circle"
                                    size={16}
                                    color={COLORS.primary}
                                  />
                                </View>
                                <Text style={merchantAccountingStyles.merchantSub}>
                                  <View style={merchantAccountingStyles.merchantDot} />{" "}
                                  {focus.count} colis livré{focus.count > 1 ? "s" : ""} •{" "}
                                  {focus.commune}
                                </Text>
                              </View>
                            </View>
                            <View style={merchantAccountingStyles.collectedBox}>
                              <Text style={merchantAccountingStyles.collectedLabel}>
                                Collecté
                              </Text>
                              <Text style={merchantAccountingStyles.collectedValue}>
                                {Formatters.formatNumber(focus.collected)} FCFA
                              </Text>
                            </View>
                            <View style={merchantAccountingStyles.expandChevron}>
                              <MaterialIcons
                                name={
                                  expandedIds.includes(`m${focus.merchantId}`)
                                    ? "keyboard-arrow-up"
                                    : "keyboard-arrow-down"
                                }
                                size={20}
                                color={COLORS.muted}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>

                        {expandedIds.includes(`m${focus.merchantId}`) &&
                          renderDeliveryRows(focus)}

                        <View style={merchantAccountingStyles.dueLine}>
                          <Text style={merchantAccountingStyles.dueLabel}>
                            Reste à reverser
                          </Text>
                          <Text style={merchantAccountingStyles.dueValue}>
                            {Formatters.formatNumber(focus.due)} FCFA
                          </Text>
                        </View>

                        <View style={merchantAccountingStyles.payBox}>
                          <View style={merchantAccountingStyles.payHead}>
                            <Text style={merchantAccountingStyles.payTitle}>
                              <MaterialIcons
                                name="tune"
                                size={18}
                                color={COLORS.primary}
                              />{" "}
                              Effectuer un versement
                            </Text>
                            <View style={merchantAccountingStyles.partialPill}>
                              <Text style={merchantAccountingStyles.partialText}>
                                Partiel autorisé
                              </Text>
                            </View>
                          </View>

                          <View>
                            <Text style={merchantAccountingStyles.fieldLabel}>
                              Montant à transférer aujourd&apos;hui
                            </Text>
                            <View
                              style={[
                                merchantAccountingStyles.amountBox,
                                { marginTop: 6 },
                                exceeds && merchantAccountingStyles.amountBoxError,
                              ]}
                            >
                              <TextInput
                                style={merchantAccountingStyles.amountInput}
                                value={amount}
                                onChangeText={(t) =>
                                  setAmount(t.replace(/[^0-9\s]/g, ""))
                                }
                                keyboardType="decimal-pad"
                                placeholder="20 000"
                                placeholderTextColor={COLORS.placeholder}
                                editable={!isConfirming}
                                returnKeyType="done"
                              />
                              <Text style={merchantAccountingStyles.amountSuffix}>
                                FCFA
                              </Text>
                            </View>
                            {exceeds && (
                              <Text
                                style={[
                                  merchantAccountingStyles.errorText,
                                  { marginTop: 5 },
                                ]}
                              >
                                Montant supérieur au solde dû (
                                {Formatters.formatNumber(focus.due)} FCFA).
                              </Text>
                            )}
                          </View>

                          <View style={merchantAccountingStyles.gaugeBox}>
                            <View style={merchantAccountingStyles.gaugeRow}>
                              <Text style={merchantAccountingStyles.gaugeText}>
                                Versé :{" "}
                                <Text style={merchantAccountingStyles.gaugeStrongGreen}>
                                  {Formatters.formatNumber(entered)} FCFA
                                </Text>{" "}
                                ({pct.toFixed(0)}%)
                              </Text>
                              <Text style={merchantAccountingStyles.gaugeText}>
                                Reste :{" "}
                                <Text style={merchantAccountingStyles.gaugeStrongRed}>
                                  {Formatters.formatNumber(remaining)} FCFA
                                </Text>
                              </Text>
                            </View>
                            <View style={merchantAccountingStyles.gaugeTrack}>
                              <View
                                style={[
                                  merchantAccountingStyles.gaugeFill,
                                  { width: `${pct}%` },
                                ]}
                              />
                            </View>
                            <View style={merchantAccountingStyles.gaugeScale}>
                              <Text style={merchantAccountingStyles.gaugeScaleText}>
                                0 FCFA
                              </Text>
                              <Text style={merchantAccountingStyles.gaugeScaleText}>
                                Solde total : {Formatters.formatNumber(focus.due)} FCFA
                              </Text>
                            </View>
                          </View>

                          <View>
                            <Text style={merchantAccountingStyles.fieldLabel}>
                              Canal de versement
                            </Text>
                            <View
                              style={[
                                merchantAccountingStyles.channelGrid,
                                { marginTop: 8 },
                              ]}
                            >
                              {CHANNELS.map((c) => {
                                const meta = CHANNEL_META[c];
                                const active = channel === c;
                                return (
                                  <TouchableOpacity
                                    key={c}
                                    style={[
                                      merchantAccountingStyles.channelButton,
                                      active &&
                                        merchantAccountingStyles.channelButtonActive,
                                    ]}
                                    onPress={() => setChannel(c)}
                                    activeOpacity={0.85}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: active }}
                                  >
                                    <View style={merchantAccountingStyles.channelLeft}>
                                      <View
                                        style={[
                                          merchantAccountingStyles.channelDot,
                                          { backgroundColor: meta.color },
                                        ]}
                                      />
                                      <Text
                                        style={
                                          merchantAccountingStyles.channelLabel
                                        }
                                        numberOfLines={1}
                                      >
                                        {meta.label}
                                      </Text>
                                    </View>
                                    {active && (
                                      <MaterialIcons
                                        name="check"
                                        size={18}
                                        color={COLORS.primary}
                                      />
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>

                          <View>
                            <Text style={merchantAccountingStyles.fieldLabel}>
                              Référence / Note de traçabilité
                            </Text>
                            <View
                              style={[
                                merchantAccountingStyles.refBox,
                                { marginTop: 6 },
                              ]}
                            >
                              <MaterialIcons
                                name="receipt"
                                size={18}
                                color={COLORS.muted}
                              />
                              <TextInput
                                style={merchantAccountingStyles.refInput}
                                value={reference}
                                onChangeText={setReference}
                                placeholder="ex: Dépôt Wave agence Angré - 24/09"
                                placeholderTextColor={COLORS.placeholder}
                                editable={!isConfirming}
                                returnKeyType="done"
                              />
                            </View>
                          </View>

                          <TouchableOpacity
                            style={[
                              merchantAccountingStyles.confirmButton,
                              !canConfirm &&
                                merchantAccountingStyles.confirmButtonDisabled,
                            ]}
                            onPress={handleConfirm}
                            disabled={!canConfirm}
                            activeOpacity={0.95}
                          >
                            {isConfirming ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <MaterialIcons
                                name="payments"
                                size={20}
                                color="#FFFFFF"
                              />
                            )}
                            <Text style={merchantAccountingStyles.confirmText}>
                              {isConfirming
                                ? "Enregistrement…"
                                : `Confirmer le versement de ${Formatters.formatNumber(entered)} FCFA`}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={merchantAccountingStyles.settleAllButton}
                            onPress={settleAll}
                            disabled={isConfirming}
                          >
                            <Text style={merchantAccountingStyles.settleAllText}>
                              Solder la totalité (
                              {Formatters.formatNumber(focus.due)} FCFA)
                            </Text>
                          </TouchableOpacity>

                          {lastReceipt && (
                            <TouchableOpacity
                              style={merchantAccountingStyles.shareButton}
                              onPress={handleShareReceipt}
                              disabled={isSharing}
                            >
                              {isSharing ? (
                                <ActivityIndicator
                                  size="small"
                                  color={COLORS.primary}
                                />
                              ) : (
                                <MaterialIcons
                                  name="share"
                                  size={18}
                                  color={COLORS.primary}
                                />
                              )}
                              <Text style={merchantAccountingStyles.shareButtonText}>
                                Partager le reçu ({Formatters.formatNumber(lastReceipt.amount)}{" "}
                                FCFA)
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ) : (
                      <View style={merchantAccountingStyles.emptyCard}>
                        <MaterialIcons
                          name="check-circle"
                          size={44}
                          color={COLORS.success}
                        />
                        <Text style={merchantAccountingStyles.emptyText}>
                          Tout est reversé !{"\n"}Aucune livraison livrée en
                          attente.{"\n"}Astuce : seules les courses marquées
                          « Livrée » et non reversées apparaissent ici.
                        </Text>
                      </View>
                    )}

                    {dueBalances.filter((b) => b.merchantId !== focus?.merchantId)
                      .length > 0 && (
                      <>
                        <View style={merchantAccountingStyles.sectionHead}>
                          <Text style={merchantAccountingStyles.sectionTitle}>
                            Autres commerçants en attente
                          </Text>
                          <Text style={merchantAccountingStyles.sectionCount}>
                            {dueBalances.filter((b) => b.merchantId !== focus?.merchantId).length}{" "}
                            restant
                            {dueBalances.filter((b) => b.merchantId !== focus?.merchantId).length > 1 ? "s" : ""}
                          </Text>
                        </View>
                        {dueBalances
                          .filter((b) => b.merchantId !== focus?.merchantId)
                          .map((b) => {
                            const open = expandedIds.includes(`m${b.merchantId}`);
                            return (
                              <View
                                key={b.merchantId}
                                style={[
                                  merchantAccountingStyles.otherCard,
                                  { flexDirection: "column", alignItems: "stretch" },
                                ]}
                              >
                                <TouchableOpacity
                                  onPress={() => toggleExpanded(`m${b.merchantId}`)}
                                  activeOpacity={0.8}
                                  accessibilityLabel={`Détail ${b.name}`}
                                >
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    <View style={merchantAccountingStyles.otherLeft}>
                                      <View
                                        style={[
                                          merchantAccountingStyles.otherAvatar,
                                          { backgroundColor: "#DBEAFE" },
                                        ]}
                                      >
                                        <MaterialIcons
                                          name="shopping-bag"
                                          size={22}
                                          color={COLORS.infoText}
                                        />
                                      </View>
                                      <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                          style={merchantAccountingStyles.merchantName}
                                          numberOfLines={1}
                                        >
                                          {b.name}
                                        </Text>
                                        <Text style={merchantAccountingStyles.merchantSub} numberOfLines={1}>
                                          {b.count} colis livré{b.count > 1 ? "s" : ""} •{" "}
                                          {b.commune}
                                        </Text>
                                      </View>
                                    </View>
                                    <View style={merchantAccountingStyles.otherRight}>
                                      <Text style={merchantAccountingStyles.otherAmount}>
                                        {Formatters.formatNumber(b.due)} FCFA
                                      </Text>
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <TouchableOpacity
                                          style={[
                                            merchantAccountingStyles.reverseButton,
                                            focus?.merchantId === b.merchantId &&
                                              merchantAccountingStyles.reverseButtonActive,
                                          ]}
                                          onPress={() => selectFocus(b.merchantId)}
                                        >
                                          <Text
                                            style={[
                                              merchantAccountingStyles.reverseButtonText,
                                              focus?.merchantId === b.merchantId &&
                                                merchantAccountingStyles.reverseButtonTextActive,
                                            ]}
                                          >
                                            Reverser
                                          </Text>
                                          <MaterialIcons
                                            name="arrow-forward"
                                            size={15}
                                            color={
                                              focus?.merchantId === b.merchantId
                                                ? "#FFFFFF"
                                                : COLORS.primary
                                            }
                                          />
                                        </TouchableOpacity>
                                        <MaterialIcons
                                          name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                                          size={20}
                                          color={COLORS.muted}
                                        />
                                      </View>
                                    </View>
                                  </View>
                                </TouchableOpacity>
                                {open && renderDeliveryRows(b)}
                              </View>
                            );
                          })}
                      </>
                    )}
                  </>
                )}

                {/* ============ PAR COMMERÇANT ============ */}
                {viewMode === "merchants" && (
                  <>
                    {balances.length === 0 ? (
                      <View style={merchantAccountingStyles.emptyCard}>
                        <MaterialIcons name="store" size={44} color={COLORS.muted} />
                        <Text style={merchantAccountingStyles.emptyText}>
                          Aucun commerçant pour le moment.
                        </Text>
                      </View>
                    ) : (
                      balances.map((b) => {
                        const open = expandedIds.includes(`m${b.merchantId}`);
                        return (
                          <View
                            key={b.merchantId}
                            style={[
                              merchantAccountingStyles.otherCard,
                              { flexDirection: "column", alignItems: "stretch" },
                            ]}
                          >
                            <TouchableOpacity
                              onPress={() => toggleExpanded(`m${b.merchantId}`)}
                              activeOpacity={0.8}
                              accessibilityLabel={`Détail ${b.name}`}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <View style={merchantAccountingStyles.otherLeft}>
                                  <View
                                    style={[
                                      merchantAccountingStyles.otherAvatar,
                                      {
                                        backgroundColor:
                                          b.due > 0 ? "#FEF3C7" : COLORS.successSoft,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 17,
                                        fontWeight: "800",
                                        color:
                                          b.due > 0
                                            ? "#92400E"
                                            : COLORS.successText,
                                      }}
                                    >
                                      {b.name.charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text
                                      style={merchantAccountingStyles.merchantName}
                                      numberOfLines={1}
                                    >
                                      {b.name}
                                    </Text>
                                    <Text style={merchantAccountingStyles.merchantSub} numberOfLines={1}>
                                      {b.count} colis • {b.commune}
                                    </Text>
                                  </View>
                                </View>
                                <View style={merchantAccountingStyles.otherRight}>
                                  {b.due > 0 ? (
                                    <>
                                      <Text style={merchantAccountingStyles.otherAmount}>
                                        {Formatters.formatNumber(b.due)} FCFA
                                      </Text>
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <TouchableOpacity
                                          style={merchantAccountingStyles.reverseButton}
                                          onPress={() => {
                                            selectFocus(b.merchantId);
                                            setViewMode("pending");
                                          }}
                                        >
                                          <Text style={merchantAccountingStyles.reverseButtonText}>
                                            Reverser
                                          </Text>
                                          <MaterialIcons
                                            name="arrow-forward"
                                            size={15}
                                            color={COLORS.primary}
                                          />
                                        </TouchableOpacity>
                                        <MaterialIcons
                                          name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                                          size={20}
                                          color={COLORS.muted}
                                        />
                                      </View>
                                    </>
                                  ) : (
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 6,
                                      }}
                                    >
                                      <View style={merchantAccountingStyles.securePill}>
                                        <MaterialIcons
                                          name="check-circle"
                                          size={14}
                                          color={COLORS.successText}
                                        />
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontWeight: "800",
                                            color: COLORS.successText,
                                          }}
                                        >
                                          Soldé
                                        </Text>
                                      </View>
                                      <MaterialIcons
                                        name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                                        size={20}
                                        color={COLORS.muted}
                                      />
                                    </View>
                                  )}
                                </View>
                              </View>
                            </TouchableOpacity>
                            {open && (
                              <View style={merchantAccountingStyles.expandedBox}>
                                <View style={merchantAccountingStyles.financeLine}>
                                  <Text style={merchantAccountingStyles.financeLabel}>
                                    Total collecté
                                  </Text>
                                  <Text style={merchantAccountingStyles.financeValue}>
                                    {Formatters.formatNumber(b.collected)} FCFA
                                  </Text>
                                </View>
                                <View style={merchantAccountingStyles.financeLine}>
                                  <Text style={merchantAccountingStyles.financeLabel}>
                                    Déjà versé (reçus)
                                  </Text>
                                  <Text
                                    style={[
                                      merchantAccountingStyles.financeValue,
                                      { color: COLORS.successText },
                                    ]}
                                  >
                                    {Formatters.formatNumber(b.settledLifetime)} FCFA
                                  </Text>
                                </View>
                                <View style={merchantAccountingStyles.financeLine}>
                                  <Text style={merchantAccountingStyles.financeLabel}>
                                    Reste à reverser
                                  </Text>
                                  <Text
                                    style={[
                                      merchantAccountingStyles.financeValue,
                                      { color: "#92400E" },
                                    ]}
                                  >
                                    {Formatters.formatNumber(b.due)} FCFA
                                  </Text>
                                </View>
                                {renderDeliveryRows(b)}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </>
                )}

                {/* ============ HISTORIQUE ============ */}
                {viewMode === "history" && (
                  <View style={merchantAccountingStyles.card}>
                    <Text style={merchantAccountingStyles.merchantName}>
                      Historique
                    </Text>
                    <Text style={merchantAccountingStyles.merchantSub}>
                      Reçus de versement et colis sans reversement, du plus
                      récent.
                    </Text>
                    {historyItems.length === 0 ? (
                      <Text style={merchantAccountingStyles.merchantSub}>
                        Rien pour le moment. Les reçus et colis soldés
                        apparaîtront ici.
                      </Text>
                    ) : (
                      historyItems.map((item) =>
                        item.kind === "receipt"
                          ? renderReceiptRow(item.receipt)
                          : renderParcelRow(item.parcel),
                      )
                    )}
                  </View>
                )}

                {/* Partager le récapitulatif */}
                {totalDue > 0 && (
                  <TouchableOpacity
                    style={merchantAccountingStyles.shareButton}
                    onPress={handleShareSummary}
                    disabled={isSharing}
                    activeOpacity={0.9}
                  >
                    {isSharing ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <MaterialIcons name="share" size={20} color={COLORS.primary} />
                    )}
                    <Text style={merchantAccountingStyles.shareButtonText}>
                      Partager le reçu récapitulatif (WhatsApp / Image)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        </TutorialScrollRegistrar>

        <TutorialOverlay
          visible={isTutorialVisible}
          tutorial={tutorial}
          currentStep={tutorialStep}
          onNext={tutorialNext}
          onPrev={tutorialPrev}
          onClose={tutorialClose}
        />
      </View>
    </TutorialProvider>
  );
}
