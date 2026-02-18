import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  Switch,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { db } from "../src/database/db";
import { BlurView } from "expo-blur";
import { COLORS } from "../styles/colors";
import { commonStyles } from "../styles/common";
import { settingsStyles as styles } from "../styles/settingsStyles";
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
  const { user, isAuthenticated, logout, authReady } = useAuth(); // Ajout de authReady
  const [appVersion, setAppVersion] = useState("");

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

  // Modifiez la condition de chargement
  if (isLoading || !authReady) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="settings" size={48} color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement des paramètres...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Maintenant on peut vérifier l'authentification
  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.authErrorContainer}>
          <MaterialIcons name="error-outline" size={48} color={COLORS.danger} />
          <Text style={styles.authErrorText}>Non connecté</Text>
          <TouchableOpacity
            style={styles.authErrorButton}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.authErrorButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Le reste du code reste inchangé...
  const handleSave = () => {
    showAlert(
      "Sauvegarde",
      "Les modifications sont enregistrées automatiquement ✅",
    );
  };

  const handleChangePassword = () => {
    showAlert(
      "Changer le mot de passe",
      "Cette fonctionnalité sera disponible prochainement.",
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
          ); // REMPLACER
          await logout();
          router.replace("/register");
        } catch (error) {
          console.error("❌ Erreur suppression compte:", error);
          showError("Erreur", "Impossible de supprimer le compte"); // REMPLACER
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
    const handleVehicleSelect = () => {
      // Utiliser showModal au lieu de showConfirm car on a plusieurs boutons
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
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      {/* En-tête flou */}
      <BlurView intensity={95}  style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Paramètres</Text>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}></Text>
        </TouchableOpacity>
      </BlurView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Section Profil */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImage}>
              <MaterialIcons name="person" size={48} color={COLORS.primary} />
            </View>
            <View style={styles.onlineIndicator}>
              <View style={styles.onlineDot} />
            </View>
          </View>

          <Text style={styles.profileName}>
            {settings.name || user.name || "Utilisateur"}
          </Text>
          <Text style={styles.profileSubtitle}>
            {user.phone ? `${user.phone} ` : ""}
            {/* En ligne */}
          </Text>
          {/* <Text style={styles.userIdText}>ID: {user.id}</Text> */}
        </View>

        {/* Section: Profil Professionnel */}
        <View style={commonStyles.section}>
          <Text style={styles.sectionTitle}>PROFIL PROFESSIONNEL</Text>

          <View style={commonStyles.card}>
            {/* Nom */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="badge" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>Nom complet</Text>
              </View>
              <TextInput
                style={styles.cardItemInput}
                value={settings.name}
                onChangeText={(text) => updateSetting("name", text)}
                placeholder="Votre nom"
                placeholderTextColor="#92c992"
              />
            </View>

            {/* Email */}
            {user.email && (
              <View style={styles.cardItem}>
                <View style={styles.cardItemLeft}>
                  <MaterialIcons name="email" size={20} color={COLORS.muted} />
                  <Text style={styles.cardItemLabel}>Email</Text>
                </View>
                <Text style={styles.cardItemValue}>{user.email}</Text>
              </View>
            )}

            {/* Téléphone */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="phone" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>Téléphone</Text>
              </View>
              <Text style={styles.cardItemValue}>{user.phone}</Text>
            </View>

            {/* SIRET */}
            {/* <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons
                  name="fingerprint"
                  size={20}
                  color={COLORS.muted}
                />
                <Text style={styles.cardItemLabel}>SIRET</Text>
              </View>
              <TextInput
                style={styles.cardItemInput}
                value={settings.siret}
                onChangeText={(text) => updateSetting("siret", text)}
                placeholder="Numéro SIRET"
                placeholderTextColor="#92c992"
                keyboardType="numeric"
              />
            </View> */}

            {/* Véhicule */}
            {/* <TouchableOpacity
              style={styles.cardItem}
              onPress={handleVehicleSelect}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons
                  name="local-shipping"
                  size={20}
                  color={COLORS.muted}
                />
                <Text style={styles.cardItemLabel}>Véhicule</Text>
              </View>
              <View style={styles.cardItemRight}>
                <Text style={styles.cardItemValue}>{settings.vehicle}</Text>
                <MaterialIcons
                  name="arrow-forward-ios"
                  size={14}
                  color={COLORS.muted}
                />
              </View>
            </TouchableOpacity> */}
          </View>
        </View>

        {/* Section: Configuration Financière */}
        <View style={commonStyles.section}>
          <Text style={styles.sectionTitle}>CONFIGURATION FINANCIÈRE</Text>

          <View style={commonStyles.card}>
            {/* TVA */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="percent" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>Assujetti à la TVA</Text>
              </View>
              <Switch
                value={settings.is_vat === 1}
                onValueChange={(value) =>
                  updateSetting("is_vat", value ? 1 : 0)
                }
                trackColor={{ false: "#374151", true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            {/* Objectif Mensuel */}
            {/* <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="savings" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>
                  Objectif mensuel (FCFA)
                </Text>
              </View>
              <View style={styles.goalInputContainer}>
                <TextInput
                  style={styles.goalInput}
                  value={String(settings.monthly_goal)}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, "");
                    const numValue = cleaned ? parseInt(cleaned, 10) : 0;
                    updateSetting("monthly_goal", numValue);
                  }}
                  placeholder="2500"
                  placeholderTextColor="#92c992"
                  keyboardType="numeric"
                />
                <Text style={styles.currency}>FCFA</Text>
              </View>
            </View> */}
          </View>
        </View>

        {/* Section: Notifications */}
        <View style={commonStyles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

          <View style={commonStyles.card}>
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => router.push("/notification-settings")}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons
                  name="notifications"
                  size={20}
                  color={COLORS.muted}
                />
                <Text style={styles.cardItemLabel}>
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
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons
                  name="edit-notifications"
                  size={20}
                  color={COLORS.muted}
                />
                <View style={styles.notificationContent}>
                  <Text style={styles.cardItemLabel}>Rappels de saisie</Text>
                  <Text style={styles.notificationSubtitle}>
                    Pour ne pas oublier vos km
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.reminder_notifications === 1}
                onValueChange={(value) =>
                  updateSetting("reminder_notifications", value ? 1 : 0)
                }
                trackColor={{ false: "#374151", true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            {/* Alertes de paiement */}
            <View style={[styles.cardItem, styles.cardItemNoBorder]}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="payments" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>Alertes de paiement</Text>
              </View>
              <Switch
                value={settings.payment_notifications === 1}
                onValueChange={(value) =>
                  updateSetting("payment_notifications", value ? 1 : 0)
                }
                trackColor={{ false: "#374151", true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        </View>

        {/* Section: Données & Sécurité */}
        <View style={commonStyles.section}>
          <Text style={styles.sectionTitle}>DONNÉES & SÉCURITÉ</Text>

          <View style={commonStyles.card}>
            {/* Changer le mot de passe */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={handleChangePassword}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons
                  name="lock-reset"
                  size={20}
                  color={COLORS.muted}
                />
                <Text style={styles.cardItemLabel}>
                  Changer le mot de passe
                </Text>
              </View>
              <MaterialIcons
                name="arrow-forward-ios"
                size={14}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {/* Exporter les données */}
            <TouchableOpacity
              style={styles.cardItem}
              onPress={handleExportData}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="download" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>
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
              style={[styles.cardItem, styles.cardItemDanger]}
              onPress={handleDeleteAccount}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons
                  name="delete-forever"
                  size={20}
                  color={COLORS.danger}
                />
                <Text style={styles.cardItemLabelDanger}>
                  Supprimer le compte
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bouton de déconnexion */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={COLORS.danger} />
          <Text style={styles.logoutButtonText}>Déconnexion</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>
          {/* Version {appVersion} • Dernière mise à jour:{" "}
          {new Date().toLocaleDateString("fr-FR")} */}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
