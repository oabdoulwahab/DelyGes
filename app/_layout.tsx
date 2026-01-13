import { Stack } from "expo-router";
import { useEffect } from "react";
import { initDB } from "../src/database/db";
import NavigationTabs from "../components/NavigationTabs";
import { View } from "react-native";

export default function Layout() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <NavigationTabs />
    </View>
  );
}