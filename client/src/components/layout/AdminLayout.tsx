import { Link, useLocation } from "wouter";
import {
  ChevronsLeftRight,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useNotifications";
import { useAdminWebSocket } from "@/hooks/useAdminWebSocket";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { NotificationBadge } from "@/components/admin/NotificationBadge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ADMIN_FONT_EVENT,
  applyAdminFontSettings,
  readAdminFontSettings,
} from "@/lib/adminFont";
import { getAdminNavigation, getRoleLabel } from "@/lib/adminAccess";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from "@/components/animate-ui/sidebar";
import { cn } from "@/lib/utils";

const ADMIN_SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const ADMIN_SIDEBAR_EXPANDED_WIDTH_KEY = "sidebar-width-expanded";
const ADMIN_SIDEBAR_COLLAPSED_WIDTH_KEY = "sidebar-width-collapsed";
const ADMIN_SIDEBAR_MIN_WIDTH = 220;
const ADMIN_SIDEBAR_DEFAULT_WIDTH = 288;
const ADMIN_SIDEBAR_COLLAPSED_MIN_WIDTH = 56;
const ADMIN_SIDEBAR_COLLAPSED_DEFAULT_WIDTH = 72;
const ADMIN_SIDEBAR_VISUAL_EXPAND_THRESHOLD = 170;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const getSidebarMaxWidth = () => {
    if (typeof window === "undefined") return 480;
    return Math.max(240, Math.floor(window.innerWidth / 2));
  };

  const [location] = useLocation();
  const pathname = location.split("?")[0];
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { getUnreadCountByType, markTypeRead } = useNotifications();
  useAdminWebSocket();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return ADMIN_SIDEBAR_DEFAULT_WIDTH;
    const saved = Number(localStorage.getItem(ADMIN_SIDEBAR_EXPANDED_WIDTH_KEY));
    if (!Number.isFinite(saved)) return ADMIN_SIDEBAR_DEFAULT_WIDTH;
    return Math.min(getSidebarMaxWidth(), Math.max(ADMIN_SIDEBAR_MIN_WIDTH, saved));
  });
  const [collapsedSidebarWidth, setCollapsedSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return ADMIN_SIDEBAR_COLLAPSED_DEFAULT_WIDTH;
    const saved = Number(localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_WIDTH_KEY));
    if (!Number.isFinite(saved)) return ADMIN_SIDEBAR_COLLAPSED_DEFAULT_WIDTH;
    return Math.min(getSidebarMaxWidth(), Math.max(ADMIN_SIDEBAR_COLLAPSED_MIN_WIDTH, saved));
  });
  const resizeStateRef = useRef<{
    startX: number;
    startWidth: number;
    collapsed: boolean;
  } | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false); // Close mobile menu on route change
  }, [pathname]);

  useEffect(() => {
    applyAdminFontSettings(readAdminFontSettings());

    const syncAdminFont = () => {
      applyAdminFontSettings(readAdminFontSettings());
    };

    window.addEventListener(ADMIN_FONT_EVENT, syncAdminFont);
    window.addEventListener("storage", syncAdminFont);

    return () => {
      window.removeEventListener(ADMIN_FONT_EVENT, syncAdminFont);
      window.removeEventListener("storage", syncAdminFont);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      ADMIN_SIDEBAR_COLLAPSED_KEY,
      sidebarCollapsed ? "true" : "false",
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(ADMIN_SIDEBAR_EXPANDED_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_WIDTH_KEY, String(collapsedSidebarWidth));
  }, [collapsedSidebarWidth]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeStateRef.current) return;
      const nextWidth =
        resizeStateRef.current.startWidth + (event.clientX - resizeStateRef.current.startX);
      const maxWidth = getSidebarMaxWidth();

      if (resizeStateRef.current.collapsed) {
        setCollapsedSidebarWidth(
          Math.min(maxWidth, Math.max(ADMIN_SIDEBAR_COLLAPSED_MIN_WIDTH, nextWidth)),
        );
      } else {
        setSidebarWidth(
          Math.min(maxWidth, Math.max(ADMIN_SIDEBAR_MIN_WIDTH, nextWidth)),
        );
      }
    };

    const stopResizing = () => {
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, []);

  useEffect(() => {
    const syncWidthsToViewport = () => {
      const maxWidth = getSidebarMaxWidth();
      setSidebarWidth((current) => Math.min(maxWidth, Math.max(ADMIN_SIDEBAR_MIN_WIDTH, current)));
      setCollapsedSidebarWidth((current) =>
        Math.min(maxWidth, Math.max(ADMIN_SIDEBAR_COLLAPSED_MIN_WIDTH, current)),
      );
    };

    window.addEventListener("resize", syncWidthsToViewport);
    return () => window.removeEventListener("resize", syncWidthsToViewport);
  }, []);

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
  const isVisuallyExpanded =
    !sidebarCollapsed || collapsedSidebarWidth >= ADMIN_SIDEBAR_VISUAL_EXPAND_THRESHOLD;
  const roleLabel = getRoleLabel(user?.role);
  const adminNav = getAdminNavigation(user?.role);

  return (
    <SidebarProvider
      open={!sidebarCollapsed}
      onOpenChange={(open) => {
        setSidebarCollapsed(!open);
        if (!open) {
          setCollapsedSidebarWidth(ADMIN_SIDEBAR_COLLAPSED_DEFAULT_WIDTH);
        }
      }}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--sidebar-width-icon": `${collapsedSidebarWidth}px`,
        } as React.CSSProperties
      }
      className="min-h-screen bg-muted dark:bg-neutral-900 text-foreground admin-font overflow-hidden transition-colors duration-200 ease-in-out"
    >
      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer Content */}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[min(84vw,320px)] sm:w-[320px] bg-background/95 z-[70] lg:hidden transform transition-transform duration-300 ease-[cubic-bezier(.23,1,.32,1)] shadow-2xl flex flex-col backdrop-blur-xl border-r border-border",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card/50">
          <Link href="/" className="flex items-center">
            <img
              src="/images/logo.webp"
              alt="RARE.NP Logo"
              className="h-9 sm:h-10 w-auto object-contain dark:brightness-0 dark:invert"
            />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="h-8 w-8 rounded-full hover:bg-muted"
          >
            <span className="sr-only">Close</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <Link
            href="/admin/profile"
            className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 shadow-sm hover:bg-muted/60 transition-colors"
          >
            <div className="h-11 w-11 rounded-full border border-border overflow-hidden shrink-0">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-card flex items-center justify-center text-sm font-bold text-foreground">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground truncate">
                {displayName}
              </h3>
              <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{roleLabel}</p>
              <p className="text-[9px] text-muted-foreground/80 uppercase font-bold tracking-[0.14em] mt-1">
                Account Settings
              </p>
            </div>
          </Link>

          <nav className="space-y-1">
            {adminNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-bold tracking-[0.08em] transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

      </div>

      <Sidebar
        collapsible="icon"
        className="relative border-r border-sidebar-border/50 hidden lg:flex"
      >
        <SidebarHeader
          className={cn(
            "border-b border-sidebar-border/60 px-4 py-4 transition-all duration-300 ease-out",
            isVisuallyExpanded ? "opacity-100 max-h-24" : "max-h-0 overflow-hidden border-transparent px-0 py-0 opacity-0",
          )}
        >
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full rounded-lg p-2 hover:bg-muted/40 transition-colors"
            title="Open Home Page"
          >
            <img
              src="/images/logo.webp"
              alt="RARE.NP"
              className="h-10 w-auto object-contain dark:brightness-0 dark:invert"
            />
          </a>
        </SidebarHeader>

        <SidebarContent className="sidebar-scrollbar p-4">
          {isVisuallyExpanded ? (
            <Link
              href="/admin/profile"
              className="mb-4 flex items-center gap-3 rounded-xl border border-sidebar-border/60 bg-card/50 p-3 hover:bg-muted/50 transition-all duration-300 ease-out"
            >
              <div className="h-10 w-10 overflow-hidden rounded-full border border-sidebar-border shrink-0">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-xs font-bold">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-[11px] font-bold uppercase tracking-wider">{displayName}</p>
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.2em]">{roleLabel}</p>
                <p className="mt-1 text-[9px] text-muted-foreground/80 uppercase font-bold tracking-[0.14em]">
                  Account Settings
                </p>
              </div>
            </Link>
          ) : null}

          <SidebarGroup className="p-0">
            <SidebarMenu>
              {adminNav.map((item) => {
                const isActive = pathname === item.href;
                const count = getUnreadCountByType(item.type);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={isVisuallyExpanded ? undefined : item.label}
                      className={cn(
                        "h-10 rounded-lg text-[10px] font-semibold tracking-[0.08em] transition-all duration-300 ease-out",
                        isVisuallyExpanded ? "px-3" : "justify-center px-2",
                        isActive &&
                          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                      )}
                    >
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (count > 0) markTypeRead(item.type);
                        }}
                        data-testid={`link-admin-nav-${item.label.toLowerCase()}`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span
                          className={cn(
                            "overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
                            isVisuallyExpanded ? "min-w-0 flex-1 opacity-100" : "max-w-0 opacity-0",
                          )}
                        >
                          {item.label}
                        </span>
                        {count > 0 && (
                          <span
                            className={cn(
                              "min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black px-1 transition-all duration-300 ease-out",
                              isVisuallyExpanded ? "ml-auto opacity-100" : "ml-0 opacity-0 scale-75 pointer-events-none",
                            )}
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={(event) => {
            resizeStateRef.current = {
              startX: event.clientX,
              startWidth: sidebarCollapsed ? collapsedSidebarWidth : sidebarWidth,
              collapsed: sidebarCollapsed,
            };
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          className="absolute inset-y-0 -right-2 hidden w-4 cursor-col-resize lg:block"
        >
          <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-sidebar-border/60 transition-colors hover:bg-primary/60" />
        </div>
      </Sidebar>

      <SidebarInset className="flex min-w-0 h-screen overflow-hidden bg-muted dark:bg-neutral-900 transition-colors duration-200 ease-in-out">
        <header className="sticky top-0 z-20 h-16 bg-background/60 dark:bg-neutral-900/55 backdrop-blur-xl supports-[backdrop-filter]:bg-background/45 border-b border-border/60 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)] flex items-center justify-between px-4 sm:px-5 transition-colors duration-200 ease-in-out">
          <div className="flex items-center gap-2.5">
            <SidebarTrigger className="text-foreground hover:bg-background/50 hidden lg:flex" />
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-border/70 bg-card/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground animate-pulse">
              <ChevronsLeftRight className="h-3 w-3" />
              Collapse sidebar
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="text-foreground lg:hidden"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <NotificationBadge />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl text-[10px] font-semibold tracking-[0.12em] text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
            <Link
              href="/admin/profile"
              className="w-8 h-8 rounded-full border border-border/70 bg-card/40 overflow-hidden"
            >
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-background/60 flex items-center justify-center text-foreground text-[10px] font-bold">
                  {initials}
                </div>
              )}
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-12 transition-colors duration-200 ease-in-out">
          <Suspense
            fallback={
              <div className="relative w-full">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/20 overflow-hidden rounded-full">
                  <div
                    className="h-full w-1/3 bg-primary rounded-full animate-[shimmer_1s_ease-in-out_infinite]"
                    style={{ animation: "shimmer 1s ease-in-out infinite alternate", transformOrigin: "left" }}
                  />
                </div>
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
