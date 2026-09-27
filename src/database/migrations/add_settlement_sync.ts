import { db } from "../db";

// Synchronisation des versements marchands :
// - firebase_id : idempotent upload/download avec Firestore
// - merchant_firebase_id : lie le versement au marchand distant
//   (les IDs SQLite locaux diffèrent d'un appareil à l'autre).
// Les lignes existantes reçoivent needs_sync=1 pour être envoyées.
export async function addSettlementSync() {
  try {
    const schema = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(settlements)",
    );
    const has = (name: string) => schema.some((col) => col.name === name);

    if (!has("firebase_id")) {
      await db.execAsync("ALTER TABLE settlements ADD COLUMN firebase_id TEXT");
    }
    if (!has("merchant_firebase_id")) {
      await db.execAsync(
        "ALTER TABLE settlements ADD COLUMN merchant_firebase_id TEXT",
      );
    }
    if (!has("sync_updated_at")) {
      await db.execAsync(
        "ALTER TABLE settlements ADD COLUMN sync_updated_at TEXT",
      );
    }
    if (!has("needs_sync")) {
      await db.execAsync(
        "ALTER TABLE settlements ADD COLUMN needs_sync INTEGER DEFAULT 1",
      );
    }
    // Les versements saisis avant cette migration n'ont jamais été
    // synchronisés : ils partent au prochain syncAll.
    await db.execAsync(
      "UPDATE settlements SET needs_sync = 1 WHERE firebase_id IS NULL",
    );

    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_firebase_id
      ON settlements(firebase_id)
    `);

    console.log("✅ Table settlements prête pour la sync");
  } catch (error) {
    console.error("❌ Erreur migration sync settlements:", error);
  }
}
