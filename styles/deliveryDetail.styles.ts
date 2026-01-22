import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const deliveryDetailStyles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
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

  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  clientInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },

  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },

  dangerButton: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.danger,
  },

  dangerButtonText: {
    color: COLORS.danger,
    fontWeight: "600",
  },
});
