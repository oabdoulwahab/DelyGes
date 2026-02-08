import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useModal } from "../providers/ModalProvider"; 

export default function NavigationTabs() {
  const pathname = usePathname();
  const { showAlert } = useModal();

  // Masquer les tabs sur certains écrans
  const hideTabsOnScreens = ["/delivery/", "/login", "/add-delivery", "/register"];

  const shouldHideTabs = hideTabsOnScreens.some((path) =>
    pathname.includes(path)
  );

  if (shouldHideTabs) {
    return null; // Ne pas afficher les tabs
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/dashboard")}
      >
        <MaterialIcons
          name="dashboard"
          size={24}
          color={pathname === "/dashboard" ? "#13ec13" : "#94A3B8"}
        />
        <Text
          style={[
            styles.tabText,
            { color: pathname === "/dashboard" ? "#13ec13" : "#94A3B8" },
          ]}
        >
          Tableau de bord
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/deliveries")}
      >
        <MaterialIcons
          name="local-shipping"
          size={24}
          color={pathname === "/deliveries" ? "#13ec13" : "#94A3B8"}
        />
        <Text
          style={[
            styles.tabText,
            { color: pathname === "/deliveries" ? "#13ec13" : "#94A3B8" },
          ]}
        >
          Livraisons
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/add-delivery")}
      >
        <MaterialIcons name="add-circle" size={28} color="#94A3B8" />
        <Text style={styles.tabText}>Ajouter</Text>
      </TouchableOpacity>

      {/* <TouchableOpacity style={styles.tabItem}>
        <MaterialIcons
          name="bar-chart"
          size={24}
          color="#94A3B8"
          onPress={() => {
            showAlert("Info", "Stats - fonctionnalité à venir"); 
          }}
        />
        <Text style={styles.tabText}>Stats</Text>
      </TouchableOpacity> */}

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/settings")}
      >
        <MaterialIcons
          name="settings"
          size={24}
          color={pathname === "/settings" ? "#13ec13" : "#94A3B8"}
        />
        <Text
          style={[
            styles.tabText,
            { color: pathname === "/settings" ? "#13ec13" : "#94A3B8" },
          ]}
        >
          Paramètres
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 50,
    backgroundColor: "#1E293B",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    zIndex: 1000, // Assure que les tabs sont au-dessus
  },
  tabItem: {
    alignItems: "center",
    gap: 4,
  },
  tabText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "500",
  },
});
