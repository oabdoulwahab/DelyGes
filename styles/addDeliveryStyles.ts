import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const addDeliveryStyles = StyleSheet.create({
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.muted,
    fontSize: 16,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
  },
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: COLORS.primary,
    fontSize: 16,
  },
  saveButtonHeader: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  saveButtonHeaderText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "600",
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },

  // Sections
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Inputs
  inputGroup: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderVeryLight,
  },
  inputGroupWithIcon: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.muted,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    color: COLORS.white,
    padding: 0,
    margin: 0,
    // merged from below
    paddingVertical: 8,
    minHeight: 40,
  },
  inputIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  inputContent: {
    flex: 1,
  },
  inputError: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
  },
  required: {
    color: COLORS.danger,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
    fontStyle: "italic",
  },

  // Financial inputs
  financialGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  financialCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.white,
    marginRight: 8,
  },
  financialInput: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.white,
    flex: 1,
    padding: 0,
    margin: 0,
  },

  // Net income card
  netIncomeCard: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  netIncomeContent: {
    flex: 1,
  },
  netIncomeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  netIncomeSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  netIncomeAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.white,
  },

  // Payment options
  paymentOption: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 8,
  },
  paymentSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  paymentText: {
    color: COLORS.white,
    fontSize: 15,
  },

  // Merchant suggestions
  merchantInputContainer: {
    position: "relative",
    // width: "100%",
    zIndex: 1000,
  },
  inputWithSuggestions: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  clearButton: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: [{ translateY: -10 }],
  },

  suggestionsContainer: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,

    // Positionnement flottant
    position: "absolute",
    top: 80, // S'affiche juste en dessous du champ de saisie
    left: 0,
    right: 0,
    zIndex: 5000,

    // Ombre pour décoller du fond
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,

    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
  },
  suggestionPhone: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  suggestionCheck: {
    marginLeft: 8,
  },
  selectedMerchantInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  selectedMerchantText: {
    color: COLORS.success,
    fontSize: 12,
  },

  // Action buttons
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
    color: "#FFFFFF",
  },
  actionButtons: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  bottomSpacer: {
    height: 20,
  },
  optional: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "normal",
  },
});
