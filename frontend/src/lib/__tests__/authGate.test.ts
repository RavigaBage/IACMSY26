/**
 * Unit Tests for Hardened Authentication Gate & Session Handling
 */

import { validateInternalRoute } from '../supabaseAuthGate';
import { createSecureStorage } from '../secureStorageAdapter';

type TestFn = () => void | Promise<void>;
const describe = (name: string, fn: () => void) => {
  console.log(`[TEST SUITE] ${name}`);
  fn();
};
const it = async (name: string, fn: TestFn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`, err);
    throw err;
  }
};
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
    }
  },
  toBeNull: () => {
    if (actual !== null) {
      throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
    }
  },
});

describe('Auth Security Audit & Hardening Tests', () => {
  describe('Internal Route Allowlist Validation (Anti-Open-Redirect)', () => {
    it('allows valid internal application routes', () => {
      expect(validateInternalRoute('/(app)/home')).toBe('/(app)/home');
      expect(validateInternalRoute('/(app)/checkin')).toBe('/(app)/checkin');
      expect(validateInternalRoute('/rooms')).toBe('/rooms');
      expect(validateInternalRoute('index.html')).toBe('index.html');
    });

    it('blocks external URLs and protocol schemes', () => {
      expect(validateInternalRoute('https://malicious-phishing.com')).toBe('/(app)/home');
      expect(validateInternalRoute('//attacker.com/evil')).toBe('/(app)/home');
      expect(validateInternalRoute('javascript:alert(1)')).toBe('/(app)/home');
    });

    it('blocks arbitrary open paths not in allowlist', () => {
      expect(validateInternalRoute('/admin/secret/leak')).toBe('/(app)/home');
      expect(validateInternalRoute('../../../etc/passwd')).toBe('/(app)/home');
    });

    it('defaults to /(app)/home when destination is null or empty', () => {
      expect(validateInternalRoute(null)).toBe('/(app)/home');
      expect(validateInternalRoute('')).toBe('/(app)/home');
    });
  });

  describe('Secure Storage Chunking Pattern', () => {
    it('stores and retrieves short values intact', async () => {
      const storage = createSecureStorage();
      await storage.setItem('test_token', 'short_jwt_token_123');
      const val = await storage.getItem('test_token');
      expect(val).toBe('short_jwt_token_123');
      await storage.removeItem('test_token');
      const cleared = await storage.getItem('test_token');
      expect(cleared).toBeNull();
    });

    it('stores and retrieves large payload chunks safely', async () => {
      const storage = createSecureStorage();
      const largePayload = 'A'.repeat(5000); // Exceeds 2KB SecureStore ceiling
      await storage.setItem('large_session', largePayload);
      const retrieved = await storage.getItem('large_session');
      expect(retrieved).toBe(largePayload);
      await storage.removeItem('large_session');
      expect(await storage.getItem('large_session')).toBeNull();
    });
  });

  describe('Single-flight Refresh Mutex Logic', () => {
    it('deduplicates concurrent refresh calls into one request', async () => {
      let callCount = 0;
      const mockRefresh = async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 50));
        return { access_token: 'new_token_777' };
      };

      let pending: Promise<any> | null = null;
      const getRefreshedToken = () => {
        if (!pending) {
          pending = mockRefresh().finally(() => {
            pending = null;
          });
        }
        return pending;
      };

      // 4 concurrent 401 triggers
      const results = await Promise.all([
        getRefreshedToken(),
        getRefreshedToken(),
        getRefreshedToken(),
        getRefreshedToken(),
      ]);

      expect(callCount).toBe(1); // Only 1 network request fired
      expect(results[0].access_token).toBe('new_token_777');
      expect(results[3].access_token).toBe('new_token_777');
    });
  });
});
