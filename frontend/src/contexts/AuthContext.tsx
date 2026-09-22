import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, refreshAccessToken } from "../lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Re-checks auth on demand (e.g. after login). Returns true if authenticated. */
  checkAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Tries to confirm the current session:
   * 1. GET /auth/verify  -> uses the access token cookie
   * 2. If that 401s, POST /auth/refresh -> uses the refresh token cookie
   *    to mint a new access token, then verify is retried once.
   * 3. If both fail, the user is considered logged out.
   */
  const checkAuth = async (): Promise<boolean> => {
    try {
        const data = await api.get("api/auth/verify");
        setUser(data.user);
        return true;
    }
    catch {
        const refreshed = await refreshAccessToken();

        if (!refreshed) {
            setUser(null);
            return false;
        }

        const data = await api.get("api/auth/verify");
        setUser(data.user);
        return true;
    }
  };

  const logout = async () => {
    try {
    //   await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await checkAuth();
      if (mounted) setIsLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, checkAuth, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}