// app/_layout.tsx
import { Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { initializeDatabase } from "../src/database/db";

export default function Layout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        await initializeDatabase(); // ✅ CRÉE TABLES + MIGRATIONS + INDEX
      } catch (e) {
        console.error("DB init error:", e);
      } finally {
        setReady(true);
      }
    };

    initApp();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
