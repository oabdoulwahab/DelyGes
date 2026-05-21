// src/repositories/delivery.repository.ts
import { endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { DatabaseService } from '../database/db';
import { Delivery, DeliveryCreateDTO, DeliveryFilters, DeliveryUpdateDTO } from '../types';
import { AppError, DatabaseError, NotFoundError, ValidationError } from '../utils/errors';

export class DeliveryRepository {
  // Trouver toutes les livraisons avec filtres
  static async findAll(filters?: DeliveryFilters): Promise<Delivery[]> {
    try {
      let query = 'SELECT * FROM deliveries WHERE 1=1';
      const params: any[] = [];

      // Filtre par utilisateur
      if (filters?.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
      }

      // Filtre par statut
      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      // Filtre par recherche
      if (filters?.search) {
        query += ' AND (recipient_name LIKE ? OR phone LIKE ? OR address LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      // Filtre par date
      if (filters?.dateFrom && filters?.dateTo) {
        query += ' AND date(created_at) BETWEEN date(?) AND date(?)';
        params.push(filters.dateFrom, filters.dateTo);
      } else if (filters?.dateFrom) {
        query += ' AND date(created_at) >= date(?)';
        params.push(filters.dateFrom);
      } else if (filters?.dateTo) {
        query += ' AND date(created_at) <= date(?)';
        params.push(filters.dateTo);
      }

      // Filtre par période
      if (filters?.period) {
        const today = new Date();
        let startDate: Date;
        let endDate: Date = today;

        switch (filters.period) {
          case 'today':
            startDate = startOfDay(today);
            endDate = endOfDay(today);
            break;
          case 'week':
            startDate = startOfWeek(today, { weekStartsOn: 1 });
            endDate = endOfWeek(today, { weekStartsOn: 1 });
            break;
          case 'month':
            startDate = startOfMonth(today);
            endDate = endOfMonth(today);
            break;
          default:
            startDate = startOfDay(today);
            endDate = endOfDay(today);
        }

        query += ' AND created_at BETWEEN ? AND ?';
        params.push(startDate.toISOString(), endDate.toISOString());
      }

      // Tri par défaut
      query += ' ORDER BY created_at DESC';

      return await DatabaseService.query<Delivery>(query, params);
    } catch (error) {
      console.error('Erreur findAll:', error);
      throw new DatabaseError('Impossible de récupérer les livraisons');
    }
  }

  // Trouver par ID
  static async findById(id: number): Promise<Delivery | null> {
    try {
      return await DatabaseService.getOne<Delivery>(
        'SELECT * FROM deliveries WHERE id = ?',
        [id]
      );
    } catch (error) {
      console.error('Erreur findById:', error);
      throw new DatabaseError('Impossible de récupérer la livraison');
    }
  }

  // Trouver les livraisons d'un utilisateur
  static async findByUserId(userId: number, filters?: Omit<DeliveryFilters, 'userId'>): Promise<Delivery[]> {
    try {
      const allFilters: DeliveryFilters = { ...filters, userId };
      return await this.findAll(allFilters);
    } catch (error) {
      console.error('Erreur findByUserId:', error);
      throw new DatabaseError('Impossible de récupérer les livraisons');
    }
  }

  // Créer une livraison
  static async create(deliveryData: DeliveryCreateDTO): Promise<Delivery> {
    try {
      if (deliveryData.delivery_fee < 0) {
        throw new ValidationError('Les frais de livraison ne peuvent pas être négatifs');
      }

      if (deliveryData.parcel_value && deliveryData.parcel_value < 0) {
        throw new ValidationError('La valeur du colis ne peut pas être négative');
      }

      const result = await DatabaseService.execute(
        `INSERT INTO deliveries 
         (recipient_name, phone, address, parcel_value, delivery_fee, 
          merchant_id, payment_type, amount_collected, amount_to_return,
          profit, status, user_id, created_at, needs_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          deliveryData.recipient_name,
          deliveryData.phone || null,
          deliveryData.address,
          deliveryData.parcel_value || 0,
          deliveryData.delivery_fee,
          deliveryData.merchant_id || null,
          deliveryData.payment_type || 'CLIENT_PAYE_TOUT',
          deliveryData.amount_collected || 0,
          deliveryData.amount_to_return || 0,
          deliveryData.profit || 0,
          'A_LIVRER',
          deliveryData.user_id,
          new Date().toISOString(),
        ]
      );

      const newDelivery = await this.findById(result.lastInsertRowId as number);
      if (!newDelivery) {
        throw new DatabaseError('Impossible de récupérer la livraison créée');
      }

      return newDelivery;
    } catch (error) {
      console.error('Erreur create:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Impossible de créer la livraison');
    }
  }

  // Mettre à jour une livraison
  static async update(id: number, deliveryData: DeliveryUpdateDTO): Promise<Delivery> {
    try {
      const delivery = await this.findById(id);
      if (!delivery) {
        throw new NotFoundError('Livraison');
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (deliveryData.recipient_name) {
        updates.push('recipient_name = ?');
        params.push(deliveryData.recipient_name);
      }

      if (deliveryData.phone !== undefined) {
        updates.push('phone = ?');
        params.push(deliveryData.phone);
      }

      if (deliveryData.address) {
        updates.push('address = ?');
        params.push(deliveryData.address);
      }

      if (deliveryData.parcel_value !== undefined) {
        if (deliveryData.parcel_value < 0) {
          throw new ValidationError('La valeur du colis ne peut pas être négative');
        }
        updates.push('parcel_value = ?');
        params.push(deliveryData.parcel_value);
      }

      if (deliveryData.delivery_fee !== undefined) {
        if (deliveryData.delivery_fee < 0) {
          throw new ValidationError('Les frais de livraison ne peuvent pas être négatifs');
        }
        updates.push('delivery_fee = ?');
        params.push(deliveryData.delivery_fee);
      }

      if (deliveryData.status) {
        updates.push('status = ?');
        params.push(deliveryData.status);

        if (deliveryData.status === 'LIVREE' && !delivery.delivered_at) {
          updates.push('delivered_at = CURRENT_TIMESTAMP');
        } else if (deliveryData.status !== 'LIVREE') {
          updates.push('delivered_at = NULL');
        }
      }

      if (deliveryData.delivered_at) {
        updates.push('delivered_at = ?');
        params.push(deliveryData.delivered_at);
      }

      if (deliveryData.payment_type) {
        updates.push('payment_type = ?');
        params.push(deliveryData.payment_type);
      }

      if (deliveryData.merchant_id !== undefined) {
        updates.push('merchant_id = ?');
        params.push(deliveryData.merchant_id);
      }

      if (deliveryData.amount_collected !== undefined) {
        updates.push('amount_collected = ?');
        params.push(deliveryData.amount_collected);
      }

      if (deliveryData.amount_to_return !== undefined) {
        updates.push('amount_to_return = ?');
        params.push(deliveryData.amount_to_return);
      }

      if (deliveryData.profit !== undefined) {
        updates.push('profit = ?');
        params.push(deliveryData.profit);
      }

      if (deliveryData.needs_sync !== undefined) {
        updates.push('needs_sync = ?');
        params.push(deliveryData.needs_sync);
      }

      if (updates.length === 0) {
        throw new ValidationError('Aucune donnée à mettre à jour');
      }

      params.push(id);
      const query = `UPDATE deliveries SET ${updates.join(', ')} WHERE id = ?`;
      
      await DatabaseService.execute(query, params);

      const updatedDelivery = await this.findById(id);
      if (!updatedDelivery) {
        throw new DatabaseError('Impossible de récupérer la livraison mise à jour');
      }

      return updatedDelivery;
    } catch (error) {
      console.error('Erreur update:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Impossible de mettre à jour la livraison');
    }
  }

  // Supprimer les livraisons d'un utilisateur
  static async deleteByUserId(userId: number): Promise<void> {
    try {
      await DatabaseService.execute('DELETE FROM deliveries WHERE user_id = ?', [userId]);
    } catch (error) {
      console.error('Erreur deleteByUserId:', error);
      throw new DatabaseError('Impossible de supprimer les livraisons');
    }
  }

  // Supprimer une livraison
  static async delete(id: number): Promise<void> {
    try {
      const delivery = await this.findById(id);
      if (!delivery) {
        throw new NotFoundError('Livraison');
      }

      await DatabaseService.execute('DELETE FROM deliveries WHERE id = ?', [id]);
    } catch (error) {
      console.error('Erreur delete:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Impossible de supprimer la livraison');
    }
  }

  // Marquer comme livrée
  static async markAsDelivered(id: number): Promise<Delivery> {
    try {
      const delivery = await this.findById(id);
      if (!delivery) {
        throw new NotFoundError('Livraison');
      }

      if (delivery.status === 'LIVREE') {
        throw new ValidationError('Cette livraison est déjà terminée');
      }

      if (delivery.status === 'ANNULEE') {
        throw new ValidationError('Une livraison annulée ne peut pas être marquée comme livrée');
      }

      return await this.update(id, { status: 'LIVREE' });
    } catch (error) {
      console.error('Erreur markAsDelivered:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Impossible de marquer comme livrée');
    }
  }

  // Annuler une livraison
  static async cancel(id: number): Promise<Delivery> {
    try {
      const delivery = await this.findById(id);
      if (!delivery) {
        throw new NotFoundError('Livraison');
      }

      if (delivery.status === 'ANNULEE') {
        throw new ValidationError('Cette livraison est déjà annulée');
      }

      if (delivery.status === 'LIVREE') {
        throw new ValidationError('Une livraison terminée ne peut pas être annulée');
      }

      return await this.update(id, { status: 'ANNULEE' });
    } catch (error) {
      console.error('Erreur cancel:', error);
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Impossible d\'annuler la livraison');
    }
  }

  // Compter les livraisons
  static async count(filters?: DeliveryFilters): Promise<number> {
    try {
      let query = 'SELECT COUNT(*) as count FROM deliveries WHERE 1=1';
      const params: any[] = [];

      if (filters?.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters?.dateFrom && filters?.dateTo) {
        query += ' AND date(created_at) BETWEEN date(?) AND date(?)';
        params.push(filters.dateFrom, filters.dateTo);
      }

      const result = await DatabaseService.getOne<{ count: number }>(query, params);
      return result?.count || 0;
    } catch (error) {
      console.error('Erreur count:', error);
      throw new DatabaseError('Impossible de compter les livraisons');
    }
  }

  // Obtenir les statistiques
  static async getStats(userId: number, period?: 'today' | 'week' | 'month'): Promise<{
    totalEarnings: number;
    totalDeliveries: number;
    completedDeliveries: number;
    pendingDeliveries: number;
    cancelledDeliveries: number;
    averageEarnings: number;
  }> {
    try {
      let dateCondition = '';
      const params: any[] = [userId];

      if (period) {
        const today = new Date();
        let startDate: string;
        let endDate: string = format(endOfDay(today), 'yyyy-MM-dd');

        switch (period) {
          case 'today':
            startDate = format(startOfDay(today), 'yyyy-MM-dd');
            break;
          case 'week':
            startDate = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            break;
          case 'month':
            startDate = format(startOfMonth(today), 'yyyy-MM-dd');
            break;
          default:
            startDate = format(startOfDay(today), 'yyyy-MM-dd');
        }

        dateCondition = ' AND date(created_at) BETWEEN date(?) AND date(?)';
        params.push(startDate, endDate);
      }

      const query = `
        SELECT 
          COALESCE(SUM(delivery_fee), 0) as totalEarnings,
          COUNT(*) as totalDeliveries,
          SUM(CASE WHEN status = 'LIVREE' THEN 1 ELSE 0 END) as completedDeliveries,
          SUM(CASE WHEN status = 'A_LIVRER' THEN 1 ELSE 0 END) as pendingDeliveries,
          SUM(CASE WHEN status = 'ANNULEE' THEN 1 ELSE 0 END) as cancelledDeliveries
        FROM deliveries 
        WHERE user_id = ? ${dateCondition}
      `;

      const result = await DatabaseService.getOne<{
        totalEarnings: number;
        totalDeliveries: number;
        completedDeliveries: number;
        pendingDeliveries: number;
        cancelledDeliveries: number;
      }>(query, params);

      return {
        totalEarnings: result?.totalEarnings || 0,
        totalDeliveries: result?.totalDeliveries || 0,
        completedDeliveries: result?.completedDeliveries || 0,
        pendingDeliveries: result?.pendingDeliveries || 0,
        cancelledDeliveries: result?.cancelledDeliveries || 0,
        averageEarnings: result?.totalDeliveries 
          ? (result.totalEarnings / result.totalDeliveries) 
          : 0
      };
    } catch (error) {
      console.error('Erreur getStats:', error);
      throw new DatabaseError('Impossible de récupérer les statistiques');
    }
  }

  // Obtenir les dates des livraisons (pour le calendrier)
  static async getDeliveryDates(): Promise<string[]> {
    try {
      const result = await DatabaseService.query<{ created_at: string }>(
        "SELECT DISTINCT date(created_at) as created_at FROM deliveries ORDER BY created_at DESC",
      );
      return result.map((r) => r.created_at);
    } catch (error) {
      console.error('Erreur getDeliveryDates:', error);
      return [];
    }
  }

  // Requête flexible pour l'écran des livraisons
  static async queryDeliveries(
    sql: string,
    params: any[] = [],
  ): Promise<Delivery[]> {
    try {
      return await DatabaseService.query<Delivery>(sql, params);
    } catch (error) {
      console.error('Erreur queryDeliveries:', error);
      throw new DatabaseError('Impossible de récupérer les livraisons');
    }
  }

  // Obtenir les revenus par jour
  static async getDailyEarnings(userId: number, days: number = 7): Promise<Array<{
    date: string;
    earnings: number;
    deliveries: number;
  }>> {
    try {
      const query = `
        SELECT 
          date(created_at) as date,
          COALESCE(SUM(delivery_fee), 0) as earnings,
          COUNT(*) as deliveries
        FROM deliveries 
        WHERE user_id = ? 
          AND status = 'LIVREE'
          AND date(created_at) >= date('now', ?)
        GROUP BY date(created_at)
        ORDER BY date(created_at) DESC
      `;

      const params = [userId, `-${days} days`];
      
      return await DatabaseService.query<{
        date: string;
        earnings: number;
        deliveries: number;
      }>(query, params);
    } catch (error) {
      console.error('Erreur getDailyEarnings:', error);
      throw new DatabaseError('Impossible de récupérer les revenus journaliers');
    }
  }

  // Livraisons reversées avec computed columns (pour comptabilité)
  static async findReversedWithDates(dateFrom?: string, dateTo?: string): Promise<(Delivery & { month_key: string; year: string; month: string })[]> {
    try {
      let query = `
        SELECT d.*,
          strftime('%Y-%m', d.delivered_at) as month_key,
          strftime('%Y', d.delivered_at) as year,
          strftime('%m', d.delivered_at) as month
        FROM deliveries d
        WHERE d.status = 'LIVREE'
        AND d.reversed = 1
      `;
      const params: any[] = [];

      if (dateFrom && dateTo) {
        query += ' AND date(d.delivered_at) BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      } else if (dateFrom) {
        query += ' AND date(d.delivered_at) = ?';
        params.push(dateFrom);
      }

      query += ' ORDER BY d.delivered_at DESC';

      return await DatabaseService.query(query, params);
    } catch (error) {
      console.error('Erreur findReversedWithDates:', error);
      throw new DatabaseError('Impossible de récupérer les livraisons reversées');
    }
  }

  // Livraisons livrées mais non reversées
  static async findPendingReversal(): Promise<Delivery[]> {
    try {
      return await DatabaseService.query<Delivery>(
        `SELECT d.* FROM deliveries d
         WHERE d.status = 'LIVREE'
         AND d.reversed != 1
         ORDER BY d.delivered_at DESC`,
      );
    } catch (error) {
      console.error('Erreur findPendingReversal:', error);
      throw new DatabaseError('Impossible de récupérer les livraisons en attente');
    }
  }

  // Dates distinctes des livraisons livrées
  static async getDeliveredDates(): Promise<string[]> {
    try {
      const result = await DatabaseService.query<{ delivered_at: string }>(
        `SELECT DISTINCT date(delivered_at) as delivered_at FROM deliveries WHERE status = 'LIVREE' ORDER BY delivered_at DESC`,
      );
      return result.map((r) => r.delivered_at);
    } catch (error) {
      console.error('Erreur getDeliveredDates:', error);
      return [];
    }
  }

  // Marquer les livraisons d'un commerçant comme reversées (avec date optionnelle)
  static async markReversedByMerchant(merchantId: number, dateFrom?: string, dateTo?: string): Promise<void> {
    try {
      let query = 'UPDATE deliveries SET reversed = 1, needs_sync = 1 WHERE merchant_id = ? AND status = \'LIVREE\'';
      const params: any[] = [merchantId];

      if (dateFrom && dateTo) {
        query += ' AND date(delivered_at) BETWEEN ? AND ?';
        params.push(dateFrom, dateTo);
      }

      await DatabaseService.execute(query, params);
    } catch (error) {
      console.error('Erreur markReversedByMerchant:', error);
      throw new DatabaseError('Impossible de marquer comme reversé');
    }
  }
}