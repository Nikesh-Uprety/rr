import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  User,
  BarChart,
  Package,
  CreditCard,
  ShoppingBag,
  Receipt,
  Tags,
  Settings,
  Bell,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { NotificationBadge } from "@/components/admin/NotificationBadge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ADMIN_NAV = [
  { href: "/admin", icon: LayoutGrid, label: "Dashboard" },
  { href: "/admin/products", icon: Package, label: "Products" },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/admin/bills", icon: Receipt, label: "Bills" },
  { href: "/admin/customers", icon: User, label: "Customers" },
  { href: "/admin/analytics", icon: BarChart, label: "Analytics" },
  { href: "/admin/pos", icon: CreditCard, label: "Point of Sale" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const res = await apiRequest("POST", "/api/auth/logout");
      if (res.ok) {
        window.location.href = "/admin/login";
      }
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || (user?.email?.[0] || "U").toUpperCase();

  const displayName = user?.name || user?.email || "User";
  const roleLabel =
    user?.role === "admin"
      ? "Admin"
      : user?.role === "staff"
        ? "Staff"
        : "Customer";

  return (
    <div className="min-h-screen bg-[#F5F5F3] dark:bg-background flex text-[#2C3E2D] dark:text-foreground font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-card border-r border-[#E5E5E0] dark:border-border hidden md:flex flex-col h-screen sticky top-0">
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#E5E5E0] dark:border-border">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/profile"
              className="w-8 h-8 rounded-full bg-[#2C3E2D] text-white flex items-center justify-center text-xs font-bold hover:scale-105 transition-transform"
              title="View Profile"
            >
              {initials}
            </Link>
            <Link
              href="/admin/profile"
              className="text-sm font-bold tracking-tight text-[#2C3E2D] dark:text-foreground hover:opacity-70 transition-opacity"
            >
              /profile
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBadge />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {ADMIN_NAV.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#2C3E2D]/5 dark:bg-primary/10 text-[#2C3E2D] dark:text-primary"
                    : "text-muted-foreground hover:bg-[#2C3E2D]/5 dark:hover:bg-muted hover:text-foreground",
                )}
                data-testid={`link-admin-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E5E5E0] dark:border-border">
          <Link
            href="/admin/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#2C3E2D] text-white flex items-center justify-center text-xs font-medium">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {roleLabel}
              </p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - only on mobile or if needed */}
        <header className="h-16 bg-white dark:bg-card border-b border-[#E5E5E0] dark:border-border flex items-center justify-between px-4 md:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/profile"
              className="w-8 h-8 rounded-full bg-[#2C3E2D] text-white flex items-center justify-center text-xs font-bold"
            >
              {initials}
            </Link>
            <Link href="/admin/profile" className="text-sm font-bold tracking-tight text-[#2C3E2D] dark:text-foreground">
              /profile
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBadge />
            <Button variant="ghost" size="icon" onClick={() => window.location.href = "/admin"}>
              <LayoutGrid className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}