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
import { useState, useEffect, useRef } from "react";
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
    | "COLIS_DEJA_PAYE"
    | "CLIENT_PAYE_LIVRAISON"
    | "CLIENT_PAYE_TOUT"
    | "LIVRAISON_DEJA_PAYEE";
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

  const [loading, setLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState("");
  const [errors, setErrors] = useState({
    recipientName: false,
    phone: false,
    address: false,
    parcelValue: false,
    deliveryFee: false,
    merchantName: false,
  });

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filteredMerchants, setFilteredMerchants] = useState<Merchant[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 🔥 Ref pour éviter les doubles soumissions
  const isSubmitting = useRef(false);
  // 🔥 Ref pour stocker la promesse de synchronisation en cours
  const syncPromiseRef = useRef<Promise<any> | null>(null);

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
        if (delivery.status === "LIVREE" || delivery.status === "ANNULEE") {
          showError(
            "Modification impossible",
            "Cette livraison ne peut plus être modifiée.",
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
    try {
      const result = await db.getAllAsync<Merchant>(
        "SELECT * FROM merchants ORDER BY name ASC",
      );
      setMerchants(result);
    } catch (error) {
      console.error("Erreur chargement merchants:", error);
    }
  };

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

  const validateForm = () => {
    const baseValidation = {
      recipientName: !recipientName.trim(),
      phone: !phone.trim(),
      address: !address.trim(),
      merchantName: !merchantName.trim(),
    };

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
          parcelValue: false,
          deliveryFee:
            !deliveryFee.trim() || Number(deliveryFee.replace(",", ".")) <= 0,
        };
        break;
      case "LIVRAISON_DEJA_PAYEE":
        financialValidation = {
          parcelValue:
            !parcelValue.trim() || Number(parcelValue.replace(",", ".")) <= 0,
          deliveryFee: false,
        };
        break;
      case "COLIS_DEJA_PAYE":
        financialValidation = {
          parcelValue: false,
          deliveryFee: false,
        };
        break;
    }

    const newErrors = { ...baseValidation, ...financialValidation };
    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };
