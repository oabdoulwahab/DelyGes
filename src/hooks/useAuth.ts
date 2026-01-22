// src/hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { router } from 'expo-router';

export const useAuth = () => {
  const {
    user,
    token,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    checkAuth,
    clearError
  } = useAuthStore();

  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Vérifier l'authentification une seule fois au démarrage
  useEffect(() => {
    const verifyAuth = async () => {
      if (!hasCheckedAuth) {
        await checkAuth();
        setHasCheckedAuth(true);
      }
    };

    verifyAuth();
  }, [hasCheckedAuth]);

  // Ne pas rediriger automatiquement ici - laisser le composant Index gérer cela
  // pour éviter les cycles de redirection

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    checkAuth,
    clearError
  };
};