import { Slot, useRouter } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useEffect, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";

import NavigationTabs from "../components/NavigationTabs";
import { initializeDatabase } from "../src/database/db";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { ModalProvider } from "../providers/ModalProvider";
import {
  setupNotifications,
  setupBackgroundTask,
  scheduleInactivityReminders,
} from "../src/services/notification.service";
import { addFirebaseColumns } from '../src/database/migrations/add_firebase_columns';

function RootLayoutNav() {
  const { isAuthenticated, authReady, user } = useAuth();
  const [servicesReady, setServicesReady] = useState(false);
  const router = useRouter();
  
  // Correction : Utilisation du type correct de Notifications et initialisation à null
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

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
      // Correction : Utilisation de .remove() sur la ref
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  useEffect(() => {
    const initServices = async () => {
      if (!authReady) return;

      try {
        await setupNotifications();
        if (isAuthenticated && user) {
          await setupBackgroundTask();
          await scheduleInactivityReminders(user.id);
        }
      } catch (e) {
        console.error("❌ Erreur services:", e);
      } finally {
        setServicesReady(true);
      }
    };

    initServices();
  }, [authReady, isAuthenticated, user]);

  if (!authReady || !servicesReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" }}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 15, color: "#64748B", fontWeight: "500" }}>
          Chargement ...
        </Text>
      </View>
    );
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

  useEffect(() => {
    const initApp = async () => {
      try {
        await initializeDatabase();
        await addFirebaseColumns();
        setDbReady(true);
      } catch (error) {
        console.error("❌ Erreur critique initialisation:", error);
      }
    };
    initApp();
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 10, color: "#475569" }}>Chargement... </Text>
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