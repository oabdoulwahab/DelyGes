// src/hooks/useAuth.ts
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { db } from "../database/db";

const USER_KEY = "AUTH_USER_ID";

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔁 Vérifier la session au démarrage
  const checkAuth = async () => {
    try {
      const userId = await SecureStore.getItemAsync(USER_KEY);

      if (!userId) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }

      const dbUser = await db.getFirstAsync(
        "SELECT * FROM user WHERE id = ?",
        [Number(userId)]
      );

      if (dbUser) {
        setUser(dbUser);
        setIsAuthenticated(true);
      } else {
        await SecureStore.deleteItemAsync(USER_KEY);
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error("checkAuth error:", e);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔐 LOGIN
  const login = async (emailOrPhone: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await db.getFirstAsync<{ id: number; password: string }>(
        "SELECT * FROM user WHERE email = ? OR phone = ?",
        [emailOrPhone.trim(), emailOrPhone.trim()]
      );

      if (!user || user.password !== password) {
        throw new Error("Identifiants incorrects");
      }

      await SecureStore.setItemAsync(USER_KEY, String(user.id));
      setUser(user);
      setIsAuthenticated(true);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // 🚪 LOGOUT
  const logout = async () => {
    await SecureStore.deleteItemAsync(USER_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
    clearError: () => setError(null),
  };
};
