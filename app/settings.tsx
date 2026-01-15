import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, SafeAreaView, Switch, Image } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { db } from "../src/database/db";
import { BlurView } from 'expo-blur';

export default function Settings() {
  const [fullName, setFullName] = useState("Thomas Dupont");
  const [siret, setSiret] = useState("802 910 293 00012");
  const [vehicle, setVehicle] = useState("Scooter 125cc");
  const [isVAT, setIsVAT] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState("2500");
  const [reminderNotifications, setReminderNotifications] = useState(true);
  const [paymentNotifications, setPaymentNotifications] = useState(true);

  const handleSave = async () => {
    try {
      // Mettre à jour les informations dans la base de données
      await db.runAsync(
        "UPDATE user SET name = ? WHERE id = ?",
        [fullName, 1] // À adapter avec l'ID de l'utilisateur connecté
      );
      
      Alert.alert("Succès", "Paramètres enregistrés avec succès !");
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'enregistrer les paramètres");
      console.error(error);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      "Changer le mot de passe",
      "Cette fonctionnalité sera disponible prochainement.",
      [{ text: "OK" }]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      "Exporter les données",
      "L'export CSV sera disponible prochainement.",
      [{ text: "OK" }]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Supprimer le compte",
      "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive",
          onPress: () => {
            Alert.alert("Compte supprimé", "Votre compte a été supprimé avec succès.");
            router.replace("/register");
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
          onPress: () => {
            router.replace("/login");
          }
        }
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête flou */}
      <BlurView intensity={95} tint="dark" style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
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
              <MaterialIcons name="person" size={48} color="#13ec13" />
            </View>
            <View style={styles.onlineIndicator}>
              <View style={styles.onlineDot} />
            </View>
          </View>
          
          <Text style={styles.profileName}>Thomas D.</Text>
          <Text style={styles.profileSubtitle}>Livreur Indépendant • En ligne</Text>
        </View>

        {/* Section: Profil Professionnel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROFIL PROFESSIONNEL</Text>
          
          <View style={styles.card}>
            {/* Nom */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="badge" size={20} color="#94A3B8" />
                <Text style={styles.cardItemLabel}>Nom</Text>
              </View>
              <TextInput
                style={styles.cardItemInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Votre nom"
                placeholderTextColor="#92c992"
              />
            </View>

            {/* SIRET */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="fingerprint" size={20} color="#94A3B8" />
                <Text style={styles.cardItemLabel}>SIRET</Text>
              </View>
              <TextInput
                style={styles.cardItemInput}
                value={siret}
                onChangeText={setSiret}
                placeholder="Numéro SIRET"
                placeholderTextColor="#92c992"
                keyboardType="numeric"
              />
            </View>

            {/* Véhicule */}
            <TouchableOpacity style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="local-shipping" size={20} color="#94A3B8" />
                <Text style={styles.cardItemLabel}>Véhicule</Text>
              </View>
              <View style={styles.cardItemRight}>
                <Text style={styles.cardItemValue}>{vehicle}</Text>
                <MaterialIcons name="arrow-forward-ios" size={14} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Configuration Financière */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONFIGURATION FINANCIÈRE</Text>
          
          <View style={styles.card}>
            {/* TVA */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="percent" size={20} color="#94A3B8" />
                <Text style={styles.cardItemLabel}>Assujetti à la TVA</Text>
              </View>
              <Switch
                value={isVAT}
                onValueChange={setIsVAT}
                trackColor={{ false: '#374151', true: '#13ec13' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Objectif Mensuel */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="savings" size={20} color="#94A3B8" />
                <Text style={styles.cardItemLabel}>Objectif mensuel</Text>
              </View>
              <View style={styles.goalInputContainer}>
                <TextInput
                  style={styles.goalInput}
                  value={monthlyGoal}
                  onChangeText={setMonthlyGoal}
                  placeholder="0"
                  placeholderTextColor="#92c992"
                  keyboardType="numeric"
                />
                <Text style={styles.currency}>€</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          
          <View style={styles.card}>
            {/* Rappels de saisie */}
            <View style={styles.cardItem}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="edit-notifications" size={20} color="#94A3B8" />
                <View style={styles.notificationContent}>
                  <Text style={styles.cardItemLabel}>Rappels de saisie</Text>
                  <Text style={styles.notificationSubtitle}>Pour ne pas oublier vos km</Text>
                </View>
              </View>
              <Switch
                value={reminderNotifications}
                onValueChange={setReminderNotifications}
                trackColor={{ false: '#374151', true: '#13ec13' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Alertes de paiement */}
            <View style={[styles.cardItem, styles.cardItemNoBorder]}>
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="payments" size={20} color="#94A3B8" />
                <Text style={styles.cardItemLabel}>Alertes de paiement</Text>
              </View>
              <Switch
                value={paymentNotifications}
                onValueChange={setPaymentNotifications}
                trackColor={{ false: '#374151', true: '#13ec13' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Section: Données & Sécurité */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DONNÉES & SÉCURITÉ</Text>
          
          <View style={styles.card}>
            {/* Changer le mot de passe */}
            <TouchableOpacity 
              style={styles.cardItem}
              onPress={handleChangePassword}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="lock-reset" size={20} color="#94A3B8" />
                <Text style={styles.cardItemLabel}>Changer le mot de passe</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color="#94A3B8" />
            </TouchableOpacity>

            {/* Exporter les données */}
            <TouchableOpacity 
              style={styles.cardItem}
              onPress={handleExportData}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="download" size={20} color="#94A3B8" />
                <Text style={styles.cardItemLabel}>Exporter les données (CSV)</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color="#94A3B8" />
            </TouchableOpacity>

            {/* Supprimer le compte */}
            <TouchableOpacity 
              style={[styles.cardItem, styles.cardItemDanger]}
              onPress={handleDeleteAccount}
            >
              <View style={styles.cardItemLeft}>
                <MaterialIcons name="delete-forever" size={20} color="#EF4444" />
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
          <MaterialIcons name="logout" size={20} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Déconnexion</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Version 2.4.1 (Build 2024)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#102210',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#13ec13',
  },
  content: {
    flex: 1,
    marginTop: 124,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#1a331a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#1a331a',
    overflow: 'hidden',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#102210',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#13ec13',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#1a331a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardItemNoBorder: {
    borderBottomWidth: 0,
  },
  cardItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cardItemLabelDanger: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
  cardItemInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    color: '#94A3B8',
    padding: 0,
  },
  cardItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardItemValue: {
    fontSize: 16,
    color: '#94A3B8',
  },
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },
  currency: {
    fontSize: 16,
    color: '#94A3B8',
    marginLeft: 4,
  },
  notificationContent: {
    flexDirection: 'column',
    gap: 2,
  },
  notificationSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardItemDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a331a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 24,
  },
});