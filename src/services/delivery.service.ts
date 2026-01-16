// src/services/delivery.service.ts
import { DeliveryRepository } from '../repositories/delivery.repository';
import { AuthService } from './auth.service';
import { Delivery, DeliveryCreateDTO, DeliveryUpdateDTO, DeliveryFilters, DailyEarnings } from '../types';
import { ValidationError, NotFoundError } from '../utils/errors';
import { Formatters } from '../utils/formatters';

export class DeliveryService {
  // Obtenir toutes les livraisons de l'utilisateur courant
  static async getMyDeliveries(filters?: DeliveryFilters): Promise<Delivery[]> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const finalFilters: DeliveryFilters = {
        ...filters,
        userId: user.id
      };

      return await DeliveryRepository.findAll(finalFilters);
    } catch (error) {
      console.error('Erreur getMyDeliveries:', error);
      throw error;
    }
  }

  // Obtenir une livraison par ID
  static async getDeliveryById(id: number): Promise<Delivery> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const delivery = await DeliveryRepository.findById(id);
      if (!delivery) {
        throw new NotFoundError('Livraison');
      }

      // Vérifier que la livraison appartient à l'utilisateur
      if (delivery.user_id !== user.id) {
        throw new Error('Non autorisé');
      }

      return delivery;
    } catch (error) {
      console.error('Erreur getDeliveryById:', error);
      throw error;
    }
  }

  // Créer une livraison
  static async createDelivery(data: Omit<DeliveryCreateDTO, 'user_id'>): Promise<Delivery> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const deliveryData: DeliveryCreateDTO = {
        ...data,
        user_id: user.id
      };

      return await DeliveryRepository.create(deliveryData);
    } catch (error) {
      console.error('Erreur createDelivery:', error);
      throw error;
    }
  }

  // Mettre à jour une livraison
  static async updateDelivery(id: number, data: DeliveryUpdateDTO): Promise<Delivery> {
    try {
      // Vérifier que l'utilisateur possède cette livraison
      await this.getDeliveryById(id);

      return await DeliveryRepository.update(id, data);
    } catch (error) {
      console.error('Erreur updateDelivery:', error);
      throw error;
    }
  }

  // Supprimer une livraison
  static async deleteDelivery(id: number): Promise<void> {
    try {
      // Vérifier que l'utilisateur possède cette livraison
      await this.getDeliveryById(id);

      await DeliveryRepository.delete(id);
    } catch (error) {
      console.error('Erreur deleteDelivery:', error);
      throw error;
    }
  }

  // Marquer comme livrée
  static async markAsDelivered(id: number): Promise<Delivery> {
    try {
      // Vérifier que l'utilisateur possède cette livraison
      await this.getDeliveryById(id);

      return await DeliveryRepository.markAsDelivered(id);
    } catch (error) {
      console.error('Erreur markAsDelivered:', error);
      throw error;
    }
  }

  // Annuler une livraison
  static async cancelDelivery(id: number): Promise<Delivery> {
    try {
      // Vérifier que l'utilisateur possède cette livraison
      await this.getDeliveryById(id);

      return await DeliveryRepository.cancel(id);
    } catch (error) {
      console.error('Erreur cancelDelivery:', error);
      throw error;
    }
  }

  // Obtenir les statistiques
  static async getStats(period?: 'today' | 'week' | 'month') {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      return await DeliveryRepository.getStats(user.id, period);
    } catch (error) {
      console.error('Erreur getStats:', error);
      throw error;
    }
  }

  // Obtenir les revenus journaliers
  static async getDailyEarnings(days: number = 7): Promise<DailyEarnings[]> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      return await DeliveryRepository.getDailyEarnings(user.id, days);
    } catch (error) {
      console.error('Erreur getDailyEarnings:', error);
      throw error;
    }
  }

  // Obtenir le total des revenus
  static async getTotalEarnings(): Promise<number> {
    try {
      const stats = await this.getStats();
      return stats.totalEarnings;
    } catch (error) {
      console.error('Erreur getTotalEarnings:', error);
      return 0;
    }
  }

  // Grouper les livraisons par statut
  static async groupByStatus(): Promise<Record<string, Delivery[]>> {
    try {
      const deliveries = await this.getMyDeliveries();
      
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

  // Rechercher des livraisons
  static async searchDeliveries(query: string): Promise<Delivery[]> {
    try {
      return await this.getMyDeliveries({ search: query });
    } catch (error) {
      console.error('Erreur searchDeliveries:', error);
      return [];
    }
  }

  // Obtenir les livraisons du jour
  static async getTodayDeliveries(): Promise<Delivery[]> {
    try {
      return await this.getMyDeliveries({ period: 'today' });
    } catch (error) {
      console.error('Erreur getTodayDeliveries:', error);
      return [];
    }
  }

  // Obtenir les livraisons en attente
  static async getPendingDeliveries(): Promise<Delivery[]> {
    try {
      return await this.getMyDeliveries({ status: 'A_LIVRER' });
    } catch (error) {
      console.error('Erreur getPendingDeliveries:', error);
      return [];
    }
  }

  // Obtenir les livraisons terminées
  static async getCompletedDeliveries(): Promise<Delivery[]> {
    try {
      return await this.getMyDeliveries({ status: 'LIVREE' });
    } catch (error) {
      console.error('Erreur getCompletedDeliveries:', error);
      return [];
    }
  }

  // Générer un résumé des statistiques pour le dashboard
  static async getDashboardSummary() {
    try {
      const [todayStats, weekStats, monthStats, todayDeliveries] = await Promise.all([
        this.getStats('today'),
        this.getStats('week'),
        this.getStats('month'),
        this.getTodayDeliveries()
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