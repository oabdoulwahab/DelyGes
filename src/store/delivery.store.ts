// src/store/delivery.store.ts
import { create } from 'zustand';
import { Delivery, DeliveryFilters, DeliveryStatus, DeliveryCreateDTO, DeliveryUpdateDTO, DashboardSummary } from '../types';
import { DeliveryService } from '../services/delivery.service';

interface DeliveryState {
  deliveries: Delivery[];
  filteredDeliveries: Delivery[];
  selectedDeliveries: number[];
  isLoading: boolean;
  error: string | null;
  filters: DeliveryFilters;
  stats: DashboardSummary | null;
  
  // Actions
  loadDeliveries: (filters?: DeliveryFilters) => Promise<void>;
  loadStats: () => Promise<void>;
  addDelivery: (data: Omit<DeliveryCreateDTO, 'user_id'>) => Promise<Delivery>;
  updateDelivery: (id: number, data: DeliveryUpdateDTO) => Promise<Delivery>;
  deleteDelivery: (id: number) => Promise<void>;
  markAsDelivered: (id: number) => Promise<Delivery>;
  cancelDelivery: (id: number) => Promise<Delivery>;
  toggleDeliverySelection: (id: number) => void;
  clearSelectedDeliveries: () => void;
  setFilters: (filters: DeliveryFilters) => void;
  clearFilters: () => void;
  searchDeliveries: (query: string) => void;
  clearError: () => void;
}

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  deliveries: [],
  filteredDeliveries: [],
  selectedDeliveries: [],
  isLoading: false,
  error: null,
  filters: {},
  stats: null,

  loadDeliveries: async (filters?: DeliveryFilters) => {
    set({ isLoading: true, error: null });
    
    try {
      const finalFilters = filters || get().filters;
      const deliveries = await DeliveryService.getMyDeliveries(finalFilters);
      
      set({
        deliveries,
        filteredDeliveries: deliveries,
        isLoading: false,
        filters: finalFilters
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement';
      set({ error: message, isLoading: false });
    }
  },

  loadStats: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const stats = await DeliveryService.getDashboardSummary();
      set({ stats, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement des stats';
      set({ error: message, isLoading: false });
    }
  },

  addDelivery: async (data) => {
    set({ isLoading: true, error: null });
    
    try {
      const newDelivery = await DeliveryService.createDelivery(data);
      
      set((state) => ({
        deliveries: [newDelivery, ...state.deliveries],
        filteredDeliveries: [newDelivery, ...state.filteredDeliveries],
        isLoading: false
      }));
      
      return newDelivery;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'ajout';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateDelivery: async (id, data) => {
    set({ isLoading: true, error: null });
    
    try {
      const updatedDelivery = await DeliveryService.updateDelivery(id, data);
      
      set((state) => ({
        deliveries: state.deliveries.map(d => 
          d.id === id ? updatedDelivery : d
        ),
        filteredDeliveries: state.filteredDeliveries.map(d => 
          d.id === id ? updatedDelivery : d
        ),
        isLoading: false
      }));
      
      return updatedDelivery;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteDelivery: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      await DeliveryService.deleteDelivery(id);
      
      set((state) => ({
        deliveries: state.deliveries.filter(d => d.id !== id),
        filteredDeliveries: state.filteredDeliveries.filter(d => d.id !== id),
        selectedDeliveries: state.selectedDeliveries.filter(dId => dId !== id),
        isLoading: false
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la suppression';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  markAsDelivered: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const updatedDelivery = await DeliveryService.markAsDelivered(id);
      
      set((state) => ({
        deliveries: state.deliveries.map(d => 
          d.id === id ? updatedDelivery : d
        ),
        filteredDeliveries: state.filteredDeliveries.map(d => 
          d.id === id ? updatedDelivery : d
        ),
        selectedDeliveries: state.selectedDeliveries.filter(dId => dId !== id),
        isLoading: false
      }));
      
      return updatedDelivery;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  cancelDelivery: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const updatedDelivery = await DeliveryService.cancelDelivery(id);
      
      set((state) => ({
        deliveries: state.deliveries.map(d => 
          d.id === id ? updatedDelivery : d
        ),
        filteredDeliveries: state.filteredDeliveries.map(d => 
          d.id === id ? updatedDelivery : d
        ),
        selectedDeliveries: state.selectedDeliveries.filter(dId => dId !== id),
        isLoading: false
      }));
      
      return updatedDelivery;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'annulation';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  toggleDeliverySelection: (id) => {
    set((state) => {
      const isSelected = state.selectedDeliveries.includes(id);
      const delivery = state.deliveries.find(d => d.id === id);
      
      // Ne pas permettre la sélection des livraisons terminées ou annulées
      if (delivery && (delivery.status === 'LIVREE' || delivery.status === 'ANNULEE')) {
        return state;
      }
      
      return {
        selectedDeliveries: isSelected
          ? state.selectedDeliveries.filter(dId => dId !== id)
          : [...state.selectedDeliveries, id]
      };
    });
  },

  clearSelectedDeliveries: () => set({ selectedDeliveries: [] }),

  setFilters: (filters) => {
    set({ filters });
    get().loadDeliveries(filters);
  },

  clearFilters: () => {
    set({ filters: {} });
    get().loadDeliveries();
  },

  searchDeliveries: (query) => {
    const { deliveries } = get();
    
    if (!query.trim()) {
      set({ filteredDeliveries: deliveries });
      return;
    }
    
    const filtered = deliveries.filter(delivery => 
      delivery.recipient_name.toLowerCase().includes(query.toLowerCase()) ||
      delivery.address.toLowerCase().includes(query.toLowerCase()) ||
      delivery.phone?.toLowerCase().includes(query.toLowerCase())
    );
    
    set({ filteredDeliveries: filtered });
  },

  clearError: () => set({ error: null })
}));