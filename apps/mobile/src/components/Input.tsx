import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  Pressable,
  ViewStyle,
} from 'react-native';
import { Colors, Radius, Spacing } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ label, error, containerStyle, secureTextEntry, style, ...textInputProps }, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
    const hasVisibilityToggle = Boolean(secureTextEntry);

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={[styles.inputContainer, error ? styles.inputError : null]}>
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={Boolean(secureTextEntry && !isPasswordVisible)}
            {...textInputProps}
          />
          {hasVisibilityToggle && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
              accessibilityState={{ selected: isPasswordVisible }}
              onPress={() => setIsPasswordVisible((visible) => !visible)}
              style={styles.visibilityButton}
              hitSlop={4}
            >
              <View style={styles.eyeIcon}>
                <View style={styles.eyeOutline}>
                  <View style={styles.eyePupil} />
                </View>
                {!isPasswordVisible && <View style={styles.eyeSlash} />}
              </View>
            </Pressable>
          )}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  visibilityButton: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeOutline: {
    width: 19,
    height: 13,
    borderWidth: 1.7,
    borderColor: Colors.textSecondary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },
  eyeSlash: {
    position: 'absolute',
    width: 25,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.textSecondary,
    transform: [{ rotate: '-38deg' }],
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});
