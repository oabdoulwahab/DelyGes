import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { COLORS } from "../styles/colors";
import { commonStyles } from "../styles/common";

type ModalButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type CustomModalProps = {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: ModalButton[];
  onClose?: () => void;
  type?: "alert" | "confirm" | "success" | "error";
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CustomModal({
  visible,
  title,
  message,
  buttons = [],
  onClose,
  type = "alert",
}: CustomModalProps) {
  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <MaterialIcons name="check-circle" size={48} color={COLORS.success} />
        );
      case "error":
        return (
          <MaterialIcons name="error-outline" size={48} color={COLORS.danger} />
        );
      case "confirm":
        return (
          <MaterialIcons name="help-outline" size={48} color={COLORS.warning} />
        );
      default:
        return <MaterialIcons name="info" size={48} color={COLORS.primary} />;
    }
  };

  // Fonction pour obtenir la couleur du titre selon le type
  const getTitleColor = () => {
    switch (type) {
      case "success":
        return COLORS.success;
      case "error":
        return COLORS.danger;
      case "confirm":
        return COLORS.warning;
      case "alert":
      default:
        return COLORS.primary; // ou COLORS.white
    }
  };

  const getDefaultButtons = (): ModalButton[] => {
    if (buttons.length > 0) return buttons;

    return [
      {
        text: "OK",
        style: "default",
        onPress: onClose,
      },
    ];
  };

  const modalButtons = getDefaultButtons();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <BlurView
              intensity={Platform.OS === "ios" ? 100 : 90}
              
              style={styles.modalContainer}
            >
              <View style={styles.modalContent}>
                {/* Icon */}
                <View style={styles.iconContainer}>{getIcon()}</View>

                {/* Title */}
                {title && (
                  <Text style={[styles.modalTitle, { color: getTitleColor() }]}>
                    {title}
                  </Text>
                )}

                {/* Message */}
                {message && <Text style={styles.modalMessage}>{message}</Text>}

                {/* Buttons */}
                <View
                  style={[
                    styles.buttonsContainer,
                    modalButtons.length > 2 && styles.buttonsColumn,
                  ]}
                >
                  {modalButtons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        button.style === "destructive" &&
                          styles.destructiveButton,
                        button.style === "cancel" && styles.cancelButton,
                        modalButtons.length > 2 && styles.buttonColumn,
                        modalButtons.length === 2 && styles.buttonTwoColumn,
                      ]}
                      onPress={() => {
                        button.onPress?.();
                        // Fermer la modal après action
                        if (onClose) {
                          setTimeout(onClose, 100);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          button.style === "destructive" &&
                            styles.destructiveButtonText,
                          button.style === "cancel" && styles.cancelButtonText,
                        ]}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </BlurView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
  },
  modalContainer: {
    width: Math.min(SCREEN_WIDTH - 40, 400),
    borderRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        backgroundColor: "rgba(30, 30, 30, 0.9)",
      },
      android: {
        backgroundColor: COLORS.card,
      },
    }),
  },
  modalContent: {
    padding: 24,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    // color: COLORS.text, // <-- SUPPRIMEZ CETTE LIGNE
    textAlign: "center",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonsContainer: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  buttonsColumn: {
    flexDirection: "column",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonColumn: {
    width: "100%",
  },
  buttonTwoColumn: {
    flex: 1,
  },
  destructiveButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  cancelButton: {
    backgroundColor: "rgba(107, 114, 128, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.muted,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  destructiveButtonText: {
    color: COLORS.danger,
  },
  cancelButtonText: {
    color: COLORS.muted,
  },
});
