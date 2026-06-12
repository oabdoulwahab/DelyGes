// app/_layout.tsx
import { Slot, useRouter } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useEffect, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

import NavigationTabs from "../components/NavigationTabs";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { initializeDatabase } from "../src/database/db";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { ModalProvider } from "../providers/ModalProvider";
import {
  setupNotifications,
  setupBackgroundTask,
  scheduleInactivityReminders,
} from "../src/services/notification.service";
import { addFirebaseColumns } from "../src/database/migrations/add_firebase_columns";
import { addSyncQueueTable } from "../src/database/migrations/add_sync_queue";

// 🔥 Écran de chargement avec timeout
const LoadingScreen = ({ message = "Chargement..." }) => (
  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
    <ActivityIndicator size="large" color="#2563EB" />
    <Text style={{ marginTop: 15, color: "#64748B", fontWeight: "500" }}>{message}</Text>
  </View>
);

function RootLayoutNav() {
  const { isAuthenticated, authReady, user } = useAuth();
  const [servicesReady, setServicesReady] = useState(false);
  const router = useRouter();
  
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Initialisation...");

  // 🔥 TIMEOUT de sécurité : forcage après 5 secondes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!servicesReady) {
        console.log("⏱️ Timeout dépassé, démarrage forcé");
        setServicesReady(true);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [servicesReady]);

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data.type === "delivery_progress" || data.type === "pending_reminder" || data.type === "delivery_created") {
        router.push("/deliveries");
      } else if (data.type === "inactivity_reminder") {
        router.push("/dashboard");
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("🔔 Notification reçue en direct:", notification.request.content.title);
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    setLoadingMessage("Configuration des notifications...");
    setupNotifications().then(() => {
      if (isAuthenticated && user) {
        setLoadingMessage("Préparation...");
        setupBackgroundTask().catch(e => console.log("⚠️ BackgroundTask:", e));
        scheduleInactivityReminders(user.id).catch(e => console.log("⚠️ Reminders:", e));
      }
    }).catch(e => console.error("❌ Erreur services:", e));

    setServicesReady(true);
  }, [authReady, isAuthenticated, user]);

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

  // 🔥 TIMEOUT de sécurité pour la base de données
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!dbReady) {
        console.log("⏱️ Timeout DB, démarrage forcé");
        setDbReady(true);
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [dbReady]);

  useEffect(() => {
    const initApp = async () => {
      try {
        setInitMessage("Initialisation de la base de données...");
        await Promise.race([
          initializeDatabase(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), 5000))
        ]);
        
        setInitMessage("Mise à jour de la structure...");
        await addFirebaseColumns();
        await addSyncQueueTable();
        
        setDbReady(true);
      } catch (error) {
        console.error("❌ Erreur critique initialisation:", error);
        // 🔥 FORCER le démarrage même en cas d'erreur
        setDbReady(true);
      }
    };
    initApp();
  }, []);

  if (!dbReady) {
    return <LoadingScreen message={initMessage} />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider isDbReady={dbReady}>
        <ModalProvider>
          <RootLayoutNav />
        </ModalProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}