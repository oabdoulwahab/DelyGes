import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
import { Image } from "react-native";

import { useAuth } from "../src/hooks/useAuth";
import * as yup from "yup";
import { COLORS } from "../styles/colors";
import { loginStyles as styles } from "../styles/loginStyles";

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
    Alert.alert("Mot de passe oublié", "Veuillez contacter l'administrateur.");
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
            <Image
              source={require("../assets/images/splash-icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>
            Gérez vos livraisons et suivez vos revenus.
          </Text>
        </View>

        {/* ERREUR GLOBALE */}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialIcons
              name="error-outline"
              size={20}
              color={COLORS.danger}
            />
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
              colors={[COLORS.primary, "#11d111"]}
              style={styles.gradient}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <>
                  <Text style={styles.loginText}>Se connecter</Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={20}
                    color={COLORS.background}
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
