import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const dashboardStyles = StyleSheet.create({
  // Header
  header: {
    paddingTop: 48,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileSection: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  // Avatar avec initiale
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  greeting: {
    color: COLORS.muted,
    fontSize: 12,
  },
  name: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  notificationButton: {
    padding: 8,
    borderRadius: 20,
  },

  // Content
  content: {
    padding: 16,
    marginTop: 20,
  },

  // Date header
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dateText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 4,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  historyText: {
    color: COLORS.muted,
    fontSize: 12,
  },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  mainCard: {
    backgroundColor: COLORS.card,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    width: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardLabel: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  iconContainer: {
    padding: 8,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 8,
  },
  mainAmount: {
    color: COLORS.white,
    fontSize: 36,
    fontWeight: "800",
    marginTop: 8,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendBadgeUp: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  trendBadgeDown: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  trendText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  trendLabel: {
    color: COLORS.muted,
    fontSize: 12,
  },
  secondaryCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flex: 1,
    minWidth: "45%",
  },
  secondaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  secondaryAmount: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
  },

  // Finance card
  financeCard: {
    backgroundColor: COLORS.card,
    padding: 20,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  financeTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  financeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  financeLabel: {
    color: COLORS.muted,
    fontSize: 13,
  },
  financeValue: {
    color: COLORS.white,
    fontWeight: "bold",
  },

  // Accounting button
  accountingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  accountingText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },

  scheduleScrollContainer: {
    maxHeight: 300, // Limite la hauteur avant que le scroll n'apparaisse
    marginTop: 8,
    borderRadius: 12,
    // backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 0,
  },

  scheduleScrollContent: {
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  // Schedule section
  scheduleSection: {
    marginBottom: 70,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  scheduleTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  calendarButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.card,
  },

  // Delivery card
  deliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8, // Réduire de 12 à 8
  },
  timeContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "bold",
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
  },
  deliveryAddress: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  deliveryRight: {
    alignItems: "flex-end",
  },
  deliveryFee: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
  },
  noDeliveries: {
    color: COLORS.muted,
    textAlign: "center",
    padding: 20,
  },

  // Floating button
  floatingButton: {
    position: "absolute",
    bottom: 110,
    right: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingButtonText: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  bottomSpacer: {
    height: 70, // Ajustez cette valeur selon la hauteur de votre tab bar
  },
});
