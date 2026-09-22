import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface ProtectedRouteProps {
  children: JSX.Element;
}

/**
 * Wrap any route (or layout) that requires a logged-in admin.
 * - While the initial /auth/verify (+ optional refresh) check is running, shows a loader.
 * - If no valid session exists after that check, redirects to /login,
 *   preserving the attempted location so login can send them back afterward.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="login" state={{ from: location }} replace />;
  }

  return children;
}