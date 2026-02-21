import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { db } from '../database/db';
import { NotificationStore } from './notification.store';

// Définition des tâches en arrière-plan
const BACKGROUND_FETCH_TASK = 'check-delivery-reminder';
const ENCOURAGEMENT_TASK = 'send-encouragement-notifications';

// Configurer les notifications
export const setupNotifications = async () => {
  try {
    // Initialiser la table des notifications
    await NotificationStore.initTable();
    
    // Demander les permissions
    const { status } = await Notifications.requestPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Permissions de notifications non accordées');
      return;
    }

    // Configurer le gestionnaire de notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,  // Ajouté pour iOS
        shouldShowList: true,    // Ajouté pour iOS
      }),
    });

    console.log('✅ Notifications configurées');
  } catch (error) {
    console.error('❌ Erreur configuration notifications:', error);
  }
};

// ==============================================
// 1. VÉRIFICATION LIVRAISONS EN ATTENTE (RAPPEL TÂCHES)
// ==============================================

// Vérifier les livraisons en attente (A_LIVRER)
const checkPendingDeliveries = async (userId: number): Promise<{
  hasPending: boolean;
  pendingCount: number;
  oldestPendingHours: number;
}> => {
  try {
    const pendingData = await db.getAllAsync<{
      count: number;
      oldest_hours: number;
    }>(
      `SELECT 
        COUNT(*) as count,
        ROUND((JULIANDAY('now') - JULIANDAY(MIN(created_at))) * 24) as oldest_hours
       FROM deliveries 
       WHERE user_id = ? AND status = 'A_LIVRER'`,
      [userId]
    );

    if (pendingData.length === 0 || !pendingData[0].count) {
      return { hasPending: false, pendingCount: 0, oldestPendingHours: 0 };
    }

    const data = pendingData[0];
    const pendingCount = data.count || 0;

    return {
      hasPending: true,
      pendingCount,
      oldestPendingHours: data.oldest_hours || 0
    };
  } catch (error) {
    console.error('❌ Erreur vérification livraisons en attente:', error);
    return { hasPending: false, pendingCount: 0, oldestPendingHours: 0 };
  }
};

// Envoyer notification pour livraisons en attente
export const sendPendingReminderNotification = async (userId: number) => {
  try {
    const user = await db.getFirstAsync<{
      name: string;
      reminder_notifications: number;
    }>(
      'SELECT name, reminder_notifications FROM user WHERE id = ?',
      [userId]
    );

    if (!user || user.reminder_notifications !== 1) {
      console.log('📵 Notifications de rappel désactivées');
      return;
    }

    const pending = await checkPendingDeliveries(userId);
    
    if (!pending.hasPending) {
      return;
    }

    // Envoyer une notification si des livraisons sont en attente
    let title = '📦 Livraisons en attente';
    let body = '';
    
    if (pending.oldestPendingHours >= 24) {
      body = `${pending.pendingCount} livraison(s) en retard de plus de 24h !`;
    } else if (pending.oldestPendingHours >= 12) {
      body = `Vous avez ${pending.pendingCount} livraison(s) en attente depuis ${Math.floor(pending.oldestPendingHours)}h`;
    } else if (pending.oldestPendingHours >= 6) {
      body = `${pending.pendingCount} livraison(s) à traiter`;
    } else {
      // Pas de notification si moins de 6h
      return;
    }

    // Stocker dans la base
    const notificationId = await NotificationStore.add({
      type: 'pending_reminder',
      title,
      body,
      data: { pendingCount: pending.pendingCount, hours: pending.oldestPendingHours },
      userId
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'pending_reminder', 
          notificationId,
          userId,
          pendingCount: pending.pendingCount
        },
        sound: true,
        badge: pending.pendingCount,
      },
      trigger: null,
    });

    console.log(`📨 Rappel tâches envoyé: ${pending.pendingCount} en attente`);
  } catch (error) {
    console.error('❌ Erreur notification rappel tâches:', error);
  }
};

// ==============================================
// 2. VÉRIFICATION INACTIVITÉ DE SAISIE (RAPPEL SAISIES)
// ==============================================

