import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { db } from "../src/database/db";

export default function Register() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Vérifier si un utilisateur existe déjà
  useEffect(() => {
    const checkUser = async () => {
      const result = await db.getAllAsync("SELECT * FROM user LIMIT 1");
      if (result.length > 0) {
        router.replace("/dashboard");
      }
    };
    checkUser();
  }, []);

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert("Erreur", "Le nom est obligatoire");
      return;
    }

    await db.runAsync(
      "INSERT INTO user (name, phone, created_at) VALUES (?, ?, ?)",
      [name, phone, new Date().toISOString()]
    );

    router.replace("/dashboard");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription</Text>

      <TextInput
        placeholder="Nom"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <TextInput
        placeholder="Téléphone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <Button title="S'inscrire" onPress={handleRegister} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
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
