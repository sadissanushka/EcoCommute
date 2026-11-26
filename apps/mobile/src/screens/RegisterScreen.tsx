import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Button, Input, ErrorBanner } from '../components';
import { Colors, Spacing, Typography } from '../theme';
import { apiClient, parseApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RegisterScreen = ({ navigation }: any) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fullNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const login = useAuthStore((state) => state.login);

  const handleRegister = async () => {
    if (isLoading) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Client-Side Field Validations
    if (!trimmedName || !trimmedEmail || !password) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (trimmedName.length < 2) {
      setErrorMessage('Full name must be at least 2 characters.');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid corporate email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 2. Real Backend Registration Call (Public registration locked to role: employee)
      const response = await apiClient.post('/auth/register', {
        fullName: trimmedName,
        email: trimmedEmail,
        password,
        role: 'employee',
      });

      const { tokens, user } = response.data;
      if (!tokens || !user) {
        throw new Error('Invalid response structure received from authentication server.');
      }

      // 3. Establish Authenticated Session & Persist to Secure Keystore
      await login(tokens, {
        id: user.id,
        email: user.email,
        fullName: user.fullName || user.full_name,
        role: user.role,
        companyId: user.companyId ?? user.company_id ?? null,
        companyName: user.companyName ?? user.company_name ?? null,
        corporateVerified: user.corporateVerified ?? user.corporate_verified ?? false,
      });
    } catch (err: any) {
      const parsed = parseApiError(err);
      if (parsed.code === 'USER_EXISTS') {
        setErrorMessage('An account with this email is already registered. Please sign in instead.');
      } else if (parsed.code === 'INVALID_ROLE' || parsed.code === 'FORBIDDEN_ROLE') {
        setErrorMessage('Public registration is restricted to employee accounts only.');
      } else if (parsed.code === 'VALIDATION_ERROR') {
        const fieldDetails = parsed.details
          ? Object.values(parsed.details).flat().join(', ')
          : null;
        setErrorMessage(fieldDetails || parsed.message || 'Invalid registration details.');
      } else {
        setErrorMessage(parsed.message || 'Registration failed. Please check your network and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <View style={styles.header}>
            <Text style={styles.brand}>EcoCommute</Text>
            <Text style={Typography.titleLarge}>Join EcoCommute</Text>
            <Text style={Typography.subtitle}>Corporate Employee Shuttle & Carpool</Text>
          </View>

          <ErrorBanner message={errorMessage} />

          <Input
            label="Full Name"
            placeholder="e.g. Kasun Perera"
            ref={fullNameInputRef}
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (errorMessage) setErrorMessage(null);
            }}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailInputRef.current?.focus()}
            editable={!isLoading}
          />

          <Input
            label="Corporate Email"
            placeholder="kasun@syscolabs.com"
            ref={emailInputRef}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errorMessage) setErrorMessage(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            editable={!isLoading}
          />

          <Input
            label="Create Password (min. 8 characters)"
            placeholder="••••••••"
            ref={passwordInputRef}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleRegister();
            }}
            editable={!isLoading}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            isLoading={isLoading}
            disabled={isLoading}
            style={styles.submitBtn}
          />

          <View style={styles.footer}>
            <Text style={Typography.caption}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={isLoading}
            >
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  brand: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  submitBtn: {
    marginTop: Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
