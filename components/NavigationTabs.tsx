import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { navigationTabsStyles } from "../styles/navigationTabsStyles";
import { COLORS } from "../styles/colors";

export default function NavigationTabs() {
  const pathname = usePathname();

  const hideTabsOnScreens = [
    "/delivery/",
    "/login",
    "/add-delivery",
    "/register",
  ];
  const shouldHideTabs = hideTabsOnScreens.some((path) =>
    pathname.includes(path),
  );

  if (shouldHideTabs) return null;

  const isActive = (path: string) => pathname === path;

  return (
    <View style={navigationTabsStyles.wrapper}>
      <View style={navigationTabsStyles.container}>
        {/* DASHBOARD */}
        <TouchableOpacity
          style={navigationTabsStyles.tabItem}
          onPress={() => router.push("/dashboard")}
        >
          <View
            style={[
              navigationTabsStyles.iconWrapper,
              isActive("/dashboard") && navigationTabsStyles.activeIconWrapper,
            ]}
          >
            <MaterialIcons
              name="dashboard"
              size={24}
              color={isActive("/dashboard") ? COLORS.primary : COLORS.muted}
            />
          </View>
          <Text
            style={[
              navigationTabsStyles.tabText,
              { color: isActive("/dashboard") ? COLORS.primary : COLORS.muted },
            ]}
          >
            Bord
          </Text>
        </TouchableOpacity>

        {/* DELIVERIES */}
        <TouchableOpacity
          style={navigationTabsStyles.tabItem}
          onPress={() => router.push("/deliveries")}
        >
          <View
            style={[
              navigationTabsStyles.iconWrapper,
              isActive("/deliveries") && navigationTabsStyles.activeIconWrapper,
            ]}
          >
            <MaterialIcons
              name="local-shipping"
              size={24}
              color={isActive("/deliveries") ? COLORS.primary : COLORS.muted}
            />
          </View>
          <Text
            style={[
              navigationTabsStyles.tabText,
              {
                color: isActive("/deliveries") ? COLORS.primary : COLORS.muted,
              },
            ]}
          >
            Livraisons
          </Text>
        </TouchableOpacity>

        {/* AJOUTER (BOUTON CENTRAL) */}
        <TouchableOpacity
          style={navigationTabsStyles.centralTabItem}
          onPress={() => router.push("/add-delivery")}
        >
          <View style={navigationTabsStyles.centralCircle}>
            <MaterialIcons name="add" size={32} color="#FFFFFF" />
          </View>
          <Text style={navigationTabsStyles.tabText}>Ajouter</Text>
        </TouchableOpacity>

        {/* STATS */}
        <TouchableOpacity
          style={navigationTabsStyles.tabItem}
          onPress={() => router.push("/stats")}
        >
          <View
            style={[
              navigationTabsStyles.iconWrapper,
              isActive("/stats") && navigationTabsStyles.activeIconWrapper,
            ]}
          >
            <MaterialIcons
              name="bar-chart"
              size={24}
              color={isActive("/stats") ? COLORS.primary : COLORS.muted}
            />
          </View>
          <Text
            style={[
              navigationTabsStyles.tabText,
              { color: isActive("/stats") ? COLORS.primary : COLORS.muted },
            ]}
          >
            Stats
          </Text>
        </TouchableOpacity>

        {/* SETTINGS */}
        <TouchableOpacity
          style={navigationTabsStyles.tabItem}
          onPress={() => router.push("/settings")}
        >
          <View
            style={[
              navigationTabsStyles.iconWrapper,
              isActive("/settings") && navigationTabsStyles.activeIconWrapper,
            ]}
          >
            <MaterialIcons
              name="settings"
              size={24}
              color={isActive("/settings") ? COLORS.primary : COLORS.muted}
            />
          </View>
          <Text
            style={[
              navigationTabsStyles.tabText,
              { color: isActive("/settings") ? COLORS.primary : COLORS.muted },
            ]}
          >
            Profil
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}