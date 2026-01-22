// app/register.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Checkbox from "expo-checkbox";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../src/database/db";
import { User } from "../src/types";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert("Erreur", "Le nom complet est obligatoire");
      return;
    }

    if (!email.trim()) {
      Alert.alert("Erreur", "L’email est obligatoire");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Erreur", "Le téléphone est obligatoire");
      return;
    }

    if (!password) {
      Alert.alert("Erreur", "Le mot de passe est obligatoire");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    if (!acceptCGU) {
      Alert.alert(
        "Erreur",
        "Vous devez accepter les Conditions Générales d’Utilisation",
      );
      return;
    }

    setIsLoading(true);

    try {
      // ✅ Vérifier si l’email existe déjà
      const existingUser = await db.getFirstAsync(
        "SELECT id FROM user WHERE email = ?",
        [email.trim().toLowerCase()],
      );

      if (existingUser) {
        Alert.alert("Erreur", "Vous avez déjà un compte");
        return;
      }

      // ⚠️ Pour l’instant mot de passe en clair (OK pour MVP)
      await db.runAsync(
        "INSERT INTO user (name, email, phone, password, created_at) VALUES (?, ?, ?, ?, ?)",
        [
          fullName.trim(),
          email.trim().toLowerCase(),
          phone.trim(),
          password,
          new Date().toISOString(),
        ],
      );

      // ✅ Récupérer l'utilisateur créé
      const user = await db.getFirstAsync<User>(
        "SELECT * FROM user WHERE email = ?",
        [email.trim().toLowerCase()],
      );

      if (!user) {
        Alert.alert("Erreur", "Impossible de récupérer l'utilisateur créé");
        return;
      }

      // ✅ Sauvegarder la session
      await SecureStore.setItemAsync("AUTH_USER_ID", String(user.id));

      router.replace("/dashboard");
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Une erreur est survenue lors de l’inscription");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back-ios" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inscription</Text>
        <View style={{ width: 24 }} />
      </BlurView>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Créer un compte</Text>

        <TextInput
          style={styles.input}
          placeholder="Nom complet"
          placeholderTextColor="#92c992"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#92c992"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Téléphone"
          placeholderTextColor="#92c992"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#92c992"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmer mot de passe"
          placeholderTextColor="#92c992"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <View style={styles.checkboxContainer}>
          <Checkbox
            value={acceptCGU}
            onValueChange={setAcceptCGU}
            color={acceptCGU ? "#13ec13" : undefined}
          />
          <Text style={styles.checkboxText}>
            J’accepte les Conditions Générales
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, (!acceptCGU || isLoading) && { opacity: 0.6 }]}
          disabled={!acceptCGU || isLoading}
          onPress={handleRegister}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "Inscription..." : "S’inscrire"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/login")}>
          <Text style={styles.loginLink}>Déjà un compte ? Se connecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#102210",
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
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    color: "#fff",
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
    color: "#fff",
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  checkboxText: {
    color: "#94A3B8",
    marginLeft: 8,
  },
  button: {
    backgroundColor: "#13ec13",
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
    color: "#13ec13",
    textAlign: "center",
    fontWeight: "bold",
  },
});
