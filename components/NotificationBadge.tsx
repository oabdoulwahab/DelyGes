import { View, Text, TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { NotificationStore } from "../src/services/notification.store";
import { COLORS } from "../styles/colors";
import { useAuth } from "../src/hooks/useAuth";

interface NotificationBadgeProps {
  size?: number;
  color?: string;
}

export default function NotificationBadge({ 
  size = 24, 
  color = COLORS.muted 
}: NotificationBadgeProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      
      // Rafraîchir toutes les 30 secondes
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;
    const count = await NotificationStore.countUnread(user.id);
    setUnreadCount(count);
  };

  const handlePress = () => {
    router.push("/notifications");
  };

  return (
    <TouchableOpacity onPress={handlePress} style={{ position: 'relative' }}>
      <MaterialIcons name="notifications" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: COLORS.danger,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 4,
        }}>
          <Text style={{
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: 'bold',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}