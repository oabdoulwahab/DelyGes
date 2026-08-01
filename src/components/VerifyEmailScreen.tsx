// src/components/VerifyEmailScreen.tsx
// Écran unique de vérification d'adresse email, réutilisé à la fois par la
// route app/verify-email.tsx et par la garde de navigation (app/_layout.tsx),
// afin d'éviter toute duplication de logique.
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { AccountDeletionService } from "../services/account-deletion.service";
import { COLORS } from "../../styles/colors";
import { verifyEmailStyles } from "../../styles/verifyEmailStyles";

const RESEND_COOLDOWN_SECONDS = 180;

type Message = { type: "success" | "error"; text: string } | null;

function getFriendlyError(error: unknown): string {
  const err = error as { code?: string; message?: string };
  const code = err?.code ?? "";
  const message = err?.message ?? "";

  if (
    code === "auth/network-request-failed" ||
    message.toLowerCase().includes("network request failed")
  ) {
    return "Une connexion Internet est nécessaire pour vérifier votre adresse email.";
  }

  if (code === "auth/too-many-requests") {
    return "Vous avez demandé trop d'emails de vérification. Veuillez patienter quelques instants avant de réessayer.";
  }

  if (message) {
    return message;
  }

  return "Une erreur est survenue. Veuillez réessayer.";
}

