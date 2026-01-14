import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView, StatusBar } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { db } from "../../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

type Delivery = {
  id: number;
  recipient_name: string;
  phone: string;
  address: string;
  parcel_value: number;
  delivery_fee: number;
  status: string;
  created_at: string;
  delivered_at?: string;
};

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDelivery = async () => {
      const result = await db.getFirstAsync<Delivery>(
        "SELECT * FROM deliveries WHERE id = ?",
        [Number(id)]
      );

      setDelivery(result ?? null);
      setLoading(false);
    };

    loadDelivery();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      "Supprimer la livraison",
      "Êtes-vous sûr de vouloir supprimer cette livraison ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive",
          onPress: async () => {
            await db.runAsync("DELETE FROM deliveries WHERE id = ?", [Number(id)]);
            Alert.alert("Succès", "Livraison supprimée");
            router.back();
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "LIVREE":
        return {
          text: "Terminée",
          backgroundColor: "#10b98120",
          borderColor: "#10b98130",
          textColor: "#10b981"
        };
      case "A_LIVRER":
        return {
          text: "À livrer",
          backgroundColor: "#fbbf2420",
          borderColor: "#fbbf2430",
          textColor: "#f59e0b"
        };
      case "ANNULEE":
        return {
          text: "Annulée",
          backgroundColor: "#ef444420",
          borderColor: "#ef444430",
          textColor: "#ef4444"
        };
      default:
        return {
          text: "Inconnu",
          backgroundColor: "#6b728020",
          borderColor: "#6b728030",
          textColor: "#6b7280"
        };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#13ec13" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Livraison introuvable</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = getStatusConfig(delivery.status);
  const isDelivered = delivery.status === "LIVREE";
  const displayDate = isDelivered && delivery.delivered_at 
    ? delivery.delivered_at 
    : delivery.created_at;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#102210" />
      
      {/* En-tête */}
      <BlurView intensity={95} tint="dark" style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButtonHeader}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>
            Livraison #{delivery.id.toString().padStart(4, '0')}
          </Text>
          
          <View style={[
            styles.statusBadgeHeader,
            { backgroundColor: statusConfig.backgroundColor }
          ]}>
            <Text style={[styles.statusTextHeader, { color: statusConfig.textColor }]}>
              {statusConfig.text}
            </Text>
          </View>
        </View>
      </BlurView>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Date */}
        <View style={styles.dateSection}>
          <Text style={styles.dateLabel}>Date de réalisation</Text>
          <Text style={styles.dateValue}>{formatDate(displayDate)}</Text>
          {isDelivered && (
            <Text style={styles.timeValue}>{formatTime(displayDate)}</Text>
          )}
        </View>

        {/* Informations Client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations Client</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.clientInfo}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientInitial}>
                  {delivery.recipient_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.clientDetails}>
                <Text style={styles.clientName}>{delivery.recipient_name}</Text>
                {delivery.phone && (
                  <Text style={styles.clientPhone}>
                    <MaterialIcons name="phone" size={14} color="#13ec13" /> {delivery.phone}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.addressContainer}>
              <View style={styles.addressItem}>
                <View style={styles.addressIconContainer}>
                  <MaterialIcons name="location-on" size={20} color="#13ec13" />
                </View>
                <View style={styles.addressTextContainer}>
                  <Text style={styles.addressLabel}>Destination</Text>
                  <Text style={styles.addressText}>{delivery.address}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Détails Financiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails Financiers</Text>
          
          <View style={styles.financialCard}>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Valeur du colis</Text>
              <Text style={styles.financialValue}>
                {delivery.parcel_value > 0 
                  ? `${delivery.parcel_value.toLocaleString("fr-FR")} FCFA`
                  : "-"}
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Frais de livraison</Text>
              <Text style={styles.financialValue}>
                {delivery.delivery_fee > 0 
                  ? `${delivery.delivery_fee.toLocaleString("fr-FR")} FCFA`
                  : "-"}
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.totalItem}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>
                {(delivery.parcel_value + delivery.delivery_fee).toLocaleString("fr-FR")} FCFA
              </Text>
            </View>
          </View>
        </View>

        {/* Statut et création */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de suivi</Text>
          
          <View style={styles.trackingCard}>
            <View style={styles.trackingRow}>
              <View style={styles.trackingItem}>
                <MaterialIcons name="event" size={20} color="#94A3B8" />
                <View style={styles.trackingTextContainer}>
                  <Text style={styles.trackingLabel}>Créée le</Text>
                  <Text style={styles.trackingValue}>
                    {formatDate(delivery.created_at)} à {formatTime(delivery.created_at)}
                  </Text>
                </View>
              </View>
              
              {isDelivered && delivery.delivered_at && (
                <View style={styles.trackingItem}>
                  <MaterialIcons name="check-circle" size={20} color="#10b981" />
                  <View style={styles.trackingTextContainer}>
                    <Text style={styles.trackingLabel}>Livrée le</Text>
                    <Text style={styles.trackingValue}>
                      {formatDate(delivery.delivered_at)} à {formatTime(delivery.delivered_at)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            
            <View style={styles.statusDisplay}>
              <View style={[
                styles.statusDot,
                { backgroundColor: statusConfig.textColor }
              ]} />
              <Text style={[
                styles.statusDisplayText,
                { color: statusConfig.textColor }
              ]}>
                Statut: {statusConfig.text}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <BlurView intensity={95} tint="dark" style={styles.actionBar}>
        <TouchableOpacity 
          style={styles.generateInvoiceButton}
          onPress={() => {
            Alert.alert("Info", "Génération de facture - fonctionnalité à venir");
          }}
        >
          <MaterialIcons name="description" size={20} color="#000" />
          <Text style={styles.generateInvoiceButtonText}>Générer une facture</Text>
        </TouchableOpacity>
        
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => {
              Alert.alert("Info", "Modification - fonctionnalité à venir");
            }}
          >
            <MaterialIcons name="edit" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Modifier</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <MaterialIcons name="delete" size={20} color="#ef4444" />
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#102210",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#102210",
  },
  loadingText: {
    marginTop: 16,
    color: "#94A3B8",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#102210",
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "600",
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#1a2a1a",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#13ec13",
    fontSize: 16,
    fontWeight: "500",
  },
  header: {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  statusBadgeHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusTextHeader: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  dateSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  timeValue: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: "#1a2a1a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff10",
    overflow: "hidden",
  },
  clientInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff05",
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#13ec13",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#13ec1330",
  },
  clientInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  clientPhone: {
    fontSize: 14,
    color: "#13ec13",
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  addressContainer: {
    padding: 16,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#13ec1310",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  financialCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  financialItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  financialLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  financialValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  separator: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 16,
  },
  totalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    // backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  trackingCard: {
    backgroundColor: "#1a2a1a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ffffff10",
    padding: 16,
  },
  trackingRow: {
    gap: 16,
  },
  trackingItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  trackingTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  trackingLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  trackingValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
  statusDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#ffffff05",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDisplayText: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#102210",
    borderTopWidth: 1,
    borderTopColor: "#ffffff10",
  },
  generateInvoiceButton: {
    backgroundColor: "#13ec13",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  generateInvoiceButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#ffffff10",
    borderWidth: 1,
    borderColor: "#ffffff20",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#ef444410",
    borderWidth: 1,
    borderColor: "#ef444420",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
});