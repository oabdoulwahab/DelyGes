import { db } from '../database/db';
import bcrypt from 'react-native-bcrypt';

export class AuthService {
  static async login(emailOrPhone: string, password: string) {
    // Validation
    // Recherche utilisateur
    // Vérification mot de passe hashé
    // Génération token
  }

  static async register(userData: RegisterData) {
    // Validation
    // Hash password
    // Création utilisateur
  }
}