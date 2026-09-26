import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Modal,
  FlatList,
  Linking,
  Share,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useEffect, useState, useCallback, useMemo } from "react";
import { router, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import DateTimePicker from "@react-native-community/datetimepicker";
import { deliveriesStyles } from "../styles/deliveriesStyles";
import { COLORS } from "../styles/colors";
import { useModal } from "../providers/ModalProvider";
import { sendDeliveryCompletedNotification } from "../src/services/notification.service";
import { NotificationStore } from "../src/services/notification.store";
import { useAuth } from "../src/context/AuthContext";
import { useSync } from "../src/hooks/useSync";
import { DeliveryRepository } from "../src/repositories/delivery.repository";
import { MerchantRepository } from "../src/repositories/merchant.repository";
import { DeliveryService } from "../src/services/delivery.service";
import { Formatters } from "../src/utils/formatters";
import { openItinerary } from "../src/utils/navigation";
import { Delivery, DeliveryStatus } from "../src/types";
import { useTutorial } from "../src/hooks/useTutorial";
import TutorialOverlay from "../components/TutorialOverlay";
import { TutorialProvider } from "../src/context/TutorialContext";
import TutorialTarget from "../components/TutorialTarget";
import ProfileAvatar from "../components/ProfileAvatar";

type PeriodKey = "today" | "week" | "month" | "custom";
type StatusFilter = "ALL" | DeliveryStatus;
type SortMode = "recent" | "oldest" | "amount";

// Encaissement attendu selon le mode (mêmes formules que la création)
function expectedCollect(d: Delivery): number {
  switch (d.payment_type) {
    case "CLIENT_PAYE_TOUT":
      return (d.parcel_value ?? 0) + d.delivery_fee;
    case "CLIENT_PAYE_LIVRAISON":
      return d.delivery_fee;
    case "LIVRAISON_DEJA_PAYEE":
      return d.parcel_value ?? 0;
    case "COLIS_DEJA_PAYE":
      return 0;
    default:
      return d.amount_collected ?? d.delivery_fee;
  }
}

function gainNet(d: Delivery): number {
  return typeof d.profit === "number" ? d.profit : d.delivery_fee;
}

function merchantInitials(name: string): string {
  const parts = (name || "").split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "DL";
  return parts.map((w) => w.charAt(0)).join("").toUpperCase() || "DL";
}

function formatHour(iso?: string): string {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export default function Deliveries() {
  const { user } = useAuth();
  const { showSuccess, showError, showAlert } = useModal();
  const { markAndSync } = useSync();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [merchantNames, setMerchantNames] = useState<Record<number, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [customDay, setCustomDay] = useState<Date | null>(null);
  const [customMonth, setCustomMonth] = useState<Date | null>(null);
  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [sheetMode, setSheetMode] = useState<"day" | "month">("month");
  const [sheetYear, setSheetYear] = useState(() => new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [showSortModal, setShowSortModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modales Valider / Annuler
  const [deliverTarget, setDeliverTarget] = useState<Delivery | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Delivery | null>(null);
  const [cancelMotif, setCancelMotif] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Header
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [userName, setUserName] = useState("Livreur");

  const {
    isVisible: isTutorialVisible,
    currentStep: tutorialStep,
    tutorial,
    nextStep: tutorialNext,
    prevStep: tutorialPrev,
    closeTutorial: tutorialClose,
    showTutorial: tutorialShow,
  } = useTutorial("deliveries");

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

  const loadAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [list, merchants] = await Promise.all([
        DeliveryRepository.findAll({ userId: user.id }),
        MerchantRepository.findAll().catch(() => []),
      ]);
      setDeliveries(list);
      const map: Record<number, string> = {};
      merchants.forEach((m) => {
        map[m.id] = m.name;
      });
      setMerchantNames(map);
      setUnreadCount(await NotificationStore.countUnread(user.id).catch(() => 0));
    } catch (e) {
      console.error("❌ Erreur chargement livraisons:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const merchantOf = useCallback(
    (d: Delivery) =>
      (d.merchant_id != null && merchantNames[d.merchant_id]) ||
      "Particulier",
    [merchantNames],
  );

  const orderRef = useCallback(
    (d: Delivery) => `#${merchantInitials(merchantOf(d))}-${d.id}`,
    [merchantOf],
  );

  // ---------- Filtrage multi-critères ----------
  const inPeriod = useCallback(
    (d: Delivery): boolean => {
      const ref = d.status === "LIVREE" ? d.delivered_at || d.created_at : d.created_at;
      let dt: Date;
      try {
        dt = new Date(ref);
        if (Number.isNaN(+dt)) return false;
      } catch {
        return false;
      }
      const now = new Date();
      if (period === "today") {
        return dt.toDateString() === now.toDateString();
      }
      if (period === "custom") {
        // Mois entier : tout le mois sélectionné
        if (customMonth) {
          return (
            dt.getFullYear() === customMonth.getFullYear() &&
            dt.getMonth() === customMonth.getMonth()
          );
        }
        // Jour précis
        if (customDay) return dt.toDateString() === customDay.toDateString();
        return true;
      }
      const start = startOfDay(now);
      if (period === "week") {
        const day = start.getDay();
        const monday = new Date(start);
        monday.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
        return dt >= monday;
      }
      // month
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return dt >= first;
    },
    [period, customDay, customMonth],
  );

  const matchesSearch = useCallback(
    (d: Delivery): boolean => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const ref = orderRef(d).toLowerCase();
      return (
        d.recipient_name.toLowerCase().includes(q) ||
        (d.phone || "").toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        merchantOf(d).toLowerCase().includes(q) ||
        ref.includes(q) ||
        String(d.id).includes(q)
      );
    },
    [searchQuery, merchantOf, orderRef],
  );

  const periodList = useMemo(
    () => deliveries.filter((d) => inPeriod(d) && matchesSearch(d)),
    [deliveries, inPeriod, matchesSearch],
  );

  const counts = useMemo(
    () => ({
      all: periodList.length,
      aLivrer: periodList.filter((d) => d.status === "A_LIVRER").length,
      livrees: periodList.filter((d) => d.status === "LIVREE").length,
      annulees: periodList.filter((d) => d.status === "ANNULEE").length,
    }),
    [periodList],
  );

  const sorted = useCallback(
    (list: Delivery[]): Delivery[] => {
      const arr = [...list];
      if (sortMode === "oldest")
        arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      else if (sortMode === "amount")
        arr.sort((a, b) => expectedCollect(b) - expectedCollect(a));
      else arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return arr;
    },
    [sortMode],
  );

  const aLivrer = useMemo(
    () => sorted(periodList.filter((d) => d.status === "A_LIVRER")),
    [periodList, sorted],
  );
  const livrees = useMemo(
    () => sorted(periodList.filter((d) => d.status === "LIVREE")),
    [periodList, sorted],
  );
  const annulees = useMemo(
    () => sorted(periodList.filter((d) => d.status === "ANNULEE")),
    [periodList, sorted],
  );

  const gains = useMemo(
    () => livrees.reduce((s, d) => s + gainNet(d), 0),
    [livrees],
  );
  const forecast = useMemo(
    () =>
      aLivrer.reduce((s, d) => s + expectedCollect(d), 0) +
      livrees.reduce((s, d) => s + (d.amount_collected ?? expectedCollect(d)), 0),
    [aLivrer, livrees],
  );

  // ---------- Actions ----------
  const openGPS = useCallback(
    (address: string) => {
      // App GPS par défaut choisie dans Profil & Préférences
      openItinerary(address).catch(() =>
        showError("Erreur", "Impossible d'ouvrir l'itinéraire GPS."),
      );
    },
    [showError],
  );

  const callPhone = useCallback(
    (phone?: string) => {
      if (!phone) {
        showAlert("Téléphone indisponible", "Aucun numéro pour ce client.");
        return;
      }
      Linking.openURL(`tel:${phone.replace(/\s/g, "")}`).catch(() =>
        showError("Erreur", "Impossible de lancer l'appel."),
      );
    },
    [showAlert, showError],
  );

  const confirmDeliver = useCallback(async () => {
    if (!deliverTarget || !user) return;
    setIsDelivering(true);
    try {
      await DeliveryService.markAsDelivered(user.id, deliverTarget.id);
      await markAndSync("deliveries", deliverTarget.id);
      await sendDeliveryCompletedNotification(
        user.id,
        gainNet(deliverTarget),
      ).catch(() => {});
      setDeliverTarget(null);
      showSuccess("Succès", "Livraison validée ✅");
      await loadAll();
    } catch (e) {
      console.error("❌ Erreur validation:", e);
      showError("Erreur", "Impossible de valider la livraison.");
    } finally {
      setIsDelivering(false);
    }
  }, [deliverTarget, user, markAndSync, loadAll, showSuccess, showError]);

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget || !user) return;
    setIsCancelling(true);
    try {
      const motif = cancelMotif.trim();
      if (motif) {
        await DeliveryRepository.update(cancelTarget.id, {
          notes: motif,
          needs_sync: 1,
        });
      }
      await DeliveryService.cancelDelivery(user.id, cancelTarget.id);
      await markAndSync("deliveries", cancelTarget.id);
      setCancelTarget(null);
      setCancelMotif("");
      showSuccess("Succès", "Course annulée.");
      await loadAll();
    } catch (e) {
      console.error("❌ Erreur annulation:", e);
      showError("Erreur", "Impossible d'annuler la course.");
    } finally {
      setIsCancelling(false);
    }
  }, [cancelTarget, cancelMotif, user, markAndSync, loadAll, showSuccess, showError]);

  const shareReceipt = useCallback(async (d: Delivery) => {
    const expected = expectedCollect(d);
    const collected = d.amount_collected ?? expected;
    const ecart = Math.round(collected - expected);
    const lines = [
      `🧾 DELYGEST — Reçu de livraison`,
      `━━━━━━━━━━━━━━━`,
      `👤 Client : ${d.recipient_name}`,
      `🏪 Marchand : ${merchantOf(d)}`,
      `📍 ${d.address}`,
      `💰 Encaissé : ${Formatters.formatNumber(Math.round(collected))} FCFA`,
      ...(ecart !== 0
        ? [
            `⚠️ Écart : ${ecart > 0 ? "+" : "−"}${Formatters.formatNumber(Math.abs(ecart))} F${d.notes ? ` (${d.notes})` : ""}`,
          ]
        : []),
      `📅 ${formatHour(d.delivered_at || d.created_at)}`,
      `Merci pour ta confiance ✔️`,
    ];
    try {
      await Share.share({ message: lines.join("\n"), title: `Reçu ${d.recipient_name}` });
    } catch {
      /* partage annulé */
    }
  }, [merchantOf]);

  const applyDay = useCallback((date?: Date) => {
    if (date) {
      setCustomDay(date);
      setCustomMonth(null);
      setPeriod("custom");
    }
    setShowPeriodSheet(false);
  }, []);

  const applyMonth = useCallback((year: number, month: number) => {
    setCustomMonth(new Date(year, month, 1));
    setCustomDay(null);
    setPeriod("custom");
    setShowPeriodSheet(false);
  }, []);

  const openPeriodSheet = useCallback(() => {
    const ref = customMonth || customDay || new Date();
    setSheetYear(ref.getFullYear());
    setSheetMode(customDay && !customMonth ? "day" : "month");
    setShowPeriodSheet(true);
  }, [customMonth, customDay]);

  const clearCustomPeriod = useCallback(() => {
    setCustomDay(null);
    setCustomMonth(null);
    setPeriod("today");
    setShowPeriodSheet(false);
  }, []);

  const periodLabel = useMemo(() => {
    if (period === "custom" && customMonth) {
      try {
        const s = customMonth.toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        });
        return s.charAt(0).toUpperCase() + s.slice(1);
      } catch {
        return "Mois";
      }
    }
    if (period === "custom" && customDay) {
      try {
        return customDay.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        });
      } catch {
        return "Jour";
      }
    }
    return null;
  }, [period, customDay, customMonth]);

  const MONTH_SHORT = useMemo(
    () => ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"],
    [],
  );

  // ---------- Rendu cartes ----------
  const payVariant = (d: Delivery) => {
    switch (d.payment_type) {
      case "CLIENT_PAYE_LIVRAISON":
        return {
          badge: "Frais seuls",
          bg: "#DBEAFE",
          fg: "#00476E",
          collectLabel: "À Encaisser (Livraison)",
          action: "Encaisser & Livrer",
          actionIcon: "check" as const,
          actionSoft: false,
        };
      case "LIVRAISON_DEJA_PAYEE":
        return {
          badge: "Colis seul",
          bg: "#FFEDD5",
          fg: "#92400E",
          collectLabel: "À Encaisser (Colis)",
          action: "Encaisser & Livrer",
          actionIcon: "check" as const,
          actionSoft: false,
        };
      case "COLIS_DEJA_PAYE":
        return {
          badge: "100% Prépayé",
          bg: "#D1FAE5",
          fg: "#065F46",
          collectLabel: "Rien à encaisser",
          action: "Confirmer remise colis",
          actionIcon: "inventory-2" as const,
          actionSoft: true,
        };
      default:
        return {
          badge: null as string | null,
          bg: "",
          fg: "",
          collectLabel: "À Encaisser (Cash)",
          action: "Valider la livraison",
          actionIcon: "check-circle" as const,
          actionSoft: false,
        };
    }
  };

  const renderTourneeCard = (d: Delivery) => {
    const v = payVariant(d);
    const collect = expectedCollect(d);
    const gain = gainNet(d);
    const isPrepaid = d.payment_type === "COLIS_DEJA_PAYE";
    return (
      <TouchableOpacity
        key={d.id}
        style={deliveriesStyles.deliveryCard}
        onPress={() => router.push(`/delivery/${d.id}`)}
        onLongPress={() => {
          setCancelTarget(d);
          setCancelMotif(d.notes || "");
        }}
        activeOpacity={0.9}
      >
        <View style={deliveriesStyles.cardTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={deliveriesStyles.clientRow}>
              <Text style={deliveriesStyles.clientName} numberOfLines={1}>
                {d.recipient_name}
              </Text>
              <View style={deliveriesStyles.refPill}>
                <Text style={deliveriesStyles.refText}>{orderRef(d)}</Text>
              </View>
            </View>
            <Text style={deliveriesStyles.merchantLine} numberOfLines={1}>
              Marchand :{" "}
              <Text style={deliveriesStyles.merchantStrong}>{merchantOf(d)}</Text>
            </Text>
          </View>
          <View style={deliveriesStyles.horaireBox}>
            {v.badge ? (
              <Text style={[deliveriesStyles.payBadge, { backgroundColor: v.bg, color: v.fg }]}>
                {v.badge}
              </Text>
            ) : (
              <>
                <View style={deliveriesStyles.horairePill}>
                  <MaterialIcons name="schedule" size={13} color="#92400E" />
                  <Text style={deliveriesStyles.horaireText}>
                    {formatHour(d.created_at)}
                  </Text>
                </View>
                <Text style={deliveriesStyles.horaireSub}>
                  {Formatters.formatRelativeTime(d.created_at)}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={deliveriesStyles.addressBox}>
          <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={deliveriesStyles.addressMain} numberOfLines={1}>
              {d.address || "Adresse non spécifiée"}
            </Text>
            {d.phone ? (
              <Text style={deliveriesStyles.addressSub} numberOfLines={1}>
                {d.phone}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={deliveriesStyles.gpsButton}
            onPress={() => openGPS(d.address)}
            accessibilityLabel="Itinéraire GPS"
          >
            <MaterialIcons name="directions" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={deliveriesStyles.financeRow}>
          <View>
            <Text style={deliveriesStyles.financeLabel}>{v.collectLabel}</Text>
            <Text
              style={[
                deliveriesStyles.financeAmount,
                isPrepaid && deliveriesStyles.financeAmountMuted,
              ]}
            >
              {Formatters.formatNumber(collect)} FCFA
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[deliveriesStyles.financeLabel, deliveriesStyles.financeLabelGain]}>
              {isPrepaid ? "Gain garanti" : "Ton Gain"}
            </Text>
            <Text style={[deliveriesStyles.financeAmount, deliveriesStyles.financeAmountGain]}>
              +{Formatters.formatNumber(gain)} FCFA
            </Text>
          </View>
        </View>

        <View style={deliveriesStyles.actionsRow}>
          <TouchableOpacity
            style={deliveriesStyles.callButton}
            onPress={() => callPhone(d.phone)}
            accessibilityLabel={`Appeler ${d.recipient_name}`}
          >
            <MaterialIcons name="call" size={22} color={COLORS.infoText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[deliveriesStyles.mainAction, v.actionSoft && deliveriesStyles.mainActionSoft]}
            onPress={() => setDeliverTarget(d)}
            activeOpacity={0.9}
          >
            <MaterialIcons
              name={v.actionIcon}
              size={20}
              color={v.actionSoft ? COLORS.white : "#FFFFFF"}
            />
            <Text
              style={[deliveriesStyles.mainActionText, v.actionSoft && deliveriesStyles.mainActionTextDark]}
            >
              {v.action}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDeliveredCard = (d: Delivery) => {
    const expected = expectedCollect(d);
    const collected = d.amount_collected ?? expected;
    const ecart = Math.round(collected - expected);
    return (
      <TouchableOpacity
        key={d.id}
        style={deliveriesStyles.deliveryCard}
        onPress={() => router.push(`/delivery/${d.id}`)}
        activeOpacity={0.9}
      >
        <View style={deliveriesStyles.cardTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={deliveriesStyles.clientRow}>
              <Text style={deliveriesStyles.clientName} numberOfLines={1}>
                {d.recipient_name}
              </Text>
              <View style={deliveriesStyles.refPill}>
                <Text style={deliveriesStyles.refText}>{orderRef(d)}</Text>
              </View>
            </View>
            <Text style={deliveriesStyles.merchantLine} numberOfLines={1}>
              {d.address || "Adresse non spécifiée"} •{" "}
              <Text style={deliveriesStyles.deliveredTime}>
                {formatHour(d.delivered_at || d.created_at)}
              </Text>
            </Text>
          </View>
          <Text style={[deliveriesStyles.payBadge, { backgroundColor: COLORS.successSoft, color: COLORS.successText }]}>
            ✓ Livrée
          </Text>
        </View>

        {ecart !== 0 ? (
          <View style={deliveriesStyles.ecartBox}>
            <View style={deliveriesStyles.ecartLeft}>
              <Text style={deliveriesStyles.ecartAmount}>
                {Formatters.formatNumber(collected)} FCFA
              </Text>
              <Text style={deliveriesStyles.ecartPill}>
                Écart {ecart > 0 ? "+" : "−"}
                {Formatters.formatNumber(Math.abs(ecart))} F
              </Text>
            </View>
            <Text style={deliveriesStyles.ecartMotif} numberOfLines={1}>
              {d.notes || "Écart de caisse"}
            </Text>
          </View>
        ) : (
          <View style={deliveriesStyles.ecartBox}>
            <View style={deliveriesStyles.ecartLeft}>
              <Text style={deliveriesStyles.financeLabel}>Encaissé :</Text>
              <Text style={deliveriesStyles.ecartAmount}>
                {Formatters.formatNumber(collected)} FCFA
              </Text>
            </View>
            <View style={deliveriesStyles.ecartLeft}>
              <Text style={deliveriesStyles.financeLabel}>Gain net :</Text>
              <Text style={[deliveriesStyles.ecartAmount, { color: COLORS.primary }]}>
                +{Formatters.formatNumber(gainNet(d))} FCFA
              </Text>
            </View>
          </View>
        )}

        <View style={deliveriesStyles.financeRow}>
          <Text style={deliveriesStyles.merchantLine} numberOfLines={1}>
            Marchand :{" "}
            <Text style={deliveriesStyles.merchantStrong}>{merchantOf(d)}</Text>
          </Text>
          <TouchableOpacity
            style={deliveriesStyles.receiptButton}
            onPress={() => shareReceipt(d)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="share" size={15} color={COLORS.primary} />
            <Text style={deliveriesStyles.receiptButtonText}>Reçu WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCancelledCard = (d: Delivery) => (
    <TouchableOpacity
      key={d.id}
      style={[deliveriesStyles.deliveryCard, deliveriesStyles.deliveryCardCancelled]}
      onPress={() => router.push(`/delivery/${d.id}`)}
      activeOpacity={0.7}
    >
      <View style={deliveriesStyles.cardTopRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={deliveriesStyles.clientRow}>
            <Text style={deliveriesStyles.clientName} numberOfLines={1}>
              {d.recipient_name}
            </Text>
            <View style={deliveriesStyles.refPill}>
              <Text style={deliveriesStyles.refText}>{orderRef(d)}</Text>
            </View>
          </View>
          <Text style={deliveriesStyles.merchantLine} numberOfLines={1}>
            {d.address || "Adresse non spécifiée"}
          </Text>
        </View>
        <Text style={[deliveriesStyles.payBadge, { backgroundColor: COLORS.dangerSoft, color: COLORS.danger }]}>
          ✕ Annulée
        </Text>
      </View>
      <View style={deliveriesStyles.motifBox}>
        <MaterialIcons name="phone-missed" size={18} color={COLORS.muted} />
        <Text style={deliveriesStyles.motifText} numberOfLines={2}>
          Motif : {d.notes || "Motif non renseigné"}
        </Text>
      </View>
      <View style={deliveriesStyles.returnLine}>
        <Text style={deliveriesStyles.returnText} numberOfLines={1}>
          Colis à ramener à {merchantOf(d)}
        </Text>
        <Text style={deliveriesStyles.returnAmount}>0 FCFA</Text>
      </View>
    </TouchableOpacity>
  );

  // ---------- FlatList ----------
  type Item =
    | { type: "tournee-head"; key: string }
    | { type: "card"; key: string; delivery: Delivery }
    | { type: "livrees-head"; key: string }
    | { type: "incidents-head"; key: string }
    | { type: "summary"; key: string }
    | { type: "empty"; key: string };

  const items: Item[] = useMemo(() => {
    const list: Item[] = [];
    const showTournee = statusFilter === "ALL" || statusFilter === "A_LIVRER";
    const showLivrees = statusFilter === "ALL" || statusFilter === "LIVREE";
    const showIncidents = statusFilter === "ALL" || statusFilter === "ANNULEE";
    if (showTournee) {
      list.push({ type: "tournee-head", key: "h-tournee" });
      aLivrer.forEach((d) => list.push({ type: "card", key: `c-${d.id}`, delivery: d }));
    }
    if (showLivrees) {
      list.push({ type: "livrees-head", key: "h-livrees" });
      livrees.forEach((d) => list.push({ type: "card", key: `c-${d.id}`, delivery: d }));
    }
    if (showIncidents) {
      list.push({ type: "incidents-head", key: "h-incidents" });
      annulees.forEach((d) => list.push({ type: "card", key: `c-${d.id}`, delivery: d }));
    }
    if (counts.all === 0) list.push({ type: "empty", key: "empty" });
    else list.push({ type: "summary", key: "summary" });
    return list;
  }, [statusFilter, aLivrer, livrees, annulees, counts.all]);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.type === "tournee-head") {
        return (
          <View style={deliveriesStyles.sectionHead}>
            <View style={deliveriesStyles.sectionTitleRow}>
              <View style={[deliveriesStyles.sectionDot, { backgroundColor: "#D97706" }]} />
              <Text style={deliveriesStyles.sectionTitle}>En cours de tournée</Text>
            </View>
            <Text style={[deliveriesStyles.sectionBadge, { backgroundColor: "#FEF3C7", color: "#92400E" }]}>
              {aLivrer.length} à déposer
            </Text>
          </View>
        );
      }
      if (item.type === "livrees-head") {
        return (
          <View style={deliveriesStyles.sectionHead}>
            <View style={deliveriesStyles.sectionTitleRow}>
              <MaterialIcons name="task-alt" size={19} color={COLORS.primary} />
              <Text style={deliveriesStyles.sectionTitle}>Livrées avec succès</Text>
            </View>
            <Text style={[deliveriesStyles.sectionBadge, { backgroundColor: COLORS.successSoft, color: COLORS.successText }]}>
              {livrees.length} validées
            </Text>
          </View>
        );
      }
      if (item.type === "incidents-head") {
        return (
          <View style={deliveriesStyles.sectionHead}>
            <View style={deliveriesStyles.sectionTitleRow}>
              <MaterialIcons name="error-outline" size={19} color={COLORS.muted} />
              <Text style={deliveriesStyles.sectionTitle}>Incidents & Retours</Text>
            </View>
            <Text style={[deliveriesStyles.sectionBadge, { backgroundColor: "#E2E7FF", color: COLORS.muted }]}>
              {annulees.length} course{annulees.length > 1 ? "s" : ""}
            </Text>
          </View>
        );
      }
      if (item.type === "summary") {
        return (
          <View style={deliveriesStyles.summaryCard}>
            <Text style={deliveriesStyles.summaryText}>
              {counts.all} livraison{counts.all > 1 ? "s" : ""} au total enregistrée
              {counts.all > 1 ? "s" : ""} sur la période
            </Text>
            <Text style={deliveriesStyles.summaryAmount}>
              {Formatters.formatNumber(forecast)} FCFA{" "}
              <Text style={deliveriesStyles.summarySub}>
                de chiffre d&apos;affaires prévisionnel
              </Text>
            </Text>
          </View>
        );
      }
      if (item.type === "empty") {
        return (
          <View style={deliveriesStyles.emptyCard}>
            <MaterialIcons name="local-shipping" size={40} color={COLORS.muted} />
            <Text style={deliveriesStyles.emptyText}>
              Aucune course sur cette période.{"\n"}Ajoute une livraison ou modifie
              les filtres.
            </Text>
          </View>
        );
      }
      const d = item.delivery;
      if (d.status === "A_LIVRER") return renderTourneeCard(d);
      if (d.status === "LIVREE") return renderDeliveredCard(d);
      return renderCancelledCard(d);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aLivrer, livrees, annulees, counts, forecast, merchantNames, searchQuery, sortMode],
  );

  const keyExtractor = useCallback((item: Item) => item.key, []);

  const periodChips: { key: PeriodKey; label: string }[] = [
    { key: "today", label: "Aujourd'hui" },
    { key: "week", label: "Cette semaine" },
    { key: "month", label: "Ce mois" },
  ];

  const statusChips: { key: StatusFilter; label: string; count: number; style: object; textStyle?: object; dot?: string }[] = [
    { key: "ALL", label: "Tous", count: counts.all, style: deliveriesStyles.statusChipTous, textStyle: { color: "#FFFFFF" } },
    { key: "A_LIVRER", label: "À livrer", count: counts.aLivrer, style: deliveriesStyles.statusChipALivrer, dot: "#D97706" },
    { key: "LIVREE", label: "Livrées", count: counts.livrees, style: deliveriesStyles.statusChipLivree, dot: "#059669" },
    { key: "ANNULEE", label: "Annulées", count: counts.annulees, style: deliveriesStyles.statusChipAnnulee },
  ];

  return (
    <TutorialProvider>
      <View style={{ flex: 1, backgroundColor: "#F8F9FC" }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* En-tête */}
        <View style={deliveriesStyles.header}>
          <View style={deliveriesStyles.headerContent}>
            <View style={deliveriesStyles.brandRow}>
              <Text style={deliveriesStyles.brandName}>Delygest</Text>
              <View style={deliveriesStyles.versionPill}>
                <Text style={deliveriesStyles.versionText}>v1.0.3</Text>
              </View>
            </View>
            <View style={deliveriesStyles.headerActions}>
              <View style={deliveriesStyles.syncPill}>
                <View
                  style={[
                    deliveriesStyles.syncDot,
                    { backgroundColor: isConnected ? COLORS.primary : "#D97706" },
                  ]}
                />
                <Text style={deliveriesStyles.syncText}>
                  {isConnected ? "Sync" : "Off"}
                </Text>
              </View>
              <TouchableOpacity
                style={deliveriesStyles.notificationButton}
                onPress={() => router.push("/notifications")}
                accessibilityLabel="Notifications"
              >
                <MaterialIcons name="notifications" size={22} color={COLORS.white} />
                {unreadCount > 0 && (
                  <View style={deliveriesStyles.notifBadge}>
                    <Text style={deliveriesStyles.notifBadgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/settings")}
                accessibilityLabel="Profil"
              >
                <ProfileAvatar size={32} initial={userInitial} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={tutorialShow}
                style={deliveriesStyles.notificationButton}
                accessibilityLabel="Aide"
              >
                <MaterialIcons name="help-outline" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TutorialTarget id="list-deliveries">
          <FlatList
            style={deliveriesStyles.scrollView}
            contentContainerStyle={deliveriesStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            extraData={sortMode}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
            ListHeaderComponent={
              <>
                <View style={deliveriesStyles.titleRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={deliveriesStyles.pageTitle}>Mes Livraisons</Text>
                    <Text style={deliveriesStyles.pageSubtitle}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: COLORS.primary,
                        }}
                      />{" "}
                      {counts.all} courses •{" "}
                      <Text style={deliveriesStyles.pageSubtitleGain}>
                        {Formatters.formatNumber(gains)} FCFA
                      </Text>{" "}
                      de gains
                    </Text>
                  </View>
                  <View style={deliveriesStyles.titleActions}>
                    <TouchableOpacity
                      style={deliveriesStyles.iconButton}
                      onPress={() =>
                        showAlert("Vue carte", "La vue carte arrive très bientôt 🗺️.")
                      }
                      accessibilityLabel="Vue carte"
                    >
                      <MaterialIcons name="map" size={20} color={COLORS.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={deliveriesStyles.iconButton}
                      onPress={onRefresh}
                      accessibilityLabel="Rafraîchir"
                    >
                      <MaterialIcons name="refresh" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TutorialTarget id="input-search">
                  <View style={deliveriesStyles.searchRow}>
                    <View style={deliveriesStyles.searchBox}>
                      <MaterialIcons name="search" size={20} color={COLORS.muted} />
                      <TextInput
                        style={deliveriesStyles.searchInput}
                        placeholder="Rechercher Fatou, Cocody, #AC-88..."
                        placeholderTextColor={COLORS.placeholder}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                      />
                      {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                          <MaterialIcons name="close" size={18} color={COLORS.muted} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity
                      style={deliveriesStyles.tuneButton}
                      onPress={() => setShowSortModal(true)}
                      accessibilityLabel="Options de tri"
                    >
                      <MaterialIcons name="tune" size={22} color={COLORS.white} />
                      {sortMode !== "recent" && (
                        <View
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 9,
                            height: 9,
                            borderRadius: 5,
                            backgroundColor: COLORS.primary,
                          }}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </TutorialTarget>

                <View style={deliveriesStyles.periodRow}>
                  {periodChips.map((p) => {
                    const active = period === p.key;
                    return (
                      <TouchableOpacity
                        key={p.key}
                        style={[deliveriesStyles.periodChip, active && deliveriesStyles.periodChipActive]}
                        onPress={() => {
                          setPeriod(p.key);
                          setCustomDay(null);
                          setCustomMonth(null);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[deliveriesStyles.periodChipText, active && deliveriesStyles.periodChipTextActive]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TutorialTarget id="filter-date">
                    <TouchableOpacity
                      style={[
                        deliveriesStyles.calendarButton,
                        period === "custom" && deliveriesStyles.calendarButtonActive,
                      ]}
                      onPress={openPeriodSheet}
                      accessibilityLabel="Choisir jour ou mois"
                    >
                      <MaterialIcons
                        name="calendar-month"
                        size={18}
                        color={period === "custom" ? COLORS.primary : COLORS.muted}
                      />
                    </TouchableOpacity>
                  </TutorialTarget>
                  {periodLabel && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.primary }}>
                      {periodLabel}
                    </Text>
                  )}
                </View>

                <TutorialTarget id="tab-status">
                  <View style={deliveriesStyles.statusRow}>
                    {statusChips.map((s) => {
                      const active = statusFilter === s.key;
                      return (
                        <TouchableOpacity
                          key={s.key}
                          style={[deliveriesStyles.statusChip, s.style, active && deliveriesStyles.statusChipActive]}
                          onPress={() => setStatusFilter(s.key)}
                          activeOpacity={0.85}
                        >
                          {s.dot && (
                            <View style={[deliveriesStyles.statusDot, { backgroundColor: s.dot }]} />
                          )}
                          <Text style={[deliveriesStyles.statusChipText, s.textStyle]}>
                            {s.label}
                          </Text>
                          <Text style={deliveriesStyles.statusCount}>{s.count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </TutorialTarget>
              </>
            }
          />
        </TutorialTarget>

        {/* Feuille période : jour précis ou mois entier */}
        <Modal
          visible={showPeriodSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPeriodSheet(false)}
        >
          <View style={deliveriesStyles.sheetOverlay}>
            <View style={deliveriesStyles.sheet}>
              <View style={deliveriesStyles.dragHandle} />
              <Text style={deliveriesStyles.modalTitle}>Période personnalisée</Text>
              <View style={deliveriesStyles.sheetToggle}>
                {(
                  [
                    { key: "day", label: "Jour précis" },
                    { key: "month", label: "Mois entier" },
                  ] as { key: "day" | "month"; label: string }[]
                ).map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[
                      deliveriesStyles.sheetToggleBtn,
                      sheetMode === o.key && deliveriesStyles.sheetToggleBtnActive,
                    ]}
                    onPress={() => setSheetMode(o.key)}
                  >
                    <Text
                      style={[
                        deliveriesStyles.sheetToggleText,
                        sheetMode === o.key &&
                          deliveriesStyles.sheetToggleTextActive,
                      ]}
                    >
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {sheetMode === "day" ? (
                <DateTimePicker
                  value={customDay || new Date()}
                  mode="date"
                  display="default"
                  onChange={(_event: unknown, date?: Date) => applyDay(date)}
                />
              ) : (
                <>
                  <View style={deliveriesStyles.yearRow}>
                    <TouchableOpacity
                      style={deliveriesStyles.yearNav}
                      onPress={() => setSheetYear((y) => y - 1)}
                      accessibilityLabel="Année précédente"
                    >
                      <MaterialIcons name="chevron-left" size={24} color={COLORS.muted} />
                    </TouchableOpacity>
                    <Text style={deliveriesStyles.yearText}>{sheetYear}</Text>
                    <TouchableOpacity
                      style={deliveriesStyles.yearNav}
                      onPress={() => setSheetYear((y) => y + 1)}
                      accessibilityLabel="Année suivante"
                    >
                      <MaterialIcons name="chevron-right" size={24} color={COLORS.muted} />
                    </TouchableOpacity>
                  </View>
                  <View style={deliveriesStyles.monthGrid}>
                    {MONTH_SHORT.map((label, m) => {
                      const selected =
                        customMonth !== null &&
                        customMonth.getFullYear() === sheetYear &&
                        customMonth.getMonth() === m;
                      const isCurrent =
                        new Date().getFullYear() === sheetYear &&
                        new Date().getMonth() === m;
                      return (
                        <TouchableOpacity
                          key={label}
                          style={[
                            deliveriesStyles.monthCell,
                            selected && deliveriesStyles.monthCellActive,
                            !selected && isCurrent && deliveriesStyles.monthCellCurrent,
                          ]}
                          onPress={() => applyMonth(sheetYear, m)}
                        >
                          <Text
                            style={[
                              deliveriesStyles.monthCellText,
                              selected && deliveriesStyles.monthCellTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={deliveriesStyles.sheetClear}
                onPress={clearCustomPeriod}
              >
                <Text style={deliveriesStyles.sheetClearText}>
                  Revenir à Aujourd&apos;hui
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Tri (feuille inline : pas de Modal natif) */}
        {showSortModal && (
          <View style={deliveriesStyles.sortOverlay}>
            <TouchableOpacity
              style={deliveriesStyles.sortBackdrop}
              onPress={() => setShowSortModal(false)}
              accessibilityLabel="Fermer le tri"
              activeOpacity={1}
            />
            <View style={deliveriesStyles.modalCard}>
              <Text style={deliveriesStyles.modalTitle}>Trier les courses</Text>
              {(
                [
                  { key: "recent", label: "Plus récentes d'abord" },
                  { key: "oldest", label: "Plus anciennes d'abord" },
                  { key: "amount", label: "Montant décroissant" },
                ] as { key: SortMode; label: string }[]
              ).map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[
                    deliveriesStyles.sortOption,
                    sortMode !== o.key && deliveriesStyles.sortOptionInactive,
                  ]}
                  onPress={() => {
                    setSortMode(o.key);
                    setShowSortModal(false);
                  }}
                >
                  {sortMode === o.key && (
                    <MaterialIcons name="check-circle" size={19} color="#FFFFFF" />
                  )}
                  <Text
                    style={[
                      deliveriesStyles.mainActionText,
                      sortMode !== o.key && deliveriesStyles.mainActionTextDark,
                    ]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[deliveriesStyles.modalButton, deliveriesStyles.modalButtonCancel]}
                onPress={() => setShowSortModal(false)}
              >
                <Text style={deliveriesStyles.modalButtonTextCancel}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Valider la livraison */}
        <Modal
          visible={!!deliverTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setDeliverTarget(null)}
        >
          <View style={deliveriesStyles.modalOverlay}>
            <View style={deliveriesStyles.modalCard}>
              <Text style={deliveriesStyles.modalTitle}>Valider la livraison</Text>
              <Text style={deliveriesStyles.modalMessage}>
                Confirme la remise et l&apos;encaissement. Le statut passera à
                « Livrée ».
              </Text>
              {deliverTarget && (
                <View style={deliveriesStyles.modalSummary}>
                  <View style={deliveriesStyles.modalRow}>
                    <Text style={deliveriesStyles.modalLabel}>Client</Text>
                    <Text style={deliveriesStyles.modalValue}>
                      {deliverTarget.recipient_name}
                    </Text>
                  </View>
                  <View style={deliveriesStyles.modalRow}>
                    <Text style={deliveriesStyles.modalLabel}>À encaisser</Text>
                    <Text style={deliveriesStyles.modalValue}>
                      {Formatters.formatNumber(expectedCollect(deliverTarget))} FCFA
                    </Text>
                  </View>
                  <View style={deliveriesStyles.modalRow}>
                    <Text style={deliveriesStyles.modalLabel}>Ton gain</Text>
                    <Text style={[deliveriesStyles.modalValue, { color: COLORS.primaryDark }]}>
                      +{Formatters.formatNumber(gainNet(deliverTarget))} FCFA
                    </Text>
                  </View>
                </View>
              )}
              <View style={deliveriesStyles.modalButtons}>
                <TouchableOpacity
                  style={[deliveriesStyles.modalButton, deliveriesStyles.modalButtonCancel]}
                  onPress={() => setDeliverTarget(null)}
                  disabled={isDelivering}
                >
                  <Text style={deliveriesStyles.modalButtonTextCancel}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[deliveriesStyles.modalButton, deliveriesStyles.modalButtonPrimary]}
                  onPress={confirmDeliver}
                  disabled={isDelivering}
                >
                  {isDelivering ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={deliveriesStyles.modalButtonTextPrimary}>
                      ✓ Valider
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Annuler avec motif */}
        <Modal
          visible={!!cancelTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setCancelTarget(null)}
        >
          <View style={deliveriesStyles.modalOverlay}>
            <View style={deliveriesStyles.modalCard}>
              <Text style={deliveriesStyles.modalTitle}>Annuler la course</Text>
              <Text style={deliveriesStyles.modalMessage}>
                Indique le motif (ex : client injoignable) et l&apos;instruction
                de retour. Il restera visible dans Incidents & Retours.
              </Text>
              <TextInput
                style={[deliveriesStyles.modalInput, { minHeight: 64 }]}
                value={cancelMotif}
                onChangeText={setCancelMotif}
                placeholder="Motif : Client injoignable après 3 appels"
                placeholderTextColor={COLORS.placeholder}
                multiline
                editable={!isCancelling}
              />
              <View style={deliveriesStyles.modalButtons}>
                <TouchableOpacity
                  style={[deliveriesStyles.modalButton, deliveriesStyles.modalButtonCancel]}
                  onPress={() => {
                    setCancelTarget(null);
                    setCancelMotif("");
                  }}
                  disabled={isCancelling}
                >
                  <Text style={deliveriesStyles.modalButtonTextCancel}>Retour</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[deliveriesStyles.modalButton, deliveriesStyles.modalButtonDanger]}
                  onPress={confirmCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={deliveriesStyles.modalButtonTextPrimary}>
                      Annuler la course
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
