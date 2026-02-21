import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { useModal } from "../providers/ModalProvider";
import { sendDeliveryCreatedNotification } from "../src/services/notification.service";

export default function AddDelivery() {
  const { user, isAuthenticated } = useAuth();
  const { showConfirm, showSuccess, showError, showAlert } = useModal();
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
    merchantName: false,
  });

  const [merchants, setMerchants] = useState<any[]>([]);
  const [filteredMerchants, setFilteredMerchants] = useState<any[]>([]);
  const [merchantName, setMerchantName] = useState("");
  const [merchantId, setMerchantId] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [paymentType, setPaymentType] = useState<
    "COLIS_DEJA_PAYE" | "CLIENT_PAYE_LIVRAISON" | "CLIENT_PAYE_TOUT"
  >("CLIENT_PAYE_TOUT");

  const [isSaving, setIsSaving] = useState(false);

  const validateForm = () => {
    const newErrors = {
      recipientName: !recipientName.trim(),
      phone: !phone.trim(),
      address: !address.trim(),
      parcelValue:
        !parcelValue.trim() || Number(parcelValue.replace(",", ".")) <= 0,
      deliveryFee:
        !deliveryFee.trim() || Number(deliveryFee.replace(",", ".")) <= 0,
      merchantName: !merchantName.trim(),
    };

    setErrors(newErrors);

    return !Object.values(newErrors).some((error) => error);
  };

  // Charger tous les commerçants
  useEffect(() => {
    const loadMerchants = async () => {
      const result = await db.getAllAsync<any>(
        "SELECT * FROM merchants ORDER BY name ASC",
      );
      setMerchants(result);
    };

    loadMerchants();
  }, []);

  // Filtrer les commerçants en fonction de la saisie
  useEffect(() => {
    if (merchantName.trim().length > 0) {
      const filtered = merchants.filter((merchant) =>
        merchant.name.toLowerCase().includes(merchantName.toLowerCase()),
      );
      setFilteredMerchants(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredMerchants([]);
      setShowSuggestions(false);
    }
  }, [merchantName, merchants]);

  // Créer ou récupérer un commerçant
  const getOrCreateMerchant = async () => {
    if (!merchantName.trim()) return null;

    // Vérifier si le commerçant existe déjà
    const existingMerchant = await db.getFirstAsync<any>(
      "SELECT * FROM merchants WHERE name = ?",
      [merchantName.trim()],
    );

    if (existingMerchant) {
      return existingMerchant.id;
    }

    // Créer un nouveau commerçant
    const result = await db.runAsync(
      "INSERT INTO merchants (name, created_at) VALUES (?, ?)",
      [merchantName.trim(), new Date().toISOString()],
    );

    console.log("✅ Nouveau commerçant créé avec ID:", result.lastInsertRowId);
    return result.lastInsertRowId;
  };

  const parcelValueNum = Number(parcelValue.replace(",", ".")) || 0;
  const deliveryFeeNum = Number(deliveryFee.replace(",", ".")) || 0;

  const amountCollected =
    paymentType === "CLIENT_PAYE_TOUT"
      ? parcelValueNum + deliveryFeeNum
      : deliveryFeeNum;

  const amountToReturn =
    paymentType === "CLIENT_PAYE_TOUT" ? parcelValueNum : 0;

  const profit = deliveryFeeNum;

  const handleSave = async () => {
    if (!validateForm()) {
      showError(
        "Erreur",
        "Veuillez remplir tous les champs obligatoires avec des valeurs valides",
      );
      return;
    }

    if (!isAuthenticated || !user) {
      showError("Erreur", "Vous devez être connecté pour créer une livraison");
      return;
    }

    setIsSaving(true);

    try {
      // Convertir les valeurs monétaires
      const parcelValueNum = parcelValue
        ? Number(parcelValue.replace(",", "."))
        : 0;
      const deliveryFeeNum = deliveryFee
        ? Number(deliveryFee.replace(",", "."))
        : 0;

      // Créer ou récupérer le commerçant
      const merchantIdValue = await getOrCreateMerchant();

      // Insérer la livraison avec l'user_id
      const result = await db.runAsync(
        `INSERT INTO deliveries (
    recipient_name,
    phone,
    address,
    parcel_value,
    delivery_fee,
    merchant_id,
    payment_type,
    amount_collected,
    amount_to_return,
    profit,
    status,
    user_id,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recipientName.trim(),
          phone.trim(),
          address.trim(),
          parcelValueNum,
          deliveryFeeNum,
          merchantIdValue,
          paymentType,
          amountCollected,
          amountToReturn,
          profit,
          "A_LIVRER",
          user.id,
          new Date().toISOString(),
        ],
      );

      console.log(
        "✅ Livraison créée avec ID:",
        result.lastInsertRowId,
        "pour l'utilisateur:",
        user.id,
        "commerçant ID:",
        merchantIdValue,
      );

      // 📨 Envoyer une notification de création
      await sendDeliveryCreatedNotification(user.id, 1);

      showSuccess("Succès", "Livraison ajoutée avec succès");
      setTimeout(() => router.back(), 1000);
    } catch (error: any) {
      console.error("❌ Erreur lors de la création de la livraison:", error);

      let errorMessage = "Impossible d'ajouter la livraison";
      if (error.message?.includes("NOT NULL constraint failed")) {
        errorMessage =
          "Erreur de base de données : l'ID utilisateur est requis";
      } else if (error.message?.includes("user_id")) {
        errorMessage = "Erreur d'authentification. Veuillez vous reconnecter.";
      } else if (error.message?.includes("merchant_id")) {
        errorMessage = "Erreur avec le commerçant. Veuillez réessayer.";
      }

      showError("Erreur", errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (
      recipientName ||
      phone ||
      address ||
      parcelValue ||
      deliveryFee ||
      merchantName
    ) {
      showConfirm(
        "Annuler",
        "Voulez-vous vraiment annuler ? Les modifications seront perdues.",
        () => router.back(),
        "Annuler",
        "Continuer",
      );
    } else {
      router.back();
    }
  };

  const handleCurrencyChange = (
    text: string,
    setter: (value: string) => void,
  ) => {
    // N'autoriser que les chiffres et une virgule/décimal
    const cleaned = text.replace(/[^\d,.]/g, "");

    // Remplacer le point par une virgule pour le format français
    const withComma = cleaned.replace(".", ",");

    // Si c'est vide, réinitialiser
    if (!withComma) {
      setter("");
      return;
    }

    // Vérifier s'il y a plus d'une virgule
    const commaCount = (withComma.match(/,/g) || []).length;
    if (commaCount > 1) return;

    // Si on a une virgule, limiter à 2 décimales
    if (withComma.includes(",")) {
      const [whole, decimal] = withComma.split(",");
      if (decimal && decimal.length > 2) {
        setter(`${whole},${decimal.substring(0, 2)}`);
        return;
      }
    }

    setter(withComma);
  };

  const selectMerchant = (merchant: any) => {
    setMerchantName(merchant.name);
    setMerchantId(merchant.id);
    setShowSuggestions(false);
    setErrors((prev) => ({ ...prev, merchantName: false }));
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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} style={addDeliveryStyles.header}>
        <TouchableOpacity onPress={handleCancel} style={addDeliveryStyles.cancelButton}>
          <Text style={addDeliveryStyles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>

        <Text style={addDeliveryStyles.headerTitle}>Ajouter une Livraison</Text>

        <View style={addDeliveryStyles.saveButtonPlaceholder} />
      </BlurView>

      <ScrollView
        style={addDeliveryStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={addDeliveryStyles.scrollContent}
      >
        {/* Section Logistique */}
        <View style={commonStyles.section}>
          <Text style={addDeliveryStyles.sectionTitle}>
            Informations de livraison
          </Text>

          <View style={commonStyles.card}>
            {/* Nom du destinataire */}
            <View
              style={[
                addDeliveryStyles.inputGroup,
                errors.recipientName && addDeliveryStyles.inputError,
              ]}
            >
              <Text style={addDeliveryStyles.inputLabel}>
                Destinataire <Text style={addDeliveryStyles.required}>*</Text>
              </Text>
              <TextInput
                style={addDeliveryStyles.input}
                placeholder="ex: Jean Dupont"
                placeholderTextColor={COLORS.muted}
                value={recipientName}
                onChangeText={(text) => {
                  setRecipientName(text);
                  setErrors((prev) => ({ ...prev, recipientName: false }));
                }}
                autoCapitalize="words"
              />
              {errors.recipientName && (
                <Text style={addDeliveryStyles.errorText}>
                  Ce champ est obligatoire
                </Text>
              )}
            </View>

            {/* Téléphone */}
            <View
              style={[
                addDeliveryStyles.inputGroup,
                errors.phone && addDeliveryStyles.inputError,
              ]}
            >
              <Text style={addDeliveryStyles.inputLabel}>
                Téléphone <Text style={addDeliveryStyles.required}>*</Text>
              </Text>
              <TextInput
                style={addDeliveryStyles.input}
                placeholder="06 12 34 56 78"
                placeholderTextColor={COLORS.muted}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setErrors((prev) => ({ ...prev, phone: false }));
                }}
                keyboardType="phone-pad"
              />
              {errors.phone && (
                <Text style={addDeliveryStyles.errorText}>
                  Ce champ est obligatoire
                </Text>
              )}
            </View>

            {/* Adresse de livraison */}
            <View
              style={[
                addDeliveryStyles.inputGroup,
                addDeliveryStyles.inputGroupWithIcon,
                errors.address && addDeliveryStyles.inputError,
              ]}
            >
              <MaterialIcons
                name="location-on"
                size={20}
                color={errors.address ? COLORS.danger : COLORS.primary}
                style={addDeliveryStyles.inputIcon}
              />
              <View style={addDeliveryStyles.inputContent}>
                <Text style={addDeliveryStyles.inputLabel}>
                  Adresse de livraison <Text style={addDeliveryStyles.required}>*</Text>
                </Text>
                <TextInput
                  style={addDeliveryStyles.input}
                  placeholder="123 Avenue des Champs-Élysées, Paris"
                  placeholderTextColor={COLORS.muted}
                  value={address}
                  onChangeText={(text) => {
                    setAddress(text);
                    setErrors((prev) => ({ ...prev, address: false }));
                  }}
                />
                {errors.address && (
                  <Text style={addDeliveryStyles.errorText}>
                    Ce champ est obligatoire
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Section Commerçant - Formulaire avec suggestions */}
        <View style={commonStyles.section}>
          <Text style={addDeliveryStyles.sectionTitle}>Commerçant</Text>

          <View style={commonStyles.card}>
            <View
              style={[
                addDeliveryStyles.inputGroup,
                errors.merchantName && addDeliveryStyles.inputError,
              ]}
            >
              <Text style={addDeliveryStyles.inputLabel}>
                Nom du commerçant <Text style={addDeliveryStyles.required}>*</Text>
              </Text>
              <View style={addDeliveryStyles.merchantInputContainer}>
                <TextInput
                  style={[
                    addDeliveryStyles.input,
                    showSuggestions && addDeliveryStyles.inputWithSuggestions,
                  ]}
                  placeholder="ex: Boutique du Centre"
                  placeholderTextColor={COLORS.muted}
                  value={merchantName}
                  onChangeText={(text) => {
                    setMerchantName(text);
                    setMerchantId(null);
                    setErrors((prev) => ({ ...prev, merchantName: false }));
                  }}
                  onFocus={() => {
                    if (
                      merchantName.trim().length > 0 &&
                      filteredMerchants.length > 0
                    ) {
                      setShowSuggestions(true);
                    }
                  }}
                  autoCapitalize="words"
                />

                {merchantName.length > 0 && (
                  <TouchableOpacity
                    style={addDeliveryStyles.clearButton}
                    onPress={() => {
                      setMerchantName("");
                      setMerchantId(null);
                      setShowSuggestions(false);
                    }}
                  >
                    <MaterialIcons
                      name="close"
                      size={20}
                      color={COLORS.muted}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Liste des suggestions */}
              {showSuggestions && (
                <View style={addDeliveryStyles.suggestionsContainer}>
                  {filteredMerchants.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={addDeliveryStyles.suggestionItem}
                      onPress={() => selectMerchant(item)}
                    >
                      <MaterialIcons
                        name="store"
                        size={18}
                        color={COLORS.primary}
                        style={addDeliveryStyles.suggestionIcon}
                      />

                      <View style={addDeliveryStyles.suggestionContent}>
                        <Text style={addDeliveryStyles.suggestionName}>{item.name}</Text>
                        {item.phone && (
                          <Text style={addDeliveryStyles.suggestionPhone}>
                            {item.phone}
                          </Text>
                        )}
                      </View>

                      <MaterialIcons
                        name="check-circle"
                        size={18}
                        color={COLORS.primary}
                        style={addDeliveryStyles.suggestionCheck}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {errors.merchantName && (
                <Text style={addDeliveryStyles.errorText}>
                  Ce champ est obligatoire
                </Text>
              )}

              {merchantId && (
                <View style={addDeliveryStyles.selectedMerchantInfo}>
                  <MaterialIcons
                    name="check-circle"
                    size={16}
                    color={COLORS.success}
                  />
                  <Text style={addDeliveryStyles.selectedMerchantText}>
                    Commerçant existant sélectionné
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Section Détails financiers */}
        <View style={commonStyles.section}>
          <Text style={addDeliveryStyles.sectionTitle}>Détails financiers</Text>

          <View style={addDeliveryStyles.financialGrid}>
            {/* Valeur du colis */}
            <View
              style={[
                addDeliveryStyles.financialCard,
                errors.parcelValue && addDeliveryStyles.inputError,
              ]}
            >
              <Text style={addDeliveryStyles.inputLabel}>
                Valeur du colis <Text style={addDeliveryStyles.required}>*</Text>
              </Text>
              <View style={addDeliveryStyles.currencyInput}>
                <Text
                  style={[
                    addDeliveryStyles.currencySymbol,
                    errors.parcelValue && { color: COLORS.danger },
                  ]}
                >
                  FCFA
                </Text>
                <TextInput
                  style={[
                    addDeliveryStyles.financialInput,
                    errors.parcelValue && { color: COLORS.danger },
                  ]}
                  placeholder="0,00"
                  placeholderTextColor={
                    errors.parcelValue ? COLORS.danger : COLORS.muted
                  }
                  value={parcelValue}
                  onChangeText={(text) => {
                    handleCurrencyChange(text, setParcelValue);
                    setErrors((prev) => ({ ...prev, parcelValue: false }));
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.parcelValue && (
                <Text style={addDeliveryStyles.errorText}>
                  Valeur supérieure à 0 requise
                </Text>
              )}
            </View>

            {/* Frais de livraison */}
            <View
              style={[
                addDeliveryStyles.financialCard,
                errors.deliveryFee && addDeliveryStyles.inputError,
              ]}
            >
              <Text style={addDeliveryStyles.inputLabel}>
                Frais de livraison <Text style={addDeliveryStyles.required}>*</Text>
              </Text>
              <View style={addDeliveryStyles.currencyInput}>
                <Text
                  style={[
                    addDeliveryStyles.currencySymbol,
                    errors.deliveryFee && { color: COLORS.danger },
                  ]}
                >
                  FCFA
                </Text>
                <TextInput
                  style={[
                    addDeliveryStyles.financialInput,
                    errors.deliveryFee && { color: COLORS.danger },
                  ]}
                  placeholder="0,00"
                  placeholderTextColor={
                    errors.deliveryFee ? COLORS.danger : COLORS.muted
                  }
                  value={deliveryFee}
                  onChangeText={(text) => {
                    handleCurrencyChange(text, setDeliveryFee);
                    setErrors((prev) => ({ ...prev, deliveryFee: false }));
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.deliveryFee && (
                <Text style={addDeliveryStyles.errorText}>
                  Valeur supérieure à 0 requise
                </Text>
              )}
            </View>
          </View>

          <View style={commonStyles.section}>
            <Text style={addDeliveryStyles.sectionTitle}>Paiement</Text>

            <View style={commonStyles.card}>
              {[
                {
                  key: "CLIENT_PAYE_TOUT",
                  label: "Client paie colis + livraison",
                },
                {
                  key: "CLIENT_PAYE_LIVRAISON",
                  label: "Client paie livraison seulement",
                },
                { key: "COLIS_DEJA_PAYE", label: "Colis déjà payé" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    addDeliveryStyles.paymentOption,
                    paymentType === item.key && addDeliveryStyles.paymentSelected,
                  ]}
                  onPress={() => setPaymentType(item.key as any)}
                >
                  <Text style={addDeliveryStyles.paymentText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Total */}
          <View style={addDeliveryStyles.netIncomeCard}>
            <View style={addDeliveryStyles.netIncomeContent}>
              <Text style={addDeliveryStyles.netIncomeLabel}>TOTAL</Text>
              <Text style={addDeliveryStyles.netIncomeSubtitle}>Valeur + Frais</Text>
            </View>
            <Text style={addDeliveryStyles.netIncomeAmount}>
              {(
                Number(parcelValue.replace(",", ".") || 0) +
                Number(deliveryFee.replace(",", ".") || 0)
              ).toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              FCFA
            </Text>
          </View>
        </View>

        {/* Espace pour le bouton flottant */}
        <View style={addDeliveryStyles.bottomSpacer} />
      </ScrollView>

      {/* Boutons d'action */}
      <BlurView intensity={95} style={addDeliveryStyles.actionButtons}>
        <TouchableOpacity
          style={[addDeliveryStyles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={addDeliveryStyles.saveButtonText}>
            {isSaving ? "Enregistrement..." : "Enregistrer la livraison"}
          </Text>
        </TouchableOpacity>
      </BlurView>
    </KeyboardAvoidingView>
  );
}