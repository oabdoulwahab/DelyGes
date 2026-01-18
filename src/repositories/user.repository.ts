// src/repositories/user.repository.ts
import { DatabaseService } from '../database/db';
import { User, UserCreateDTO, UserUpdateDTO } from '../types';
import { Security } from '../utils/security';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors';

export class UserRepository {
  // Trouver un utilisateur par ID
  static async findById(id: number): Promise<User | null> {
    try {
      return await DatabaseService.getOne<User>(
        'SELECT * FROM user WHERE id = ?',
        [id]
      );
    } catch (error) {
      console.error('Erreur findById:', error);
      throw new DatabaseError('Impossible de récupérer l\'utilisateur');
    }
  }

  // Trouver par email
  static async findByEmail(email: string): Promise<User | null> {
    try {
      return await DatabaseService.getOne<User>(
        'SELECT * FROM user WHERE email = ?',
        [email]
      );
    } catch (error) {
      console.error('Erreur findByEmail:', error);
      throw new DatabaseError('Impossible de récupérer l\'utilisateur');
    }
  }

  // Trouver par téléphone
  static async findByPhone(phone: string): Promise<User | null> {
    try {
      return await DatabaseService.getOne<User>(
        'SELECT * FROM user WHERE phone = ?',
        [phone]
      );
    } catch (error) {
      console.error('Erreur findByPhone:', error);
      throw new DatabaseError('Impossible de récupérer l\'utilisateur');
    }
  }

  // Trouver par email ou téléphone
  static async findByEmailOrPhone(identifier: string): Promise<User | null> {
    try {
      return await DatabaseService.getOne<User>(
        'SELECT * FROM user WHERE email = ? OR phone = ?',
        [identifier, identifier]
      );
    } catch (error) {
      console.error('Erreur findByEmailOrPhone:', error);
      throw new DatabaseError('Impossible de récupérer l\'utilisateur');
    }
  }

  // Créer un utilisateur
  static async create(userData: UserCreateDTO): Promise<User> {
    try {
      // Hash le mot de passe
      const hashedPassword = await Security.hashPassword(userData.password);
      
      const result = await DatabaseService.execute(
        `INSERT INTO user (name, email, phone, password) 
         VALUES (?, ?, ?, ?)`,
        [userData.name, userData.email || null, userData.phone, hashedPassword]
      );

      const newUser = await this.findById(result.lastInsertRowId as number);
      if (!newUser) {
        throw new DatabaseError('Impossible de récupérer l\'utilisateur créé');
      }

      return newUser;
    } catch (error) {
      console.error('Erreur create:', error);
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ValidationError('Cet email ou téléphone est déjà utilisé');
      }
      throw new DatabaseError('Impossible de créer l\'utilisateur');
    }
  }

  // Mettre à jour un utilisateur
  static async update(id: number, userData: UserUpdateDTO): Promise<User> {
    try {
      const updates: string[] = [];
      const params: any[] = [];

      if (userData.name) {
        updates.push('name = ?');
        params.push(userData.name);
      }

      if (userData.email) {
        updates.push('email = ?');
        params.push(userData.email);
      }

      if (userData.phone) {
        updates.push('phone = ?');
        params.push(userData.phone);
      }

      if (userData.password) {
        const hashedPassword = await Security.hashPassword(userData.password);
        updates.push('password = ?');
        params.push(hashedPassword);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      if (updates.length === 0) {
        throw new ValidationError('Aucune donnée à mettre à jour');
      }

      const query = `UPDATE user SET ${updates.join(', ')} WHERE id = ?`;
      
      await DatabaseService.execute(query, params);

      const updatedUser = await this.findById(id);
      if (!updatedUser) {
        throw new NotFoundError('Utilisateur');
      }

      return updatedUser;
    } catch (error) {
      console.error('Erreur update:', error);
      if (error instanceof DatabaseError || error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new DatabaseError('Impossible de mettre à jour l\'utilisateur');
    }
  }

  // Supprimer un utilisateur
  static async delete(id: number): Promise<void> {
    try {
      const user = await this.findById(id);
      if (!user) {
        throw new NotFoundError('Utilisateur');
      }

      await DatabaseService.execute('DELETE FROM user WHERE id = ?', [id]);
    } catch (error) {
      console.error('Erreur delete:', error);
      if (error instanceof DatabaseError || error instanceof NotFoundError || error instanceof ValidationError) throw error;
      throw new DatabaseError('Impossible de supprimer l\'utilisateur');
    }
  }

  // Vérifier si un utilisateur existe
  static async exists(identifier: string): Promise<boolean> {
    try {
      const count = await DatabaseService.count(
        'SELECT COUNT(*) as count FROM user WHERE email = ? OR phone = ?',
        [identifier, identifier]
      );
      return count > 0;
    } catch (error) {
      console.error('Erreur exists:', error);
      throw new DatabaseError('Impossible de vérifier l\'existence de l\'utilisateur');
    }
  }

  // Compter tous les utilisateurs
  static async countAll(): Promise<number> {
    try {
      return await DatabaseService.count('SELECT COUNT(*) as count FROM user');
    } catch (error) {
      console.error('Erreur countAll:', error);
      throw new DatabaseError('Impossible de compter les utilisateurs');
    }
  }
}