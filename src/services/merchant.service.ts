import { MerchantRepository } from '../repositories/merchant.repository';
import { Merchant } from '../types';
import { auth } from '../config/firebase';

export class MerchantService {
  static async getAll(): Promise<Merchant[]> {
    return await MerchantRepository.findAll();
  }

  static async search(query: string): Promise<Merchant[]> {
    if (!query.trim()) return [];
    return await MerchantRepository.searchByName(query);
  }

  static async getOrCreate(name: string, phone?: string): Promise<number | null> {
    if (!name.trim()) return null;

    const firebaseUid = auth.currentUser?.uid;
    const userId = firebaseUid || 'local';

    const existing = await MerchantRepository.findByName(name.trim(), userId);
    if (existing) return existing.id;

    const merchant = await MerchantRepository.create({
      name: name.trim(),
      phone: phone?.trim() || undefined,
      user_id: userId,
    });

    return merchant.id;
  }

  static async findById(id: number): Promise<Merchant | null> {
    return await MerchantRepository.findById(id);
  }
}
