import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import CustomModal from '../components/CustomModal';

type ModalButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
};

type ModalConfig = {
  title: string;
  message: string;
  buttons?: ModalButton[];
  type?: 'alert' | 'confirm' | 'success' | 'error';
  onClose?: () => void;
};

type ModalContextType = {
  showModal: (config: ModalConfig) => void;
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'alert') => void;
  showConfirm: (
    title: string, 
    message: string, 
    onConfirm: () => void | Promise<void>,
    confirmText?: string,
    cancelText?: string
  ) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  hideModal: () => void;
  isVisible: boolean;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [visible, setVisible] = useState(false);

  // Déclarer hideModal AVANT showConfirm
  const hideModal = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      modalConfig?.onClose?.();
      setModalConfig(null);
    }, 300);
  }, [modalConfig]);

  const showModal = useCallback((config: ModalConfig) => {
    setModalConfig(config);
    setVisible(true);
  }, []);

  const showAlert = useCallback((
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'alert' = 'alert'
  ) => {
    showModal({ title, message, type });
  }, [showModal]);

  const showConfirm = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void | Promise<void>,
    confirmText = 'Confirmer',
    cancelText = 'Annuler'
  ) => {
    showModal({
      title,
      message,
      type: 'confirm',
      buttons: [
        {
          text: cancelText,
          style: 'cancel',
          onPress: hideModal, // Maintenant hideModal est déclaré avant
        },
        {
          text: confirmText,
          style: 'default',
          onPress: async () => {
            await onConfirm();
            hideModal();
          },
        },
      ],
    });
  }, [showModal, hideModal]);

  const showSuccess = useCallback((title: string, message: string) => {
    showAlert(title, message, 'success');
  }, [showAlert]);

  const showError = useCallback((title: string, message: string) => {
    showAlert(title, message, 'error');
  }, [showAlert]);

  const handleButtonPress = useCallback(async (button: ModalButton) => {
    if (button.onPress) {
      await button.onPress();
    }
    hideModal();
  }, [hideModal]);

  const contextValue: ModalContextType = {
    showModal,
    showAlert,
    showConfirm,
    showSuccess,
    showError,
    hideModal,
    isVisible: visible,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      
      {modalConfig && (
        <CustomModal
          visible={visible}
          title={modalConfig.title}
          message={modalConfig.message}
          buttons={modalConfig.buttons?.map(button => ({
            ...button,
            onPress: () => handleButtonPress(button),
          }))}
          type={modalConfig.type}
          onClose={hideModal}
        />
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
}