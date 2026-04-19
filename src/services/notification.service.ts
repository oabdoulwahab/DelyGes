import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications"; // Import nécessaire
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { db } from "../database/db";
import { NotificationStore } from "./notification.store";

const BACKGROUND_FETCH_TASK = "check-delivery-reminder";

export const setupNotifications = async () => {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Alertes Livraisons",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
      });
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

    console.log("✅ Notifications configurées");
  } catch (error) {
    console.error("❌ Erreur setup notifications:", error);
  }
};

const checkPendingDeliveries = async (userId: number) => {
  try {
    const pendingData = await db.getAllAsync<{
      count: number;
      oldest_hours: number;
    }>(
      `SELECT COUNT(*) as count,
       ROUND((JULIANDAY('now') - JULIANDAY(MIN(created_at))) * 24) as oldest_hours
       FROM deliveries WHERE user_id = ? AND status = 'A_LIVRER'`,
      [userId],
    );
    return pendingData[0]?.count > 0 ? pendingData[0] : null;
  } catch (e) {
    return null;
  }
};

export const sendPendingReminderNotification = async (userId: number) => {
  try {
    const user = await db.getFirstAsync<{
      name: string;
      reminder_notifications: number;
    }>("SELECT name, reminder_notifications FROM user WHERE id = ?", [userId]);

    if (!user || user.reminder_notifications !== 1) return;

    const pending = await checkPendingDeliveries(userId);
    if (!pending) return;

    let title = "📦 Livraisons en attente";
    let body = `Bonjour ${user.name}, vous avez ${pending.count} livraison(s) à traiter.`;

    if (pending.oldest_hours >= 24) {
      body = `Attention ! ${pending.count} livraisons attendent depuis plus de 24h.`;
    }

    const notificationId = await NotificationStore.add({
      type: "pending_reminder",
      title,
      body,
      data: { count: pending.count },
      userId,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "pending_reminder", notificationId },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error("❌ Erreur rappel:", error);
  }
};

export const sendDeliveryCompletedNotification = async (
  userId: number,
  amount: number,
) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const stats = await db.getFirstAsync<{ total: number }>(
      "SELECT SUM(delivery_fee) as total FROM deliveries WHERE user_id = ? AND status = 'LIVREE' AND date(delivered_at) = ?",
      [userId, today],
    );

    const title = "✅ Livraison terminée";
    const body = `+${amount.toLocaleString("fr-FR")} FCFA. Total jour: ${(stats?.total || amount).toLocaleString("fr-FR")} FCFA`;

    const notificationId = await NotificationStore.add({
      type: "delivery_progress",
      title,
      body,
      data: { amount, totalDay: stats?.total },
      userId,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "delivery_progress", notificationId, userId },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
  }
};

export const sendDeliveryCreatedNotification = async (
  userId: number,
  count: number,
) => {
  try {
    const title = "✅ Livraison enregistrée";
    const body = `Nouvelle livraison ajoutée. En attente : ${count}`;

    const notificationId = await NotificationStore.add({
      type: "delivery_created",
      title,
      body,
      data: { count },
      userId,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "delivery_created", notificationId },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.error("❌ Erreur:", error);
  }
};

export const scheduleInactivityReminders = async (userId: number) => {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Rappel : 24h
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "On vous attend ! 👋",
      body: "Cela fait 24h que vous ne vous êtes pas connecté.",
      data: { type: "inactivity_reminder", step: 1 },
    },
    trigger: {
      seconds: 24 * 3600,
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
    } as Notifications.TimeIntervalTriggerInput,
  });

  // Rappel : +8h
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Petit rappel 🔔",
      body: "Toujours aucune activité ? Venez voir vos livraisons !",
      data: { type: "inactivity_reminder", step: 2 },
    },
    trigger: {
      seconds: 32 * 3600,
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
    } as Notifications.TimeIntervalTriggerInput,
  });
};

export const sendGoalAchievedNotification = async (
  userId: number,
  amount: number,
  goal: number,
) => {
  try {
    const user = await db.getFirstAsync<{
      name: string;
      daily_goal: number;
      daily_goal_notifications?: number;
    }>(
      "SELECT name, daily_goal, daily_goal_notifications FROM user WHERE id = ?",
      [userId],
    );

    // Vérifier si l'utilisateur veut ces notifications (par défaut oui)
    const notificationsEnabled = user?.daily_goal_notifications !== 0;

    // Vérifier si l'utilisateur a défini son propre objectif (différent de la valeur par défaut 15000)
    const hasCustomGoal = user?.daily_goal !== 15000;

    if (!notificationsEnabled || !hasCustomGoal) return;

    const title = "🎯 OBJECTIF ATTEINT !";
    const body = `Félicitations ${user?.name || ""} ! Vous avez gagné ${amount.toLocaleString("fr-FR")} FCFA aujourd'hui. Objectif: ${goal.toLocaleString("fr-FR")} FCFA 🎉`;

    const notificationId = await NotificationStore.add({
      type: "goal_achieved",
      title,
      body,
      data: { amount, goal },
      userId,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "goal_achieved", notificationId },
        sound: true,
      },
      trigger: null,
    });

    console.log("✅ Notification objectif atteint envoyée");
  } catch (error) {
    console.error("❌ Erreur notification objectif:", error);
  }
};

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const tableCheck = await db.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user'",
    );
    if (!tableCheck) return BackgroundFetch.BackgroundFetchResult.NoData;

    const users = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM user WHERE reminder_notifications = 1",
    );
    for (const user of users) {
      await sendPendingReminderNotification(user.id);
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const setupBackgroundTask = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_FETCH_TASK,
    );
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (error) {
    console.error("❌ Erreur BackgroundTask:", error);
  }
};

export const resetNotificationBadge = async () => {
  await Notifications.setBadgeCountAsync(0);
};
