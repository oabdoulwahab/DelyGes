import { db } from "../db";

export async function addSyncQueueTable() {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        operation TEXT NOT NULL DEFAULT 'upsert',
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        next_retry_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_next_retry
      ON sync_queue(next_retry_at)
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_table_record
      ON sync_queue(table_name, record_id)
    `);

    // Ajouter updated_at aux tables si nécessaire pour le conflict resolution
    const merchantsSchema = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(merchants)",
    );
    if (!merchantsSchema.some((col) => col.name === "sync_updated_at")) {
      await db.execAsync(
        "ALTER TABLE merchants ADD COLUMN sync_updated_at TEXT",
      );
    }

    const deliveriesSchema = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(deliveries)",
    );
    if (!deliveriesSchema.some((col) => col.name === "sync_updated_at")) {
      await db.execAsync(
        "ALTER TABLE deliveries ADD COLUMN sync_updated_at TEXT",
      );
    }

    console.log("✅ Table sync_queue créée");
  } catch (error) {
    console.error("❌ Erreur création sync_queue:", error);
  }
}
