import { Slot } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useEffect, useState } from "react";
import NavigationTabs from "../components/NavigationTabs";
import { AuthProvider, useAuth } from "../src/context/AuthContext"; // Import du nouveau context
import { ModalProvider } from "../providers/ModalProvider";

function RootLayoutNav() {
  const { isAuthenticated, authReady } = useAuth();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Ton code d'initialisation DB actuel...
    setDbReady(true);
  }, []);

  if (!dbReady || !authReady) {
    return <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {/* Grâce au Context, isAuthenticated changera partout dès le login */}
      {isAuthenticated && <NavigationTabs />}
    </View>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <ModalProvider>
        <RootLayoutNav />
      </ModalProvider>
    </AuthProvider>
  );
}