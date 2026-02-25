import * as SQLite from "expo-sqlite";
import { DatabaseMigration } from "../utils/databaseMigration";

// ===============================
// OUVERTURE DB
// ===============================
export const db = SQLite.openDatabaseSync("delyges.db");

// ===============================
// 1️⃣ CRÉATION DES TABLES
// ===============================
export const initDB = async (): Promise<void> => {
  try {
    await db.execAsync("PRAGMA foreign_keys = ON");

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
      )
    `);

    // ===== TABLE NOTIFICATIONS  =====
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data TEXT,
        read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER NOT NULL
      )
    `);

    // ===== TABLE MERCHANTS =====
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_name TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
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
        merchant_id INTEGER,
        payment_type TEXT NOT NULL DEFAULT 'CLIENT_PAYE_TOUT',
        amount_collected REAL DEFAULT 0,
        amount_to_return REAL DEFAULT 0,
        profit REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'A_LIVRER',
        notes TEXT,
        is_settled INTEGER DEFAULT 0,
        settled_at DATETIME,
        reversed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered_at DATETIME,
        user_id INTEGER NOT NULL
      )
    `);

    // ===== TABLE SETTINGS =====
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Tables vérifiées/créées");
  } catch (error) {
    console.error("❌ Erreur initDB:", error);
    throw error;
  }
};

// ===============================
// 2️⃣ MIGRATIONS SÉCURISÉES
// ===============================
export const migrateFromOldDB = async (): Promise<void> => {
  try {
    console.log("🔍 Vérification du schéma...");

    // ----- USER -----
    const userSchema = await db.getAllAsync<any>("PRAGMA table_info(user)");

    const userColumnsToAdd = [
      { name: "password", type: "TEXT" },
      { name: "delivery_created_notifications", type: "INTEGER DEFAULT 1" },
      { name: "daily_summary_notifications", type: "INTEGER DEFAULT 0" },
    ];

    for (const column of userColumnsToAdd) {
      const exists = userSchema.some((col) => col.name === column.name);
      if (!exists) {
        console.log(`➕ Ajout colonne user.${column.name}`);
        await db.execAsync(
          `ALTER TABLE user ADD COLUMN ${column.name} ${column.type}`
        );
      }
    }

    // ----- DELIVERIES -----
    const deliveriesSchema = await db.getAllAsync<any>(
      "PRAGMA table_info(deliveries)"
    );

    const deliveryColumnsToAdd = [
      { name: "user_id", type: "INTEGER NOT NULL DEFAULT 1" },
      { name: "merchant_id", type: "INTEGER" },
      { name: "payment_type", type: "TEXT DEFAULT 'CLIENT_PAYE_TOUT'" },
      { name: "amount_collected", type: "REAL DEFAULT 0" },
      { name: "amount_to_return", type: "REAL DEFAULT 0" },
      { name: "profit", type: "REAL DEFAULT 0" },
      { name: "is_settled", type: "INTEGER DEFAULT 0" },
      { name: "settled_at", type: "DATETIME" },
      { name: "reversed", type: "INTEGER DEFAULT 0" },
    ];

    for (const column of deliveryColumnsToAdd) {
      const exists = deliveriesSchema.some((col) => col.name === column.name);
      if (!exists) {
        console.log(`➕ Ajout colonne deliveries.${column.name}`);
        await db.execAsync(
          `ALTER TABLE deliveries ADD COLUMN ${column.name} ${column.type}`
        );
      }
    }

    console.log("✅ Migration terminée");
  } catch (error) {
    console.error("❌ Erreur migration:", error);
    throw error;
  }
};

// ===============================
// 3️⃣ INDEX (UNE REQUÊTE À LA FOIS)
// ===============================
export const createIndexes = async (): Promise<void> => {
  try {
    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON deliveries(user_id)"
    );

    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)"
    );

    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at)"
    );

    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS idx_deliveries_merchant_id ON deliveries(merchant_id)"
    );

    await db.execAsync(
      "CREATE INDEX IF NOT EXISTS idx_deliveries_is_settled ON deliveries(is_settled)"
    );

    console.log("📌 Index créés");
  } catch (error) {
    console.error("❌ Erreur index:", error);
    throw error;
  }
};

// ===============================
// 4️⃣ INITIALISATION GLOBALE
// ===============================
export const initializeDatabase = async (): Promise<void> => {
  try {
    await initDB();
    await migrateFromOldDB();
    await createIndexes();
    console.log("🚀 Base de données prête");
  } catch (error) {
    console.error("❌ Initialisation DB échouée:", error);
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
  },
};
