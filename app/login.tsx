// app/login.tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, SafeAreaView } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { db } from "../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import Checkbox from 'expo-checkbox';
import { LinearGradient } from 'expo-linear-gradient';

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!emailOrPhone.trim() || !password.trim()) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }

    setIsLoading(true);

    try {
      // Recherche de l'utilisateur par email ou téléphone
      const result = await db.getFirstAsync<{ id: number; name: string; password: string }>(
        "SELECT id, name, password FROM user WHERE email = ? OR phone = ?",
        [emailOrPhone, emailOrPhone]
      );

      if (!result) {
        Alert.alert("Erreur", "Identifiants incorrects");
        setIsLoading(false);
        return;
      }

      // Vérification du mot de passe (dans une vraie app, utiliser bcrypt.compare)
      if (password !== result.password) {
        Alert.alert("Erreur", "Mot de passe incorrect");
        setIsLoading(false);
        return;
      }

      // Succès de la connexion
      Alert.alert("Succès", `Bienvenue ${result.name} !`, [
        { 
          text: "OK", 
          onPress: () => router.replace("/dashboard") 
        }
      ]);

    } catch (error) {
      Alert.alert("Erreur", "Une erreur est survenue lors de la connexion");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Mot de passe oublié",
      "Une fonctionnalité de réinitialisation de mot de passe sera bientôt disponible.",
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo et titre */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <MaterialIcons name="local-shipping" size={32} color="#13ec13" />
            </View>
          </View>
          
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>
            Suivez vos revenus et gérez vos livraisons.
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Email/Téléphone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-mail ou Téléphone</Text>
            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <MaterialIcons name="mail" size={20} color="#92c992" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="chauffeur@exemple.com"
                placeholderTextColor="#92c992"
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mot de passe</Text>
            <View style={styles.passwordContainer}>
              <View style={styles.inputIcon}>
                <MaterialIcons name="lock" size={20} color="#92c992" />
              </View>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#92c992"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity 
                style={styles.visibilityButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility-off" : "visibility"} 
                  size={20} 
                  color="#92c992" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            <View style={styles.rememberMeContainer}>
              <Checkbox
                style={styles.checkbox}
                value={rememberMe}
                onValueChange={setRememberMe}
                color={rememberMe ? "#13ec13" : undefined}
              />
              <Text style={styles.rememberMeText}>Rester connecté</Text>
            </View>
            
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>

          {/* Bouton de connexion */}
          <TouchableOpacity 
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <LinearGradient
              colors={['#13ec13', '#11d111']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? "Connexion..." : "Se connecter"}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color="#102210" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Séparateur */}
        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
        </View>

        {/* Lien d'inscription */}
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>
            Vous n'avez pas de compte ?{' '}
            <Text 
              style={styles.signupLink}
              onPress={() => router.push("/register")}
            >
              Créer un compte
            </Text>
          </Text>
        </View>
      </ScrollView>

      {/* Ligne décorative en bas */}
      <LinearGradient
        colors={['transparent', 'rgba(19, 236, 19, 0.5)', 'transparent']}
        style={styles.bottomLine}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#102210',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoBackground: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(19, 236, 19, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(19, 236, 19, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#13ec13',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  inputContainer: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: 18,
    zIndex: 1,
  },
  input: {
    backgroundColor: '#193319',
    borderWidth: 1,
    borderColor: '#326732',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 52,
    fontSize: 16,
    color: '#FFFFFF',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 60,
  },
  visibilityButton: {
    position: 'absolute',
    right: 16,
    top: 18,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#193319',
    borderLeftWidth: 1,
    borderLeftColor: '#326732',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#326732',
    backgroundColor: '#193319',
    borderRadius: 4,
  },
  rememberMeText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#13ec13',
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 32,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#102210',
  },
  separatorContainer: {
    marginBottom: 32,
  },
  separatorLine: {
    height: 1,
    backgroundColor: '#193319',
    width: '100%',
  },
  signupContainer: {
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  signupLink: {
    color: '#13ec13',
    fontWeight: 'bold',
  },
  bottomLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.2,
  },
});