// src/clean-db.ts
import { db } from './database/db';

export const cleanDatabase = async () => {
  try {
    console.log('🧹 Nettoyage de la base de données...');
    
    // Supprimer toutes les données
    await db.runAsync('DELETE FROM deliveries');
    await db.runAsync('DELETE FROM merchants');
    await db.runAsync('DELETE FROM user');
    await db.runAsync('DELETE FROM sqlite_sequence'); // Réinitialise les IDs auto-incrémentés
    
    console.log('✅ Base de données nettoyée');
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
  }
};