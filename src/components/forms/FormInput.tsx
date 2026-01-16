// src/components/forms/FormInput.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller, Control, FieldError } from 'react-hook-form';

interface FormInputProps extends TextInputProps {
  control: Control<any>;
  name: string;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  error?: FieldError;
  containerStyle?: any;
}

export const FormInput: React.FC<FormInputProps> = ({
  control,
  name,
  label,
  icon,
  secureTextEntry = false,
  showPasswordToggle = false,
  error,
  containerStyle,
  ...textInputProps
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <View style={[styles.container, containerStyle]}>
          <Text style={[styles.label, error && styles.labelError]}>
            {label}
          </Text>
          
          <View style={[
            styles.inputContainer,
            error && styles.inputContainerError
          ]}>
            {icon && (
              <MaterialIcons
                name={icon}
                size={20}
                color={error ? '#ef4444' : '#92c992'}
                style={styles.icon}
              />
            )}
            
            <TextInput
              style={[
                styles.input,
                icon && styles.inputWithIcon,
                showPasswordToggle && styles.inputWithToggle,
                error && styles.inputError
              ]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              secureTextEntry={secureTextEntry && !isPasswordVisible}
              placeholderTextColor={error ? '#ef4444' : '#94A3B8'}
              {...textInputProps}
            />
            
            {showPasswordToggle && (
              <TouchableOpacity
                style={styles.visibilityToggle}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              >
                <MaterialIcons
                  name={isPasswordVisible ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={error ? '#ef4444' : '#92c992'}
                />
              </TouchableOpacity>
            )}
          </View>
          
          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={14} color="#ef4444" />
              <Text style={styles.errorText}>{error.message}</Text>
            </View>
          )}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 6,
    marginLeft: 4,
  },
  labelError: {
    color: '#ef4444',
  },
  inputContainer: {
    position: 'relative',
  },
  inputContainerError: {
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
  },
  icon: {
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 1,
  },
  input: {
    backgroundColor: '#1a2a1a',
    borderWidth: 1,
    borderColor: '#2d3d2d',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputWithIcon: {
    paddingLeft: 44,
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  visibilityToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
  },
});