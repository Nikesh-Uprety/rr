import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AdminNotification } from "@shared/schema";

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery<{ data: AdminNotification[] }>({
    queryKey: ["/api/admin/notifications"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const notifications = response?.data || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/admin/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.setQueryData<{ data: AdminNotification[] }>(["/api/admin/notifications"], (old) => {
        if (!old) return { data: [] };
        return { data: old.data.map((n) => ({ ...n, isRead: 1 })) };
      });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/notifications/${id}/read`);
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ data: AdminNotification[] }>(["/api/admin/notifications"], (old) => {
        if (!old) return { data: [] };
        return { data: old.data.map((n) => (n.id === id ? { ...n, isRead: 1 } : n)) };
      });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAllRead: markAllReadMutation.mutate,
    markRead: markReadMutation.mutate,
  };
}
