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
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { db } from "../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { commonStyles } from "../styles/common";
import { addDeliveryStyles } from "../styles/addDeliveryStyles";
import { COLORS } from "../styles/colors";
import { useAuth } from "../src/hooks/useAuth";

export default function AddDelivery() {
  const { user, isAuthenticated } = useAuth();
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

  const [isSaving, setIsSaving] = useState(false);

  const validateForm = () => {
    const newErrors = {
      recipientName: !recipientName.trim(),
      phone: !phone.trim(),
      address: !address.trim(),
      parcelValue: !parcelValue.trim() || Number(parcelValue.replace(',', '.')) <= 0,
      deliveryFee: !deliveryFee.trim() || Number(deliveryFee.replace(',', '.')) <= 0,
    };
    
    setErrors(newErrors);
    
    return !Object.values(newErrors).some(error => error);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires avec des valeurs valides");
      return;
    }

    // Vérifier l'authentification
    if (!isAuthenticated || !user) {
      Alert.alert("Erreur", "Vous devez être connecté pour créer une livraison");
      return;
    }

    setIsSaving(true);

    try {
      // Convertir les valeurs monétaires
      const parcelValueNum = parcelValue ? Number(parcelValue.replace(',', '.')) : 0;
      const deliveryFeeNum = deliveryFee ? Number(deliveryFee.replace(',', '.')) : 0;

      // Insérer la livraison avec l'user_id
      const result = await db.runAsync(
        `INSERT INTO deliveries 
        (recipient_name, phone, address, parcel_value, delivery_fee, status, user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recipientName.trim(),
          phone.trim(),
          address.trim(),
          parcelValueNum,
          deliveryFeeNum,
          "A_LIVRER",
          user.id, // ← ICI: user.id récupéré du hook useAuth
          new Date().toISOString(),
        ]
      );

      console.log("✅ Livraison créée avec ID:", result.lastInsertRowId, "pour l'utilisateur:", user.id);

      Alert.alert(
        "Succès", 
        "Livraison ajoutée avec succès",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error("❌ Erreur lors de la création de la livraison:", error);
      
      let errorMessage = "Impossible d'ajouter la livraison";
      if (error.message?.includes("NOT NULL constraint failed")) {
        errorMessage = "Erreur de base de données : l'ID utilisateur est requis";
      } else if (error.message?.includes("user_id")) {
        errorMessage = "Erreur d'authentification. Veuillez vous reconnecter.";
      }
      
      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsSaving(false);
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

  // Déboguer l'état d'authentification
  useEffect(() => {
    console.log("🔐 État d'authentification dans AddDelivery:");
    console.log("- isAuthenticated:", isAuthenticated);
    console.log("- User ID:", user?.id);
    console.log("- User object:", user);
  }, [isAuthenticated, user]);

  return (
    <KeyboardAvoidingView 
      style={commonStyles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* En-tête */}
      <BlurView intensity={95} tint="dark" style={addDeliveryStyles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
        
        <Text style={addDeliveryStyles.headerTitle}>Ajouter une Livraison</Text>
        
        <TouchableOpacity style={styles.saveButtonPlaceholder}>
          <Text style={addDeliveryStyles.saveButtonText}>Enregistrer</Text>
        </TouchableOpacity>
      </BlurView>

      <ScrollView 
        style={addDeliveryStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={addDeliveryStyles.scrollContent}
      >
        {/* Afficher l'info utilisateur pour débogage */}
        {isAuthenticated && user && (
          <View style={styles.userInfo}>
            <Text style={styles.userInfoText}>
              Connecté en tant que: {user.name} (ID: {user.id})
            </Text>
          </View>
        )}

        {/* Section Logistique */}
        <View style={commonStyles.section}>
          <Text style={addDeliveryStyles.sectionTitle}>Informations de livraison</Text>
          
          <View style={commonStyles.card}>
            {/* Nom du destinataire */}
            <View style={[
              addDeliveryStyles.inputGroup, 
              errors.recipientName && styles.inputError
            ]}>
              <Text style={addDeliveryStyles.inputLabel}>
                Destinataire <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={addDeliveryStyles.input}
                placeholder="ex: Jean Dupont"
                placeholderTextColor={COLORS.muted}
                value={recipientName}
                onChangeText={(text) => {
                  setRecipientName(text);
                  setErrors(prev => ({ ...prev, recipientName: false }));
                }}
                autoCapitalize="words"
              />
              {errors.recipientName && (
                <Text style={addDeliveryStyles.errorText}>Ce champ est obligatoire</Text>
              )}
            </View>

            {/* Téléphone */}
            <View style={[
              addDeliveryStyles.inputGroup, 
              errors.phone && styles.inputError
            ]}>
              <Text style={addDeliveryStyles.inputLabel}>
                Téléphone <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={addDeliveryStyles.input}
                placeholder="06 12 34 56 78"
                placeholderTextColor={COLORS.muted}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setErrors(prev => ({ ...prev, phone: false }));
                }}
                keyboardType="phone-pad"
              />
              {errors.phone && (
                <Text style={addDeliveryStyles.errorText}>Ce champ est obligatoire</Text>
              )}
            </View>

            {/* Adresse de livraison */}
            <View style={[
              addDeliveryStyles.inputGroup, 
              styles.inputGroupWithIcon,
              errors.address && styles.inputError
            ]}>
              <MaterialIcons 
                name="location-on" 
                size={20} 
                color={errors.address ? COLORS.danger : COLORS.primary} 
                style={styles.inputIcon} 
              />
              <View style={styles.inputContent}>
                <Text style={addDeliveryStyles.inputLabel}>
                  Adresse de livraison <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={addDeliveryStyles.input}
                  placeholder="123 Avenue des Champs-Élysées, Paris"
                  placeholderTextColor={COLORS.muted}
                  value={address}
                  onChangeText={(text) => {
                    setAddress(text);
                    setErrors(prev => ({ ...prev, address: false }));
                  }}
                />
                {errors.address && (
                  <Text style={addDeliveryStyles.errorText}>Ce champ est obligatoire</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Section Détails financiers */}
        <View style={commonStyles.section}>
          <Text style={addDeliveryStyles.sectionTitle}>Détails financiers</Text>
          
          <View style={styles.financialGrid}>
            {/* Valeur du colis */}
            <View style={[
              styles.financialCard, 
              errors.parcelValue && styles.inputError
            ]}>
              <Text style={addDeliveryStyles.inputLabel}>
                Valeur du colis <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.currencyInput}>
                <Text style={[
                  styles.currencySymbol, 
                  errors.parcelValue && { color: COLORS.danger }
                ]}>
                  €
                </Text>
                <TextInput
                  style={[
                    styles.financialInput, 
                    errors.parcelValue && { color: COLORS.danger }
                  ]}
                  placeholder="0,00"
                  placeholderTextColor={errors.parcelValue ? COLORS.danger : COLORS.muted}
                  value={parcelValue}
                  onChangeText={(text) => {
                    handleCurrencyChange(text, setParcelValue);
                    setErrors(prev => ({ ...prev, parcelValue: false }));
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.parcelValue && (
                <Text style={addDeliveryStyles.errorText}>Valeur supérieure à 0 requise</Text>
              )}
            </View>

            {/* Frais de livraison */}
            <View style={[
              styles.financialCard, 
              errors.deliveryFee && styles.inputError
            ]}>
              <Text style={addDeliveryStyles.inputLabel}>
                Frais de livraison <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.currencyInput}>
                <Text style={[
                  styles.currencySymbol, 
                  errors.deliveryFee && { color: COLORS.danger }
                ]}>
                  €
                </Text>
                <TextInput
                  style={[
                    styles.financialInput, 
                    errors.deliveryFee && { color: COLORS.danger }
                  ]}
                  placeholder="0,00"
                  placeholderTextColor={errors.deliveryFee ? COLORS.danger : COLORS.muted}
                  value={deliveryFee}
                  onChangeText={(text) => {
                    handleCurrencyChange(text, setDeliveryFee);
                    setErrors(prev => ({ ...prev, deliveryFee: false }));
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.deliveryFee && (
                <Text style={addDeliveryStyles.errorText}>Valeur supérieure à 0 requise</Text>
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
          style={[
            addDeliveryStyles.saveButton,
            isSaving && { opacity: 0.7 }
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={addDeliveryStyles.saveButtonText}>
            {isSaving ? "Enregistrement..." : "Enregistrer la livraison"}
          </Text>
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
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: COLORS.primary,
    fontSize: 16,
  },
  saveButtonPlaceholder: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    opacity: 0,
  },
  inputError: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
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
  required: {
    color: COLORS.danger,
  },
  financialGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  financialCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.white,
    marginRight: 8,
  },
  financialInput: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.white,
    flex: 1,
    padding: 0,
    margin: 0,
  },
  netIncomeCard: {
    backgroundColor: COLORS.primarySoft,
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
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  netIncomeSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  netIncomeAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.white,
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
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  templateButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  templateButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.white,
  },
  userInfo: {
    backgroundColor: COLORS.primarySoft,
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  userInfoText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "500",
  },
});