// Vérifier si l'utilisateur a des livraisons récentes (24h)
const checkRecentDeliveries = async (userId: number): Promise<{
  hasRecent: boolean;
  recentCount: number;
  hoursSinceLast: number;
}> => {
  try {
    // Calculer la date il y a 24 heures
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Vérifier les livraisons créées dans les 24h
    const recentDeliveries = await db.getAllAsync<{
      count: number;
      last_created: string;
    }>(
      `SELECT 
        COUNT(*) as count,
        MAX(created_at) as last_created
       FROM deliveries 
       WHERE user_id = ? AND created_at >= ?`,
      [userId, twentyFourHoursAgo.toISOString()]
    );

    const count = recentDeliveries[0]?.count || 0;
    const lastCreated = recentDeliveries[0]?.last_created;
    
    let hoursSinceLast = 24; // Par défaut 24h si aucune activité
    
    if (lastCreated) {
      const lastDate = new Date(lastCreated);
      const now = new Date();
      hoursSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60));
    }

    return {
      hasRecent: count > 0,
      recentCount: count,
      hoursSinceLast: hoursSinceLast
    };
  } catch (error) {
    console.error('❌ Erreur vérification livraisons récentes:', error);
    return { hasRecent: false, recentCount: 0, hoursSinceLast: 24 };
  }
};

// Envoyer une notification de rappel d'inactivité
export const sendInactivityReminderNotification = async (userId: number) => {
  try {
    const user = await db.getFirstAsync<{
      name: string;
      reminder_notifications: number;
    }>(
      'SELECT name, reminder_notifications FROM user WHERE id = ?',
      [userId]
    );

    if (!user || user.reminder_notifications !== 1) {
      console.log('📵 Notifications de rappel désactivées');
      return;
    }

    const recent = await checkRecentDeliveries(userId);
    
    // Si pas d'activité récente, envoyer une notification
    if (!recent.hasRecent) {
      const title = '📦 Rappel de livraison';
      const body = `Bonjour ${user.name}, n'oubliez pas de saisir vos livraisons du jour !`;

      // Stocker dans la base
      const notificationId = await NotificationStore.add({
        type: 'inactivity_reminder',
        title,
        body,
        data: { hoursSinceLast: recent.hoursSinceLast },
        userId
      });

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { 
            type: 'inactivity_reminder', 
            notificationId,
            userId 
          },
          sound: true,
          badge: 1,
        },
        trigger: null,
      });
      
      console.log('📨 Rappel saisie envoyé (inactivité 24h)');
      return;
    }
    
    // Si activité il y a plus de 12h
    if (recent.hoursSinceLast >= 12) {
      const title = '⏰ Rappel de saisie';
      const body = `Il est temps d'ajouter de nouvelles livraisons ! (${recent.hoursSinceLast}h)`;

      // Stocker dans la base
      const notificationId = await NotificationStore.add({
        type: 'reminder_12h',
        title,
        body,
        data: { hoursSinceLast: recent.hoursSinceLast },
        userId
      });

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { 
            type: 'reminder_12h', 
            notificationId,
            userId 
          },
          sound: true,
        },
        trigger: null,
      });
      
      console.log(`📨 Rappel saisie envoyé (${recent.hoursSinceLast}h sans nouvelle)`);
    }
  } catch (error) {
    console.error('❌ Erreur notification rappel saisie:', error);
  }
};

// ==============================================
// 3. NOTIFICATIONS POUR NOUVELLES SAISIES (ENCOURAGEMENT)
// ==============================================

// Vérifier l'activité récente pour encouragement
const checkActivityForEncouragement = async (userId: number): Promise<{
  recentCreated: number;
  recentCompleted: number;
  totalToday: number;
}> => {
  try {
    // Dernières 2 heures
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

    // Aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [createdResult, completedResult, todayResult] = await Promise.all([
      db.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM deliveries 
         WHERE user_id = ? AND created_at >= ?`,
        [userId, twoHoursAgo.toISOString()]
      ),
      db.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM deliveries 
         WHERE user_id = ? AND status = 'LIVREE' AND delivered_at >= ?`,
        [userId, twoHoursAgo.toISOString()]
      ),
      db.getAllAsync<{ total: number }>(
        `SELECT COALESCE(SUM(delivery_fee), 0) as total FROM deliveries 
         WHERE user_id = ? AND status = 'LIVREE' AND delivered_at >= ?`,
        [userId, today.toISOString()]
      )
    ]);

    return {
      recentCreated: createdResult[0]?.count || 0,
      recentCompleted: completedResult[0]?.count || 0,
      totalToday: todayResult[0]?.total || 0
    };
  } catch (error) {
    console.error('❌ Erreur vérification activité encouragement:', error);
    return { recentCreated: 0, recentCompleted: 0, totalToday: 0 };
  }
};

