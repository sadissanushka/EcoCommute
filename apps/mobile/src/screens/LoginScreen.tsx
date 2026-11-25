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

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const login = useAuthStore((state) => state.login);

  const handleLogin = async () => {
    if (isLoading) return;

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Client-Side Validations
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both corporate email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 2. Real Backend Login Call
      const response = await apiClient.post('/auth/login', {
        email: trimmedEmail,
        password,
      });

      const { tokens, user } = response.data;
      if (!tokens || !user) {
        throw new Error('Invalid authentication response received from server.');
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

      if (parsed.code === 'INVALID_CREDENTIALS') {
        const remaining = parsed.details?.attemptsRemaining;
        if (typeof remaining === 'number' && remaining > 0 && remaining <= 3) {
          setErrorMessage(`Invalid email or password. ${remaining} attempt(s) remaining before account lockout.`);
        } else {
          setErrorMessage('Invalid corporate email or password.');
        }
      } else if (parsed.status === 429 || parsed.code === 'ACCOUNT_LOCKED') {
        setErrorMessage('Account is temporarily locked due to multiple failed login attempts. Please try again later.');
      } else if (parsed.code === 'NETWORK_ERROR') {
        setErrorMessage('Unable to connect to the authentication server. Please check your network connection.');
      } else {
        setErrorMessage(parsed.message || 'Authentication failed. Please verify credentials.');
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
            <Text style={Typography.titleLarge}>Welcome Back</Text>
            <Text style={Typography.subtitle}>Sign in with your corporate employee account</Text>
          </View>

          <ErrorBanner message={errorMessage} />

          <Input
            label="Corporate Email"
            placeholder="user@syscolabs.com"
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
            label="Password"
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
              void handleLogin();
            }}
            editable={!isLoading}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            isLoading={isLoading}
            disabled={isLoading}
            style={styles.submitBtn}
          />

          <View style={styles.footer}>
            <Text style={Typography.caption}>New employee? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
            >
              <Text style={styles.linkText}>Create Account</Text>
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
