import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { db } from "../src/database/db";
import { BlurView } from "expo-blur";
import { COLORS } from "../styles/colors";
import { commonStyles } from "../styles/common";
import { settingsStyles } from "../styles/settingsStyles";
import { useAuth } from "../src/context/AuthContext";
import { useAutoSave } from "../src/hooks/useAutoSave";
import { useModal } from "../providers/ModalProvider";
import * as Updates from "expo-updates";
import * as Application from "expo-application";
import { auth, db as firestore } from "../src/config/firebase";
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";

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
};

export default function Settings() {
  const { user, isAuthenticated, logout, authReady, firebaseUser } = useAuth();
  const [appVersion, setAppVersion] = useState("");
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

  // États pour les modales
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [settings, setSettings] = useState<UserSettings>({
    name: "",
    email: "",
    phone: "",
    siret: "",
    vehicle: "Scooter 125cc",
    is_vat: 0,
    daily_goal:0 ,
    monthly_goal: 0,
    reminder_notifications: 1,
    payment_notifications: 1,
    daily_goal_notifications: 1,
  });
  const { showModal, showConfirm, showSuccess, showError, showAlert } =
    useModal();
  const [isLoading, setIsLoading] = useState(true);

  // Fonction pour mettre à jour un champ avec auto-save ET Firebase
  const updateSetting = async (field: keyof UserSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    autoSave(field, value);

    if (firebaseUser) {
      try {
        const userRef = doc(firestore, "users", firebaseUser.uid);

        if (field === "name") {
          await updateProfile(firebaseUser, { displayName: value });
        }

        await updateDoc(userRef, {
          [field]: value,
          updated_at: new Date().toISOString(),
        });

        console.log(`✅ Champ ${field} synchronisé avec Firebase`);
      } catch (error) {
        console.error(`❌ Erreur synchronisation ${field}:`, error);
      }
    }
  };

  // Ajouter les colonnes manquantes à la table user
  const addMissingColumns = async () => {
    try {
      const userSchema = await db.getAllAsync<any>("PRAGMA table_info(user)");

      const columnsToAdd = [
        { name: "siret", type: "TEXT" },
        { name: "vehicle", type: "TEXT" },
        { name: "is_vat", type: "INTEGER" },
        { name: "daily_goal", type: "REAL DEFAULT  " },
        { name: "monthly_goal", type: "REAL DEFAULT 0" },
        { name: "reminder_notifications", type: "INTEGER DEFAULT 1" },
        { name: "payment_notifications", type: "INTEGER DEFAULT 1" },
        { name: "daily_goal_notifications", type: "INTEGER DEFAULT 1" },
      ];

      for (const column of columnsToAdd) {
        const exists = userSchema.some((col) => col.name === column.name);
        if (!exists) {
          console.log(`➕ Ajout colonne user.${column.name}`);
          try {
            await db.execAsync(
              `ALTER TABLE user ADD COLUMN ${column.name} ${column.type}`,
            );
            console.log(`✅ Colonne ${column.name} ajoutée avec succès`);
          } catch (alterError) {
            console.error(
              `❌ Erreur ajout colonne ${column.name}:`,
              alterError,
            );
          }
        }
      }
    } catch (error) {
      console.error("❌ Erreur vérification schéma:", error);
    }
  };

  // Mettre à jour les valeurs par défaut
  const setDefaultValues = async () => {
    if (!user) return;

    try {
      const userData = await db.getFirstAsync<any>(
        "SELECT * FROM user WHERE id = ?",
        [user.id],
      );

      const updates: string[] = [];
      const params: any[] = [];

      if (!userData.siret || userData.siret === null) {
        updates.push("siret = ?");
        params.push("");
      }

      if (!userData.vehicle || userData.vehicle === null) {
        updates.push("vehicle = ?");
        params.push("Scooter 125cc");
      }

      if (userData.is_vat === null) {
        updates.push("is_vat = ?");
        params.push(0);
      }

      if (userData.daily_goal === null) {
        updates.push("daily_goal = ?");
        params.push( );
      }

      if (userData.monthly_goal === null) {
        updates.push("monthly_goal = ?");
        params.push(0);
      }

      if (userData.reminder_notifications === null) {
        updates.push("reminder_notifications = ?");
        params.push(1);
      }

      if (userData.payment_notifications === null) {
        updates.push("payment_notifications = ?");
        params.push(1);
      }

      if (userData.daily_goal_notifications === null) {
        updates.push("daily_goal_notifications = ?");
        params.push(1);
      }

      if (updates.length > 0) {
        params.push(user.id);
        const query = `UPDATE user SET ${updates.join(", ")} WHERE id = ?`;
        await db.runAsync(query, params);
        console.log("✅ Valeurs par défaut mises à jour");
      }
    } catch (error) {
      console.error("❌ Erreur mise à jour valeurs par défaut:", error);
    }
  };

  // Charger les paramètres de l'utilisateur
  const loadUserSettings = async () => {
    if (!user) return;

    try {
      await addMissingColumns();
      await setDefaultValues();

      const userData = await db.getFirstAsync<any>(
        "SELECT * FROM user WHERE id = ?",
        [user.id],
      );

      if (userData) {
        console.log("📋 Données utilisateur chargées:", userData);

        setSettings({
          name: userData.name || "",
          email: userData.email || "",
          phone: userData.phone || "",
          siret: userData.siret || "",
          vehicle: userData.vehicle || "Scooter 125cc",
          is_vat: userData.is_vat || 0,
          daily_goal: userData.daily_goal || 0,
          monthly_goal: userData.monthly_goal || 0,
          reminder_notifications: userData.reminder_notifications ?? 1,
          payment_notifications: userData.payment_notifications ?? 1,
          daily_goal_notifications: userData.daily_goal_notifications ?? 1,
        });
      }
    } catch (error) {
      console.error("❌ Erreur lors du chargement des paramètres:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const buildVersion = Application.nativeApplicationVersion ?? "unknown";
    const buildNumber = Application.nativeBuildVersion ?? "0";
    const runtimeVersion = Updates.runtimeVersion ?? buildVersion;
    const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : "build";

    setAppVersion(`${runtimeVersion} (build ${buildNumber}, ${updateId})`);

    if (authReady && isAuthenticated && user) {
      loadUserSettings();
    } else if (authReady && !isAuthenticated) {
      setIsLoading(false);
    }
  }, [authReady, isAuthenticated, user, firebaseUser]);

  const validatePassword = () => {
    const errors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };
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

      await db.runAsync("UPDATE user SET password = ? WHERE id = ?", [
        "firebase_managed",
        user.id,
      ]);

      showSuccess("Succès", "Mot de passe modifié avec succès");

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordExpanded(false);
    } catch (error: any) {
      console.error("❌ Erreur changement mot de passe:", error);

      if (error.code === "auth/wrong-password") {
        showError("Erreur", "Mot de passe actuel incorrect");
      } else if (error.code === "auth/weak-password") {
        showError("Erreur", "Nouveau mot de passe trop faible");
      } else {
        showError("Erreur", "Impossible de modifier le mot de passe");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading || !authReady) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={settingsStyles.loadingContainer}>
          <MaterialIcons name="settings" size={48} color={COLORS.primary} />
          <Text style={settingsStyles.loadingText}>
            Chargement des paramètres...
          </Text>
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

  const handleSave = () => {
    showAlert(
      "Sauvegarde",
      "Les modifications sont enregistrées automatiquement ✅",
    );
  };

  const handleExportData = async () => {
    if (!user) {
      showError("Erreur", "Vous devez être connecté");
      return;
    }

    try {
      const deliveries = await db.getAllAsync<any>(
        "SELECT * FROM deliveries WHERE user_id = ? ORDER BY created_at DESC",
        [user.id],
      );

      showAlert(
        "Exporter les données",
        `Prêt à exporter ${deliveries.length} livraisons.\n\nFonctionnalité d'export CSV en développement.`,
      );
    } catch (error) {
      console.error("❌ Erreur lors de l'export:", error);
      showError("Erreur", "Impossible d'exporter les données");
    }
  };

  // Gestion de la suppression de compte
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
      console.log("🔄 Réauthentification...");

      const credential = EmailAuthProvider.credential(
        firebaseUser!.email!,
        deletePassword,
      );

      await reauthenticateWithCredential(firebaseUser!, credential);
      console.log("✅ Réauthentification réussie");

      setShowDeleteConfirmModal(true);
      setIsDeleting(false);
      
    } catch (error: any) {
      console.error("❌ Erreur réauthentification:", error);

      if (error.code === "auth/wrong-password") {
        showError("Erreur", "Mot de passe incorrect");
      } else if (error.code === "auth/too-many-requests") {
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
      console.log("🗑️ SUPPRESSION FINALE...");

      await deleteDoc(doc(firestore, "users", firebaseUser!.uid));
      console.log("✅ Document utilisateur supprimé");

      await db.runAsync("DELETE FROM deliveries WHERE user_id = ?", [user.id]);
      await db.runAsync("DELETE FROM merchants WHERE user_id = ?", [user.id]);
      await db.runAsync("DELETE FROM user WHERE id = ?", [user.id]);
      console.log("✅ Données locales supprimées");

      await firebaseUser!.delete();
      console.log("✅ Compte Firebase Auth supprimé");

      showSuccess(
        "Compte supprimé",
        "Votre compte a été supprimé avec succès.",
      );

      await logout();
      router.replace("/register");
    } catch (error: any) {
      console.error("❌ Erreur suppression:", error);

      if (error.code === "auth/requires-recent-login") {
        showError(
          "Erreur",
          "Session expirée. Veuillez vous reconnecter.",
        );
        await logout();
        router.replace("/login");
      } else {
        showError("Erreur", "Impossible de supprimer le compte");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Gestion de la déconnexion
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace("/login");
  };

  const handleBack = () => {
    router.back();
  };

  const handleVehicleSelect = () => {
    showModal({
      title: "Sélectionner un véhicule",
      message: "Choisissez votre type de véhicule :",
      type: "confirm",
      buttons: [
        {
          text: "Scooter 125cc",
          onPress: () => updateSetting("vehicle", "Scooter 125cc"),
        },
        { text: "Moto", onPress: () => updateSetting("vehicle", "Moto") },
        {
          text: "Voiture",
          onPress: () => updateSetting("vehicle", "Voiture"),
        },
        { text: "Vélo", onPress: () => updateSetting("vehicle", "Vélo") },
        {
          text: "Camionnette",
          onPress: () => updateSetting("vehicle", "Camionnette"),
        },
        { text: "Annuler", style: "cancel" },
      ],
    });
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <BlurView intensity={95} style={settingsStyles.header}>
        <TouchableOpacity
          style={settingsStyles.backButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={settingsStyles.headerTitle}>Paramètres</Text>

        <TouchableOpacity
          style={settingsStyles.saveButton}
          onPress={handleSave}
        >
          <Text style={settingsStyles.saveButtonText}></Text>
        </TouchableOpacity>
      </BlurView>

      <ScrollView
        style={settingsStyles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={settingsStyles.scrollContent}
      >
        {/* Section Profil */}
        <View style={settingsStyles.profileSection}>
          <View style={settingsStyles.profileImageContainer}>
            <View style={settingsStyles.profileImage}>
              <MaterialIcons name="person" size={48} color={COLORS.primary} />
            </View>
            <View style={settingsStyles.onlineIndicator}>
              <View style={settingsStyles.onlineDot} />
            </View>
          </View>

          <Text style={settingsStyles.profileName}>
            {settings.name || user.name || "Utilisateur"}
          </Text>
          <Text style={settingsStyles.profileSubtitle}>
            {user.phone ? `${user.phone}` : ""}
          </Text>
          {firebaseUser && (
            <Text
              style={[
                settingsStyles.profileSubtitle,
                { fontSize: 12, color: COLORS.primary },
              ]}
            >
              ✓ En ligne
            </Text>
          )}
        </View>

        {/* Section: Profil Professionnel */}
        <View style={commonStyles.section}>
          <Text style={settingsStyles.sectionTitle}>PROFIL PROFESSIONNEL</Text>

          <View style={commonStyles.card}>
            {/* Nom */}
            <View style={settingsStyles.cardItem}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="badge" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>Nom complet</Text>
              </View>
              <TextInput
                style={settingsStyles.cardItemInput}
                value={settings.name}
                onChangeText={(text) => updateSetting("name", text)}
                placeholder="Votre nom"
                placeholderTextColor={COLORS.inputPlaceholder}
              />
            </View>

            {/* Email */}
            {user.email && (
              <View style={settingsStyles.cardItem}>
                <View style={settingsStyles.cardItemLeft}>
                  <MaterialIcons name="email" size={20} color={COLORS.muted} />
                  <Text style={settingsStyles.cardItemLabel}>Email</Text>
                </View>
                <Text style={settingsStyles.cardItemValue}>{user.email}</Text>
              </View>
            )}

            {/* Téléphone */}
            <View style={settingsStyles.cardItem}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="phone" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>Téléphone</Text>
              </View>
              <Text style={settingsStyles.cardItemValue}>{user.phone}</Text>
            </View>
          </View>
        </View>

        {/* Section: Configuration Financière */}
        <View style={commonStyles.section}>
          <Text style={settingsStyles.sectionTitle}>
            CONFIGURATION FINANCIÈRE
          </Text>

          <View style={commonStyles.card}>
            {/* TVA */}
            <View style={settingsStyles.cardItem}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="percent" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>
                  Assujetti à la TVA
                </Text>
              </View>
              <Switch
                value={settings.is_vat === 1}
                onValueChange={(value) =>
                  updateSetting("is_vat", value ? 1 : 0)
                }
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        </View>

        {/* Section: Objectifs */}
        <View style={commonStyles.section}>
          <Text style={settingsStyles.sectionTitle}>OBJECTIFS</Text>

          <View style={commonStyles.card}>
            {/* Objectif quotidien */}
            <View style={settingsStyles.cardItem}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="flag" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>
                  Objectif quotidien
                </Text>
              </View>
              <View style={settingsStyles.goalInputContainer}>
                <TextInput
                  style={settingsStyles.goalInput}
                  value={settings.daily_goal?.toString() || " "}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, "");
                    updateSetting(
                      "daily_goal",
                      numericValue ? parseInt(numericValue) : 0,
                    );
                  }}
                  keyboardType="numeric"
                  placeholder=" "
                  placeholderTextColor={COLORS.muted}
                />
                <Text style={settingsStyles.currency}>FCFA</Text>
              </View>
            </View>

            {/* Objectif mensuel */}
            <View style={settingsStyles.cardItem}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="flag" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>
                  Objectif mensuel
                </Text>
              </View>
              <View style={settingsStyles.goalInputContainer}>
                <TextInput
                  style={settingsStyles.goalInput}
                  value={settings.monthly_goal?.toString() || "0"}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, "");
                    updateSetting(
                      "monthly_goal",
                      numericValue ? parseInt(numericValue) : 0,
                    );
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.muted}
                />
                <Text style={settingsStyles.currency}>FCFA</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Notifications */}
        <View style={commonStyles.section}>
          <Text style={settingsStyles.sectionTitle}>NOTIFICATIONS</Text>

          <View style={commonStyles.card}>
            <TouchableOpacity
              style={settingsStyles.cardItem}
              onPress={() => router.push("/notification-settings")}
            >
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons
                  name="notifications"
                  size={20}
                  color={COLORS.muted}
                />
                <Text style={settingsStyles.cardItemLabel}>
                  Gérer les notifications
                </Text>
              </View>
              <MaterialIcons
                name="arrow-forward-ios"
                size={14}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {/* Rappels de saisie */}
            <View style={settingsStyles.cardItem}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons
                  name="edit-notifications"
                  size={20}
                  color={COLORS.muted}
                />
                <View style={settingsStyles.notificationContent}>
                  <Text style={settingsStyles.cardItemLabel}>
                    Rappels de saisie
                  </Text>
                  <Text style={settingsStyles.notificationSubtitle}>
                    Pour ne pas oublier vos km
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.reminder_notifications === 1}
                onValueChange={(value) =>
                  updateSetting("reminder_notifications", value ? 1 : 0)
                }
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            {/* Alertes de paiement */}
            <View style={settingsStyles.cardItem}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="payments" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>
                  Alertes de paiement
                </Text>
              </View>
              <Switch
                value={settings.payment_notifications === 1}
                onValueChange={(value) =>
                  updateSetting("payment_notifications", value ? 1 : 0)
                }
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            {/* Notification objectif atteint */}
            <View
              style={[settingsStyles.cardItem, settingsStyles.cardItemNoBorder]}
            >
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons
                  name="emoji-events"
                  size={20}
                  color={COLORS.muted}
                />
                <Text style={settingsStyles.cardItemLabel}>
                  Objectif atteint
                </Text>
              </View>
              <Switch
                value={settings.daily_goal_notifications === 1}
                onValueChange={(value) =>
                  updateSetting("daily_goal_notifications", value ? 1 : 0)
                }
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        </View>

        {/* Section: Données & Sécurité */}
        <View style={commonStyles.section}>
          <Text style={settingsStyles.sectionTitle}>DONNÉES & SÉCURITÉ</Text>

          <View style={commonStyles.card}>
            {/* Changer le mot de passe */}
            <TouchableOpacity
              style={settingsStyles.cardItem}
              onPress={() => setPasswordExpanded(!passwordExpanded)}
            >
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons
                  name={passwordExpanded ? "lock-open" : "lock"}
                  size={20}
                  color={COLORS.muted}
                />
                <Text style={settingsStyles.cardItemLabel}>
                  Changer le mot de passe
                </Text>
              </View>
              <MaterialIcons
                name={
                  passwordExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"
                }
                size={24}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {/* Contenu déroulant du changement de mot de passe */}
            {passwordExpanded && (
              <View style={settingsStyles.passwordExpandedContent}>
                <View style={settingsStyles.passwordInputGroup}>
                  <Text style={settingsStyles.passwordLabel}>
                    Mot de passe actuel
                  </Text>
                  <TextInput
                    style={[
                      settingsStyles.passwordInput,
                      passwordErrors.currentPassword &&
                        settingsStyles.passwordInputError,
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.inputPlaceholder}
                    secureTextEntry
                    value={passwordData.currentPassword}
                    onChangeText={(text) => {
                      setPasswordData({
                        ...passwordData,
                        currentPassword: text,
                      });
                      setPasswordErrors({
                        ...passwordErrors,
                        currentPassword: "",
                      });
                    }}
                  />
                  {passwordErrors.currentPassword ? (
                    <Text style={settingsStyles.passwordErrorText}>
                      {passwordErrors.currentPassword}
                    </Text>
                  ) : null}
                </View>

                <View style={settingsStyles.passwordInputGroup}>
                  <Text style={settingsStyles.passwordLabel}>
                    Nouveau mot de passe
                  </Text>
                  <TextInput
                    style={[
                      settingsStyles.passwordInput,
                      passwordErrors.newPassword &&
                        settingsStyles.passwordInputError,
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.inputPlaceholder}
                    secureTextEntry
                    value={passwordData.newPassword}
                    onChangeText={(text) => {
                      setPasswordData({ ...passwordData, newPassword: text });
                      setPasswordErrors({ ...passwordErrors, newPassword: "" });
                    }}
                  />
                  {passwordErrors.newPassword ? (
                    <Text style={settingsStyles.passwordErrorText}>
                      {passwordErrors.newPassword}
                    </Text>
                  ) : null}
                  <Text style={settingsStyles.passwordHint}>
                    Minimum 6 caractères
                  </Text>
                </View>

                <View style={settingsStyles.passwordInputGroup}>
                  <Text style={settingsStyles.passwordLabel}>
                    Confirmer le mot de passe
                  </Text>
                  <TextInput
                    style={[
                      settingsStyles.passwordInput,
                      passwordErrors.confirmPassword &&
                        settingsStyles.passwordInputError,
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.inputPlaceholder}
                    secureTextEntry
                    value={passwordData.confirmPassword}
                    onChangeText={(text) => {
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: text,
                      });
                      setPasswordErrors({
                        ...passwordErrors,
                        confirmPassword: "",
                      });
                    }}
                  />
                  {passwordErrors.confirmPassword ? (
                    <Text style={settingsStyles.passwordErrorText}>
                      {passwordErrors.confirmPassword}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={settingsStyles.passwordConfirmButton}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={settingsStyles.passwordConfirmButtonText}>
                      Mettre à jour le mot de passe
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Exporter les données */}
            <TouchableOpacity
              style={settingsStyles.cardItem}
              onPress={handleExportData}
            >
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="download" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>
                  Exporter les données (CSV)
                </Text>
              </View>
              <MaterialIcons
                name="arrow-forward-ios"
                size={14}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {/* Supprimer le compte */}
            <TouchableOpacity
              style={[settingsStyles.cardItem, settingsStyles.cardItemDanger]}
              onPress={handleDeleteAccount}
            >
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons
                  name="delete-forever"
                  size={20}
                  color={COLORS.danger}
                />
                <Text style={settingsStyles.cardItemLabelDanger}>
                  Supprimer le compte
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bouton de déconnexion */}
        <TouchableOpacity
          style={settingsStyles.logoutButton}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={20} color={COLORS.danger} />
          <Text style={settingsStyles.logoutButtonText}>Déconnexion</Text>
        </TouchableOpacity>

        {/* Version de l'app */}
        <Text style={settingsStyles.versionText}>Version {appVersion}</Text>
        <View style={settingsStyles.bottomSpacer} />

        {/* MODALES */}

        {/* Modale pour saisir le mot de passe */}
        <Modal
          visible={showPasswordModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={settingsStyles.modalTitle}>
                Confirmation de sécurité
              </Text>
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

              <View style={settingsStyles.modalButtonsContainer}>
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
                  <Text style={settingsStyles.modalButtonTextDanger}>
                    Continuer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale de confirmation de déconnexion */}
        <Modal
          visible={showLogoutModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLogoutModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={settingsStyles.modalTitle}>
                Déconnexion
              </Text>
              <Text style={settingsStyles.modalMessage}>
                Êtes-vous sûr de vouloir vous déconnecter ?
              </Text>

              <View style={settingsStyles.modalButtonsContainer}>
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
                  <Text style={settingsStyles.modalButtonTextDanger}>
                    Déconnexion
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale de confirmation finale de suppression */}
        <Modal
          visible={showDeleteConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirmModal(false)}
        >
          <View style={settingsStyles.modalOverlay}>
            <View style={settingsStyles.modalContent}>
              <Text style={settingsStyles.modalTitle}>
                Supprimer le compte
              </Text>
              <Text style={settingsStyles.modalMessage}>
                Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données (locales et cloud) seront effacées. Cette action est irréversible.
              </Text>

              <View style={settingsStyles.modalButtonsContainer}>
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
                  <Text style={settingsStyles.modalButtonTextDanger}>
                    Supprimer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Indicateur de chargement pendant la suppression */}
        {isDeleting && (
          <View style={settingsStyles.loadingOverlay}>
            <View style={settingsStyles.loadingContent}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={settingsStyles.loadingText}>
                Suppression en cours...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}