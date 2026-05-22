// src/clean-db.ts - UTILITAIRE DE DÉVELOPPEMENT SEULEMENT
// Supprime toutes les données locales. Utiliser avec précaution.
import { db } from './database/db';

let safetyEnabled = true;

export const disableSafety = () => { safetyEnabled = false; };

export const cleanDatabase = async () => {
  if (safetyEnabled) {
    console.warn('⚠️ Sécurité activée: appeler disableSafety() pour autoriser le nettoyage');
    return;
  }

  try {
    console.log('🧹 Nettoyage de la base de données...');
    
    await db.runAsync('DELETE FROM deliveries');
    await db.runAsync('DELETE FROM sync_queue');
    await db.runAsync('DELETE FROM merchants');
    await db.runAsync('DELETE FROM user');
    await db.runAsync('DELETE FROM notifications');
    await db.runAsync('DELETE FROM sqlite_sequence');
    
    console.log('✅ Base de données nettoyée');
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
  }
};