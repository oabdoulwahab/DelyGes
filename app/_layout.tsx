// app/_layout.tsx
import { Slot, useRouter } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useEffect, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

import NavigationTabs from "../components/NavigationTabs";
import { initializeDatabase } from "../src/database/db";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { ModalProvider } from "../providers/ModalProvider";
// import { cleanDatabase } from '../src/clean-db';
import {
  setupNotifications,
  setupBackgroundTask,
  scheduleInactivityReminders,
} from "../src/services/notification.service";
import { syncService } from "../src/services/sync.service";
// 🔥 IMPORT MANQUANT
import { addFirebaseColumns } from "../src/database/migrations/add_firebase_columns";

// 🔥 Écran de chargement amélioré
const LoadingScreen = ({ message = "Chargement..." }) => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
    <ActivityIndicator size="large" color="#2563EB" />
    <Text style={{ marginTop: 15, color: "#64748B", fontWeight: "500" }}>
      {message}
    </Text>
  </View>
);

function RootLayoutNav() {
  const { isAuthenticated, authReady, user } = useAuth();
  const [servicesReady, setServicesReady] = useState(false);
  const router = useRouter();
  
  // 🔥 DÉCLARATION DES REFS MANQUANTES
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  
  // 🔥 État pour le message de chargement
  const [loadingMessage, setLoadingMessage] = useState("Initialisation...");

  useEffect(() => {
    // Écouteur de CLIC
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data.type === "delivery_progress" || data.type === "pending_reminder" || data.type === "delivery_created") {
          router.push("/deliveries");
        } else if (data.type === "inactivity_reminder") {
          router.push("/dashboard");
        }
      }
    );

    // Écouteur de RÉCEPTION
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("🔔 Notification reçue en direct:", notification.request.content.title);
      }
    );

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  useEffect(() => {
    const initServices = async () => {
      if (!authReady) return;

      try {
        setLoadingMessage("Configuration des notifications...");
        await setupNotifications();
        
        if (isAuthenticated && user) {
          setLoadingMessage("Préparation de la synchronisation...");
          // 🔥 Lancer en parallèle, ne pas attendre
          Promise.all([
            setupBackgroundTask().catch(e => console.log("⚠️ BackgroundTask:", e)),
            scheduleInactivityReminders(user.id).catch(e => console.log("⚠️ Reminders:", e))
          ]);
        }
      } catch (e) {
        console.error("❌ Erreur services:", e);
      } finally {
        setServicesReady(true);
      }
    };

    initServices();
  }, [authReady, isAuthenticated, user]);

  // 🔥 Afficher l'écran de chargement avec message
  if (!authReady || !servicesReady) {
    return <LoadingScreen message={loadingMessage} />;
  }

  return (
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
  const [initMessage, setInitMessage] = useState("Préparation de la base de données...");

  useEffect(() => {
    const initApp = async () => {
      try {
        setInitMessage("Initialisation de la base de données...");
        await initializeDatabase();
        // await cleanDatabase();
        setInitMessage("Mise à jour de la structure...");
        await addFirebaseColumns();
        
        setDbReady(true);
      } catch (error) {
        console.error("❌ Erreur critique initialisation:", error);
      }
    };
    initApp();
  }, []);

  if (!dbReady) {
    return <LoadingScreen message={initMessage} />;
  }

  return (
    <AuthProvider isDbReady={dbReady}>
      <ModalProvider>
        <RootLayoutNav />
      </ModalProvider>
    </AuthProvider>
  );
}