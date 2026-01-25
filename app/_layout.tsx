// app/_layout.tsx
import { Stack, router } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useEffect, useState } from "react";
import NavigationTabs from "../components/NavigationTabs";
import { initializeDatabase } from "../src/database/db";
import { useAuth } from "../src/hooks/useAuth";

export default function Layout() {
  const [dbReady, setDbReady] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const init = async () => {
      await initializeDatabase();
      setDbReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!dbReady || isLoading) return;

    console.log('🔐 État auth dans Layout:', {
      isAuthenticated,
      dbReady,
      isLoading
    });

    if (isAuthenticated) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [dbReady, isLoading, isAuthenticated]);

  if (!dbReady || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#102210' }}>
        <ActivityIndicator size="large" color="#13ec13" />
        <Text style={{ color: '#13ec13', marginTop: 16 }}>
          {!dbReady ? 'Initialisation DB...' : 'Vérification auth...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      {isAuthenticated && <NavigationTabs />}
    </View>
  );
}