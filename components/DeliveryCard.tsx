import React, { memo, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Delivery } from "../src/types";
import { COLORS } from "../styles/colors";
import { deliveriesStyles } from "../styles/deliveriesStyles";

interface DeliveryCardProps {
  delivery: Delivery;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onMarkDelivered: (id: number) => void;
  onCancelDelivery: (id: number) => void;
}

const getStatusConfig = (status: string, isSelected?: boolean) => {
  switch (status) {
    case "LIVREE":
      return {
        backgroundColor: COLORS.successSoft,
        borderColor: COLORS.success + "30",
        textColor: COLORS.success,
        text: "Terminée",
        icon: "check-circle" as const,
      };
    case "A_LIVRER":
      return {
        backgroundColor: isSelected ? COLORS.warningSoft : COLORS.card,
        borderColor: isSelected ? COLORS.warning + "30" : COLORS.borderLight,
        textColor: COLORS.warning,
        text: "En attente",
        icon: "schedule" as const,
      };
    case "ANNULEE":
      return {
        backgroundColor: COLORS.dangerSoft,
        borderColor: COLORS.danger + "30",
        textColor: COLORS.danger,
        text: "Annulée",
        icon: "cancel" as const,
      };
    default:
      return {
        backgroundColor: COLORS.card,
        borderColor: COLORS.borderLight,
        textColor: COLORS.muted,
        text: "Prévu",
        icon: "pending" as const,
      };
  }
};

const DeliveryCard = memo(function DeliveryCard({
  delivery,
  isSelected,
  onToggleSelect,
  onMarkDelivered,
  onCancelDelivery,
}: DeliveryCardProps) {
  const statusConfig = getStatusConfig(delivery.status, isSelected);
  const isToday =
    new Date(delivery.created_at).toDateString() ===
    new Date().toDateString();
  const isCheckboxDisabled =
    delivery.status === "LIVREE" || delivery.status === "ANNULEE";
  const isClientPaysTout = delivery.payment_type === "CLIENT_PAYE_TOUT";
  const isClientPaysLivraison =
    delivery.payment_type === "CLIENT_PAYE_LIVRAISON";
  const isColisDejaPaye = delivery.payment_type === "COLIS_DEJA_PAYE";

  const montantEncaisse =
    delivery.delivery_fee +
    (isClientPaysTout ? delivery.parcel_value ?? 0 : 0);
  const montantAReverser = isClientPaysTout ? delivery.parcel_value ?? 0 : 0;

  const handlePress = useCallback(() => {
    router.push(`/delivery/${delivery.id}`);
  }, [delivery.id]);

  const handleToggle = useCallback(() => {
    if (!isCheckboxDisabled) onToggleSelect(delivery.id);
  }, [delivery.id, isCheckboxDisabled, onToggleSelect]);

  const handleMarkDelivered = useCallback(() => {
    onMarkDelivered(delivery.id);
  }, [delivery.id, onMarkDelivered]);

  const handleCancel = useCallback(() => {
    onCancelDelivery(delivery.id);
  }, [delivery.id, onCancelDelivery]);

  return (
    <TouchableOpacity
      style={[
        deliveriesStyles.deliveryCard,
        {
          backgroundColor: statusConfig.backgroundColor,
          borderColor: statusConfig.borderColor,
          opacity: delivery.status === "ANNULEE" ? 0.6 : 1,
        },
      ]}
      onPress={handlePress}
      onLongPress={handleToggle}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={deliveriesStyles.checkboxContainer}
        onPress={handleToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        disabled={isCheckboxDisabled}
      >
        <View
          style={[
            deliveriesStyles.checkbox,
            isSelected && deliveriesStyles.checkboxSelected,
            isCheckboxDisabled && deliveriesStyles.checkboxDisabled,
          ]}
        >
          {isSelected && !isCheckboxDisabled && (
            <MaterialIcons name="check" size={14} color="#FFFFFF" />
          )}
          {isCheckboxDisabled && delivery.status === "LIVREE" && (
            <MaterialIcons name="check" size={14} color={COLORS.success} />
          )}
          {isCheckboxDisabled && delivery.status === "ANNULEE" && (
            <MaterialIcons name="close" size={14} color={COLORS.danger} />
          )}
        </View>
      </TouchableOpacity>

      <View style={deliveriesStyles.deliveryContent}>
        <View style={deliveriesStyles.deliveryHeader}>
          <View style={deliveriesStyles.statusTimeContainer}>
            <View
              style={[
                deliveriesStyles.statusBadge,
                { backgroundColor: `${statusConfig.textColor}20` },
              ]}
            >
              <MaterialIcons
                name={statusConfig.icon}
                size={12}
                color={statusConfig.textColor}
              />
              <Text
                style={[
                  deliveriesStyles.statusText,
                  { color: statusConfig.textColor },
                ]}
              >
                {statusConfig.text}
              </Text>
            </View>

            <Text style={deliveriesStyles.timeText}>
              {new Date(delivery.created_at).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {isToday && " • Aujourd'hui"}
            </Text>
          </View>

          <Text style={deliveriesStyles.feeText}>
            +{delivery.delivery_fee.toLocaleString("fr-FR")} FCFA
          </Text>
        </View>

        <View style={deliveriesStyles.addressContainer}>
          <View style={deliveriesStyles.addressLine}>
            <View
              style={[
                deliveriesStyles.addressDot,
                { backgroundColor: COLORS.muted },
              ]}
            />
            <Text style={deliveriesStyles.addressText} numberOfLines={1}>
              {delivery.address || "Adresse non spécifiée"}
            </Text>
          </View>

          <View style={deliveriesStyles.addressLine}>
            <View
              style={[
                deliveriesStyles.addressDot,
                { backgroundColor: COLORS.primary },
              ]}
            />
            <Text style={deliveriesStyles.addressText} numberOfLines={1}>
              {delivery.recipient_name}
              {delivery.phone ? ` • ${delivery.phone}` : ""}
            </Text>
          </View>
        </View>

        <View style={deliveriesStyles.deliveryDetails}>
          <Text style={deliveriesStyles.paymentTypeText}>
            {isClientPaysTout && "💰 Client paie colis + livraison"}
            {isClientPaysLivraison && "🚚 Client paie livraison seulement"}
            {isColisDejaPaye && "📦 Colis déjà payé"}
          </Text>

          <Text style={deliveriesStyles.encaisseText}>
            Encaissé : {montantEncaisse.toLocaleString("fr-FR")} FCFA
          </Text>

          {montantAReverser > 0 && (
            <Text style={deliveriesStyles.reverserText}>
              À reverser : {montantAReverser.toLocaleString("fr-FR")} FCFA
            </Text>
          )}
        </View>

        {delivery.status === "A_LIVRER" && (
          <View style={deliveriesStyles.actionsContainer}>
            <TouchableOpacity
              style={[
                deliveriesStyles.actionButton,
                { backgroundColor: COLORS.primary },
              ]}
              onPress={handleMarkDelivered}
            >
              <MaterialIcons name="check" size={16} color="#FFFFFF" />
              <Text style={deliveriesStyles.actionButtonText}>
                Marquer livrée
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                deliveriesStyles.actionButton,
                deliveriesStyles.actionButtonDanger,
              ]}
              onPress={handleCancel}
            >
              <MaterialIcons name="close" size={16} color={COLORS.danger} />
              <Text
                style={[
                  deliveriesStyles.actionButtonText,
                  { color: COLORS.danger },
                ]}
              >
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default DeliveryCard;
