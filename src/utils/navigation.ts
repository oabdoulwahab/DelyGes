import { Linking } from "react-native";
import { getAppSetting } from "./app-settings";

export type GpsApp = "google" | "yango" | "waze";

export const GPS_APPS: { key: GpsApp; label: string; color: string }[] = [
  { key: "google", label: "Google Maps", color: "#00A859" },
  { key: "yango", label: "Yango Maps", color: "#64748B" },
  { key: "waze", label: "Waze CI", color: "#B45309" },
];

export async function getGpsApp(): Promise<GpsApp> {
  const v = await getAppSetting("gps_app", "google");
  return v === "yango" || v === "waze" ? v : "google";
}

export async function setGpsApp(app: GpsApp): Promise<void> {
  const { setAppSetting } = await import("./app-settings");
  await setAppSetting("gps_app", app);
}

// Ouvre l'itinéraire dans l'app GPS par défaut du livreur.
export async function openItinerary(address: string): Promise<void> {
  const app = await getGpsApp();
  const q = encodeURIComponent(address || "Abidjan");
  const url =
    app === "waze"
      ? `https://waze.com/ul?q=${q}`
      : app === "yango"
        ? `https://maps.yandex.com/?text=${q}`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  try {
    await Linking.openURL(url);
  } catch {
    throw new Error("Impossible d'ouvrir le GPS");
  }
}
