// Types d'utilisateur
export type User = {
  id: number;
  name: string;
  email?: string;
  phone: string;
  password: string; // Hashé
  created_at: string;
  updated_at: string;
  firebase_uid?: string;
  siret?: string;
  vehicle?: string;
  is_vat?: number;
  daily_goal?: number;
  monthly_goal?: number;
  reminder_notifications?: number;
  payment_notifications?: number;
  delivery_created_notifications?: number;
  daily_summary_notifications?: number;
  daily_goal_notifications?: number;
};

export type UserCreateDTO = Omit<User, "id" | "created_at" | "updated_at">;
export type UserUpdateDTO = Partial<
  Omit<User, "id" | "created_at" | "updated_at">
>;

// Types de livraison
export type DeliveryStatus = "A_LIVRER" | "LIVREE" | "ANNULEE";

// app/src/types.ts
export type PaymentType =
  | "COLIS_DEJA_PAYE"
  | "CLIENT_PAYE_LIVRAISON"
  | "CLIENT_PAYE_TOUT"
  | "LIVRAISON_DEJA_PAYEE";

export type Merchant = {
  id: number;
  name: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  created_at: string;
  updated_at: string;
  firebase_id?: string;
  user_id?: string;
  needs_sync?: number;
  sync_updated_at?: string;
};

export type Settlement = {
  id: number;
  merchant_id: number;
  amount: number;
  settled_at: string;
  notes?: string;
};

export type Delivery = {
  id: number;
  recipient_name: string;
  phone?: string;
  address: string;
  parcel_value?: number;
  delivery_fee: number;
  status: DeliveryStatus;
  created_at: string;
  delivered_at?: string;
  user_id: number;

  merchant_id?: number;
  payment_type: PaymentType;
  amount_collected: number;
  amount_to_return: number;
  profit: number;
  is_settled: number;
  settled_at?: string;
  reversed?: number;
  notes?: string;
  firebase_id?: string;
  needs_sync?: number;
  sync_updated_at?: string;
};

export type DeliveryCreateDTO = {
  recipient_name: string;
  phone?: string;
  address: string;
  parcel_value?: number;
  delivery_fee: number;
  user_id: number;
  merchant_id?: number;
  payment_type: PaymentType;
  amount_collected?: number;
  amount_to_return?: number;
  profit?: number;
};

export type DeliveryUpdateDTO = Partial<{
  recipient_name: string;
  phone?: string;
  address: string;
  parcel_value?: number;
  delivery_fee: number;
  status: DeliveryStatus;
  delivered_at?: string;
  payment_type: PaymentType;
  merchant_id?: number;
  amount_collected: number;
  amount_to_return: number;
  profit: number;
  needs_sync: number;
}>;

export type DeliveryFilters = {
  status?: DeliveryStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  userId?: number;
  period?: "today" | "week" | "month" | "custom";
};

// Types pour les statistiques
export type DailyEarnings = {
  date: string;
  earnings: number;
  deliveries: number;
};

export type MonthlyStats = {
  month: string;
  earnings: number;
  deliveries: number;
  goal: number;
  progress: number;
};

// Types pour l'authentification
export type LoginCredentials = {
  emailOrPhone: string;
  password: string;
  rememberMe?: boolean;
};

export type RegisterData = {
  name: string;
  email?: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptCGU: boolean;
};

// Type pour le résumé du tableau de bord
export type DashboardSummary = {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  monthGoal: number;
  monthProgress: number;
  todayDeliveries: Record<string, Delivery[]>;
  stats: {
    completed: number;
    pending: number;
    cancelled: number;
  };
};

// Types pour les réponses d'API (si ajout backend plus tard)
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};