import { Link, useLocation } from "wouter";
import {
  ChevronRight,
  Bell,
  FileText,
  Layers3,
  Link2,
  LogOut,
  Moon,
  Paintbrush2,
  Settings,
  Sparkles,
  Sun,
  Type,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useNotifications";
import { useAdminWebSocket } from "@/hooks/useAdminWebSocket";
import { useThemeStore } from "@/store/theme";
import { NotificationBadge } from "@/components/admin/NotificationBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ADMIN_FONT_EVENT,
  applyAdminFontSettings,
  readAdminFontSettings,
} from "@/lib/adminFont";
import { getAdminNavigation } from "@/lib/adminAccess";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from "@/components/animate-ui/sidebar";
import { cn } from "@/lib/utils";
import "@/styles/admin-shell.css";

const ADMIN_SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const ADMIN_SIDEBAR_EXPANDED_WIDTH_KEY = "sidebar-width-expanded";
const ADMIN_SIDEBAR_COLLAPSED_WIDTH_KEY = "sidebar-width-collapsed";
const ADMIN_SIDEBAR_MIN_WIDTH = 220;
const ADMIN_SIDEBAR_DEFAULT_WIDTH = 288;
const ADMIN_SIDEBAR_COLLAPSED_MIN_WIDTH = 56;
const ADMIN_SIDEBAR_COLLAPSED_DEFAULT_WIDTH = 72;
const ADMIN_SIDEBAR_VISUAL_EXPAND_THRESHOLD = 170;
const AdminDateCalendar = lazy(() => import("@/components/admin/AdminDateCalendar"));

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
  const { theme, setTheme } = useThemeStore();
  const { toast } = useToast();
  const { getUnreadCountByType, markTypeRead } = useNotifications();
  useAdminWebSocket();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
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
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const closeMenuTimeoutRef = useRef<number | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMenuPinned, setProfileMenuPinned] = useState(false);

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 15);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuPinned(false);
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProfileMenuPinned(false);
      setProfileMenuOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const clearProfileMenuCloseTimer = () => {
    if (closeMenuTimeoutRef.current !== null) {
      window.clearTimeout(closeMenuTimeoutRef.current);
      closeMenuTimeoutRef.current = null;
    }
  };

  const openProfileMenu = () => {
    clearProfileMenuCloseTimer();
    setProfileMenuOpen(true);
  };

  const scheduleProfileMenuClose = () => {
    if (profileMenuPinned) return;
    clearProfileMenuCloseTimer();
    closeMenuTimeoutRef.current = window.setTimeout(() => {
      setProfileMenuOpen(false);
    }, 140);
  };

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
  const collapsedThemeSidebarClass = !isVisuallyExpanded
    ? "[&_[data-slot=sidebar-inner]]:bg-[#101A22] [&_[data-slot=sidebar-inner]]:text-white [&_[data-slot=sidebar-container]]:border-[#2D3A45] dark:[&_[data-slot=sidebar-inner]]:bg-[#F8FAFC] dark:[&_[data-slot=sidebar-inner]]:text-[#111827] dark:[&_[data-slot=sidebar-container]]:border-[#D7DEE7]"
    : "";
  const adminNav = getAdminNavigation(user?.role, user?.adminPageAccess);
  const sidebarNavItems = adminNav.filter(
    (item) => item.page !== "profile" && item.page !== "landing-page",
  );
  const storeUsersNavItem = adminNav.find((item) => item.page === "store-users");
  const notificationsNavItem = adminNav.find((item) => item.page === "notifications");
  const devFontHref = "/admin/dev-font";
  const canvasLegacyHref = "/admin/canvas/legacy";
  const websiteNavItems = [
    {
      href: canvasLegacyHref,
      label: "Canvas Beta",
      description: "Classic template editor",
      icon: Sparkles,
      badge: "BETA" as const,
    },
    {
      href: "/admin/canvas?tab=pages&panel=list",
      label: "Pages",
      description: "Pages, add section, redesign",
      icon: FileText,
      badge: "BETA" as const,
    },
    {
      href: "/admin/canvas?tab=templates",
      label: "Templates",
      description: "Rare Atelier default templates",
      icon: Layers3,
    },
    {
      href: "/admin/canvas?tab=theme",
      label: "Theme",
      description: "Typography and storefront styling",
      icon: Type,
    },
    {
      href: "/admin/canvas?tab=branding",
      label: "Branding",
      description: "Logos, colors, and brand assets",
      icon: Paintbrush2,
    },
    {
      href: "/admin/canvas?tab=navigation",
      label: "Navigation",
      description: "Header links and page order",
      icon: Link2,
    },
  ];
  const currentCanvasLocation =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : location;
  const navigateToCustomization = (href: string) => {
    if (typeof window === "undefined") return;
    window.history.pushState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new Event("canvas-customization-nav"));
  };
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

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
      className="min-h-screen bg-muted dark:bg-neutral-900 text-foreground admin-font admin-panel-root overflow-hidden"
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
          <nav className="space-y-1">
            {sidebarNavItems.map((item) => {
              const isActive = pathname === item.href;
              const inventoryBadge = item.href === "/admin/inventory";
              const navBadge = item.badge;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[12px] font-black tracking-[0.06em] transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {navBadge ? (
                    <span className="ml-auto inline-flex rounded-full border border-amber-700/50 bg-amber-500 px-1.5 py-0.5 text-[8px] font-black tracking-[0.14em] text-black dark:border-amber-300/70 dark:bg-amber-300 dark:text-black">
                      {navBadge}
                    </span>
                  ) : null}
                  {inventoryBadge ? (
                    <span className="ml-auto inline-flex rounded-full border border-emerald-700/50 bg-emerald-600 px-1.5 py-0.5 text-[8px] font-black tracking-[0.14em] text-white dark:border-emerald-500/70 dark:bg-emerald-500">
                      NEW
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          {adminNav.some((item) => item.page === "landing-page") ? (
            <div className="mt-6 border-t border-border pt-4">
              <p className="px-4 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Customization
              </p>
              <div className="space-y-1">
                {websiteNavItems.map((item) => {
                  const isActive = currentCanvasLocation === item.href;
                  if (!item.href.startsWith("/admin/canvas")) {
                    return null;
                  }

                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => navigateToCustomization(item.href)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[12px] font-semibold">{item.label}</span>
                          {item.badge ? (
                            <span className="inline-flex rounded-full border border-red-700/60 bg-red-600 px-1.5 py-0.5 text-[8px] font-black tracking-[0.14em] text-white dark:border-red-500/70 dark:bg-red-500">
                              {item.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground">{item.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

      </div>

      <Sidebar
        collapsible="icon"
        className={cn(
          "relative border-r border-sidebar-border/50 hidden lg:flex",
          collapsedThemeSidebarClass,
        )}
      >
        <SidebarHeader
          className={cn(
            "border-b border-sidebar-border/60 px-4 py-4 transition-all duration-300 ease-out",
            isVisuallyExpanded ? "opacity-100 max-h-24" : "max-h-0 overflow-hidden border-transparent px-0 py-0 opacity-0",
          )}
        >
          <Link
            href="/"
            className="flex items-center justify-center w-full rounded-lg p-2 hover:bg-muted/40 transition-colors"
            title="Open Home Page"
          >
            <img
              src="/images/logo.webp"
              alt="RARE.NP"
              className="h-10 w-auto object-contain dark:brightness-0 dark:invert"
            />
          </Link>
        </SidebarHeader>

        <SidebarContent className="sidebar-scrollbar p-4 group-data-[collapsible=icon]:overflow-y-auto">
          <SidebarGroup className="p-0">
            <SidebarMenu>
              {sidebarNavItems.map((item) => {
                const isActive = pathname === item.href;
                const isInventoryItem = item.href === "/admin/inventory";
                const navBadge = item.badge;
                const count = getUnreadCountByType(item.type);
                const isCollapsedActive = !isVisuallyExpanded && isActive;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={isVisuallyExpanded ? undefined : item.label}
                      className={cn(
                        "h-10 rounded-lg text-[11px] font-black tracking-[0.06em] transition-all duration-300 ease-out",
                        isVisuallyExpanded ? "px-3" : "justify-center px-2",
                        !isVisuallyExpanded &&
                          "text-white hover:bg-white/12 hover:text-white dark:text-[#111827] dark:hover:bg-[#E6EBF2] dark:hover:text-[#111827]",
                        isActive &&
                          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                        isCollapsedActive &&
                          "bg-white text-[#0f172a] shadow-[0_0_0_1px_rgba(15,23,42,0.18)] hover:bg-white/95 hover:text-[#0f172a] dark:bg-[#111827] dark:text-white dark:hover:bg-[#111827] dark:hover:text-white dark:shadow-[0_0_0_1px_rgba(17,24,39,0.45)]",
                      )}
                    >
                      <Link
                        href={item.href}
                        className={cn(
                          "flex w-full items-center",
                          !isVisuallyExpanded && "text-white dark:text-[#111827]",
                          isCollapsedActive && "text-[#0f172a] dark:text-white",
                        )}
                        onClick={() => {
                          if (count > 0) markTypeRead(item.type);
                        }}
                        data-testid={`link-admin-nav-${item.label.toLowerCase()}`}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            !isVisuallyExpanded && "text-white dark:text-[#111827]",
                            isCollapsedActive && "text-[#0f172a] dark:text-white",
                          )}
                        />
                        <span
                          className={cn(
                            "overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
                            isVisuallyExpanded ? "min-w-0 flex-1 opacity-100" : "max-w-0 opacity-0",
                          )}
                        >
                          <span>{item.label}</span>
                        </span>
                        {navBadge && isVisuallyExpanded ? (
                          <span className="inline-flex rounded-full border border-amber-700/50 bg-amber-500 px-1.5 py-0.5 text-[8px] font-black tracking-[0.14em] text-black dark:border-amber-300/70 dark:bg-amber-300 dark:text-black">
                            {navBadge}
                          </span>
                        ) : null}
                        {isInventoryItem && isVisuallyExpanded ? (
                          <span className="ml-auto inline-flex rounded-full border border-emerald-700/50 bg-emerald-600 px-1.5 py-0.5 text-[8px] font-black tracking-[0.14em] text-white dark:border-emerald-500/70 dark:bg-emerald-500">
                            NEW
                          </span>
                        ) : null}
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
          {adminNav.some((item) => item.page === "landing-page") ? (
            <SidebarGroup className="mt-6 p-0">
              {isVisuallyExpanded ? (
                <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Customization
                </SidebarGroupLabel>
              ) : null}
              <SidebarMenu>
                {websiteNavItems.map((item) => {
                  const isActive = currentCanvasLocation === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={isVisuallyExpanded ? undefined : item.label}
                        className={cn(
                          "h-10 rounded-lg text-[11px] font-black tracking-[0.06em] transition-all duration-300 ease-out",
                          isVisuallyExpanded ? "px-3" : "justify-center px-2",
                          !isVisuallyExpanded &&
                            "text-white hover:bg-white/12 hover:text-white dark:text-[#111827] dark:hover:bg-[#E6EBF2] dark:hover:text-[#111827]",
                          isActive &&
                            "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                        )}
                        onClick={() => {
                          if (item.href.startsWith("/admin/canvas")) {
                            navigateToCustomization(item.href);
                            return;
                          }
                        }}
                      >
                        <div
                          className={cn(
                            "flex w-full items-center gap-3",
                            !isVisuallyExpanded && "justify-center",
                          )}
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
                          {item.badge && isVisuallyExpanded ? (
                            <span className="inline-flex rounded-full border border-red-700/60 bg-red-600 px-1.5 py-0.5 text-[8px] font-black tracking-[0.14em] text-white dark:border-red-500/70 dark:bg-red-500">
                              {item.badge}
                            </span>
                          ) : null}
                          {isVisuallyExpanded ? (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : null}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ) : null}
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

      <SidebarInset className="admin-panel-shell flex min-w-0 h-screen overflow-visible bg-muted dark:bg-neutral-900">
        <header className="relative sticky top-0 z-40 overflow-visible h-16 bg-background/60 dark:bg-neutral-900/55 backdrop-blur-xl supports-[backdrop-filter]:bg-background/45 border-b border-border/60 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)] flex items-center justify-between px-4 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <SidebarTrigger className="text-foreground hover:bg-background/50 hidden lg:flex shrink-0" />
            {!isVisuallyExpanded ? (
              <Link
                href="/"
                className="hidden lg:flex items-center shrink-0 absolute left-1/2 -translate-x-1/2"
                title="Open Home Page"
              >
                <img
                  src="/images/logo.webp"
                  alt="RARE.NP"
                  className="h-7 w-auto object-contain brightness-0 dark:brightness-0 dark:invert"
                />
              </Link>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="text-foreground lg:hidden shrink-0"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            <div className="hidden sm:flex items-center min-w-0">
              <AdminBreadcrumbs />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="hidden xl:flex flex-col items-start leading-tight rounded-lg border border-border/70 bg-card/40 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                  aria-label="Open calendar"
                >
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Local Time</span>
                  <span className="text-[11px] font-semibold text-foreground">
                    {now.toLocaleString("en-NP", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="border-b px-3 py-2 text-xs">
                  <p className="font-medium">Today</p>
                  <p className="text-muted-foreground">
                    {now.toLocaleDateString("en-NP", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {isCalendarOpen ? (
                  <Suspense
                    fallback={
                      <div className="h-[320px] w-[320px] animate-pulse bg-muted/40" />
                    }
                  >
                    <AdminDateCalendar value={calendarDate} onChange={setCalendarDate} />
                  </Suspense>
                ) : null}
              </PopoverContent>
            </Popover>
            <NotificationBadge />
            <div
              ref={profileMenuRef}
              className="relative"
              onMouseEnter={openProfileMenu}
              onMouseLeave={scheduleProfileMenuClose}
            >
              <button
                type="button"
                className="w-8 h-8 rounded-full border border-border/70 bg-card/40 overflow-hidden"
                onClick={() => {
                  const nextPinned = !profileMenuPinned;
                  setProfileMenuPinned(nextPinned);
                  setProfileMenuOpen(nextPinned);
                }}
                aria-label="Open account menu"
                aria-expanded={profileMenuOpen}
              >
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-background/60 flex items-center justify-center text-foreground text-[11px] font-black">
                    {initials}
                  </div>
                )}
              </button>

              {profileMenuOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+6px)] z-[80] w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
                  onMouseEnter={openProfileMenu}
                  onMouseLeave={scheduleProfileMenuClose}
                >
                  <div className="absolute -top-2 left-0 right-0 h-2" />
                  <div className="px-2.5 py-2 border-b border-border/70">
                    <p className="text-xs font-semibold truncate">{displayName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user?.email || ""}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/admin/profile"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setProfileMenuPinned(false);
                        setProfileMenuOpen(false);
                      }}
                    >
                      <User className="h-4 w-4" />
                      Account
                    </Link>
                    {storeUsersNavItem ? (
                      <Link
                        href={storeUsersNavItem.href}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                        onClick={() => {
                          setProfileMenuPinned(false);
                          setProfileMenuOpen(false);
                        }}
                      >
                        <Users className="h-4 w-4" />
                        User Settings
                      </Link>
                    ) : null}
                    {notificationsNavItem ? (
                      <Link
                        href={notificationsNavItem.href}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                        onClick={() => {
                          setProfileMenuPinned(false);
                          setProfileMenuOpen(false);
                        }}
                      >
                        <Bell className="h-4 w-4" />
                        Notifications
                      </Link>
                    ) : null}
                    <Link
                      href="/admin/profile"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setProfileMenuPinned(false);
                        setProfileMenuOpen(false);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      System Settings
                    </Link>
                    <Link
                      href={devFontHref}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setProfileMenuPinned(false);
                        setProfileMenuOpen(false);
                      }}
                    >
                      <Type className="h-4 w-4" />
                      Dev Font
                    </Link>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Theme
                      </span>
                      <div className="rounded-md p-1.5 text-muted-foreground">
                        {theme === "dark" ? (
                          <Moon className="h-4 w-4" />
                        ) : (
                          <Sun className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                  </div>
                  <div className="border-t border-border/70 pt-1">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.98] dark:hover:bg-red-950/30"
                      onClick={() => {
                        setProfileMenuPinned(false);
                        setProfileMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="admin-panel-content flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-12">
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
