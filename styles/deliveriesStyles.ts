import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const deliveriesStyles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },

  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  searchInput: {
    flex: 1,
    height: 48,
    color: COLORS.white,
    fontSize: 16,
  },

  deliveryCard: {
    flexDirection: "row",
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.muted,
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  feeText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyStateText: {
    marginTop: SPACING.sm,
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
  },
});
