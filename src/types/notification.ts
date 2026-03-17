export type NotificationType = 
  | 'pending_reminder'
  | 'inactivity_reminder'
  | 'reminder_12h'
  | 'encouragement'
  | 'delivery_progress'
  | 'delivery_created'
  | 'all_completed'
  | 'goal_achieved';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: string;
  userId: number;
}

export interface NotificationBadge {
  count: number;
  lastNotificationId?: string;
}