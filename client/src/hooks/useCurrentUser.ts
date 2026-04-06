import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminPageKey } from "@shared/auth-policy";

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  adminPageAccess?: AdminPageKey[];
  profileImageUrl?: string | null;
  twoFactorEnabled?: boolean;
}

interface MeResponse {
  success: boolean;
  data?: CurrentUser;
  error?: string;
}

// Auth query key for consistent cache management
export const AUTH_QUERY_KEY = ["/api/auth/me"] as const;

export function useCurrentUser(options?: { enabled?: boolean }) {
  const { data, isLoading } = useQuery<MeResponse | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) return null;
        return (await res.json()) as MeResponse;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
    gcTime: 1000 * 60 * 60, // 1 hour - keep in cache even if unused
    refetchOnWindowFocus: false, // Avoid extra auth checks during normal storefront browsing
    refetchOnReconnect: true, // Refetch on network reconnect
    enabled: options?.enabled ?? true,
  });

  const user = data?.success ? data.data ?? null : null;
  const isAuthenticated = !!user;

  return { user, isLoading, isAuthenticated };
}

// Hook to invalidate auth cache (use after login/logout)
export function useAuthInvalidation() {
  const queryClient = useQueryClient();

  const invalidateAuth = () => {
    queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
  };

  const resetAuth = () => {
    queryClient.resetQueries({ queryKey: AUTH_QUERY_KEY });
  };

  return { invalidateAuth, resetAuth };
}

