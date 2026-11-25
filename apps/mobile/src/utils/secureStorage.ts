import { UserProfile } from '../store/authStore';

export interface StoredSession {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  user: UserProfile;
}

const SERVICE_NAME = 'ecocommute_employee_auth_session';

// Safe dynamic accessor for native Keychain module
function getKeychain(): any {
  try {
    return require('react-native-keychain');
  } catch {
    return null;
  }
}

// Memory fallback used when native Keychain is unavailable (e.g., node / jest environments)
let memoryStore: StoredSession | null = null;

function isNativeKeychainAvailable(): boolean {
  const kc = getKeychain();
  return (
    kc != null &&
    typeof kc.setGenericPassword === 'function' &&
    typeof kc.getGenericPassword === 'function' &&
    typeof kc.resetGenericPassword === 'function'
  );
}

/**
 * Securely persists the employee authentication session (tokens + user profile)
 * using device-encrypted hardware keystore (Android Keystore / iOS Keychain).
 */
export async function saveSession(
  tokens: { accessToken: string; refreshToken: string },
  user: UserProfile
): Promise<void> {
  const sessionData: StoredSession = { tokens, user };

  if (!isNativeKeychainAvailable()) {
    memoryStore = sessionData;
    return;
  }

  const kc = getKeychain();
  try {
    const serialized = JSON.stringify(sessionData);
    await kc.setGenericPassword('ecocommute_auth', serialized, {
      service: SERVICE_NAME,
      accessible: kc.ACCESSIBLE?.WHEN_UNLOCKED || 'AccessibleWhenUnlocked',
    });
  } catch (err) {
    // Fallback to memory if keystore hardware error occurs
    memoryStore = sessionData;
  }
}

/**
 * Retrieves the stored session from device-encrypted keystore.
 */
export async function getSession(): Promise<StoredSession | null> {
  if (!isNativeKeychainAvailable()) {
    return memoryStore;
  }

  const kc = getKeychain();
  try {
    const credentials = await kc.getGenericPassword({
      service: SERVICE_NAME,
    });

    if (!credentials || !credentials.password) {
      return memoryStore;
    }

    const session: StoredSession = JSON.parse(credentials.password);
    return session;
  } catch {
    return memoryStore;
  }
}

/**
 * Updates tokens in secure storage (e.g., during automatic refresh-token rotation)
 * while preserving the authenticated user profile.
 */
export async function updateStoredTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  const current = await getSession();
  if (current && current.user) {
    await saveSession(tokens, current.user);
  } else if (memoryStore) {
    memoryStore.tokens = tokens;
  }
}

/**
 * Completely purges credentials from secure hardware storage and memory on logout.
 */
export async function clearSession(): Promise<void> {
  memoryStore = null;

  if (!isNativeKeychainAvailable()) {
    return;
  }

  const kc = getKeychain();
  try {
    await kc.resetGenericPassword({
      service: SERVICE_NAME,
    });
  } catch {
    // Purged memoryStore regardless
  }
}