export default function VerifyEmailScreen() {
  const {
    firebaseUser,
    emailVerified,
    authReady,
    reloadUser,
    sendVerificationEmail,
    logout,
  } = useAuth();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<Message>(null);

  // Suppression de compte
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Compte à rebours du bouton "Renvoyer l'email" (anti-spam)
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown > 0]);

  // Si l'email est déjà vérifié, accéder directement au dashboard
  useEffect(() => {
    if (authReady && emailVerified) {
      router.replace("/dashboard");
    }
  }, [authReady, emailVerified]);

  if (!authReady) {
    return (
      <SafeAreaView style={verifyEmailStyles.container}>
        <View style={verifyEmailStyles.content}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!firebaseUser) {
    return (
      <SafeAreaView style={verifyEmailStyles.container}>
        <View style={verifyEmailStyles.notConnected}>
          <MaterialIcons name="error-outline" size={64} color={COLORS.danger} />
          <Text style={verifyEmailStyles.title}>Non connecté</Text>
          <Text style={verifyEmailStyles.subtitle}>
            Vous devez être connecté pour vérifier votre adresse email.
          </Text>
          <TouchableOpacity
            style={verifyEmailStyles.buttonPrimary}
            onPress={() => router.replace("/login")}
          >
            <Text style={verifyEmailStyles.buttonPrimaryText}>
              Se connecter
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleCheckVerification = async () => {
    if (checking) return;
    setChecking(true);
    setMessage(null);
    try {
      // Recharger l'utilisateur Firebase (jamais la valeur en cache)
      const verified = await reloadUser();
      if (verified) {
        router.replace("/dashboard");
      } else {
        setMessage({
          type: "error",
          text: "Votre adresse email n'est pas encore vérifiée. Vérifiez votre boîte de réception puis réessayez.",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: getFriendlyError(error) });
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    setMessage(null);
    try {
      await sendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({
        type: "success",
        text: "Un nouvel email de vérification a été envoyé.",
      });
    } catch (error) {
      setMessage({ type: "error", text: getFriendlyError(error) });
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      console.error("❌ Erreur déconnexion:", error);
      setMessage({
        type: "error",
        text: "Impossible de se déconnecter. Veuillez réessayer.",
      });
    }
  };

  const openDeleteModal = () => {
    if (!firebaseUser.email) {
      setMessage({
        type: "error",
        text: "Compte sans email, impossible de réauthentifier.",
      });
      return;
    }
    setDeletePassword("");
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletePassword.trim()) {
      setDeleteError("Le mot de passe est requis");
      return;
    }
    if (!firebaseUser.email) return;

    setShowDeleteModal(false);
    setIsDeleting(true);

    try {
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        deletePassword,
      );

      // Même flux sécurisé que Paramètres : réauthentification puis suppression
      await reauthenticateWithCredential(firebaseUser, credential);
      await AccountDeletionService.deleteAccount(firebaseUser.uid);

      await logout();
      router.replace("/register");
    } catch (error: unknown) {
      console.error("❌ Erreur suppression compte:", error);
      const err = error as { code?: string };
      if (err.code === "auth/wrong-password") {
        setMessage({ type: "error", text: "Mot de passe incorrect." });
      } else if (err.code === "auth/too-many-requests") {
        setMessage({
          type: "error",
          text: "Trop de tentatives. Réessayez plus tard.",
        });
      } else if (err.code === "auth/requires-recent-login") {
        setMessage({
          type: "error",
          text: "Session expirée. Veuillez vous reconnecter.",
        });
        await logout();
        router.replace("/login");
      } else {
        setMessage({
          type: "error",
          text: "Impossible de supprimer le compte.",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const isResendDisabled = resending || cooldown > 0;
  const resendLabel =
    cooldown > 0 ? `Renvoyer l'email (${cooldown}s)` : "Renvoyer l'email";

  return (
    <SafeAreaView style={verifyEmailStyles.container}>
      <View style={verifyEmailStyles.content}>
        <View style={verifyEmailStyles.iconWrapper}>
          <MaterialIcons
            name="mark-email-read"
            size={48}
            color={COLORS.primary}
          />
        </View>

        <Text style={verifyEmailStyles.title}>
          Vérifiez votre adresse email
        </Text>

        <Text style={verifyEmailStyles.subtitle}>
          Un email de vérification a été envoyé à votre adresse email.
        </Text>
        <Text style={verifyEmailStyles.emailText}>
          {firebaseUser.email || ""}
        </Text>
        <Text style={verifyEmailStyles.subtitle}>
          Consultez votre boîte de réception et cliquez sur le lien de
          vérification pour activer votre compte.
        </Text>

        {message && (
          <View
            style={[
              verifyEmailStyles.messageBox,
              message.type === "success"
                ? verifyEmailStyles.messageSuccess
                : verifyEmailStyles.messageError,
            ]}
          >
            <Text
              style={
                message.type === "success"
                  ? verifyEmailStyles.messageSuccessText
                  : verifyEmailStyles.messageErrorText
              }
            >
              {message.text}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            verifyEmailStyles.buttonPrimary,
            checking && verifyEmailStyles.buttonPrimaryDisabled,
          ]}
          onPress={handleCheckVerification}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={verifyEmailStyles.buttonPrimaryText}>
              J'ai vérifié mon email
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            verifyEmailStyles.buttonSecondary,
            isResendDisabled && verifyEmailStyles.buttonSecondaryDisabled,
          ]}
          onPress={handleResend}
          disabled={isResendDisabled}
        >
          {resending ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Text style={verifyEmailStyles.buttonSecondaryText}>
              {resendLabel}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={verifyEmailStyles.buttonLogout}
          onPress={handleLogout}
        >
          <Text style={verifyEmailStyles.buttonLogoutText}>
            Se déconnecter
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openDeleteModal}>
          <Text style={verifyEmailStyles.deleteLink}>
            Supprimer mon compte
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modale de confirmation de suppression */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={verifyEmailStyles.modalOverlay}>
          <View style={verifyEmailStyles.modalContent}>
            <Text style={verifyEmailStyles.modalTitle}>
              Supprimer le compte
            </Text>
            <Text style={verifyEmailStyles.modalMessage}>
              Pour supprimer votre compte, veuillez entrer votre mot de passe :
            </Text>

            {deleteError ? (
              <Text style={verifyEmailStyles.modalErrorText}>
                {deleteError}
              </Text>
            ) : null}

            <TextInput
              style={verifyEmailStyles.modalInput}
              placeholder="Mot de passe"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry
              value={deletePassword}
              onChangeText={(text) => {
                setDeletePassword(text);
                setDeleteError("");
              }}
              autoFocus
            />

            <View style={verifyEmailStyles.modalButtonsContainer}>
              <TouchableOpacity
                style={[
                  verifyEmailStyles.modalButton,
                  verifyEmailStyles.modalButtonCancel,
                ]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={verifyEmailStyles.modalButtonCancelText}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  verifyEmailStyles.modalButton,
                  verifyEmailStyles.modalButtonDanger,
                ]}
                onPress={confirmDelete}
              >
                <Text style={verifyEmailStyles.modalButtonDangerText}>
                  Continuer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Indicateur de chargement pendant la suppression */}
      {isDeleting && (
        <View style={verifyEmailStyles.loadingOverlay}>
          <View style={verifyEmailStyles.loadingContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={verifyEmailStyles.loadingText}>
              Suppression en cours...
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
