import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { db } from "../../src/database/db";

type Delivery = {
  id: number;
  recipient_name: string;
  phone: string;
  address: string;
  parcel_value: number;
  delivery_fee: number;
  status: string;
};

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDelivery = async () => {
      const result = await db.getFirstAsync<Delivery>(
        "SELECT * FROM deliveries WHERE id = ?",
        [Number(id)]
      );

      setDelivery(result ?? null);
      setLoading(false);
    };

    loadDelivery();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  if (!delivery) {
    return <Text style={{ margin: 20 }}>Livraison introuvable</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Détail livraison</Text>

      <Text>Destinataire : {delivery.recipient_name}</Text>
      <Text>Téléphone : {delivery.phone || "-"}</Text>
      <Text>Adresse : {delivery.address}</Text>
      <Text>Valeur colis : {delivery.parcel_value} FCFA</Text>
      <Text>Frais livraison : {delivery.delivery_fee} FCFA</Text>
      <Text>Statut : {delivery.status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
