// src/services/delivery.service.ts
import { DeliveryRepository } from '../repositories/delivery.repository';
import { Delivery, DeliveryCreateDTO, DeliveryUpdateDTO, DeliveryFilters, DailyEarnings } from '../types';
import { NotFoundError } from '../utils/errors';
import { Formatters } from '../utils/formatters';

export class DeliveryService {
  static async getMyDeliveries(userId: number, filters?: DeliveryFilters): Promise<Delivery[]> {
    try {
      const finalFilters: DeliveryFilters = {
        ...filters,
        userId
      };

      return await DeliveryRepository.findAll(finalFilters);
    } catch (error) {
      console.error('Erreur getMyDeliveries:', error);
      throw error;
    }
  }

  static async getDeliveryById(userId: number, id: number): Promise<Delivery> {
    try {
      const delivery = await DeliveryRepository.findById(id);
      if (!delivery) {
        throw new NotFoundError('Livraison');
      }

      if (delivery.user_id !== userId) {
        throw new Error('Non autorisé');
      }

      return delivery;
    } catch (error) {
      console.error('Erreur getDeliveryById:', error);
      throw error;
    }
  }

  static async createDelivery(userId: number, data: Omit<DeliveryCreateDTO, 'user_id'>): Promise<Delivery> {
    try {
      const deliveryData: DeliveryCreateDTO = {
        ...data,
        user_id: userId
      };

      return await DeliveryRepository.create(deliveryData);
    } catch (error) {
      console.error('Erreur createDelivery:', error);
      throw error;
    }
  }

  static async updateDelivery(userId: number, id: number, data: DeliveryUpdateDTO): Promise<Delivery> {
    try {
      await this.getDeliveryById(userId, id);

      return await DeliveryRepository.update(id, data);
    } catch (error) {
      console.error('Erreur updateDelivery:', error);
      throw error;
    }
  }

  static async deleteDelivery(userId: number, id: number): Promise<void> {
    try {
      await this.getDeliveryById(userId, id);

      await DeliveryRepository.delete(id);
    } catch (error) {
      console.error('Erreur deleteDelivery:', error);
      throw error;
    }
  }

  static async markAsDelivered(userId: number, id: number): Promise<Delivery> {
    try {
      await this.getDeliveryById(userId, id);

      return await DeliveryRepository.markAsDelivered(id);
    } catch (error) {
      console.error('Erreur markAsDelivered:', error);
      throw error;
    }
  }

  static async cancelDelivery(userId: number, id: number): Promise<Delivery> {
    try {
      await this.getDeliveryById(userId, id);

      return await DeliveryRepository.cancel(id);
    } catch (error) {
      console.error('Erreur cancelDelivery:', error);
      throw error;
    }
  }

  static async getStats(userId: number, period?: 'today' | 'week' | 'month') {
    try {
      return await DeliveryRepository.getStats(userId, period);
    } catch (error) {
      console.error('Erreur getStats:', error);
      throw error;
    }
  }

  static async getDailyEarnings(userId: number, days: number = 7): Promise<DailyEarnings[]> {
    try {
      return await DeliveryRepository.getDailyEarnings(userId, days);
    } catch (error) {
      console.error('Erreur getDailyEarnings:', error);
      throw error;
    }
  }

  static async getTotalEarnings(userId: number): Promise<number> {
    try {
      const stats = await this.getStats(userId);
      return stats.totalEarnings;
    } catch (error) {
      console.error('Erreur getTotalEarnings:', error);
      return 0;
    }
  }

  static async groupByStatus(userId: number): Promise<Record<string, Delivery[]>> {
    try {
      const deliveries = await this.getMyDeliveries(userId);
      
      return deliveries.reduce((groups, delivery) => {
        const status = delivery.status;
        if (!groups[status]) {
          groups[status] = [];
        }
        groups[status].push(delivery);
        return groups;
      }, {} as Record<string, Delivery[]>);
    } catch (error) {
      console.error('Erreur groupByStatus:', error);
      return {};
    }
  }

  static async searchDeliveries(userId: number, query: string): Promise<Delivery[]> {
    try {
      return await this.getMyDeliveries(userId, { search: query });
    } catch (error) {
      console.error('Erreur searchDeliveries:', error);
      return [];
    }
  }

  static async getTodayDeliveries(userId: number): Promise<Delivery[]> {
    try {
      return await this.getMyDeliveries(userId, { period: 'today' });
    } catch (error) {
      console.error('Erreur getTodayDeliveries:', error);
      return [];
    }
  }

  static async getPendingDeliveries(userId: number): Promise<Delivery[]> {
    try {
      return await this.getMyDeliveries(userId, { status: 'A_LIVRER' });
    } catch (error) {
      console.error('Erreur getPendingDeliveries:', error);
      return [];
    }
  }

  static async getCompletedDeliveries(userId: number): Promise<Delivery[]> {
    try {
      return await this.getMyDeliveries(userId, { status: 'LIVREE' });
    } catch (error) {
      console.error('Erreur getCompletedDeliveries:', error);
      return [];
    }
  }

  static async getDashboardSummary(userId: number) {
    try {
      const [todayStats, weekStats, monthStats, todayDeliveries] = await Promise.all([
        this.getStats(userId, 'today'),
        this.getStats(userId, 'week'),
        this.getStats(userId, 'month'),
        this.getTodayDeliveries(userId)
      ]);

      // Calculer la progression de l'objectif mensuel
      const monthlyGoal = 400000; // 4000€ en FCFA
      const monthProgress = Formatters.calculateProgress(monthStats.totalEarnings, monthlyGoal);

      // Grouper les livraisons du jour par créneau horaire
      const groupedDeliveries = todayDeliveries.reduce((groups, delivery) => {
        const hour = new Date(delivery.created_at).getHours();
        let timeSlot: string;
        
        if (hour < 12) timeSlot = 'morning';
        else if (hour < 18) timeSlot = 'afternoon';
        else timeSlot = 'evening';
        
        if (!groups[timeSlot]) {
          groups[timeSlot] = [];
        }
        groups[timeSlot].push(delivery);
        return groups;
      }, {} as Record<string, Delivery[]>);

      return {
        todayEarnings: todayStats.totalEarnings,
        weekEarnings: weekStats.totalEarnings,
        monthEarnings: monthStats.totalEarnings,
        monthGoal: monthlyGoal,
        monthProgress,
        todayDeliveries: groupedDeliveries,
        stats: {
          completed: todayStats.completedDeliveries,
          pending: todayStats.pendingDeliveries,
          cancelled: todayStats.cancelledDeliveries
        }
      };
    } catch (error) {
      console.error('Erreur getDashboardSummary:', error);
      throw error;
    }
  }
}