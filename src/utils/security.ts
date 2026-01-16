// src/utils/security.ts
import bcrypt from 'react-native-bcrypt';

export class Security {
  private static readonly SALT_ROUNDS = 10;

  // Hash un mot de passe
  static async hashPassword(password: string): Promise<string> {
    try {
      return await new Promise((resolve, reject) => {
        bcrypt.genSalt(this.SALT_ROUNDS, (err, salt) => {
          if (err) {
            reject(err);
            return;
          }
          
          bcrypt.hash(password, salt, (err, hash) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(hash);
          });
        });
      });
    } catch (error) {
      console.error('Erreur lors du hashage:', error);
      throw new Error('Erreur lors du traitement du mot de passe');
    }
  }

  // Compare un mot de passe avec un hash
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    try {
      return await new Promise((resolve, reject) => {
        bcrypt.compare(password, hash, (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });
    } catch (error) {
      console.error('Erreur lors de la comparaison:', error);
      throw new Error('Erreur lors de la vérification du mot de passe');
    }
  }

  // Génère un token simple (à remplacer par JWT si backend)
  static generateToken(userId: number): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${userId}_${timestamp}_${random}`;
  }

  // Vérifie si un token est valide
  static validateToken(token: string): { userId: number; valid: boolean } {
    try {
      const parts = token.split('_');
      if (parts.length !== 3) {
        return { userId: 0, valid: false };
      }
      
      const userId = parseInt(parts[0]);
      const timestamp = parseInt(parts[1]);
      
      // Vérifie que le token n'est pas expiré (7 jours)
      const isExpired = Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000;
      
      return {
        userId: isNaN(userId) ? 0 : userId,
        valid: !isExpired && !isNaN(userId) && userId > 0
      };
    } catch {
      return { userId: 0, valid: false };
    }
  }
}