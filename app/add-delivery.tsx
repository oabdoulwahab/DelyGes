import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { db } from "../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

export default function AddDelivery() {
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [parcelValue, setParcelValue] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");

  const handleSave = async () => {
    if (!recipientName.trim()) {
      Alert.alert("Erreur", "Le nom du destinataire est obligatoire");
      return;
    }

    if (!address.trim()) {
      Alert.alert("Erreur", "L'adresse de livraison est obligatoire");
      return;
    }

    try {
      await db.runAsync(
        `INSERT INTO deliveries 
        (recipient_name, phone, address, parcel_value, delivery_fee, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          recipientName,
          phone,
          address,
          Number(parcelValue) || 0,
          Number(deliveryFee) || 0,
          "A_LIVRER",
          new Date().toISOString(),
        ]
      );

      Alert.alert(
        "Succès", 
        "Livraison ajoutée avec succès",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'ajouter la livraison");
      console.error(error);
    }
  };

  const handleCancel = () => {
    if (recipientName || phone || address || deliveryFee) {
      Alert.alert(
        "Annuler",
        "Voulez-vous vraiment annuler ? Les modifications seront perdues.",
        [
          { text: "Continuer", style: "cancel" },
          { text: "Annuler", onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="#102210" />
      
      {/* En-tête */}
      <BlurView intensity={95} tint="dark" style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Ajouter une Livraison</Text>
        
        <TouchableOpacity style={styles.saveButtonPlaceholder}>
          <Text style={styles.saveButtonText}>Enregistrer</Text>
        </TouchableOpacity>
      </BlurView>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Section Logistique */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de livraison</Text>
          
          <View style={styles.card}>
            {/* Nom du destinataire */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Destinataire *</Text>
              <TextInput
                style={styles.input}
                placeholder="ex: Jean Dupont"
                placeholderTextColor="#94A3B8"
                value={recipientName}
                onChangeText={setRecipientName}
                autoCapitalize="words"
              />
            </View>

            {/* Téléphone */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput
                style={styles.input}
                placeholder="06 12 34 56 78"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Adresse de livraison */}
            <View style={[styles.inputGroup, styles.inputGroupWithIcon]}>
              <MaterialIcons name="location-on" size={20} color="#13ec13" style={styles.inputIcon} />
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Adresse de livraison *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123 Avenue des Champs-Élysées, Paris"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Section Détails financiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails financiers</Text>
          
          <View style={styles.financialGrid}>
            {/* Valeur du colis */}
            <View style={styles.financialCard}>
              <Text style={styles.inputLabel}>Valeur du colis</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencySymbol}>€</Text>
                <TextInput
                  style={styles.financialInput}
                  placeholder="0,00"
                  placeholderTextColor="#94A3B8"
                  value={parcelValue}
                  onChangeText={setParcelValue}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Frais de livraison */}
            <View style={styles.financialCard}>
              <Text style={styles.inputLabel}>Frais de livraison</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencySymbol}>€</Text>
                <TextInput
                  style={styles.financialInput}
                  placeholder="0,00"
                  placeholderTextColor="#94A3B8"
                  value={deliveryFee}
                  onChangeText={setDeliveryFee}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Total */}
          <View style={styles.netIncomeCard}>
            <View style={styles.netIncomeContent}>
              <Text style={styles.netIncomeLabel}>TOTAL</Text>
              <Text style={styles.netIncomeSubtitle}>Valeur + Frais</Text>
            </View>
            <Text style={styles.netIncomeAmount}>
              {(Number(parcelValue || 0) + Number(deliveryFee || 0)).toLocaleString("fr-FR", { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              })} FCFA
            </Text>
          </View>
        </View>

        {/* Espace pour le bouton flottant */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Boutons d'action */}
      <BlurView intensity={95} tint="dark" style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Enregistrer la livraison</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.templateButton}
          onPress={() => {
            // Option pour enregistrer comme template - à implémenter si besoin
            Alert.alert("Info", "Cette fonctionnalité sera disponible prochainement");
          }}
        >
          <Text style={styles.templateButtonText}>Enregistrer comme modèle</Text>
        </TouchableOpacity>
      </BlurView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#102210",
  },
  header: {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: "#13ec13",
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  saveButtonPlaceholder: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    opacity: 0,
  },
  saveButtonText: {
    color: "#13ec13",
    fontSize: 16,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#1a2a1a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff10",
    overflow: "hidden",
  },
  inputGroup: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff05",
  },
  inputGroupWithIcon: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  inputIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    color: "#fff",
    padding: 0,
    margin: 0,
  },
  financialGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  financialCard: {
    flex: 1,
    backgroundColor: "#1a2a1a",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff10",
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
  financialInput: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    padding: 0,
    margin: 0,
  },
  netIncomeCard: {
    backgroundColor: "rgba(19, 236, 19, 0.1)",
    borderColor: "rgba(19, 236, 19, 0.3)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  netIncomeContent: {
    flex: 1,
  },
  netIncomeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#13ec13",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  netIncomeSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  netIncomeAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  bottomSpacer: {
    height: 20,
  },
  actionButtons: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#102210",
    borderTopWidth: 1,
    borderTopColor: "#ffffff10",
  },
  saveButton: {
    backgroundColor: "#13ec13",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  templateButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ffffff20",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  templateButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
});