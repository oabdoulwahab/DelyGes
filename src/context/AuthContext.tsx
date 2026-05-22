// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { db as sqliteDb } from "../database/db";
import { auth, db as firestore } from "../config/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { syncService } from "../services/sync.service";
import { addFirebaseColumns } from "../database/migrations/add_firebase_columns";
import { User } from "../types";

const USER_KEY = "AUTH_USER_ID";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({
  children,
  isDbReady,
}: {
  children: React.ReactNode;
  isDbReady: boolean;
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // 1. Écouter les changements d'état Firebase
  useEffect(() => {
    console.log("👂 Mise en place de l'écoute Firebase...");

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log(
        "🔥 Firebase auth changed:",
        fbUser ? fbUser.uid : "déconnecté",
      );
      setFirebaseUser(fbUser);

      if (fbUser && isDbReady) {
        // Charger l'utilisateur depuis SQLite
        await loadLocalUser(fbUser.uid);
      } else if (!fbUser) {
        // Déconnexion
        console.log("👋 Utilisateur déconnecté");
        setUser(null);
        setIsAuthenticated(false);
        await SecureStore.deleteItemAsync(USER_KEY);
      }

      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [isDbReady]);

  // 2. Charger l'utilisateur local

const loadLocalUser = async (firebaseUid: string) => {
  try {
    console.log("📦 Chargement utilisateur local...");

    let localUser = await sqliteDb.getFirstAsync<User>(
      "SELECT * FROM user WHERE firebase_uid = ?",
      [firebaseUid],
    );

    if (!localUser) {
      console.log("🆕 Création utilisateur local...");
      const fbUser = auth.currentUser;

      if (fbUser) {
        await sqliteDb.runAsync(
          "DELETE FROM user WHERE firebase_uid = ?",
          [firebaseUid],
        );

        const result = await sqliteDb.runAsync(
          `INSERT INTO user (name, email, phone, firebase_uid, password, created_at, daily_goal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            fbUser.displayName || "Livreur",
            fbUser.email || "",
            fbUser.phoneNumber || "",
            firebaseUid,
            "firebase_managed",
            new Date().toISOString(),
            15000,
          ],
        );

        localUser = await sqliteDb.getFirstAsync<User>(
          "SELECT * FROM user WHERE id = ?",
          [result.lastInsertRowId],
        );
      }
    }

    if (localUser) {
      console.log("✅ Utilisateur local chargé:", localUser.name);
      setUser(localUser);
      setIsAuthenticated(true);
      await SecureStore.setItemAsync(USER_KEY, String(localUser.id));

      // Synchroniser les données après connexion (seulement si pas de données locales)
      const localDeliveryCount = await sqliteDb.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM deliveries WHERE user_id = ?",
        [localUser.id],
      );

      if (!localDeliveryCount || localDeliveryCount.count === 0) {
        setLoadingMessage("Synchronisation des données...");
        await syncService.importFromFirebase();
      } else {
        console.log(`📦 ${localDeliveryCount.count} livraisons locales existantes, import ignoré`);
      }
    }
  } catch (error) {
    console.error("❌ Erreur chargement utilisateur local:", error);
  }
};

  // 3. Vérification initiale
  const checkAuth = async () => {
    if (!isDbReady) return;

    try {
      console.log("🔍 Vérification session...");

      // Ajouter les colonnes Firebase si nécessaire
      await addFirebaseColumns();

      const localUserId = await SecureStore.getItemAsync(USER_KEY);

      if (localUserId) {
        const localUser = await sqliteDb.getFirstAsync<User>(
          "SELECT * FROM user WHERE id = ?",
          [Number(localUserId)],
        );

        if (localUser?.firebase_uid) {
          console.log("👤 Session locale trouvée pour:", localUser.name);
          setUser(localUser);
          setIsAuthenticated(true);
        } else {
          await SecureStore.deleteItemAsync(USER_KEY);
        }
      }
    } catch (error) {
      console.error("❌ Erreur checkAuth:", error);
    }
  };

  // 3.5 Rafraîchir l'utilisateur depuis SQLite
  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      const refreshed = await sqliteDb.getFirstAsync<User>(
        "SELECT * FROM user WHERE id = ?",
        [user.id],
      );
      if (refreshed) {
        setUser(refreshed);
      }
    } catch (error) {
      console.error("❌ Erreur refreshUser:", error);
    }
  }, [user?.id]);

  // 4. Connexion
  const login = async (email: string, password: string) => {
    try {
      console.log("🔐 Tentative de connexion...");

      // Connexion à Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const fbUser = userCredential.user;

      console.log("✅ Connecté à Firebase:", fbUser.uid);

      // Le reste est géré par onAuthStateChanged
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error("❌ Erreur login:", err.code, err.message);

      // Traduire les erreurs Firebase
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        throw new Error("Email ou mot de passe incorrect");
      } else if (err.code === "auth/invalid-email") {
        throw new Error("Email invalide");
      } else if (err.code === "auth/too-many-requests") {
        throw new Error("Trop de tentatives. Réessayez plus tard");
      } else if (err.code === "auth/invalid-credential") {
        throw new Error("Email ou mot de passe incorrect");
      } else {
        throw new Error("Erreur de connexion");
      }
    }
  };

  // 5. Inscription
  const register = async (data: RegisterData) => {
    try {
      console.log("📝 Tentative d'inscription...");

      // 1. Vérifier d'abord si le téléphone existe déjà dans SQLite
      const existingPhone = await sqliteDb.getFirstAsync<{ id: number }>(
        "SELECT id FROM user WHERE phone = ?",
        [data.phone],
      );

      if (existingPhone) {
        throw new Error("Ce téléphone est déjà utilisé");
      }

      // 2. Créer l'utilisateur Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
      );
      const fbUser = userCredential.user;

      console.log("✅ Compte Firebase créé:", fbUser.uid);

      // 3. Mettre à jour le profil avec le nom
      await updateProfile(fbUser, {
        displayName: data.name,
      });

      // 4. Créer le document utilisateur dans Firestore
      await setDoc(doc(firestore, "users", fbUser.uid), {
        name: data.name,
        email: data.email,
        phone: data.phone,
        created_at: new Date().toISOString(),
        monthly_goal: 250000,
        daily_goal: 15000,
      });

      console.log("✅ Document Firestore créé");

      // 5. ✅ CRÉER L'UTILISATEUR DANS SQLITE IMMÉDIATEMENT
      console.log("📦 Création utilisateur dans SQLite...");

      // Supprimer tout utilisateur existant avec le même firebase_uid (au cas où)
      await sqliteDb.runAsync("DELETE FROM user WHERE firebase_uid = ?", [
        fbUser.uid,
      ]);

      // Insérer le nouvel utilisateur
      const result = await sqliteDb.runAsync(
        `INSERT INTO user 
       (name, email, phone, firebase_uid, password, created_at, daily_goal) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.email,
          data.phone,
          fbUser.uid,
          "firebase_managed",
          new Date().toISOString(),
          15000,
        ],
      );

      console.log(
        "✅ Utilisateur SQLite créé avec ID:",
        result.lastInsertRowId,
      );

      // 6. Récupérer l'utilisateur créé
      const newLocalUser = await sqliteDb.getFirstAsync<User>(
        "SELECT * FROM user WHERE id = ?",
        [result.lastInsertRowId],
      );

      // 7. Mettre à jour le state
      setUser(newLocalUser);
      setIsAuthenticated(true);
      await SecureStore.setItemAsync(USER_KEY, String(newLocalUser!.id));
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error("❌ Erreur inscription:", err.code, err.message);

      // Si Firebase Auth a réussi mais que SQLite a échoué, nettoyer Firebase
      if (
        err.code !== "auth/email-already-in-use" &&
        err.code !== "auth/weak-password"
      ) {
        try {
          const currentUser = auth.currentUser;
          if (currentUser) {
            await currentUser.delete();
            console.log("✅ Compte Firebase nettoyé après erreur SQLite");
          }
        } catch (cleanupError) {
          console.error("❌ Erreur nettoyage Firebase:", cleanupError);
        }
      }

      // Traduire les erreurs Firebase
      if (err.code === "auth/email-already-in-use") {
        throw new Error("Cet email est déjà utilisé");
      } else if (err.code === "auth/invalid-email") {
        throw new Error("Email invalide");
      } else if (err.code === "auth/weak-password") {
        throw new Error("Mot de passe trop faible (minimum 6 caractères)");
      } else if (err.message && err.message.includes("téléphone est déjà utilisé")) {
        throw new Error("Ce téléphone est déjà utilisé");
      } else {
        throw new Error(err.message || "Erreur d'inscription");
      }
    }
  };

  // 6. Déconnexion
  const logout = async () => {
    try {
      console.log("🚪 Déconnexion...");
      await signOut(auth);
      // Le nettoyage est géré par onAuthStateChanged
    } catch (error) {
      console.error("❌ Erreur logout:", error);
      throw error;
    }
  };

  useEffect(() => {
    if (isDbReady) {
      checkAuth();
    }
  }, [isDbReady]);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isAuthenticated,
        authReady,
        login,
        register,
        logout,
        checkAuth,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return context;
};
function setLoadingMessage(message: string) {
  console.log("⏳", message);
}

