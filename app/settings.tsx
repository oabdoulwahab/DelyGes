// app/settings.tsx
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { db } from "../src/database/db";
import { BlurView } from "expo-blur";
import { COLORS } from "../styles/colors";
import { commonStyles } from "../styles/common";
import { settingsStyles } from "../styles/settingsStyles";
// 🔥 CHANGEMENT: Importer depuis le contexte au lieu du hook
import { useAuth } from "../src/context/AuthContext";
import { useAutoSave } from "../src/hooks/useAutoSave";
import { useModal } from "../providers/ModalProvider";
import * as Updates from "expo-updates";
import * as Application from "expo-application";
// 🔥 NOUVEAU: Importer Firebase
import { auth, db as firestore } from '../src/config/firebase';
import { updateProfile, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { syncService } from '../src/services/sync.service';

type UserSettings = {
  name: string;
  email: string | null;
  phone: string;
  siret: string;
  vehicle: string;
  is_vat: number;
  monthly_goal: number;
  reminder_notifications: number;
  payment_notifications: number;
};

export default function Settings() {
  // 🔥 CHANGEMENT: useAuth vient maintenant du contexte
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

  const [settings, setSettings] = useState<UserSettings>({
    name: "",
    email: "",
    phone: "",
    siret: "",
    vehicle: "Scooter 125cc",
    is_vat: 0,
    monthly_goal: 2500,
    reminder_notifications: 1,
    payment_notifications: 1,
  });
  const { showModal, showConfirm, showSuccess, showError, showAlert } = useModal();
  const [isLoading, setIsLoading] = useState(true);

  // Fonction pour mettre à jour un champ avec auto-save ET Firebase
  const updateSetting = async (field: keyof UserSettings, value: any) => {
    // Mettre à jour l'état local
    setSettings((prev) => ({ ...prev, [field]: value }));
    
    // Sauvegarde automatique dans SQLite
    autoSave(field, value);

    // 🔥 Synchroniser avec Firebase si connecté
    if (firebaseUser) {
      try {
        const userRef = doc(firestore, 'users', firebaseUser.uid);
        
        // Cas spéciaux pour certains champs
        if (field === 'name') {
          // Mettre à jour le profil Firebase Auth
          await updateProfile(firebaseUser, { displayName: value });
        }
        
        // Mettre à jour le document Firestore
        await updateDoc(userRef, {
          [field]: value,
          updated_at: new Date().toISOString()
        });
        
        console.log(`✅ Champ ${field} synchronisé avec Firebase`);
      } catch (error) {
        console.error(`❌ Erreur synchronisation ${field}:`, error);
        showError("Erreur", "Impossible de synchroniser avec le cloud");
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
        { name: "monthly_goal", type: "REAL" },
        { name: "reminder_notifications", type: "INTEGER" },
        { name: "payment_notifications", type: "INTEGER" },
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
            console.error(`❌ Erreur ajout colonne ${column.name}:`, alterError);
          }
        } else {
          console.log(`✅ Colonne ${column.name} existe déjà`);
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

      if (userData.monthly_goal === null) {
        updates.push("monthly_goal = ?");
        params.push(2500);
      }

      if (userData.reminder_notifications === null) {
        updates.push("reminder_notifications = ?");
        params.push(1);
      }

      if (userData.payment_notifications === null) {
        updates.push("payment_notifications = ?");
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
          monthly_goal: userData.monthly_goal || 2500,
          reminder_notifications:
            userData.reminder_notifications === undefined
              ? 1
              : userData.reminder_notifications,
          payment_notifications:
            userData.payment_notifications === undefined
              ? 1
              : userData.payment_notifications,
        });

        // 🔥 Si on a un utilisateur Firebase, vérifier si des données sont plus récentes
        if (firebaseUser) {
          try {
            const userRef = doc(firestore, 'users', firebaseUser.uid);
            // Note: Pour lire un document, il faut utiliser getDoc()
            // Mais on va simplifier pour l'instant
          } catch (fbError) {
            console.log("ℹ️ Pas de document Firestore pour cet utilisateur");
          }
        }
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

  // 🔥 NOUVELLE FONCTION: Validation du mot de passe avec Firebase
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

  // 🔥 NOUVELLE FONCTION: Changer le mot de passe avec Firebase
  const handleChangePassword = async () => {
    if (!validatePassword()) return;
    if (!firebaseUser || !firebaseUser.email) {
      showError("Erreur", "Utilisateur Firebase non trouvé");
      return;
    }

    setIsChangingPassword(true);
    try {
      // Réauthentifier l'utilisateur
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        passwordData.currentPassword
      );
      
      await reauthenticateWithCredential(firebaseUser, credential);
      
      // Changer le mot de passe
      await updatePassword(firebaseUser, passwordData.newPassword);
      
      // Mettre à jour dans SQLite (optionnel, car le mot de passe est géré par Firebase)
      await db.runAsync(
        "UPDATE user SET password = ? WHERE id = ?",
        ['firebase_managed', user.id]
      );

      showSuccess("Succès", "Mot de passe modifié avec succès");
      
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordExpanded(false);
    } catch (error: any) {
      console.error("❌ Erreur changement mot de passe:", error);
      
      if (error.code === 'auth/wrong-password') {
        showError("Erreur", "Mot de passe actuel incorrect");
      } else if (error.code === 'auth/weak-password') {
        showError("Erreur", "Nouveau mot de passe trop faible");
      } else {
        showError("Erreur", "Impossible de modifier le mot de passe");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Modifiez la condition de chargement
  if (isLoading || !authReady) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={settingsStyles.loadingContainer}>
          <MaterialIcons name="settings" size={48} color={COLORS.primary} />
          <Text style={settingsStyles.loadingText}>Chargement des paramètres...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Maintenant on peut vérifier l'authentification
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

  // 🔥 NOUVELLE FONCTION: Supprimer le compte de Firebase aussi
const handleDeleteAccount = async () => {
  if (!user || !firebaseUser) {
    showError("Erreur", "Vous devez être connecté");
    return;
  }

  showConfirm(
    "Supprimer le compte",
    "Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données (locales et cloud) seront effacées. Cette action est irréversible.",
    async () => {
      try {
        console.log("🗑️ DÉBUT SUPPRESSION COMPTE");
        console.log("👤 Firebase UID:", firebaseUser.uid);
        
        // 1. Supprimer le document utilisateur dans Firestore (si existe)
        try {
          await deleteDoc(doc(firestore, 'users', firebaseUser.uid));
          console.log("✅ Document utilisateur supprimé");
        } catch (fbError) {
          console.log("ℹ️ Pas de document utilisateur ou déjà supprimé");
        }

        // 2. Supprimer les données locales
        console.log("🗑️ Suppression des données locales...");
        await db.runAsync("DELETE FROM deliveries WHERE user_id = ?", [user.id]);
        await db.runAsync("DELETE FROM merchants WHERE user_id = ?", [user.id]);
        await db.runAsync("DELETE FROM user WHERE id = ?", [user.id]);
        console.log("✅ Données locales supprimées");

        // 3. Supprimer le compte Firebase Auth
        console.log("🗑️ Suppression du compte Firebase Auth...");
        await firebaseUser.delete();
        console.log("✅ Compte Firebase Auth supprimé");

        showSuccess(
          "Compte supprimé",
          "Votre compte a été supprimé avec succès.",
        );
        
        router.replace("/register");
        
      } catch (error: any) {
        console.error("❌ Erreur suppression compte:", error);
        
        // Gestion spécifique des erreurs Firebase
        if (error.code === 'auth/requires-recent-login') {
          showError(
            "Reconnexion nécessaire", 
            "Pour des raisons de sécurité, veuillez vous reconnecter avant de supprimer votre compte."
          );
          await logout();
          router.replace("/login");
        } else {
          showError("Erreur", "Impossible de supprimer le compte: " + (error.message || "Erreur inconnue"));
        }
      }
    },
    "Supprimer définitivement",
  );
};

  const handleLogout = () => {
    showConfirm(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      async () => {
        await logout();
        router.replace("/login");
      },
      "Déconnexion",
    );
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
      {/* En-tête flou */}
      <BlurView intensity={95} style={settingsStyles.header}>
        <TouchableOpacity style={settingsStyles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={settingsStyles.headerTitle}>Paramètres</Text>

        <TouchableOpacity style={settingsStyles.saveButton} onPress={handleSave}>
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
            <Text style={[settingsStyles.profileSubtitle, { fontSize: 12, color: COLORS.primary }]}>
              ✓ Synchronisé avec le cloud
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
          <Text style={settingsStyles.sectionTitle}>CONFIGURATION FINANCIÈRE</Text>

          <View style={commonStyles.card}>
            {/* TVA */}
            <View style={settingsStyles.cardItem}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="percent" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>Assujetti à la TVA</Text>
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
                  <Text style={settingsStyles.cardItemLabel}>Rappels de saisie</Text>
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
            <View style={[settingsStyles.cardItem, settingsStyles.cardItemNoBorder]}>
              <View style={settingsStyles.cardItemLeft}>
                <MaterialIcons name="payments" size={20} color={COLORS.muted} />
                <Text style={settingsStyles.cardItemLabel}>Alertes de paiement</Text>
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
          </View>
        </View>

        {/* Section: Données & Sécurité */}
        <View style={commonStyles.section}>
          <Text style={settingsStyles.sectionTitle}>DONNÉES & SÉCURITÉ</Text>

          <View style={commonStyles.card}>
            {/* Changer le mot de passe - Menu déroulant */}
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
                name={passwordExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {/* Contenu déroulant du changement de mot de passe */}
            {passwordExpanded && (
              <View style={settingsStyles.passwordExpandedContent}>
                {/* Mot de passe actuel */}
                <View style={settingsStyles.passwordInputGroup}>
                  <Text style={settingsStyles.passwordLabel}>Mot de passe actuel</Text>
                  <TextInput
                    style={[
                      settingsStyles.passwordInput,
                      passwordErrors.currentPassword && settingsStyles.passwordInputError
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.inputPlaceholder}
                    secureTextEntry
                    value={passwordData.currentPassword}
                    onChangeText={(text) => {
                      setPasswordData({ ...passwordData, currentPassword: text });
                      setPasswordErrors({ ...passwordErrors, currentPassword: "" });
                    }}
                  />
                  {passwordErrors.currentPassword ? (
                    <Text style={settingsStyles.passwordErrorText}>
                      {passwordErrors.currentPassword}
                    </Text>
                  ) : null}
                </View>

                {/* Nouveau mot de passe */}
                <View style={settingsStyles.passwordInputGroup}>
                  <Text style={settingsStyles.passwordLabel}>Nouveau mot de passe</Text>
                  <TextInput
                    style={[
                      settingsStyles.passwordInput,
                      passwordErrors.newPassword && settingsStyles.passwordInputError
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

                {/* Confirmer nouveau mot de passe */}
                <View style={settingsStyles.passwordInputGroup}>
                  <Text style={settingsStyles.passwordLabel}>Confirmer le mot de passe</Text>
                  <TextInput
                    style={[
                      settingsStyles.passwordInput,
                      passwordErrors.confirmPassword && settingsStyles.passwordInputError
                    ]}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.inputPlaceholder}
                    secureTextEntry
                    value={passwordData.confirmPassword}
                    onChangeText={(text) => {
                      setPasswordData({ ...passwordData, confirmPassword: text });
                      setPasswordErrors({ ...passwordErrors, confirmPassword: "" });
                    }}
                  />
                  {passwordErrors.confirmPassword ? (
                    <Text style={settingsStyles.passwordErrorText}>
                      {passwordErrors.confirmPassword}
                    </Text>
                  ) : null}
                </View>

                {/* Bouton de confirmation */}
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
        <TouchableOpacity style={settingsStyles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={COLORS.danger} />
          <Text style={settingsStyles.logoutButtonText}>Déconnexion</Text>
        </TouchableOpacity>
         <View style={settingsStyles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}