// src/services/sync.service.ts
import { db } from '../database/db';
import { auth, db as firestore } from '../config/firebase';
import NetInfo from '@react-native-community/netinfo';
import { collection, doc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';

class SyncService {
  private isOnline: boolean = true;

  constructor() {
    // Écouter les changements de connexion
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      if (this.isOnline) {
        console.log('📶 En ligne - synchronisation...');
        this.syncAll();
      }
    });
  }

  // 🔥 NOUVELLE FONCTION : Importer les données depuis Firebase
  async importFromFirebase() {
    if (!auth.currentUser) {
      console.log('⏭️ Import ignoré: utilisateur non connecté');
      return;
    }

    console.log('📥 Import des données depuis Firebase...');

    try {
      // Importer les commerçants
      console.log('📦 Import des commerçants...');
      const merchantsQuery = query(
        collection(firestore, 'merchants'),
        where('user_id', '==', auth.currentUser.uid)
      );
      const merchantsSnapshot = await getDocs(merchantsQuery);
      
      let merchantCount = 0;
      for (const doc of merchantsSnapshot.docs) {
        const data = doc.data();
        
        // Vérifier si le commerçant existe déjà en local
        const existing = await db.getFirstAsync<any>(
          'SELECT id FROM merchants WHERE firebase_id = ?',
          [doc.id]
        );

        if (!existing) {
          await db.runAsync(
            `INSERT INTO merchants 
             (name, phone, address, firebase_id, user_id, created_at, needs_sync) 
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
              data.name || '',
              data.phone || '',
              data.address || '',
              doc.id,
              auth.currentUser.uid,
              data.created_at || new Date().toISOString()
            ]
          );
          merchantCount++;
        }
      }
      console.log(`✅ ${merchantCount} commerçants importés`);

      // Importer les livraisons
      console.log('📦 Import des livraisons...');
      const deliveriesQuery = query(
        collection(firestore, 'deliveries'),
        where('user_id', '==', auth.currentUser.uid)
      );
      const deliveriesSnapshot = await getDocs(deliveriesQuery);

      let deliveryCount = 0;
      for (const doc of deliveriesSnapshot.docs) {
        const data = doc.data();
        
        // Vérifier si la livraison existe déjà en local
        const existing = await db.getFirstAsync<any>(
          'SELECT id FROM deliveries WHERE firebase_id = ?',
          [doc.id]
        );

        if (!existing) {
          // Trouver l'ID local du commerçant si nécessaire
          let localMerchantId = null;
          if (data.merchant_id) {
            const merchant = await db.getFirstAsync<{ id: number }>(
              'SELECT id FROM merchants WHERE firebase_id = ?',
              [data.merchant_id]
            );
            localMerchantId = merchant?.id || null;
          }

          await db.runAsync(
            `INSERT INTO deliveries 
             (recipient_name, phone, address, parcel_value, delivery_fee, 
              merchant_id, payment_type, amount_collected, amount_to_return,
              profit, status, created_at, delivered_at, user_id, firebase_id, needs_sync)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              data.recipient_name || '',
              data.phone || '',
              data.address || '',
              data.parcel_value || 0,
              data.delivery_fee || 0,
              localMerchantId,
              data.payment_type || 'CLIENT_PAYE_TOUT',
              data.amount_collected || 0,
              data.amount_to_return || 0,
              data.profit || 0,
              data.status || 'A_LIVRER',
              data.created_at || new Date().toISOString(),
              data.delivered_at || null,
              auth.currentUser.uid,
              doc.id
            ]
          );
          deliveryCount++;
        }
      }

      console.log(`✅ ${deliveryCount} livraisons importées`);
      console.log('📥 Import terminé avec succès');

    } catch (error) {
      console.error('❌ Erreur import:', error);
      throw error;
    }
  }

  async syncAll() {
    if (!this.isOnline || !auth.currentUser) return;
    
    try {
      console.log('🔄 Synchronisation...');
      await this.syncDeliveries();
      await this.syncMerchants();
    } catch (error) {
      console.error('❌ Erreur sync:', error);
    }
  }

  private async syncDeliveries() {
    const items = await db.getAllAsync<any>(
      `SELECT * FROM deliveries WHERE needs_sync = 1`
    );

    if (items.length === 0) return;
    console.log(`🔄 Synchronisation de ${items.length} livraisons...`);

    for (const item of items) {
      try {
        // Récupérer le firebase_id du commerçant
        let merchantFirebaseId = null;
        if (item.merchant_id) {
          const merchant = await db.getFirstAsync<{ firebase_id: string }>(
            'SELECT firebase_id FROM merchants WHERE id = ?',
            [item.merchant_id]
          );
          merchantFirebaseId = merchant?.firebase_id;
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
          updated_at: new Date().toISOString()
        };

        if (item.firebase_id) {
          // Mise à jour
          await updateDoc(doc(firestore, 'deliveries', item.firebase_id), firestoreData);
          await db.runAsync(
            `UPDATE deliveries SET needs_sync = 0 WHERE id = ?`,
            [item.id]
          );
        } else {
          // Nouvelle livraison
          const docRef = doc(collection(firestore, 'deliveries'));
          await setDoc(docRef, {
            ...firestoreData,
            created_at: item.created_at || new Date().toISOString()
          });
          
          await db.runAsync(
            `UPDATE deliveries SET firebase_id = ?, needs_sync = 0 WHERE id = ?`,
            [docRef.id, item.id]
          );
        }
      } catch (error) {
        console.error(`❌ Erreur sync livraison ${item.id}:`, error);
      }
    }
  }

  private async syncMerchants() {
    const items = await db.getAllAsync<any>(
      `SELECT * FROM merchants WHERE needs_sync = 1`
    );

    if (items.length === 0) return;
    console.log(`🔄 Synchronisation de ${items.length} commerçants...`);

    for (const item of items) {
      try {
        const firestoreData = {
          name: item.name,
          phone: item.phone,
          address: item.address,
          user_id: auth.currentUser?.uid,
          updated_at: new Date().toISOString()
        };

        if (item.firebase_id) {
          // Mise à jour
          await updateDoc(doc(firestore, 'merchants', item.firebase_id), firestoreData);
          await db.runAsync(
            `UPDATE merchants SET needs_sync = 0 WHERE id = ?`,
            [item.id]
          );
        } else {
          // Nouveau commerçant
          const docRef = doc(collection(firestore, 'merchants'));
          await setDoc(docRef, {
            ...firestoreData,
            created_at: item.created_at || new Date().toISOString()
          });
          
          await db.runAsync(
            `UPDATE merchants SET firebase_id = ?, needs_sync = 0 WHERE id = ?`,
            [docRef.id, item.id]
          );
        }
      } catch (error) {
        console.error(`❌ Erreur sync commerçant ${item.id}:`, error);
      }
    }
  }

  async markForSync(table: string, id: number) {
    await db.runAsync(`UPDATE ${table} SET needs_sync = 1 WHERE id = ?`, [id]);
    if (this.isOnline) this.syncAll();
  }
}

export const syncService = new SyncService();