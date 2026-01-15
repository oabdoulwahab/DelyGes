// src/types/index.ts
export type User = {
  id: number;
  name: string;
  email?: string;
  phone: string;
  password: string;
  created_at: string;
};

export type DeliveryStatus = 'A_LIVRER' | 'LIVREE' | 'ANNULEE';

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
};

export type DeliveryFilters = {
  status?: DeliveryStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};