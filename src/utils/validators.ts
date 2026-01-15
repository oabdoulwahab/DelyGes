import * as Yup from 'yup';

export const loginSchema = Yup.object({
  emailOrPhone: Yup.string().required('Email ou téléphone requis'),
  password: Yup.string().min(6, 'Minimum 6 caractères').required('Mot de passe requis'),
});

export const deliverySchema = Yup.object({
  recipient_name: Yup.string().required('Nom du destinataire requis'),
  address: Yup.string().required('Adresse requise'),
  delivery_fee: Yup.number().positive('Doit être positif').required('Frais requis'),
});