import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const forgotPasswordStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // Header
  header: {
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
  },

  // Scroll
  scrollContainer: {
    flexGrow: 1,
    padding: SPACING.lg,
  },

  // Logo et titre
  logoBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
    alignSelf: "center",
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    resizeMode: "contain",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.white,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },

  // Formulaire
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.white,
    marginBottom: SPACING.xs,
    marginLeft: 4,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.white,
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
  },
  fieldError: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: SPACING.xs,
    marginLeft: 4,
  },

  // Info box
  infoBox: {
    flexDirection: "row",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },

  // Bouton de réinitialisation
  resetButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: SPACING.lg,
  },
  resetButtonDisabled: {
    opacity: 0.5,
  },
  resetButtonGradient: {
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.sm,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },

  // Lien retour
  backToLogin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
  },
  backToLoginText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "500",
  },

  // Écran de succès
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: SPACING.md,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
    lineHeight: 24,
  },
  successInfoBox: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    width: "100%",
  },
  successInfoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.muted,
    fontStyle: "italic",
  },
  successButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
  successButtonGradient: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});