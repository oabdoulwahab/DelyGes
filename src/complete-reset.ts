// src/complete-reset.ts
import { db } from './database/db';
import * as SecureStore from 'expo-secure-store';
import { auth } from './config/firebase';
import { signOut } from 'firebase/auth';

export const completeReset = async () => {
  try {
    console.log('🧹 RÉINITIALISATION COMPLÈTE...');
    
    // 1. Déconnexion Firebase
    try {
      await signOut(auth);
      console.log('✅ Déconnecté de Firebase');
    } catch (e) {}
    
    // 2. Supprimer les données des tables (pas les tables elles-mêmes)
    console.log('🗑️ Suppression des données...');
    
    await db.runAsync('DELETE FROM deliveries');
    await db.runAsync('DELETE FROM merchants');
    await db.runAsync('DELETE FROM user');
    await db.runAsync('DELETE FROM notifications');
    await db.runAsync('DELETE FROM app_settings');
    
    // 3. Réinitialiser les séquences d'auto-incrémentation
    try {
      await db.runAsync('DELETE FROM sqlite_sequence');
    } catch (e) {
      console.log('ℹ️ Table sqlite_sequence non existante ou non modifiable');
    }
    
    console.log('✅ Données supprimées');
    
    // 4. Supprimer la session
    await SecureStore.deleteItemAsync('AUTH_USER_ID');
    console.log('✅ Session supprimée');
    
    console.log('🎉 RÉINITIALISATION TERMINÉE');
    console.log('👉 Redémarre l\'application avec: npx expo start --clear');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
};