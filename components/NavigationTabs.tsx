import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function NavigationTabs() {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.tabItem}
        onPress={() => router.push("/dashboard")}
      >
        <MaterialIcons name="dashboard" size={24} color="#13ec13" />
        <Text style={[styles.tabText, { color: "#13ec13" }]}>Tableau de bord</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.tabItem}
        onPress={() => router.push("/deliveries")}
      >
        <MaterialIcons name="local-shipping" size={24} color="#94A3B8" />
        <Text style={styles.tabText}>Livraisons</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.tabItem}
        onPress={() => router.push("/add-delivery")}
      >
        <MaterialIcons name="add-circle" size={28} color="#94A3B8" />
        <Text style={styles.tabText}>Ajouter</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.tabItem}>
        <MaterialIcons name="bar-chart" size={24} color="#94A3B8" />
        <Text style={styles.tabText}>Stats</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.tabItem}>
        <MaterialIcons name="settings" size={24} color="#94A3B8" />
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
  },
  tabItem: {
    alignItems: "center",
    gap: 4,
  },
  tabText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94A3B8",
  },
});