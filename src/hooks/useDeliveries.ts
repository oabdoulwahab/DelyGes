// src/hooks/useDeliveries.ts
import { useEffect, useCallback } from 'react';
import { useDeliveryStore } from '../store/delivery.store';
import { DeliveryFilters, DeliveryStatus } from '../types';

export const useDeliveries = (initialFilters?: DeliveryFilters) => {
  const {
    deliveries,
    filteredDeliveries,
    selectedDeliveries,
    isLoading,
    error,
    stats,
    filters,
    loadDeliveries,
    loadStats,
    addDelivery,
    updateDelivery,
    deleteDelivery,
    markAsDelivered,
    cancelDelivery,
    toggleDeliverySelection,
    clearSelectedDeliveries,
    setFilters,
    clearFilters,
    searchDeliveries,
    clearError
  } = useDeliveryStore();

  // Charger les livraisons au montage
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    } else {
      loadDeliveries();
    }
  }, []);

  // Charger les statistiques
  useEffect(() => {
    loadStats();
  }, []);

  // Grouper par statut
  const groupByStatus = useCallback(() => {
    return deliveries.reduce((groups, delivery) => {
      const status = delivery.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(delivery);
      return groups;
    }, {} as Record<DeliveryStatus, typeof deliveries>);
  }, [deliveries]);

  // Grouper par jour
  const groupByDay = useCallback(() => {
    return deliveries.reduce((groups, delivery) => {
      const date = new Date(delivery.created_at).toLocaleDateString('fr-FR');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(delivery);
      return groups;
    }, {} as Record<string, typeof deliveries>);
  }, [deliveries]);

  // Filtrer par statut
  const filterByStatus = useCallback((status: DeliveryStatus) => {
    setFilters({ ...filters, status });
  }, [filters, setFilters]);

  // Calculer le total des livraisons sélectionnées
  const selectedTotal = useCallback(() => {
    return deliveries
      .filter(d => selectedDeliveries.includes(d.id) && d.status !== 'ANNULEE')
      .reduce((sum, d) => sum + d.delivery_fee, 0);
  }, [deliveries, selectedDeliveries]);

  return {
    // Données
    deliveries,
    filteredDeliveries,
    selectedDeliveries,
    isLoading,
    error,
    stats,
    filters,
    
    // Actions
    loadDeliveries,
    loadStats,
    addDelivery,
    updateDelivery,
    deleteDelivery,
    markAsDelivered,
    cancelDelivery,
    toggleDeliverySelection,
    clearSelectedDeliveries,
    setFilters,
    clearFilters,
    searchDeliveries,
    clearError,
    
    // Méthodes utilitaires
    groupByStatus,
    groupByDay,
    filterByStatus,
    selectedTotal,
    
    // États dérivés
    hasSelectedDeliveries: selectedDeliveries.length > 0,
    selectedCount: selectedDeliveries.length,
    selectedAmount: selectedTotal(),
    
    // Filtres courants
    isTodayFilter: filters.period === 'today',
    isWeekFilter: filters.period === 'week',
    isMonthFilter: filters.period === 'month',
    isCustomFilter: filters.period === 'custom'
  };
};