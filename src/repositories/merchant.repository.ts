import { DatabaseService } from '../database/db';
import { Merchant } from '../types';
import { DatabaseError, NotFoundError } from '../utils/errors';

export class MerchantRepository {
  static async findAll(): Promise<Merchant[]> {
    try {
      return await DatabaseService.query<Merchant>(
        'SELECT * FROM merchants ORDER BY name ASC',
      );
    } catch (error) {
      console.error('Erreur MerchantRepository.findAll:', error);
      throw new DatabaseError('Impossible de récupérer les commerçants');
    }
  }

  static async findById(id: number): Promise<Merchant | null> {
    try {
      return await DatabaseService.getOne<Merchant>(
        'SELECT * FROM merchants WHERE id = ?',
        [id],
      );
    } catch (error) {
      console.error('Erreur MerchantRepository.findById:', error);
      throw new DatabaseError('Impossible de récupérer le commerçant');
    }
  }

  static async findByName(name: string, userId: string): Promise<Merchant | null> {
    try {
      return await DatabaseService.getOne<Merchant>(
        'SELECT * FROM merchants WHERE name = ? AND user_id = ?',
        [name, userId],
      );
    } catch (error) {
      console.error('Erreur MerchantRepository.findByName:', error);
      throw new DatabaseError('Impossible de rechercher le commerçant');
    }
  }

  static async findByNameLocal(name: string): Promise<Merchant | null> {
    try {
      return await DatabaseService.getOne<Merchant>(
        'SELECT * FROM merchants WHERE name = ?',
        [name],
      );
    } catch (error) {
      console.error('Erreur MerchantRepository.findByNameLocal:', error);
      return null;
    }
  }

  static async create(data: {
    name: string;
    phone?: string;
    user_id: string;
  }): Promise<Merchant> {
    try {
      const result = await DatabaseService.execute(
        `INSERT INTO merchants (name, phone, user_id, created_at, needs_sync)
         VALUES (?, ?, ?, ?, 1)`,
        [data.name, data.phone || null, data.user_id, new Date().toISOString()],
      );

      const merchant = await this.findById(result.lastInsertRowId as number);
      if (!merchant) {
        throw new DatabaseError('Impossible de récupérer le commerçant créé');
      }
      return merchant;
    } catch (error) {
      console.error('Erreur MerchantRepository.create:', error);
      throw new DatabaseError("Impossible de créer le commerçant");
    }
  }

  static async deleteByUserId(userId: number): Promise<void> {
    try {
      await DatabaseService.execute('DELETE FROM merchants WHERE user_id = ?', [userId]);
    } catch (error) {
      console.error('Erreur deleteByUserId:', error);
      throw new DatabaseError('Impossible de supprimer les commerçants');
    }
  }

  static async searchByName(query: string): Promise<Merchant[]> {
    try {
      return await DatabaseService.query<Merchant>(
        'SELECT * FROM merchants WHERE name LIKE ? ORDER BY name ASC',
        [`%${query}%`],
      );
    } catch (error) {
      console.error('Erreur MerchantRepository.searchByName:', error);
      return [];
    }
  }
}
