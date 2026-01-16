import { Stack } from "expo-router";
import { useEffect } from "react";
import { initDB } from "../src/database/db";
import NavigationTabs from "../components/NavigationTabs";
import { View } from "react-native";
import { useAuthStore } from "../src/store/auth.store";

export default function Layout() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initDB();
        await checkAuth();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    initializeApp();
  }, []);


  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <NavigationTabs />
    </View>
  );
}