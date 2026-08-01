import { db } from "../db";

export const fixUserPhoneUnique = async () => {
  try {
    const indexes = await db.getAllAsync<{
      name: string;
      unique: number;
      origin: string;
    }>("PRAGMA index_list(user)");

    const hasAutoUnique = indexes.some(
      (i) => i.name.startsWith("sqlite_autoindex_") && i.unique === 1,
    );

    if (!hasAutoUnique) {
      console.log("✅ user.phone : aucune contrainte UNIQUE, rien à faire");
      return;
    }

    console.log("🔄 Suppression de la contrainte UNIQUE sur user.phone...");

    const cols = await db.getAllAsync<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>("PRAGMA table_info(user)");

    const defs = cols.map((c) => {
      if (c.name === "phone") {
        return '"phone" TEXT NOT NULL';
      }
      let def = `"${c.name}" ${c.type}`;
      if (c.pk) {
        def += " PRIMARY KEY AUTOINCREMENT";
      } else {
        if (c.notnull) def += " NOT NULL";
        if (c.dflt_value !== null && c.dflt_value !== undefined) {
          def += ` DEFAULT ${c.dflt_value}`;
        }
      }
      return def;
    });

    const colNames = cols.map((c) => `"${c.name}"`).join(", ");

    await db.execAsync("PRAGMA foreign_keys = OFF");
    await db.execAsync("BEGIN TRANSACTION");
    await db.execAsync(`ALTER TABLE user RENAME TO user_old`);
    await db.execAsync(`CREATE TABLE user (${defs.join(", ")})`);
    await db.execAsync(
      `INSERT INTO user (${colNames}) SELECT ${colNames} FROM user_old`,
    );
    await db.execAsync(`DROP TABLE user_old`);
    await db.execAsync("COMMIT");
    await db.execAsync("PRAGMA foreign_keys = ON");

    await db.execAsync(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_firebase_uid ON user (firebase_uid) WHERE firebase_uid IS NOT NULL",
    );

    console.log("✅ Contrainte UNIQUE sur user.phone supprimée");
  } catch (error) {
    console.error("❌ Erreur fixUserPhoneUnique:", error);
    try {
      await db.execAsync("ROLLBACK");
      await db.execAsync("PRAGMA foreign_keys = ON");
    } catch {
      // ignore
    }
  }
};
