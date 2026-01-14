import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";

export default function NavigationTabs() {
  const pathname = usePathname();
  
  // Masquer les tabs sur certains écrans
  const hideTabsOnScreens = [
    "/delivery/",
    "/add-delivery",
    "/register",
  ];
  
  const shouldHideTabs = hideTabsOnScreens.some(path => pathname.includes(path));
  
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
        <Text style={[
          styles.tabText, 
          { color: pathname === "/dashboard" ? "#13ec13" : "#94A3B8" }
        ]}>
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
        <Text style={[
          styles.tabText,
          { color: pathname === "/deliveries" ? "#13ec13" : "#94A3B8" }
        ]}>
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
      
      <TouchableOpacity style={styles.tabItem}>
        <MaterialIcons name="bar-chart" size={24} color="#94A3B8" onPress={() => {
                    Alert.alert("Info", "Stats - fonctionnalité à venir");
                  }}/>
        <Text style={styles.tabText}>Stats</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.tabItem}>
        <MaterialIcons name="settings" size={24} color="#94A3B8" onPress={() => {
                    Alert.alert("Info", "Paramètres - fonctionnalité à venir");
                  }}/>
        <Text style={styles.tabText}>Paramètres</Text>
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
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "#102210",
    borderTopWidth: 1,
    borderTopColor: "#ffffff10",
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