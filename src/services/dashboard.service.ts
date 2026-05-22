import { DatabaseService } from '../database/db';
import { Delivery } from '../types';

export interface DashboardData {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  monthGoal: number;
  dailyGoal: number;
  dailyProgress: number;
  goalAchievedToday: boolean;
  todayEncaisse: number;
  todayAReverser: number;
  todayProfit: number;
  pendingReversal: number;
  todayCount: number;
  trendPercent: number;
  yesterdayTotal: number;
  todayDeliveries: Delivery[];
  totalEarningsAll: number;
  completedAll: number;
  pendingAll: number;
  cancelledAll: number;
}

export class DashboardService {
  static async getDashboardData(userId: string | number): Promise<DashboardData> {
    const today = new Date().toISOString().split('T')[0];
    const todayDateStr = new Date().toDateString();

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const todayDeliveries = await DatabaseService.query<Delivery>(
      `SELECT * FROM deliveries
       WHERE user_id = ?
       AND status = 'LIVREE'
       AND delivered_at LIKE ?`,
      [userIdNum, `${today}%`],
    );

    let encaisse = 0;
    let aReverser = 0;
    let profit = 0;

    for (const delivery of todayDeliveries) {
      const isClientPaysTout = delivery.payment_type === 'CLIENT_PAYE_TOUT';
      encaisse += delivery.delivery_fee + (isClientPaysTout ? (delivery.parcel_value || 0) : 0);
      aReverser += isClientPaysTout ? (delivery.parcel_value || 0) : 0;
      profit += delivery.delivery_fee;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayResult = await DatabaseService.getOne<{ total: number }>(
      `SELECT COALESCE(SUM(delivery_fee), 0) as total FROM deliveries
       WHERE user_id = ? AND status = ? AND delivered_at LIKE ?`,
      [userIdNum, 'LIVREE', `${yesterdayStr}%`],
    );
    const totalYesterday = yesterdayResult?.total || 0;
    const trendPercent = totalYesterday === 0
      ? 0
      : Math.round(((profit - totalYesterday) / totalYesterday) * 100);

    const weekResult = await DatabaseService.getOne<{ total: number }>(
      `SELECT COALESCE(SUM(delivery_fee), 0) as total
       FROM deliveries
       WHERE user_id = ? AND status = 'LIVREE'
       AND date(delivered_at) >= date('now', '-7 days')`,
      [userIdNum],
    );
    const weekEarnings = weekResult?.total || 0;

    const monthResult = await DatabaseService.getOne<{ total: number }>(
      `SELECT COALESCE(SUM(delivery_fee), 0) as total
       FROM deliveries
       WHERE user_id = ? AND status = 'LIVREE'
       AND strftime('%Y-%m', delivered_at) = strftime('%Y-%m', 'now')`,
      [userIdNum],
    );
    const monthEarnings = monthResult?.total || 0;

    const todayAllResult = await DatabaseService.query<Delivery>(
      `SELECT * FROM deliveries
       WHERE user_id = ?
       AND (status = 'A_LIVRER' OR status = 'LIVREE')
       AND date(created_at) = date('now')
       ORDER BY created_at`,
      [userIdNum],
    );

    const pending = await DatabaseService.query<Delivery>(
      `SELECT * FROM deliveries
       WHERE user_id = ?
       AND status = 'LIVREE'
       AND reversed = 0`,
      [userIdNum],
    );

    let pendingTotal = 0;
    for (const delivery of pending) {
      if (delivery.payment_type === 'CLIENT_PAYE_TOUT') {
        pendingTotal += delivery.parcel_value || 0;
      }
    }

    const userGoal = await DatabaseService.getOne<{ daily_goal: number; monthly_goal: number }>(
      `SELECT daily_goal, monthly_goal FROM user WHERE id = ?`,
      [userIdNum],
    );
    const dailyGoal = userGoal?.daily_goal || 15000;
    const monthGoal = userGoal?.monthly_goal || 0;

    const dailyProgress = dailyGoal > 0 ? (profit / dailyGoal) * 100 : 0;
    const goalAchievedToday = profit >= dailyGoal;

    const allStats = await DatabaseService.getOne<{
      totalEarnings: number;
      completed: number;
      pending: number;
      cancelled: number;
    }>(
      `SELECT
        COALESCE(SUM(delivery_fee), 0) as totalEarnings,
        COALESCE(SUM(CASE WHEN status = 'LIVREE' THEN 1 ELSE 0 END), 0) as completed,
        COALESCE(SUM(CASE WHEN status = 'A_LIVRER' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN status = 'ANNULEE' THEN 1 ELSE 0 END), 0) as cancelled
      FROM deliveries WHERE user_id = ?`,
      [userIdNum],
    );

    return {
      todayEarnings: profit,
      weekEarnings,
      monthEarnings,
      monthGoal,
      dailyGoal,
      dailyProgress,
      goalAchievedToday,
      todayEncaisse: encaisse,
      todayAReverser: aReverser,
      todayProfit: profit,
      pendingReversal: pendingTotal,
      todayCount: todayDeliveries.length,
      trendPercent,
      yesterdayTotal: totalYesterday,
      todayDeliveries: todayAllResult,
      totalEarningsAll: allStats?.totalEarnings || 0,
      completedAll: allStats?.completed || 0,
      pendingAll: allStats?.pending || 0,
      cancelledAll: allStats?.cancelled || 0,
    };
  }
}
