import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const addDeliveryStyles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  inputGroup: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderVeryLight,
  },

  inputLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 4,
  },

  input: {
    fontSize: 16,
    color: COLORS.white,
  },

  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
  },

  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
});
