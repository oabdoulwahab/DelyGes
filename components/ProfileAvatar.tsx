import { useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { db } from "../src/database/db";
import { useAuth } from "../src/context/AuthContext";
import { useModal } from "../providers/ModalProvider";
import { auth, db as firestore } from "../src/config/firebase";
import { doc, setDoc } from "firebase/firestore";
import { COLORS } from "../styles/colors";
import {
  uploadAvatarToR2,
  stripTimestamp,
  maskHost,
} from "../src/services/avatar.service";

interface ProfileAvatarProps {
  size?: number;
  initial: string;
  editable?: boolean;
  backgroundColor?: string;
}

async function persistPhotoUri(userId: number, uri: string | null) {
  await db.runAsync(
    "UPDATE user SET photo_uri = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [uri, userId],
  );
  const fbUser = auth.currentUser;
  if (fbUser) {
    try {
      // setDoc + merge: crée le document s'il n'existe pas encore
      // (updateDoc échouerait avec "No document to update").
      await setDoc(
        doc(firestore, "users", fbUser.uid),
        {
          photo_uri: uri,
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (e) {
      console.log("⚠️ Sync photo Firebase différée:", e);
    }
  }
}

export default function ProfileAvatar({
  size = 34,
  initial,
  editable = false,
  backgroundColor,
}: ProfileAvatarProps) {
  const { user, refreshUser } = useAuth();
  const { showModal, showError } = useModal();
  const [busy, setBusy] = useState(false);

  const radius = size / 2;
  const fontSize = Math.max(Math.round(size * 0.42), 12);
  const uri = user?.photo_uri || null;

  /**
   * Persiste une photo :
   * - pickedUri === null -> suppression (stocke NULL en DB).
   * - sinon -> upload R2 via Worker, puis persiste l'URL publique nettoyée.
   */
  const savePick = async (pickedUri: string | null) => {
    if (!user) {
      console.warn("[ProfileAvatar] savePick ignoré : user null");
      return;
    }
    setBusy(true);
    try {
      if (pickedUri === null) {
        console.log("[ProfileAvatar] Suppression de la photo de profil...");
        await persistPhotoUri(user.id, null);
        await refreshUser().catch((e) =>
          console.warn("[ProfileAvatar] refreshUser après suppression a échoué:", e)
        );
        return;
      }

      // Clé stable multi-appareils : firebase_uid de préférence,
      // sinon l'id SQLite local (mono-appareil uniquement).
      const remoteUserId = auth.currentUser?.uid ?? String(user.id);
      console.log(
        `[ProfileAvatar] Upload avatar local=${pickedUri} remoteUserId=${remoteUserId}`
      );

      const { publicUrl } = await uploadAvatarToR2(pickedUri, remoteUserId);
      const cleanUrl = stripTimestamp(publicUrl);
      console.log("[ProfileAvatar] Upload OK, persistance:", maskHost(cleanUrl));

      await persistPhotoUri(user.id, cleanUrl);
      await refreshUser().catch((e) =>
        console.warn("[ProfileAvatar] refreshUser après upload a échoué:", e)
      );
    } catch (e) {
      console.error("❌ [ProfileAvatar] Erreur photo profil:", e);
      showError(
        "Upload impossible",
        e instanceof Error ? e.message : "Impossible d'envoyer la photo"
      );
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        showError("Accès refusé", "Autorise l'accès à la galerie pour choisir une photo.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]?.uri) {
        console.log("[ProfileAvatar] Sélection galerie annulée");
        return;
      }
      console.log("[ProfileAvatar] Image galerie:", res.assets[0].uri);
      // savePick gère son propre setBusy : on relâche d'abord pour éviter
      // un état figé si savePick échoue avant son finally.
      setBusy(false);
      await savePick(res.assets[0].uri);
    } catch (e) {
      console.error("❌ [ProfileAvatar] pickFromLibrary:", e);
      showError("Erreur", "Impossible d'ouvrir la galerie");
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        showError("Accès refusé", "Autorise l'appareil photo pour prendre une photo.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]?.uri) {
        console.log("[ProfileAvatar] Capture caméra annulée");
        return;
      }
      console.log("[ProfileAvatar] Photo caméra:", res.assets[0].uri);
      setBusy(false);
      await savePick(res.assets[0].uri);
    } catch (e) {
      console.error("❌ [ProfileAvatar] takePhoto:", e);
      showError("Erreur", "Impossible d'ouvrir la caméra");
    } finally {
      setBusy(false);
    }
  };

  const openOptions = () => {
    if (!editable || busy) return;
    showModal({
      title: "Photo de profil",
      message: "Choisis une photo pour ton profil livreur.",
      type: "confirm",
      buttons: [
        { text: "Galerie", onPress: () => void pickFromLibrary() },
        { text: "Caméra", onPress: () => void takePhoto() },
        ...(uri
          ? [{ text: "Supprimer", style: "destructive" as const, onPress: () => void savePick(null) }]
          : []),
        { text: "Annuler", style: "cancel" },
      ],
    });
  };

  const content = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: backgroundColor || COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(0,168,89,0.25)",
        overflow: "hidden",
      }}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize, fontWeight: "800", color: "#FFFFFF" }}>
          {initial}
        </Text>
      )}
      {editable && !busy && (
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: Math.max(size * 0.32, 18),
            height: Math.max(size * 0.32, 18),
            borderRadius: Math.max(size * 0.16, 9),
            backgroundColor: COLORS.primaryDark,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }}
        >
          <MaterialIcons
            name="photo-camera"
            size={Math.max(size * 0.18, 11)}
            color="#FFFFFF"
          />
        </View>
      )}
    </View>
  );

  if (!editable) return content;

  return (
    <TouchableOpacity onPress={openOptions} activeOpacity={0.85} disabled={busy}>
      {content}
    </TouchableOpacity>
  );
}
