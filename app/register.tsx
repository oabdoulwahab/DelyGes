import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, SafeAreaView } from "react-native";
import { useState } from "react"; // Supprimer useEffect
import { router } from "expo-router";
import { db } from "../src/database/db";
import { MaterialIcons } from "@expo/vector-icons";
import Checkbox from 'expo-checkbox';
import { BlurView } from 'expo-blur';

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  

  const handleRegister = async () => {
    // Validation
    if (!fullName.trim()) {
      Alert.alert("Erreur", "Le nom complet est obligatoire");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Erreur", "Le téléphone est obligatoire");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Erreur", "Le mot de passe est obligatoire");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    if (!acceptCGU) {
      Alert.alert("Erreur", "Vous devez accepter les Conditions Générales d'Utilisation");
      return;
    }

    setIsLoading(true);

    try {
      // Vérifier d'abord si un utilisateur existe déjà
      const existingUsers = await db.getAllAsync("SELECT * FROM user LIMIT 1");
      if (existingUsers.length > 0) {
        Alert.alert(
          "Information", 
          "Un compte existe déjà. Veuillez vous connecter.",
          [{ text: "OK", onPress: () => router.push("/login") }]
        );
        return;
      }

      // Hash du mot de passe (dans une vraie app, utiliser bcrypt ou équivalent)
      const hashedPassword = password; // À remplacer par un vrai hash

      await db.runAsync(
        "INSERT INTO user (name, phone, email, password, created_at) VALUES (?, ?, ?, ?, ?)",
        [fullName, phone, email, hashedPassword, new Date().toISOString()]
      );

      Alert.alert("Succès", "Inscription réussie !", [
        { 
          text: "OK", 
          onPress: () => {
            // La redirection sera gérée par le système d'authentification
            router.replace("/dashboard");
          }
        }
      ]);
    } catch (error) {
      Alert.alert("Erreur", "Une erreur est survenue lors de l'inscription");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Formatage simple du numéro de téléphone français
    let cleaned = text.replace(/\D/g, '');
    
    if (cleaned.length > 0) {
      cleaned = cleaned.substring(0, 10);
      
      if (cleaned.length <= 2) {
        return cleaned;
      } else if (cleaned.length <= 4) {
        return cleaned.replace(/(\d{2})/, '$1 ');
      } else if (cleaned.length <= 6) {
        return cleaned.replace(/(\d{2})(\d{2})/, '$1 $2 ');
      } else if (cleaned.length <= 8) {
        return cleaned.replace(/(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 ');
      } else {
        return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
      }
    }
    
    return text;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhone(formatted);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête avec effet flou */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <MaterialIcons name="arrow-back-ios" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Inscription</Text>
        
        {/* Espace pour centrer le titre */}
        <View style={styles.headerSpacer} />
      </BlurView>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Titre et description */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Créer un compte</Text>
          <Text style={styles.subtitle}>
            Rejoignez la plateforme de gestion pour livreurs indépendants.
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Nom complet */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nom complet</Text>
            <TextInput
              style={styles.input}
              placeholder="Jean Dupont"
              placeholderTextColor="#92c992"
              value={fullName}
              onChangeText={setFullName}
              editable={!isLoading}
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="jean.dupont@email.com"
              placeholderTextColor="#92c992"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          {/* Téléphone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="+33 6 12 34 56 78"
              placeholderTextColor="#92c992"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
          </View>

          {/* Mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mot de passe</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#92c992"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity 
                style={styles.visibilityButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#94A3B8" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirmation mot de passe */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirmation du mot de passe</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#92c992"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading}
              />
              <TouchableOpacity 
                style={styles.visibilityButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                <MaterialIcons 
                  name={showConfirmPassword ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#94A3B8" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Checkbox CGU */}
          <View style={styles.checkboxContainer}>
            <Checkbox
              style={styles.checkbox}
              value={acceptCGU}
              onValueChange={setAcceptCGU}
              color={acceptCGU ? "#13ec13" : undefined}
              disabled={isLoading}
            />
            <Text style={styles.checkboxLabel}>
              J'accepte les{' '}
              <Text style={styles.checkboxLink}>Conditions Générales d'Utilisation</Text>
            </Text>
          </View>

          {/* Bouton d'inscription */}
          <TouchableOpacity 
            style={[
              styles.registerButton, 
              (!acceptCGU || isLoading) && styles.registerButtonDisabled
            ]}
            onPress={handleRegister}
            disabled={!acceptCGU || isLoading}
          >
            <Text style={styles.registerButtonText}>
              {isLoading ? "Inscription..." : "S'inscrire"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lien de connexion */}
        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginLinkText}>
            Déjà un compte ?{' '}
            <Text 
              style={styles.loginLink}
              onPress={() => !isLoading && router.push("./login")}
            >
              Se connecter
            </Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#102210',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    paddingRight: 48, // Pour compenser l'espace du bouton retour
  },
  headerSpacer: {
    width: 48,
  },
  content: {
    flex: 1,
    marginTop: 124, // Pour l'en-tête fixe
  },
  scrollContent: {
    paddingBottom: 40,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 22,
  },
  form: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#193319',
    borderWidth: 1,
    borderColor: '#326732',
    borderRadius: 28,
    height: 56,
    paddingHorizontal: 24,
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
    right: 20,
    top: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  checkbox: {
    width: 20,
    height: 20,
    marginRight: 12,
    borderColor: '#326732',
    backgroundColor: '#193319',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    flex: 1,
  },
  checkboxLink: {
    color: '#13ec13',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  registerButton: {
    backgroundColor: '#13ec13',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#13ec13',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonDisabled: {
    backgroundColor: '#326732',
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  loginLinkContainer: {
    marginTop: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  loginLink: {
    color: '#13ec13',
    fontWeight: 'bold',
  },
});