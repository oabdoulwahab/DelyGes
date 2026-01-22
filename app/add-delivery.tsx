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
  
  const [errors, setErrors] = useState({
    recipientName: false,
    phone: false,
    address: false,
    parcelValue: false,
    deliveryFee: false,
  });

  const validateForm = () => {
    const newErrors = {
      recipientName: !recipientName.trim(),
      phone: !phone.trim(),
      address: !address.trim(),
      parcelValue: !parcelValue.trim() || Number(parcelValue) <= 0,
      deliveryFee: !deliveryFee.trim() || Number(deliveryFee) <= 0,
    };
    
    setErrors(newErrors);
    
    return !Object.values(newErrors).some(error => error);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires avec des valeurs valides");
      return;
    }

    try {
      await db.runAsync(
        `INSERT INTO deliveries 
        (recipient_name, phone, address, parcel_value, delivery_fee, status,user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recipientName.trim(),
          phone.trim(),
          address.trim(),
          Number(parcelValue),
          Number(deliveryFee),
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
    if (recipientName || phone || address || parcelValue || deliveryFee) {
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

  const formatCurrency = (value: string) => {
    // Enlever les espaces et virgules
    const cleaned = value.replace(/[^\d]/g, '');
    if (!cleaned) return "";
    
    // Convertir en nombre avec 2 décimales
    const number = parseFloat(cleaned) / 100;
    return number.toFixed(2);
  };

  const handleCurrencyChange = (text: string, setter: (value: string) => void) => {
    // N'autoriser que les chiffres et une virgule/décimal
    const cleaned = text.replace(/[^\d,.]/g, '');
    
    // Remplacer le point par une virgule pour le format français
    const withComma = cleaned.replace('.', ',');
    
    // Si c'est vide, réinitialiser
    if (!withComma) {
      setter("");
      return;
    }
    
    // Vérifier s'il y a plus d'une virgule
    const commaCount = (withComma.match(/,/g) || []).length;
    if (commaCount > 1) return;
    
    // Si on a une virgule, limiter à 2 décimales
    if (withComma.includes(',')) {
      const [whole, decimal] = withComma.split(',');
      if (decimal && decimal.length > 2) {
        setter(`${whole},${decimal.substring(0, 2)}`);
        return;
      }
    }
    
    setter(withComma);
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
            <View style={[styles.inputGroup, errors.recipientName && styles.inputError]}>
              <Text style={styles.inputLabel}>
                Destinataire <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="ex: Jean Dupont"
                placeholderTextColor="#94A3B8"
                value={recipientName}
                onChangeText={(text) => {
                  setRecipientName(text);
                  setErrors(prev => ({ ...prev, recipientName: false }));
                }}
                autoCapitalize="words"
              />
              {errors.recipientName && (
                <Text style={styles.errorText}>Ce champ est obligatoire</Text>
              )}
            </View>

            {/* Téléphone */}
            <View style={[styles.inputGroup, errors.phone && styles.inputError]}>
              <Text style={styles.inputLabel}>
                Téléphone <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="06 12 34 56 78"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setErrors(prev => ({ ...prev, phone: false }));
                }}
                keyboardType="phone-pad"
              />
              {errors.phone && (
                <Text style={styles.errorText}>Ce champ est obligatoire</Text>
              )}
            </View>

            {/* Adresse de livraison */}
            <View style={[
              styles.inputGroup, 
              styles.inputGroupWithIcon,
              errors.address && styles.inputError
            ]}>
              <MaterialIcons 
                name="location-on" 
                size={20} 
                color={errors.address ? "#ef4444" : "#13ec13"} 
                style={styles.inputIcon} 
              />
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>
                  Adresse de livraison <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="123 Avenue des Champs-Élysées, Paris"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={(text) => {
                    setAddress(text);
                    setErrors(prev => ({ ...prev, address: false }));
                  }}
                />
                {errors.address && (
                  <Text style={styles.errorText}>Ce champ est obligatoire</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Section Détails financiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails financiers</Text>
          
          <View style={styles.financialGrid}>
            {/* Valeur du colis */}
            <View style={[styles.financialCard, errors.parcelValue && styles.inputError]}>
              <Text style={styles.inputLabel}>
                Valeur du colis <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, errors.parcelValue && { color: "#ef4444" }]}>
                  €
                </Text>
                <TextInput
                  style={[styles.financialInput, errors.parcelValue && { color: "#ef4444" }]}
                  placeholder="0,00"
                  placeholderTextColor={errors.parcelValue ? "#ef4444" : "#94A3B8"}
                  value={parcelValue}
                  onChangeText={(text) => {
                    handleCurrencyChange(text, setParcelValue);
                    setErrors(prev => ({ ...prev, parcelValue: false }));
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.parcelValue && (
                <Text style={styles.errorText}>Valeur supérieure à 0 requise</Text>
              )}
            </View>

            {/* Frais de livraison */}
            <View style={[styles.financialCard, errors.deliveryFee && styles.inputError]}>
              <Text style={styles.inputLabel}>
                Frais de livraison <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.currencyInput}>
                <Text style={[styles.currencySymbol, errors.deliveryFee && { color: "#ef4444" }]}>
                  €
                </Text>
                <TextInput
                  style={[styles.financialInput, errors.deliveryFee && { color: "#ef4444" }]}
                  placeholder="0,00"
                  placeholderTextColor={errors.deliveryFee ? "#ef4444" : "#94A3B8"}
                  value={deliveryFee}
                  onChangeText={(text) => {
                    handleCurrencyChange(text, setDeliveryFee);
                    setErrors(prev => ({ ...prev, deliveryFee: false }));
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.deliveryFee && (
                <Text style={styles.errorText}>Valeur supérieure à 0 requise</Text>
              )}
            </View>
          </View>

          {/* Total */}
          <View style={styles.netIncomeCard}>
            <View style={styles.netIncomeContent}>
              <Text style={styles.netIncomeLabel}>TOTAL</Text>
              <Text style={styles.netIncomeSubtitle}>Valeur + Frais</Text>
            </View>
            <Text style={styles.netIncomeAmount}>
              {(Number(parcelValue.replace(',', '.') || 0) + Number(deliveryFee.replace(',', '.') || 0))
                .toLocaleString("fr-FR", { 
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
    color: "#000",
    fontSize: 16,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
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
  inputError: {
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
    backgroundColor: "#ef444410",
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
  required: {
    color: "#ef4444",
  },
  input: {
    fontSize: 16,
    color: "#fff",
    padding: 0,
    margin: 0,
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    fontStyle: "italic",
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