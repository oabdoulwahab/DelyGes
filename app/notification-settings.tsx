import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { UserRepository } from "../src/repositories/user.repository";
import { BlurView } from "expo-blur";
import { COLORS } from "../styles/colors";
import { commonStyles } from "../styles/common";
import { notificationSettingsStyles } from "../styles/notificationSettingsStyles";
import { useAuth } from "../src/context/AuthContext";
import { useAutoSave } from "../src/hooks/useAutoSave";

type NotificationSettings = {
  reminder_notifications: number;
  payment_notifications: number;
  delivery_created_notifications: number;
  daily_summary_notifications: number;
};

export default function NotificationSettings() {
  const { user } = useAuth();
  const { autoSave } = useAutoSave({
    userId: user?.id ?? 0,
    delay: 300,
  });

  const [settings, setSettings] = useState<NotificationSettings>({
    reminder_notifications: 1,
    payment_notifications: 1,
    delivery_created_notifications: 1,
    daily_summary_notifications: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  // Charger les paramètres
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      try {
        const userData = await UserRepository.findById(user.id);

        if (userData) {
          setSettings({
            reminder_notifications: userData.reminder_notifications ?? 1,
            payment_notifications: userData.payment_notifications ?? 1,
            delivery_created_notifications: userData.delivery_created_notifications ?? 1,
            daily_summary_notifications: userData.daily_summary_notifications ?? 0,
          });
        }
      } catch (error) {
        console.error("❌ Erreur chargement paramètres:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const updateSetting = (field: keyof NotificationSettings, value: number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    autoSave(field, value);
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <View style={commonStyles.container}>
        <Text style={notificationSettingsStyles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      {/* En-tête */}
      <BlurView intensity={95} style={notificationSettingsStyles.header}>
        <TouchableOpacity style={notificationSettingsStyles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={notificationSettingsStyles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <ScrollView style={notificationSettingsStyles.content}>
        {/* Section Rappels */}
        <View style={commonStyles.section}>
          <Text style={notificationSettingsStyles.sectionTitle}>RAPPELS</Text>
          
          <View style={commonStyles.card}>
            <View style={notificationSettingsStyles.settingItem}>
              <View style={notificationSettingsStyles.settingInfo}>
                <MaterialIcons name="notifications" size={20} color={COLORS.primary} />
                <View style={notificationSettingsStyles.settingTexts}>
                  <Text style={notificationSettingsStyles.settingLabel}>Rappels de saisie</Text>
                  <Text style={notificationSettingsStyles.settingDescription}>
                    Vous rappelle de saisir vos livraisons si inactif 24h
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.reminder_notifications === 1}
                onValueChange={(value) =>
                  updateSetting('reminder_notifications', value ? 1 : 0)
                }
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            <View style={[notificationSettingsStyles.settingItem, notificationSettingsStyles.noBorder]}>
              <View style={notificationSettingsStyles.settingInfo}>
                <MaterialIcons name="summarize" size={20} color={COLORS.primary} />
                <View style={notificationSettingsStyles.settingTexts}>
                  <Text style={notificationSettingsStyles.settingLabel}>Résumé quotidien</Text>
                  <Text style={notificationSettingsStyles.settingDescription}>
                    Reçu chaque jour à 20h
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.daily_summary_notifications === 1}
                onValueChange={(value) =>
                  updateSetting('daily_summary_notifications', value ? 1 : 0)
                }
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        </View>

        {/* Section Activités */}
        <View style={commonStyles.section}>
          <Text style={notificationSettingsStyles.sectionTitle}>ACTIVITÉS</Text>
          
          <View style={commonStyles.card}>
            <View style={notificationSettingsStyles.settingItem}>
              <View style={notificationSettingsStyles.settingInfo}>
                <MaterialIcons name="add-task" size={20} color={COLORS.primary} />
                <View style={notificationSettingsStyles.settingTexts}>
                  <Text style={notificationSettingsStyles.settingLabel}>Nouvelles livraisons</Text>
                  <Text style={notificationSettingsStyles.settingDescription}>
                    Notification quand vous créez une livraison
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.delivery_created_notifications === 1}
                onValueChange={(value) =>
                  updateSetting('delivery_created_notifications', value ? 1 : 0)
                }
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            <View style={[notificationSettingsStyles.settingItem, notificationSettingsStyles.noBorder]}>
              <View style={notificationSettingsStyles.settingInfo}>
                <MaterialIcons name="payments" size={20} color={COLORS.primary} />
                <View style={notificationSettingsStyles.settingTexts}>
                  <Text style={notificationSettingsStyles.settingLabel}>Livraisons terminées</Text>
                  <Text style={notificationSettingsStyles.settingDescription}>
                    Notification quand vous marquez une livraison comme terminée
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.payment_notifications === 1}
                onValueChange={(value) =>
                  updateSetting('payment_notifications', value ? 1 : 0)
                }
                trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        </View>

        {/* Information */}
        <View style={notificationSettingsStyles.infoBox}>
          <MaterialIcons name="info" size={20} color={COLORS.muted} />
          <Text style={notificationSettingsStyles.infoText}>
            Les notifications en arrière-plan nécessitent que l'application reste installée. 
            Les rappels fonctionnent même quand l'app est fermée.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}