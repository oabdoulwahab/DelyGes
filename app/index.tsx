// app/index.tsx
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "../src/store/auth.store";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('🔄 Initialisation de l\'auth...');
        await checkAuth();
        console.log('✅ Auth initialisée. Authentifié:', isAuthenticated);
      } catch (error) {
        console.error('❌ Auth check error:', error);
      } finally {
        // Attendre un peu pour être sûr que l'état est mis à jour
        setTimeout(() => {
          setIsChecking(false);
        }, 500);
      }
    };

    init();
  }, []);

  // Afficher un indicateur de chargement
  if (isChecking || isLoading) {
    console.log('⏳ Affichage du loading...');
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#102210' 
      }}>
        <ActivityIndicator size="large" color="#13ec13" />
      </View>
    );
  }

  console.log('🎯 Redirection. Authentifié:', isAuthenticated);

  // Déterminer où rediriger
  if (isAuthenticated) {
    return <Redirect href="/dashboard" />;
  } else {
    return <Redirect href="/login" />;
  }
}