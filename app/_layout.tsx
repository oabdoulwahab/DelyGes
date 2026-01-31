// app/_layout.tsx
import { Slot } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useEffect, useState } from "react";
import NavigationTabs from "../components/NavigationTabs";
import { initializeDatabase } from "../src/database/db";
import { useAuth } from "../src/hooks/useAuth";
import { ModalProvider } from "../providers/ModalProvider";
import { setupNotifications, setupBackgroundTask } from "../src/services/notification.service";

export default function Layout() {
  const [dbReady, setDbReady] = useState(false);
  const { isAuthenticated, authReady } = useAuth();

  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialiser la base de données
        await initializeDatabase();
        
        // Configurer les notifications
        await setupNotifications();
        
        // Configurer la tâche en arrière-plan (si l'utilisateur est connecté)
        if (isAuthenticated) {
          await setupBackgroundTask();
        }
        
        setDbReady(true);
      } catch (error) {
        console.error('❌ Erreur initialisation app:', error);
        setDbReady(true); // Continuer même en cas d'erreur
      }
    };

    initApp();
  }, [isAuthenticated]);

  if (!dbReady || !authReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <ModalProvider>
      <View style={{ flex: 1 }}>
        <Slot />
        {isAuthenticated && <NavigationTabs />}
      </View>
    </ModalProvider>
  );
}