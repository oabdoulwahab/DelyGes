// app/src/utils/financialCalculations.ts
import { PaymentType, Delivery } from '../types';
import { db } from '../database/db';

export class FinancialCalculations {
  /**
   * Calcule les montants selon le type de paiement
   */
  static calculateAmounts(
    parcel_value: number,
    delivery_fee: number,
    payment_type: PaymentType
  ): {
    amount_collected: number;
    amount_to_return: number;
    profit: number;
  } {
    let amount_collected = 0;
    let amount_to_return = 0;
    let profit = 0;

    switch (payment_type) {
      case 'COLIS_DEJA_PAYE':
        // Colis déjà payé, client paie seulement livraison
        amount_collected = delivery_fee;
        amount_to_return = 0;
        profit = delivery_fee;
        break;

      case 'CLIENT_PAYE_LIVRAISON':
        // Client paie livraison, commerçant garde valeur colis
        amount_collected = delivery_fee;
        amount_to_return = 0;
        profit = delivery_fee;
        break;

      case 'CLIENT_PAYE_TOUT':
        // Client paie tout, livreur reverse valeur colis au commerçant
        amount_collected = parcel_value + delivery_fee;
        amount_to_return = parcel_value;
        profit = delivery_fee;
        break;

      case 'LIVRAISON_DEJA_PAYEE':
        // Livraison déjà payée, client paie seulement le colis
        amount_collected = parcel_value;
        amount_to_return = parcel_value;
        profit = 0;
        break;

      default:
        // Par défaut, traitement CLIENT_PAYE_TOUT
        amount_collected = parcel_value + delivery_fee;
        amount_to_return = parcel_value;
        profit = delivery_fee;
    }

    return {
      amount_collected,
      amount_to_return,
      profit,
    };
  }

  /**
   * Met à jour les montants d'une livraison existante
   */
  static updateDeliveryAmounts(delivery: Partial<Delivery>): Partial<Delivery> {
    const parcel_value = delivery.parcel_value || 0;
    const delivery_fee = delivery.delivery_fee || 0;
    const payment_type = delivery.payment_type || 'CLIENT_PAYE_TOUT';

    const amounts = this.calculateAmounts(
      parcel_value,
      delivery_fee,
      payment_type
    );

    return {
      ...delivery,
      amount_collected: amounts.amount_collected,
      amount_to_return: amounts.amount_to_return,
      profit: amounts.profit,
    };
  }

  /**
   * Calcule les totaux pour un commerçant
   */
  static async calculateMerchantTotals(
    merchantId: number,
    startDate?: string,
    endDate?: string
  ): Promise<{
    total_deliveries: number;
    total_to_return: number;
    unsettled_amount: number;
    last_settlement: string | null;
  }> {
    try {
      // Total des livraisons non réglées
      let query = `
        SELECT 
          COUNT(*) as total_deliveries,
          COALESCE(SUM(amount_to_return), 0) as total_to_return
        FROM deliveries 
        WHERE merchant_id = ? AND is_settled = 0
      `;
      
      const params: any[] = [merchantId];
      
      if (startDate && endDate) {
        query += ' AND date(delivered_at) BETWEEN date(?) AND date(?)';
        params.push(startDate, endDate);
      }
      
      const deliveriesResult = await db.getFirstAsync<{
        total_deliveries: number;
        total_to_return: number;
      }>(query, params);
      
      // Dernier règlement
      const lastSettlement = await db.getFirstAsync<{ settled_at: string }>(
        `SELECT settled_at FROM settlements 
         WHERE merchant_id = ? 
         ORDER BY settled_at DESC LIMIT 1`,
        [merchantId]
      );
      
      return {
        total_deliveries: deliveriesResult?.total_deliveries || 0,
        total_to_return: deliveriesResult?.total_to_return || 0,
        unsettled_amount: deliveriesResult?.total_to_return || 0,
        last_settlement: lastSettlement?.settled_at || null,
      };
    } catch (error) {
      console.error('Erreur calcul totaux commerçant:', error);
      return {
        total_deliveries: 0,
        total_to_return: 0,
        unsettled_amount: 0,
        last_settlement: null,
      };
    }
  }

  /**
   * Calcule les statistiques financières journalières
   */
  static async calculateDailyFinancials(
    userId: number,
    date: string = new Date().toISOString().split('T')[0]
  ): Promise<{
    total_collected: number;
    total_to_return: number;
    total_profit: number;
    merchant_summary: Array<{
      merchant_id: number;
      business_name: string;
      amount_to_return: number;
      delivery_count: number;
    }>;
  }> {
    try {
      // Totaux du jour
      const dailyTotals = await db.getFirstAsync<{
        total_collected: number;
        total_to_return: number;
        total_profit: number;
      }>(
        `SELECT 
          COALESCE(SUM(amount_collected), 0) as total_collected,
          COALESCE(SUM(amount_to_return), 0) as total_to_return,
          COALESCE(SUM(profit), 0) as total_profit
        FROM deliveries 
        WHERE user_id = ? 
          AND date(delivered_at) = date(?)
          AND status = 'LIVREE'`,
        [userId, date]
      );
      
      // Récapitulatif par commerçant
      const merchantSummary = await db.getAllAsync<{
        merchant_id: number;
        business_name: string;
        amount_to_return: number;
        delivery_count: number;
      }>(
        `SELECT 
          m.id as merchant_id,
          m.business_name,
          COALESCE(SUM(d.amount_to_return), 0) as amount_to_return,
          COUNT(d.id) as delivery_count
        FROM merchants m
        LEFT JOIN deliveries d ON m.id = d.merchant_id 
          AND d.user_id = ? 
          AND date(d.delivered_at) = date(?)
          AND d.status = 'LIVREE'
        GROUP BY m.id, m.business_name
        HAVING delivery_count > 0
        ORDER BY amount_to_return DESC`,
        [userId, date]
      );
      
      return {
        total_collected: dailyTotals?.total_collected || 0,
        total_to_return: dailyTotals?.total_to_return || 0,
        total_profit: dailyTotals?.total_profit || 0,
        merchant_summary: merchantSummary || [],
      };
    } catch (error) {
      console.error('Erreur calcul financier journalier:', error);
      return {
        total_collected: 0,
        total_to_return: 0,
        total_profit: 0,
        merchant_summary: [],
      };
    }
  }
}