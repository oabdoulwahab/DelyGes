// src/utils/databaseMigration.ts
import { db } from '../database/db';

export class DatabaseMigration {
  private static readonly MIGRATION_KEY = 'database_version';
  private static currentVersion = 2; // Augmenter ce numéro à chaque changement de schéma

  // Vérifie et applique les migrations
  static async checkAndMigrate(): Promise<void> {
    try {
      const savedVersion = await this.getSavedVersion();

      if (savedVersion < this.currentVersion) {
        console.log(`🔄 Migration DB: ${savedVersion} → ${this.currentVersion}`);
        await this.runMigrations(savedVersion);
        await this.saveVersion(this.currentVersion);
        console.log('✅ Migration terminée');
      }
    } catch (error) {
      console.error('❌ Erreur migration DB:', error);
    }
  }

  // Récupère la version actuelle stockée
  private static async getSavedVersion(): Promise<number> {
    try {
      const result = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        [this.MIGRATION_KEY]
      );
      return result ? parseInt(result.value, 10) : 1;
    } catch {
      return 1;
    }
  }

  // Enregistre la version après migration
  private static async saveVersion(version: number): Promise<void> {
    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
      [this.MIGRATION_KEY, version.toString()]
    );
  }

  // Applique les migrations depuis une version donnée
  private static async runMigrations(fromVersion: number): Promise<void> {
    if (fromVersion < 2) {
      // ----- Deliveries -----
      const deliveriesSchema = await db.getAllAsync<any>("PRAGMA table_info(deliveries)");
      const deliveryColumnsToAdd = [
        { name: "notes", type: "TEXT" },
        { name: "reminder_notifications", type: "INTEGER DEFAULT 1" },
      ];

      for (const column of deliveryColumnsToAdd) {
        const exists = deliveriesSchema.some(col => col.name === column.name);
        if (!exists) {
          console.log(`➕ Ajout colonne deliveries.${column.name}`);
          await db.execAsync(`ALTER TABLE deliveries ADD COLUMN ${column.name} ${column.type}`);
        }
      }

      // ----- User -----
      const userSchema = await db.getAllAsync<any>("PRAGMA table_info(user)");
      const userColumnsToAdd = [
        { name: "reminder_notifications", type: "INTEGER DEFAULT 1" },
        { name: "delivery_created_notifications", type: "INTEGER DEFAULT 1" },
        { name: "daily_summary_notifications", type: "INTEGER DEFAULT 0" },
      ];

      for (const column of userColumnsToAdd) {
        const exists = userSchema.some(col => col.name === column.name);
        if (!exists) {
          console.log(`➕ Ajout colonne user.${column.name}`);
          await db.execAsync(`ALTER TABLE user ADD COLUMN ${column.name} ${column.type}`);
        }
      }
    }

    // --- Ajoute d'autres migrations ici ---
    // if (fromVersion < 3) { ... }
  }
}
