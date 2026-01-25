import { StyleSheet } from "react-native";
import { COLORS } from "./colors";

export const registerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: "bold",
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#193319",
    borderColor: "#326732",
    borderWidth: 1,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: COLORS.white,
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  checkboxText: {
    color: COLORS.muted,
    marginLeft: 8,
  },
  button: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  buttonText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
  },
  loginLink: {
    color: COLORS.primary,
    textAlign: "center",
    fontWeight: "bold",
  },
});