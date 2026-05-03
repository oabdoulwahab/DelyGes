import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const merchantAccountingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  searchIcon: {
    marginRight: SPACING.xs,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: COLORS.white,
    fontSize: 16,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    position: "relative",
  },
  filterButtonActive: {
    borderColor: COLORS.primary,
  },
  filterIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },

  // Date filter
  dateFilterContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  dateFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  dateFilterText: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "500",
  },

  // Tabs
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: SPACING.xs,
  },
  tabsScroll: {
    paddingHorizontal: SPACING.md,
  },
  tab: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.lg,
    alignItems: "center",
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
    marginBottom: SPACING.xs,
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

  // Global summary
  globalSummary: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  globalCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: SPACING.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  globalLabel: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 2,
  },
  globalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 120,
  },

  // Merchant card
  merchantCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: "hidden",
  },
  merchantCardClosed: {
    borderColor: COLORS.success + "30",
    opacity: 0.8,
  },
  merchantHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
  },
  merchantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  merchantInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
  },
  closedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.success + "20",
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 12,
  },
  closedBadgeText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: "600",
  },
  merchantContact: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: 2,
  },
  merchantContactText: {
    fontSize: 12,
    color: COLORS.muted,
    flex: 1,
  },
  deliveryCount: {
    alignItems: "flex-end",
    marginRight: SPACING.xs,
  },
  deliveryCountNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  deliveryCountLabel: {
    fontSize: 10,
    color: COLORS.muted,
  },

  // Expanded content
  expandedContent: {
    padding: SPACING.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  financialSection: {
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  financialLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },
  financialValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.white,
  },

  // Recent deliveries
  recentDeliveries: {
    marginBottom: SPACING.md,
  },
  recentDeliveriesTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  deliveryPreview: {
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderRadius: 12,
    marginBottom: SPACING.xs,
  },
  deliveryPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  deliveryPreviewName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.white,
  },
  deliveryPreviewDate: {
    fontSize: 11,
    color: COLORS.muted,
  },
  deliveryPreviewAddress: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: SPACING.xs,
  },
  deliveryPreviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deliveryPreviewFee: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  reversedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  reversedBadgeText: {
    fontSize: 11,
    color: COLORS.success,
  },
  moreDeliveries: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.xs,
  },

  // Close button
  closeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.xs,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
    marginTop: SPACING.md,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: SPACING.xs,
    paddingHorizontal: 32,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: SPACING.lg,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
    textAlign: "center",
    flex: 1,
  },
  modalResetButton: {
    width: 40,
    alignItems: "flex-end",
  },
  modalResetText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  modalScrollView: {
    paddingHorizontal: 20,
    maxHeight: 500,
  },
  modalSection: {
    marginBottom: 32,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: SPACING.md,
  },

  // Period buttons
  periodButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: 20,
  },
  periodButton: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodButtonCustom: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  periodButtonCustomActive: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
  },
  periodButtonTextActive: {
    color: COLORS.background,
    fontWeight: "bold",
  },
  periodButtonCustomText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },

  // Calendar
  calendarContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.white,
  },
  weekDaysContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: SPACING.sm,
  },
  weekDayText: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.muted,
    width: 32,
    textAlign: "center",
  },
  datesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calendarDay: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
    borderRadius: 16,
    position: "relative",
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  calendarDaySelected: {
    backgroundColor: COLORS.primary,
  },
  calendarDayHasDeliveries: {
    backgroundColor: COLORS.primarySoft,
  },
  calendarDayInactive: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.white,
  },
  calendarDayTextToday: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  calendarDayTextSelected: {
    color: COLORS.background,
    fontWeight: "bold",
  },
  calendarDayTextInactive: {
    fontSize: 12,
    color: COLORS.muted,
  },
  deliveryIndicator: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  selectedDateInfo: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderVeryLight,
  },
  selectedDateText: {
    fontSize: 12,
    color: COLORS.primary,
    textAlign: "center",
    fontWeight: "500",
  },

  // Modal actions
  modalActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    padding: 20,
    paddingTop: 0,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  resetButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
  },
  applyButton: {
    flex: 2,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.background,
  },

  modeSwitchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: COLORS.background,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
  },
  modeButtonTextActive: {
    color: COLORS.background,
  },
  monthCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: "hidden",
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.card,
  },
  monthHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  monthName: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
  },
  monthStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  monthTotalEncaisse: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  monthDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    padding: 12,
  },
  monthSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  monthSummaryItem: {
    alignItems: "center",
  },
  monthSummaryLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 4,
  },
  monthSummaryValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
  },
  merchantStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  merchantStatText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  merchantStatAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  merchantDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    padding: 12,
  },
});
