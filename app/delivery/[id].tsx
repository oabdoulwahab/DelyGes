import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { db } from "../../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { commonStyles } from "../../styles/common";
import { deliveryDetailStyles } from "../../styles/deliveryDetailStyles";
import { COLORS } from "../../styles/colors";
import { useNavigation } from "../../hooks/useNavigation";
import { useModal } from "../../providers/ModalProvider";

type Delivery = {
  id: number;
  recipient_name: string;
  phone: string;
  address: string;
  parcel_value: number;
  delivery_fee: number;
  payment_type: string;
  merchant_id?: number;
  status: string;
  created_at: string;
  delivered_at?: string;
};

type Merchant = {
  id: number;
  name: string;
  phone?: string;
  address?: string;
};

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const { showConfirm, showSuccess, showError, showAlert } = useModal();
  const { goBack, goToDeliveries } = useNavigation();

  useEffect(() => {
    const loadDelivery = async () => {
      // Charger la livraison
      const deliveryResult = await db.getFirstAsync<Delivery>(
        "SELECT * FROM deliveries WHERE id = ?",
        [Number(id)],
      );

      setDelivery(deliveryResult ?? null);

      // Charger le commerçant si merchant_id existe
      if (deliveryResult?.merchant_id) {
        const merchantResult = await db.getFirstAsync<Merchant>(
          "SELECT * FROM merchants WHERE id = ?",
          [deliveryResult.merchant_id],
        );
        setMerchant(merchantResult ?? null);
      }

      setLoading(false);
    };

    loadDelivery();
  }, [id]);

  const handleDelete = () => {
    showConfirm(
      "Supprimer la livraison",
      "Êtes-vous sûr de vouloir supprimer cette livraison ? Cette action est irréversible.",
      async () => {
        await db.runAsync("DELETE FROM deliveries WHERE id = ?", [Number(id)]);
        showSuccess("Succès", "Livraison supprimée");
        goToDeliveries();
      },
      "Supprimer",
    );
  };

  // Fonction pour formater un numéro de téléphone pour l'appel (sans indicatif)
  const formatPhoneForCall = (phone: string): string => {
    let number = phone.replace(/[^\d+]/g, "");

    // Si le numéro commence sans indicatif, on ajoute +225
    if (!number.startsWith("+")) {
      if (number.startsWith("0")) {
        number = number.substring(1);
      }
      number = `+225${number}`;
    }

    return number;
  };

  // Fonction pour lancer l'appel
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
            // Android : on lance directement
            await Linking.openURL(url);
          } else {
            // iOS : canOpenURL est fiable
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

  // Fonction pour appeler le commerçant
  const handleCallMerchant = () => {
    if (!merchant?.phone) {
      showError("Erreur", "Aucun numéro de téléphone disponible pour ce commerçant");
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
        };
      case "A_LIVRER":
        return {
          text: "À livrer",
          backgroundColor: COLORS.warningSoft,
          borderColor: COLORS.warning,
          textColor: COLORS.warning,
        };
      case "ANNULEE":
        return {
          text: "Annulée",
          backgroundColor: COLORS.dangerSoft,
          borderColor: COLORS.danger,
          textColor: COLORS.danger,
        };
      default:
        return {
          text: "Inconnu",
          backgroundColor: "#6b728020",
          borderColor: "#6b728030",
          textColor: "#6b7280",
        };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color={COLORS.danger} />
        <Text style={styles.errorText}>Livraison introuvable</Text>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = getStatusConfig(delivery.status);
  const isDelivered = delivery.status === "LIVREE";
  const displayDate =
    isDelivered && delivery.delivered_at
      ? delivery.delivered_at
      : delivery.created_at;
  const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";
  const isClientPaysLivraison =
    delivery.payment_type === "CLIENT_PAYE_LIVRAISON";
  const isColisDejaPaye = delivery.payment_type === "COLIS_DEJA_PAYE";

  const montantEncaisse =
    delivery.delivery_fee + (isClientPaysTout ? delivery.parcel_value : 0);

  const montantAReverser = isClientPaysTout ? delivery.parcel_value : 0;

  const profit = delivery.delivery_fee;

  return (
    <View style={commonStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} tint="dark" style={deliveryDetailStyles.header}>
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
                    <Text style={deliveryDetailStyles.clientPhone}>
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
                <View style={[deliveryDetailStyles.clientAvatar, { backgroundColor: COLORS.primarySoft }]}>
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
                      <Text style={[deliveryDetailStyles.clientPhone, { color: COLORS.muted }]}>
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
                {delivery.parcel_value > 0
                  ? `${delivery.parcel_value.toLocaleString("fr-FR")} FCFA`
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
                {(delivery.parcel_value + delivery.delivery_fee).toLocaleString(
                  "fr-FR",
                )}{" "}
                FCFA
              </Text>
            </View>

            {/* Type de paiement */}
            <View style={styles.paymentTypeContainer}>
              <Text style={styles.paymentTypeLabel}>
                Type de paiement
              </Text>
              <View style={styles.paymentTypeBadge}>
                <Text style={styles.paymentTypeText}>
                  {isClientPaysTout && "Client paie colis + livraison"}
                  {isClientPaysLivraison && "Client paie livraison seulement"}
                  {isColisDejaPaye && "Colis déjà payé"}
                </Text>
              </View>
            </View>

            {/* Résumé financier */}
            <View style={styles.financialSummary}>
              <View style={styles.financialSummaryItem}>
                <Text style={styles.financialSummaryLabel}>
                  Montant encaissé
                </Text>
                <Text style={[styles.financialSummaryValue, { color: COLORS.primary }]}>
                  {montantEncaisse.toLocaleString("fr-FR")} FCFA
                </Text>
              </View>

              {montantAReverser > 0 && (
                <View style={styles.financialSummaryItem}>
                  <Text style={[styles.financialSummaryLabel, { color: COLORS.warning }]}>
                    À reverser au commerçant
                  </Text>
                  <Text style={[styles.financialSummaryValue, { color: COLORS.warning }]}>
                    {montantAReverser.toLocaleString("fr-FR")} FCFA
                  </Text>
                </View>
              )}

              <View style={styles.financialSummaryItem}>
                <Text style={[styles.financialSummaryLabel, { color: COLORS.success }]}>
                  Votre profit
                </Text>
                <Text style={[styles.financialSummaryValue, { color: COLORS.success }]}>
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

      {/* Actions */}
      <BlurView
        intensity={95}
        tint="dark"
        style={deliveryDetailStyles.actionBar}
      >
        <TouchableOpacity
          style={deliveryDetailStyles.primaryButton}
          onPress={handleCall}
        >
          <MaterialIcons name="phone" size={20} color="#000" />
          <Text style={deliveryDetailStyles.primaryButtonText}>
            Appeler le client
          </Text>
        </TouchableOpacity>

        <View style={deliveryDetailStyles.actionButtonsRow}>
          <TouchableOpacity
            style={deliveryDetailStyles.editButton}
            onPress={() => {
              showAlert("Info", "Modification - fonctionnalité à venir");
            }}
          >
            <MaterialIcons name="edit" size={20} color={COLORS.white} />
            <Text style={deliveryDetailStyles.editButtonText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={deliveryDetailStyles.dangerButton}
            onPress={handleDelete}
          >
            <MaterialIcons name="delete" size={20} color={COLORS.danger} />
            <Text style={deliveryDetailStyles.dangerButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.muted,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    color: COLORS.danger,
    fontSize: 18,
    fontWeight: "600",
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  // Styles ajoutés pour les détails financiers
  paymentTypeContainer: {
    marginTop: 16,
  },
  paymentTypeLabel: {
    color: COLORS.muted,
    fontSize: 14,
    marginBottom: 6,
  },
  paymentTypeBadge: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  paymentTypeText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  financialSummary: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  financialSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  financialSummaryLabel: {
    color: COLORS.muted,
    fontSize: 14,
  },
  financialSummaryValue: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});