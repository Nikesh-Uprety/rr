import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  User,
  BarChart,
  Package,
  CreditCard,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const ADMIN_NAV = [
  { href: "/admin", icon: LayoutGrid, label: "Dashboard" },
  { href: "/admin/products", icon: Package, label: "Products" },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
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
        <div className="h-16 flex items-center px-6 border-b border-[#E5E5E0] dark:border-border">
          <Link
            href="/"
            className="font-serif font-bold text-xl tracking-tight"
            data-testid="link-admin-home"
          >
            RARE@admin
          </Link>
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
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#2C3E2D] text-white flex items-center justify-center text-xs font-medium">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {roleLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - only on mobile or if needed */}
        <header className="h-16 bg-white dark:bg-card border-b border-[#E5E5E0] dark:border-border flex items-center justify-between px-6 md:hidden">
          <Link href="/" className="font-serif font-bold text-xl tracking-tight">
            RARE@admin
          </Link>
          <Button variant="ghost" size="icon">
            <LayoutGrid className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}