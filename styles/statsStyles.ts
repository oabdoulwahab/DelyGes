import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const statsStyles = StyleSheet.create({
  // Header
  header: {
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.white,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Period selector
  periodContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  periodSelector: {
    flexDirection: "row",
    height: 48,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 4,
  },
  periodOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  periodOptionActive: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
  },
  periodTextActive: {
    color: COLORS.white,
  },

  // Revenue section
  revenueSection: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  revenueTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  revenueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.white,
  },
  revenueBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    gap: 2,
  },
  revenueBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  revenueDate: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: SPACING.md,
  },

  // Chart
  chartContainer: {
    marginTop: SPACING.md,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.xs,
    marginTop: SPACING.sm,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.muted,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  kpiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  kpiLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: SPACING.xs,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  kpiChange: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.primary,
  },

  // Sources section
  sourcesSection: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xl,
  },
  sourcesTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: SPACING.md,
  },
  sourcesContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.lg,
  },

  // Donut chart
  donutContainer: {
    width: 120,
    height: 120,
    position: "relative",
  },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  donutTotalLabel: {
    fontSize: 10,
    color: COLORS.muted,
  },
  donutTotal: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
  },

  // Legend
  legendContainer: {
    flex: 1,
    gap: SPACING.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.sm,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.white,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
  },

  // Zones section
  zonesSection: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  zonesTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: SPACING.md,
  },
  zoneItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  zoneRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneRankText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  zoneContent: {
    flex: 1,
  },
  zoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  zoneDeliveries: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  zoneDeliveriesLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
    textAlign: "right",
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },

  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: 8,
    backgroundColor: COLORS.background,
    zIndex: 4,
    marginBottom: SPACING.md,
  },
  tabsScroll: {
    paddingHorizontal: SPACING.md,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 24,
    alignItems: "center",
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
    marginBottom: 6,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  tabIndicator: {
    height: 3,
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: 1.5,
  },
  activeTabIndicator: {
    backgroundColor: COLORS.primary,
  },
});