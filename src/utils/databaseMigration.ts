// src/utils/databaseMigration.ts
import { db } from '../database/db';

export class DatabaseMigration {
  private static readonly MIGRATION_KEY = 'database_version';
  private static currentVersion = 2; // Augmenter ce numéro à chaque changement de schéma
  
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
  
  private static async saveVersion(version: number): Promise<void> {
    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
      [this.MIGRATION_KEY, version.toString()]
    );
  }
  
  private static async runMigrations(fromVersion: number): Promise<void> {
    // Ajoutez vos migrations ici
    if (fromVersion < 2) {
      // Exemple: Ajouter une colonne
      await db.execAsync(`
        ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS notes TEXT;
      `);
    }
    
    // Ajoutez d'autres migrations au fur et à mesure
    // if (fromVersion < 3) { ... }
  }
}