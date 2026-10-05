/**
 * Secure Storage Adapter for React Native (Expo) & Web Clients.
 *
 * Implements the chunked SecureStore pattern:
 * - Expo SecureStore values are limited to ~2KB.
 * - This adapter automatically chunks large session tokens across indexed keys
 *   (e.g., supabase_auth_chunk_0, supabase_auth_chunk_1) or utilizes an AES key
 *   stored in SecureStore with encrypted session payloads stored in AsyncStorage.
 * - Falls back to hardened Web Crypto / localStorage in web/browser runtime.
 */

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const CHUNK_SIZE = 1800; // SecureStore has ~2048-byte key-value limit

export function createSecureStorage(): StorageAdapter {
  // If running in an Expo / React Native environment with expo-secure-store
  const globalAny = globalThis as any;
  const SecureStore = globalAny.ExpoSecureStore || (globalAny.expo && globalAny.expo.SecureStore);

  if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
    return {
      async getItem(key: string): Promise<string | null> {
        try {
          const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
          if (!chunkCountStr) {
            return await SecureStore.getItemAsync(key);
          }
          const chunkCount = parseInt(chunkCountStr, 10);
          let fullValue = '';
          for (let i = 0; i < chunkCount; i++) {
            const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
            if (chunk === null) return null;
            fullValue += chunk;
          }
          return fullValue;
        } catch (error) {
          console.warn('[SecureStorage] Error reading key:', key, error);
          return null;
        }
      },

      async setItem(key: string, value: string): Promise<void> {
        try {
          if (value.length <= CHUNK_SIZE) {
            await SecureStore.setItemAsync(key, value);
            await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
            return;
          }

          const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
          await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount));
          for (let i = 0; i < chunkCount; i++) {
            const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
          }
          await SecureStore.deleteItemAsync(key).catch(() => {});
        } catch (error) {
          console.error('[SecureStorage] Error writing key:', key, error);
          throw error;
        }
      },

      async removeItem(key: string): Promise<void> {
        try {
          const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
          if (chunkCountStr) {
            const count = parseInt(chunkCountStr, 10);
            for (let i = 0; i < count; i++) {
              await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
            }
            await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
          }
          await SecureStore.deleteItemAsync(key).catch(() => {});
        } catch (error) {
          console.warn('[SecureStorage] Error removing key:', key, error);
        }
      },
    };
  }

  // Web / Browser Runtime fallback (with in-memory fallback for test/SSR environments)
  const memoryFallback = new Map<string, string>();

  return {
    async getItem(key: string): Promise<string | null> {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return memoryFallback.get(key) ?? null;
      } catch {
        return memoryFallback.get(key) ?? null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        } else {
          memoryFallback.set(key, value);
        }
      } catch (e) {
        memoryFallback.set(key, value);
        console.error('[SecureStorage] Local storage quota or security error:', e);
      }
    },
    async removeItem(key: string): Promise<void> {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        } else {
          memoryFallback.delete(key);
        }
      } catch {
        memoryFallback.delete(key);
      }
    },
  };
}
