// src/services/sync.service.ts
import { db } from "../database/db";
import { auth, db as firestore } from "../config/firebase";
import NetInfo from "@react-native-community/netinfo";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";

class SyncService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private lastSyncTime: number = 0;
  private syncQueue: Array<{ table: string; id: number }> = [];
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly SYNC_DEBOUNCE = 2000; // 2 secondes
  private readonly SYNC_COOLDOWN = 5000; // 5 secondes entre deux sync complètes

  constructor() {
    // Écouter les changements de connexion
    NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        console.log("📶 Connexion rétablie - synchronisation...");
        this.processSyncQueue();
      }
    });
  }

  async deleteFromFirebase(table: string, firebaseId: string) {
    if (!this.isOnline || !auth.currentUser) {
      console.log("⏭️ Suppression Firebase ignorée: hors ligne");
      return;
    }

    try {
      console.log(`🗑️ Suppression ${table} ${firebaseId} de Firebase...`);
      await deleteDoc(doc(firestore, table, firebaseId));
      console.log(`✅ ${table} supprimé de Firebase`);
    } catch (error) {
      console.error(`❌ Erreur suppression ${table}:`, error);
    }
  }

  // 🔥 Import optimisé avec cache et exécution en arrière-plan
  async importFromFirebase() {
    if (!auth.currentUser) {
      console.log("⏭️ Import ignoré: utilisateur non connecté");
      return;
    }

    // Éviter les imports multiples
    if (this.syncInProgress) {
      console.log("⏭️ Import déjà en cours");
      return;
    }

    // Vérifier si l'import est récent (moins de 30 secondes)
    if (Date.now() - this.lastSyncTime < 30000) {
      console.log("⏭️ Import récent ignoré");
      return;
    }

    this.syncInProgress = true;
    console.log("📥 Import des données depuis Firebase...");

    try {
      // 1. Récupérer tous les IDs Firebase existants en local
      const localFirebaseIds = new Set();

      const localMerchants = await db.getAllAsync<{ firebase_id: string }>(
        "SELECT firebase_id FROM merchants WHERE firebase_id IS NOT NULL",
      );
      localMerchants.forEach((m) => localFirebaseIds.add(m.firebase_id));

      const localDeliveries = await db.getAllAsync<{ firebase_id: string }>(
        "SELECT firebase_id FROM deliveries WHERE firebase_id IS NOT NULL",
      );
      localDeliveries.forEach((d) => localFirebaseIds.add(d.firebase_id));

      // Supprimer les données locales qui n'existent plus dans Firebase
      await db.runAsync("DELETE FROM merchants WHERE user_id = ?", [
        auth.currentUser.uid,
      ]);
      await db.runAsync("DELETE FROM deliveries WHERE user_id = ?", [
        auth.currentUser.uid,
      ]);

      // 2. Importer les commerçants
      console.log("📦 Import des commerçants...");
      const merchantsQuery = query(
        collection(firestore, "merchants"),
        where("user_id", "==", auth.currentUser.uid), // ← Filtrer par user_id
      );
      const merchantsSnapshot = await getDocs(merchantsQuery);

      let merchantCount = 0;
      const batchSize = 10; // Traiter par lots pour éviter de bloquer
      let merchantBatch = [];

      for (const doc of merchantsSnapshot.docs) {
        // Ignorer si déjà importé
        if (localFirebaseIds.has(doc.id)) continue;

        const data = doc.data();
        merchantBatch.push({
          firebaseId: doc.id,
          data: data,
        });

        if (merchantBatch.length >= batchSize) {
          await this.processMerchantBatch(merchantBatch);
          merchantCount += merchantBatch.length;
          merchantBatch = [];
        }
      }

      if (merchantBatch.length > 0) {
        await this.processMerchantBatch(merchantBatch);
        merchantCount += merchantBatch.length;
      }

      console.log(`✅ ${merchantCount} nouveaux commerçants importés`);

      // 3. Importer les livraisons
      console.log("📦 Import des livraisons...");
      const deliveriesQuery = query(
        collection(firestore, "deliveries"),
        where("user_id", "==", auth.currentUser.uid),
      );
      const deliveriesSnapshot = await getDocs(deliveriesQuery);

      let deliveryCount = 0;
      let deliveryBatch = [];

      for (const doc of deliveriesSnapshot.docs) {
        if (localFirebaseIds.has(doc.id)) continue;

        const data = doc.data();
        deliveryBatch.push({
          firebaseId: doc.id,
          data: data,
        });

        if (deliveryBatch.length >= batchSize) {
          await this.processDeliveryBatch(deliveryBatch);
          deliveryCount += deliveryBatch.length;
          deliveryBatch = [];
        }
      }

      if (deliveryBatch.length > 0) {
        await this.processDeliveryBatch(deliveryBatch);
        deliveryCount += deliveryBatch.length;
      }

      console.log(`✅ ${deliveryCount} nouvelles livraisons importées`);
      console.log("📥 Import terminé avec succès");
    } catch (error) {
      console.error("❌ Erreur import:", error);
    } finally {
      this.syncInProgress = false;
      this.lastSyncTime = Date.now();
    }
  }

  // Traiter un lot de commerçants
  private async processMerchantBatch(
    batch: Array<{ firebaseId: string; data: any }>,
  ) {
    const queries = batch.map((item) =>
      db.runAsync(
        `INSERT INTO merchants 
         (name, phone, address, firebase_id, user_id, created_at, needs_sync) 
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          item.data.name || "",
          item.data.phone || "",
          item.data.address || "",
          item.firebaseId,
          auth.currentUser?.uid,
          item.data.created_at || new Date().toISOString(),
        ],
      ),
    );
    await Promise.all(queries);
  }

  // Traiter un lot de livraisons
  private async processDeliveryBatch(
    batch: Array<{ firebaseId: string; data: any }>,
  ) {
    const queries = batch.map(async (item) => {
      // 🔥 Trouver l'ID local du commerçant à partir du firebase_id
      let localMerchantId = null;
      if (item.data.merchant_id) {
        const merchant = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM merchants WHERE firebase_id = ?",
          [item.data.merchant_id],
        );
        localMerchantId = merchant?.id || null;
        console.log(
          `🏪 Merchant Firebase ${item.data.merchant_id} -> Local ID:`,
          localMerchantId,
        );
      }

      return db.runAsync(
        `INSERT INTO deliveries 
       (recipient_name, phone, address, parcel_value, delivery_fee, 
        merchant_id, payment_type, amount_collected, amount_to_return,
        profit, status, created_at, delivered_at, user_id, firebase_id, needs_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          item.data.recipient_name || "",
          item.data.phone || "",
          item.data.address || "",
          item.data.parcel_value || 0,
          item.data.delivery_fee || 0,
          localMerchantId, // ← Maintenant c'est l'ID local
          item.data.payment_type || "CLIENT_PAYE_TOUT",
          item.data.amount_collected || 0,
          item.data.amount_to_return || 0,
          item.data.profit || 0,
          item.data.status || "A_LIVRER",
          item.data.created_at || new Date().toISOString(),
          item.data.delivered_at || null,
          auth.currentUser?.uid,
          item.firebaseId,
        ],
      );
    });

    await Promise.all(queries);
  }

  async syncAll() {
    if (this.syncInProgress || !this.isOnline || !auth.currentUser) {
      return;
    }

    this.syncInProgress = true;
    console.log(
      "🔄 Début synchronisation pour utilisateur:",
      auth.currentUser.uid,
    );

    try {
      // Synchroniser uniquement les données de l'utilisateur connecté
      await this.syncMerchants();
      await this.syncDeliveries();
    } catch (error) {
      console.error("❌ Erreur synchronisation:", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async markForSync(table: string, id: number) {
    await db.runAsync(`UPDATE ${table} SET needs_sync = 1 WHERE id = ?`, [id]);

    // Ajouter à la queue
    this.syncQueue.push({ table, id });

    // Debounce la synchronisation
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.processSyncQueue();
    }, this.SYNC_DEBOUNCE);
  }

  async syncMerchantNow(merchantId: number) {
    if (!this.isOnline || !auth.currentUser) {
      console.log("⏭️ Sync commerçant ignorée: hors ligne");
      return null;
    }

    try {
      console.log(`🔄 Synchronisation forcée du commerçant ${merchantId}...`);

      const merchant = await db.getFirstAsync<any>(
        "SELECT * FROM merchants WHERE id = ? AND user_id = ?",
        [merchantId, auth.currentUser.uid],
      );

      if (!merchant) {
        console.log("❌ Commerçant non trouvé");
        return null;
      }

      // Si déjà synchronisé, retourner l'ID Firebase
      if (merchant.firebase_id) {
        console.log(
          `✅ Commerçant déjà synchronisé avec Firebase ID: ${merchant.firebase_id}`,
        );
        return merchant.firebase_id;
      }

      // Créer dans Firebase
      const firestoreData = {
        name: merchant.name,
        phone: merchant.phone,
        address: merchant.address,
        user_id: auth.currentUser.uid,
        created_at: merchant.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const docRef = doc(collection(firestore, "merchants"));
      await setDoc(docRef, firestoreData);

      // Mettre à jour le firebase_id local
      await db.runAsync(
        `UPDATE merchants SET firebase_id = ?, needs_sync = 0 WHERE id = ?`,
        [docRef.id, merchant.id],
      );

      console.log(`✅ Commerçant synchronisé avec Firebase ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error(`❌ Erreur sync commerçant ${merchantId}:`, error);
      return null;
    }
  }

  private async processSyncQueue() {
    if (this.syncQueue.length === 0 || !this.isOnline) return;

    console.log(
      `🔄 Traitement de ${this.syncQueue.length} éléments en attente...`,
    );
    this.syncQueue = [];
    await this.syncAll();
  }

  private async syncDeliveries() {
    const items = await db.getAllAsync<any>(
      `SELECT * FROM deliveries WHERE needs_sync = 1 LIMIT 20`, // Limiter pour performance
    );

    if (items.length === 0) return;
    console.log(`🔄 Synchronisation de ${items.length} livraisons...`);

    const promises = items.map((item) => this.syncSingleDelivery(item));
    await Promise.all(promises);
  }

  private async syncSingleDelivery(item: any) {
    try {
      console.log(
        `🔄 Synchronisation livraison ${item.id}, merchant_id local:`,
        item.merchant_id,
      );

      // 🔥 Si un merchant_id existe mais pas de firebase_id, le synchroniser d'abord
      let merchantFirebaseId = null;
      if (item.merchant_id) {
        const merchant = await db.getFirstAsync<{ firebase_id: string }>(
          "SELECT firebase_id FROM merchants WHERE id = ?",
          [item.merchant_id],
        );

        if (merchant && !merchant.firebase_id) {
          // 🔥 Le commerçant n'est pas encore synchronisé, le faire maintenant
          console.log(
            `⚠️ Commerçant ${item.merchant_id} non synchronisé, synchronisation forcée...`,
          );
          merchantFirebaseId = await this.syncMerchantNow(item.merchant_id);
        } else {
          merchantFirebaseId = merchant?.firebase_id;
        }

        console.log(
          `🏪 Merchant local ${item.merchant_id} -> Firebase ID:`,
          merchantFirebaseId,
        );
      }

      const firestoreData = {
        recipient_name: item.recipient_name,
        phone: item.phone,
        address: item.address,
        parcel_value: item.parcel_value,
        delivery_fee: item.delivery_fee,
        merchant_id: merchantFirebaseId,
        payment_type: item.payment_type,
        amount_collected: item.amount_collected,
        amount_to_return: item.amount_to_return,
        profit: item.profit,
        status: item.status,
        created_at: item.created_at,
        delivered_at: item.delivered_at,
        user_id: auth.currentUser?.uid,
        updated_at: new Date().toISOString(),
      };

      console.log("📤 Envoi à Firebase:", firestoreData);

      if (item.firebase_id) {
        await updateDoc(
          doc(firestore, "deliveries", item.firebase_id),
          firestoreData,
        );
        await db.runAsync(`UPDATE deliveries SET needs_sync = 0 WHERE id = ?`, [
          item.id,
        ]);
      } else {
        const docRef = doc(collection(firestore, "deliveries"));
        await setDoc(docRef, {
          ...firestoreData,
          created_at: item.created_at || new Date().toISOString(),
        });
        await db.runAsync(
          `UPDATE deliveries SET firebase_id = ?, needs_sync = 0 WHERE id = ?`,
          [docRef.id, item.id],
        );
      }
      console.log(`✅ Livraison ${item.id} synchronisée`);
    } catch (error) {
      console.error(`❌ Erreur sync livraison ${item.id}:`, error);
    }
  }

  private async syncMerchants() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const items = await db.getAllAsync<any>(
      `SELECT * FROM merchants 
       WHERE user_id = ? AND needs_sync = 1`,
      [userId],
    );

    if (items.length === 0) return;
    console.log(`🔄 Synchronisation de ${items.length} commerçants...`);

    const promises = items.map((item) => this.syncSingleMerchant(item));
    await Promise.all(promises);
  }

  private async syncSingleMerchant(item: any) {
    try {
      const firestoreData = {
        name: item.name,
        phone: item.phone,
        address: item.address,
        user_id: auth.currentUser?.uid,
        updated_at: new Date().toISOString(),
      };

      if (item.firebase_id) {
        // Mise à jour
        await updateDoc(
          doc(firestore, "merchants", item.firebase_id),
          firestoreData,
        );
        await db.runAsync(`UPDATE merchants SET needs_sync = 0 WHERE id = ?`, [
          item.id,
        ]);
      } else {
        // Nouveau commerçant
        const docRef = doc(collection(firestore, "merchants"));
        await setDoc(docRef, {
          ...firestoreData,
          created_at: item.created_at || new Date().toISOString(),
        });

        await db.runAsync(
          `UPDATE merchants SET firebase_id = ?, needs_sync = 0 WHERE id = ?`,
          [docRef.id, item.id],
        );
      }
    } catch (error) {
      console.error(`❌ Erreur sync commerçant ${item.id}:`, error);
    }
  }

  // Réinitialiser la queue (utile pour les tests)
  clearQueue() {
    this.syncQueue = [];
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }
}

export const syncService = new SyncService();
