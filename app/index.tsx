// app/index.tsx
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useAuth } from "../src/hooks/useAuth";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Simuler un temps de chargement minimal
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Afficher un indicateur de chargement
  // if (isChecking || isLoading) {
  //   return (
  //     <View style={{ 
  //       flex: 1, 
  //       justifyContent: 'center', 
  //       alignItems: 'center', 
  //       backgroundColor: '#102210' 
  //     }}>
  //       <ActivityIndicator size="large" color="#13ec13" />
  //       <Text style={{ color: '#13ec13', marginTop: 16 }}>
  //         Chargement...
  //       </Text>
  //     </View>
  //   );
  // }

  console.log('🎯 Redirection. Authentifié:', isAuthenticated);
  console.log('📱 URL cible:', isAuthenticated ? '/dashboard' : '/login');

  // Déterminer où rediriger
  if (isAuthenticated) {
    return <Redirect href="/dashboard" />;
  } else {
    return <Redirect href="/login" />;
  }
}