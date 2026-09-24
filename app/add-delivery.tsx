import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useState, useEffect, useRef, useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import * as Contacts from "expo-contacts";
import { commonStyles } from "../styles/common";
import { addDeliveryStyles } from "../styles/addDeliveryStyles";
import { COLORS } from "../styles/colors";
import { useAuth } from "../src/context/AuthContext";
import { useModal } from "../providers/ModalProvider";
import { sendDeliveryCreatedNotification } from "../src/services/notification.service";
import { useSync } from "../src/hooks/useSync";
import { DeliveryRepository } from "../src/repositories/delivery.repository";
import { MerchantRepository } from "../src/repositories/merchant.repository";
import { MerchantService } from "../src/services/merchant.service";
import { Formatters } from "../src/utils/formatters";
import { Delivery, Merchant, PaymentType } from "../src/types";
import { useTutorial } from "../src/hooks/useTutorial";
import TutorialOverlay from "../components/TutorialOverlay";
import { TutorialProvider } from "../src/context/TutorialContext";
import TutorialTarget from "../components/TutorialTarget";
import TutorialScrollRegistrar from "../components/TutorialScrollRegistrar";

type PaymentOption = {
  key: PaymentType;
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    key: "CLIENT_PAYE_TOUT",
    title: "Client paie tout",
    description:
      "Le client remet la valeur totale (Colis + Frais de course) en cash.",
    icon: "account-balance-wallet",
  },
  {
    key: "CLIENT_PAYE_LIVRAISON",
    title: "Colis déjà payé",
    description:
      "Le destinataire paie uniquement tes frais de livraison sur place.",
    icon: "moped",
  },
  {
    key: "LIVRAISON_DEJA_PAYEE",
    title: "Client paie seulement le colis",
    description:
      "La livraison est prise en charge par le commerçant partenaire.",
    icon: "inventory-2",
  },
  {
    key: "COLIS_DEJA_PAYE",
    title: "Course 100% prépayée",
    description:
      "Aucun encaissement requis sur place. Simple remise en main propre.",
    icon: "verified",
  },
];

