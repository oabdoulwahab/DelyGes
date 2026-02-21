import { StyleSheet, Dimensions } from "react-native";
import { COLORS } from "./colors";

const { width } = Dimensions.get("window");

export const navigationTabsStyles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 30,
    width: width,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    width: "92%",
    height: 70,
    borderRadius: 40,
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 10,
    // Ombre pour l'effet flottant
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    // Bordure subtile
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  iconWrapper: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 4,
  },
  activeIconWrapper: {
    backgroundColor: COLORS.primarySoft,
  },
  centralTabItem: {
    alignItems: "center",
    marginTop: -30, // Fait ressortir le bouton vers le haut
  },
  centralCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    // Ombre autour du bouton central
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.muted,
  },
});