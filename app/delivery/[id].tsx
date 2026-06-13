import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { commonStyles } from "../../styles/common";
import { deliveryDetailStyles } from "../../styles/deliveryDetailStyles";
import { COLORS } from "../../styles/colors";
import { useNavigation } from "../../hooks/useNavigation";
import { useModal } from "../../providers/ModalProvider";
import { useAuth } from "../../src/context/AuthContext";
import { sendDeliveryCompletedNotification } from "../../src/services/notification.service";
import { useSync } from "../../src/hooks/useSync";
import { syncService } from "../../src/services/sync.service";
import { DeliveryRepository } from "../../src/repositories/delivery.repository";
import { MerchantRepository } from "../../src/repositories/merchant.repository";
import { DeliveryService } from "../../src/services/delivery.service";
import { Delivery, Merchant } from "../../src/types";

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // 🔥 Nouvel état pour la suppression
  const { showConfirm, showSuccess, showError, showAlert } = useModal();
  const { goBack, goToDeliveries } = useNavigation();
  const { user } = useAuth();
  const { markAndSync } = useSync();

  useEffect(() => {
    const loadDelivery = async () => {
      try {
        const deliveryResult = await DeliveryRepository.findById(Number(id));
        setDelivery(deliveryResult ?? null);

        if (deliveryResult?.merchant_id) {
          const merchantResult = await MerchantRepository.findById(
            deliveryResult.merchant_id,
          );
          setMerchant(merchantResult ?? null);
        }
      } catch (error) {
        console.error("Erreur chargement livraison:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDelivery();
  }, [id]);

  const handleMarkAsDelivered = () => {
    showConfirm(
      "Marquer comme livrée",
      "Confirmez-vous que cette livraison a été effectuée ?",
      async () => {
        setIsUpdating(true);
        try {
          await DeliveryService.markAsDelivered(user!.id, Number(id));
          await markAndSync("deliveries", Number(id));

          if (user?.id && delivery) {
            await sendDeliveryCompletedNotification(
              user.id,
              delivery.delivery_fee,
            ).catch(e => console.log("⚠️ Notification error:", e));
          }

          const updatedDelivery = await DeliveryRepository.findById(Number(id));
          setDelivery(updatedDelivery);

          showSuccess("Succès", "Livraison marquée comme livrée");
        } catch (error) {
          console.error("Erreur lors de la mise à jour:", error);
          showError(
            "Erreur",
            "Impossible de marquer la livraison comme livrée",
          );
        } finally {
          setIsUpdating(false);
        }
      },
      "Oui",
      "Non",
    );
  };

  // 🔥 MODIFIÉ : Suppression avec synchronisation Firebase
  const handleDelete = () => {
    showConfirm(
      "Supprimer la livraison",
      "Êtes-vous sûr de vouloir supprimer cette livraison ? Cette action est irréversible.",
      async () => {
        setIsDeleting(true);
        try {
          const deliveryToDelete = await DeliveryRepository.findById(Number(id));

          console.log("🗑️ Suppression livraison:", {
            localId: id,
            firebaseId: deliveryToDelete?.firebase_id,
          });

          if (deliveryToDelete?.firebase_id) {
            try {
              await syncService.deleteFromFirebase("deliveries", deliveryToDelete.firebase_id);
              console.log("✅ Livraison supprimée de Firebase");
            } catch (firebaseError) {
              console.error("⚠️ Erreur suppression Firebase:", firebaseError);
            }
          }

          await DeliveryRepository.delete(Number(id));
          console.log("✅ Livraison supprimée localement");

          showSuccess("Succès", "Livraison supprimée");
          goToDeliveries();
        } catch (error) {
          console.error("❌ Erreur suppression:", error);
          showError("Erreur", "Impossible de supprimer la livraison");
        } finally {
          setIsDeleting(false);
        }
      },
      "Supprimer",
      "Annuler",
    );
  };

  const formatPhoneForCall = (phone: string): string => {
    return phone;
  };

  const handleCall = () => {
    if (!delivery?.phone) {
      showError("Erreur", "Aucun numéro de téléphone disponible");
      return;
    }

    const phoneNumber = formatPhoneForCall(delivery.phone);

    showConfirm(
      "Appeler le client",
      `Voulez-vous appeler ${delivery.recipient_name} au ${delivery.phone} ?`,
      async () => {
        try {
          const url = `tel:${phoneNumber}`;

          if (Platform.OS === "android") {
            await Linking.openURL(url);
          } else {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
              await Linking.openURL(url);
            } else {
              showError("Erreur", "Appel non supporté sur cet appareil");
            }
          }
        } catch (error) {
          console.error("Erreur appel :", error);
          showError("Erreur", "Impossible de lancer l'appel téléphonique");
        }
      },
    );
  };

  const handleCallMerchant = () => {
    if (!merchant?.phone) {
      showError(
        "Erreur",
        "Aucun numéro de téléphone disponible pour ce commerçant",
      );
      return;
    }

    const phoneNumber = formatPhoneForCall(merchant.phone);

    showConfirm(
      "Appeler le commerçant",
      `Voulez-vous appeler ${merchant.name} au ${merchant.phone} ?`,
      async () => {
        try {
          const url = `tel:${phoneNumber}`;

          if (Platform.OS === "android") {
            await Linking.openURL(url);
          } else {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
              await Linking.openURL(url);
            } else {
              showError("Erreur", "Appel non supporté sur cet appareil");
            }
          }
        } catch (error) {
          console.error("Erreur appel :", error);
          showError("Erreur", "Impossible de lancer l'appel téléphonique");
        }
      },
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "LIVREE":
        return {
          text: "Terminée",
          backgroundColor: COLORS.successSoft,
          borderColor: COLORS.success,
          textColor: COLORS.success,
          isClickable: false,
        };
      case "A_LIVRER":
        return {
          text: "À livrer",
          backgroundColor: COLORS.warningSoft,
          borderColor: COLORS.warning,
          textColor: COLORS.warning,
          isClickable: true,
        };
      case "ANNULEE":
        return {
          text: "Annulée",
          backgroundColor: COLORS.dangerSoft,
          borderColor: COLORS.danger,
          textColor: COLORS.danger,
          isClickable: false,
        };
      default:
        return {
          text: "Inconnu",
          backgroundColor: "#6b728020",
          borderColor: "#6b728030",
          textColor: "#6b7280",
          isClickable: false,
        };
    }
  };

  if (loading) {
    return (
      <View style={deliveryDetailStyles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={deliveryDetailStyles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={deliveryDetailStyles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color={COLORS.danger} />
        <Text style={deliveryDetailStyles.errorText}>
          Livraison introuvable
        </Text>
        <TouchableOpacity
          style={deliveryDetailStyles.backButton}
          onPress={goBack}
        >
          <Text style={deliveryDetailStyles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = getStatusConfig(delivery.status);
  const isDelivered = delivery.status === "LIVREE";
  const isCancelled = delivery.status === "ANNULEE";
  const isEditable = !isDelivered && !isCancelled;

  const displayDate =
    isDelivered && delivery.delivered_at
      ? delivery.delivered_at
      : delivery.created_at;
  const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";
  const isClientPaysLivraison =
    delivery.payment_type === "CLIENT_PAYE_LIVRAISON";
  const isColisDejaPaye = delivery.payment_type === "COLIS_DEJA_PAYE";

  const montantEncaisse =
    delivery.delivery_fee + (isClientPaysTout ? (delivery.parcel_value ?? 0) : 0);

  const montantAReverser = isClientPaysTout ? (delivery.parcel_value ?? 0) : 0;

  const profit = delivery.delivery_fee;

  return (
    <View style={commonStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} style={deliveryDetailStyles.header}>
        <View style={deliveryDetailStyles.headerContent}>
          <TouchableOpacity
            style={deliveryDetailStyles.backButtonHeader}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>

          <Text style={deliveryDetailStyles.headerTitle}>
            Livraison #{delivery.id.toString().padStart(4, "0")}
          </Text>

          {/* Badge de statut */}
          {statusConfig.isClickable ? (
            <TouchableOpacity
              style={[
                deliveryDetailStyles.statusBadgeHeader,
                { backgroundColor: statusConfig.backgroundColor },
              ]}
              onPress={handleMarkAsDelivered}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator
                  size="small"
                  color={statusConfig.textColor}
                />
              ) : (
                <>
                  <MaterialIcons
                    name="check-circle"
                    size={16}
                    color={statusConfig.textColor}
                    style={{ marginRight: 1 }}
                  />
                  <Text
                    style={[
                      deliveryDetailStyles.statusTextHeader,
                      { color: statusConfig.textColor },
                    ]}
                  >
                    {statusConfig.text}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View
              style={[
                deliveryDetailStyles.statusBadgeHeader,
                { backgroundColor: statusConfig.backgroundColor },
              ]}
            >
              <Text
                style={[
                  deliveryDetailStyles.statusTextHeader,
                  { color: statusConfig.textColor },
                ]}
              >
                {statusConfig.text}
              </Text>
            </View>
          )}
        </View>
      </BlurView>

      <ScrollView
        style={deliveryDetailStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={deliveryDetailStyles.scrollContent}
      >
        {/* Date */}
        <View style={deliveryDetailStyles.dateSection}>
          <Text style={deliveryDetailStyles.dateLabel}>
            Date de réalisation
          </Text>
          <Text style={deliveryDetailStyles.dateValue}>
            {formatDate(displayDate)}
          </Text>
          {isDelivered && (
            <Text style={deliveryDetailStyles.timeValue}>
              {formatTime(displayDate)}
            </Text>
          )}
        </View>

        {/* Informations Client */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Informations Client</Text>

          <View style={commonStyles.card}>
            <View style={deliveryDetailStyles.clientInfo}>
              <View style={deliveryDetailStyles.clientAvatar}>
                <Text style={deliveryDetailStyles.clientInitial}>
                  {delivery.recipient_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={deliveryDetailStyles.clientDetails}>
                <Text style={deliveryDetailStyles.clientName}>
                  {delivery.recipient_name}
                </Text>
                {delivery.phone && (
                  <TouchableOpacity
                    style={deliveryDetailStyles.clientPhoneContainer}
                    onPress={handleCall}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name="phone"
                      size={14}
                      color={COLORS.primary}
                    />
                    <Text
                      style={[
                        deliveryDetailStyles.clientPhone,
                        { color: COLORS.primary },
                      ]}
                    >
                      {" "}
                      {delivery.phone}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={deliveryDetailStyles.addressContainer}>
              <View style={deliveryDetailStyles.addressItem}>
                <View style={deliveryDetailStyles.addressIconContainer}>
                  <MaterialIcons
                    name="location-on"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <View style={deliveryDetailStyles.addressTextContainer}>
                  <Text style={deliveryDetailStyles.addressLabel}>
                    Destination
                  </Text>
                  <Text style={deliveryDetailStyles.addressText}>
                    {delivery.address}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Informations Commerçant */}
        {merchant && (
          <View style={commonStyles.section}>
            <Text style={commonStyles.sectionTitle}>Commerçant</Text>

            <View style={commonStyles.card}>
              <View style={deliveryDetailStyles.clientInfo}>
                <View
                  style={[
                    deliveryDetailStyles.clientAvatar,
                    { backgroundColor: COLORS.primarySoft },
                  ]}
                >
                  <Text style={deliveryDetailStyles.clientInitial}>
                    {merchant.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={deliveryDetailStyles.clientDetails}>
                  <Text style={deliveryDetailStyles.clientName}>
                    {merchant.name}
                  </Text>
                  {merchant.phone && (
                    <TouchableOpacity
                      style={deliveryDetailStyles.clientPhoneContainer}
                      onPress={handleCallMerchant}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name="phone"
                        size={14}
                        color={COLORS.primary}
                      />
                      <Text style={deliveryDetailStyles.clientPhone}>
                        {" "}
                        {merchant.phone}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {merchant.address && (
                    <View style={deliveryDetailStyles.clientPhoneContainer}>
                      <MaterialIcons
                        name="location-on"
                        size={14}
                        color={COLORS.muted}
                      />
                      <Text
                        style={[
                          deliveryDetailStyles.clientPhone,
                          { color: COLORS.muted },
                        ]}
                      >
                        {" "}
                        {merchant.address}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Détails Financiers */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Détails Financiers</Text>

          <View style={deliveryDetailStyles.financialCard}>
            <View style={deliveryDetailStyles.financialItem}>
              <Text style={deliveryDetailStyles.financialLabel}>
                Valeur du colis
              </Text>
              <Text style={deliveryDetailStyles.financialValue}>
                {(delivery.parcel_value ?? 0) > 0
                  ? `${(delivery.parcel_value ?? 0).toLocaleString("fr-FR")} FCFA`
                  : "-"}
              </Text>
            </View>

            <View style={deliveryDetailStyles.financialItem}>
              <Text style={deliveryDetailStyles.financialLabel}>
                Frais de livraison
              </Text>
              <Text style={deliveryDetailStyles.financialValue}>
                {delivery.delivery_fee > 0
                  ? `${delivery.delivery_fee.toLocaleString("fr-FR")} FCFA`
                  : "-"}
              </Text>
            </View>

            <View style={deliveryDetailStyles.separator} />

            <View style={deliveryDetailStyles.totalItem}>
              <Text style={deliveryDetailStyles.totalLabel}>TOTAL</Text>
              <Text style={deliveryDetailStyles.totalValue}>
                {((delivery.parcel_value ?? 0) + delivery.delivery_fee).toLocaleString(
                  "fr-FR",
                )}{" "}
                FCFA
              </Text>
            </View>

            {/* Type de paiement */}
            <View style={deliveryDetailStyles.paymentTypeContainer}>
              <Text style={deliveryDetailStyles.paymentTypeLabel}>
                Type de paiement
              </Text>
              <View style={deliveryDetailStyles.paymentTypeBadge}>
                <Text style={deliveryDetailStyles.paymentTypeText}>
                  {isClientPaysTout && "Client paie colis + livraison"}
                  {isClientPaysLivraison && "Client paie livraison seulement"}
                  {isColisDejaPaye && "Colis déjà payé"}
                </Text>
              </View>
            </View>

            {/* Résumé financier */}
            <View style={deliveryDetailStyles.financialSummary}>
              <View style={deliveryDetailStyles.financialSummaryItem}>
                <Text style={deliveryDetailStyles.financialSummaryLabel}>
                  Montant encaissé
                </Text>
                <Text
                  style={[
                    deliveryDetailStyles.financialSummaryValue,
                    { color: COLORS.primary },
                  ]}
                >
                  {montantEncaisse.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              {montantAReverser > 0 && (
                <View style={deliveryDetailStyles.financialSummaryItem}>
                  <Text
                    style={[
                      deliveryDetailStyles.financialSummaryLabel,
                      { color: COLORS.warning },
                    ]}
                  >
                    À reverser au commerçant
                  </Text>
                  <Text
                    style={[
                      deliveryDetailStyles.financialSummaryValue,
                      { color: COLORS.warning },
                    ]}
                  >
                    {montantAReverser.toLocaleString("fr-FR")} FCFA
                  </Text>
                </View>
              )}

              <View style={deliveryDetailStyles.financialSummaryItem}>
                <Text
                  style={[
                    deliveryDetailStyles.financialSummaryLabel,
                    { color: COLORS.success },
                  ]}
                >
                  Votre profit
                </Text>
                <Text
                  style={[
                    deliveryDetailStyles.financialSummaryValue,
                    { color: COLORS.success },
                  ]}
                >
                  {profit.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Informations de suivi */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Informations de suivi</Text>

          <View style={commonStyles.card}>
            <View style={deliveryDetailStyles.trackingRow}>
              <View style={deliveryDetailStyles.trackingItem}>
                <MaterialIcons name="event" size={20} color={COLORS.muted} />
                <View style={deliveryDetailStyles.trackingTextContainer}>
                  <Text style={deliveryDetailStyles.trackingLabel}>
                    Créée le
                  </Text>
                  <Text style={deliveryDetailStyles.trackingValue}>
                    {formatDate(delivery.created_at)} à{" "}
                    {formatTime(delivery.created_at)}
                  </Text>
                </View>
              </View>

              {isDelivered && delivery.delivered_at && (
                <View style={deliveryDetailStyles.trackingItem}>
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={COLORS.success}
                  />
                  <View style={deliveryDetailStyles.trackingTextContainer}>
                    <Text style={deliveryDetailStyles.trackingLabel}>
                      Livrée le
                    </Text>
                    <Text style={deliveryDetailStyles.trackingValue}>
                      {formatDate(delivery.delivered_at)} à{" "}
                      {formatTime(delivery.delivered_at)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={deliveryDetailStyles.statusDisplay}>
              <View
                style={[
                  deliveryDetailStyles.statusDot,
                  { backgroundColor: statusConfig.textColor },
                ]}
              />
              <Text
                style={[
                  deliveryDetailStyles.statusDisplayText,
                  { color: statusConfig.textColor },
                ]}
              >
                Statut: {statusConfig.text}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Actions - Affichage conditionnel selon le statut */}
      {isEditable ? (
        <BlurView intensity={95} style={deliveryDetailStyles.actionBar}>
          <TouchableOpacity
            style={deliveryDetailStyles.primaryButton}
            onPress={handleCall}
          >
            <MaterialIcons name="phone" size={20} color="#FFFFFF" />
            <Text style={deliveryDetailStyles.primaryButtonText}>Appeler</Text>
          </TouchableOpacity>

          <View style={deliveryDetailStyles.actionButtonsRow}>
            <TouchableOpacity
              style={deliveryDetailStyles.editButton}
              onPress={() => router.push(`/add-delivery?id=${delivery.id}`)}
            >
              <MaterialIcons name="edit" size={20} color={COLORS.white} />
              <Text style={deliveryDetailStyles.editButtonText}>Modifier</Text>
            </TouchableOpacity>

            {/* 🔥 Bouton supprimer avec indicateur de chargement */}
            <TouchableOpacity
              style={[deliveryDetailStyles.dangerButton, isDeleting && { opacity: 0.7 }]}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <>
                  <MaterialIcons name="delete" size={20} color={COLORS.danger} />
                  <Text style={deliveryDetailStyles.dangerButtonText}>
                    Supprimer
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      ) : (
        <BlurView intensity={95} style={deliveryDetailStyles.actionBar}>
          <View style={deliveryDetailStyles.actionButtonsRow}>
            <TouchableOpacity
              style={[deliveryDetailStyles.dangerButton, isDeleting && { opacity: 0.7 }]}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <>
                  <MaterialIcons name="delete" size={20} color={COLORS.danger} />
                  <Text style={deliveryDetailStyles.dangerButtonText}>
                    Supprimer
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* 🔥 Overlay de chargement pendant la suppression */}
      {isDeleting && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <View style={{
            backgroundColor: COLORS.white,
            padding: 24,
            borderRadius: 16,
            alignItems: 'center',
            gap: 12,
          }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ color: COLORS.white, fontWeight: '500' }}>
              Suppression en cours...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}