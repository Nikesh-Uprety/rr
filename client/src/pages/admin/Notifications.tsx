import { useNotifications } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { Bell, Package, ShoppingBag, Check, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const { notifications, unreadCount, markAllRead, markRead, isLoading } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ShoppingBag className="h-5 w-5 text-blue-500" />;
      case "product":
        return <Package className="h-5 w-5 text-emerald-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Stay updated with your store's recent activity.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead()}
            className="flex items-center gap-2 border-[#D6D6CC] text-[#2C3E2D] dark:text-foreground hover:bg-[#2C3E2D]/5"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-[#2C3E2D]/5 dark:bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Bell className="h-8 w-8 text-[#2C3E2D] dark:text-primary opacity-20" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                You don't have any notifications at the moment.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5E0] dark:divide-border">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "group relative flex items-start gap-4 p-5 transition-all hover:bg-[#2C3E2D]/[0.02] dark:hover:bg-primary/[0.02]",
                  !notif.isRead && "bg-[#2C3E2D]/[0.03] dark:bg-primary/[0.03]"
                )}
              >
                {!notif.isRead && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2C3E2D] dark:bg-primary" />
                )}
                
                <div className="mt-1 shrink-0 bg-white dark:bg-muted p-2 rounded-xl shadow-sm border border-[#E5E5E0] dark:border-border">
                  {getIcon(notif.type)}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <p className={cn(
                      "text-sm font-medium leading-none",
                      !notif.isRead ? "text-[#2C3E2D] dark:text-foreground" : "text-muted-foreground"
                    )}>
                      {notif.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                      {format(new Date(notif.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1 group-hover:line-clamp-none transition-all">
                    {notif.message}
                  </p>
                  
                  {notif.link && (
                    <div className="pt-2 flex items-center gap-4">
                      <Link
                        href={notif.link}
                        onClick={() => markRead(notif.id)}
                        className="text-xs font-bold uppercase tracking-widest text-[#2C3E2D] dark:text-primary flex items-center gap-1 hover:opacity-70 transition-opacity"
                      >
                        Action <ChevronRight className="h-3 w-3" />
                      </Link>
                      {!notif.isRead && (
                        <button
                          onClick={() => markRead(notif.id)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4">
        <p>Notifications are automatically deleted after 30 days.</p>
      </div>
    </div>
  );
}
