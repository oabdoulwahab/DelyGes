// app/verify-email.tsx
// Route Expo Router de vérification d'adresse email.
// La logique est centralisée dans src/components/VerifyEmailScreen.tsx,
// réutilisée par la garde de navigation (app/_layout.tsx).
import VerifyEmailScreen from "../src/components/VerifyEmailScreen";

export default function VerifyEmail() {
  return <VerifyEmailScreen />;
}
