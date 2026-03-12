// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { db as sqliteDb } from "../database/db";
import { auth, db as firestore } from '../config/firebase';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { syncService } from '../services/sync.service';
import { addFirebaseColumns } from '../database/migrations/add_firebase_columns';

const USER_KEY = "AUTH_USER_ID";

interface AuthContextType {
  user: any;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children, isDbReady }: { children: React.ReactNode; isDbReady: boolean }) => {
  const [user, setUser] = useState<any>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // 1. Écouter les changements d'état Firebase
  useEffect(() => {
    console.log('👂 Mise en place de l\'écoute Firebase...');
    
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log('🔥 Firebase auth changed:', fbUser ? fbUser.uid : 'déconnecté');
      setFirebaseUser(fbUser);
      
      if (fbUser && isDbReady) {
        // Charger l'utilisateur depuis SQLite
        await loadLocalUser(fbUser.uid);
      } else if (!fbUser) {
        // Déconnexion
        console.log('👋 Utilisateur déconnecté');
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
      console.log('📦 Chargement utilisateur local...');
      
      let localUser = await sqliteDb.getFirstAsync<any>(
        "SELECT * FROM user WHERE firebase_uid = ?",
        [firebaseUid]
      );

      if (!localUser) {
        // Premier démarrage : créer l'utilisateur local
        console.log('🆕 Création utilisateur local...');
        const fbUser = auth.currentUser;
        
        if (fbUser) {
          const result = await sqliteDb.runAsync(
            `INSERT INTO user (name, email, phone, firebase_uid, password, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              fbUser.displayName || 'Livreur',
              fbUser.email || '',
              fbUser.phoneNumber || '',
              firebaseUid,
              'firebase_managed',
              new Date().toISOString()
            ]
          );
          
          localUser = await sqliteDb.getFirstAsync<any>(
            "SELECT * FROM user WHERE id = ?",
            [result.lastInsertRowId]
          );
        }
      }

      if (localUser) {
        console.log('✅ Utilisateur local chargé:', localUser.name);
        setUser(localUser);
        setIsAuthenticated(true);
        await SecureStore.setItemAsync(USER_KEY, String(localUser.id));
        
        // Synchroniser les données depuis Firebase
        await syncService.importFromFirebase();
      }
    } catch (error) {
      console.error('❌ Erreur chargement utilisateur local:', error);
    }
  };

  // 3. Vérification initiale
  const checkAuth = async () => {
    if (!isDbReady) return;

    try {
      console.log('🔍 Vérification session...');
      
      // Ajouter les colonnes Firebase si nécessaire
      await addFirebaseColumns();

      const localUserId = await SecureStore.getItemAsync(USER_KEY);
      
      if (localUserId) {
        const localUser = await sqliteDb.getFirstAsync<any>(
          "SELECT * FROM user WHERE id = ?",
          [Number(localUserId)]
        );
        
        if (localUser?.firebase_uid) {
          console.log('👤 Session locale trouvée pour:', localUser.name);
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

  // 4. Connexion
  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Tentative de connexion...');
      
      // Connexion à Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;
      
      console.log('✅ Connecté à Firebase:', fbUser.uid);
      
      // Le reste est géré par onAuthStateChanged
      
    } catch (error: any) {
      console.error('❌ Erreur login:', error.code, error.message);
      
      // Traduire les erreurs Firebase
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Email ou mot de passe incorrect');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Email invalide');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Trop de tentatives. Réessayez plus tard');
      } else {
        throw new Error('Erreur de connexion');
      }
    }
  };

  // 5. Inscription
  const register = async (data: RegisterData) => {
    try {
      console.log('📝 Tentative d\'inscription...');
      
      // Créer l'utilisateur Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        data.email, 
        data.password
      );
      const fbUser = userCredential.user;

      console.log('✅ Compte Firebase créé:', fbUser.uid);

      // Mettre à jour le profil avec le nom
      await updateProfile(fbUser, {
        displayName: data.name
      });

      // Créer le document utilisateur dans Firestore
      await setDoc(doc(firestore, 'users', fbUser.uid), {
        name: data.name,
        email: data.email,
        phone: data.phone,
        created_at: new Date().toISOString(),
        monthly_goal: 250000,
        daily_goal: 15000
      });

      console.log('✅ Document Firestore créé');
      
    } catch (error: any) {
      console.error('❌ Erreur inscription:', error.code, error.message);
      
      // Traduire les erreurs Firebase
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Cet email est déjà utilisé');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Email invalide');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Mot de passe trop faible (minimum 6 caractères)');
      } else {
        throw new Error("Erreur d'inscription");
      }
    }
  };

  // 6. Déconnexion
  const logout = async () => {
    try {
      console.log('🚪 Déconnexion...');
      await signOut(auth);
      // Le nettoyage est géré par onAuthStateChanged
    } catch (error) {
      console.error('❌ Erreur logout:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (isDbReady) {
      checkAuth();
    }
  }, [isDbReady]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser,
      isAuthenticated, 
      authReady, 
      login, 
      register,
      logout, 
      checkAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return context;
};