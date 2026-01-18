// src/database/db.ts
import * as SQLite from 'expo-sqlite';

// ===============================
// OUVERTURE DB
// ===============================
export const db = SQLite.openDatabaseSync('delyges.db');

// ===============================
// 1️⃣ CRÉATION DES TABLES (SANS INDEX)
// ===============================
export const initDB = async (): Promise<void> => {
  try {
    // Activer les clés étrangères
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // ===== TABLE USER =====
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

    // ===== TABLE DELIVERIES =====
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

    // ===== TABLE SETTINGS =====
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Tables vérifiées/créées');
  } catch (error) {
    console.error('❌ Erreur initDB:', error);
    throw error;
  }
};

// ===============================
// 2️⃣ MIGRATIONS (COLONNES MANQUANTES)
// ===============================
export const migrateFromOldDB = async (): Promise<void> => {
  try {
    console.log('🔍 Vérification du schéma...');

    // ----- USER -----
    const userSchema = await db.getAllAsync<any>('PRAGMA table_info(user)');
    const hasPassword = userSchema.some(col => col.name === 'password');

    if (!hasPassword) {
      console.log('➕ Ajout colonne user.password');
      await db.execAsync('ALTER TABLE user ADD COLUMN password TEXT');
      await db.runAsync(
        'UPDATE user SET password = ? WHERE password IS NULL',
        ['default_password']
      );
    }

    // ----- DELIVERIES -----
    const deliveriesSchema = await db.getAllAsync<any>('PRAGMA table_info(deliveries)');
    const hasUserId = deliveriesSchema.some(col => col.name === 'user_id');

    if (!hasUserId) {
      console.log('➕ Ajout colonne deliveries.user_id');
      await db.execAsync(
        'ALTER TABLE deliveries ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1'
      );
    }

    console.log('✅ Migration terminée');
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    throw error;
  }
};

// ===============================
// 3️⃣ INDEX (APRÈS MIGRATION)
// ===============================
export const createIndexes = async (): Promise<void> => {
  try {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON deliveries(user_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
    `);

    console.log('📌 Index créés');
  } catch (error) {
    console.error('❌ Erreur index:', error);
    throw error;
  }
};

// ===============================
// 4️⃣ INITIALISATION GLOBALE
// ===============================
export const initializeDatabase = async (): Promise<void> => {
  try {
    await initDB();           // créer tables
    await migrateFromOldDB(); // corriger anciennes DB
    await createIndexes();    // index seulement si colonnes OK

    console.log('🚀 Base de données prête');
  } catch (error) {
    console.error('❌ Initialisation DB échouée:', error);
  }
};

// ===============================
// 5️⃣ DATABASE SERVICE
// ===============================
export const DatabaseService = {
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return await db.getAllAsync<T>(sql, params);
  },

  async execute(
    sql: string,
    params: any[] = []
  ): Promise<{ lastInsertRowId?: number; changes?: number }> {
    return await db.runAsync(sql, params);
  },

  async getOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await db.getFirstAsync<T>(sql, params);
    return result || null;
  },

  async count(sql: string, params: any[] = []): Promise<number> {
    const result = await db.getFirstAsync<{ count: number }>(sql, params);
    return result?.count ?? 0;
  }
};
