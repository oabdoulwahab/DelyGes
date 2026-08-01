// styles/verifyEmailStyles.ts
import { StyleSheet } from "react-native";
import { COLORS } from "./colors";

export const verifyEmailStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: COLORS.white,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 10,
  },
  emailText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: 20,
  },
  messageBox: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  messageSuccess: {
    backgroundColor: COLORS.successSoft,
    borderColor: COLORS.success,
  },
  messageSuccessText: {
    color: COLORS.success,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  messageError: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: COLORS.danger,
  },
  messageErrorText: {
    color: COLORS.danger,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonPrimaryDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonSecondary: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonSecondaryDisabled: {
    opacity: 0.5,
  },
  buttonSecondaryText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonLogout: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  buttonLogoutText: {
    color: COLORS.muted,
    fontSize: 15,
    fontWeight: "500",
  },
  deleteLink: {
    textAlign: "center",
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
    paddingVertical: 8,
  },
  notConnected: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  // Modale de suppression de compte
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalErrorText: {
    color: COLORS.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 16,
  },
  modalButtonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonCancel: {
    backgroundColor: COLORS.inputBackground,
  },
  modalButtonCancelText: {
    color: COLORS.muted,
    fontWeight: "600",
  },
  modalButtonDanger: {
    backgroundColor: COLORS.danger,
  },
  modalButtonDangerText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  // Indicateur de chargement pendant la suppression
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContent: {
    backgroundColor: COLORS.card,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.white,
    fontWeight: "500",
  },
});
