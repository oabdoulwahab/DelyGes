import { db } from "../db";

// Comptes Mobile Money de reversement du livreur + préférences.
// Migration additive : colonnes ajoutées seulement si absentes.
export async function addProfilePayout() {
  try {
    const schema = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(user)",
    );
    const has = (name: string) => schema.some((col) => col.name === name);

    const columns: { name: string; type: string }[] = [
      { name: "payout_wave", type: "TEXT" },
      { name: "payout_orange", type: "TEXT" },
      { name: "payout_mtn", type: "TEXT" },
      { name: "payout_primary", type: "TEXT DEFAULT 'WAVE'" },
    ];

    for (const column of columns) {
      if (!has(column.name)) {
        console.log(`➕ Ajout colonne user.${column.name}`);
        await db.execAsync(
          `ALTER TABLE user ADD COLUMN ${column.name} ${column.type}`,
        );
      }
    }

    console.log("✅ Colonnes reversement profil OK");
  } catch (error) {
    console.error("❌ Erreur migration profil reversement:", error);
  }
}
