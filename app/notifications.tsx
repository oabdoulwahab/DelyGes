import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Alert,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Swipeable } from "react-native-gesture-handler";
import { commonStyles } from "../styles/common";
import { notificationsStyles } from "../styles/notificationsStyles";
import { COLORS } from "../styles/colors";
import { useAuth } from "../src/context/AuthContext";
import { NotificationStore } from "../src/services/notification.store";
import { Notification } from "../src/types/notification";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      const data = await NotificationStore.getAll(user.id);
      setNotifications(data);
    } catch (error) {
      console.error("❌ Erreur chargement notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    await NotificationStore.markAsRead(notificationId);
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    Alert.alert(
      "Marquer tout comme lu",
      "Voulez-vous marquer toutes les notifications comme lues ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Marquer tout",
          onPress: async () => {
            await NotificationStore.markAllAsRead(user.id);
            setNotifications(prev =>
              prev.map(n => ({ ...n, read: true }))
            );
          },
        },
      ]
    );
  };

  const handleDelete = async (notificationId: string) => {
    await NotificationStore.delete(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleClearAll = async () => {
    if (!user) return;
    
    Alert.alert(
      "Tout supprimer",
      "Voulez-vous supprimer toutes les notifications ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout supprimer",
          style: "destructive",
          onPress: async () => {
            await NotificationStore.clearAll(user.id);
            setNotifications([]);
          },
        },
      ]
    );
  };

  const handleNotificationPress = (notification: Notification) => {
    // Marquer comme lu
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    // Navigation selon le type
    switch (notification.type) {
      case 'pending_reminder':
      case 'delivery_progress':
      case 'delivery_created':
        router.push('/deliveries');
        break;
      case 'encouragement':
        // Rester sur l'écran ou aller au dashboard
        break;
      case 'all_completed':
        router.push('/dashboard');
        break;
    }
  };

  const getNotificationIcon = (type: string, read: boolean) => {
    const color = read ? COLORS.muted : COLORS.primary;
    
    switch (type) {
      case 'pending_reminder':
        return <MaterialIcons name="pending-actions" size={24} color={color} />;
      case 'inactivity_reminder':
      case 'reminder_12h':
        return <MaterialIcons name="access-alarm" size={24} color={color} />;
      case 'encouragement':
        return <MaterialIcons name="emoji-events" size={24} color={color} />;
      case 'delivery_progress':
        return <MaterialIcons name="local-shipping" size={24} color={color} />;
      case 'delivery_created':
        return <MaterialIcons name="add-circle" size={24} color={color} />;
      case 'all_completed':
        return <MaterialIcons name="check-circle" size={24} color={color} />;
      default:
        return <MaterialIcons name="notifications" size={24} color={color} />;
    }
  };

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: fr,
    });
  };

  const renderRightActions = (notificationId: string) => (
    <TouchableOpacity
      style={notificationsStyles.deleteAction}
      onPress={() => handleDelete(notificationId)}
    >
      <MaterialIcons name="delete" size={24} color={COLORS.white} />
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Notification }) => (
    <Swipeable renderRightActions={() => renderRightActions(item.id)}>
      <TouchableOpacity
        style={[
          notificationsStyles.notificationItem,
          !item.read && notificationsStyles.notificationUnread,
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={notificationsStyles.notificationIcon}>
          {getNotificationIcon(item.type, item.read)}
          {!item.read && <View style={notificationsStyles.unreadDot} />}
        </View>
        
        <View style={notificationsStyles.notificationContent}>
          <View style={notificationsStyles.notificationHeader}>
            <Text style={[
              notificationsStyles.notificationTitle,
              !item.read && notificationsStyles.notificationTitleUnread
            ]}>
              {item.title}
            </Text>
            <Text style={notificationsStyles.notificationTime}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
          
          <Text style={notificationsStyles.notificationBody}>
            {item.body}
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  const renderEmpty = () => (
    <View style={notificationsStyles.emptyContainer}>
      <MaterialIcons name="notifications-none" size={64} color={COLORS.muted} />
      <Text style={notificationsStyles.emptyTitle}>Aucune notification</Text>
      <Text style={notificationsStyles.emptyText}>
        Vous n'avez pas encore de notifications. Elles apparaîtront ici quand vous en recevrez.
      </Text>
    </View>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={commonStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* En-tête */}
      <BlurView intensity={95} style={notificationsStyles.header}>
        <TouchableOpacity
          style={notificationsStyles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        
        <Text style={notificationsStyles.headerTitle}>Notifications</Text>
        
        {unreadCount > 0 ? (
          <TouchableOpacity
            style={notificationsStyles.headerAction}
            onPress={handleMarkAllAsRead}
          >
            <MaterialIcons name="done-all" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={notificationsStyles.headerAction}
            onPress={handleClearAll}
          >
            <MaterialIcons name="delete-sweep" size={24} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </BlurView>

      {/* Badge de notifications non lues */}
      {unreadCount > 0 && (
        <View style={notificationsStyles.unreadBanner}>
          <Text style={notificationsStyles.unreadBannerText}>
            {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Liste des notifications */}
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={notificationsStyles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}