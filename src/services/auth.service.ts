// src/services/auth.service.ts
import { UserRepository } from '../repositories/user.repository';
import { Security } from '../utils/security';
import { Validators } from '../utils/validators';
import { AuthError, ValidationError, NotFoundError } from '../utils/errors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginCredentials, RegisterData, User } from '../types';

type AppError = AuthError | ValidationError | NotFoundError;

const STORAGE_KEYS = {
  TOKEN: '@delivery_app_token',
  USER: '@delivery_app_user',
  REMEMBER_ME: '@delivery_app_remember_me'
};

export class AuthService {
  static async login(credentials: LoginCredentials): Promise<{ user: Omit<User, 'password'>; token: string }> {
    try {
      // Validation des identifiants
      if (!credentials.emailOrPhone || !credentials.password) {
        throw new ValidationError('Email/téléphone et mot de passe requis');
      }

      // Trouver l'utilisateur
      const user = await UserRepository.findByEmailOrPhone(credentials.emailOrPhone);
      if (!user) {
        throw new AuthError('Identifiants incorrects');
      }

      // Vérifier le mot de passe
      if (Security.isFirebaseManaged(user.password)) {
        throw new AuthError('Connectez-vous via Firebase');
      }

      const isValidPassword = await Security.comparePassword(credentials.password, user.password);
      if (!isValidPassword) {
        throw new AuthError('Identifiants incorrects');
      }

      // Générer un token
      const token = Security.generateToken(user.id);

      await this.storeAuthData(user, token, credentials.rememberMe);

      const { password: _, ...userWithoutPassword } = user;
      return { user: userWithoutPassword as Omit<User, 'password'>, token };
    } catch (error) {
      if (error instanceof AuthError || error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new AuthError('Erreur lors de la connexion');
    }
  }

  static async register(data: RegisterData): Promise<{ user: Omit<User, 'password'>; token: string }> {
    try {
      // Validation des données
      if (data.password !== data.confirmPassword) {
        throw new ValidationError('Les mots de passe ne correspondent pas');
      }

      if (!data.acceptCGU) {
        throw new ValidationError('Vous devez accepter les CGU');
      }

      // Vérifier si l'utilisateur existe déjà
      const exists = await UserRepository.exists(data.email || data.phone);
      if (exists) {
        throw new ValidationError('Cet email ou téléphone est déjà utilisé');
      }

      // Valider le mot de passe
      const passwordValidation = Validators.isPasswordStrong(data.password);
      if (!passwordValidation.valid) {
        throw new ValidationError(`Mot de passe faible: ${passwordValidation.errors.join(', ')}`);
      }

      // Hasher le mot de passe avant stockage
      const hashedPassword = await Security.hashPassword(data.password);

      const user = await UserRepository.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: hashedPassword
      });

      // Générer un token
      const token = Security.generateToken(user.id);

      await this.storeAuthData(user, token, false);

      const { password: _, ...userWithoutPassword } = user;
      return { user: userWithoutPassword as Omit<User, 'password'>, token };
    } catch (error) {
      if (error instanceof AuthError || error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new Error('Erreur lors de l\'inscription');
    }
  }

  // Déconnexion
  static async logout(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.REMEMBER_ME
      ]);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }

  static async checkAuth(): Promise<{ user: Omit<User, 'password'>; token: string } | null> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);

      if (!token || !userJson) {
        return null;
      }

      // Vérifier la validité du token
      const { userId, valid } = Security.validateToken(token);
      if (!valid) {
        await this.logout();
        return null;
      }

      // Vérifier que l'utilisateur existe toujours
      const user = await UserRepository.findById(userId);
      if (!user) {
        await this.logout();
        return null;
      }

      const { password: _, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, token };
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'auth:', error);
      return null;
    }
  }

  static async getCurrentUser(): Promise<Omit<User, 'password'> | null> {
    const authData = await this.checkAuth();
    return authData?.user || null;
  }

  // Changer de mot de passe
  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('Utilisateur');
      }

      // Vérifier l'ancien mot de passe
      const isValid = await Security.comparePassword(currentPassword, user.password);
      if (!isValid) {
        throw new ValidationError('Mot de passe actuel incorrect');
      }

      // Valider le nouveau mot de passe
      const passwordValidation = Validators.isPasswordStrong(newPassword);
      if (!passwordValidation.valid) {
        throw new ValidationError(`Mot de passe faible: ${passwordValidation.errors.join(', ')}`);
      }

      // Hasher le nouveau mot de passe avant stockage
      const hashedNewPassword = await Security.hashPassword(newPassword);
      await UserRepository.update(userId, { password: hashedNewPassword });
    } catch (error) {
      if (error instanceof AuthError || error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new Error('Erreur lors du changement de mot de passe');
    }
  }

  private static async storeAuthData(user: Record<string, unknown>, token: string, rememberMe: boolean = false): Promise<void> {
    try {
      const { password: _, ...userWithoutPassword } = user;
      
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userWithoutPassword));
      
      if (rememberMe) {
        await AsyncStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
      }
    } catch (error) {
      console.error('Erreur lors du stockage des données:', error);
      throw new Error('Impossible de sauvegarder les informations de connexion');
    }
  }

  // Vérifier si "rester connecté" est activé
  static async isRememberMeEnabled(): Promise<boolean> {
    try {
      const rememberMe = await AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_ME);
      return rememberMe === 'true';
    } catch {
      return false;
    }
  }
}