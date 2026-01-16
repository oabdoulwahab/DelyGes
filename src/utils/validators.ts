// src/utils/validators.ts
import * as Yup from 'yup';
import { fr } from 'date-fns/locale';
import { parse, isValid, isFuture, isBefore } from 'date-fns';

export const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
export const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Schémas de validation
export const loginSchema = Yup.object().shape({
  emailOrPhone: Yup.string()
    .required('Email ou téléphone requis')
    .test('email-or-phone', 'Email ou téléphone invalide', (value) => {
      if (!value) return false;
      return emailRegex.test(value) || phoneRegex.test(value.replace(/\s/g, ''));
    }),
  password: Yup.string()
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères')
    .required('Mot de passe requis'),
  rememberMe: Yup.boolean().default(false),
});

export const registerSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .required('Nom complet requis'),
  email: Yup.string()
    .email('Email invalide')
    .optional(),
  phone: Yup.string()
    .matches(phoneRegex, 'Numéro de téléphone français invalide')
    .required('Téléphone requis'),
  password: Yup.string()
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères')
    .matches(/[A-Z]/, 'Doit contenir au moins une majuscule')
    .matches(/[a-z]/, 'Doit contenir au moins une minuscule')
    .matches(/\d/, 'Doit contenir au moins un chiffre')
    .required('Mot de passe requis'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Les mots de passe ne correspondent pas')
    .required('Confirmation du mot de passe requise'),
  acceptCGU: Yup.boolean()
    .oneOf([true], 'Vous devez accepter les CGU')
    .required('Acceptation des CGU requise'),
});

export const deliverySchema = Yup.object().shape({
  recipient_name: Yup.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .required('Nom du destinataire requis'),
  phone: Yup.string()
    .matches(phoneRegex, 'Numéro de téléphone invalide')
    .optional(),
  address: Yup.string()
    .min(5, 'L\'adresse doit contenir au moins 5 caractères')
    .max(200, 'L\'adresse ne peut pas dépasser 200 caractères')
    .required('Adresse requise'),
  parcel_value: Yup.number()
    .min(0, 'La valeur ne peut pas être négative')
    .optional(),
  delivery_fee: Yup.number()
    .min(0, 'Les frais ne peuvent pas être négatifs')
    .required('Frais de livraison requis'),
});

export const dateSchema = Yup.object().shape({
  date: Yup.string()
    .test('valid-date', 'Date invalide', (value) => {
      if (!value) return true;
      const date = parse(value, 'yyyy-MM-dd', new Date(), { locale: fr });
      return isValid(date) && !isFuture(date);
    }),
  dateRange: Yup.object().shape({
    start: Yup.string()
      .required('Date de début requise')
      .test('valid-start-date', 'Date de début invalide', (value) => {
        if (!value) return false;
        const date = parse(value, 'yyyy-MM-dd', new Date(), { locale: fr });
        return isValid(date);
      }),
    end: Yup.string()
      .required('Date de fin requise')
      .test('valid-end-date', 'Date de fin invalide', (value, context) => {
        if (!value) return false;
        const startDate = parse(context.parent.start, 'yyyy-MM-dd', new Date(), { locale: fr });
        const endDate = parse(value, 'yyyy-MM-dd', new Date(), { locale: fr });
        
        return isValid(endDate) && isBefore(startDate, endDate);
      }),
  }),
});

// Fonctions de validation
export const Validators = {
  // Valider un email
  isEmail(email: string): boolean {
    return emailRegex.test(email);
  },

  // Valider un téléphone français
  isFrenchPhone(phone: string): boolean {
    return phoneRegex.test(phone.replace(/\s/g, ''));
  },

  // Valider un mot de passe
  isPasswordStrong(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 6) {
      errors.push('Minimum 6 caractères');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Au moins une majuscule');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Au moins une minuscule');
    }
    if (!/\d/.test(password)) {
      errors.push('Au moins un chiffre');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Formater un téléphone
  formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    
    return phone;
  },

  // Valider un montant
  isValidAmount(amount: string): boolean {
    const num = parseFloat(amount.replace(',', '.'));
    return !isNaN(num) && num >= 0;
  },

  // Valider une date
  isValidDate(date: string): boolean {
    try {
      const d = new Date(date);
      return d instanceof Date && !isNaN(d.getTime());
    } catch {
      return false;
    }
  }
};