import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const dashboardStyles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingHorizontal: SPACING.md,
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

  statCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.white,
  },

  floatingButton: {
    position: "absolute",
    bottom: 90,
    right: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  floatingButtonText: {
    fontWeight: "bold",
    marginLeft: 8,
  },
});
