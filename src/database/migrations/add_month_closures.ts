import { db } from "../db";

// Clôtures comptables mensuelles (écran Statistiques & Clôture).
// Table additive : aucun impact sur l'existant.
export async function addMonthClosuresTable() {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS month_closures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        profit REAL NOT NULL DEFAULT 0,
        deliveries INTEGER NOT NULL DEFAULT 0,
        collected REAL NOT NULL DEFAULT 0,
        reversed_total REAL NOT NULL DEFAULT 0,
        closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        needs_sync INTEGER DEFAULT 1,
        UNIQUE(user_id, year, month)
      )
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_month_closures_user_period
      ON month_closures(user_id, year, month)
    `);

    console.log("✅ Table month_closures créée");
  } catch (error) {
    console.error("❌ Erreur création month_closures:", error);
  }
}
