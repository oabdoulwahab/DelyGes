// src/hooks/useSync.ts
import { useAuth } from '../context/AuthContext';
import { syncService } from '../services/sync.service';

export const useSync = () => {
  const { user, isAuthenticated } = useAuth();

  // Fonction pour marquer et synchroniser après une modification
  const markAndSync = async (table: string, id: number) => {
    if (!isAuthenticated || !user) {
      console.log('⏭️ Sync ignorée: utilisateur non connecté');
      return;
    }
    
    console.log(`🏷️ Marquage ${table} #${id} pour synchronisation`);
    await syncService.markForSync(table, id);
  };

  return { markAndSync };
};