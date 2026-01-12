import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useEffect, useState } from "react";
import { db } from "../src/database/db";
import { router } from "expo-router";

type Delivery = {
  id: number;
  recipient_name: string;
  address: string;
  delivery_fee: number;
  status: string;
};

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadDeliveries = async () => {
    const status = showHistory ? "LIVREE" : "A_LIVRER";

    const result = await db.getAllAsync<Delivery>(
      "SELECT * FROM deliveries WHERE status = ? ORDER BY created_at DESC",
      [status]
    );

    setDeliveries(result);
  };

  useEffect(() => {
    loadDeliveries();
  }, [showHistory]);

  const markAsDelivered = async (id: number) => {
    await db.runAsync(
      "UPDATE deliveries SET status = ?, delivered_at = ? WHERE id = ?",
      ["LIVREE", new Date().toISOString(), id]
    );

    Alert.alert("Succès", "Livraison marquée comme livrée");
    loadDeliveries();
  };

  const renderItem = ({ item }: { item: Delivery }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/delivery/${item.id}`)}
    >
      <Text style={styles.name}>{item.recipient_name}</Text>
      <Text>{item.address}</Text>
      <Text style={styles.fee}>Frais : {item.delivery_fee || 0} FCFA</Text>

      {!showHistory && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => markAsDelivered(item.id)}
        >
          <Text style={styles.buttonText}>Marquer comme livrée</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Onglets */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, !showHistory && styles.activeTab]}
          onPress={() => setShowHistory(false)}
        >
          <Text>À livrer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, showHistory && styles.activeTab]}
          onPress={() => setShowHistory(true)}
        >
          <Text>Historique</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>Aucune livraison</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    padding: 15,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "#eee",
  },
  activeTab: {
    borderColor: "#000",
  },
  card: {
    padding: 15,
    margin: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
  },
  fee: {
    marginTop: 5,
    fontWeight: "bold",
  },
  button: {
    marginTop: 10,
    backgroundColor: "#000",
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
  },
  empty: {
    textAlign: "center",
    marginTop: 40,
    color: "#999",
  },
});
