import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Image } from "react-native";
import { BlurView } from "expo-blur";

import { db } from "../src/database/db";
import * as yup from "yup";
import { COLORS } from "../styles/colors";
import { forgotPasswordStyles } from "../styles/forgotPasswordStyles";
import { useModal } from "../providers/ModalProvider";

/* ---------------- VALIDATION ---------------- */

const forgotPasswordSchema = yup.object({
  emailOrPhone: yup.string().required("Email ou téléphone requis"),
});

type ForgotPasswordFormData = {
  emailOrPhone: string;
};

/* ---------------- SCREEN ---------------- */

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"request" | "success">("request");
  const { showAlert, showSuccess, showError } = useModal();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: {
      emailOrPhone: "",
    },
    mode: "onChange",
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);

    try {
      // Vérifier si l'utilisateur existe
      const user = await db.getFirstAsync<any>(
        "SELECT id, name, email, phone FROM user WHERE email = ? OR phone = ?",
        [data.emailOrPhone, data.emailOrPhone]
      );

      if (!user) {
        showError(
          "Compte introuvable",
          "Aucun compte ne correspond à cet email ou téléphone."
        );
        return;
      }

      // Simuler l'envoi d'un email (dans une vraie app, vous appelleriez une API)
      console.log("🔐 Réinitialisation demandée pour:", user);

      // Passer à l'écran de succès
      setStep("success");
      
    } catch (error) {
      console.error("❌ Erreur:", error);
      showError(
        "Erreur",
        "Une erreur est survenue. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleGoToLogin = () => {
    router.push("/login");
  };

  if (step === "success") {
    return (
      <SafeAreaView style={forgotPasswordStyles.container}>
        <BlurView intensity={95} style={forgotPasswordStyles.header}>
          <TouchableOpacity onPress={handleBack} style={forgotPasswordStyles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={forgotPasswordStyles.headerTitle}>Mot de passe oublié</Text>
          <View style={{ width: 40 }} />
        </BlurView>

        <ScrollView
          contentContainerStyle={forgotPasswordStyles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={forgotPasswordStyles.successContainer}>
            <View style={forgotPasswordStyles.successIconContainer}>
              <MaterialIcons name="mark-email-read" size={64} color={COLORS.primary} />
            </View>
            
            <Text style={forgotPasswordStyles.successTitle}>Email envoyé !</Text>
            
            <Text style={forgotPasswordStyles.successMessage}>
              Si un compte existe avec ces informations, vous recevrez un email avec les instructions pour réinitialiser votre mot de passe.
            </Text>

            <View style={forgotPasswordStyles.successInfoBox}>
              <MaterialIcons name="info-outline" size={20} color={COLORS.muted} />
              <Text style={forgotPasswordStyles.successInfoText}>
              Vérifiez votre boîte de réception et vos spams.
              </Text>
            </View>

            <TouchableOpacity
              style={forgotPasswordStyles.successButton}
              onPress={handleGoToLogin}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primary]}
                style={forgotPasswordStyles.successButtonGradient}
              >
                <Text style={forgotPasswordStyles.successButtonText}>
                  Retour à la connexion
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={forgotPasswordStyles.container}>
      <BlurView intensity={95} style={forgotPasswordStyles.header}>
        <TouchableOpacity onPress={handleBack} style={forgotPasswordStyles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={forgotPasswordStyles.headerTitle}>Mot de passe oublié</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <ScrollView
        contentContainerStyle={forgotPasswordStyles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={forgotPasswordStyles.header}>
          <View style={forgotPasswordStyles.logoBackground}>
            <Image
              source={require("../assets/images/splash-icon.png")}
              style={forgotPasswordStyles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={forgotPasswordStyles.title}>Mot de passe oublié ?</Text>
          <Text style={forgotPasswordStyles.subtitle}>
            Saisissez votre email ou numéro de téléphone pour recevoir les instructions de réinitialisation.
          </Text>
        </View>

        {/* FORM */}
        <View style={forgotPasswordStyles.form}>
          {/* EMAIL / PHONE */}
          <Controller
            control={control}
            name="emailOrPhone"
            render={({ field: { onChange, value } }) => (
              <View style={forgotPasswordStyles.inputGroup}>
                <Text style={forgotPasswordStyles.label}>Email ou téléphone</Text>
                <TextInput
                  style={[
                    forgotPasswordStyles.input,
                    errors.emailOrPhone && forgotPasswordStyles.inputError,
                  ]}
                  placeholder="email@exemple.com ou 06 12 34 56 78"
                  placeholderTextColor={COLORS.inputPlaceholder}
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {errors.emailOrPhone && (
                  <Text style={forgotPasswordStyles.fieldError}>
                    {errors.emailOrPhone.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* INFO BOX */}
          <View style={forgotPasswordStyles.infoBox}>
            <MaterialIcons name="info-outline" size={20} color={COLORS.muted} />
            <Text style={forgotPasswordStyles.infoText}>
              Vous recevrez un email avec un lien pour réinitialiser votre mot de passe.
            </Text>
          </View>

          {/* BUTTON */}
          <TouchableOpacity
            style={[
              forgotPasswordStyles.resetButton,
              (!isValid || isLoading) && forgotPasswordStyles.resetButtonDisabled,
            ]}
            disabled={!isValid || isLoading}
            onPress={handleSubmit(onSubmit)}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primary]}
              style={forgotPasswordStyles.resetButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={forgotPasswordStyles.resetButtonText}>
                    Envoyer les instructions
                  </Text>
                  <MaterialIcons
                    name="send"
                    size={20}
                    color="#FFFFFF"
                  />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* BACK TO LOGIN */}
          <TouchableOpacity
            style={forgotPasswordStyles.backToLogin}
            onPress={handleGoToLogin}
          >
            <MaterialIcons name="arrow-back" size={16} color={COLORS.primary} />
            <Text style={forgotPasswordStyles.backToLoginText}>
              Retour à la connexion
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}