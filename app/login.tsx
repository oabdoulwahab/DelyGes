// app/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import Checkbox from 'expo-checkbox';
import { LinearGradient } from 'expo-linear-gradient';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

// Nouveaux imports
import { useAuth } from '../src/hooks/useAuth';
import { loginSchema } from '../src/utils/validators';
import { Validators } from '../src/utils/validators';
import { FormInput } from '../src/components/forms/FormInput';
// import { FormCheckbox } from '../src/components/forms/FormCheckbox';

type LoginFormData = {
  emailOrPhone: string;
  password: string;
  rememberMe: boolean;
};

export default function Login() {
  const { login, isLoading, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      emailOrPhone: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      await login(data.emailOrPhone, data.password, data.rememberMe);
      router.replace('/dashboard');
    } catch (error) {
      // L'erreur est déjà gérée dans le store
      console.error('Login error:', error);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Mot de passe oublié",
      "Veuillez contacter l'administrateur pour réinitialiser votre mot de passe.",
      [{ text: "OK" }]
    );
  };

  // Effacer l'erreur quand l'utilisateur commence à taper
  const handleInputChange = () => {
    if (error) {
      clearError();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

        {/* Message d'erreur global */}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Formulaire avec react-hook-form */}
        <View style={styles.form}>
          {/* Email/Téléphone */}
          <Controller
            control={control}
            name="emailOrPhone"
            render={({ field: { onChange, value, onBlur } }) => (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-mail ou Téléphone</Text>
                <View style={[
                  styles.inputContainer,
                  errors.emailOrPhone && styles.inputError
                ]}>
                  <View style={styles.inputIcon}>
                    <MaterialIcons 
                      name="mail" 
                      size={20} 
                      color={errors.emailOrPhone ? "#ef4444" : "#92c992"} 
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="chauffeur@exemple.com ou 06 12 34 56 78"
                    placeholderTextColor={errors.emailOrPhone ? "#ef4444" : "#92c992"}
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      handleInputChange();
                    }}
                    onBlur={onBlur}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
                {errors.emailOrPhone && (
                  <Text style={styles.fieldErrorText}>{errors.emailOrPhone.message}</Text>
                )}
              </View>
            )}
          />

          {/* Mot de passe */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value, onBlur } }) => (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <View style={[
                  styles.passwordContainer,
                  errors.password && styles.inputError
                ]}>
                  <View style={styles.inputIcon}>
                    <MaterialIcons 
                      name="lock" 
                      size={20} 
                      color={errors.password ? "#ef4444" : "#92c992"} 
                    />
                  </View>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor={errors.password ? "#ef4444" : "#92c992"}
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      handleInputChange();
                    }}
                    onBlur={onBlur}
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
                      size={20} 
                      color={errors.password ? "#ef4444" : "#92c992"} 
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.fieldErrorText}>{errors.password.message}</Text>
                )}
              </View>
            )}
          />

          {/* Options */}
          <Controller
            control={control}
            name="rememberMe"
            render={({ field: { onChange, value } }) => (
              <View style={styles.optionsContainer}>
                <View style={styles.rememberMeContainer}>
                  <Checkbox
                    style={[
                      styles.checkbox,
                      errors.rememberMe && styles.checkboxError
                    ]}
                    value={value}
                    onValueChange={onChange}
                    color={value ? "#13ec13" : undefined}
                    disabled={isLoading}
                  />
                  <Text style={styles.rememberMeText}>Rester connecté</Text>
                </View>
                
                <TouchableOpacity 
                  onPress={handleForgotPassword}
                  disabled={isLoading}
                >
                  <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          {/* Bouton de connexion */}
          <TouchableOpacity 
            style={[
              styles.loginButton, 
              (!isValid || isLoading) && styles.loginButtonDisabled
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isLoading}
          >
            <LinearGradient
              colors={['#13ec13', '#11d111']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#102210" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Se connecter</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#102210" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Séparateur */}
        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>ou</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Lien d'inscription */}
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>
            Vous n'avez pas de compte ?{' '}
          </Text>
          <TouchableOpacity 
            onPress={() => router.push("/register")}
            disabled={isLoading}
          >
            <Text style={styles.signupLink}>Créer un compte</Text>
          </TouchableOpacity>
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
    maxWidth: 300,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ef4444',
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
  inputError: {
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
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
  fieldErrorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
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
  checkboxError: {
    borderColor: '#ef4444',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#193319',
  },
  separatorText: {
    paddingHorizontal: 16,
    color: '#94A3B8',
    fontSize: 14,
  },
  signupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  signupText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  signupLink: {
    color: '#13ec13',
    fontWeight: 'bold',
    fontSize: 14,
  },
});