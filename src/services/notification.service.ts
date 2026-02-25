import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { db } from '../database/db';
import { NotificationStore } from './notification.store';

// Définition des noms des tâches en arrière-plan
const BACKGROUND_FETCH_TASK = 'check-delivery-reminder';
const ENCOURAGEMENT_TASK = 'send-encouragement-notifications';

/**
 * 1. CONFIGURATION INITIALE
 */
export const setupNotifications = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('⚠️ Permissions de notifications non accordées');
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    console.log('✅ Notifications configurées');
  } catch (error) {
    console.error('❌ Erreur configuration notifications:', error);
  }
};

/**
 * 2. LOGIQUE DE VÉRIFICATION
 */

const checkPendingDeliveries = async (userId: number) => {
  try {
    const pendingData = await db.getAllAsync<{ count: number; oldest_hours: number }>(
      `SELECT COUNT(*) as count,
       ROUND((JULIANDAY('now') - JULIANDAY(MIN(created_at))) * 24) as oldest_hours
       FROM deliveries WHERE user_id = ? AND status = 'A_LIVRER'`,
      [userId]
    );
    return pendingData[0]?.count > 0 ? pendingData[0] : null;
  } catch (e) { return null; }
};

export const sendPendingReminderNotification = async (userId: number) => {
  try {
    const user = await db.getFirstAsync<{ name: string; reminder_notifications: number }>(
      'SELECT name, reminder_notifications FROM user WHERE id = ?', [userId]
    );

    if (!user || user.reminder_notifications !== 1) return;

    const pending = await checkPendingDeliveries(userId);
    if (!pending) return;

    let title = '📦 Livraisons en attente';
    let body = `Vous avez ${pending.count} livraison(s) à traiter.`;

    if (pending.oldest_hours >= 24) body = `Attention ! ${pending.count} livraisons attendent depuis plus de 24h.`;

    const notificationId = await NotificationStore.add({
      type: 'pending_reminder',
      title,
      body,
      data: { count: pending.count },
      userId
    });

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { type: 'pending_reminder', notificationId }, sound: true },
      trigger: null,
    });
  } catch (error) { console.error('❌ Erreur rappel:', error); }
};

/**
 * 3. NOTIFICATIONS MANUELLES (Appelées depuis deliveries.tsx)
 */

// --- CETTE FONCTION MANQUAIT ET CAUSAIT L'ERREUR ---
export const sendDeliveryCompletedNotification = async (userId: number, amount: number) => {
  try {
    // 1. Calculer le total du jour pour un message plus informatif
    const today = new Date().toISOString().split('T')[0];
    const stats = await db.getFirstAsync<{ total: number }>(
      "SELECT SUM(delivery_fee) as total FROM deliveries WHERE user_id = ? AND status = 'LIVREE' AND date(delivered_at) = ?",
      [userId, today]
    );

    const title = '✅ Livraison terminée';
    const body = `+${amount.toLocaleString('fr-FR')} FCFA. Total aujourd'hui: ${(stats?.total || amount).toLocaleString('fr-FR')} FCFA`;

    // 2. Stocker en base
    const notificationId = await NotificationStore.add({
      type: 'delivery_progress',
      title,
      body,
      data: { amount, totalDay: stats?.total },
      userId
    });

    // 3. Envoyer le push
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'delivery_progress', notificationId, userId },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('❌ Erreur notification delivery completed:', error);
  }
};

export const sendDeliveryCreatedNotification = async (userId: number, count: number) => {
  try {
    const title = '✅ Livraison enregistrée';
    const body = `Nouvelle livraison ajoutée. Total en attente : ${count}`;
    
    const notificationId = await NotificationStore.add({
      type: 'delivery_created', title, body, data: { count }, userId
    });

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { notificationId }, sound: true },
      trigger: null,
    });
  } catch (error) {
    console.error('❌ Erreur notification delivery created:', error);
  }
};

/**
 * 4. TÂCHES BACKGROUND
 */

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const tableCheck = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='user'");
    if (!tableCheck) return BackgroundFetch.BackgroundFetchResult.NoData;

    const users = await db.getAllAsync<{ id: number }>('SELECT id FROM user WHERE reminder_notifications = 1');
    for (const user of users) {
      await sendPendingReminderNotification(user.id);
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

TaskManager.defineTask(ENCOURAGEMENT_TASK, async () => {
  try {
    const tableCheck = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='user'");
    if (!tableCheck) return BackgroundFetch.BackgroundFetchResult.NoData;
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const setupBackgroundTask = async () => {
  try {
    const isRappelRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (!isRappelRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 6 * 60 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
    console.log('✅ Tâches de fond enregistrées');
  } catch (error) {
    console.error('❌ Erreur BackgroundTask:', error);
  }
};

export const resetNotificationBadge = async () => {
  await Notifications.setBadgeCountAsync(0);
};