import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const deliveryDetailStyles = StyleSheet.create({
  // Loading & Error states
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

  // Header
  header: {
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
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
    color: COLORS.white,
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

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
  },

  // Date section
  dateSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.white,
  },
  timeValue: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 4,
  },

  // Client info
  clientInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderVeryLight,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
  },
  clientInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  clientPhone: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
  },
  clientPhoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  // Address
  addressContainer: {
    padding: SPACING.md,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
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
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.white,
  },

  // Financial
  financialCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
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
    color: COLORS.muted,
  },
  financialValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.borderLight,
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
    color: COLORS.white,
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.primary,
  },

  // Payment type
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
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  paymentTypeText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
  },

  // Financial summary
  financialSummary: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  financialSummaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  financialSummaryLabel: {
    color: COLORS.muted,
    fontSize: 14,
  },
  financialSummaryValue: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },

  // Tracking
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
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  trackingValue: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.white,
  },
  statusDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderVeryLight,
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

  // Action bar
  actionBar: {
    position: "absolute",
    bottom: 35,
    left: 0,
    right: 0,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  dangerButtonFull: {
    flex: 2, // Prend toute la largeur quand le bouton modifier est caché
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
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
    color: COLORS.white,
  },
  dangerButton: {
    flex: 1,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.danger,
  },
  // Mode lecture seule
  actionBarReadOnly: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    alignItems: "center",
  },
  readOnlyMessage: {
    fontSize: 14,
    color: COLORS.muted,
    fontStyle: "italic",
    marginBottom: SPACING.sm,
  },
});