const parseAmount = (text: string): number => {
  if (!text) return 0;
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Moteur de calcul temps réel — mêmes formules que la sauvegarde.
// Source unique de vérité pour l'affichage ET la persistance.
export function computeAmounts(
  parcelValueNum: number,
  deliveryFeeNum: number,
  paymentType: PaymentType,
): { amountCollected: number; amountToReturn: number; profit: number } {
  switch (paymentType) {
    case "CLIENT_PAYE_TOUT":
      return {
        amountCollected: parcelValueNum + deliveryFeeNum,
        amountToReturn: parcelValueNum,
        profit: deliveryFeeNum,
      };
    case "CLIENT_PAYE_LIVRAISON":
      return {
        amountCollected: deliveryFeeNum,
        amountToReturn: 0,
        profit: deliveryFeeNum,
      };
    case "LIVRAISON_DEJA_PAYEE":
      return {
        amountCollected: parcelValueNum,
        amountToReturn: parcelValueNum,
        profit: 0,
      };
    case "COLIS_DEJA_PAYE":
      return { amountCollected: 0, amountToReturn: 0, profit: 0 };
    default:
      return {
        amountCollected: parcelValueNum + deliveryFeeNum,
        amountToReturn: parcelValueNum,
        profit: deliveryFeeNum,
      };
  }
}

export default function AddDelivery() {
  const scrollRef = useRef<any>(null);
  const merchantSearchRef = useRef<TextInput>(null);
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
  const [paymentType, setPaymentType] = useState<PaymentType>("CLIENT_PAYE_TOUT");
  const [notes, setNotes] = useState("");
  const { markAndSync } = useSync();

  const [loading, setLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState("");
  const [isImportingContact, setIsImportingContact] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
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

  // Tutoriel
  const {
    isVisible: isTutorialVisible,
    currentStep: tutorialStep,
    tutorial,
    nextStep: tutorialNext,
    prevStep: tutorialPrev,
    closeTutorial: tutorialClose,
    showTutorial: tutorialShow,
  } = useTutorial("add-delivery");

  // Ref pour éviter les doubles soumissions
  const isSubmitting = useRef(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    NetInfo.fetch().then((s) => setIsConnected(s.isConnected ?? true));
    return () => unsub();
  }, []);

  const userInitial = useMemo(() => {
    const name = user?.name || "?";
    return name.trim().charAt(0).toUpperCase() || "?";
  }, [user?.name]);

  // Calculateur temps réel
  const amounts = useMemo(() => {
    const parcelNum = parseAmount(parcelValue);
    const feeNum = parseAmount(deliveryFee);
    return {
      parcelNum,
      feeNum,
      ...computeAmounts(parcelNum, feeNum, paymentType),
    };
  }, [parcelValue, deliveryFee, paymentType]);

  useEffect(() => {
    if (isEditing) {
      loadDeliveryData();
    }
    loadMerchants();
  }, [id]);

  const loadDeliveryData = async () => {
    try {
      const delivery = await DeliveryRepository.findById(Number(id));

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
        setParcelValue((delivery.parcel_value ?? 0).toString());
        setDeliveryFee(delivery.delivery_fee.toString());
        setPaymentType(delivery.payment_type);
        setNotes(delivery.notes || "");

        if (delivery.merchant_id) {
          const merchant = await MerchantRepository.findById(delivery.merchant_id);
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
      const result = await MerchantRepository.findAll();
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
    } else {
      setFilteredMerchants([]);
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
          parcelValue: !parcelValue.trim() || parseAmount(parcelValue) <= 0,
          deliveryFee: !deliveryFee.trim() || parseAmount(deliveryFee) <= 0,
        };
        break;
      case "CLIENT_PAYE_LIVRAISON":
        financialValidation = {
          parcelValue: false,
          deliveryFee: !deliveryFee.trim() || parseAmount(deliveryFee) <= 0,
        };
        break;
      case "LIVRAISON_DEJA_PAYEE":
        financialValidation = {
          parcelValue: !parcelValue.trim() || parseAmount(parcelValue) <= 0,
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
    if (!merchantName.trim() || !user?.id) return null;

    try {
      const merchantIdValue = await MerchantService.getOrCreate(
        merchantName.trim(),
        phone.trim() || undefined,
      );

      if (merchantIdValue) {
        markAndSync("merchants", merchantIdValue).catch((e) =>
          console.log("⚠️ Sync différée commerçant:", e),
        );
      }

      return merchantIdValue;
    } catch (error) {
      console.error("❌ Erreur getOrCreateMerchant:", error);
      return null;
    }
  };

  // Import depuis le répertoire du téléphone
  const importFromContacts = async () => {
    if (isImportingContact) return;
    setIsImportingContact(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        showAlert(
          "Accès refusé",
          "Autorisez l'accès aux contacts pour pré-remplir le destinataire, ou saisissez manuellement.",
        );
        return;
      }
      const contact = await Contacts.presentContactPickerAsync();
      if (contact) {
        if (contact.name) {
          setRecipientName(contact.name);
          setErrors((prev) => ({ ...prev, recipientName: false }));
        }
        const firstPhone = contact.phoneNumbers?.[0]?.number;
        if (firstPhone) {
          setPhone(firstPhone);
          setErrors((prev) => ({ ...prev, phone: false }));
        }
        const postal =
          contact.addresses?.[0];
        if (postal && !address) {
          const parts = [
            postal.street,
            postal.city,
            postal.region,
          ].filter(Boolean);
          if (parts.length > 0) setAddress(parts.join(", "));
        }
      }
    } catch (e) {
      console.error("❌ Erreur import contact:", e);
      showAlert(
        "Contacts indisponibles",
        "Impossible d'ouvrir le répertoire sur cet appareil. Saisissez manuellement.",
      );
    } finally {
      setIsImportingContact(false);
    }
  };

  const handleSave = async () => {
    // Empêcher les doubles soumissions
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

    // Marquer comme en cours de soumission
    isSubmitting.current = true;
    setIsSaving(true);
    setSavingProgress("Validation locale...");

    try {
      const parcelValueNum = parseAmount(parcelValue);
      const deliveryFeeNum = parseAmount(deliveryFee);

      // Créer/récupérer le commerçant (la sync est lancée en arrière-plan)
      setSavingProgress("Préparation du commerçant...");
      const merchantIdValue = await getOrCreateMerchant();
      console.log("🏪 Merchant ID local:", merchantIdValue);

      // Calculer les montants (mêmes formules que le calculateur temps réel)
      const { amountCollected, amountToReturn, profit } = computeAmounts(
        parcelValueNum,
        deliveryFeeNum,
        paymentType,
      );

      setSavingProgress(
        isConnected ? "Sauvegarde..." : "Sauvegarde locale (hors-ligne)...",
      );

      const trimmedNotes = notes.trim();

      if (isEditing) {
        await DeliveryRepository.update(Number(id), {
          recipient_name: recipientName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          parcel_value: parcelValueNum,
          delivery_fee: deliveryFeeNum,
          merchant_id: merchantIdValue ?? undefined,
          payment_type: paymentType,
          amount_collected: amountCollected,
          amount_to_return: amountToReturn,
          profit,
          needs_sync: 1,
          notes: trimmedNotes,
        });

        markAndSync("deliveries", Number(id)).catch((e) =>
          console.log("⚠️ Sync différée livraison:", e),
        );

        showSuccess("Succès", "Livraison modifiée avec succès");
      } else {
        const newDelivery = await DeliveryRepository.create({
          recipient_name: recipientName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          parcel_value: parcelValueNum,
          delivery_fee: deliveryFeeNum,
          merchant_id: merchantIdValue ?? undefined,
          payment_type: paymentType,
          amount_collected: amountCollected,
          amount_to_return: amountToReturn,
          profit,
          user_id: user.id,
          notes: trimmedNotes,
        });

        // Offline-first : sauvegarde locale immédiate, sync différée
        markAndSync("deliveries", newDelivery.id).catch((e) =>
          console.log("⚠️ Sync différée livraison:", e),
        );

        sendDeliveryCreatedNotification(user.id, 1).catch((e) =>
          console.log("⚠️ Notification différée:", e),
        );

        setSavingProgress("Course sauvegardée !");
        showSuccess(
          "Succès",
          isConnected
            ? "Livraison ajoutée avec succès"
            : "Course enregistrée localement — sera synchronisée dès retour réseau ☁️",
        );
      }

      // Retour immédiat, ne pas attendre
      setSavingProgress("");
      router.back();
    } catch (error: unknown) {
      console.error("❌ Erreur:", error);
      showError("Erreur", "Impossible d'enregistrer la livraison");
      setIsSaving(false);
      setSavingProgress("");
    } finally {
      // Réinitialiser le flag de soumission après un court délai
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
      merchantName ||
      notes
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

  const clearMerchant = () => {
    setMerchantName("");
    setMerchantId(null);
    setShowSuggestions(false);
    setFilteredMerchants([]);
  };

  const handleNewMerchant = () => {
    clearMerchant();
    setErrors((prev) => ({ ...prev, merchantName: false }));
    requestAnimationFrame(() => merchantSearchRef.current?.focus());
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

  const hasSelectedMerchant = merchantName.trim().length > 0;

  return (
    <TutorialProvider>
      <View style={[commonStyles.container, { backgroundColor: "#F8F9FC" }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* En-tête : retour, titre, Sync, avatar */}
        <View style={addDeliveryStyles.header}>
          <View style={addDeliveryStyles.headerLeft}>
            <TouchableOpacity
              style={addDeliveryStyles.backButton}
              onPress={handleCancel}
              accessibilityLabel="Retour"
              disabled={isSaving}
            >
              <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={addDeliveryStyles.headerTitle} numberOfLines={1}>
              {isEditing ? "Modifier la course" : "Nouvelle Course"}
            </Text>
          </View>
          <View style={addDeliveryStyles.headerRight}>
            <View style={addDeliveryStyles.syncPill}>
              <View
                style={[
                  addDeliveryStyles.syncDot,
                  { backgroundColor: isConnected ? COLORS.primary : "#D97706" },
                ]}
              />
              <Text style={addDeliveryStyles.syncText}>
                {isConnected ? "Sync" : "Off"}
              </Text>
            </View>
            <TouchableOpacity
              style={addDeliveryStyles.avatar}
              onPress={() => router.push("/settings")}
              accessibilityLabel="Profil"
            >
              <Text style={addDeliveryStyles.avatarText}>{userInitial}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={tutorialShow}
              style={addDeliveryStyles.backButton}
              accessibilityLabel="Aide"
            >
              <MaterialIcons name="help-outline" size={22} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bannière saisie express */}
        <View style={addDeliveryStyles.expressBanner}>
          <TouchableOpacity
            style={addDeliveryStyles.closeButton}
            onPress={handleCancel}
            accessibilityLabel="Fermer la saisie express"
            disabled={isSaving}
          >
            <MaterialIcons name="close" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={addDeliveryStyles.expressTitle}>
            <Text style={addDeliveryStyles.expressTitleText}>
              Nouvelle livraison
            </Text>
            <Text style={addDeliveryStyles.expressSubtitle}>
              Saisie express • 15 secondes
            </Text>
          </View>
          <View
            style={[
              addDeliveryStyles.offlineBadge,
              isConnected && addDeliveryStyles.offlineBadgeOnline,
            ]}
          >
            <MaterialIcons
              name={isConnected ? "sync" : "cloud-queue"}
              size={14}
              color={isConnected ? COLORS.successText : COLORS.infoText}
            />
            <Text
              style={[
                addDeliveryStyles.offlineBadgeText,
                isConnected && addDeliveryStyles.offlineBadgeTextOnline,
              ]}
            >
              {isConnected ? "En ligne • Sync auto" : "Mode hors-ligne actif"}
            </Text>
          </View>
        </View>

        <TutorialScrollRegistrar scrollRef={scrollRef}>
          <KeyboardAwareScrollView
            ref={scrollRef}
            style={addDeliveryStyles.scrollView}
            contentContainerStyle={addDeliveryStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            enableAutomaticScroll
            extraScrollHeight={180}
            keyboardOpeningTime={100}
          >
            {/* 1. Destinataire */}
            <TutorialTarget id="input-recipient-name">
              <View style={addDeliveryStyles.sectionCard}>
                <View style={addDeliveryStyles.sectionHeader}>
                  <View style={addDeliveryStyles.sectionTitleRow}>
                    <MaterialIcons
                      name="person-pin-circle"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={addDeliveryStyles.sectionTitle}>
                      1. Destinataire
                    </Text>
                  </View>
                  <Text style={addDeliveryStyles.requiredHint}>
                    * Champs obligatoires
                  </Text>
                </View>

                <View style={addDeliveryStyles.fieldGroup}>
                  <Text style={addDeliveryStyles.inputLabel}>
                    Nom & Prénom <Text style={addDeliveryStyles.required}>*</Text>
                  </Text>
                  <View
                    style={[
                      addDeliveryStyles.inputBox,
                      errors.recipientName && addDeliveryStyles.inputBoxError,
                    ]}
                  >
                    <MaterialIcons name="person" size={20} color={COLORS.muted} />
                    <TextInput
                      style={addDeliveryStyles.input}
                      placeholder="ex: Fatou Ndiaye"
                      placeholderTextColor={COLORS.placeholder}
                      value={recipientName}
                      onChangeText={(text) => {
                        setRecipientName(text);
                        setErrors((prev) => ({ ...prev, recipientName: false }));
                      }}
                      autoCapitalize="words"
                      returnKeyType="next"
                      editable={!isSaving}
                      onFocus={(e) =>
                        scrollRef.current?.scrollToFocusedInput(e.target)
                      }
                    />
                  </View>
                  {errors.recipientName && (
                    <Text style={addDeliveryStyles.errorText}>
                      Ce champ est obligatoire
                    </Text>
                  )}
                </View>

                <View style={addDeliveryStyles.fieldGroup}>
                  <Text style={addDeliveryStyles.inputLabel}>
                    Téléphone <Text style={addDeliveryStyles.required}>*</Text>
                  </Text>
                  <View
                    style={[
                      addDeliveryStyles.inputBox,
                      errors.phone && addDeliveryStyles.inputBoxError,
                    ]}
                  >
                    <MaterialIcons name="call" size={20} color={COLORS.muted} />
                    <TextInput
                      style={addDeliveryStyles.input}
                      placeholder="+225 07 77 12 34 56"
                      placeholderTextColor={COLORS.placeholder}
                      value={phone}
                      onChangeText={(text) => {
                        setPhone(text);
                        setErrors((prev) => ({ ...prev, phone: false }));
                      }}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                      editable={!isSaving}
                      onFocus={(e) =>
                        scrollRef.current?.scrollToFocusedInput(e.target)
                      }
                    />
                    <TouchableOpacity
                      style={addDeliveryStyles.contactButton}
                      onPress={importFromContacts}
                      accessibilityLabel="Importer depuis le répertoire"
                      disabled={isSaving || isImportingContact}
                    >
                      {isImportingContact ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <MaterialIcons
                          name="contact-phone"
                          size={18}
                          color={COLORS.primary}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                  {errors.phone && (
                    <Text style={addDeliveryStyles.errorText}>
                      Ce champ est obligatoire
                    </Text>
                  )}
                </View>

                <View style={addDeliveryStyles.fieldGroup}>
                  <Text style={addDeliveryStyles.inputLabel}>
                    Adresse & Repères{" "}
                    <Text style={addDeliveryStyles.required}>*</Text>
                  </Text>
                  <View
                    style={[
                      addDeliveryStyles.inputBox,
                      errors.address && addDeliveryStyles.inputBoxError,
                    ]}
                  >
                    <MaterialIcons
                      name="location-on"
                      size={20}
                      color={COLORS.muted}
                    />
                    <TextInput
                      style={addDeliveryStyles.input}
                      placeholder="ex: Cocody, Rue des Jardins, Imm. B porte 12"
                      placeholderTextColor={COLORS.placeholder}
                      value={address}
                      onChangeText={(text) => {
                        setAddress(text);
                        setErrors((prev) => ({ ...prev, address: false }));
                      }}
                      returnKeyType="next"
                      editable={!isSaving}
                      onFocus={(e) =>
                        scrollRef.current?.scrollToFocusedInput(e.target)
                      }
                    />
                  </View>
                  {errors.address && (
                    <Text style={addDeliveryStyles.errorText}>
                      Ce champ est obligatoire
                    </Text>
                  )}
                </View>
              </View>
            </TutorialTarget>

            {/* 2. Commerçant partenaire */}
            <TutorialTarget id="input-merchant-search">
              <View style={addDeliveryStyles.sectionCard}>
                <View style={addDeliveryStyles.sectionHeader}>
                  <View style={addDeliveryStyles.sectionTitleRow}>
                    <MaterialIcons
                      name="storefront"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={addDeliveryStyles.sectionTitle}>
                      2. Commerçant partenaire
                    </Text>
                  </View>
                </View>

                <View style={addDeliveryStyles.merchantRow}>
                  {hasSelectedMerchant && (
                    <View style={addDeliveryStyles.merchantChip}>
                      <View style={addDeliveryStyles.merchantDot} />
                      <Text
                        style={addDeliveryStyles.merchantChipText}
                        numberOfLines={1}
                      >
                        {merchantName.trim()}
                      </Text>
                      {!isSaving && (
                        <TouchableOpacity
                          style={addDeliveryStyles.merchantChipClose}
                          onPress={clearMerchant}
                          accessibilityLabel="Retirer le commerçant"
                        >
                          <MaterialIcons
                            name="close"
                            size={16}
                            color={COLORS.successText}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {!isSaving && (
                    <TouchableOpacity
                      style={addDeliveryStyles.newMerchantButton}
                      onPress={handleNewMerchant}
                      accessibilityLabel="Nouveau commerçant"
                    >
                      <MaterialIcons
                        name="add-circle"
                        size={16}
                        color={COLORS.infoText}
                      />
                      <Text style={addDeliveryStyles.newMerchantText}>
                        + Nouveau
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View
                  style={[
                    addDeliveryStyles.searchBox,
                    errors.merchantName && addDeliveryStyles.inputBoxError,
                  ]}
                >
                  <MaterialIcons name="search" size={18} color={COLORS.muted} />
                  <TextInput
                    ref={merchantSearchRef}
                    style={addDeliveryStyles.input}
                    placeholder="Changer ou rechercher un commerçant..."
                    placeholderTextColor={COLORS.placeholder}
                    value={merchantName}
                    onChangeText={(text) => {
                      setMerchantName(text);
                      setMerchantId(null);
                      setShowSuggestions(text.trim().length > 0);
                      setErrors((prev) => ({ ...prev, merchantName: false }));
                    }}
                    onFocus={(e) => {
                      if (
                        merchantName.trim().length > 0 &&
                        filteredMerchants.length > 0
                      )
                        setShowSuggestions(true);
                      scrollRef.current?.scrollToFocusedInput(e.target);
                    }}
                    autoCapitalize="words"
                    returnKeyType="next"
                    editable={!isSaving}
                  />
                </View>

                {showSuggestions &&
                  filteredMerchants.length > 0 &&
                  !isSaving && (
                    <View style={addDeliveryStyles.suggestionsContainer}>
                      {filteredMerchants.slice(0, 5).map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={addDeliveryStyles.suggestionItem}
                          onPress={() => selectMerchant(item)}
                        >
                          <MaterialIcons
                            name="store"
                            size={18}
                            color={COLORS.primary}
                          />
                          <View style={addDeliveryStyles.suggestionContent}>
                            <Text
                              style={addDeliveryStyles.suggestionName}
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            {!!item.phone && (
                              <Text style={addDeliveryStyles.suggestionPhone}>
                                {item.phone}
                              </Text>
                            )}
                          </View>
                          <MaterialIcons
                            name="check-circle"
                            size={18}
                            color={COLORS.primary}
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
              </View>
            </TutorialTarget>

            {/* 3. Mode de paiement */}
            <TutorialTarget id="selector-payment-type">
              <View style={addDeliveryStyles.sectionCard}>
                <View style={addDeliveryStyles.sectionHeader}>
                  <View style={addDeliveryStyles.sectionTitleRow}>
                    <MaterialIcons
                      name="payments"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={addDeliveryStyles.sectionTitle}>
                      3. Mode de paiement
                    </Text>
                  </View>
                </View>

                {PAYMENT_OPTIONS.map((item) => {
                  const selected = paymentType === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        addDeliveryStyles.paymentOption,
                        selected && addDeliveryStyles.paymentSelected,
                      ]}
                      onPress={() => {
                        setPaymentType(item.key);
                        setErrors((prev) => ({
                          ...prev,
                          parcelValue: false,
                          deliveryFee: false,
                        }));
                      }}
                      disabled={isSaving}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <View
                        style={[
                          addDeliveryStyles.radioOuter,
                          selected && addDeliveryStyles.radioOuterSelected,
                        ]}
                      >
                        {selected && (
                          <View style={addDeliveryStyles.radioInner} />
                        )}
                      </View>
                      <View style={addDeliveryStyles.paymentContent}>
                        <View style={addDeliveryStyles.paymentTitleRow}>
                          <MaterialIcons
                            name={item.icon}
                            size={18}
                            color={
                              selected ? COLORS.primary : COLORS.muted
                            }
                          />
                          <Text style={addDeliveryStyles.paymentText}>
                            {item.title}
                          </Text>
                        </View>
                        <Text style={addDeliveryStyles.paymentDescription}>
                          {item.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TutorialTarget>

            {/* 4. Montants */}
            <TutorialTarget id="input-parcel-value">
              <View style={addDeliveryStyles.sectionCard}>
                <View style={addDeliveryStyles.sectionHeader}>
                  <View style={addDeliveryStyles.sectionTitleRow}>
                    <MaterialIcons
                      name="calculate"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={addDeliveryStyles.sectionTitle}>
                      4. Montants en FCFA
                    </Text>
                  </View>
                </View>

                <View style={addDeliveryStyles.financialGrid}>
                  <View style={addDeliveryStyles.financialCard}>
                    <Text style={addDeliveryStyles.inputLabel}>
                      Valeur colis
                    </Text>
                    <View
                      style={[
                        addDeliveryStyles.amountBox,
                        errors.parcelValue &&
                          addDeliveryStyles.amountBoxError,
                      ]}
                    >
                      <TextInput
                        style={addDeliveryStyles.financialInput}
                        placeholder="25 000"
                        placeholderTextColor={COLORS.placeholder}
                        value={parcelValue}
                        onChangeText={(text) => {
                          handleCurrencyChange(text, setParcelValue);
                          setErrors((prev) => ({
                            ...prev,
                            parcelValue: false,
                          }));
                        }}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        editable={!isSaving}
                        onFocus={(e) =>
                          scrollRef.current?.scrollToFocusedInput(e.target)
                        }
                      />
                      <Text style={addDeliveryStyles.currencySymbol}>FCFA</Text>
                    </View>
                    {errors.parcelValue && (
                      <Text style={addDeliveryStyles.errorText}>
                        Valeur supérieure à 0 requise
                      </Text>
                    )}
                  </View>

                  <View style={addDeliveryStyles.financialCard}>
                    <Text style={addDeliveryStyles.inputLabel}>Ta course</Text>
                    <View
                      style={[
                        addDeliveryStyles.amountBox,
                        errors.deliveryFee &&
                          addDeliveryStyles.amountBoxError,
                      ]}
                    >
                      <TextInput
                        style={[
                          addDeliveryStyles.financialInput,
                          addDeliveryStyles.financialInputGain,
                        ]}
                        placeholder="1 500"
                        placeholderTextColor={COLORS.placeholder}
                        value={deliveryFee}
                        onChangeText={(text) => {
                          handleCurrencyChange(text, setDeliveryFee);
                          setErrors((prev) => ({
                            ...prev,
                            deliveryFee: false,
                          }));
                        }}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        editable={!isSaving}
                        onFocus={(e) =>
                          scrollRef.current?.scrollToFocusedInput(e.target)
                        }
                      />
                      <Text style={addDeliveryStyles.currencySymbol}>FCFA</Text>
                    </View>
                    {errors.deliveryFee && (
                      <Text style={addDeliveryStyles.errorText}>
                        Valeur supérieure à 0 requise
                      </Text>
                    )}
                  </View>
                </View>

                {/* Synthèse dynamique temps réel */}
                <View style={addDeliveryStyles.summaryBox}>
                  <View style={addDeliveryStyles.summaryRow}>
                    <Text style={addDeliveryStyles.summaryLabel}>
                      À encaisser du client
                    </Text>
                    <Text style={addDeliveryStyles.summaryEncaisser}>
                      {Formatters.formatNumber(amounts.amountCollected)} FCFA
                    </Text>
                  </View>
                  <View style={addDeliveryStyles.summaryDivider} />
                  <View style={addDeliveryStyles.summaryRow}>
                    <Text style={addDeliveryStyles.summaryLabel}>
                      À reverser au marchand
                    </Text>
                    <Text style={addDeliveryStyles.summaryReverser}>
                      {Formatters.formatNumber(amounts.amountToReturn)} FCFA
                    </Text>
                  </View>
                  <View style={addDeliveryStyles.benefitBox}>
                    <Text style={addDeliveryStyles.benefitLabel}>
                      <MaterialIcons
                        name="verified"
                        size={18}
                        color={COLORS.successText}
                      />{" "}
                      Ton bénéfice net course
                    </Text>
                    <Text style={addDeliveryStyles.benefitAmount}>
                      {Formatters.formatNumber(amounts.profit)} FCFA
                    </Text>
                  </View>
                </View>
              </View>
            </TutorialTarget>

            {/* Instructions facultatives */}
            <View style={addDeliveryStyles.sectionCard}>
              <Text style={addDeliveryStyles.inputLabel}>
                Instructions de livraison{" "}
                <Text style={addDeliveryStyles.optional}>(Facultatif)</Text>
              </Text>
              <View style={addDeliveryStyles.notesBox}>
                <MaterialIcons
                  name="description"
                  size={18}
                  color={COLORS.muted}
                  style={{ marginTop: 2 }}
                />
                <TextInput
                  style={addDeliveryStyles.notesInput}
                  placeholder="ex: Appeler avant d'arriver au portail, code 204..."
                  placeholderTextColor={COLORS.placeholder}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                  editable={!isSaving}
                  onFocus={(e) =>
                    scrollRef.current?.scrollToFocusedInput(e.target)
                  }
                />
              </View>
            </View>

            <View style={addDeliveryStyles.bottomSpacer} />
          </KeyboardAwareScrollView>
        </TutorialScrollRegistrar>

        {/* CTA fixe */}
        <View style={addDeliveryStyles.actionButtons}>
          <TouchableOpacity
            style={[addDeliveryStyles.saveButton, isSaving && { opacity: 0.85 }]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.95}
          >
            {isSaving ? (
              <View style={addDeliveryStyles.saveButtonSaving}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={addDeliveryStyles.saveButtonText}>
                  {savingProgress || "Enregistrement..."}
                </Text>
              </View>
            ) : (
              <>
                <MaterialIcons name="check-circle" size={22} color="#FFFFFF" />
                <Text style={addDeliveryStyles.saveButtonText}>
                  {isEditing
                    ? "Enregistrer les modifications"
                    : "Enregistrer la course (15s)"}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <View style={addDeliveryStyles.syncHint}>
            <MaterialIcons
              name="cloud-done"
              size={13}
              color={COLORS.primary}
            />
            <Text style={addDeliveryStyles.syncHintText}>
              Sera synchronisé automatiquement dès retour réseau
            </Text>
          </View>
        </View>

        {/* Tutoriel */}
        <TutorialOverlay
          visible={isTutorialVisible}
          tutorial={tutorial}
          currentStep={tutorialStep}
          onNext={tutorialNext}
          onPrev={tutorialPrev}
          onClose={tutorialClose}
        />
      </View>
    </TutorialProvider>
  );
}
