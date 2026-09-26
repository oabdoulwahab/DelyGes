import { db } from "../database/db";

// Préférences terrain persistées (table app_settings, paire clé/valeur).
// Utilisé pour : GPS par défaut, OTP, sonnerie, économie batterie.

export async function getAppSetting(
  key: string,
  fallback: string,
): Promise<string> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = ?",
      [key],
    );
    return row?.value ?? fallback;
  } catch (error) {
    console.error(`❌ Lecture réglage ${key}:`, error);
    return fallback;
  }
}

export async function setAppSetting(
  key: string,
  value: string,
): Promise<void> {
  try {
    await db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value],
    );
  } catch (error) {
    console.error(`❌ Écriture réglage ${key}:`, error);
    throw error;
  }
}

export async function getAppFlag(key: string, fallback = true): Promise<boolean> {
  const v = await getAppSetting(key, fallback ? "1" : "0");
  return v === "1";
}

export async function setAppFlag(key: string, value: boolean): Promise<void> {
  await setAppSetting(key, value ? "1" : "0");
}
