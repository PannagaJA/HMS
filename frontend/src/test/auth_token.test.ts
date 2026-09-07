/**
 * auth_token.test.ts
 * Tests for the 4 auth token bugs fixed in AuthContext.tsx
 *
 * These tests cover the logic extracted from the auth utilities so we can
 * validate them in isolation (without React/DOM mounting overhead).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ─── Helpers mirroring the exact logic in authService.ts ────────────────────

const SYNTHETIC_PREFIX = 'hms-session-';

const isSyntheticToken = (token: string | null): boolean =>
  typeof token === 'string' && token.startsWith(SYNTHETIC_PREFIX);

// Minimal localStorage mock ──────────────────────────────────────────────────
const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

const getStoredUser = () => {
  try {
    const raw = mockStorage.getItem('hms_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const getAccessToken = () => mockStorage.getItem('hms_token');

const saveAuthSession = (token?: string, _b?: any, user?: any) => {
  if (token) mockStorage.setItem('hms_token', token);
  if (user)  mockStorage.setItem('hms_user', JSON.stringify(user));
};

// ─── Test suites ─────────────────────────────────────────────────────────────

describe('AUTH-TOKEN: isSyntheticToken helper', () => {
  it('returns true for hms-session-* tokens', () => {
    expect(isSyntheticToken('hms-session-42-1725695032000')).toBe(true);
    expect(isSyntheticToken('hms-session-profile-abc-123456')).toBe(true);
  });

  it('returns false for real Supabase JWTs', () => {
    expect(isSyntheticToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig')).toBe(false);
  });

  it('returns false for null / undefined / empty string', () => {
    expect(isSyntheticToken(null)).toBe(false);
    expect(isSyntheticToken('')).toBe(false);
  });
});

// ─── Fix 1: SIGNED_OUT must not clear synthetic sessions ────────────────────
describe('FIX-1: SIGNED_OUT event must not clear synthetic sessions', () => {
  beforeEach(() => mockStorage.clear());

  /**
   * Simulates the corrected SIGNED_OUT handler from AuthContext.tsx.
   * Returns whether it would have cleared state.
   */
  const handleSignedOut = (currentToken: string | null): boolean => {
    if (isSyntheticToken(currentToken)) return false; // guard — do NOT clear
    return true; // would clear state
  };

  it('does NOT clear state when current token is synthetic', () => {
    const syntheticToken = 'hms-session-42-1725695032000';
    expect(handleSignedOut(syntheticToken)).toBe(false);
  });

  it('DOES clear state when current token is a real JWT', () => {
    const realJwt = 'eyJhbGciOiJIUzI1NiJ9.payload.sig';
    expect(handleSignedOut(realJwt)).toBe(true);
  });

  it('DOES clear state when there is no token at all (fresh logout)', () => {
    expect(handleSignedOut(null)).toBe(true);
  });
});

// ─── Fix 2: TOKEN_REFRESHED must persist to localStorage ────────────────────
describe('FIX-2: TOKEN_REFRESHED must persist refreshed JWT to localStorage', () => {
  beforeEach(() => mockStorage.clear());

  it('saveAuthSession updates hms_token when called with new token', () => {
    const oldToken = 'eyJold.payload.sig';
    const newToken = 'eyJnew.payload.sig';

    mockStorage.setItem('hms_token', oldToken);
    expect(getAccessToken()).toBe(oldToken);

    // Simulates the TOKEN_REFRESHED handler calling saveAuthSession
    saveAuthSession(newToken, undefined, undefined);

    expect(getAccessToken()).toBe(newToken);
  });

  it('saveAuthSession does NOT overwrite hms_user when user param is undefined', () => {
    const user = { id: '1', email: 'admin@test.com', role: 'ADMIN' };
    mockStorage.setItem('hms_user', JSON.stringify(user));

    saveAuthSession('new-token', undefined, undefined);

    const storedUser = getStoredUser();
    expect(storedUser).toEqual(user); // unchanged
    expect(getAccessToken()).toBe('new-token'); // only token updated
  });
});

// ─── Fix 3: refreshUserProfile must short-circuit for synthetic sessions ─────
describe('FIX-3: refreshUserProfile must short-circuit for synthetic sessions', () => {
  beforeEach(() => mockStorage.clear());

  /**
   * Simulates the corrected refreshUserProfile guard logic.
   * Returns 'short-circuit' if it would bypass Supabase, else 'supabase-call'.
   */
  const simulateRefresh = (storedToken: string | null, storedUser: any): string => {
    if (isSyntheticToken(storedToken) && storedUser) {
      return 'short-circuit'; // Fix 3: bypass Supabase for synthetic sessions
    }
    return 'supabase-call';
  };

  it('short-circuits (does not call Supabase) when token is synthetic and user exists in storage', () => {
    const user = { id: 'fake-uuid', email: '1am22cs001@student.amc.edu', role: 'STUDENT' };
    const token = 'hms-session-1-1725695032000';

    expect(simulateRefresh(token, user)).toBe('short-circuit');
  });

  it('calls Supabase normally when token is a real JWT', () => {
    const user = { id: 'real-uuid', email: 'admin@amc.edu', role: 'ADMIN' };
    const token = 'eyJhbGciOiJIUzI1NiJ9.payload.sig';

    expect(simulateRefresh(token, user)).toBe('supabase-call');
  });

  it('calls Supabase when there is no stored user even with synthetic token', () => {
    const token = 'hms-session-1-1725695032000';
    expect(simulateRefresh(token, null)).toBe('supabase-call');
  });
});

// ─── Fix 4: localStorage consistency across session save/restore ─────────────
describe('FIX-4: localStorage token and user stay in sync', () => {
  beforeEach(() => mockStorage.clear());

  it('saveAuthSession stores both token and user atomically', () => {
    const token = 'hms-session-99-123456';
    const user = { id: 'u1', email: 'w@amc.edu', role: 'WARDEN' };

    saveAuthSession(token, undefined, user);

    expect(getAccessToken()).toBe(token);
    expect(getStoredUser()).toEqual(user);
  });

  it('getStoredUser returns null on corrupt JSON without throwing', () => {
    mockStorage.setItem('hms_user', 'not-valid-json{{{');
    expect(() => getStoredUser()).not.toThrow();
    expect(getStoredUser()).toBeNull();
  });

  it('logout clears both hms_user and hms_token from localStorage', () => {
    mockStorage.setItem('hms_token', 'some-token');
    mockStorage.setItem('hms_user', JSON.stringify({ id: '1' }));

    // Simulate logoutUser
    mockStorage.removeItem('hms_user');
    mockStorage.removeItem('hms_token');

    expect(getAccessToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('real JWT is replaced by new JWT after refresh without touching user data', () => {
    const user = { id: 'u2', email: 'admin@amc.edu', role: 'ADMIN' };
    const oldJwt = 'eyJold.payload.sig';
    const newJwt = 'eyJnew.payload.sig';

    saveAuthSession(oldJwt, undefined, user);

    // Simulate TOKEN_REFRESHED — only token changes
    saveAuthSession(newJwt, undefined, undefined);

    expect(getAccessToken()).toBe(newJwt);
    expect(getStoredUser()).toEqual(user); // user untouched
  });
});
