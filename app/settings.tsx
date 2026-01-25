import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, SafeAreaView, Switch } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { db } from "../src/database/db";
import { BlurView } from 'expo-blur';
import { COLORS } from "../styles/colors";
import { commonStyles } from "../styles/common";
import { settingsStyles as styles } from "../styles/settingsStyles";
import { useAuth } from "../src/hooks/useAuth";

type UserSettings = {
  name: string;
  email: string | null;
  phone: string;
  siret: string;
  vehicle: string;
  is_vat: number; // Changé en number
  monthly_goal: number; // Changé en number
  reminder_notifications: number; // Changé en number
  payment_notifications: number; // Changé en number
};

export default function Settings() {
  const { user, isAuthenticated, logout } = useAuth();
  
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

  const [isLoading, setIsLoading] = useState(true);

  // Ajouter les colonnes manquantes à la table user
  const addMissingColumns = async () => {
    try {
      const userSchema = await db.getAllAsync<any>("PRAGMA table_info(user)");
      
      const columnsToAdd = [
        { name: 'siret', type: 'TEXT' },
        { name: 'vehicle', type: 'TEXT' },
        { name: 'is_vat', type: 'INTEGER' },
        { name: 'monthly_goal', type: 'REAL' },
        { name: 'reminder_notifications', type: 'INTEGER' },
        { name: 'payment_notifications', type: 'INTEGER' },
      ];

      for (const column of columnsToAdd) {
        const exists = userSchema.some(col => col.name === column.name);
        if (!exists) {
          console.log(`➕ Ajout colonne user.${column.name}`);
          try {
            await db.execAsync(`ALTER TABLE user ADD COLUMN ${column.name} ${column.type}`);
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
      // Vérifier si les colonnes sont vides et leur donner des valeurs par défaut
      const userData = await db.getFirstAsync<any>(
        "SELECT * FROM user WHERE id = ?",
        [user.id]
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
        [user.id]
      );

      if (userData) {
        console.log("📋 Données utilisateur chargées:", userData);
        console.log("SIRET:", userData.siret);
        console.log("Vehicle:", userData.vehicle);
        console.log("is_vat:", userData.is_vat);
        console.log("monthly_goal:", userData.monthly_goal);
        
        setSettings({
          name: userData.name || "",
          email: userData.email || "",
          phone: userData.phone || "",
          siret: userData.siret || "",
          vehicle: userData.vehicle || "Scooter 125cc",
          is_vat: userData.is_vat || 0,
          monthly_goal: userData.monthly_goal || 2500,
          reminder_notifications: userData.reminder_notifications === undefined ? 1 : userData.reminder_notifications,
          payment_notifications: userData.payment_notifications === undefined ? 1 : userData.payment_notifications,
        });
      }
    } catch (error) {
      console.error("❌ Erreur lors du chargement des paramètres:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserSettings();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert("Erreur", "Vous devez être connecté");
      return;
    }

    try {
      console.log("💾 Enregistrement des paramètres:", settings);
      
      // Vérifier que les colonnes existent avant la mise à jour
      await addMissingColumns();
      
      // Mettre à jour les informations dans la base de données
      const result = await db.runAsync(
        `UPDATE user SET 
          name = ?, 
          siret = ?, 
          vehicle = ?, 
          is_vat = ?, 
          monthly_goal = ?, 
          reminder_notifications = ?, 
          payment_notifications = ?,
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [
          settings.name,
          settings.siret,
          settings.vehicle,
          settings.is_vat,
          settings.monthly_goal,
          settings.reminder_notifications,
          settings.payment_notifications,
          user.id
        ]
      );
      
      console.log("✅ Résultat mise à jour:", result);
      
      // Recharger pour vérifier
      const updatedUser = await db.getFirstAsync<any>(
        "SELECT * FROM user WHERE id = ?",
        [user.id]
      );
      console.log("✅ Utilisateur après mise à jour:", updatedUser);
      
      Alert.alert("Succès", "Paramètres enregistrés avec succès !");
    } catch (error: any) {
      console.error("❌ Erreur lors de l'enregistrement:", error);
      console.error("Stack trace:", error.stack);
      
      let errorMessage = "Impossible d'enregistrer les paramètres";
      if (error.message?.includes("UNIQUE constraint failed")) {
        errorMessage = "Ce numéro de téléphone est déjà utilisé";
      } else if (error.message?.includes("no such column")) {
        errorMessage = "Problème de structure de base de données. Veuillez redémarrer l'application.";
      }
      
      Alert.alert("Erreur", errorMessage);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      "Changer le mot de passe",
      "Cette fonctionnalité sera disponible prochainement.",
      [{ text: "OK" }]
    );
  };

  const handleExportData = async () => {
    if (!user) {
      Alert.alert("Erreur", "Vous devez être connecté");
      return;
    }

    try {
      // Récupérer les livraisons
      const deliveries = await db.getAllAsync<any>(
        "SELECT * FROM deliveries WHERE user_id = ? ORDER BY created_at DESC",
        [user.id]
      );

      Alert.alert(
        "Exporter les données",
        `Prêt à exporter ${deliveries.length} livraisons.\n\nFonctionnalité d'export CSV en développement.`,
        [{ text: "OK" }]
      );

    } catch (error) {
      console.error("❌ Erreur lors de l'export:", error);
      Alert.alert("Erreur", "Impossible d'exporter les données");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      Alert.alert("Erreur", "Vous devez être connecté");
      return;
    }

    Alert.alert(
      "Supprimer le compte",
      "Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données seront effacées. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive",
          onPress: async () => {
            try {
              // Supprimer toutes les données de l'utilisateur
              await db.runAsync("DELETE FROM deliveries WHERE user_id = ?", [user.id]);
              await db.runAsync("DELETE FROM user WHERE id = ?", [user.id]);
              
              Alert.alert("Compte supprimé", "Votre compte a été supprimé avec succès.");
              await logout();
              router.replace("/register");
            } catch (error) {
              console.error("❌ Erreur suppression compte:", error);
              Alert.alert("Erreur", "Impossible de supprimer le compte");
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Déconnexion", 
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          }
        }
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const handleVehicleSelect = () => {
    Alert.alert(
      "Sélectionner un véhicule",
      "Choisissez votre type de véhicule :",
      [
        { text: "Scooter 125cc", onPress: () => setSettings(prev => ({ ...prev, vehicle: "Scooter 125cc" })) },
        { text: "Moto", onPress: () => setSettings(prev => ({ ...prev, vehicle: "Moto" })) },
        { text: "Voiture", onPress: () => setSettings(prev => ({ ...prev, vehicle: "Voiture" })) },
        { text: "Vélo", onPress: () => setSettings(prev => ({ ...prev, vehicle: "Vélo" })) },
        { text: "Camionnette", onPress: () => setSettings(prev => ({ ...prev, vehicle: "Camionnette" })) },
        { text: "Annuler", style: "cancel" }
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="settings" size={48} color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement des paramètres...</Text>
        </View>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView style={commonStyles.container}>
      {/* En-tête flou */}
      <BlurView intensity={95} tint="dark" style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Paramètres</Text>
        
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Enregistrer</Text>
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
            {user.phone ? `${user.phone} • ` : ""}En ligne
          </Text>
          <Text style={styles.userIdText}>ID: {user.id}</Text>
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
                onChangeText={(text) => setSettings(prev => ({ ...prev, name: text }))}
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
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="fingerprint" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>SIRET</Text>
              </View>
              <TextInput
                style={styles.cardItemInput}
                value={settings.siret}
                onChangeText={(text) => setSettings(prev => ({ ...prev, siret: text }))}
                placeholder="Numéro SIRET"
                placeholderTextColor="#92c992"
                keyboardType="numeric"
              />
            </View>

            {/* Véhicule */}
            <TouchableOpacity 
              style={styles.cardItem}
              onPress={handleVehicleSelect}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="local-shipping" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>Véhicule</Text>
              </View>
              <View style={styles.cardItemRight}>
                <Text style={styles.cardItemValue}>{settings.vehicle}</Text>
                <MaterialIcons name="arrow-forward-ios" size={14} color={COLORS.muted} />
              </View>
            </TouchableOpacity>
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
                onValueChange={(value) => setSettings(prev => ({ ...prev, is_vat: value ? 1 : 0 }))}
                trackColor={{ false: '#374151', true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            {/* Objectif Mensuel */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="savings" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>Objectif mensuel (€)</Text>
              </View>
              <View style={styles.goalInputContainer}>
                <TextInput
                  style={styles.goalInput}
                  value={String(settings.monthly_goal)}
                  onChangeText={(text) => {
                    // N'autoriser que les chiffres
                    const cleaned = text.replace(/[^0-9]/g, '');
                    const numValue = cleaned ? parseInt(cleaned, 10) : 0;
                    setSettings(prev => ({ ...prev, monthly_goal: numValue }));
                  }}
                  placeholder="2500"
                  placeholderTextColor="#92c992"
                  keyboardType="numeric"
                />
                <Text style={styles.currency}>€</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Notifications */}
        <View style={commonStyles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          
          <View style={commonStyles.card}>
            {/* Rappels de saisie */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="edit-notifications" size={20} color={COLORS.muted} />
                <View style={styles.notificationContent}>
                  <Text style={styles.cardItemLabel}>Rappels de saisie</Text>
                  <Text style={styles.notificationSubtitle}>Pour ne pas oublier vos km</Text>
                </View>
              </View>
              <Switch
                value={settings.reminder_notifications === 1}
                onValueChange={(value) => setSettings(prev => ({ ...prev, reminder_notifications: value ? 1 : 0 }))}
                trackColor={{ false: '#374151', true: COLORS.primary }}
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
                onValueChange={(value) => setSettings(prev => ({ ...prev, payment_notifications: value ? 1 : 0 }))}
                trackColor={{ false: '#374151', true: COLORS.primary }}
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
                <MaterialIcons name="lock-reset" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>Changer le mot de passe</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color={COLORS.muted} />
            </TouchableOpacity>

            {/* Exporter les données */}
            <TouchableOpacity 
              style={styles.cardItem}
              onPress={handleExportData}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="download" size={20} color={COLORS.muted} />
                <Text style={styles.cardItemLabel}>Exporter les données (CSV)</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color={COLORS.muted} />
            </TouchableOpacity>

            {/* Supprimer le compte */}
            <TouchableOpacity 
              style={[styles.cardItem, styles.cardItemDanger]}
              onPress={handleDeleteAccount}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="delete-forever" size={20} color={COLORS.danger} />
                <Text style={styles.cardItemLabelDanger}>Supprimer le compte</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bouton de déconnexion */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={20} color={COLORS.danger} />
          <Text style={styles.logoutButtonText}>Déconnexion</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Version 2.4.1 (Build 2024)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}