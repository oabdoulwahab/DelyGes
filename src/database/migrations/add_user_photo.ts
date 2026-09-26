import { db } from "../db";

// Photo de profil du livreur (URI locale, galerie ou caméra).
// Migration additive : colonne ajoutée seulement si absente.
export async function addUserPhoto() {
  try {
    const schema = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(user)",
    );
    if (!schema.some((col) => col.name === "photo_uri")) {
      console.log("➕ Ajout colonne user.photo_uri");
      await db.execAsync("ALTER TABLE user ADD COLUMN photo_uri TEXT");
    }
    console.log("✅ Colonne photo profil OK");
  } catch (error) {
    console.error("❌ Erreur migration photo profil:", error);
  }
}
