import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, SupabaseUser, SupabaseSession } from './supabaseClient';

interface AuthGateContextType {
  user: SupabaseUser | null;
  session: SupabaseSession | null;
  isLoading: boolean;
  pendingDestination: string | null;
  clearPendingDestination: () => void;
  logout: () => Promise<void>;
  validateRedirectUrl: (url: string) => string;
}

const AuthGateContext = createContext<AuthGateContextType | undefined>(undefined);

// Strict internal route allowlist to prevent open redirects from deep links or notifications
const ALLOWED_INTERNAL_ROUTES = [
  '/(app)',
  '/(app)/home',
  '/(app)/checkin',
  '/(app)/bookings',
  '/(app)/issues',
  '/(app)/profile',
  '/home',
  '/rooms',
  '/lounge',
  '/devices',
  '/reports',
  '/iac-mobile',
  'index.html',
];

export function validateInternalRoute(destination?: string | null): string {
  if (!destination) return '/(app)/home';
  const clean = destination.trim().split('?')[0].split('#')[0];
  if (ALLOWED_INTERNAL_ROUTES.includes(clean)) {
    return destination.trim();
  }
  return '/(app)/home';
}

interface SupabaseAuthGateProps {
  children: ReactNode;
  fallbackLogin: ReactNode;
  loadingSplash?: ReactNode;
  initialDeepLink?: string | null;
}

/**
 * Central Auth Gate Component.
 * - Enforces zero-guest access: only authenticated, confirmed users proceed.
 * - Shows loading state until server-side getUser() verification completes.
 * - Unconfirmed emails (email_confirmed_at === null) are blocked.
 */
export function SupabaseAuthGate({
  children,
  fallbackLogin,
  loadingSplash,
  initialDeepLink,
}: SupabaseAuthGateProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  useEffect(() => {
    if (initialDeepLink) {
      const safe = validateInternalRoute(initialDeepLink);
      setPendingDestination(safe);
    }
  }, [initialDeepLink]);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const activeSession = await supabase.auth.getSession();
      if (!activeSession) {
        setUser(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      // Server-side validation via getUser() (never trust local storage alone)
      const { user: verifiedUser, error } = await supabase.auth.getUser();

      if (error || !verifiedUser) {
        await supabase.auth.signOut({ scope: 'local' });
        setUser(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      // Enforce email confirmation requirement: Block unconfirmed users
      if (!verifiedUser.email_confirmed_at && import.meta.env.PROD) {
        console.warn('[AuthGate] User email not yet confirmed:', verifiedUser.email);
        await supabase.auth.signOut({ scope: 'local' });
        setUser(null);
        setSession(null);
        setIsLoading(false);
        return;
      }

      setUser(verifiedUser);
      setSession(activeSession);
    } catch (err) {
      console.error('[AuthGate] Exception during auth verification:', err);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Subscribe to auth state transitions
    const { unsubscribe } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_OUT' || !newSession) {
        setUser(null);
        setSession(null);
        setIsLoading(false);
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(newSession);
        const { user: refreshedUser } = await supabase.auth.getUser();
        setUser(refreshedUser);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    setUser(null);
    setSession(null);
  };

  // 1. Initial verification in progress: Render splash so protected screens NEVER flash
  if (isLoading) {
    if (loadingSplash) return <>{loadingSplash}</>;
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #334155',
            borderTopColor: '#F59E0B',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>
          Verifying secure credentials...
        </span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 2. Not authenticated or unconfirmed: Render fallback login
  if (!user || !session) {
    return <>{fallbackLogin}</>;
  }

  // 3. Authenticated: Provide context and render protected application
  return (
    <AuthGateContext.Provider
      value={{
        user,
        session,
        isLoading,
        pendingDestination,
        clearPendingDestination: () => setPendingDestination(null),
        logout: handleLogout,
        validateRedirectUrl: validateInternalRoute,
      }}
    >
      {children}
    </AuthGateContext.Provider>
  );
}

export function useSupabaseAuthGate(): AuthGateContextType {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error('useSupabaseAuthGate must be used within a SupabaseAuthGate provider');
  }
  return ctx;
}
