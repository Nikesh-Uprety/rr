import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
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
  Megaphone,
  Terminal,
  Menu,
  X,
  Images,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useNotifications";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { NotificationBadge } from "@/components/admin/NotificationBadge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Suspense, useState } from "react";
import { AdminSkeleton } from "@/components/admin/AdminSkeleton";

const ADMIN_NAV = [
  { href: "/admin", icon: LayoutGrid, label: "Dashboard", type: "system" },
  { href: "/admin/products", icon: Package, label: "Products", type: "product" },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders", type: "order" },
  { href: "/admin/bills", icon: Receipt, label: "Bills", type: "bill" },
  { href: "/admin/customers", icon: User, label: "Customers", type: "customer" },
  { href: "/admin/analytics", icon: BarChart, label: "Analytics", type: "analytics" },
  { href: "/admin/promo-codes", icon: Tags, label: "Promo Codes", type: "promo" },
  { href: "/admin/marketing", icon: Megaphone, label: "Marketing", type: "marketing" },
  { href: "/admin/pos", icon: CreditCard, label: "Point of Sale", type: "pos" },
  { href: "/admin/images", icon: Images, label: "Images", type: "media" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const pathname = location.split("?")[0];
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { getUnreadCountByType, markTypeRead } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-[#F5F5F3] dark:bg-neutral-900 flex text-[#2C3E2D] dark:text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-neutral-950 dark:bg-white border-r border-white/5 dark:border-black/5 hidden md:flex flex-col h-screen sticky top-0 transition-colors duration-500 relative overflow-hidden group/sidebar">
        {/* Sun Flare / Luminous Glow Effect */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 dark:bg-black/5 blur-[80px] rounded-full pointer-events-none group-hover/sidebar:scale-125 transition-transform duration-1000" />
        <div className="absolute top-1/4 -right-16 w-32 h-32 bg-white/5 dark:bg-black/5 blur-[40px] rounded-full pointer-events-none" />

        <div className="flex flex-col items-center border-b border-white/10 dark:border-black/5 relative z-10 px-6 pt-4 pb-2 gap-0">
          <Link href="/" className="block group w-full">
            <img 
              src="/images/logo.webp" 
              alt="Rare Logo" 
              className="w-full h-auto object-contain brightness-0 invert dark:brightness-100 dark:filter-none group-hover:scale-105 transition-all duration-500" 
            />
          </Link>
        </div>

        <div className="px-6 py-4 border-b border-white/5 dark:border-black/5 flex items-center justify-between gap-3">
          <Link
            href="/admin/profile"
            className="flex items-center gap-3 p-1 rounded-xl hover:bg-white/5 dark:hover:bg-black/5 transition-all duration-300 group/profile flex-1 min-w-0"
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full border-2 border-white/10 dark:border-black/10 overflow-hidden shadow-lg group-hover/profile:border-white dark:group-hover/profile:border-black transition-colors">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt={displayName} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/5 dark:bg-black/5 flex items-center justify-center text-white dark:text-black font-bold text-xs">
                    {initials}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-neutral-950 dark:border-white rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white dark:text-black truncate uppercase tracking-wider">{displayName}</p>
              <p className="text-[9px] text-white/40 dark:text-black/40 uppercase font-black tracking-widest mt-0.5">{roleLabel}</p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationBadge />
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-1.5 overflow-y-auto relative z-10 sidebar-scrollbar">
          {ADMIN_NAV.map((item) => {
            const isActive = location === item.href;
            const count = getUnreadCountByType(item.type);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (count > 0) markTypeRead(item.type);
                }}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-black tracking-wider uppercase transition-all duration-300 group/nav",
                  isActive
                    ? "bg-white dark:bg-black text-black dark:text-white shadow-xl shadow-black/40 dark:shadow-white/20 scale-[1.02]"
                    : "text-white/70 dark:text-black/70 hover:text-white dark:hover:text-black hover:bg-white/10 dark:hover:bg-black/10",
                )}
                data-testid={`link-admin-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={cn(
                  "h-6 w-6 transition-transform duration-300 group-hover/nav:scale-110",
                  isActive ? "text-black dark:text-white" : "opacity-90"
                )} />
                <span className="text-[12px] tracking-wider">{item.label}</span>
                
                {count > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black px-1 shadow-lg shadow-emerald-500/40"
                  >
                    {count > 99 ? "99+" : count}
                  </motion.div>
                )}
                
                {isActive && count === 0 && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-black dark:bg-white"
                  />
                )}
              </Link>
            );
          })}
          <div className="mt-6">
            <p className="px-4 pb-2 text-[10px] font-semibold tracking-[0.3em] uppercase text-white/40 dark:text-black/40">
              Storefront
            </p>
            <Link
              href="/admin/landing-page"
              className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-black tracking-wider uppercase transition-all duration-300 group/nav",
                pathname === "/admin/landing-page"
                  ? "bg-white dark:bg-black text-black dark:text-white shadow-xl shadow-black/40 dark:shadow-white/20 scale-[1.02]"
                  : "text-white/70 dark:text-black/70 hover:text-white dark:hover:text-black hover:bg-white/10 dark:hover:bg-black/10",
              )}
            >
              <Images className="h-6 w-6" />
              <span className="text-[12px] tracking-wider">Landing Page</span>
            </Link>
          </div>
        </nav>

        <div className="p-6 border-t border-white/5 dark:border-black/5 bg-neutral-900/40 dark:bg-neutral-50/40">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-3 text-red-500 hover:text-white hover:bg-red-500 dark:hover:bg-red-500 transition-all duration-300 rounded-xl font-black uppercase tracking-widest text-[10px] h-10 border border-red-500/20"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed top-0 left-0 w-72 h-screen bg-neutral-950 dark:bg-white border-r border-white/5 dark:border-black/5 flex flex-col z-[70] md:hidden overflow-hidden"
            >
              {/* Close button */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 dark:border-black/5">
                <Link href="/" onClick={() => setSidebarOpen(false)} className="block">
                  <img 
                    src="/images/logo.webp" 
                    alt="Rare Logo" 
                    className="h-8 object-contain brightness-0 invert dark:brightness-100 dark:filter-none" 
                  />
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 text-white dark:text-black transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 p-6 space-y-1.5 overflow-y-auto">
                {ADMIN_NAV.map((item) => {
                  const isActive = location === item.href;
                  const count = getUnreadCountByType(item.type);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        if (count > 0) markTypeRead(item.type);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-black tracking-wider uppercase transition-all duration-300",
                        isActive
                          ? "bg-white dark:bg-black text-black dark:text-white shadow-xl"
                          : "text-white/70 dark:text-black/70 hover:text-white dark:hover:text-black hover:bg-white/10 dark:hover:bg-black/10",
                      )}
                    >
                      <item.icon className={cn(
                        "h-6 w-6",
                        isActive ? "text-black dark:text-white" : "opacity-90"
                      )} />
                      <span className="text-[12px] tracking-wider">{item.label}</span>
                      {count > 0 && (
                        <div className="ml-auto min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black px-1">
                          {count > 99 ? "99+" : count}
                        </div>
                      )}
                    </Link>
                  );
                })}
                <div className="mt-6">
                  <p className="px-4 pb-2 text-[10px] font-semibold tracking-[0.3em] uppercase text-white/40 dark:text-black/40">
                    Storefront
                  </p>
                  <Link
                    href="/admin/landing-page"
                    onClick={() => {
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-black tracking-wider uppercase transition-all duration-300",
                      pathname === "/admin/landing-page"
                        ? "bg-white dark:bg-black text-black dark:text-white shadow-xl"
                        : "text-white/70 dark:text-black/70 hover:text-white dark:hover:text-black hover:bg-white/10 dark:hover:bg-black/10",
                    )}
                  >
                    <Images className="h-6 w-6" />
                    <span className="text-[12px] tracking-wider">Landing Page</span>
                  </Link>
                </div>
              </nav>

              <div className="p-6 border-t border-white/5 dark:border-black/5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center gap-3 text-red-500 hover:text-white hover:bg-red-500 transition-all duration-300 rounded-xl font-black uppercase tracking-widest text-[10px] h-10 border border-red-500/20"
                  onClick={() => {
                    handleLogout();
                    setSidebarOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#F5F5F3] dark:bg-neutral-900 transition-colors duration-500">
        {/* Fixed POS button (admin-only) */}
        {(user?.role === "admin" || user?.role === "staff") && (
          <Link
            href="/admin/pos"
            className="hidden md:inline-flex fixed top-6 right-6 z-[55] items-center gap-2 rounded-full bg-[#2C3E2D] text-white px-5 py-2.5 shadow-lg shadow-black/20 hover:bg-[#1A251B] transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-widest">
              Point Of Sale
            </span>
          </Link>
        )}
        {/* Header - only on mobile */}
        <header className="h-20 bg-neutral-950 dark:bg-white border-b border-white/10 dark:border-black/5 flex items-center justify-between px-6 md:hidden relative z-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 text-white dark:text-black transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {(user?.role === "admin" || user?.role === "staff") && (
              <Link
                href="/admin/pos"
                className="inline-flex items-center gap-2 rounded-full bg-[#2C3E2D] text-white px-3 py-1.5 shadow-sm hover:bg-[#1A251B] transition-colors"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  POS
                </span>
              </Link>
            )}
            <ThemeToggle />
            <NotificationBadge />
            <Link
              href="/admin/profile"
              className="w-8 h-8 rounded-full border border-white/20 dark:border-black/20 overflow-hidden"
            >
              {user?.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt={displayName} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/5 dark:bg-black/5 flex items-center justify-center text-white dark:text-black text-[10px] font-bold">
                  {initials}
                </div>
              )}
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-12">
          <Suspense fallback={
            <div className="relative w-full">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/20 overflow-hidden rounded-full">
                <div className="h-full w-1/3 bg-primary rounded-full animate-[shimmer_1s_ease-in-out_infinite]" style={{ animation: 'shimmer 1s ease-in-out infinite alternate', transformOrigin: 'left' }} />
              </div>
            </div>
          }>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
}