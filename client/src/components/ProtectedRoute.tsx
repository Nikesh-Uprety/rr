import { useEffect } from "react";
import { useLocation } from "wouter";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { canAccessAdminPage, canAccessAdminPanel, type AdminPageKey } from "@shared/auth-policy";
import { getAdminRedirectPath } from "@/lib/adminAccess";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredAdminPage?: AdminPageKey;
}

export function ProtectedRoute({ children, requireAdmin, requiredAdminPage }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const [location, setLocation] = useLocation();
  const needsAdminAccess = requireAdmin || !!requiredAdminPage;
  const isAllowedAdminRoute = user
    ? requiredAdminPage
      ? canAccessAdminPage(user.role, requiredAdminPage, user.adminPageAccess)
      : canAccessAdminPanel(user.role)
    : false;

  // Finish the pre-loader when authentication check is complete
  useEffect(() => {
    if (!isLoading) {
      // Call finishLoading to hide the pre-loader after auth is verified
      if (typeof window !== 'undefined' && (window as any).finishLoading) {
        (window as any).finishLoading();
      }
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      if (location !== "/admin/login") {
        setLocation("/admin/login");
      }
      return;
    }
    if (needsAdminAccess && user && !isAllowedAdminRoute) {
      const redirectPath = getAdminRedirectPath(user.role, requiredAdminPage, user.adminPageAccess);
      if (location !== redirectPath) {
        setLocation(redirectPath);
      }
    }
  }, [isLoading, isAuthenticated, needsAdminAccess, user, location, setLocation, isAllowedAdminRoute, requiredAdminPage]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-2 border-muted border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (needsAdminAccess && user && !isAllowedAdminRoute) {
    return null;
  }

  return <>{children}</>;
}
