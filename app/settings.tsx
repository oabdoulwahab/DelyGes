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
import { useAuth } from "../src/hooks/useAuth";
import { useAutoSave } from "../src/hooks/useAutoSave";
import { useModal } from "../providers/ModalProvider";
import * as Updates from "expo-updates";
import * as Application from "expo-application";

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
  const { user, isAuthenticated, logout, authReady } = useAuth();
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
  const { showModal, showConfirm, showSuccess, showError, showAlert } =
    useModal();
  const [isLoading, setIsLoading] = useState(true);

  // Fonction pour mettre à jour un champ avec auto-save
  const updateSetting = (field: keyof UserSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    autoSave(field, value);
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
            console.error(
              `❌ Erreur ajout colonne ${column.name}:`,
              alterError,
            );
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
  }, [authReady, isAuthenticated, user]);

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

    setIsChangingPassword(true);
    try {
      // Vérifier l'ancien mot de passe
      const userData = await db.getFirstAsync<any>(
        "SELECT password FROM user WHERE id = ?",
        [user.id]
      );

      if (userData.password !== passwordData.currentPassword) {
        showError("Erreur", "Mot de passe actuel incorrect");
        setIsChangingPassword(false);
        return;
      }

      // Mettre à jour le mot de passe
      await db.runAsync(
        "UPDATE user SET password = ? WHERE id = ?",
        [passwordData.newPassword, user.id]
      );

      showSuccess("Succès", "Mot de passe modifié avec succès");
      
      // Réinitialiser le formulaire et replier
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordExpanded(false);
    } catch (error) {
      console.error("❌ Erreur changement mot de passe:", error);
      showError("Erreur", "Impossible de modifier le mot de passe");
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

  const handleDeleteAccount = async () => {
    if (!user) {
      showError("Erreur", "Vous devez être connecté");
      return;
    }

    showConfirm(
      "Supprimer le compte",
      "Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données seront effacées. Cette action est irréversible.",
      async () => {
        try {
          await db.runAsync("DELETE FROM deliveries WHERE user_id = ?", [
            user.id,
          ]);
          await db.runAsync("DELETE FROM user WHERE id = ?", [user.id]);

          showSuccess(
            "Compte supprimé",
            "Votre compte a été supprimé avec succès.",
          );
          await logout();
          router.replace("/register");
        } catch (error) {
          console.error("❌ Erreur suppression compte:", error);
          showError("Erreur", "Impossible de supprimer le compte");
        }
      },
      "Supprimer",
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