import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { db } from "../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { commonStyles } from "../styles/common";
import { addDeliveryStyles } from "../styles/addDeliveryStyles";
import { COLORS } from "../styles/colors";
import { useAuth } from "../src/hooks/useAuth";
import { useModal } from "../providers/ModalProvider";
import { sendDeliveryCreatedNotification } from "../src/services/notification.service";
import { useSync } from "../src/hooks/useSync";

type Delivery = {
  id: number;
  recipient_name: string;
  phone: string;
  address: string;
  parcel_value: number;
  delivery_fee: number;
  payment_type:
    | "COLIS_DEJA_PAYE" // Colis déjà payé, livraison à payer
    | "CLIENT_PAYE_LIVRAISON" // Client paie livraison seulement
    | "CLIENT_PAYE_TOUT" // Client paie colis + livraison
    | "LIVRAISON_DEJA_PAYEE"; // 🔥 NOUVEAU: Livraison déjà payée, client paie colis
  merchant_id?: number;
  status: string;
};

type Merchant = {
  id: number;
  name: string;
  phone?: string;
};

export default function AddDelivery() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditing = !!id;
  const { user, isAuthenticated } = useAuth();
  const { showConfirm, showSuccess, showError, showAlert } = useModal();

  // États du formulaire
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [parcelValue, setParcelValue] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantId, setMerchantId] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<
    | "COLIS_DEJA_PAYE"
    | "CLIENT_PAYE_LIVRAISON"
    | "CLIENT_PAYE_TOUT"
    | "LIVRAISON_DEJA_PAYEE"
  >("CLIENT_PAYE_TOUT");
  const { markAndSync } = useSync();

  // États UI
  const [loading, setLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({
    recipientName: false,
    phone: false,
    address: false,
    parcelValue: false,
    deliveryFee: false,
    merchantName: false,
  });

  // États pour les suggestions de commerçants
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filteredMerchants, setFilteredMerchants] = useState<Merchant[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Charger les données si en mode édition
  useEffect(() => {
    if (isEditing) {
      loadDeliveryData();
    }
    loadMerchants();
  }, [id]);

  const loadDeliveryData = async () => {
    try {
      const delivery = await db.getFirstAsync<Delivery>(
        "SELECT * FROM deliveries WHERE id = ?",
        [Number(id)],
      );

      if (delivery) {
        // Vérifier si la livraison peut être modifiée
        if (delivery.status === "LIVREE" || delivery.status === "ANNULEE") {
          showError(
            "Modification impossible",
            "Cette livraison ne peut plus être modifiée car elle est déjà terminée ou annulée.",
          );
          router.back();
          return;
        }

        setRecipientName(delivery.recipient_name);
        setPhone(delivery.phone || "");
        setAddress(delivery.address);
        setParcelValue(delivery.parcel_value.toString());
        setDeliveryFee(delivery.delivery_fee.toString());
        setPaymentType(delivery.payment_type);

        // Charger le commerçant associé
        if (delivery.merchant_id) {
          const merchant = await db.getFirstAsync<Merchant>(
            "SELECT * FROM merchants WHERE id = ?",
            [delivery.merchant_id],
          );
          if (merchant) {
            setMerchantName(merchant.name);
            setMerchantId(merchant.id);
          }
        }
      }
      setLoading(false);
    } catch (error) {
      console.error("Erreur chargement livraison:", error);
      showError("Erreur", "Impossible de charger les données");
      router.back();
    }
  };

  const loadMerchants = async () => {
    const result = await db.getAllAsync<Merchant>(
      "SELECT * FROM merchants ORDER BY name ASC",
    );
    setMerchants(result);
  };

  // Filtrer les commerçants en fonction de la saisie du nom
  useEffect(() => {
    // On n'affiche les suggestions que si l'utilisateur a saisi au moins 1 caractère
    // ET qu'on n'est pas en train d'afficher un commerçant déjà sélectionné (facultatif)
    if (merchantName.trim().length > 0) {
      const filtered = merchants.filter((merchant) =>
        merchant.name.toLowerCase().includes(merchantName.toLowerCase()),
      );
      setFilteredMerchants(filtered);

      // N'afficher que s'il y a des résultats
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredMerchants([]);
      setShowSuggestions(false); // Cache la liste si le champ est vide
    }
  }, [merchantName, merchants]);

  const validateForm = () => {
    // Validation de base pour les champs communs
    const baseValidation = {
      recipientName: !recipientName.trim(),
      phone: !phone.trim(),
      address: !address.trim(),
      merchantName: !merchantName.trim(),
    };

    // Validation des champs financiers selon le type de paiement
    let financialValidation = {
      parcelValue: false,
      deliveryFee: false,
    };

    switch (paymentType) {
      case "CLIENT_PAYE_TOUT":
        financialValidation = {
          parcelValue:
            !parcelValue.trim() || Number(parcelValue.replace(",", ".")) <= 0,
          deliveryFee:
            !deliveryFee.trim() || Number(deliveryFee.replace(",", ".")) <= 0,
        };
        break;

      case "CLIENT_PAYE_LIVRAISON":
        financialValidation = {
          parcelValue: false, // Non obligatoire
          deliveryFee:
            !deliveryFee.trim() || Number(deliveryFee.replace(",", ".")) <= 0,
        };
        break;

      case "LIVRAISON_DEJA_PAYEE": // 🔥 NOUVEAU
        financialValidation = {
          parcelValue:
            !parcelValue.trim() || Number(parcelValue.replace(",", ".")) <= 0,
          deliveryFee: false, // Déjà payé, non obligatoire
        };
        break;

      case "COLIS_DEJA_PAYE":
        financialValidation = {
          parcelValue: false, // Non obligatoire
          deliveryFee: false, // Non obligatoire
        };
        break;
    }

    const newErrors = {
      ...baseValidation,
      ...financialValidation,
    };

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  const getOrCreateMerchant = async () => {
    if (!merchantName.trim()) return null;

    const existingMerchant = await db.getFirstAsync<Merchant>(
      "SELECT * FROM merchants WHERE name = ?",
      [merchantName.trim()],
    );

    if (existingMerchant) {
      return existingMerchant.id;
    }

    const result = await db.runAsync(
      "INSERT INTO merchants (name, created_at) VALUES (?, ?)",
      [merchantName.trim(), new Date().toISOString()],
    );

    return result.lastInsertRowId;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showError("Erreur", "Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (!isAuthenticated || !user) {
      showError("Erreur", "Vous devez être connecté");
      return;
    }

    setIsSaving(true);

    try {
      const parcelValueNum = parcelValue
        ? Number(parcelValue.replace(",", ".") || 0)
        : 0;
      const deliveryFeeNum = deliveryFee
        ? Number(deliveryFee.replace(",", ".") || 0)
        : 0;
      const merchantIdValue = await getOrCreateMerchant();

      // 🔥 CALCUL DES MONTANTS SELON LE TYPE DE PAIEMENT
      let amountCollected = 0; // Montant que le livreur encaisse chez le client
      let amountToReturn = 0; // Montant à reverser au commerçant
      let profit = 0; // Profit du livreur

      switch (paymentType) {
        case "CLIENT_PAYE_TOUT":
          // Client paie colis + livraison
          amountCollected = parcelValueNum + deliveryFeeNum; // Encaissement total
          amountToReturn = parcelValueNum; // À reverser au commerçant
          profit = deliveryFeeNum; // Profit du livreur
          break;

        case "CLIENT_PAYE_LIVRAISON":
          // Client paie livraison seulement (colis déjà payé)
          amountCollected = deliveryFeeNum; // Encaissement = frais de livraison
          amountToReturn = 0; // Rien à reverser (colis déjà payé)
          profit = deliveryFeeNum; // Profit = frais de livraison
          break;

        case "LIVRAISON_DEJA_PAYEE":
          // 🔥 NOUVEAU: Livraison déjà payée, client paie le colis seulement
          amountCollected = parcelValueNum; // Encaissement = valeur du colis
          amountToReturn = parcelValueNum; // À reverser au commerçant
          profit = 0; // Pas de profit (livraison déjà payée)
          break;

        case "COLIS_DEJA_PAYE":
          // Tout est déjà payé (colis + livraison)
          amountCollected = 0; // Rien à encaisser
          amountToReturn = 0; // Rien à reverser
          profit = 0; // Pas de profit
          break;
      }

      if (isEditing) {
        // Mode édition
        await db.runAsync(
          `UPDATE deliveries SET
          recipient_name = ?,
          phone = ?,
          address = ?,
          parcel_value = ?,
          delivery_fee = ?,
          merchant_id = ?,
          payment_type = ?,
          amount_collected = ?,
          amount_to_return = ?,
          profit = ?,
          needs_sync = 1
        WHERE id = ?`,
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
            Number(id),
          ],
        );

        await markAndSync("deliveries", Number(id));
        showSuccess("Succès", "Livraison modifiée avec succès");
      } else {
        // Mode création
        const result = await db.runAsync(
          `INSERT INTO deliveries (
          recipient_name, phone, address, parcel_value, delivery_fee,
          merchant_id, payment_type, amount_collected, amount_to_return,
          profit, status, user_id, created_at, needs_sync
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
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

        await markAndSync("deliveries", result.lastInsertRowId);
        await sendDeliveryCreatedNotification(user.id, 1);
        showSuccess("Succès", "Livraison ajoutée avec succès");
      }

      setTimeout(() => router.back(), 1000);
    } catch (error: any) {
      console.error("❌ Erreur:", error);
      showError("Erreur", "Impossible d'enregistrer la livraison");
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
    const cleaned = text.replace(/[^\d,.]/g, "");
    const withComma = cleaned.replace(".", ",");

    if (!withComma) {
      setter("");
      return;
    }

    const commaCount = (withComma.match(/,/g) || []).length;
    if (commaCount > 1) return;

    if (withComma.includes(",")) {
      const [whole, decimal] = withComma.split(",");
      if (decimal && decimal.length > 2) {
        setter(`${whole},${decimal.substring(0, 2)}`);
        return;
      }
    }

    setter(withComma);
  };

  const selectMerchant = (merchant: Merchant) => {
    setMerchantName(merchant.name);
    setMerchantId(merchant.id);
    setShowSuggestions(false);
    setErrors((prev) => ({ ...prev, merchantName: false }));
  };

  const calculateTotal = () => {
    const parcelNum = parcelValue
      ? Number(parcelValue.replace(",", ".") || 0)
      : 0;
    const deliveryNum = deliveryFee
      ? Number(deliveryFee.replace(",", ".") || 0)
      : 0;

    switch (paymentType) {
      case "CLIENT_PAYE_TOUT":
        return (parcelNum + deliveryNum).toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case "CLIENT_PAYE_LIVRAISON":
        return deliveryNum.toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case "LIVRAISON_DEJA_PAYEE": // 🔥 NOUVEAU
        return parcelNum.toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case "COLIS_DEJA_PAYE":
        return "0,00";
      default:
        return "0,00";
    }
  };

  if (loading) {
    return (
      <View style={commonStyles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background}
        />
        <View style={addDeliveryStyles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={addDeliveryStyles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={commonStyles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} style={addDeliveryStyles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          style={addDeliveryStyles.cancelButton}
        >
          <Text style={addDeliveryStyles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>

        <Text style={addDeliveryStyles.headerTitle}>
          {isEditing ? "Modifier la Livraison" : "Ajouter une Livraison"}
        </Text>

        <TouchableOpacity
          onPress={handleSave}
          style={addDeliveryStyles.saveButtonHeader}
          disabled={isSaving}
        >
          <Text style={addDeliveryStyles.saveButtonHeaderText}>
            {isSaving ? "..." : "Enregistrer"}
          </Text>
        </TouchableOpacity>
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
                editable={!isSaving}
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
                placeholder="05 06 34 56 78"
                placeholderTextColor={COLORS.muted}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setErrors((prev) => ({ ...prev, phone: false }));
                }}
                keyboardType="phone-pad"
                editable={!isSaving}
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
                  Adresse de livraison{" "}
                  <Text style={addDeliveryStyles.required}>*</Text>
                </Text>
                <TextInput
                  style={addDeliveryStyles.input}
                  placeholder="Angré petro ivoire ,Yopougon, Abidjan"
                  placeholderTextColor={COLORS.muted}
                  value={address}
                  onChangeText={(text) => {
                    setAddress(text);
                    setErrors((prev) => ({ ...prev, address: false }));
                  }}
                  editable={!isSaving}
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

        {/* Section Commerçant */}
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
                Nom du commerçant{" "}
                <Text style={addDeliveryStyles.required}>*</Text>
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
                  editable={!isSaving}
                />

                {merchantName.length > 0 && !isSaving && (
                  <TouchableOpacity
                    style={addDeliveryStyles.clearButton}
                    onPress={() => {
                      setMerchantName(""); // Vide le texte
                      setMerchantId(null); // Supprime l'ID du commerçant sélectionné
                      setShowSuggestions(false); // Ferme la liste
                      setFilteredMerchants([]); // Vide la liste filtrée
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
              {showSuggestions && !isSaving && (
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
                        <Text style={addDeliveryStyles.suggestionName}>
                          {item.name}
                        </Text>
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
            {/* Valeur du colis - optionnelle selon paymentType */}
            <View
              style={[
                addDeliveryStyles.financialCard,
                paymentType === "CLIENT_PAYE_TOUT" &&
                  errors.parcelValue &&
                  addDeliveryStyles.inputError,
              ]}
            >
              <Text style={addDeliveryStyles.inputLabel}>
                Valeur du colis{" "}
                {(paymentType === "CLIENT_PAYE_TOUT" ||
                  paymentType === "LIVRAISON_DEJA_PAYEE") && (
                  <Text style={addDeliveryStyles.required}>*</Text>
                )}
                {paymentType !== "CLIENT_PAYE_TOUT" &&
                  paymentType !== "LIVRAISON_DEJA_PAYEE" && (
                    <Text style={addDeliveryStyles.optional}></Text>
                  )}
              </Text>
              <View style={addDeliveryStyles.currencyInput}>
                <Text
                  style={[
                    addDeliveryStyles.currencySymbol,
                    (paymentType === "CLIENT_PAYE_TOUT" ||
                      paymentType === "LIVRAISON_DEJA_PAYEE") &&
                      errors.parcelValue && { color: COLORS.danger },
                  ]}
                >
                  FCFA
                </Text>
                <TextInput
                  style={[
                    addDeliveryStyles.financialInput,
                    paymentType === "CLIENT_PAYE_TOUT" &&
                      errors.parcelValue && { color: COLORS.danger },
                  ]}
                  placeholder={
                    paymentType !== "CLIENT_PAYE_TOUT" ? " " : "0,00"
                  }
                  placeholderTextColor={COLORS.muted}
                  value={parcelValue}
                  onChangeText={(text) => {
                    handleCurrencyChange(text, setParcelValue);
                    setErrors((prev) => ({ ...prev, parcelValue: false }));
                  }}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                />
              </View>
              {paymentType === "CLIENT_PAYE_TOUT" && errors.parcelValue && (
                <Text style={addDeliveryStyles.errorText}>
                  Valeur supérieure à 0 requise
                </Text>
              )}
            </View>

            {/* Frais de livraison - obligatoire sauf pour COLIS_DEJA_PAYE */}
            <View
              style={[
                addDeliveryStyles.financialCard,
                paymentType !== "COLIS_DEJA_PAYE" &&
                  paymentType !== "LIVRAISON_DEJA_PAYEE" &&
                  errors.deliveryFee &&
                  addDeliveryStyles.inputError,
              ]}
            >
              <Text style={addDeliveryStyles.inputLabel}>
                Frais de livraison{" "}
                {paymentType !== "COLIS_DEJA_PAYE" && paymentType !== "LIVRAISON_DEJA_PAYEE" && (
                  <Text style={addDeliveryStyles.required}>*</Text>
                )}
                {paymentType === "COLIS_DEJA_PAYE" && (
                  <Text style={addDeliveryStyles.optional}></Text>
                )}
              </Text>
              <View style={addDeliveryStyles.currencyInput}>
                <Text
                  style={[
                    addDeliveryStyles.currencySymbol,
                    paymentType !== "COLIS_DEJA_PAYE" &&
                      errors.deliveryFee && { color: COLORS.danger },
                  ]}
                >
                  FCFA
                </Text>
                <TextInput
                  style={[
                    addDeliveryStyles.financialInput,
                    paymentType !== "COLIS_DEJA_PAYE" &&
                      errors.deliveryFee && { color: COLORS.danger },
                  ]}
                  placeholder={paymentType === "COLIS_DEJA_PAYE" ? " " : "0,00"}
                  placeholderTextColor={COLORS.muted}
                  value={deliveryFee}
                  onChangeText={(text) => {
                    handleCurrencyChange(text, setDeliveryFee);
                    setErrors((prev) => ({ ...prev, deliveryFee: false }));
                  }}
                  keyboardType="decimal-pad"
                  editable={!isSaving}
                />
              </View>
              {paymentType !== "COLIS_DEJA_PAYE" && errors.deliveryFee && (
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
                  label: "Client paie colis et livraison",
                  description: "Le client paie tout à la livraison",
                },
                {
                  key: "CLIENT_PAYE_LIVRAISON",
                  label: "Client paie livraison seulement",
                  description:
                    "Le colis est déjà payé, client paie la livraison",
                },
                {
                  key: "LIVRAISON_DEJA_PAYEE", // ✅ Correction ici
                  label: "Livraison déjà payée",
                  description:
                    "Frais de livraison déjà payés, client paie le colis",
                },
                {
                  key: "COLIS_DEJA_PAYE",
                  label: "Colis et livraison déjà payés",
                  description: "Tout est déjà payé en ligne",
                },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    addDeliveryStyles.paymentOption,
                    paymentType === item.key &&
                      addDeliveryStyles.paymentSelected,
                  ]}
                  onPress={() => {
                    setPaymentType(item.key as any);
                    setErrors((prev) => ({
                      ...prev,
                      parcelValue: false,
                      deliveryFee: false,
                    }));
                  }}
                  disabled={isSaving}
                >
                  <Text style={addDeliveryStyles.paymentText}>
                    {item.label}
                  </Text>
                  <Text style={addDeliveryStyles.paymentDescription}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Total */}
          <View style={addDeliveryStyles.netIncomeCard}>
            <View style={addDeliveryStyles.netIncomeContent}>
              <Text style={addDeliveryStyles.netIncomeLabel}>TOTAL</Text>
              <Text style={addDeliveryStyles.netIncomeSubtitle}>
                {paymentType === "COLIS_DEJA_PAYE"
                  ? "Déjà payé"
                  : paymentType === "CLIENT_PAYE_LIVRAISON"
                    ? "Frais de livraison uniquement"
                    : paymentType === "LIVRAISON_DEJA_PAYEE" // 🔥 NOUVEAU
                      ? "Colis uniquement (livraison déjà payée)"
                      : "Valeur + Frais"}
              </Text>
            </View>
            <Text style={addDeliveryStyles.netIncomeAmount}>
              {calculateTotal()} FCFA
            </Text>
          </View>
        </View>

        {/* Espace pour le bouton flottant */}
        <View style={addDeliveryStyles.bottomSpacer} />
      </ScrollView>

      {/* Bouton d'action */}
      <BlurView style={addDeliveryStyles.actionButtons}>
        <TouchableOpacity
          style={[addDeliveryStyles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={addDeliveryStyles.saveButtonText}>
            {isSaving
              ? "Enregistrement..."
              : isEditing
                ? "Modifier la livraison"
                : "Enregistrer la livraison"}
          </Text>
        </TouchableOpacity>
      </BlurView>
    </KeyboardAvoidingView>
  );
}
