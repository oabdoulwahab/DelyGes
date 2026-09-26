import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  Modal,
  Linking,
  StatusBar,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import * as Device from "expo-device";
import { db } from "../src/database/db";
import { UserRepository } from "../src/repositories/user.repository";
import { DeliveryRepository } from "../src/repositories/delivery.repository";
import { AccountDeletionService } from "../src/services/account-deletion.service";
import { syncService } from "../src/services/sync.service";
import { COLORS } from "../styles/colors";
import { commonStyles } from "../styles/common";
import { settingsStyles } from "../styles/settingsStyles";
import { useAuth } from "../src/context/AuthContext";
import { useAutoSave } from "../src/hooks/useAutoSave";
import { useModal } from "../providers/ModalProvider";
import { NotificationStore } from "../src/services/notification.store";
import { Formatters } from "../src/utils/formatters";
import { detectCommune } from "../src/utils/communes";
import { getAppFlag, setAppFlag } from "../src/utils/app-settings";
import { GPS_APPS, GpsApp, getGpsApp, setGpsApp } from "../src/utils/navigation";
import * as Updates from "expo-updates";
import * as Application from "expo-application";
import { openBrowserAsync } from "expo-web-browser";
import { auth, db as firestore } from "../src/config/firebase";
import { useTutorial } from "../src/hooks/useTutorial";
import TutorialOverlay from "../components/TutorialOverlay";
import { TutorialProvider } from "../src/context/TutorialContext";
import TutorialTarget from "../components/TutorialTarget";
import TutorialScrollRegistrar from "../components/TutorialScrollRegistrar";
import ProfileAvatar from "../components/ProfileAvatar";
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

type UserSettings = {
  name: string;
  email: string | null;
  phone: string;
  siret: string;
  vehicle: string;
  is_vat: number;
  daily_goal: number;
  monthly_goal: number;
  reminder_notifications: number;
  payment_notifications: number;
  daily_goal_notifications: number;
  payout_wave: string;
  payout_orange: string;
  payout_mtn: string;
  payout_primary: string;
};

type Reputation = {
  total: number;
  delivered: number;
  successRate: number;
  avgGain: number;
  zones: string[];
  seniority: string;
  tier: string;
};

type PayoutChannel = "wave" | "orange" | "mtn";

const PAYOUT_META: Record<
  PayoutChannel,
  { label: string; color: string; bg: string; icon: string; tag: string }
> = {
  wave: { label: "Wave Mobile Money", color: "#0284C7", bg: "#DBEAFE", icon: "waves", tag: "Principal" },
  orange: { label: "Orange Money CI", color: "#B45309", bg: "#FFEDD5", icon: "payments", tag: "Secours" },
  mtn: { label: "MTN MoMo", color: "#8A6D1B", bg: "#FEF3C7", icon: "add-card", tag: "À configurer" },
};

