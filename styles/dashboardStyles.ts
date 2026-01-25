import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const dashboardStyles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
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
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonText: {
    fontWeight: "bold",
    fontSize: 14,
  },
});