// Envoyer notification d'encouragement
export const sendEncouragementNotification = async (userId: number) => {
  try {
    const user = await db.getFirstAsync<{
      name: string;
      payment_notifications: number;
    }>(
      'SELECT name, payment_notifications FROM user WHERE id = ?',
      [userId]
    );

    if (!user || user.payment_notifications !== 1) {
      return;
    }

    const activity = await checkActivityForEncouragement(userId);
    
    // Si activité récente, envoyer encouragement
    if (activity.recentCreated > 0 || activity.recentCompleted > 0) {
      let title = '';
      let body = '';
      
      if (activity.recentCreated >= 3) {
        title = '🚀 Super rythme !';
        body = `${activity.recentCreated} nouvelles livraisons ajoutées, continuez !`;
      } else if (activity.recentCreated > 0) {
        title = '📝 Bon travail !';
        body = 'Nouvelle(s) livraison(s) ajoutée(s), excellent !';
      } else if (activity.recentCompleted > 0) {
        title = '🎉 Progression !';
        body = `${activity.recentCompleted} livraison(s) terminée(s) aujourd'hui`;
      }

      // Stocker dans la base
      const notificationId = await NotificationStore.add({
        type: 'encouragement',
        title,
        body,
        data: { 
          recentCreated: activity.recentCreated, 
          recentCompleted: activity.recentCompleted,
          totalToday: activity.totalToday
        },
        userId
      });

      // Délai de 30 secondes
      setTimeout(async () => {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: { 
                type: 'encouragement', 
                notificationId,
                userId,
                recentCreated: activity.recentCreated,
                recentCompleted: activity.recentCompleted
              },
              sound: true,
            },
            trigger: null,
          });
        } catch (notificationError) {
          console.error('❌ Erreur notification encouragement retardée:', notificationError);
        }
      }, 30000);

      console.log(`💪 Encouragement programmé dans 30s: ${activity.recentCreated} nouvelles, ${activity.recentCompleted} terminées`);
    }
  } catch (error) {
    console.error('❌ Erreur notification encouragement:', error);
  }
};

// ==============================================
// 4. NOTIFICATIONS POUR LIVRAISONS TERMINÉES (CONFIRMATION)
// ==============================================

// Version améliorée : Notification de progression
export const sendDeliveryCompletedNotification = async (userId: number, amount: number) => {
  try {
    const user = await db.getFirstAsync<{
      name: string;
      payment_notifications: number;
    }>(
      'SELECT name, payment_notifications FROM user WHERE id = ?',
      [userId]
    );

    if (!user || user.payment_notifications !== 1) {
      return;
    }

    // Calculer la progression du jour
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [todayStats, pendingStats] = await Promise.all([
      db.getAllAsync<{ total: number; count: number }>(
        `SELECT 
          COALESCE(SUM(delivery_fee), 0) as total,
          COUNT(*) as count
         FROM deliveries 
         WHERE user_id = ? AND status = 'LIVREE' AND delivered_at >= ?`,
        [userId, today.toISOString()]
      ),
      db.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM deliveries 
         WHERE user_id = ? AND status = 'A_LIVRER'`,
        [userId]
      )
    ]);

    const todayTotal = todayStats[0]?.total || 0;
    const todayCount = todayStats[0]?.count || 0;
    const pendingCount = pendingStats[0]?.count || 0;

    let title = '✅ Livraison terminée';
    let body = '';
    
    if (pendingCount === 0) {
      body = `Aujourd'hui : ${todayCount} livraison(s) • ${todayTotal.toLocaleString('fr-FR')} FCFA`;
    } else {
      body = `En attente : ${pendingCount} • Aujourd'hui : ${todayTotal.toLocaleString('fr-FR')} FCFA`;
    }

    // Stocker dans la base
    const notificationId = await NotificationStore.add({
      type: 'delivery_progress',
      title,
      body,
      data: { 
        amount, 
        todayTotal, 
        todayCount, 
        pendingCount 
      },
      userId
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'delivery_progress', 
          notificationId,
          userId,
          amount,
          todayTotal,
          todayCount,
          pendingCount
        },
        sound: true,
        badge: pendingCount,
      },
      trigger: null,
    });

    console.log(`📊 Notification progression: ${amount} FCFA, ${pendingCount} restantes`);
  } catch (error) {
    console.error('❌ Erreur notification progression:', error);
  }
};

// ==============================================
// TÂCHES EN ARRIÈRE-PLAN
// ==============================================

