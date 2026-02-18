import { StyleSheet } from "react-native";
import { COLORS } from "./colors";

export const registerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background, // Blanc
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
    color: COLORS.white,                // Texte foncé
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    color: COLORS.white,                // Texte foncé
    fontWeight: "bold",
    marginBottom: 24,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderColor: COLORS.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: COLORS.white,                // Texte foncé
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
    color: "#FFFFFF",                   // Blanc sur vert
    fontSize: 18,
    fontWeight: "bold",
  },
  loginLink: {
    color: COLORS.primary,
    textAlign: "center",
    fontWeight: "bold",
  },
});