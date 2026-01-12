import * as SQLite from "expo-sqlite";

// Ouverture de la base (nouvelle API Expo)
export const db = SQLite.openDatabaseSync("delyges.db");

// Initialisation des tables
export const initDB = async () => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_name TEXT NOT NULL,
      phone TEXT,
      address TEXT NOT NULL,
      parcel_value REAL,
      delivery_fee REAL,
      status TEXT,
      created_at TEXT,
      delivered_at TEXT
    );
  `);
};
