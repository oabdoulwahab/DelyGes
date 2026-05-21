import { DatabaseService } from '../database/db';
import { User, RegisterData } from '../types';
import { DatabaseError } from '../utils/errors';

export class UserRepository {
  static async findById(id: number): Promise<User | null> {
    try {
      return await DatabaseService.getOne<User>(
        'SELECT * FROM user WHERE id = ?',
        [id],
      );
    } catch (error) {
      console.error('Erreur UserRepository.findById:', error);
      throw new DatabaseError('Impossible de récupérer l\'utilisateur');
    }
  }

  static async findByEmailOrPhone(emailOrPhone: string): Promise<Pick<User, 'id' | 'name' | 'email' | 'phone' | 'password'> | null> {
    try {
      return await DatabaseService.getOne<Pick<User, 'id' | 'name' | 'email' | 'phone' | 'password'>>(
        'SELECT id, name, email, phone, password FROM user WHERE email = ? OR phone = ?',
        [emailOrPhone, emailOrPhone],
      );
    } catch (error) {
      console.error('Erreur UserRepository.findByEmailOrPhone:', error);
      throw new DatabaseError('Impossible de rechercher l\'utilisateur');
    }
  }

  static async update(id: number, data: Record<string, unknown>): Promise<User> {
    try {
      const fields = Object.keys(data).filter((k) => data[k] !== undefined);
      if (fields.length === 0) {
        const existing = await this.findById(id);
        if (!existing) throw new DatabaseError('Utilisateur non trouvé');
        return existing;
      }

      const setClauses = fields.map((f) => `${f} = ?`);
      const values = fields.map((f) => data[f]);
      values.push(id);

      await DatabaseService.execute(
        `UPDATE user SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
      );

      const updated = await this.findById(id);
      if (!updated) throw new DatabaseError('Impossible de récupérer l\'utilisateur mis à jour');
      return updated;
    } catch (error) {
      console.error('Erreur UserRepository.update:', error);
      throw new DatabaseError('Impossible de mettre à jour l\'utilisateur');
    }
  }

  static async exists(emailOrPhone: string): Promise<boolean> {
    try {
      const result = await DatabaseService.getOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM user WHERE email = ? OR phone = ?',
        [emailOrPhone, emailOrPhone],
      );
      return (result?.count ?? 0) > 0;
    } catch (error) {
      console.error('Erreur UserRepository.exists:', error);
      throw new DatabaseError('Impossible de vérifier l\'utilisateur');
    }
  }

  static async create(data: Pick<RegisterData, 'name' | 'email' | 'phone' | 'password'>): Promise<User> {
    try {
      const hashedPassword = data.password; // Already hashed by caller
      const result = await DatabaseService.execute(
        `INSERT INTO user (name, email, phone, password, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [data.name, data.email || null, data.phone, hashedPassword],
      );

      const user = await this.findById(result.lastInsertRowId as number);
      if (!user) throw new DatabaseError('Impossible de récupérer l\'utilisateur créé');
      return user;
    } catch (error) {
      console.error('Erreur UserRepository.create:', error);
      throw new DatabaseError('Impossible de créer l\'utilisateur');
    }
  }

  static async patchPassword(id: number, password: string): Promise<void> {
    try {
      await DatabaseService.execute(
        'UPDATE user SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [password, id],
      );
    } catch (error) {
      console.error('Erreur UserRepository.patchPassword:', error);
      throw new DatabaseError('Impossible de modifier le mot de passe');
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      await DatabaseService.execute('DELETE FROM user WHERE id = ?', [id]);
    } catch (error) {
      console.error('Erreur UserRepository.delete:', error);
      throw new DatabaseError('Impossible de supprimer l\'utilisateur');
    }
  }
}
