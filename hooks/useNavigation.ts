// src/hooks/useNavigation.ts
import { useRouter, usePathname } from "expo-router";

export function useNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const goBack = () => {
    // Logique intelligente pour savoir où retourner
    console.log("📍 Navigation depuis:", pathname);
    
    if (pathname.includes("/add-delivery")) {
      console.log("➡️ Retour aux livraisons");
      router.replace("/deliveries");
    } 
    else if (pathname.includes("/delivery/")) {
      console.log("➡️ Retour aux livraisons (détail)");
      router.replace("/deliveries");
    }
    else if (pathname.includes("/settings")) {
      console.log("➡️ Retour au dashboard");
      router.replace("/dashboard");
    }
    else if (pathname.includes("/login")) {
      console.log("➡️ Retour à l'accueil");
      router.replace("/");
    }
    else if (pathname.includes("/register")) {
      console.log("➡️ Retour à la connexion");
      router.replace("/login");
    }
    else {
      console.log("➡️ Navigation par défaut (back)");
      router.back(); // Fallback si aucune règle ne correspond
    }
  };

  const goToDashboard = () => {
    console.log("➡️ Aller au dashboard");
    router.replace("/dashboard");
  };
  
  const goToDeliveries = () => {
    console.log("➡️ Aller aux livraisons");
    router.replace("/deliveries");
  };
  
  const goToLogin = () => {
    console.log("➡️ Aller à la connexion");
    router.replace("/login");
  };
  
  const goToRegister = () => {
    console.log("➡️ Aller à l'inscription");
    router.replace("/register");
  };
  
  const goToSettings = () => {
    console.log("➡️ Aller aux paramètres");
    router.replace("/settings");
  };

  const goToAddDelivery = () => {
    console.log("➡️ Aller à l'ajout de livraison");
    router.push("/add-delivery"); // Utiliser push pour garder l'historique
  };

  const goToDeliveryDetail = (id: number) => {
    console.log(`➡️ Aller au détail livraison ${id}`);
    router.push(`/delivery/${id}`);
  };

  return {
    goBack,
    goToDashboard,
    goToDeliveries,
    goToLogin,
    goToRegister,
    goToSettings,
    goToAddDelivery,
    goToDeliveryDetail,
    currentPath: pathname, // Pour déboguer
  };
}