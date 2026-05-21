// src/hooks/useAutoSave.ts
import { useRef } from "react";
import { db } from "../database/db";
import { useAuth } from "../context/AuthContext";

type AutoSaveOptions = {
  userId?: number;
  delay?: number;
};

export const useAutoSave = (options?: AutoSaveOptions) => {
  const { user, refreshUser } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = options?.userId ?? user?.id;
  const delay = options?.delay ?? 400;

  const autoSave = (field: string, value: string | number | boolean | null) => {
    if (!userId) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        await db.runAsync(
          `UPDATE user SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [value, userId],
        );

        await refreshUser();
      } catch (error) {
        console.error("❌ AutoSave error:", error);
      }
    }, delay);
  };

  return { autoSave };
};
