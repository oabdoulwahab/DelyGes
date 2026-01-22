// app/_layout.tsx
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import NavigationTabs from "../components/NavigationTabs";
import { initializeDatabase } from "../src/database/db";

export default function Layout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
      } catch (e) {
        console.error("DB init error:", e);
      } finally {
        setReady(true);
      }
    };

    init();
  }, []);

  // ⛔ Bloquer TOUT tant que la DB n'est pas prête
  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#13ec13" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <NavigationTabs />
    </View>
  );
}
