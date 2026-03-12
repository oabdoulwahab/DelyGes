// src/database/migrations/add_firebase_columns.ts
import { db } from '../db';

export const addFirebaseColumns = async () => {
  try {
    console.log('🔄 Ajout des colonnes Firebase...');

    // Table deliveries
    const deliveriesSchema = await db.getAllAsync<any>("PRAGMA table_info(deliveries)");
    
    const deliveryColumnsToAdd = [
      { name: "firebase_id", type: "TEXT" },
      { name: "needs_sync", type: "INTEGER DEFAULT 0" },
    ];

    for (const column of deliveryColumnsToAdd) {
      const exists = deliveriesSchema.some(col => col.name === column.name);
      if (!exists) {
        console.log(`➕ Ajout colonne deliveries.${column.name}`);
        await db.execAsync(`ALTER TABLE deliveries ADD COLUMN ${column.name} ${column.type}`);
      }
    }

    // Table merchants
    const merchantsSchema = await db.getAllAsync<any>("PRAGMA table_info(merchants)");
    
    const merchantColumnsToAdd = [
      { name: "firebase_id", type: "TEXT" },
      { name: "needs_sync", type: "INTEGER DEFAULT 0" },
    ];

    for (const column of merchantColumnsToAdd) {
      const exists = merchantsSchema.some(col => col.name === column.name);
      if (!exists) {
        console.log(`➕ Ajout colonne merchants.${column.name}`);
        await db.execAsync(`ALTER TABLE merchants ADD COLUMN ${column.name} ${column.type}`);
      }
    }

    // Table user - GESTION SPÉCIALE POUR LA COLONNE UNIQUE
    const userSchema = await db.getAllAsync<any>("PRAGMA table_info(user)");
    
    // Vérifier si la colonne existe déjà
    const hasFirebaseUid = userSchema.some(col => col.name === "firebase_uid");
    
    if (!hasFirebaseUid) {
      console.log(`➕ Ajout colonne user.firebase_uid`);
      
      // On ajoute d'abord sans UNIQUE
      await db.execAsync(`ALTER TABLE user ADD COLUMN firebase_uid TEXT`);
      
      // On crée un index UNIQUE à la place (plus flexible)
      await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_firebase_uid ON user (firebase_uid) WHERE firebase_uid IS NOT NULL`);
    }

    // Ajouter daily_goal si nécessaire
    const hasDailyGoal = userSchema.some(col => col.name === "daily_goal");
    if (!hasDailyGoal) {
      console.log(`➕ Ajout colonne user.daily_goal`);
      await db.execAsync(`ALTER TABLE user ADD COLUMN daily_goal REAL DEFAULT 15000`);
    }

    console.log('✅ Colonnes Firebase ajoutées');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
};