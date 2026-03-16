import { Redirect } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import { useAuth } from "../src/hooks/useAuth";
// import { completeReset } from "../src/complete-reset";
// import { useEffect } from "react";

export default function Index() {
  const { isAuthenticated, authReady } = useAuth();
  // useEffect(() => {
  //   completeReset();
  // }, []);
  // 1. On bloque TOUTE redirection tant que le check SQL n'est pas FINI
  if (!authReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "white",
        }}
      >
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 10 }}>Vérification de session...</Text>
      </View>
    );
  }

  // 2. Maintenant que authReady est true, on peut faire confiance à isAuthenticated
  console.log("🎯 Redirection finale. Authentifié:", isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/dashboard" />;
  } else {
    return <Redirect href="/login" />;
  }
}
