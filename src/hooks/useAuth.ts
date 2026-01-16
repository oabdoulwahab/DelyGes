// src/hooks/useAuth.ts
import { useEffect } from 'react';
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

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    checkAuth();
  }, []);

  // Rediriger si non authentifié
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated]);

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