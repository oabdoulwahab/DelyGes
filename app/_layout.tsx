import { Slot } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useEffect, useState } from "react";
// IMPORT IMPORTANT :
import { GestureHandlerRootView } from 'react-native-gesture-handler'; 

import NavigationTabs from "../components/NavigationTabs";
import { initializeDatabase } from "../src/database/db";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { ModalProvider } from "../providers/ModalProvider";
import { setupNotifications, setupBackgroundTask } from "../src/services/notification.service";

function RootLayoutNav() {
  const { isAuthenticated, authReady } = useAuth();
  const [servicesReady, setServicesReady] = useState(false);

  useEffect(() => {
    const initServices = async () => {
      try {
        await setupNotifications();
        if (isAuthenticated) {
          await setupBackgroundTask();
        }
      } catch (e) {
        console.error("Erreur services:", e);
      } finally {
        setServicesReady(true);
      }
    };

    if (authReady) {
      initServices();
    }
  }, [authReady, isAuthenticated]);

  if (!authReady || !servicesReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    // On enveloppe TOUT le contenu ici pour que le Swipe fonctionne partout
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Slot />
        {isAuthenticated && <NavigationTabs />}
      </View>
    </GestureHandlerRootView>
  );
}

export default function Layout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        await initializeDatabase();
        setDbReady(true);
      } catch (error) {
        console.error('❌ Erreur critique DB:', error);
      }
    };
    initApp();
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10 }}>Initialisation...</Text>
      </View>
    );
  }

  return (
    <AuthProvider isDbReady={dbReady}>
      <ModalProvider>
        <RootLayoutNav />
      </ModalProvider>
    </AuthProvider>
  );
}