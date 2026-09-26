import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { router, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import NetInfo from "@react-native-community/netinfo";
import { commonStyles } from "../styles/common";
import { dashboardStyles } from "../styles/dashboardStyles";
import { COLORS } from "../styles/colors";
import { useModal } from "../providers/ModalProvider";
import {
  sendGoalAchievedNotification,
  sendDeliveryCompletedNotification,
} from "../src/services/notification.service";
import { NotificationStore } from "../src/services/notification.store";
import { useAuth } from "../src/context/AuthContext";
import { useSync } from "../src/hooks/useSync";
import { DashboardService } from "../src/services/dashboard.service";
import { DeliveryService } from "../src/services/delivery.service";
import { DeliveryRepository } from "../src/repositories/delivery.repository";
import { MerchantRepository } from "../src/repositories/merchant.repository";
import { Formatters } from "../src/utils/formatters";
import { Delivery } from "../src/types";
import { db } from "../src/database/db";
import { doc, updateDoc } from "firebase/firestore";
import { db as firestore } from "../src/config/firebase";
import { cacheInvalidate } from "../src/cache/cache";
import { useTutorial } from "../src/hooks/useTutorial";
import TutorialOverlay from "../components/TutorialOverlay";
import { TutorialProvider, useTutorialContext } from "../src/context/TutorialContext";
import TutorialTarget from "../components/TutorialTarget";
import ProfileAvatar from "../components/ProfileAvatar";

interface DashboardState {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  monthGoal: number;
  dailyGoal: number;
  dailyProgress: number;
  goalAchievedToday: boolean;
  todayDeliveries: Delivery[];
  userInitial: string;
  todayEncaisse: number;
  todayAReverser: number;
  todayProfit: number;
  pendingReversal: number;
  todayCount: number;
  trendPercent: number;
  lastGoalCheck: string;
}

const INITIAL_DASHBOARD: DashboardState = {
  todayEarnings: 0,
  weekEarnings: 0,
  monthEarnings: 0,
  monthGoal: 0,
  dailyGoal: 15000,
  dailyProgress: 0,
  goalAchievedToday: false,
  todayDeliveries: [],
  userInitial: "?",
  todayEncaisse: 0,
  todayAReverser: 0,
  todayProfit: 0,
  pendingReversal: 0,
  todayCount: 0,
  trendPercent: 0,
  lastGoalCheck: "",
};

type FilterStatus = "A_LIVRER" | "LIVREE" | "ANNULEE";

// Montant à encaisser côté client selon le type de paiement
function getEncaisserAmount(d: Delivery): number {
  switch (d.payment_type) {
    case "CLIENT_PAYE_TOUT":
      return d.delivery_fee + (d.parcel_value ?? 0);
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

function getGainNet(d: Delivery): number {
  if (typeof d.profit === "number") return d.profit;
  return d.delivery_fee ?? 0;
}

function formatTime(iso?: string): string {
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

export default function Dashboard() {
  return (
    <TutorialProvider>
      <DashboardContent />
    </TutorialProvider>
  );
}

function DashboardContent() {
  const { user, firebaseUser, refreshUser } = useAuth();
  const [data, setData] = useState<DashboardState>(INITIAL_DASHBOARD);
  const [userName, setUserName] = useState("Livreur");
  const { showAlert, showSuccess, showError } = useModal();
  const { markAndSync } = useSync();
  const goalAchievedRef = useRef(false);
  const lastGoalCheckRef = useRef("");
  const scrollRef = useRef<any>(null);
  const { registerScrollable, unregisterScrollable, setScrollOffset } =
    useTutorialContext();

  useEffect(() => {
    registerScrollable(scrollRef.current);
    return () => unregisterScrollable();
  }, [registerScrollable, unregisterScrollable]);

  // Objectif du jour
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  // Modale "Livrer & Encaisser"
  const [deliverTarget, setDeliverTarget] = useState<Delivery | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);

  // Filtre des courses
  const [filter, setFilter] = useState<FilterStatus>("A_LIVRER");

  // Sync / réseau / notifications
  const [isConnected, setIsConnected] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Noms marchands + détail reversements
  const [merchantNames, setMerchantNames] = useState<Record<number, string>>({});
  const [pendingMerchants, setPendingMerchants] = useState<
    { id: number; name: string; amount: number }[]
  >([]);

  const {
    isVisible: isTutorialVisible,
    currentStep: tutorialStep,
    tutorial,
    nextStep: tutorialNext,
    prevStep: tutorialPrev,
    closeTutorial: tutorialClose,
    showTutorial: tutorialShow,
  } = useTutorial("dashboard");

  const formattedDate = useMemo(() => {
    try {
      const s = Formatters.formatDate(new Date(), "EEE d MMM");
      return s.charAt(0).toLowerCase() + s.slice(1);
    } catch {
      return "";
    }
  }, []);

  const firstName = useMemo(
    () => (userName || "Livreur").split(" ")[0],
    [userName],
  );

  useEffect(() => {
    if (user) {
      setUserName(user.name || "Livreur");
      const initial = (user.name || "?").trim().charAt(0).toUpperCase() || "?";
      setData((prev) => ({ ...prev, userInitial: initial }));
    }
  }, [user]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    NetInfo.fetch().then((s) => setIsConnected(s.isConnected ?? true));
    return () => unsub();
  }, []);

  const getAvatarColor = (initial: string) => {
    const colors = [
      COLORS.primary,
      "#00CCBC",
      "#2D6DF6",
      "#F59E0B",
      "#8B5CF6",
      "#EC4899",
    ];
    const index = (initial.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const loadStats = useCallback(async () => {
    const todayDateStr = new Date().toDateString();
    try {
      const dashboardData = await DashboardService.getDashboardData(
        user?.id?.toString() || "1",
      );

      const wasAchieved = dashboardData.goalAchievedToday;
      const goalJustAchieved =
        wasAchieved &&
        !goalAchievedRef.current &&
        lastGoalCheckRef.current !== todayDateStr;

      if (goalJustAchieved) {
        goalAchievedRef.current = true;
        lastGoalCheckRef.current = todayDateStr;
      }
      if (!wasAchieved) {
        goalAchievedRef.current = false;
      }

      setData({
        todayEarnings: dashboardData.todayEarnings,
        weekEarnings: dashboardData.weekEarnings,
        monthEarnings: dashboardData.monthEarnings,
        monthGoal: dashboardData.monthGoal,
        dailyGoal: dashboardData.dailyGoal,
        dailyProgress: dashboardData.dailyProgress,
        goalAchievedToday: wasAchieved,
        todayDeliveries: dashboardData.todayDeliveries,
        userInitial: data.userInitial,
        todayEncaisse: dashboardData.todayEncaisse,
        todayAReverser: dashboardData.todayAReverser,
        todayProfit: dashboardData.todayProfit,
        pendingReversal: dashboardData.pendingReversal,
        todayCount: dashboardData.todayCount,
        trendPercent: dashboardData.trendPercent,
        lastGoalCheck: lastGoalCheckRef.current,
      });

      if (goalJustAchieved && user?.id) {
        await sendGoalAchievedNotification(
          user.id,
          dashboardData.todayProfit,
          dashboardData.dailyGoal,
        );
      }
    } catch (error) {
      console.error("❌ Erreur loadStats:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadMerchants = useCallback(async () => {
    try {
      const merchants = await MerchantRepository.findAll();
      const map: Record<number, string> = {};
      merchants.forEach((m) => {
        map[m.id] = m.name;
      });
      setMerchantNames(map);
    } catch (e) {
      console.error("❌ Erreur loadMerchants:", e);
    }
  }, []);

  const loadPendingDetail = useCallback(async () => {
    try {
      if (!user) return;
      const pendings = await DeliveryRepository.findPendingReversal(user.id);
      const byMerchant = new Map<number, number>();
      pendings.forEach((d) => {
        if (d.payment_type === "CLIENT_PAYE_TOUT") {
          const mid = d.merchant_id ?? 0;
          byMerchant.set(mid, (byMerchant.get(mid) ?? 0) + (d.parcel_value ?? 0));
        }
      });
      let names = merchantNames;
      if (Object.keys(names).length === 0) {
        try {
          const merchants = await MerchantRepository.findAll();
          names = {};
          merchants.forEach((m) => {
            names[m.id] = m.name;
          });
          setMerchantNames(names);
        } catch {
          /* ignore */
        }
      }
      const list = Array.from(byMerchant.entries())
        .map(([id, amount]) => ({
          id,
          name: names[id] || "Boutique partenaire",
          amount,
        }))
        .sort((a, b) => b.amount - a.amount);
      setPendingMerchants(list);
    } catch (e) {
      console.error("❌ Erreur loadPendingDetail:", e);
    }
  }, [user, merchantNames]);

  const loadUnread = useCallback(async () => {
    try {
      if (!user) return;
      const count = await NotificationStore.countUnread(user.id);
      setUnreadCount(count);
    } catch {
      /* ignore */
    }
  }, [user]);

  const reloadAll = useCallback(async () => {
    await Promise.all([
      loadStats(),
      loadMerchants(),
      loadUnread(),
    ]);
  }, [loadStats, loadMerchants, loadUnread]);

  useEffect(() => {
    reloadAll();
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, [reloadAll, loadStats]);

  useEffect(() => {
    if (user) loadPendingDetail();
  }, [user, loadPendingDetail, data.todayDeliveries.length]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
      loadUnread();
    }, [loadStats, loadUnread]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      cacheInvalidate(`dashboard:${user?.id}`);
      await reloadAll();
      await loadPendingDetail();
    } finally {
      setRefreshing(false);
    }
  }, [reloadAll, loadPendingDetail, user?.id]);

  // ---------- Dérivés maquette ----------
  const progress = Math.max(0, Math.min(data.dailyProgress || 0, 100));
  const remaining = Math.max((data.dailyGoal || 0) - (data.todayProfit || 0), 0);

  const counts = useMemo(() => {
    const list = data.todayDeliveries || [];
    return {
      aLivrer: list.filter((d) => d.status === "A_LIVRER").length,
      livrees: list.filter((d) => d.status === "LIVREE").length,
      annulees: list.filter((d) => d.status === "ANNULEE").length,
    };
  }, [data.todayDeliveries]);

  const deliveredCount = counts.livrees;
  const enCoursCount = counts.aLivrer;
  const average =
    deliveredCount > 0 ? Math.round((data.todayProfit || 0) / deliveredCount) : 0;

  const filteredDeliveries = useMemo(() => {
    const list = [...(data.todayDeliveries || [])].filter(
      (d) => d.status === filter,
    );
    // Priorité : les plus récentes d'abord, mais A_LIVRER garde l'ordre de création
    list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (filter === "A_LIVRER") list.reverse();
    return list;
  }, [data.todayDeliveries, filter]);

  const pendingCount = pendingMerchants.length;
  const pendingTotal = data.pendingReversal || 0;
  const reverserSubtitle = useMemo(() => {
    if (pendingMerchants.length === 0) return "Aucun reversement en attente";
    const fmtK = (n: number) =>
      n >= 1000 ? `${Formatters.formatNumber(Math.round(n / 1000))}k` : `${n}`;
    return pendingMerchants
      .slice(0, 3)
      .map((m) => `${m.name} (${fmtK(m.amount)})`)
      .join(" • ");
  }, [pendingMerchants]);

  // ---------- Actions ----------
  const openGoalModal = () => {
    setGoalInput(data.dailyGoal ? String(data.dailyGoal) : "");
    setShowGoalModal(true);
  };

  const saveDailyGoal = async () => {
    if (!user?.id) return;
    const numericValue = goalInput.replace(/[^0-9]/g, "");
    const newGoal = numericValue ? parseInt(numericValue, 10) : 0;
    if (newGoal <= 0) {
      showAlert("Objectif invalide", "Veuillez saisir un montant supérieur à 0.");
      return;
    }
    setIsSavingGoal(true);
    try {
      await db.runAsync(
        `UPDATE user SET daily_goal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newGoal, user.id],
      );
      if (firebaseUser) {
        try {
          const userRef = doc(firestore, "users", firebaseUser.uid);
          await updateDoc(userRef, {
            daily_goal: newGoal,
            updated_at: new Date().toISOString(),
          });
        } catch (fbError) {
          console.error("❌ Erreur synchronisation objectif Firebase:", fbError);
        }
      }
      await refreshUser();
      cacheInvalidate(`dashboard:${user.id}`);
      setData((prev) => ({
        ...prev,
        dailyGoal: newGoal,
        dailyProgress:
          prev.todayEarnings > 0 ? (prev.todayEarnings / newGoal) * 100 : 0,
        goalAchievedToday: prev.todayEarnings >= newGoal,
      }));
      setShowGoalModal(false);
      showAlert(
        "Objectif mis à jour",
        `Votre objectif du jour est maintenant de ${Formatters.formatNumber(newGoal)} FCFA.`,
        "success",
      );
    } catch (error) {
      console.error("❌ Erreur sauvegarde objectif:", error);
      showAlert(
        "Erreur",
        "Impossible de sauvegarder votre objectif. Veuillez réessayer.",
        "error",
      );
    } finally {
      setIsSavingGoal(false);
    }
  };

  const openGPS = useCallback(
    (address: string) => {
      const q = encodeURIComponent(address || "Abidjan");
      const url = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
      Linking.openURL(url).catch(() =>
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
        getGainNet(deliverTarget),
      ).catch(() => {});
      cacheInvalidate(`dashboard:${user.id}`);
      setDeliverTarget(null);
      showSuccess("Succès", "Livraison validée et encaissée ✅");
      await reloadAll();
      await loadPendingDetail();
    } catch (e) {
      console.error("❌ Erreur Livrer & Encaisser:", e);
      showError("Erreur", "Impossible de valider la livraison.");
    } finally {
      setIsDelivering(false);
    }
  }, [deliverTarget, user, markAndSync, reloadAll, loadPendingDetail, showSuccess, showError]);

  const merchantOf = useCallback(
    (d: Delivery) =>
      (d.merchant_id != null && merchantNames[d.merchant_id]) ||
      "Boutique partenaire",
    [merchantNames],
  );

  const orderRef = useCallback(
    (d: Delivery) => `#${String(d.id).padStart(3, "0")}`,
    [],
  );

  // ---------- Rendu cartes ----------
  const renderPriorityCard = (d: Delivery) => {
    const encaisser = getEncaisserAmount(d);
    const gain = getGainNet(d);
    return (
      <View key={d.id} style={dashboardStyles.deliveryCard}>
        <View style={dashboardStyles.cardTopRow}>
          <View style={dashboardStyles.cardZone}>
            <MaterialIcons name="two-wheeler" size={20} color={COLORS.primary} />
            <Text style={dashboardStyles.cardZoneText} numberOfLines={1}>
              {d.address || "Adresse non spécifiée"}
            </Text>
          </View>
          <View
            style={[
              dashboardStyles.statusBadge,
              dashboardStyles.statusBadgeALivrer,
            ]}
          >
            <View
              style={[
                dashboardStyles.statusDot,
                { backgroundColor: COLORS.warningStrong },
              ]}
            />
            <Text
              style={[dashboardStyles.statusText, { color: COLORS.warningStrong }]}
            >
              À livrer
            </Text>
          </View>
        </View>

        <View style={dashboardStyles.customerBox}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={dashboardStyles.customerName} numberOfLines={1}>
              {d.recipient_name}
            </Text>
            <View style={dashboardStyles.customerMeta}>
              <MaterialIcons name="storefront" size={14} color={COLORS.infoText} />
              <Text style={dashboardStyles.customerMetaText} numberOfLines={1}>
                <Text style={dashboardStyles.merchantText}>{merchantOf(d)}</Text>
                {"  "}• Réf {orderRef(d)}
              </Text>
            </View>
            <View style={dashboardStyles.customerMeta}>
              <MaterialIcons name="call" size={14} color={COLORS.muted} />
              <Text style={dashboardStyles.phoneText}>
                {d.phone || "N° non renseigné"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={dashboardStyles.callButton}
            onPress={() => callPhone(d.phone)}
            accessibilityLabel={`Appeler ${d.recipient_name}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="call" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={dashboardStyles.financeGrid}>
          <View
            style={[
              dashboardStyles.financeCell,
              dashboardStyles.financeCellEncaisser,
            ]}
          >
            <Text style={dashboardStyles.financeLabel}>À encaisser client</Text>
            <Text style={dashboardStyles.financeAmount}>
              {Formatters.formatNumber(encaisser)}{" "}
              <Text style={dashboardStyles.financeUnit}>FCFA</Text>
            </Text>
            <Text style={dashboardStyles.financeHint}>Colis + Course inclus</Text>
          </View>
          <View
            style={[dashboardStyles.financeCell, dashboardStyles.financeCellGain]}
          >
            <Text
              style={[dashboardStyles.financeLabel, dashboardStyles.financeLabelGain]}
            >
              Ton gain net
            </Text>
            <Text
              style={[
                dashboardStyles.financeAmount,
                dashboardStyles.financeAmountGain,
              ]}
            >
              +{Formatters.formatNumber(gain)}{" "}
              <Text style={dashboardStyles.financeUnit}>FCFA</Text>
            </Text>
            <Text
              style={[dashboardStyles.financeHint, { color: COLORS.primaryDark }]}
            >
              Rémunération directe
            </Text>
          </View>
        </View>

        <View style={dashboardStyles.actionsRow}>
          <TouchableOpacity
            style={dashboardStyles.gpsButton}
            onPress={() => openGPS(d.address)}
            accessibilityLabel="Ouvrir l'itinéraire GPS"
          >
            <MaterialIcons name="navigation" size={18} color="#FFFFFF" />
            <Text style={dashboardStyles.gpsButtonText}>Itinéraire GPS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={dashboardStyles.deliverButton}
            onPress={() => setDeliverTarget(d)}
            accessibilityLabel="Livrer et encaisser"
          >
            <MaterialIcons name="done-all" size={18} color={COLORS.primary} />
            <Text style={dashboardStyles.deliverButtonText}>
              Livrer & Encaisser
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSimpleCard = (d: Delivery) => {
    const gain = getGainNet(d);
    const encaisser = getEncaisserAmount(d);
    return (
      <View key={d.id} style={dashboardStyles.deliveryCard}>
        <View style={dashboardStyles.cardTopRow}>
          <View style={dashboardStyles.cardZone}>
            <MaterialIcons name="location-on" size={18} color={COLORS.muted} />
            <Text
              style={[dashboardStyles.cardZoneText, { fontSize: 14 }]}
              numberOfLines={1}
            >
              {d.address || "Adresse non spécifiée"}
            </Text>
          </View>
          <View
            style={[
              dashboardStyles.statusBadge,
              dashboardStyles.statusBadgeALivrer,
            ]}
          >
            <Text
              style={[dashboardStyles.statusText, { color: COLORS.warningStrong }]}
            >
              À livrer
            </Text>
          </View>
        </View>

        <View style={dashboardStyles.simpleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={dashboardStyles.customerName} numberOfLines={1}>
              {d.recipient_name}
            </Text>
            <View style={dashboardStyles.customerMeta}>
              <MaterialIcons name="inventory-2" size={14} color={COLORS.muted} />
              <Text style={dashboardStyles.customerMetaText} numberOfLines={1}>
                Colis {merchantOf(d)} ({orderRef(d)})
              </Text>
            </View>
          </View>
          <View style={dashboardStyles.simpleAmount}>
            <Text style={dashboardStyles.simpleFee}>
              {Formatters.formatNumber(encaisser)} FCFA
            </Text>
            <Text style={dashboardStyles.simpleGain}>
              Gain: +{Formatters.formatNumber(gain)} FCFA
            </Text>
          </View>
        </View>

        <View style={dashboardStyles.simpleActions}>
          <TouchableOpacity
            style={dashboardStyles.callPill}
            onPress={() => callPhone(d.phone)}
          >
            <MaterialIcons name="call" size={15} color={COLORS.white} />
            <Text style={dashboardStyles.callPillText}>Appeler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={dashboardStyles.detailsPill}
            onPress={() => router.push(`/delivery/${d.id}`)}
          >
            <Text style={dashboardStyles.detailsPillText}>
              Ouvrir les détails
            </Text>
            <MaterialIcons name="chevron-right" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDeliveredCard = (d: Delivery) => {
    const encaisser = getEncaisserAmount(d);
    return (
      <TouchableOpacity
        key={d.id}
        style={[dashboardStyles.deliveryCard, dashboardStyles.deliveryCardDelivered]}
        onPress={() => router.push(`/delivery/${d.id}`)}
        activeOpacity={0.7}
      >
        <View style={dashboardStyles.cardTopRow}>
          <View style={dashboardStyles.cardZone}>
            <MaterialIcons name="task-alt" size={18} color={COLORS.success} />
            <Text
              style={[dashboardStyles.cardZoneText, { fontSize: 14 }]}
              numberOfLines={1}
            >
              {d.address || "Adresse non spécifiée"}
            </Text>
          </View>
          <View
            style={[dashboardStyles.statusBadge, dashboardStyles.statusBadgeLivree]}
          >
            <Text style={[dashboardStyles.statusText, { color: COLORS.successText }]}>
              Livrée • {formatTime(d.delivered_at || d.created_at)}
            </Text>
          </View>
        </View>
        <View style={dashboardStyles.deliveredMeta}>
          <Text style={dashboardStyles.deliveredMetaText} numberOfLines={1}>
            {d.recipient_name} • {merchantOf(d)}
          </Text>
          <Text style={dashboardStyles.deliveredAmount}>
            Encaissé: {Formatters.formatNumber(encaisser)} FCFA
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCancelledCard = (d: Delivery) => (
    <TouchableOpacity
      key={d.id}
      style={[dashboardStyles.deliveryCard, dashboardStyles.deliveryCardDelivered]}
      onPress={() => router.push(`/delivery/${d.id}`)}
      activeOpacity={0.7}
    >
      <View style={dashboardStyles.cardTopRow}>
        <View style={dashboardStyles.cardZone}>
          <MaterialIcons name="cancel" size={18} color={COLORS.muted} />
          <Text
            style={[dashboardStyles.cardZoneText, { fontSize: 14 }]}
            numberOfLines={1}
          >
            {d.address || "Adresse non spécifiée"}
          </Text>
        </View>
        <View
          style={[dashboardStyles.statusBadge, dashboardStyles.statusBadgeAnnulee]}
        >
          <Text style={[dashboardStyles.statusText, { color: COLORS.cancelledText }]}>
            Annulée
          </Text>
        </View>
      </View>
      <View style={dashboardStyles.deliveredMeta}>
        <Text style={dashboardStyles.deliveredMetaText} numberOfLines={1}>
          {d.recipient_name} • {merchantOf(d)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[commonStyles.container, { backgroundColor: "#F8F9FC" }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* En-tête supérieur */}
      <View style={dashboardStyles.header}>
        <View style={dashboardStyles.headerContent}>
          <View style={dashboardStyles.brandRow}>
            <Text style={dashboardStyles.brandName}>Delygest</Text>
            <View style={dashboardStyles.versionPill}>
              <Text style={dashboardStyles.versionText}>v1.0.3</Text>
            </View>
          </View>
          <View style={dashboardStyles.headerActions}>
            <View style={dashboardStyles.syncPill}>
              <View
                style={[
                  dashboardStyles.syncDot,
                  { backgroundColor: isConnected ? COLORS.primary : "#D97706" },
                ]}
              />
              <Text style={dashboardStyles.syncText}>
                {isConnected ? "Sync" : "Off"}
              </Text>
            </View>
            <TouchableOpacity
              style={dashboardStyles.notificationButton}
              onPress={() => router.push("/notifications")}
              accessibilityLabel="Notifications"
            >
              <MaterialIcons name="notifications" size={22} color={COLORS.white} />
              {unreadCount > 0 && (
                <View style={dashboardStyles.notifBadge}>
                  <Text style={dashboardStyles.notifBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              accessibilityLabel="Profil"
            >
              <ProfileAvatar size={34} initial={data.userInitial} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Salutation */}
      <View style={dashboardStyles.greetingRow}>
        <View>
          <Text style={dashboardStyles.greeting}>Salut {firstName} 👋</Text>
          <Text style={dashboardStyles.greetingSub}>
            <MaterialIcons name="location-on" size={14} color={COLORS.primary} />{" "}
            {formattedDate} • Abidjan
          </Text>
        </View>
        <View
          style={[
            dashboardStyles.syncedBadge,
            !isConnected && { backgroundColor: "#FEF3C7" },
          ]}
        >
          <MaterialIcons
            name={isConnected ? "check-circle" : "cloud-off"}
            size={14}
            color={isConnected ? COLORS.successText : "#92400E"}
          />
          <Text
            style={[
              dashboardStyles.syncedText,
              !isConnected && { color: "#92400E" },
            ]}
          >
            {isConnected ? "Synchronisé" : "Hors-ligne"}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={dashboardStyles.content}
        contentContainerStyle={dashboardStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Carte Revenus du jour */}
        <TutorialTarget id="card-revenus">
          <LinearGradient
            colors={["#149A5B", "#0F6841"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dashboardStyles.heroCard}
          >
            <TutorialTarget id="btn-edit-goal">
              <View>
                <View style={dashboardStyles.heroTopRow}>
                  <Text style={dashboardStyles.heroLabel}>
                    Revenus du jour (Bénéfice)
                  </Text>
                  <View style={dashboardStyles.flashBadge}>
                    <MaterialIcons name="bolt" size={13} color="#9FF5C1" />
                    <Text style={dashboardStyles.flashText}>Flash</Text>
                  </View>
                </View>
                <Text style={dashboardStyles.heroAmount}>
                  {Formatters.formatNumber(data.todayProfit || 0)}{" "}
                  <Text style={dashboardStyles.heroCurrency}>FCFA</Text>
                </Text>
                <View style={dashboardStyles.heroProgressRow}>
                  <Text style={dashboardStyles.heroProgressLabel}>
                    Progression globale
                  </Text>
                  <TouchableOpacity onPress={openGoalModal} activeOpacity={0.8}>
                    <Text style={dashboardStyles.heroProgressValue}>
                      {Formatters.formatNumber(data.todayProfit || 0)} /{" "}
                      {Formatters.formatNumber(data.dailyGoal || 0)} FCFA (
                      {progress.toFixed(0)}%)
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={dashboardStyles.progressTrack}>
                  <View
                    style={[
                      dashboardStyles.progressFill,
                      { width: `${progress}%` },
                    ]}
                  />
                </View>
                <View style={dashboardStyles.heroDivider} />
                {progress >= 100 ? (
                  <View style={dashboardStyles.goalAchievedBadge}>
                    <MaterialIcons name="emoji-events" size={16} color="#FFFFFF" />
                    <Text style={dashboardStyles.goalAchievedText}>
                      Objectif atteint ! 🎉
                    </Text>
                  </View>
                ) : (
                  <Text style={dashboardStyles.heroMotivation}>
                    Plus que{" "}
                    <Text style={dashboardStyles.heroMotivationStrong}>
                      {Formatters.formatNumber(remaining)} FCFA
                    </Text>{" "}
                    pour ton palier ! 🚀
                  </Text>
                )}
                <View style={dashboardStyles.heroStatsRow}>
                  <View style={dashboardStyles.heroStat}>
                    <View
                      style={[
                        dashboardStyles.heroStatDot,
                        { backgroundColor: "#9FF5C1" },
                      ]}
                    />
                    <Text style={dashboardStyles.heroStatText}>
                      {deliveredCount} livrées
                    </Text>
                  </View>
                  <Text style={dashboardStyles.heroStatSep}>•</Text>
                  <View style={dashboardStyles.heroStat}>
                    <View
                      style={[
                        dashboardStyles.heroStatDot,
                        { backgroundColor: "#FFB95F" },
                      ]}
                    />
                    <Text style={dashboardStyles.heroStatText}>
                      {enCoursCount} en cours
                    </Text>
                  </View>
                  <Text style={dashboardStyles.heroStatSep}>•</Text>
                  <Text style={dashboardStyles.heroStatText}>
                    Moy: {Formatters.formatNumber(average)} F/course
                  </Text>
                </View>
              </View>
            </TutorialTarget>
          </LinearGradient>
        </TutorialTarget>

        {/* Alerte reversement marchand */}
        <TutorialTarget id="card-financial-summary">
          <View style={dashboardStyles.reverserCard}>
            <View style={dashboardStyles.reverserHeader}>
              <View style={dashboardStyles.reverserIcon}>
                <MaterialIcons
                  name="account-balance-wallet"
                  size={18}
                  color="#B45309"
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={dashboardStyles.reverserTitle}>
                  À reverser : {Formatters.formatNumber(pendingTotal)} FCFA{" "}
                  <Text style={dashboardStyles.reverserCount}>
                    {pendingCount} marchands
                  </Text>
                </Text>
                <Text
                  style={dashboardStyles.reverserSub}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {reverserSubtitle}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={dashboardStyles.reverserButton}
              onPress={() => router.push("/merchant-accounting")}
              activeOpacity={0.8}
            >
              <Text style={dashboardStyles.reverserButtonText}>
                Gérer les reversements marchands
              </Text>
              <MaterialIcons name="arrow-forward" size={16} color="#78350F" />
            </TouchableOpacity>
          </View>
        </TutorialTarget>

        {/* Filtres rapides */}
        <View style={dashboardStyles.filterRow}>
          <TouchableOpacity
            style={[
              dashboardStyles.filterChip,
              dashboardStyles.filterChipALivrer,
              filter === "A_LIVRER" && dashboardStyles.filterChipActive,
            ]}
            onPress={() => setFilter("A_LIVRER")}
            activeOpacity={0.8}
          >
            <View style={dashboardStyles.filterChipLeft}>
              <View
                style={[
                  dashboardStyles.filterDot,
                  { backgroundColor: "#D97706" },
                ]}
              />
              <Text style={[dashboardStyles.filterLabel, { color: "#92400E" }]}>
                À livrer
              </Text>
            </View>
            <Text style={[dashboardStyles.filterCount, { color: "#B45309" }]}>
              {counts.aLivrer}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              dashboardStyles.filterChip,
              dashboardStyles.filterChipLivrees,
              filter === "LIVREE" && dashboardStyles.filterChipActive,
            ]}
            onPress={() => setFilter("LIVREE")}
            activeOpacity={0.8}
          >
            <View style={dashboardStyles.filterChipLeft}>
              <View
                style={[
                  dashboardStyles.filterDot,
                  { backgroundColor: "#059669" },
                ]}
              />
              <Text style={[dashboardStyles.filterLabel, { color: "#065F46" }]}>
                Livrées
              </Text>
            </View>
            <Text style={[dashboardStyles.filterCount, { color: "#047857" }]}>
              {counts.livrees}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              dashboardStyles.filterChip,
              dashboardStyles.filterChipAnnulees,
              filter === "ANNULEE" && dashboardStyles.filterChipActive,
            ]}
            onPress={() => setFilter("ANNULEE")}
            activeOpacity={0.8}
          >
            <Text style={[dashboardStyles.filterLabel, { color: "#5B5BD6" }]}>
              Annulées
            </Text>
            <Text style={[dashboardStyles.filterCount, { color: "#5B5BD6" }]}>
              {counts.annulees}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section prochaines courses */}
        <View style={dashboardStyles.sectionHeader}>
          <Text style={dashboardStyles.sectionTitle}>
            Prochaines courses{"  "}
            <View style={dashboardStyles.zoneBadge}>
              <Text style={dashboardStyles.zoneText}>Abidjan Nord</Text>
            </View>
          </Text>
          <TouchableOpacity
            style={dashboardStyles.mapButton}
            onPress={() =>
              showAlert("Vue carte", "La vue carte arrive très bientôt 🗺️.")
            }
          >
            <Text style={dashboardStyles.mapButtonText}>Carte</Text>
            <MaterialIcons name="map" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Feed vertical */}
        <TutorialTarget id="section-schedule">
          <View style={{ gap: 12 }}>
            {filteredDeliveries.length === 0 ? (
              <View style={dashboardStyles.emptyState}>
                <MaterialIcons
                  name={
                    filter === "LIVREE"
                      ? "check-circle"
                      : filter === "ANNULEE"
                        ? "cancel"
                        : "local-shipping"
                  }
                  size={40}
                  color={COLORS.muted}
                />
                <Text style={dashboardStyles.emptyText}>
                  {filter === "A_LIVRER"
                    ? "Aucune course à livrer.\nAjoute une livraison ou recharge la liste."
                    : filter === "LIVREE"
                      ? "Aucune course livrée pour le moment."
                      : "Aucune course annulée. Bonne nouvelle !"}
                </Text>
              </View>
            ) : (
              filteredDeliveries.map((d, idx) => {
                if (d.status === "LIVREE") return renderDeliveredCard(d);
                if (d.status === "ANNULEE") return renderCancelledCard(d);
                if (idx === 0 && filter === "A_LIVRER")
                  return renderPriorityCard(d);
                return renderSimpleCard(d);
              })
            )}
          </View>
        </TutorialTarget>

        {/* Bannière plein soleil / hors-ligne */}
        <View style={dashboardStyles.sunBanner}>
          <MaterialIcons
            name={isConnected ? "offline-bolt" : "cloud-off"}
            size={22}
            color={COLORS.infoText}
          />
          <Text style={dashboardStyles.sunBannerText}>
            {isConnected
              ? "Mode Plein Soleil actif. Si le réseau coupe vers Angré ou Yopougon, toutes tes validations restent enregistrées sur ton téléphone."
              : "Hors-ligne : tes validations sont enregistrées en local et seront synchronisées automatiquement dès le retour réseau."}
          </Text>
        </View>

        <View style={dashboardStyles.bottomSpacer} />
      </ScrollView>

      {/* FAB */}
      <View style={dashboardStyles.fabWrapper} pointerEvents="box-none">
        <TouchableOpacity
          style={dashboardStyles.fab}
          onPress={() => router.push("/add-delivery")}
          activeOpacity={0.92}
        >
          <MaterialIcons name="add-circle" size={24} color="#FFFFFF" />
          <Text style={dashboardStyles.fabText}>+ Nouvelle livraison (15s)</Text>
        </TouchableOpacity>
      </View>

      {/* Modale objectif */}
      <Modal
        visible={showGoalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={dashboardStyles.modalOverlay}>
          <View style={dashboardStyles.modalContent}>
            <View style={dashboardStyles.modalIcon}>
              <MaterialIcons name="flag" size={32} color={COLORS.primary} />
            </View>
            <Text style={dashboardStyles.modalTitle}>Objectif du jour</Text>
            <Text style={dashboardStyles.modalMessage}>
              Définissez votre objectif de gains pour aujourd&apos;hui
            </Text>
            <View style={dashboardStyles.goalInputContainer}>
              <TextInput
                style={dashboardStyles.goalModalInput}
                value={goalInput}
                onChangeText={(text) => setGoalInput(text.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                placeholder="Ex : 15000"
                placeholderTextColor={COLORS.muted}
                autoFocus
              />
              <Text style={dashboardStyles.goalModalCurrency}>FCFA</Text>
            </View>
            <Text style={dashboardStyles.goalModalHint}>
              {data.todayEarnings > 0
                ? `Vous avez déjà gagné ${Formatters.formatNumber(data.todayEarnings)} FCFA aujourd'hui`
                : "Commencez votre journée en fixant un objectif motivant"}
            </Text>
            <View style={dashboardStyles.modalButtons}>
              <TouchableOpacity
                style={[
                  dashboardStyles.modalButton,
                  dashboardStyles.modalButtonCancel,
                ]}
                onPress={() => setShowGoalModal(false)}
                disabled={isSavingGoal}
              >
                <Text style={dashboardStyles.modalButtonTextCancel}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dashboardStyles.modalButton,
                  dashboardStyles.modalButtonPrimary,
                ]}
                onPress={saveDailyGoal}
                disabled={isSavingGoal}
              >
                {isSavingGoal ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={dashboardStyles.modalButtonTextPrimary}>
                    Enregistrer
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modale Livrer & Encaisser */}
      <Modal
        visible={!!deliverTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeliverTarget(null)}
      >
        <View style={dashboardStyles.modalOverlay}>
          <View style={dashboardStyles.modalContent}>
            <View style={dashboardStyles.modalIcon}>
              <MaterialIcons name="done-all" size={34} color={COLORS.primary} />
            </View>
            <Text style={dashboardStyles.modalTitle}>Livrer & Encaisser</Text>
            <Text style={dashboardStyles.modalMessage}>
              Confirme la remise du colis et l&apos;encaissement client. Le statut
              passera à « Livrée » et sera synchronisé.
            </Text>
            {deliverTarget && (
              <View style={dashboardStyles.modalSummaryBox}>
                <View style={dashboardStyles.modalSummaryRow}>
                  <Text style={dashboardStyles.modalSummaryLabel}>Client</Text>
                  <Text style={dashboardStyles.modalSummaryValue}>
                    {deliverTarget.recipient_name}
                  </Text>
                </View>
                <View style={dashboardStyles.modalSummaryRow}>
                  <Text style={dashboardStyles.modalSummaryLabel}>
                    À encaisser client
                  </Text>
                  <Text style={dashboardStyles.modalSummaryValue}>
                    {Formatters.formatNumber(getEncaisserAmount(deliverTarget))}{" "}
                    FCFA
                  </Text>
                </View>
                <View style={dashboardStyles.modalSummaryRow}>
                  <Text style={dashboardStyles.modalSummaryLabel}>
                    Ton gain net
                  </Text>
                  <Text
                    style={[
                      dashboardStyles.modalSummaryValue,
                      { color: COLORS.primaryDark },
                    ]}
                  >
                    +{Formatters.formatNumber(getGainNet(deliverTarget))} FCFA
                  </Text>
                </View>
              </View>
            )}
            <View style={dashboardStyles.modalButtons}>
              <TouchableOpacity
                style={[
                  dashboardStyles.modalButton,
                  dashboardStyles.modalButtonCancel,
                ]}
                onPress={() => setDeliverTarget(null)}
                disabled={isDelivering}
              >
                <Text style={dashboardStyles.modalButtonTextCancel}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dashboardStyles.modalButton,
                  dashboardStyles.modalButtonPrimary,
                ]}
                onPress={confirmDeliver}
                disabled={isDelivering}
              >
                {isDelivering ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={dashboardStyles.modalButtonTextPrimary}>
                    ✓ Valider
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
  );
}
