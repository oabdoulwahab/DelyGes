// app/login.tsx
import React, { useState } from "react";
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
import Checkbox from "expo-checkbox";
import { LinearGradient } from "expo-linear-gradient";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import { useAuth } from "../src/hooks/useAuth";
import * as yup from "yup";

/* ---------------- VALIDATION ---------------- */

const loginSchema = yup.object({
  emailOrPhone: yup.string().required("Email ou téléphone requis"),
  password: yup.string().required("Mot de passe requis"),
  rememberMe: yup.boolean().required(),
});

type LoginFormData = {
  emailOrPhone: string;
  password: string;
  rememberMe: boolean;
};

/* ---------------- SCREEN ---------------- */

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
      emailOrPhone: "",
      password: "",
      rememberMe: false,
    },
    mode: "onChange",
  });

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      clearError();
      await login(data.emailOrPhone, data.password);
      router.replace("/dashboard");
    } catch (e) {
      // erreur déjà gérée dans useAuth
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      "Mot de passe oublié",
      "Veuillez contacter l’administrateur."
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.logoBackground}>
            <MaterialIcons name="local-shipping" size={32} color="#13ec13" />
          </View>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>
            Gérez vos livraisons et suivez vos revenus.
          </Text>
        </View>

        {/* ERREUR GLOBALE */}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* FORM */}
        <View style={styles.form}>
          {/* EMAIL / PHONE */}
          <Controller
            control={control}
            name="emailOrPhone"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email ou téléphone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemple.com"
                  placeholderTextColor="#92c992"
                  value={value}
                  onChangeText={(text) => {
                    onChange(text);
                    clearError();
                  }}
                  autoCapitalize="none"
                />
                {errors.emailOrPhone && (
                  <Text style={styles.fieldError}>
                    {errors.emailOrPhone.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* PASSWORD */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor="#92c992"
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      clearError();
                    }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <MaterialIcons
                      name={showPassword ? "visibility-off" : "visibility"}
                      size={22}
                      color="#92c992"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.fieldError}>
                    {errors.password.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* OPTIONS */}
          <View style={styles.options}>
            <View style={styles.remember}>
              <Checkbox disabled />
              <Text style={styles.rememberText}>Rester connecté</Text>
            </View>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgot}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>

          {/* BUTTON */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              (!isValid || isLoading) && { opacity: 0.6 },
            ]}
            disabled={!isValid || isLoading}
            onPress={handleSubmit(onSubmit)}
          >
            <LinearGradient
              colors={["#13ec13", "#11d111"]}
              style={styles.gradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#102210" />
              ) : (
                <>
                  <Text style={styles.loginText}>Se connecter</Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={20}
                    color="#102210"
                  />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Pas de compte ?</Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.footerLink}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#102210",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoBackground: {
    width: 64,
    height: 64,
    backgroundColor: "rgba(19,236,19,0.1)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },
  subtitle: {
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 6,
  },
  errorContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(239,68,68,0.15)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: "#ef4444",
    flex: 1,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: "#fff",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#193319",
    borderColor: "#326732",
    borderWidth: 1,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: "#fff",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 16,
  },
  fieldError: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  remember: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rememberText: {
    color: "#94A3B8",
  },
  forgot: {
    color: "#13ec13",
  },
  loginButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  gradient: {
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  loginText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#102210",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    color: "#94A3B8",
  },
  footerLink: {
    color: "#13ec13",
    fontWeight: "bold",
  },
});
