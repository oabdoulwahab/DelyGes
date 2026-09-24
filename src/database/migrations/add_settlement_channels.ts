import { db } from "../db";

// Registre des versements marchands : canal + référence de traçabilité.
// Migration additive : colonnes ajoutées seulement si absentes.
export async function addSettlementChannels() {
  try {
    const schema = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(settlements)",
    );
    const has = (name: string) => schema.some((col) => col.name === name);

    if (!has("channel")) {
      await db.execAsync(
        "ALTER TABLE settlements ADD COLUMN channel TEXT DEFAULT 'CASH'",
      );
    }
    if (!has("reference")) {
      await db.execAsync("ALTER TABLE settlements ADD COLUMN reference TEXT");
    }
    if (!has("user_id")) {
      await db.execAsync(
        "ALTER TABLE settlements ADD COLUMN user_id INTEGER DEFAULT 0",
      );
    }
    if (!has("needs_sync")) {
      await db.execAsync(
        "ALTER TABLE settlements ADD COLUMN needs_sync INTEGER DEFAULT 1",
      );
    }

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_settlements_merchant
      ON settlements(merchant_id)
    `);

    console.log("✅ Table settlements étendue (canal, référence)");
  } catch (error) {
    console.error("❌ Erreur migration settlements:", error);
  }
}