// Tâche 1: Vérification rappels (6h)
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('🔄 Vérification des rappels (toutes les 6h)...');
    
    const users = await db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM user WHERE reminder_notifications = 1'
    );

    for (const user of users) {
      // 1. Vérifier inactivité de saisie
      await sendInactivityReminderNotification(user.id);
      
      // 2. Vérifier livraisons en attente
      await sendPendingReminderNotification(user.id);
    }

    console.log('✅ Vérification des rappels terminée');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Erreur vérification rappels:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Tâche 2: Encouragement (2h)
TaskManager.defineTask(ENCOURAGEMENT_TASK, async () => {
  try {
    console.log('💪 Vérification pour encouragement (toutes les 2h)...');
    
    const users = await db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM user WHERE payment_notifications = 1'
    );

    for (const user of users) {
      await sendEncouragementNotification(user.id);
    }

    console.log('✅ Vérification encouragement terminée');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Erreur vérification encouragement:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ==============================================
// CONFIGURATION
// ==============================================

// Configurer les tâches en arrière-plan
export const setupBackgroundTask = async () => {
  try {
    console.log('🔄 Configuration des tâches en arrière-plan...');

    // Tâche 1: Rappels (6h)
    if (!await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK)) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 6 * 60 * 60, // 6 heures
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('✅ Tâche rappels enregistrée (6h)');
    }

    // Tâche 2: Encouragement (2h)
    if (!await TaskManager.isTaskRegisteredAsync(ENCOURAGEMENT_TASK)) {
      await BackgroundFetch.registerTaskAsync(ENCOURAGEMENT_TASK, {
        minimumInterval: 2 * 60 * 60, // 2 heures
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('✅ Tâche encouragement enregistrée (2h)');
    }

    // Exécuter une vérification immédiate au démarrage
    await checkAndSendInitialNotifications();

  } catch (error) {
    console.error('❌ Erreur configuration tâche arrière-plan:', error);
  }
};

// Vérifications initiales au démarrage
const checkAndSendInitialNotifications = async () => {
  try {
    console.log('▶️ Vérifications initiales au démarrage...');
    
    const users = await db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM user WHERE reminder_notifications = 1'
    );

    for (const user of users) {
      await sendInactivityReminderNotification(user.id);
      await sendPendingReminderNotification(user.id);
    }

    const usersPayment = await db.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM user WHERE payment_notifications = 1'
    );

    for (const user of usersPayment) {
      await sendEncouragementNotification(user.id);
    }

    console.log('✅ Vérifications initiales terminées');
  } catch (error) {
    console.error('❌ Erreur vérifications initiales:', error);
  }
};

// ==============================================
// NOTIFICATIONS MANUELLES
// ==============================================

// Envoyer une notification de succès après création de livraison
export const sendDeliveryCreatedNotification = async (userId: number, deliveryCount: number) => {
  try {
    const user = await db.getFirstAsync<{
      name: string;
      payment_notifications: number;
    }>(
      'SELECT name, payment_notifications FROM user WHERE id = ?',
      [userId]
    );

    if (!user || user.payment_notifications !== 1) {
      return;
    }

    const title = '✅ Livraison enregistrée';
    const body = `Vous avez ${deliveryCount} livraison(s) en attente de traitement.`;

    // Stocker dans la base
    const notificationId = await NotificationStore.add({
      type: 'delivery_created',
      title,
      body,
      data: { deliveryCount },
      userId
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'delivery_created', 
          notificationId,
          userId, 
          deliveryCount 
        },
        sound: true,
      },
      trigger: null,
    });

    console.log(`📝 Notification création: ${deliveryCount} livraison(s)`);
  } catch (error) {
    console.error('❌ Erreur notification création:', error);
  }
};

// Notification toutes les livraisons terminées
export const sendAllDeliveriesCompletedNotification = async (userId: number) => {
  try {
    const user = await db.getFirstAsync<{
      name: string;
      payment_notifications: number;
    }>(
      'SELECT name, payment_notifications FROM user WHERE id = ?',
      [userId]
    );

    if (!user || user.payment_notifications !== 1) {
      return;
    }

    const title = '🏆 Bravo !';
    const body = 'Toutes vos livraisons sont terminées !';

    // Stocker dans la base
    const notificationId = await NotificationStore.add({
      type: 'all_completed',
      title,
      body,
      data: {},
      userId
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'all_completed', 
          notificationId,
          userId 
        },
        sound: true,
        badge: 0,
      },
      trigger: null,
    });

    console.log('🏆 Notification toutes terminées');
  } catch (error) {
    console.error('❌ Erreur notification toutes terminées:', error);
  }
};

// Réinitialiser les badges
export const resetNotificationBadge = async () => {
  await Notifications.setBadgeCountAsync(0);
};