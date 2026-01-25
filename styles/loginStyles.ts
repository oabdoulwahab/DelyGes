import { StyleSheet } from "react-native";
import { COLORS } from "./colors";

export const loginStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoBackground: {
    width: 150,
    height: 150,
    // backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 150,
    height: 170,
    borderRadius: 16,
    resizeMode: "contain",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.white,
  },
  subtitle: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 6,
  },
  errorContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.dangerSoft,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: COLORS.danger,
    flex: 1,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: COLORS.white,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#193319",
    borderColor: "#326732",
    borderWidth: 1,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: COLORS.white,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 16,
  },
  fieldError: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 4,
  },
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  remember: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rememberText: {
    color: COLORS.muted,
  },
  forgot: {
    color: COLORS.primary,
  },
  loginButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  gradient: {
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  loginText: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.background,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    color: COLORS.muted,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
});