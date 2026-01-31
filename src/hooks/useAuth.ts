// src/hooks/useAuth.ts
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { db } from "../database/db";

const USER_KEY = "AUTH_USER_ID";

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ⏳ Session ready
  const [authReady, setAuthReady] = useState(false);

  // 🔄 Actions (login / logout)
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // 🔁 Vérification session au démarrage
  const checkAuth = async () => {
    try {
      const userId = await SecureStore.getItemAsync(USER_KEY);

      if (!userId) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      const dbUser = await db.getFirstAsync<any>(
        "SELECT * FROM user WHERE id = ?",
        [Number(userId)]
      );

      if (dbUser) {
        setUser(dbUser);
        setIsAuthenticated(true);
      } else {
        await SecureStore.deleteItemAsync(USER_KEY);
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error("checkAuth error:", e);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      // 🔥 TOUJOURS signaler que l’auth est prête
      setAuthReady(true);
    }
  };

  // 🔐 LOGIN
  const login = async (emailOrPhone: string, password: string) => {
    setActionLoading(true);
    setError(null);

    try {
      const dbUser = await db.getFirstAsync<any>(
        "SELECT * FROM user WHERE email = ? OR phone = ?",
        [emailOrPhone.trim(), emailOrPhone.trim()]
      );

      if (!dbUser || dbUser.password !== password) {
        throw new Error("Identifiants incorrects");
      }

      await SecureStore.setItemAsync(USER_KEY, String(dbUser.id));
      setUser(dbUser);
      setIsAuthenticated(true);

      // 🔥 IMPORTANT
      setAuthReady(true);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setActionLoading(false);
    }
  };

  // 🚪 LOGOUT
  const logout = async () => {
    setActionLoading(true);
    try {
      await SecureStore.deleteItemAsync(USER_KEY);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthReady(true); // 🔥 cohérence globale
      setActionLoading(false);
    }
  };

  // 🔄 Rafraîchir l’utilisateur connecté
  const refreshUser = async () => {
    const userId = await SecureStore.getItemAsync(USER_KEY);
    if (!userId) return;

    const dbUser = await db.getFirstAsync<any>(
      "SELECT * FROM user WHERE id = ?",
      [Number(userId)]
    );

    if (dbUser) setUser(dbUser);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    user,
    isAuthenticated,
    authReady,
    actionLoading,
    error,
    login,
    logout,
    refreshUser,
    clearError: () => setError(null),
  };
};
