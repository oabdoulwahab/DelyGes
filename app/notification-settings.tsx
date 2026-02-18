import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { db } from "../src/database/db";
import { BlurView } from "expo-blur";
import { COLORS } from "../styles/colors";
import { commonStyles } from "../styles/common";
import { useAuth } from "../src/hooks/useAuth";
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
        const userData = await db.getFirstAsync<any>(
          "SELECT * FROM user WHERE id = ?",
          [user.id]
        );

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
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      {/* En-tête */}
      <BlurView intensity={95}  style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <ScrollView style={styles.content}>
        {/* Section Rappels */}
        <View style={commonStyles.section}>
          <Text style={styles.sectionTitle}>RAPPELS</Text>
          
          <View style={commonStyles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <MaterialIcons name="notifications" size={20} color={COLORS.primary} />
                <View style={styles.settingTexts}>
                  <Text style={styles.settingLabel}>Rappels de saisie</Text>
                  <Text style={styles.settingDescription}>
                    Vous rappelle de saisir vos livraisons si inactif 24h
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.reminder_notifications === 1}
                onValueChange={(value) =>
                  updateSetting('reminder_notifications', value ? 1 : 0)
                }
                trackColor={{ false: "#374151", true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            <View style={[styles.settingItem, styles.noBorder]}>
              <View style={styles.settingInfo}>
                <MaterialIcons name="summarize" size={20} color={COLORS.primary} />
                <View style={styles.settingTexts}>
                  <Text style={styles.settingLabel}>Résumé quotidien</Text>
                  <Text style={styles.settingDescription}>
                    Reçu chaque jour à 20h
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.daily_summary_notifications === 1}
                onValueChange={(value) =>
                  updateSetting('daily_summary_notifications', value ? 1 : 0)
                }
                trackColor={{ false: "#374151", true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        </View>

        {/* Section Activités */}
        <View style={commonStyles.section}>
          <Text style={styles.sectionTitle}>ACTIVITÉS</Text>
          
          <View style={commonStyles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <MaterialIcons name="add-task" size={20} color={COLORS.primary} />
                <View style={styles.settingTexts}>
                  <Text style={styles.settingLabel}>Nouvelles livraisons</Text>
                  <Text style={styles.settingDescription}>
                    Notification quand vous créez une livraison
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.delivery_created_notifications === 1}
                onValueChange={(value) =>
                  updateSetting('delivery_created_notifications', value ? 1 : 0)
                }
                trackColor={{ false: "#374151", true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            <View style={[styles.settingItem, styles.noBorder]}>
              <View style={styles.settingInfo}>
                <MaterialIcons name="payments" size={20} color={COLORS.primary} />
                <View style={styles.settingTexts}>
                  <Text style={styles.settingLabel}>Livraisons terminées</Text>
                  <Text style={styles.settingDescription}>
                    Notification quand vous marquez une livraison comme terminée
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.payment_notifications === 1}
                onValueChange={(value) =>
                  updateSetting('payment_notifications', value ? 1 : 0)
                }
                trackColor={{ false: "#374151", true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        </View>

        {/* Information */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color={COLORS.muted} />
          <Text style={styles.infoText}>
            Les notifications en arrière-plan nécessitent que l'application reste installée. 
            Les rappels fonctionnent même quand l'app est fermée.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  loadingText: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingTexts: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
  },
});