import { db } from '../database/db';
import { Notification, NotificationType } from '../types/notification';

export class NotificationStore {
  // Ajouter une notification
  static async add(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO notifications (id, type, title, body, data, read, created_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        notification.type,
        notification.title,
        notification.body,
        notification.data ? JSON.stringify(notification.data) : null,
        0,
        createdAt,
        notification.userId
      ]
    );

    return id;
  }

  // Récupérer toutes les notifications d'un utilisateur
  static async getAll(userId: number): Promise<Notification[]> {
    const results = await db.getAllAsync<any>(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );

    return results.map(row => ({
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      data: row.data ? JSON.parse(row.data) : undefined,
      read: row.read === 1,
      createdAt: row.created_at,
      userId: row.user_id
    }));
  }

  // Récupérer les notifications non lues
  static async getUnread(userId: number): Promise<Notification[]> {
    const results = await db.getAllAsync<any>(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND read = 0 
       ORDER BY created_at DESC`,
      [userId]
    );

    return results.map(row => ({
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      data: row.data ? JSON.parse(row.data) : undefined,
      read: row.read === 1,
      createdAt: row.created_at,
      userId: row.user_id
    }));
  }

  // Compter les notifications non lues
  static async countUnread(userId: number): Promise<number> {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = ? AND read = 0`,
      [userId]
    );
    return result?.count || 0;
  }

  // Marquer une notification comme lue
  static async markAsRead(notificationId: string) {
    await db.runAsync(
      'UPDATE notifications SET read = 1 WHERE id = ?',
      [notificationId]
    );
  }

  // Marquer toutes les notifications comme lues
  static async markAllAsRead(userId: number) {
    await db.runAsync(
      'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0',
      [userId]
    );
  }

  // Supprimer une notification
  static async delete(notificationId: string) {
    await db.runAsync(
      'DELETE FROM notifications WHERE id = ?',
      [notificationId]
    );
  }

  // Supprimer toutes les notifications d'un utilisateur
  static async clearAll(userId: number) {
    await db.runAsync(
      'DELETE FROM notifications WHERE user_id = ?',
      [userId]
    );
  }
}