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
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,                // Texte foncé
  },
  inputGroup: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderVeryLight,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.muted,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    color: COLORS.white,                // Texte foncé
    padding: 0,
    margin: 0,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
    fontStyle: "italic",
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",                   // Blanc sur vert
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
});