const getOrCreateMerchant = async () => {
  if (!merchantName.trim()) {
    console.log("⚠️ Pas de nom de commerçant, merchant_id sera null");
    return null;
  }

  if (!user?.id) {
    console.log("⚠️ Pas d'utilisateur connecté");
    return null;
  }

  // 🔥 Récupérer l'UID Firebase de l'utilisateur connecté
  const { auth } = require("../src/config/firebase");
  const firebaseUid = auth.currentUser?.uid;
  
  if (!firebaseUid) {
    console.log("⚠️ Pas d'UID Firebase, utilisation de l'ID local");
  }

  // 🔥 Chercher par nom ET par l'identifiant Firebase (ou local si pas Firebase)
  const existingMerchant = await db.getFirstAsync<any>(
    "SELECT * FROM merchants WHERE name = ? AND user_id = ?",
    [merchantName.trim(), firebaseUid || user.id.toString()],
  );

  if (existingMerchant) {
    console.log("✅ Commerçant existant trouvé:", {
      id: existingMerchant.id,
      name: existingMerchant.name,
      firebase_id: existingMerchant.firebase_id,
      user_id: existingMerchant.user_id,
    });
    
    if (!existingMerchant.firebase_id) {
      console.log("⚠️ Commerçant sans firebase_id, synchronisation en arrière-plan...");
      markAndSync("merchants", existingMerchant.id).catch(e => 
        console.log("⚠️ Sync différée commerçant:", e)
      );
    }
    
    return existingMerchant.id;
  }

  // 🔥 Créer un nouveau commerçant avec l'UID Firebase comme user_id
  const result = await db.runAsync(
    `INSERT INTO merchants (name, phone, user_id, created_at, needs_sync) 
     VALUES (?, ?, ?, ?, 1)`,
    [
      merchantName.trim(),
      phone.trim() || null,
      firebaseUid || user.id.toString(), // UID Firebase prioritaire
      new Date().toISOString(),
    ],
  );

  const newId = result.lastInsertRowId;
  console.log("🆕 Nouveau commerçant créé, ID:", newId, "user_id:", firebaseUid);

  // Lancer la synchronisation en arrière-plan
  markAndSync("merchants", newId).catch(e => 
    console.log("⚠️ Sync différée nouveau commerçant:", e)
  );

  return newId;
};

  const handleSave = async () => {
    // 🔥 Empêcher les doubles soumissions
    if (isSubmitting.current) {
      console.log("⚠️ Soumission déjà en cours, ignorée");
      return;
    }

    if (!validateForm()) {
      showError("Erreur", "Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (!isAuthenticated || !user) {
      showError("Erreur", "Vous devez être connecté");
      return;
    }

    // 🔥 Marquer comme en cours de soumission
    isSubmitting.current = true;
    setIsSaving(true);
    setSavingProgress("Enregistrement...");

    try {
      const parcelValueNum = parcelValue
        ? Number(parcelValue.replace(",", ".") || 0)
        : 0;
      const deliveryFeeNum = deliveryFee
        ? Number(deliveryFee.replace(",", ".") || 0)
        : 0;

      // 🔥 Créer/récupérer le commerçant (la sync est lancée en arrière-plan)
      setSavingProgress("Préparation du commerçant...");
      const merchantIdValue = await getOrCreateMerchant();
      console.log("🏪 Merchant ID local:", merchantIdValue);

      // Calculer les montants
      let amountCollected = 0;
      let amountToReturn = 0;
      let profit = 0;

      switch (paymentType) {
        case "CLIENT_PAYE_TOUT":
          amountCollected = parcelValueNum + deliveryFeeNum;
          amountToReturn = parcelValueNum;
          profit = deliveryFeeNum;
          break;
        case "CLIENT_PAYE_LIVRAISON":
          amountCollected = deliveryFeeNum;
          amountToReturn = 0;
          profit = deliveryFeeNum;
          break;
        case "LIVRAISON_DEJA_PAYEE":
          amountCollected = parcelValueNum;
          amountToReturn = parcelValueNum;
          profit = 0;
          break;
        case "COLIS_DEJA_PAYE":
          amountCollected = 0;
          amountToReturn = 0;
          profit = 0;
          break;
      }

      setSavingProgress("Sauvegarde...");

      if (isEditing) {
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

        // 🔥 Lancer la synchronisation en arrière-plan
        markAndSync("deliveries", Number(id)).catch(e => 
          console.log("⚠️ Sync différée livraison:", e)
        );
        
        showSuccess("Succès", "Livraison modifiée avec succès");
      } else {
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

        // 🔥 Lancer la synchronisation en arrière-plan (ne pas attendre)
        markAndSync("deliveries", result.lastInsertRowId).catch(e => 
          console.log("⚠️ Sync différée livraison:", e)
        );

        // 🔥 Notification en arrière-plan
        sendDeliveryCreatedNotification(user.id, 1).catch(e => 
          console.log("⚠️ Notification différée:", e)
        );
        
        showSuccess("Succès", "Livraison ajoutée avec succès");
      }

      // 🔥 Retour immédiat, ne pas attendre
      setSavingProgress("");
      router.back();
    } catch (error: any) {
      console.error("❌ Erreur:", error);
      showError("Erreur", "Impossible d'enregistrer la livraison");
      setIsSaving(false);
      setSavingProgress("");
    } finally {
      // 🔥 Réinitialiser le flag de soumission après un court délai
      setTimeout(() => {
        isSubmitting.current = false;
      }, 500);
    }
  };

  const handleCancel = () => {
    if (isSaving) return; // Empêcher d'annuler pendant la sauvegarde
    
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
      case "LIVRAISON_DEJA_PAYEE":
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
      <BlurView intensity={95} style={addDeliveryStyles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          style={addDeliveryStyles.cancelButton}
          disabled={isSaving}
        >
          <Text style={[
            addDeliveryStyles.cancelButtonText,
            isSaving && { opacity: 0.5 }
          ]}>
            Annuler
          </Text>
        </TouchableOpacity>
        <Text style={addDeliveryStyles.headerTitle}>
          {isEditing ? "Modifier la Livraison" : "Ajouter une Livraison"}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          style={addDeliveryStyles.saveButtonHeader}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={addDeliveryStyles.saveButtonHeaderText}>
              Enregistrer
            </Text>
          )}
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
                    )
                      setShowSuggestions(true);
                  }}
                  autoCapitalize="words"
                  editable={!isSaving}
                />
                {merchantName.length > 0 && !isSaving && (
                  <TouchableOpacity
                    style={addDeliveryStyles.clearButton}
                    onPress={() => {
                      setMerchantName("");
                      setMerchantId(null);
                      setShowSuggestions(false);
                      setFilteredMerchants([]);
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
                {paymentType !== "COLIS_DEJA_PAYE" &&
                  paymentType !== "LIVRAISON_DEJA_PAYEE" && (
                    <Text style={addDeliveryStyles.required}>*</Text>
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
                  key: "LIVRAISON_DEJA_PAYEE",
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

          <View style={addDeliveryStyles.netIncomeCard}>
            <View style={addDeliveryStyles.netIncomeContent}>
              <Text style={addDeliveryStyles.netIncomeLabel}>TOTAL</Text>
              <Text style={addDeliveryStyles.netIncomeSubtitle}>
                {paymentType === "COLIS_DEJA_PAYE"
                  ? "Déjà payé"
                  : paymentType === "CLIENT_PAYE_LIVRAISON"
                    ? "Frais de livraison uniquement"
                    : paymentType === "LIVRAISON_DEJA_PAYEE"
                      ? "Colis uniquement (livraison déjà payée)"
                      : "Valeur + Frais"}
              </Text>
            </View>
            <Text style={addDeliveryStyles.netIncomeAmount}>
              {calculateTotal()} FCFA
            </Text>
          </View>
        </View>

        <View style={addDeliveryStyles.bottomSpacer} />
      </ScrollView>

      <BlurView style={addDeliveryStyles.actionButtons}>
        <TouchableOpacity
          style={[addDeliveryStyles.saveButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={addDeliveryStyles.saveButtonText}>
                {savingProgress || "Enregistrement..."}
              </Text>
            </View>
          ) : (
            <Text style={addDeliveryStyles.saveButtonText}>
              {isEditing ? "Modifier la livraison" : "Enregistrer la livraison"}
            </Text>
          )}
        </TouchableOpacity>
      </BlurView>
    </KeyboardAvoidingView>
  );
}