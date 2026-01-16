// src/database/db.ts
import * as SQLite from 'expo-sqlite';

// Ouvrir la base de données
export const db = SQLite.openDatabaseSync('delyges.db');

// Initialisation de la base de données
export const initDB = async (): Promise<boolean> => {
  try {
    // Activer les clés étrangères
    await db.execAsync('PRAGMA foreign_keys = ON;');
    
    // 1. Table des utilisateurs
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Table des livraisons
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_name TEXT NOT NULL,
        phone TEXT,
        address TEXT NOT NULL,
        parcel_value REAL DEFAULT 0,
        delivery_fee REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'A_LIVRER',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered_at DATETIME,
        user_id INTEGER NOT NULL
      );
    `);

    // 3. Table des paramètres
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Créer les index
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON deliveries(user_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
    `);

    console.log('✅ Base de données initialisée');
    return true;
  } catch (error) {
    console.error('❌ Erreur d\'initialisation:', error);
    return false;
  }
};

// Service de base de données simplifié
export const DatabaseService = {
  // Exécuter une requête SELECT
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      return await db.getAllAsync<T>(sql, params);
    } catch (error) {
      console.error('Erreur query:', sql, params, error);
      throw error;
    }
  },

  // Exécuter INSERT/UPDATE/DELETE
  async execute(sql: string, params: any[] = []): Promise<{ lastInsertRowId?: number; changes?: number }> {
    try {
      return await db.runAsync(sql, params);
    } catch (error) {
      console.error('Erreur execute:', sql, params, error);
      throw error;
    }
  },

  // Récupérer un seul enregistrement
  async getOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      const result = await db.getFirstAsync<T>(sql, params);
      return result || null;
    } catch (error) {
      console.error('Erreur getOne:', sql, params, error);
      throw error;
    }
  },

  // Compter les enregistrements
  async count(sql: string, params: any[] = []): Promise<number> {
    try {
      const result = await db.getFirstAsync<{ count: number }>(sql, params);
      return result?.count || 0;
    } catch (error) {
      console.error('Erreur count:', sql, params, error);
      throw error;
    }
  }
};

// Fonction utilitaire pour migrer depuis votre ancienne structure
export const migrateFromOldDB = async (): Promise<void> => {
  try {
    // Vérifier si on a besoin de migrer (colonnes manquantes)
    const userSchema = await db.getAllAsync<any>("PRAGMA table_info(user)");
    const hasPasswordColumn = userSchema.some((col: any) => col.name === 'password');
    
    if (!hasPasswordColumn) {
      console.log('🔄 Migration des données...');
      
      // Ajouter la colonne password
      await db.execAsync('ALTER TABLE user ADD COLUMN password TEXT');
      
      // Mettre un mot de passe par défaut pour les utilisateurs existants
      await db.runAsync(
        "UPDATE user SET password = ? WHERE password IS NULL",
        ['default_password']
      );
      
      // Ajouter user_id aux livraisons si nécessaire
      const deliveriesSchema = await db.getAllAsync<any>("PRAGMA table_info(deliveries)");
      const hasUserIdColumn = deliveriesSchema.some((col: any) => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        await db.execAsync('ALTER TABLE deliveries ADD COLUMN user_id INTEGER DEFAULT 1');
      }
      
      console.log('✅ Migration terminée');
    }
  } catch (error) {
    console.error('Erreur migration:', error);
  }
};

// Fonction principale d'initialisation
export const initializeDatabase = async (): Promise<void> => {
  try {
    await initDB();
    await migrateFromOldDB();
  } catch (error) {
    console.error('Erreur initialisation base de données:', error);
  }
};