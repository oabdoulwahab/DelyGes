import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import Checkbox from "expo-checkbox";
import { LinearGradient } from "expo-linear-gradient";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// Import unique du nouveau Context
import { useAuth } from "../src/context/AuthContext"; 
import { COLORS } from "../styles/colors";
import { loginStyles } from "../styles/loginStyles";
import { useModal } from "../providers/ModalProvider";

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
  // isLoading et error doivent être gérés soit par le context soit localement
  // Ici, on ajoute une gestion locale simple pour la réactivité du bouton
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { showAlert } = useModal();

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

 
const onSubmit = async (data: LoginFormData) => {
  try {
    setLoading(true);
    setLoginError(null);
    await login(data.emailOrPhone, data.password);
    // Afficher une alerte de succès
    showAlert("Succès", "Vous êtes connecté !");
    router.replace("/dashboard");
  } catch (e: any) {
    setLoginError(e.message || "Identifiants incorrects");
  } finally {
    setLoading(false);
  }
};

  const handleForgotPassword = () => {
    router.push("/forgot-password");
  };

  return (
    <SafeAreaView style={loginStyles.container}>
      <ScrollView
        contentContainerStyle={loginStyles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={loginStyles.header}>
          <View style={loginStyles.logoBackground}>
            <Image
              source={require("../assets/images/splash-icon.png")}
              style={loginStyles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={loginStyles.title}>Connexion</Text>
          <Text style={loginStyles.subtitle}>
            Gérez vos livraisons et suivez vos revenus.
          </Text>
        </View>

        {/* ERREUR GLOBALE */}
        {loginError && (
          <View style={loginStyles.errorContainer}>
            <MaterialIcons
              name="error-outline"
              size={20}
              color={COLORS.danger}
            />
            <Text style={loginStyles.errorText}>{loginError}</Text>
          </View>
        )}

        {/* FORM */}
        <View style={loginStyles.form}>
          {/* EMAIL / PHONE */}
          <Controller
            control={control}
            name="emailOrPhone"
            render={({ field: { onChange, value } }) => (
              <View style={loginStyles.inputGroup}>
                <Text style={loginStyles.label}>Email ou téléphone</Text>
                <TextInput
                  style={loginStyles.input}
                  placeholder="email@exemple.com"
                  placeholderTextColor={COLORS.inputPlaceholder}
                  value={value}
                  onChangeText={(text) => {
                    onChange(text);
                    setLoginError(null);
                  }}
                  autoCapitalize="none"
                />
                {errors.emailOrPhone && (
                  <Text style={loginStyles.fieldError}>
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
              <View style={loginStyles.inputGroup}>
                <Text style={loginStyles.label}>Mot de passe</Text>
                <View style={loginStyles.passwordContainer}>
                  <TextInput
                    style={[loginStyles.input, loginStyles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.inputPlaceholder}
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      setLoginError(null);
                    }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={loginStyles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <MaterialIcons
                      name={showPassword ? "visibility-off" : "visibility"}
                      size={22}
                      color={COLORS.muted}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={loginStyles.fieldError}>
                    {errors.password.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* OPTIONS */}
          <View style={loginStyles.options}>
            <View style={loginStyles.remember}>
              <Checkbox
                value={false}
                color={COLORS.primary}
                style={loginStyles.checkbox}
              />
              <Text style={loginStyles.rememberText}>Rester connecté</Text>
            </View>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={loginStyles.forgot}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>

          {/* BUTTON */}
          <TouchableOpacity
            style={[
              loginStyles.loginButton,
              (!isValid || loading) && loginStyles.loginButtonDisabled,
            ]}
            disabled={!isValid || loading}
            onPress={handleSubmit(onSubmit)}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primary]}
              style={loginStyles.gradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={loginStyles.loginText}>Se connecter</Text>
                  <MaterialIcons
                    name="arrow-forward"
                    size={20}
                    color="#FFFFFF"
                  />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={loginStyles.footer}>
          <Text style={loginStyles.footerText}>Pas de compte ?</Text>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={loginStyles.footerLink}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}