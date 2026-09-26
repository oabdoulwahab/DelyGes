import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
  Modal,
  TextInput,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import * as Clipboard from "expo-clipboard";
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
import { Formatters } from "../../src/utils/formatters";
import ProfileAvatar from "../../components/ProfileAvatar";
import { detectCommune } from "../../src/utils/communes";
import { Delivery, Merchant } from "../../src/types";

const ISSUE_MOTIFS = [
  "Client injoignable (après 3 appels)",
  "Client absent au portail",
  "Refus client ou contestation du prix",
  "Adresse introuvable / Erreur quartier",
];

function merchantInitials(name: string): string {
  const parts = (name || "").split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "DL";
  return parts.map((w) => w.charAt(0)).join("").toUpperCase() || "DL";
}

function formatHour(iso?: string): string {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--:--";
  }
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  try {
    return new Date(iso).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

// Encaissement attendu selon le mode (mêmes formules que la création)
function expectedCollect(d: Delivery): number {
  switch (d.payment_type) {
    case "CLIENT_PAYE_TOUT":
      return (d.parcel_value ?? 0) + d.delivery_fee;
    case "CLIENT_PAYE_LIVRAISON":
      return d.delivery_fee;
    case "LIVRAISON_DEJA_PAYEE":
      return d.parcel_value ?? 0;
    case "COLIS_DEJA_PAYE":
      return 0;
    default:
      return d.amount_collected ?? d.delivery_fee;
  }
}

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [copied, setCopied] = useState(false);

  // Bottom sheets
  const [showCashSheet, setShowCashSheet] = useState(false);
  const [showGpsSheet, setShowGpsSheet] = useState(false);
  const [showIssueSheet, setShowIssueSheet] = useState(false);
  const [issueNote, setIssueNote] = useState("");

  const { showConfirm, showSuccess, showError } = useModal();
  const { goBack, goToDeliveries } = useNavigation();
  const { user } = useAuth();
  const { markAndSync } = useSync();

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    NetInfo.fetch().then((s) => setIsConnected(s.isConnected ?? true));
    return () => unsub();
  }, []);

  const reload = async () => {
    try {
      const deliveryResult = await DeliveryRepository.findById(Number(id));
      setDelivery(deliveryResult ?? null);
      if (deliveryResult?.merchant_id) {
        const merchantResult = await MerchantRepository.findById(
          deliveryResult.merchant_id,
        );
        setMerchant(merchantResult ?? null);
      } else {
        setMerchant(null);
      }
    } catch (error) {
      console.error("Erreur chargement livraison:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const courierName = useMemo(
    () => (user?.name || "Livreur").split(" ")[0],
    [user?.name],
  );
  const userInitial = useMemo(() => {
    const n = user?.name || "?";
    return n.trim().charAt(0).toUpperCase() || "?";
  }, [user?.name]);

  // ---------- Actions métier (conservées) ----------
  const handleMarkAsDelivered = async () => {
    setIsDelivering(true);
    try {
      await DeliveryService.markAsDelivered(user!.id, Number(id));
      await markAndSync("deliveries", Number(id));
      if (user?.id && delivery) {
        await sendDeliveryCompletedNotification(user.id, delivery.delivery_fee).catch(
          (e) => console.log("⚠️ Notification error:", e),
        );
      }
      await reload();
      setShowCashSheet(false);
      showSuccess("Succès", "Course validée & encaissée ✅");
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      showError("Erreur", "Impossible de marquer la livraison comme livrée");
    } finally {
      setIsDelivering(false);
    }
  };

  const handleDelete = () => {
    showConfirm(
      "Supprimer la livraison",
      "Êtes-vous sûr de vouloir supprimer cette livraison ? Cette action est irréversible.",
      async () => {
        setIsDeleting(true);
        try {
          const deliveryToDelete = await DeliveryRepository.findById(Number(id));
          if (deliveryToDelete?.firebase_id) {
            try {
              await syncService.deleteFromFirebase(
                "deliveries",
                deliveryToDelete.firebase_id,
              );
            } catch (firebaseError) {
              console.error("⚠️ Erreur suppression Firebase:", firebaseError);
            }
          }
          await DeliveryRepository.delete(Number(id));
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

  const handleReportIssue = async (motif: string) => {
    if (!user) return;
    const note = issueNote.trim() ? `${motif} — ${issueNote.trim()}` : motif;
    setIsCancelling(true);
    try {
      await DeliveryRepository.update(Number(id), {
        notes: note,
        needs_sync: 1,
      });
      await DeliveryService.cancelDelivery(user.id, Number(id));
      await markAndSync("deliveries", Number(id));
      setShowIssueSheet(false);
      setIssueNote("");
      await reload();
      showSuccess("Signalement enregistré", `Motif : ${motif}`);
    } catch (error) {
      console.error("❌ Erreur signalement:", error);
      showError("Erreur", "Impossible d'enregistrer le signalement");
    } finally {
      setIsCancelling(false);
    }
  };

  const directCall = (phone?: string | null, label?: string) => {
    if (!phone) {
      showError("Erreur", `Aucun numéro disponible${label ? ` pour ${label}` : ""}`);
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s/g, "")}`).catch(() =>
      showError("Erreur", "Impossible de lancer l'appel téléphonique"),
    );
  };

  const openGps = (provider: "google" | "waze") => {
    const q = encodeURIComponent(delivery?.address || "Abidjan");
    const url =
      provider === "google"
        ? `https://www.google.com/maps/dir/?api=1&destination=${q}`
        : `https://waze.com/ul?q=${q}`;
    setShowGpsSheet(false);
    Linking.openURL(url).catch(() =>
      showError("Erreur", "Impossible d'ouvrir le GPS"),
    );
  };

  const copyAddress = async () => {
    if (!delivery) return;
    try {
      await Clipboard.setStringAsync(delivery.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Erreur", "Copie impossible sur cet appareil");
    }
  };

  const shareAddress = async () => {
    if (!delivery) return;
    try {
      await Share.share({
        message: `📍 Livraison ${delivery.recipient_name} : ${delivery.address}`,
        title: "Position de livraison",
      });
    } catch {
      /* partage annulé */
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
        <Text style={deliveryDetailStyles.errorText}>Livraison introuvable</Text>
        <TouchableOpacity
          style={deliveryDetailStyles.backButton}
          onPress={goBack}
        >
          <Text style={deliveryDetailStyles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const merchantName = merchant?.name || "Particulier";
  const orderRef = `#${merchantInitials(merchantName)}-${delivery.id}`;
  const commune = detectCommune(delivery.address);
  const street = (delivery.address || "").split(",")[0]?.trim() || delivery.address;
  const isDelivered = delivery.status === "LIVREE";
  const isCancelled = delivery.status === "ANNULEE";
  const isEditable = !isDelivered && !isCancelled;

  const collect = expectedCollect(delivery);
  const gain = typeof delivery.profit === "number" ? delivery.profit : delivery.delivery_fee;
  const toReverse = delivery.amount_to_return ?? 0;

  const statusStyle =
    delivery.status === "A_LIVRER"
      ? { bg: "#FEF3C7", fg: "#92400E", dot: "#B45309", label: "À livrer" }
      : isDelivered
        ? { bg: "#D1FAE5", fg: "#065F46", dot: "#059669", label: "Livrée" }
        : { bg: "#FDE2E2", fg: "#B91C1C", dot: "#B91C1C", label: "Annulée" };

  const payBadge =
    delivery.payment_type === "CLIENT_PAYE_TOUT"
      ? "Espèces au client"
      : delivery.payment_type === "CLIENT_PAYE_LIVRAISON"
        ? "Frais seuls"
        : delivery.payment_type === "LIVRAISON_DEJA_PAYEE"
          ? "Colis seul"
          : "100% prépayé";

  const createdHour = formatHour(delivery.created_at);
  const createdLabel = isToday(delivery.created_at) ? "Aujourd'hui" : (() => {
    try {
      return new Date(delivery.created_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return "";
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FC" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* En-tête */}
      <View style={deliveryDetailStyles.header}>
        <View style={deliveryDetailStyles.headerContent}>
          <TouchableOpacity
            style={deliveryDetailStyles.backButtonHeader}
            onPress={() => router.back()}
            accessibilityLabel="Retour"
          >
            <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={deliveryDetailStyles.headerTitle} numberOfLines={1}>
            Détail Livraison
          </Text>
          <View style={deliveryDetailStyles.headerRight}>
            <View style={deliveryDetailStyles.syncPill}>
              <View
                style={[
                  deliveryDetailStyles.syncDot,
                  { backgroundColor: isConnected ? COLORS.primary : "#D97706" },
                ]}
              />
              <Text style={deliveryDetailStyles.syncText}>
                {isConnected ? "Sync" : "Off"}
              </Text>
            </View>
            <ProfileAvatar size={32} initial={userInitial} />
          </View>
        </View>
      </View>

      <ScrollView
        style={deliveryDetailStyles.scrollView}
        contentContainerStyle={deliveryDetailStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Destinataire */}
        <View style={deliveryDetailStyles.card}>
          <View style={deliveryDetailStyles.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={deliveryDetailStyles.refRow}>
                <Text style={deliveryDetailStyles.refLabel}>COURSE</Text>
                <View style={deliveryDetailStyles.refPill}>
                  <Text style={deliveryDetailStyles.refText}>{orderRef}</Text>
                </View>
              </View>
              <Text
                style={deliveryDetailStyles.clientName}
                numberOfLines={1}
              >
                {delivery.recipient_name}
              </Text>
            </View>
            <View
              style={[deliveryDetailStyles.statusPill, { backgroundColor: statusStyle.bg }]}
            >
              <View
                style={[deliveryDetailStyles.statusDot, { backgroundColor: statusStyle.dot }]}
              />
              <Text style={[deliveryDetailStyles.statusText, { color: statusStyle.fg }]}>
                {statusStyle.label}
              </Text>
            </View>
          </View>
          <View style={deliveryDetailStyles.scheduleBox}>
            <MaterialIcons name="schedule" size={18} color="#B45309" />
            <Text style={deliveryDetailStyles.scheduleText}>
              {createdLabel} •{" "}
              <Text style={deliveryDetailStyles.scheduleStrong}>{createdHour}</Text>{" "}
              • {Formatters.formatRelativeTime(delivery.created_at)}
            </Text>
          </View>
        </View>

        {/* Actions urgentes */}
        <View style={deliveryDetailStyles.urgentRow}>
          <TouchableOpacity
            style={[deliveryDetailStyles.urgentButton, deliveryDetailStyles.urgentButtonCall]}
            onPress={() => directCall(delivery.phone, delivery.recipient_name)}
            activeOpacity={0.9}
          >
            <View style={deliveryDetailStyles.urgentIcon}>
              <MaterialIcons name="call" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={deliveryDetailStyles.urgentLabel}>Appeler</Text>
              <Text style={deliveryDetailStyles.urgentValue} numberOfLines={1}>
                {delivery.phone || "N° indisponible"}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[deliveryDetailStyles.urgentButton, deliveryDetailStyles.urgentButtonGps]}
            onPress={() => setShowGpsSheet(true)}
            activeOpacity={0.9}
          >
            <View style={deliveryDetailStyles.urgentIcon}>
              <MaterialIcons name="near-me" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={deliveryDetailStyles.urgentLabel}>Navigation</Text>
              <Text style={deliveryDetailStyles.urgentValue} numberOfLines={1}>
                Itinéraire GPS
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Point de chute */}
        <View style={deliveryDetailStyles.card}>
          <View style={deliveryDetailStyles.sectionHead}>
            <View style={deliveryDetailStyles.sectionTitleRow}>
              <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
              <Text style={deliveryDetailStyles.sectionTitle}>Point de chute</Text>
            </View>
            <View style={deliveryDetailStyles.communePill}>
              <Text style={deliveryDetailStyles.communeText}>{commune}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={deliveryDetailStyles.mapPreview}
            onPress={() => setShowGpsSheet(true)}
            activeOpacity={0.9}
            accessibilityLabel="Ouvrir le guidage GPS"
          >
            {[0.18, 0.42, 0.66].map((t) => (
              <View
                key={`h${t}`}
                style={[deliveryDetailStyles.mapGridLineH, { top: `${t * 100}%` }]}
              />
            ))}
            {[0.2, 0.45, 0.7].map((l) => (
              <View
                key={`v${l}`}
                style={[deliveryDetailStyles.mapGridLineV, { left: `${l * 100}%` }]}
              />
            ))}
            <View
              style={[
                deliveryDetailStyles.mapRoad,
                { left: "8%", right: "8%", top: "46%", height: 9 },
              ]}
            />
            <View
              style={[
                deliveryDetailStyles.mapRoad,
                { left: "58%", top: "6%", bottom: "6%", width: 9 },
              ]}
            />
            <View style={[deliveryDetailStyles.mapPin, { left: "52%", top: "30%" }]}>
              <MaterialIcons name="location-on" size={22} color="#FFFFFF" />
            </View>
            <View style={deliveryDetailStyles.mapFooter}>
              <View style={deliveryDetailStyles.mapFooterLeft}>
                <MaterialIcons name="assistant-navigation" size={17} color="#FFFFFF" />
                <Text style={deliveryDetailStyles.mapFooterText} numberOfLines={1}>
                  {street}
                </Text>
              </View>
              <View style={deliveryDetailStyles.mapFooterPill}>
                <Text style={deliveryDetailStyles.mapFooterPillText}>Guidage GPS</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={deliveryDetailStyles.landmarkBox}>
            <MaterialIcons name="pin-drop" size={20} color="#B45309" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={deliveryDetailStyles.landmarkMain}>{delivery.address}</Text>
              <Text style={deliveryDetailStyles.landmarkSub}>
                {commune} • Abidjan
              </Text>
            </View>
          </View>

          <View style={deliveryDetailStyles.addressActions}>
            <TouchableOpacity
              style={deliveryDetailStyles.addressAction}
              onPress={copyAddress}
              activeOpacity={0.85}
            >
              <MaterialIcons
                name={copied ? "check" : "content-copy"}
                size={17}
                color={copied ? COLORS.primary : COLORS.muted}
              />
              <Text style={deliveryDetailStyles.addressActionText}>
                {copied ? "Copié ✓" : "Copier"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={deliveryDetailStyles.addressAction}
              onPress={shareAddress}
              activeOpacity={0.85}
            >
              <MaterialIcons name="share-location" size={17} color={COLORS.muted} />
              <Text style={deliveryDetailStyles.addressActionText}>Partager</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trésorerie */}
        <View style={deliveryDetailStyles.card}>
          <View style={deliveryDetailStyles.sectionHead}>
            <View style={deliveryDetailStyles.sectionTitleRow}>
              <MaterialIcons name="payments" size={20} color={COLORS.primary} />
              <Text style={deliveryDetailStyles.sectionTitle}>Trésorerie course</Text>
            </View>
            <View style={deliveryDetailStyles.communePill}>
              <Text style={deliveryDetailStyles.communeText}>{payBadge}</Text>
            </View>
          </View>

          <View style={deliveryDetailStyles.cashBanner}>
            <Text style={deliveryDetailStyles.cashLabel}>
              Montant total à encaisser
            </Text>
            <View style={deliveryDetailStyles.cashRow}>
              <Text style={deliveryDetailStyles.cashAmount}>
                {Formatters.formatNumber(collect)}{" "}
                <Text style={deliveryDetailStyles.cashUnit}>FCFA</Text>
              </Text>
              <Text style={deliveryDetailStyles.cashTag}>
                {delivery.payment_type === "CLIENT_PAYE_TOUT" ? "Cash comptant" : payBadge}
              </Text>
            </View>
          </View>

          <View style={deliveryDetailStyles.moneyLines}>
            <View style={deliveryDetailStyles.moneyRow}>
              <Text style={deliveryDetailStyles.moneyLabel}>Valeur marchandise colis</Text>
              <Text style={deliveryDetailStyles.moneyValue}>
                {Formatters.formatNumber(delivery.parcel_value ?? 0)} FCFA
              </Text>
            </View>
            <View style={deliveryDetailStyles.moneyRow}>
              <Text style={deliveryDetailStyles.moneyLabel}>Frais de livraison facturés</Text>
              <Text style={deliveryDetailStyles.moneyValue}>
                {Formatters.formatNumber(delivery.delivery_fee)} FCFA
              </Text>
            </View>
            <View style={deliveryDetailStyles.moneyDivider} />
            <View style={deliveryDetailStyles.moneyRow}>
              <Text style={deliveryDetailStyles.moneyLabel}>
                <MaterialIcons name="storefront" size={15} color="#B45309" />{" "}
                À reverser à {merchantName}
              </Text>
              <Text style={deliveryDetailStyles.moneyValue}>
                {Formatters.formatNumber(toReverse)} FCFA
              </Text>
            </View>
            <View style={deliveryDetailStyles.gainBox}>
              <Text style={deliveryDetailStyles.gainLabel} numberOfLines={1}>
                <MaterialIcons name="check-circle" size={17} color={COLORS.primary} />{" "}
                Ton gain net garanti ({courierName})
              </Text>
              <Text style={deliveryDetailStyles.gainValue}>
                +{Formatters.formatNumber(gain)} FCFA
              </Text>
            </View>
          </View>
        </View>

        {/* Note terrain */}
        {!!delivery.notes && (
          <View style={deliveryDetailStyles.card}>
            <View style={deliveryDetailStyles.sectionTitleRow}>
              <MaterialIcons name="campaign" size={20} color="#B45309" />
              <Text style={deliveryDetailStyles.sectionTitle}>
                Note terrain importante
              </Text>
            </View>
            <View style={deliveryDetailStyles.noteBox}>
              <MaterialIcons name="info" size={19} color="#B45309" />
              <Text style={deliveryDetailStyles.noteText}>{delivery.notes}</Text>
            </View>
          </View>
        )}

        {/* Boutique */}
        <View style={deliveryDetailStyles.card}>
          <View style={deliveryDetailStyles.sectionHead}>
            <View style={deliveryDetailStyles.sectionTitleRow}>
              <MaterialIcons name="inventory-2" size={20} color="#006398" />
              <Text style={deliveryDetailStyles.sectionTitle}>Boutique partenaire</Text>
            </View>
            <Text style={deliveryDetailStyles.verifiedPill}>Colis vérifié</Text>
          </View>
          <View style={deliveryDetailStyles.merchantRow}>
            <View style={deliveryDetailStyles.merchantLeft}>
              <View style={deliveryDetailStyles.merchantAvatar}>
                <Text style={deliveryDetailStyles.merchantAvatarText}>
                  {merchantInitials(merchantName)}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={deliveryDetailStyles.merchantName} numberOfLines={1}>
                  {merchantName}
                </Text>
                <Text style={deliveryDetailStyles.merchantSub} numberOfLines={1}>
                  {merchant?.address || `${commune}`} • Réf: {orderRef}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={deliveryDetailStyles.merchantCall}
              onPress={() => directCall(merchant?.phone, merchantName)}
              accessibilityLabel={`Appeler ${merchantName}`}
            >
              <MaterialIcons name="phone" size={20} color="#006398" />
            </TouchableOpacity>
          </View>
          <View style={deliveryDetailStyles.geranteLine}>
            <Text style={deliveryDetailStyles.geranteLabel}>
              Contact{merchant?.contact_name ? ` ${merchant.contact_name}` : " gérante"} :
            </Text>
            <Text style={deliveryDetailStyles.geranteValue} numberOfLines={1}>
              {merchant?.phone || "Non renseigné"}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={deliveryDetailStyles.card}>
          <View style={deliveryDetailStyles.sectionTitleRow}>
            <MaterialIcons name="history" size={20} color={COLORS.primary} />
            <Text style={deliveryDetailStyles.sectionTitle}>Suivi de la livraison</Text>
          </View>
          <View>
            <View style={deliveryDetailStyles.timelineRow}>
              <View style={deliveryDetailStyles.timelineRail}>
                <View
                  style={[deliveryDetailStyles.timelineDot, { backgroundColor: COLORS.primary }]}
                >
                  <MaterialIcons name="check" size={13} color="#FFFFFF" />
                </View>
                <View style={deliveryDetailStyles.timelineLine} />
              </View>
              <View style={deliveryDetailStyles.timelineBody}>
                <View style={deliveryDetailStyles.timelineHead}>
                  <Text style={deliveryDetailStyles.timelineTitle}>Course enregistrée</Text>
                  <Text style={deliveryDetailStyles.timelineTime}>
                    {formatHour(delivery.created_at)}
                  </Text>
                </View>
                <Text style={deliveryDetailStyles.timelineSub}>
                  Attribuée à {courierName} (Enregistrée en local)
                </Text>
              </View>
            </View>

            {isDelivered ? (
              <View style={deliveryDetailStyles.timelineRow}>
                <View style={deliveryDetailStyles.timelineRail}>
                  <View
                    style={[deliveryDetailStyles.timelineDot, { backgroundColor: COLORS.primary }]}
                  >
                    <MaterialIcons name="check" size={13} color="#FFFFFF" />
                  </View>
                </View>
                <View style={[deliveryDetailStyles.timelineBody, { paddingBottom: 0 }]}>
                  <View style={deliveryDetailStyles.timelineHead}>
                    <Text style={deliveryDetailStyles.timelineTitle}>
                      Livrée & encaissée
                    </Text>
                    <Text style={deliveryDetailStyles.timelineTime}>
                      {formatHour(delivery.delivered_at || delivery.created_at)}
                    </Text>
                  </View>
                  <Text style={deliveryDetailStyles.timelineSub}>
                    {Formatters.formatNumber(delivery.amount_collected ?? collect)} FCFA
                    encaissés • {merchantName}
                  </Text>
                </View>
              </View>
            ) : isCancelled ? (
              <View style={deliveryDetailStyles.timelineRow}>
                <View style={deliveryDetailStyles.timelineRail}>
                  <View
                    style={[deliveryDetailStyles.timelineDot, { backgroundColor: COLORS.danger }]}
                  >
                    <MaterialIcons name="close" size={13} color="#FFFFFF" />
                  </View>
                </View>
                <View style={[deliveryDetailStyles.timelineBody, { paddingBottom: 0 }]}>
                  <View style={deliveryDetailStyles.timelineHead}>
                    <Text style={[deliveryDetailStyles.timelineTitle, { color: COLORS.danger }]}>
                      Course annulée
                    </Text>
                  </View>
                  <Text style={deliveryDetailStyles.timelineSub}>
                    {delivery.notes || "Sans motif renseigné"}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={deliveryDetailStyles.timelineRow}>
                <View style={deliveryDetailStyles.timelineRail}>
                  <View
                    style={[deliveryDetailStyles.timelineDot, { backgroundColor: "#FFDDB8" }]}
                  >
                    <MaterialIcons name="two-wheeler" size={13} color="#92400E" />
                  </View>
                </View>
                <View style={[deliveryDetailStyles.timelineBody, { paddingBottom: 0 }]}>
                  <View style={deliveryDetailStyles.timelineHead}>
                    <Text
                      style={[deliveryDetailStyles.timelineTitle, deliveryDetailStyles.timelineTitleActive]}
                    >
                      En route vers le client
                    </Text>
                    <Text
                      style={[deliveryDetailStyles.timelineTime, deliveryDetailStyles.timelineTimeActive]}
                    >
                      En cours
                    </Text>
                  </View>
                  <Text
                    style={deliveryDetailStyles.timelineSub}
                    numberOfLines={1}
                  >
                    {street}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Gérer (Modifier / Supprimer conservés) */}
        <View style={deliveryDetailStyles.card}>
          <View style={deliveryDetailStyles.manageRow}>
            <TouchableOpacity
              style={deliveryDetailStyles.manageButton}
              onPress={() => router.push(`/add-delivery?id=${delivery.id}`)}
              disabled={!isEditable}
            >
              <MaterialIcons
                name="edit"
                size={17}
                color={isEditable ? COLORS.muted : "#C6CBD4"}
              />
              <Text style={deliveryDetailStyles.manageButtonText}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={deliveryDetailStyles.manageButton}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <>
                  <MaterialIcons name="delete" size={17} color={COLORS.danger} />
                  <Text
                    style={[
                      deliveryDetailStyles.manageButtonText,
                      deliveryDetailStyles.manageButtonDangerText,
                    ]}
                  >
                    Supprimer
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Barre d'action fixe */}
      <View style={deliveryDetailStyles.actionBar}>
        {isEditable ? (
          <>
            <TouchableOpacity
              style={deliveryDetailStyles.primaryButton}
              onPress={() => setShowCashSheet(true)}
              activeOpacity={0.95}
            >
              <View style={deliveryDetailStyles.primaryButtonLeft}>
                <MaterialIcons name="task-alt" size={22} color="#FFFFFF" />
                <Text style={deliveryDetailStyles.primaryButtonText}>
                  Encaisser & Livrer
                </Text>
              </View>
              <View style={deliveryDetailStyles.primaryButtonAmount}>
                <Text style={deliveryDetailStyles.primaryButtonAmountText}>
                  {Formatters.formatNumber(collect)} F
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={deliveryDetailStyles.secondaryButton}
              onPress={() => setShowIssueSheet(true)}
              activeOpacity={0.9}
            >
              <MaterialIcons name="report-problem" size={18} color={COLORS.danger} />
              <Text style={deliveryDetailStyles.secondaryButtonText}>
                Signaler un problème / Refus
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={deliveryDetailStyles.readOnlyBox}>
            <Text style={deliveryDetailStyles.readOnlyText}>
              {isDelivered
                ? `Course livrée le ${formatHour(delivery.delivered_at || delivery.created_at)} — ${Formatters.formatNumber(delivery.amount_collected ?? collect)} FCFA encaissés.`
                : "Course annulée — voir le motif dans le suivi ci-dessus."}
            </Text>
          </View>
        )}
      </View>

      {/* Sheet encaissement */}
      <Modal
        visible={showCashSheet}
        transparent
        animationType="slide"
        onRequestClose={() => !isDelivering && setShowCashSheet(false)}
      >
        <View style={deliveryDetailStyles.modalOverlay}>
          <View style={deliveryDetailStyles.sheet}>
            <View style={deliveryDetailStyles.dragHandle} />
            <View style={deliveryDetailStyles.sheetHead}>
              <Text style={deliveryDetailStyles.sheetTitle}>
                Confirmer l&apos;encaissement
              </Text>
              <TouchableOpacity
                style={deliveryDetailStyles.sheetClose}
                onPress={() => !isDelivering && setShowCashSheet(false)}
                accessibilityLabel="Fermer"
              >
                <MaterialIcons name="close" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <Text style={deliveryDetailStyles.sheetText}>
              Vérifie le montant effectivement perçu auprès de{" "}
              {delivery.recipient_name} avant clôture.
            </Text>
            <View style={deliveryDetailStyles.sheetSummary}>
              <View style={deliveryDetailStyles.sheetRow}>
                <Text style={deliveryDetailStyles.sheetLabel}>Montant attendu :</Text>
                <Text style={deliveryDetailStyles.sheetValue}>
                  {Formatters.formatNumber(collect)} FCFA
                </Text>
              </View>
              <View style={deliveryDetailStyles.sheetRow}>
                <Text style={deliveryDetailStyles.sheetLabel}>Reversé boutique :</Text>
                <Text style={[deliveryDetailStyles.sheetValue, deliveryDetailStyles.sheetValueGreen]}>
                  {Formatters.formatNumber(toReverse)} FCFA
                </Text>
              </View>
              <View style={deliveryDetailStyles.sheetRow}>
                <Text style={deliveryDetailStyles.sheetLabel}>Ton gain :</Text>
                <Text style={[deliveryDetailStyles.sheetValue, deliveryDetailStyles.sheetValueGreen]}>
                  +{Formatters.formatNumber(gain)} FCFA
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={deliveryDetailStyles.sheetButton}
              onPress={handleMarkAsDelivered}
              disabled={isDelivering}
              activeOpacity={0.95}
            >
              {isDelivering ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                  <Text style={deliveryDetailStyles.sheetButtonText}>
                    Valider et synchroniser la course
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sheet GPS */}
      <Modal
        visible={showGpsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGpsSheet(false)}
      >
        <View style={deliveryDetailStyles.modalOverlay}>
          <View style={deliveryDetailStyles.sheet}>
            <View style={deliveryDetailStyles.dragHandle} />
            <View style={deliveryDetailStyles.sheetHead}>
              <Text style={deliveryDetailStyles.sheetTitle}>
                Lancer l&apos;itinéraire GPS
              </Text>
              <TouchableOpacity
                style={deliveryDetailStyles.sheetClose}
                onPress={() => setShowGpsSheet(false)}
                accessibilityLabel="Fermer"
              >
                <MaterialIcons name="close" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={deliveryDetailStyles.gpsOption}
              onPress={() => openGps("google")}
              activeOpacity={0.9}
            >
              <View style={deliveryDetailStyles.gpsOptionLeft}>
                <MaterialIcons name="map" size={24} color="#006398" />
                <Text style={deliveryDetailStyles.gpsOptionName}>Google Maps</Text>
              </View>
              <MaterialIcons name="open-in-new" size={19} color={COLORS.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={deliveryDetailStyles.gpsOption}
              onPress={() => openGps("waze")}
              activeOpacity={0.9}
            >
              <View style={deliveryDetailStyles.gpsOptionLeft}>
                <MaterialIcons name="navigation" size={24} color="#B45309" />
                <Text style={deliveryDetailStyles.gpsOptionName}>
                  Waze (Trafic en direct)
                </Text>
              </View>
              <MaterialIcons name="open-in-new" size={19} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sheet incident */}
      <Modal
        visible={showIssueSheet}
        transparent
        animationType="slide"
        onRequestClose={() => !isCancelling && setShowIssueSheet(false)}
      >
        <View style={deliveryDetailStyles.modalOverlay}>
          <View style={deliveryDetailStyles.sheet}>
            <View style={deliveryDetailStyles.dragHandle} />
            <View style={deliveryDetailStyles.sheetHead}>
              <Text style={[deliveryDetailStyles.sheetTitle, { color: COLORS.danger }]}>
                Incident de livraison
              </Text>
              <TouchableOpacity
                style={deliveryDetailStyles.sheetClose}
                onPress={() => !isCancelling && setShowIssueSheet(false)}
                accessibilityLabel="Fermer"
              >
                <MaterialIcons name="close" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <Text style={deliveryDetailStyles.sheetText}>
              Sélectionne le motif terrain pour notifier {merchantName} et le
              support. La course passera en « Annulée ».
            </Text>
            {ISSUE_MOTIFS.map((motif) => (
              <TouchableOpacity
                key={motif}
                style={deliveryDetailStyles.issueOption}
                onPress={() => handleReportIssue(motif)}
                disabled={isCancelling}
                activeOpacity={0.9}
              >
                <Text style={deliveryDetailStyles.issueOptionText} numberOfLines={2}>
                  {motif}
                </Text>
                {isCancelling ? (
                  <ActivityIndicator size="small" color={COLORS.muted} />
                ) : (
                  <MaterialIcons name="chevron-right" size={19} color={COLORS.muted} />
                )}
              </TouchableOpacity>
            ))}
            <TextInput
              style={deliveryDetailStyles.modalInput}
              value={issueNote}
              onChangeText={setIssueNote}
              placeholder="Précision libre (ex : recontacter demain 9h…)"
              placeholderTextColor={COLORS.placeholder}
              multiline
              editable={!isCancelling}
            />
          </View>
        </View>
      </Modal>

      {/* Overlay suppression */}
      {isDeleting && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              padding: 24,
              borderRadius: 16,
              alignItems: "center",
              gap: 12,
            }}
          >
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ color: COLORS.white, fontWeight: "500" }}>
              Suppression en cours...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
