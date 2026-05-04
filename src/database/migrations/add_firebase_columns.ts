// src/database/migrations/add_firebase_columns.ts
import { db } from "../db";

export const addFirebaseColumns = async () => {
  try {
    console.log("🔄 Ajout des colonnes Firebase...");

    // ========================================
    // TABLE DELIVERIES
    // ========================================
    const deliveriesSchema = await db.getAllAsync<any>(
      "PRAGMA table_info(deliveries)",
    );

    const deliveryColumnsToAdd = [
      { name: "firebase_id", type: "TEXT" },
      { name: "needs_sync", type: "INTEGER DEFAULT 0" },
    ];

    for (const column of deliveryColumnsToAdd) {
      const exists = deliveriesSchema.some((col) => col.name === column.name);
      if (!exists) {
        console.log(`➕ Ajout colonne deliveries.${column.name}`);
        await db.execAsync(
          `ALTER TABLE deliveries ADD COLUMN ${column.name} ${column.type}`,
        );
      }
    }

    // ========================================
    // 🔥 TABLE MERCHANTS - TOUTES les colonnes manquantes
    // ========================================
    const merchantsSchema = await db.getAllAsync<any>(
      "PRAGMA table_info(merchants)",
    );

    const merchantColumnsToAdd = [
      { name: "address", type: "TEXT" }, // 🔥 COLONNE MANQUANTE (cause de l'erreur)
      { name: "user_id", type: "TEXT" },
      { name: "firebase_id", type: "TEXT" },
      { name: "needs_sync", type: "INTEGER DEFAULT 0" },
    ];

    for (const column of merchantColumnsToAdd) {
      const exists = merchantsSchema.some((col) => col.name === column.name);
      if (!exists) {
        console.log(`➕ Ajout colonne merchants.${column.name}`);
        await db.execAsync(
          `ALTER TABLE merchants ADD COLUMN ${column.name} ${column.type}`,
        );
      } else {
        console.log(`✅ Colonne merchants.${column.name} existe déjà`);
      }
    }

    // ========================================
    // TABLE USER
    // ========================================
    const userSchema = await db.getAllAsync<any>("PRAGMA table_info(user)");

    const userColumnsToAdd = [
      { name: "firebase_uid", type: "TEXT" },
      { name: "daily_goal", type: "REAL DEFAULT 15000" },
      { name: "monthly_goal", type: "REAL DEFAULT 0" },
      { name: "daily_goal_notifications", type: "INTEGER DEFAULT 1" },
      { name: "reminder_notifications", type: "INTEGER DEFAULT 1" },
      { name: "payment_notifications", type: "INTEGER DEFAULT 1" },
      { name: "delivery_created_notifications", type: "INTEGER DEFAULT 1" },
      { name: "daily_summary_notifications", type: "INTEGER DEFAULT 0" },
    ];

    for (const column of userColumnsToAdd) {
      const exists = userSchema.some((col) => col.name === column.name);
      if (!exists) {
        console.log(`➕ Ajout colonne user.${column.name}`);
        await db.execAsync(
          `ALTER TABLE user ADD COLUMN ${column.name} ${column.type}`,
        );
      }
    }

    // Index unique pour firebase_uid
    const hasFirebaseUid = userSchema.some(
      (col) => col.name === "firebase_uid",
    );
    if (!hasFirebaseUid) {
      await db.execAsync(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_firebase_uid ON user (firebase_uid) WHERE firebase_uid IS NOT NULL`,
      );
    }

    console.log("✅ Colonnes Firebase ajoutées avec succès");
  } catch (error) {
    console.error("❌ Erreur dans addFirebaseColumns:", error);
  }
};
