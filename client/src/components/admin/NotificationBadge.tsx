import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function NotificationBadge() {
  const { unreadCount, markAllRead } = useNotifications();

  return (
    <Link
      href="/admin/notifications"
      onClick={() => markAllRead()}
      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors relative"
      title="View Notifications"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-card scale-90">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
