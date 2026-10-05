import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, refreshAccessToken, setAccessToken } from "../lib/api";

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
   * 1. GET /api/auth/verify -> uses stored token or cookie
   * 2. If that fails, POST /api/auth/refresh -> mints a new access token
   * 3. If refresh succeeds, re-verifies.
   * 4. If any step fails, clears tokens, sets user to null, and marks unauthenticated.
   */
  const checkAuth = async (): Promise<boolean> => {
    try {
      const data = await api.get("/api/auth/verify");
      if (data?.user) {
        setUser(data.user);
        return true;
      }
      throw new Error("Invalid verify payload");
    } catch {
      const refreshed = await refreshAccessToken();

      if (!refreshed) {
        setUser(null);
        setAccessToken(null);
        return false;
      }

      try {
        const data = await api.get("/api/auth/verify");
        if (data?.user) {
          setUser(data.user);
          return true;
        }
        setUser(null);
        setAccessToken(null);
        return false;
      } catch {
        setUser(null);
        setAccessToken(null);
        return false;
      }
    }
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout", {});
    } catch (e) {
      console.warn("Logout request failed:", e);
    } finally {
      setUser(null);
      setAccessToken(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
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