import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { db } from "../src/database/db";

export default function AddDelivery() {
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [parcelValue, setParcelValue] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");

  const handleSave = async () => {
    if (!recipientName.trim() || !address.trim()) {
      Alert.alert("Erreur", "Nom et adresse sont obligatoires");
      return;
    }

    await db.runAsync(
      `INSERT INTO deliveries 
      (recipient_name, phone, address, parcel_value, delivery_fee, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        recipientName,
        phone,
        address,
        Number(parcelValue),
        Number(deliveryFee),
        "A_LIVRER",
        new Date().toISOString(),
      ]
    );

    Alert.alert("Succès", "Livraison ajoutée");
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nouvelle livraison</Text>

      <TextInput
        placeholder="Nom du destinataire *"
        value={recipientName}
        onChangeText={setRecipientName}
        style={styles.input}
      />

      <TextInput
        placeholder="Téléphone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="Adresse de livraison *"
        value={address}
        onChangeText={setAddress}
        style={styles.input}
      />

      <TextInput
        placeholder="Valeur du colis"
        value={parcelValue}
        onChangeText={setParcelValue}
        keyboardType="numeric"
        style={styles.input}
      />

      <TextInput
        placeholder="Frais de livraison"
        value={deliveryFee}
        onChangeText={setDeliveryFee}
        keyboardType="numeric"
        style={styles.input}
      />

      <Button title="Enregistrer la livraison" onPress={handleSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
});
