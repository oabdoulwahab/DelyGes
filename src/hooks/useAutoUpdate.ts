// src/hooks/useAutoUpdate.ts
import { useEffect } from 'react';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

export const useAutoUpdate = () => {
  useEffect(() => {
    const checkAndApplyUpdate = async () => {
      try {
        console.log('🔍 Vérification des mises à jour...');
        
        const update = await Updates.checkForUpdateAsync();
        
        if (update.isAvailable) {
          console.log('📦 Mise à jour disponible, téléchargement...');
          
          // Télécharger en arrière-plan
          await Updates.fetchUpdateAsync();
          
          console.log('✅ Mise à jour installée, redémarrage...');
          
          // Redémarrer automatiquement
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.error('❌ Erreur de mise à jour:', error);
        // Ne pas déranger l'utilisateur
      }
    };

    // Vérifier au démarrage
    checkAndApplyUpdate();
    
    // Vérifier périodiquement (toutes les 10 minutes)
    const interval = setInterval(checkAndApplyUpdate, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
};