export default function Settings() {
  const scrollRef = useRef<any>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, isAuthenticated, logout, authReady, firebaseUser, refreshUser } = useAuth();
  const [appVersion, setAppVersion] = useState("v1.0.3");
  const [appBuild, setAppBuild] = useState("");
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { autoSave } = useAutoSave({
    userId: user?.id ?? 0,
    delay: 400,
  });

  // Modales existantes
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Nouvelles modales maquette
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutChannel, setPayoutChannel] = useState<PayoutChannel>("wave");
  const [payoutNumber, setPayoutNumber] = useState("");
  const [showSosModal, setShowSosModal] = useState(false);

  const [settings, setSettings] = useState<UserSettings>({
    name: "",
    email: "",
    phone: "",
    siret: "",
    vehicle: "Moto Abidjan",
    is_vat: 0,
    daily_goal: 0,
    monthly_goal: 0,
    reminder_notifications: 1,
    payment_notifications: 1,
    daily_goal_notifications: 1,
    payout_wave: "",
    payout_orange: "",
    payout_mtn: "",
    payout_primary: "WAVE",
  });
  const { showModal, showConfirm, showSuccess, showError, showAlert } =
    useModal();
  const [isLoading, setIsLoading] = useState(true);

  // Réputation réelle + prefs terrain
  const [reputation, setReputation] = useState<Reputation>({
    total: 0,
    delivered: 0,
    successRate: 0,
    avgGain: 0,
    zones: [],
    seniority: "",
    tier: "NOUVEAU LIVREUR",
  });
  const [gpsApp, setGpsAppState] = useState<GpsApp>("google");
  const [otpEnabled, setOtpEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [batterySaver, setBatterySaver] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [isForcingSync, setIsForcingSync] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Tutoriel
  const {
    isVisible: isTutorialVisible,
    currentStep: tutorialStep,
    tutorial,
    nextStep: tutorialNext,
    prevStep: tutorialPrev,
    closeTutorial: tutorialClose,
    showTutorial: tutorialShow,
  } = useTutorial("settings");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    NetInfo.fetch().then((s) => setIsConnected(s.isConnected ?? true));
    return () => unsub();
  }, []);

  const displayName = settings.name || user?.name || "Livreur";
  const firstName = useMemo(() => displayName.split(" ")[0], [displayName]);
  const userInitial = useMemo(() => {
    const n = displayName || "?";
    return n.trim().charAt(0).toUpperCase() || "?";
  }, [displayName]);
  const matricule = useMemo(
    () => `LIV-ABJ-${String(user?.id ?? 0).padStart(4, "0")}`,
    [user?.id],
  );
  const deviceLabel = useMemo(() => Device.modelName || "cet appareil", []);

  // Mise à jour d'un champ avec auto-save ET Firebase
  const updateSetting = async (field: keyof UserSettings, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    autoSave(field, value);

    if (firebaseUser) {
      try {
        const userRef = doc(firestore, "users", firebaseUser.uid);
        if (field === "name") {
          await updateProfile(firebaseUser, { displayName: value as string });
        }
        await updateDoc(userRef, {
          [field]: value,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`❌ Erreur synchronisation ${field}:`, error);
      }
    }
  };

  const addMissingColumns = async () => {
    try {
      const userSchema = await db.getAllAsync<{ name: string; type: string }>("PRAGMA table_info(user)");
      const columnsToAdd = [
        { name: "siret", type: "TEXT" },
        { name: "vehicle", type: "TEXT" },
        { name: "is_vat", type: "INTEGER" },
        { name: "daily_goal", type: "REAL DEFAULT  " },
        { name: "monthly_goal", type: "REAL DEFAULT 0" },
        { name: "reminder_notifications", type: "INTEGER DEFAULT 1" },
        { name: "payment_notifications", type: "INTEGER DEFAULT 1" },
        { name: "daily_goal_notifications", type: "INTEGER DEFAULT 1" },
        { name: "payout_wave", type: "TEXT" },
        { name: "payout_orange", type: "TEXT" },
        { name: "payout_mtn", type: "TEXT" },
        { name: "payout_primary", type: "TEXT DEFAULT 'WAVE'" },
      ];
      for (const column of columnsToAdd) {
        const exists = userSchema.some((col) => col.name === column.name);
        if (!exists) {
          try {
            await db.execAsync(
              `ALTER TABLE user ADD COLUMN ${column.name} ${column.type}`,
            );
          } catch (alterError) {
            console.error(`❌ Erreur ajout colonne ${column.name}:`, alterError);
          }
        }
      }
    } catch (error) {
      console.error("❌ Erreur vérification schéma:", error);
    }
  };

  const setDefaultValues = async () => {
    if (!user) return;
    try {
      const userData = await UserRepository.findById(user.id);
      if (!userData) return;
      const defaults: Record<string, unknown> = {};
      if (!userData.siret) defaults.siret = "";
      if (!userData.vehicle) defaults.vehicle = "Moto Abidjan";
      if (userData.is_vat === null) defaults.is_vat = 0;
      if (userData.daily_goal === null) defaults.daily_goal = 0;
      if (userData.monthly_goal === null) defaults.monthly_goal = 0;
      if (userData.reminder_notifications === null) defaults.reminder_notifications = 1;
      if (userData.payment_notifications === null) defaults.payment_notifications = 1;
      if (userData.daily_goal_notifications === null) defaults.daily_goal_notifications = 1;
      if (!userData.payout_primary) defaults.payout_primary = "WAVE";
      if (Object.keys(defaults).length > 0) {
        await UserRepository.update(user.id, defaults);
      }
    } catch (error) {
      console.error("❌ Erreur mise à jour valeurs par défaut:", error);
    }
  };

  const formatSeniority = (iso?: string | null): string => {
    if (!iso) return "";
    try {
      const start = new Date(iso);
      const now = new Date();
      let months =
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth());
      months = Math.max(months, 0);
      if (months < 1) return "Nouveau";
      const years = Math.floor(months / 12);
      const rest = months % 12;
      if (years === 0) return `${rest} m`;
      return rest > 0 ? `${years} an${years > 1 ? "s" : ""} ${rest} m` : `${years} an${years > 1 ? "s" : ""}`;
    } catch {
      return "";
    }
  };

  const loadReputation = useCallback(async () => {
    if (!user) return;
    try {
      const all = await DeliveryRepository.findAll({ userId: user.id });
      const delivered = all.filter((d) => d.status === "LIVREE");
      const total = all.length;
      const successRate =
        total > 0 ? Math.round((delivered.length / total) * 1000) / 10 : 0;
      const profit = delivered.reduce(
        (s, d) => s + (typeof d.profit === "number" ? d.profit : d.delivery_fee || 0),
        0,
      );
      const avgGain = delivered.length > 0 ? profit / delivered.length : 0;
      const zoneCount = new Map<string, number>();
      all.forEach((d) => {
        const c = detectCommune(d.address);
        if (c !== "Autre") zoneCount.set(c, (zoneCount.get(c) || 0) + 1);
      });
      const zones = Array.from(zoneCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);
      const tier =
        delivered.length >= 100
          ? "LIVREUR CONFIRMÉ"
          : delivered.length >= 20
            ? "LIVREUR ACTIF"
            : "NOUVEAU LIVREUR";
      setReputation({
        total,
        delivered: delivered.length,
        successRate,
        avgGain,
        zones,
        seniority: formatSeniority(user.created_at),
        tier,
      });
      const pending = await db.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) as n FROM deliveries WHERE user_id = ? AND needs_sync = 1",
        [user.id],
      );
      setPendingSync(pending?.n ?? 0);
    } catch (e) {
      console.error("❌ Erreur réputation:", e);
    }
  }, [user]);

  const loadPrefs = useCallback(async () => {
    try {
      const [gps, otp, sound, battery] = await Promise.all([
        getGpsApp(),
        getAppFlag("otp_payout", true),
        getAppFlag("sound_assign", true),
        getAppFlag("battery_saver", true),
      ]);
      setGpsAppState(gps);
      setOtpEnabled(otp);
      setSoundEnabled(sound);
      setBatterySaver(battery);
    } catch (e) {
      console.error("❌ Erreur prefs:", e);
    }
  }, []);

  const loadUserSettings = async () => {
    if (!user) return;
    try {
      await addMissingColumns();
      await setDefaultValues();
      const userData = await UserRepository.findById(user.id);
      if (userData) {
        setSettings({
          name: userData.name || "",
          email: userData.email || "",
          phone: userData.phone || "",
          siret: userData.siret || "",
          vehicle: userData.vehicle || "Moto Abidjan",
          is_vat: userData.is_vat || 0,
          daily_goal: userData.daily_goal || 0,
          monthly_goal: userData.monthly_goal || 0,
          reminder_notifications: userData.reminder_notifications ?? 1,
          payment_notifications: userData.payment_notifications ?? 1,
          daily_goal_notifications: userData.daily_goal_notifications ?? 1,
          payout_wave: userData.payout_wave || "",
          payout_orange: userData.payout_orange || "",
          payout_mtn: userData.payout_mtn || "",
          payout_primary: userData.payout_primary || "WAVE",
        });
      }
      setUnreadCount(await NotificationStore.countUnread(user.id).catch(() => 0));
    } catch (error) {
      console.error("❌ Erreur lors du chargement des paramètres:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const buildVersion = Application.nativeApplicationVersion ?? "1.0.3";
    const buildNumber = Application.nativeBuildVersion ?? "2026.09";
    setAppVersion(`Delygest v${buildVersion}`);
    setAppBuild(`Build ${buildNumber}`);
    if (authReady && isAuthenticated && user) {
      loadUserSettings();
      loadReputation();
      loadPrefs();
    } else if (authReady && !isAuthenticated) {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, isAuthenticated, user, firebaseUser]);

  useFocusEffect(
    useCallback(() => {
      loadReputation();
      loadPrefs();
    }, [loadReputation, loadPrefs]),
  );

  // ---------- Préférences terrain persistées ----------
  const togglePref = async (
    key: "otp_payout" | "sound_assign" | "battery_saver",
    value: boolean,
    label: string,
    apply: (v: boolean) => void,
  ) => {
    apply(value);
    try {
      await setAppFlag(key, value);
      showToast(`${label} : ${value ? "activé" : "désactivé"}`);
    } catch {
      showError("Erreur", "Impossible d'enregistrer ce réglage");
    }
  };

  const chooseGps = async (app: GpsApp, label: string) => {
    setGpsAppState(app);
    try {
      await setGpsApp(app);
      showToast(`GPS par défaut : ${label}`);
    } catch {
      showError("Erreur", "Impossible d'enregistrer ce réglage");
    }
  };

  const forceSync = async () => {
    const net = await NetInfo.fetch();
    if (!(net.isConnected ?? true)) {
      showToast("Hors-ligne : sync dès retour réseau");
      return;
    }
    setIsForcingSync(true);
    try {
      await syncService.syncAll();
      await loadReputation();
      showToast("Cache synchronisé");
    } catch {
      showError("Erreur", "Synchronisation impossible");
    } finally {
      setIsForcingSync(false);
    }
  };

  // ---------- Mobile Money ----------
  const payoutValue = (c: PayoutChannel): string => {
    if (c === "wave") return settings.payout_wave || user?.phone || "";
    if (c === "orange") return settings.payout_orange;
    return settings.payout_mtn;
  };

  const openPayoutModal = (c: PayoutChannel) => {
    setPayoutChannel(c);
    setPayoutNumber(
      c === "wave"
        ? settings.payout_wave
        : c === "orange"
          ? settings.payout_orange
          : settings.payout_mtn,
    );
    setShowPayoutModal(true);
  };

  const savePayout = async () => {
    const num = payoutNumber.replace(/[^0-9+]/g, "");
    if (!num) {
      showError("Erreur", "Saisis un numéro valide");
      return;
    }
    const field =
      payoutChannel === "wave"
        ? "payout_wave"
        : payoutChannel === "orange"
          ? "payout_orange"
          : "payout_mtn";
    await updateSetting(field, num);
    setShowPayoutModal(false);
    showToast(`${PAYOUT_META[payoutChannel].label} enregistré`);
  };

  const setPrimary = async (c: PayoutChannel) => {
    await updateSetting("payout_primary", c.toUpperCase());
    showToast(`Compte principal : ${PAYOUT_META[c].label}`);
  };

  const saveName = async () => {
    const v = nameInput.trim();
    if (!v) {
      showError("Erreur", "Le nom ne peut pas être vide");
      return;
    }
    await updateSetting("name", v);
    await refreshUser().catch(() => {});
    setShowNameModal(false);
    showToast("Profil mis à jour");
  };

  // ---------- Mot de passe / compte (logique conservée) ----------
  const validatePassword = () => {
    const errors = { currentPassword: "", newPassword: "", confirmPassword: "" };
    let isValid = true;
    if (!passwordData.currentPassword) {
      errors.currentPassword = "Mot de passe actuel requis";
      isValid = false;
    }
    if (!passwordData.newPassword) {
      errors.newPassword = "Nouveau mot de passe requis";
      isValid = false;
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = "Minimum 6 caractères";
      isValid = false;
    }
    if (!passwordData.confirmPassword) {
      errors.confirmPassword = "Confirmation requise";
      isValid = false;
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "Les mots de passe ne correspondent pas";
      isValid = false;
    }
    setPasswordErrors(errors);
    return isValid;
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;
    if (!firebaseUser || !firebaseUser.email) {
      showError("Erreur", "Utilisateur Firebase non trouvé");
      return;
    }
    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        passwordData.currentPassword,
      );
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, passwordData.newPassword);
      if (!user) return;
      await UserRepository.patchPassword(user.id, "firebase_managed");
      showSuccess("Succès", "Mot de passe modifié avec succès");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordExpanded(false);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };
      if (firebaseError.code === "auth/wrong-password") {
        showError("Erreur", "Mot de passe actuel incorrect");
      } else if (firebaseError.code === "auth/weak-password") {
        showError("Erreur", "Nouveau mot de passe trop faible");
      } else {
        showError("Erreur", "Impossible de modifier le mot de passe");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExportData = async () => {
    if (!user) {
      showError("Erreur", "Vous devez être connecté");
      return;
    }
    try {
      const deliveries = await DeliveryRepository.findByUserId(user.id);
      showAlert(
        "Exporter les données",
        `Prêt à exporter ${deliveries.length} livraisons.\n\nFonctionnalité d'export CSV en développement.`,
      );
    } catch (error) {
      console.error("❌ Erreur lors de l'export:", error);
      showError("Erreur", "Impossible d'exporter les données");
    }
  };

  const openLegalLink = async (url: string) => {
    try {
      await openBrowserAsync(url);
    } catch (error) {
      console.error("❌ Erreur ouverture lien:", error);
      showError("Erreur", "Impossible d'ouvrir le lien");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !firebaseUser) {
      showError("Erreur", "Vous devez être connecté");
      return;
    }
    if (!firebaseUser.email) {
      showError("Erreur", "Compte sans email, impossible de réauthentifier");
      return;
    }
    setShowPasswordModal(true);
    setDeletePassword("");
  };

  const confirmDeleteWithPassword = async () => {
    if (!deletePassword.trim()) {
      showError("Erreur", "Mot de passe requis");
      return;
    }
    setShowPasswordModal(false);
    setIsDeleting(true);
    try {
      const credential = EmailAuthProvider.credential(
        firebaseUser!.email!,
        deletePassword,
      );
      await reauthenticateWithCredential(firebaseUser!, credential);
      setShowDeleteConfirmModal(true);
      setIsDeleting(false);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };
      if (firebaseError.code === "auth/wrong-password") {
        showError("Erreur", "Mot de passe incorrect");
      } else if (firebaseError.code === "auth/too-many-requests") {
        showError("Erreur", "Trop de tentatives. Réessayez plus tard");
      } else {
        showError("Erreur", "Échec de la vérification");
      }
      setIsDeleting(false);
    }
  };

  const confirmFinalDelete = async () => {
    setShowDeleteConfirmModal(false);
    setIsDeleting(true);
    try {
      await AccountDeletionService.deleteAccount(firebaseUser!.uid);
      showSuccess("Compte supprimé", "Votre compte a été supprimé avec succès.");
      await logout();
      router.replace("/register");
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };
      if (firebaseError.code === "auth/requires-recent-login") {
        showError("Erreur", "Session expirée. Veuillez vous reconnecter.");
        await logout();
        router.replace("/login");
      } else {
        showError("Erreur", "Impossible de supprimer le compte");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace("/login");
  };

  const handleVehicleSelect = () => {
    showModal({
      title: "Sélectionner un véhicule",
      message: "Choisissez votre type de véhicule :",
      type: "confirm",
      buttons: [
        { text: "Moto Abidjan", onPress: () => updateSetting("vehicle", "Moto Abidjan") },
        { text: "Scooter 125cc", onPress: () => updateSetting("vehicle", "Scooter 125cc") },
        { text: "Moto", onPress: () => updateSetting("vehicle", "Moto") },
        { text: "Voiture", onPress: () => updateSetting("vehicle", "Voiture") },
        { text: "Vélo", onPress: () => updateSetting("vehicle", "Vélo") },
        { text: "Annuler", style: "cancel" },
      ],
    });
  };

  // ---------- Assistance / SOS ----------
  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      `Bonjour régulateur Delygest, je suis ${displayName} (${matricule}). Besoin d'assistance.`,
    );
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() =>
      showError("Erreur", "WhatsApp indisponible"),
    );
  };

  const sendSos = () => {
    setShowSosModal(false);
    const when = new Date().toLocaleString("fr-FR");
    const body = encodeURIComponent(
      `🚨 SOS Delygest — ${displayName} (${matricule}, ${user?.phone || "n° inconnu"}) — Incident terrain/panne le ${when} à Abidjan. Rappel urgent SVP.`,
    );
    Linking.openURL(`sms:?body=${body}`).catch(() =>
      showError("Erreur", "SMS indisponible sur cet appareil"),
    );
    showToast("Alerte SOS préparée");
  };

  if (isLoading || !authReady) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={settingsStyles.loadingContainer}>
          <MaterialIcons name="settings" size={48} color={COLORS.primary} />
          <Text style={settingsStyles.loadingText}>Chargement du profil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={settingsStyles.authErrorContainer}>
          <MaterialIcons name="error-outline" size={48} color={COLORS.danger} />
          <Text style={settingsStyles.authErrorText}>Non connecté</Text>
          <TouchableOpacity
            style={settingsStyles.authErrorButton}
            onPress={() => router.replace("/login")}
          >
            <Text style={settingsStyles.authErrorButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const primaryKey = settings.payout_primary.toLowerCase() as PayoutChannel;

  return (
    <TutorialProvider>
      <SafeAreaView style={commonStyles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* En-tête */}
        <View style={settingsStyles.header}>
          <View style={settingsStyles.headerContent}>
            <View style={settingsStyles.brandRow}>
              <Text style={settingsStyles.brandName}>Delygest</Text>
              <View style={settingsStyles.versionPill}>
                <Text style={settingsStyles.versionText}>v1.0.3</Text>
              </View>
            </View>
            <View style={settingsStyles.headerActions}>
              <View style={settingsStyles.onlinePill}>
                <View
                  style={[
                    settingsStyles.onlineDot,
                    { backgroundColor: isConnected ? COLORS.primary : "#D97706" },
                  ]}
                />
                <Text style={settingsStyles.onlineText}>
                  {isConnected ? "En ligne" : "Hors-ligne"}
                </Text>
              </View>
              <TouchableOpacity
                style={settingsStyles.iconButton}
                onPress={() => router.push("/notifications")}
                accessibilityLabel="Notifications"
              >
                <MaterialIcons name="notifications" size={22} color={COLORS.white} />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: COLORS.danger,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "800" }}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <ProfileAvatar size={34} initial={userInitial} />
              <TouchableOpacity
                style={settingsStyles.iconButton}
                onPress={tutorialShow}
                accessibilityLabel="Aide"
              >
                <MaterialIcons name="help-outline" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Toast */}
        {toast && (
          <View style={settingsStyles.toast}>
            <View style={settingsStyles.toastLeft}>
              <MaterialIcons name="check-circle" size={20} color="#9FF5C1" />
              <Text style={settingsStyles.toastText} numberOfLines={2}>
                {toast}
              </Text>
            </View>
            <Text style={settingsStyles.toastSync}>Synchronisé</Text>
          </View>
        )}

        <TutorialScrollRegistrar scrollRef={scrollRef}>
          <KeyboardAwareScrollView
            ref={scrollRef}
            style={settingsStyles.scrollView}
            contentContainerStyle={settingsStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            enableAutomaticScroll
            extraScrollHeight={180}
            keyboardOpeningTime={100}
          >
            {/* Profil */}
            <TutorialTarget id="section-profile">
              <View style={settingsStyles.card}>
                <View style={settingsStyles.profileTop}>
                  <View style={settingsStyles.avatarWrap}>
                    <ProfileAvatar size={72} initial={userInitial} editable />
                    <View style={settingsStyles.presenceDot}>
                      <View style={settingsStyles.presenceInner} />
                    </View>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={settingsStyles.profileNameRow}>
                      <Text style={settingsStyles.profileName} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <TouchableOpacity
                        style={settingsStyles.editButton}
                        onPress={() => {
                          setNameInput(settings.name || user.name || "");
                          setShowNameModal(true);
                        }}
                      >
                        <MaterialIcons name="edit" size={13} color={COLORS.muted} />
                        <Text style={settingsStyles.editButtonText}>Modifier</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={settingsStyles.matriculeRow}>
                      <Text style={settingsStyles.matricule}>{matricule}</Text>
                      <Text style={settingsStyles.vehicleTag} numberOfLines={1}>
                        {settings.vehicle}
                      </Text>
                    </View>
                    <View style={settingsStyles.repBadge}>
                      <MaterialIcons name="verified" size={14} color="#B45309" />
                      <Text style={settingsStyles.repText}>
                        {reputation.tier} ★ {reputation.successRate}%
                      </Text>
                      <Text style={settingsStyles.repSub}>
                        ({reputation.delivered} courses)
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={settingsStyles.zoneBox}>
                  <MaterialIcons name="near-me" size={17} color={COLORS.primary} />
                  <Text style={settingsStyles.zoneText} numberOfLines={1}>
                    <Text style={settingsStyles.zoneStrong}>Abidjan</Text>
                    {reputation.zones.length > 0
                      ? ` • ${reputation.zones.join(" - ")}`
                      : " • zones à venir"}
                  </Text>
                </View>
              </View>
            </TutorialTarget>

            {/* Activité & réputation */}
            <View style={settingsStyles.sectionHead}>
              <Text style={settingsStyles.sectionTitle}>Activité & Réputation</Text>
              <Text style={settingsStyles.tierPill}>{reputation.tier} • Abidjan</Text>
            </View>
            <View style={settingsStyles.bentoGrid}>
              <View style={settingsStyles.bentoRow}>
                <View style={settingsStyles.bentoCell}>
                  <View style={settingsStyles.bentoHead}>
                    <Text style={settingsStyles.bentoLabel}>Total courses</Text>
                    <MaterialIcons name="two-wheeler" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={settingsStyles.bentoValue}>
                    {Formatters.formatNumber(reputation.delivered)}
                  </Text>
                  <Text style={settingsStyles.bentoSub}>Livraisons réussies</Text>
                </View>
                <View style={settingsStyles.bentoCell}>
                  <View style={settingsStyles.bentoHead}>
                    <Text style={settingsStyles.bentoLabel}>Sans litige</Text>
                    <MaterialIcons name="my-location" size={18} color={COLORS.primary} />
                  </View>
                  <Text style={[settingsStyles.bentoValue, settingsStyles.bentoValueGreen]}>
                    {reputation.successRate}%
                  </Text>
                  <Text style={settingsStyles.bentoSub}>Courses non annulées</Text>
                </View>
              </View>
              <View style={settingsStyles.bentoRow}>
                <View style={settingsStyles.bentoCell}>
                  <View style={settingsStyles.bentoHead}>
                    <Text style={settingsStyles.bentoLabel}>Moy / course</Text>
                    <MaterialIcons name="schedule" size={18} color={COLORS.infoText} />
                  </View>
                  <Text style={[settingsStyles.bentoValue, { color: COLORS.infoText }]}>
                    {Formatters.formatNumber(Math.round(reputation.avgGain))} F
                  </Text>
                  <Text style={settingsStyles.bentoSub}>Gain net moyen</Text>
                </View>
                <View style={settingsStyles.bentoCell}>
                  <View style={settingsStyles.bentoHead}>
                    <Text style={settingsStyles.bentoLabel}>Ancienneté</Text>
                    <MaterialIcons name="military-tech" size={18} color="#B45309" />
                  </View>
                  <Text style={settingsStyles.bentoValue}>
                    {reputation.seniority || "—"}
                  </Text>
                  <Text style={settingsStyles.bentoSub}>Membre certifié</Text>
                </View>
              </View>
            </View>

            {/* Engin */}
            <View style={settingsStyles.card}>
              <View style={settingsStyles.cardHead}>
                <View style={settingsStyles.cardHeadLeft}>
                  <View style={settingsStyles.cardHeadIcon}>
                    <MaterialIcons name="moped" size={19} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={settingsStyles.cardTitle}>Engin & Équipement</Text>
                    <Text style={settingsStyles.cardSubtitle}>
                      Matériel déclaré pour tes tournées
                    </Text>
                  </View>
                </View>
                <Text style={[settingsStyles.miniPill, settingsStyles.okPill]}>
                  ● Conforme
                </Text>
              </View>
              <TouchableOpacity style={settingsStyles.infoRow} onPress={handleVehicleSelect}>
                <MaterialIcons name="sports-motorsports" size={20} color={COLORS.muted} />
                <View style={settingsStyles.infoBody}>
                  <View style={settingsStyles.infoTitleRow}>
                    <Text style={settingsStyles.infoTitle}>{settings.vehicle}</Text>
                    <Text style={[settingsStyles.miniPill, settingsStyles.neutralPill]}>
                      Changer
                    </Text>
                  </View>
                  <Text style={settingsStyles.infoSub}>Touchez pour modifier l&apos;engin</Text>
                </View>
              </TouchableOpacity>
              <View style={settingsStyles.infoRow}>
                <MaterialIcons name="verified-user" size={20} color={COLORS.muted} />
                <View style={settingsStyles.infoBody}>
                  <View style={settingsStyles.infoTitleRow}>
                    <Text style={settingsStyles.infoTitle}>Assurance & visite</Text>
                    <Text style={[settingsStyles.miniPill, settingsStyles.neutralPill]}>
                      Non renseigné
                    </Text>
                  </View>
                  <Text style={settingsStyles.infoSub}>
                    Dates de validité à déclarer au hub
                  </Text>
                </View>
              </View>
              <View style={settingsStyles.infoRow}>
                <MaterialIcons name="inventory-2" size={20} color={COLORS.muted} />
                <View style={settingsStyles.infoBody}>
                  <View style={settingsStyles.infoTitleRow}>
                    <Text style={settingsStyles.infoTitle}>Top-case isotherme</Text>
                    <Text style={[settingsStyles.miniPill, settingsStyles.neutralPill]}>
                      Non renseigné
                    </Text>
                  </View>
                  <Text style={settingsStyles.infoSub}>
                    Volume et sécurisation à déclarer au hub
                  </Text>
                </View>
              </View>
            </View>

            {/* Versements */}
            <View style={settingsStyles.card}>
              <View style={settingsStyles.cardHead}>
                <View style={settingsStyles.cardHeadLeft}>
                  <View style={settingsStyles.cardHeadIcon}>
                    <MaterialIcons name="account-balance-wallet" size={19} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={settingsStyles.cardTitle}>Versements & Trésorerie</Text>
                    <Text style={settingsStyles.cardSubtitle}>
                      Comptes de réception de tes gains
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="lock" size={19} color={COLORS.muted} />
              </View>
              {(Object.keys(PAYOUT_META) as PayoutChannel[]).map((c) => {
                const meta = PAYOUT_META[c];
                const value = payoutValue(c);
                const isPrimary = settings.payout_primary.toLowerCase() === c;
                return (
                  <View key={c} style={settingsStyles.mmRow}>
                    <TouchableOpacity
                      style={settingsStyles.mmLeft}
                      onPress={() => openPayoutModal(c)}
                      activeOpacity={0.8}
                    >
                      <View style={[settingsStyles.mmIcon, { backgroundColor: meta.bg }]}>
                        <MaterialIcons name={meta.icon as keyof typeof MaterialIcons.glyphMap} size={20} color={meta.color} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                          <Text style={settingsStyles.mmName} numberOfLines={1}>
                            {meta.label}
                          </Text>
                          {value ? (
                            <Text
                              style={[
                                settingsStyles.miniPill,
                                isPrimary ? settingsStyles.okPill : settingsStyles.neutralPill,
                              ]}
                            >
                              {isPrimary ? "Principal" : c === "orange" ? "Secours" : "Défini"}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={settingsStyles.mmNumber} numberOfLines={1}>
                          {value || "Non configuré — toucher pour ajouter"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {value ? (
                      <TouchableOpacity onPress={() => setPrimary(c)} hitSlop={10}>
                        <MaterialIcons
                          name={isPrimary ? "check-circle" : "radio-button-unchecked"}
                          size={22}
                          color={isPrimary ? COLORS.primary : COLORS.muted}
                        />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                        onPress={() => openPayoutModal(c)}
                      >
                        <MaterialIcons name="add" size={16} color={COLORS.primary} />
                        <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.primary }}>
                          Configurer
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <View style={settingsStyles.switchRow}>
                <View style={settingsStyles.switchBody}>
                  <MaterialIcons name="password" size={20} color={COLORS.primary} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: COLORS.white }}>
                      Vérification OTP reversements
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>
                      Code exigé avant clôture de caisse
                    </Text>
                  </View>
                </View>
                <Switch
                  value={otpEnabled}
                  onValueChange={(v) =>
                    togglePref("otp_payout", v, "Vérification OTP", setOtpEnabled)
                  }
                  trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Préférences terrain */}
            <View style={settingsStyles.card}>
              <View style={settingsStyles.cardHead}>
                <View style={settingsStyles.cardHeadLeft}>
                  <View style={settingsStyles.cardHeadIcon}>
                    <MaterialIcons name="tune" size={19} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={settingsStyles.cardTitle}>Préférences Terrain</Text>
                    <Text style={settingsStyles.cardSubtitle}>
                      GPS, audio et batterie en course
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.white }}>
                Application GPS par défaut
              </Text>
              <View style={settingsStyles.gpsGrid}>
                {GPS_APPS.map((g) => {
                  const active = gpsApp === g.key;
                  return (
                    <TouchableOpacity
                      key={g.key}
                      style={[settingsStyles.gpsChip, active && settingsStyles.gpsChipActive]}
                      onPress={() => chooseGps(g.key, g.label)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                    >
                      <MaterialIcons
                        name={g.key === "google" ? "map" : g.key === "yango" ? "explore" : "alt-route"}
                        size={22}
                        color={active ? COLORS.primary : COLORS.muted}
                      />
                      <Text
                        style={[settingsStyles.gpsChipText, active && settingsStyles.gpsChipTextActive]}
                      >
                        {g.label}
                      </Text>
                      <View
                        style={[settingsStyles.gpsDot, active && settingsStyles.gpsDotActive]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={settingsStyles.switchRow}>
                <View style={settingsStyles.switchBody}>
                  <MaterialIcons name="volume-up" size={20} color={COLORS.muted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.white }}>
                      Sonnerie attribution course
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>
                      Alerte à l&apos;arrivée d&apos;une course
                    </Text>
                  </View>
                </View>
                <Switch
                  value={soundEnabled}
                  onValueChange={(v) =>
                    togglePref("sound_assign", v, "Sonnerie attribution", setSoundEnabled)
                  }
                  trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={settingsStyles.switchRow}>
                <View style={settingsStyles.switchBody}>
                  <MaterialIcons name="battery-saver" size={20} color={COLORS.muted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.white }}>
                      Mode économie batterie
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.muted }}>
                      Synchro allégée sous 25% de batterie
                    </Text>
                  </View>
                </View>
                <Switch
                  value={batterySaver}
                  onValueChange={(v) =>
                    togglePref("battery_saver", v, "Économie batterie", setBatterySaver)
                  }
                  trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={settingsStyles.infoRow}>
                <MaterialIcons name="cloud-sync" size={20} color={COLORS.infoText} />
                <View style={settingsStyles.infoBody}>
                  <Text style={settingsStyles.infoTitle}>Synchro hors-ligne</Text>
                  <Text style={{ fontSize: 11, color: COLORS.infoText, fontWeight: "700" }}>
                    {pendingSync} course{pendingSync > 1 ? "s" : ""} en cache sécurisé
                  </Text>
                  <Text style={settingsStyles.infoSub}>
                    Envoi automatique dès retour réseau
                  </Text>
                </View>
                <TouchableOpacity
                  style={settingsStyles.editButton}
                  onPress={forceSync}
                  disabled={isForcingSync}
                >
                  <Text style={settingsStyles.editButtonText}>
                    {isForcingSync ? "…" : "Forcer"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Documents */}
            <View style={settingsStyles.card}>
              <View style={settingsStyles.cardHead}>
                <View style={settingsStyles.cardHeadLeft}>
                  <View style={settingsStyles.cardHeadIcon}>
                    <MaterialIcons name="badge" size={19} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={settingsStyles.cardTitle}>Documents & Conformité</Text>
                    <Text style={settingsStyles.cardSubtitle}>
                      Vérification par le hub Delygest
                    </Text>
                  </View>
                </View>
              </View>
              <View style={settingsStyles.infoRow}>
                <MaterialIcons name="badge" size={20} color={COLORS.muted} />
                <View style={settingsStyles.infoBody}>
                  <View style={settingsStyles.infoTitleRow}>
                    <Text style={settingsStyles.infoTitle}>Permis de conduire</Text>
                    <Text style={[settingsStyles.miniPill, settingsStyles.neutralPill]}>
                      Non vérifié
                    </Text>
                  </View>
                  <Text style={settingsStyles.infoSub}>
                    Présente-le au hub pour validation
                  </Text>
                </View>
              </View>
              <View style={settingsStyles.infoRow}>
                <MaterialIcons name="fingerprint" size={20} color={COLORS.muted} />
                <View style={settingsStyles.infoBody}>
                  <View style={settingsStyles.infoTitleRow}>
                    <Text style={settingsStyles.infoTitle}>Pièce d&apos;identité</Text>
                    <Text style={[settingsStyles.miniPill, settingsStyles.neutralPill]}>
                      Non vérifié
                    </Text>
                  </View>
                  <Text style={settingsStyles.infoSub}>
                    CNI ou passeport à présenter au hub
                  </Text>
                </View>
              </View>
            </View>

            {/* Assistance + SOS */}
            <TouchableOpacity style={settingsStyles.waCard} onPress={openWhatsApp} activeOpacity={0.9}>
              <View style={settingsStyles.waLeft}>
                <View style={settingsStyles.waIcon}>
                  <MaterialIcons name="chat" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.white }}>
                    Assistance WhatsApp 24/7
                  </Text>
                  <Text style={{ fontSize: 11, color: COLORS.muted }}>
                    Régulateur Abidjan en priorité
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#128C7E" />
            </TouchableOpacity>
            <TouchableOpacity
              style={settingsStyles.sosButton}
              onPress={() => setShowSosModal(true)}
              activeOpacity={0.9}
            >
              <MaterialIcons name="emergency" size={20} color={COLORS.danger} />
              <Text style={settingsStyles.sosText}>SOS Incident Terrain / Panne</Text>
            </TouchableOpacity>

            {/* Objectifs */}
            <TutorialTarget id="section-goals">
              <View style={settingsStyles.card}>
                <Text style={settingsStyles.cardTitle}>Objectifs de gains</Text>
                <View style={settingsStyles.fieldRow}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="flag" size={18} color={COLORS.muted} /> Quotidien
                  </Text>
                  <View style={settingsStyles.goalBox}>
                    <TextInput
                      style={settingsStyles.goalInput}
                      value={settings.daily_goal?.toString() || "0"}
                      onChangeText={(text) => {
                        const n = text.replace(/[^0-9]/g, "");
                        updateSetting("daily_goal", n ? parseInt(n, 10) : 0);
                      }}
                      keyboardType="numeric"
                      onFocus={(e) => scrollRef.current?.scrollToFocusedInput(e.target)}
                    />
                    <Text style={settingsStyles.goalUnit}>FCFA</Text>
                  </View>
                </View>
                <View style={settingsStyles.fieldRow}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="flag" size={18} color={COLORS.muted} /> Mensuel
                  </Text>
                  <View style={settingsStyles.goalBox}>
                    <TextInput
                      style={settingsStyles.goalInput}
                      value={settings.monthly_goal?.toString() || "0"}
                      onChangeText={(text) => {
                        const n = text.replace(/[^0-9]/g, "");
                        updateSetting("monthly_goal", n ? parseInt(n, 10) : 0);
                      }}
                      keyboardType="numeric"
                      onFocus={(e) => scrollRef.current?.scrollToFocusedInput(e.target)}
                    />
                    <Text style={settingsStyles.goalUnit}>FCFA</Text>
                  </View>
                </View>
                <TutorialTarget id="toggle-vat">
                  <View style={settingsStyles.switchRow}>
                    <Text style={settingsStyles.fieldLabel}>
                      <MaterialIcons name="percent" size={18} color={COLORS.muted} /> Assujetti TVA
                    </Text>
                    <Switch
                      value={settings.is_vat === 1}
                      onValueChange={(v) => updateSetting("is_vat", v ? 1 : 0)}
                      trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </TutorialTarget>
              </View>
            </TutorialTarget>

            {/* Notifications */}
            <TutorialTarget id="section-notifications">
              <View style={settingsStyles.card}>
                <Text style={settingsStyles.cardTitle}>Notifications</Text>
                <TouchableOpacity
                  style={settingsStyles.linkRow}
                  onPress={() => router.push("/notification-settings")}
                >
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="notifications" size={18} color={COLORS.muted} /> Tout gérer
                  </Text>
                  <MaterialIcons name="arrow-forward-ios" size={14} color={COLORS.muted} />
                </TouchableOpacity>
                <View style={settingsStyles.switchRow}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="edit-notifications" size={18} color={COLORS.muted} /> Rappels de saisie
                  </Text>
                  <Switch
                    value={settings.reminder_notifications === 1}
                    onValueChange={(v) => updateSetting("reminder_notifications", v ? 1 : 0)}
                    trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <View style={settingsStyles.switchRow}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="payments" size={18} color={COLORS.muted} /> Alertes de paiement
                  </Text>
                  <Switch
                    value={settings.payment_notifications === 1}
                    onValueChange={(v) => updateSetting("payment_notifications", v ? 1 : 0)}
                    trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <View style={settingsStyles.switchRow}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="emoji-events" size={18} color={COLORS.muted} /> Objectif atteint
                  </Text>
                  <Switch
                    value={settings.daily_goal_notifications === 1}
                    onValueChange={(v) => updateSetting("daily_goal_notifications", v ? 1 : 0)}
                    trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            </TutorialTarget>

            {/* Compte & sécurité */}
            <TutorialTarget id="section-data-security">
              <View style={settingsStyles.card}>
                <Text style={settingsStyles.cardTitle}>Compte & Sécurité</Text>
                <View style={settingsStyles.fieldRow}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="badge" size={18} color={COLORS.muted} /> Nom complet
                  </Text>
                </View>
                <TextInput
                  style={settingsStyles.modalInput}
                  value={settings.name}
                  onChangeText={(text) => updateSetting("name", text)}
                  placeholder="Votre nom"
                  placeholderTextColor={COLORS.placeholder}
                  autoCapitalize="words"
                  onFocus={(e) => scrollRef.current?.scrollToFocusedInput(e.target)}
                />
                <View style={settingsStyles.fieldRow}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="email" size={18} color={COLORS.muted} /> Email
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.muted }} numberOfLines={1}>
                    {settings.email || user.email || "—"}
                  </Text>
                </View>
                <View style={settingsStyles.fieldRow}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="phone" size={18} color={COLORS.muted} /> Téléphone
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: COLORS.white }}>
                    {user.phone}
                  </Text>
                </View>
                <TouchableOpacity
                  style={settingsStyles.linkRow}
                  onPress={() => setPasswordExpanded(!passwordExpanded)}
                >
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="lock" size={18} color={COLORS.muted} /> Changer le mot de passe
                  </Text>
                  <MaterialIcons
                    name={passwordExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                    size={22}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
                {passwordExpanded && (
                  <View style={settingsStyles.passwordBox}>
                    <TextInput
                      style={[
                        settingsStyles.passwordInput,
                        passwordErrors.currentPassword && settingsStyles.passwordInputError,
                      ]}
                      placeholder="Mot de passe actuel"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry
                      value={passwordData.currentPassword}
                      onChangeText={(text) => {
                        setPasswordData({ ...passwordData, currentPassword: text });
                        setPasswordErrors({ ...passwordErrors, currentPassword: "" });
                      }}
                    />
                    {passwordErrors.currentPassword ? (
                      <Text style={settingsStyles.passwordError}>{passwordErrors.currentPassword}</Text>
                    ) : null}
                    <TextInput
                      style={[
                        settingsStyles.passwordInput,
                        passwordErrors.newPassword && settingsStyles.passwordInputError,
                      ]}
                      placeholder="Nouveau mot de passe"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry
                      value={passwordData.newPassword}
                      onChangeText={(text) => {
                        setPasswordData({ ...passwordData, newPassword: text });
                        setPasswordErrors({ ...passwordErrors, newPassword: "" });
                      }}
                    />
                    {passwordErrors.newPassword ? (
                      <Text style={settingsStyles.passwordError}>{passwordErrors.newPassword}</Text>
                    ) : (
                      <Text style={settingsStyles.passwordHint}>Minimum 6 caractères</Text>
                    )}
                    <TextInput
                      style={[
                        settingsStyles.passwordInput,
                        passwordErrors.confirmPassword && settingsStyles.passwordInputError,
                      ]}
                      placeholder="Confirmer le mot de passe"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry
                      value={passwordData.confirmPassword}
                      onChangeText={(text) => {
                        setPasswordData({ ...passwordData, confirmPassword: text });
                        setPasswordErrors({ ...passwordErrors, confirmPassword: "" });
                      }}
                    />
                    {passwordErrors.confirmPassword ? (
                      <Text style={settingsStyles.passwordError}>{passwordErrors.confirmPassword}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={settingsStyles.passwordButton}
                      onPress={handleChangePassword}
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={settingsStyles.passwordButtonText}>
                          Mettre à jour le mot de passe
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity style={settingsStyles.linkRow} onPress={handleExportData}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="download" size={18} color={COLORS.muted} /> Exporter mes données
                  </Text>
                  <MaterialIcons name="arrow-forward-ios" size={14} color={COLORS.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={settingsStyles.linkRow} onPress={() => openLegalLink("https://delyges-app.web.app/privacy-policy")}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="privacy-tip" size={18} color={COLORS.muted} /> Confidentialité
                  </Text>
                  <MaterialIcons name="open-in-new" size={15} color={COLORS.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={settingsStyles.linkRow} onPress={() => openLegalLink("https://delyges-app.web.app/terms")}>
                  <Text style={settingsStyles.fieldLabel}>
                    <MaterialIcons name="description" size={18} color={COLORS.muted} /> Conditions d&apos;utilisation
                  </Text>
                  <MaterialIcons name="open-in-new" size={15} color={COLORS.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={settingsStyles.dangerRow} onPress={handleDeleteAccount}>
                  <MaterialIcons name="delete-forever" size={18} color={COLORS.danger} />
                  <Text style={settingsStyles.dangerText}>Supprimer le compte</Text>
                </TouchableOpacity>
              </View>
            </TutorialTarget>

            {/* Version + logout */}
            <View style={settingsStyles.versionPillCenter}>
              <View style={settingsStyles.versionPillDot} />
              <Text style={settingsStyles.versionPillText}>
                {appVersion} ({appBuild})
              </Text>
            </View>
            <TouchableOpacity
              style={settingsStyles.logoutButton}
              onPress={() => setShowLogoutModal(true)}
            >
              <MaterialIcons name="logout" size={20} color="#5B5BD6" />
              <Text style={settingsStyles.logoutText}>
                Se déconnecter de la session terrain
              </Text>
            </TouchableOpacity>
            <Text style={settingsStyles.deviceText}>
              {displayName} connecté sur {deviceLabel} • Abidjan, CI
            </Text>
          </KeyboardAwareScrollView>
        </TutorialScrollRegistrar>

        {/* Modale nom */}
        <Modal
          visible={showNameModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowNameModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={settingsStyles.modalTitle}>Modifier le profil</Text>
              <Text style={settingsStyles.modalMessage}>Ton nom affiché aux clients</Text>
              <TextInput
                style={settingsStyles.modalInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Nom complet"
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="words"
                autoFocus
              />
              <View style={settingsStyles.modalButtons}>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonCancel]}
                  onPress={() => setShowNameModal(false)}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextCancel]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonPrimary]}
                  onPress={saveName}
                >
                  <Text style={[settingsStyles.modalButtonText, { color: "#FFF" }]}>
                    Enregistrer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale Mobile Money */}
        <Modal
          visible={showPayoutModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPayoutModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={settingsStyles.modalTitle}>
                {PAYOUT_META[payoutChannel].label}
              </Text>
              <Text style={settingsStyles.modalMessage}>
                Numéro de réception de tes gains
              </Text>
              <TextInput
                style={settingsStyles.modalInput}
                value={payoutNumber}
                onChangeText={(t) => setPayoutNumber(t.replace(/[^0-9+ ]/g, ""))}
                placeholder="+225 …"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="phone-pad"
                autoFocus
              />
              <View style={settingsStyles.modalButtons}>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonCancel]}
                  onPress={() => setShowPayoutModal(false)}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextCancel]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonPrimary]}
                  onPress={savePayout}
                >
                  <Text style={[settingsStyles.modalButtonText, { color: "#FFF" }]}>
                    Enregistrer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale SOS */}
        <Modal
          visible={showSosModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSosModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={[settingsStyles.modalTitle, { color: COLORS.danger }]}>
                SOS Incident Terrain
              </Text>
              <Text style={settingsStyles.modalMessage}>
                Prépare un SMS d&apos;alerte avec ton identité ({matricule}) et
                l&apos;heure. Envoie-le au régulateur. Ta position GPS exacte
                n&apos;est pas transmise automatiquement.
              </Text>
              <View style={settingsStyles.modalButtons}>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonCancel]}
                  onPress={() => setShowSosModal(false)}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextCancel]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonDanger]}
                  onPress={sendSos}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextDanger]}>
                    Envoyer SOS
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale mot de passe (suppression) */}
        <Modal
          visible={showPasswordModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={settingsStyles.modalTitle}>Confirmation de sécurité</Text>
              <Text style={settingsStyles.modalMessage}>
                Pour supprimer votre compte, veuillez entrer votre mot de passe :
              </Text>
              <TextInput
                style={settingsStyles.modalInput}
                placeholder="Mot de passe"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry
                value={deletePassword}
                onChangeText={setDeletePassword}
                autoFocus
              />
              <View style={settingsStyles.modalButtons}>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonCancel]}
                  onPress={() => {
                    setShowPasswordModal(false);
                    setDeletePassword("");
                  }}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextCancel]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonDanger]}
                  onPress={confirmDeleteWithPassword}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextDanger]}>
                    Continuer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale déconnexion */}
        <Modal
          visible={showLogoutModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLogoutModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={settingsStyles.modalTitle}>Déconnexion</Text>
              <Text style={settingsStyles.modalMessage}>
                {firstName}, veux-tu clôturer ta session terrain Delygest ?
              </Text>
              <View style={settingsStyles.modalButtons}>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonCancel]}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextCancel]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonDanger]}
                  onPress={confirmLogout}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextDanger]}>
                    Déconnexion
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale suppression finale */}
        <Modal
          visible={showDeleteConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirmModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={settingsStyles.modalTitle}>Supprimer le compte</Text>
              <Text style={settingsStyles.modalMessage}>
                Toutes vos données seront effacées. Cette action est irréversible.
              </Text>
              <View style={settingsStyles.modalButtons}>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonCancel]}
                  onPress={() => setShowDeleteConfirmModal(false)}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextCancel]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[settingsStyles.modalButton, settingsStyles.modalButtonDanger]}
                  onPress={confirmFinalDelete}
                >
                  <Text style={[settingsStyles.modalButtonText, settingsStyles.modalButtonTextDanger]}>
                    Supprimer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {isDeleting && (
          <View style={settingsStyles.loadingOverlay}>
            <View style={settingsStyles.loadingContent}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={settingsStyles.loadingText}>Suppression en cours...</Text>
            </View>
          </View>
        )}

        <TutorialOverlay
          visible={isTutorialVisible}
          tutorial={tutorial}
          currentStep={tutorialStep}
          onNext={tutorialNext}
          onPrev={tutorialPrev}
          onClose={tutorialClose}
        />
      </SafeAreaView>
    </TutorialProvider>
  );
}
