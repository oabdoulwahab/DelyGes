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
    color: COLORS.white,                // Texte foncé
    fontSize: 16,
    fontWeight: "bold",
  },
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
  },
  floatingButtonText: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#FFFFFF",                   // Blanc sur vert
  },
});