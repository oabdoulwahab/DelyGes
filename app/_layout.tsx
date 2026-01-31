import { Slot } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useEffect, useState } from "react";
import NavigationTabs from "../components/NavigationTabs";
import { initializeDatabase } from "../src/database/db";
import { useAuth } from "../src/hooks/useAuth";
import { ModalProvider } from "../providers/ModalProvider";

export default function Layout() {
  const [dbReady, setDbReady] = useState(false);
  const { isAuthenticated, authReady } = useAuth();

  useEffect(() => {
    initializeDatabase().then(() => setDbReady(true));
  }, []);

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