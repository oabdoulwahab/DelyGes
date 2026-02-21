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
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { db } from "../src/database/db";
import { User } from "../src/types";
import { COLORS } from "../styles/colors";
import { registerStyles } from "../styles/registerStyles";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert("Erreur", "Le nom complet est obligatoire");
      return;
    }

    if (!email.trim()) {
      Alert.alert("Erreur", "L'email est obligatoire");
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
        "Vous devez accepter les Conditions Générales d'Utilisation",
      );
      return;
    }

    setIsLoading(true);

    try {
      // ✅ Vérifier si l'email existe déjà
      const existingUser = await db.getFirstAsync(
        "SELECT id FROM user WHERE email = ?",
        [email.trim().toLowerCase()],
      );

      if (existingUser) {
        Alert.alert("Erreur", "Vous avez déjà un compte");
        return;
      }

      // ⚠️ Pour l'instant mot de passe en clair (OK pour MVP)
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
      Alert.alert("Erreur", "Une erreur est survenue lors de l'inscription");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={registerStyles.container}>
      <BlurView intensity={95} style={registerStyles.header}>
        <TouchableOpacity onPress={() => router.back()} style={registerStyles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={registerStyles.headerTitle}>Inscription</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <ScrollView 
        contentContainerStyle={registerStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={registerStyles.title}>Créer un compte</Text>

        {/* Nom complet */}
        <View style={registerStyles.inputGroup}>
          <Text style={registerStyles.label}>Nom complet</Text>
          <TextInput
            style={registerStyles.input}
            placeholder="Jean Dupont"
            placeholderTextColor={COLORS.inputPlaceholder}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Email */}
        <View style={registerStyles.inputGroup}>
          <Text style={registerStyles.label}>Email</Text>
          <TextInput
            style={registerStyles.input}
            placeholder="email@exemple.com"
            placeholderTextColor={COLORS.inputPlaceholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        {/* Téléphone */}
        <View style={registerStyles.inputGroup}>
          <Text style={registerStyles.label}>Téléphone</Text>
          <TextInput
            style={registerStyles.input}
            placeholder="06 12 34 56 78"
            placeholderTextColor={COLORS.inputPlaceholder}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Mot de passe */}
        <View style={registerStyles.inputGroup}>
          <Text style={registerStyles.label}>Mot de passe</Text>
          <View style={registerStyles.passwordContainer}>
            <TextInput
              style={[registerStyles.input, registerStyles.passwordInput]}
              placeholder="••••••••"
              placeholderTextColor={COLORS.inputPlaceholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={registerStyles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <MaterialIcons
                name={showPassword ? "visibility-off" : "visibility"}
                size={22}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirmer mot de passe */}
        <View style={registerStyles.inputGroup}>
          <Text style={registerStyles.label}>Confirmer le mot de passe</Text>
          <View style={registerStyles.passwordContainer}>
            <TextInput
              style={[registerStyles.input, registerStyles.passwordInput]}
              placeholder="••••••••"
              placeholderTextColor={COLORS.inputPlaceholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={registerStyles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <MaterialIcons
                name={showConfirmPassword ? "visibility-off" : "visibility"}
                size={22}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* CGU */}
        <View style={registerStyles.checkboxContainer}>
          <Checkbox
            value={acceptCGU}
            onValueChange={setAcceptCGU}
            color={acceptCGU ? COLORS.primary : COLORS.borderLight}
            style={registerStyles.checkbox}
          />
          <Text style={registerStyles.checkboxText}>
            J'accepte les Conditions Générales d'Utilisation
          </Text>
        </View>

        {/* Bouton d'inscription */}
        <TouchableOpacity
          style={[
            registerStyles.button,
            (!acceptCGU || isLoading) && registerStyles.buttonDisabled,
          ]}
          disabled={!acceptCGU || isLoading}
          onPress={handleRegister}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={registerStyles.buttonText}>S'inscrire</Text>
          )}
        </TouchableOpacity>

        {/* Lien vers connexion */}
        <TouchableOpacity onPress={() => router.push("/login")}>
          <Text style={registerStyles.loginLink}>
            Déjà un compte ? Se connecter
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}