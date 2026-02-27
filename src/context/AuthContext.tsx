import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { db } from "../database/db";

const USER_KEY = "AUTH_USER_ID";

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// On ajoute isDbReady aux props
export const AuthProvider = ({ children, isDbReady }: { children: React.ReactNode; isDbReady: boolean }) => {
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const checkAuth = async () => {
    if (!isDbReady) return;

    try {
      const userId = await SecureStore.getItemAsync(USER_KEY);
      console.log("🔍 Vérification session ID:", userId);

      if (userId) {
        // Important: Utiliser getFirstAsync et vérifier le résultat
        const dbUser = await db.getFirstAsync<any>("SELECT * FROM user WHERE id = ?", [Number(userId)]);
        
        if (dbUser) {
          setUser(dbUser);
          setIsAuthenticated(true);
          console.log("✅ Session restaurée pour:", dbUser.name);
        } else {
          // Si l'ID est dans SecureStore mais plus dans la DB (rare mais possible)
          await SecureStore.deleteItemAsync(USER_KEY);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error("❌ Erreur checkAuth:", e);
      setIsAuthenticated(false);
    } finally {
      // On ne libère l'accès à l'app qu'ici
      setAuthReady(true); 
    }
  };

  // On surveille isDbReady : dès qu'il passe à true, on vérifie l'auth
  useEffect(() => {
    if (isDbReady) {
      checkAuth();
    }
  }, [isDbReady]);

  const login = async (emailOrPhone: string, password: string) => {
    const dbUser = await db.getFirstAsync<any>(
      "SELECT * FROM user WHERE email = ? OR phone = ?",
      [emailOrPhone.trim(), emailOrPhone.trim()]
    );
    
    if (!dbUser || dbUser.password !== password) throw new Error("Identifiants incorrects");
    
    await SecureStore.setItemAsync(USER_KEY, String(dbUser.id));
    setUser(dbUser);
    setIsAuthenticated(true);
    setAuthReady(true);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(USER_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, authReady, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return context;
};