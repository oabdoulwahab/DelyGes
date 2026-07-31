// src/services/account-deletion.service.ts
// Suppression complète et définitive du compte DelyGes :
//  - Firestore : deliveries, merchants (filtrées par user_id) puis users/{uid}
//  - SQLite local : toutes les tables liées à l'utilisateur
//  - Notifications locales planifiées + badge + tâche background
//  - SecureStore : clé de session AUTH_USER_ID
//  - Firebase Authentication : compte utilisateur
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db as firestore } from "../config/firebase";
import { db as sqliteDb } from "../database/db";
import { BACKGROUND_FETCH_TASK } from "./notification.service";

const AUTH_USER_ID_KEY = "AUTH_USER_ID";
const FIRESTORE_BATCH_SIZE = 400;

const SQLITE_TABLES_TO_CLEAR = [
  "deliveries",
  "merchants",
  "notifications",
  "settlements",
  "app_settings",
  "sync_queue",
  "user",
] as const;

export class AccountDeletionService {
  /**
   * Supprime l'intégralité des données de l'utilisateur authentifié.
   * L'appelant DOIT avoir réauthentifié l'utilisateur (mot de passe) juste avant.
   */
  static async deleteAccount(uid: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Utilisateur non authentifié");
    }
    if (currentUser.uid !== uid) {
      throw new Error("Identité utilisateur incohérente");
    }

    // 1. Firestore : livraisons et commerçants (uniquement ceux de cet utilisateur)
    await this.deleteCollectionForUser("deliveries", uid);
    await this.deleteCollectionForUser("merchants", uid);

    // 2. Firestore : document utilisateur
    await deleteDoc(doc(firestore, "users", uid));

    // 3. Données locales SQLite
    await this.clearLocalData();

    // 4. Notifications locales planifiées + badge + tâche background
    await this.cancelLocalNotifications();

    // 5. Session sécurisée
    await SecureStore.deleteItemAsync(AUTH_USER_ID_KEY);

    // 6. Compte Firebase Authentication (dernier, car Firestore nécessite une session)
    await currentUser.delete();
  }

  private static async deleteCollectionForUser(
    collectionName: string,
    uid: string,
  ): Promise<number> {
    const snapshot = await getDocs(
      query(
        collection(firestore, collectionName),
        where("user_id", "==", uid),
      ),
    );

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_SIZE) {
      const batch = writeBatch(firestore);
      const chunk = docs.slice(i, i + FIRESTORE_BATCH_SIZE);
      chunk.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });
      await batch.commit();
    }

    console.log(
      `🗑️ ${docs.length} document(s) supprimé(s) dans ${collectionName}`,
    );
    return docs.length;
  }

  private static async clearLocalData(): Promise<void> {
    for (const table of SQLITE_TABLES_TO_CLEAR) {
      await sqliteDb.runAsync(`DELETE FROM ${table}`);
    }

    // Réinitialiser les séquences d'auto-incrémentation
    try {
      await sqliteDb.runAsync("DELETE FROM sqlite_sequence");
    } catch {
      // Table sqlite_sequence absente ou non modifiable : rien à faire
    }

    console.log("✅ Données locales SQLite supprimées");
  }

  private static async cancelLocalNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_FETCH_TASK,
      );
      if (isRegistered) {
        await TaskManager.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      }
    } catch (error) {
      console.warn(
        "⚠️ Impossible de désenregistrer la tâche background:",
        error,
      );
    }

    console.log("✅ Notifications planifiées annulées");
  }
}
