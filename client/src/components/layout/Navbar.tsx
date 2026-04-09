import { Link, useLocation } from "wouter";
import {
  ShoppingBag,
  LayoutDashboard,
  Menu,
  X,
  Home,
  Shirt,
  Layers,
  PhoneCall,
  Sparkles,
  ArrowRight,
  Compass,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/store/theme";
import { useCartStore } from "@/store/cart";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { fetchPageConfig } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SearchBar from "./SearchBar";
import { canAccessAdminPanel } from "@shared/auth-policy";
import { getDefaultAdminPath } from "@/lib/adminAccess";
import { ThemeTogglerButton } from "@/components/ui/theme-toggler-button";

const ANNOUNCEMENT_ITEMS = [
  "Free shipping on orders over NPR 5,000",
  "SS 2025 Drop — Live Now",
  "Dragon Hoodie — Back in Stock",
  "Basics Collar Jacket — Limited Qty",
];

export default function Navbar() {
  const { theme, setTheme } = useThemeStore();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTabletViewport, setIsTabletViewport] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredNavHref, setHoveredNavHref] = useState<string | null>(null);
  const [hideAnnouncement, setHideAnnouncement] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [activeMegaNavHref, setActiveMegaNavHref] = useState<string | null>(null);
  const announceRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const megaCloseTimerRef = useRef<number | null>(null);
  const previewTemplateId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("canvasPreviewTemplateId");
    return rawValue && /^\d+$/.test(rawValue) ? rawValue : null;
  }, []);
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((acc, item) => acc + item.quantity, 0),
  );
  const openCartSidebar = useCartStore((state) => state.openCartSidebar);
  const { user, isAuthenticated } = useCurrentUser({ enabled: previewTemplateId === null });
  const queryClient = useQueryClient();
  const { data: pageConfig } = useQuery({
    queryKey: ["page-config", previewTemplateId],
    queryFn: () => fetchPageConfig(previewTemplateId),
    staleTime: previewTemplateId !== null ? 0 : 5 * 60 * 1000,
    refetchOnMount: previewTemplateId !== null ? "always" : false,
    refetchOnWindowFocus: previewTemplateId !== null,
  });
  const isStuffyClone = pageConfig?.template?.slug === "stuffyclone";

  const isStorefront = !location.startsWith("/admin");
  const isHomeRoute = location === "/";
  const isAtelierRoute = location === "/atelier";
  const isProductDetailRoute = /^\/product\/[^/]+/.test(location);
  const isStuffyProductDetail = isStuffyClone && isProductDetailRoute;
  const isHeroRoute = isHomeRoute || isAtelierRoute;
  const isInnerStorefrontRoute = isStorefront && !isHeroRoute;
  const [hasScrolledPastThreshold, setHasScrolledPastThreshold] = useState(false);
  const isTransparentState = !hasScrolledPastThreshold;
  const shouldUseChrome = hasScrolledPastThreshold || isInnerStorefrontRoute;
  const useHeroContrastState = isTransparentState && isHeroRoute;
  const isDark = theme === "dark";
  const dashboardPath = user
    ? canAccessAdminPanel(user.role)
      ? getDefaultAdminPath(user.role, user.adminPageAccess)
      : "/admin"
    : "/admin";

  const { mutate: logout } = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      setIsTabletViewport(width >= 768 && width < 1024);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    return () => {
      if (megaCloseTimerRef.current) {
        window.clearTimeout(megaCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isStorefront) {
      setIsScrolled(false);
      setHideAnnouncement(false);
      setIsNavHidden(false);
      lastScrollYRef.current = 0;
      return;
    }

    const onScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 24);
      const announceHeight = announceRef.current?.offsetHeight ?? 0;
      setHideAnnouncement(y > announceHeight);

      const threshold = 80;
      if (y > threshold && !hasScrolledPastThreshold) {
        setHasScrolledPastThreshold(true);
      }

      const nearTop = y <= 40;

      if (nearTop) {
        setIsNavHidden(false);
        setHasScrolledPastThreshold(false);
      }

      lastScrollYRef.current = y;
    };

    const frame = window.requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isStorefront, hasScrolledPastThreshold]);

  if (!isStorefront) return null;

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || (user?.email?.[0] || "U").toUpperCase();

  const navLinks = useMemo(() => {
    if (isStuffyClone) {
      return [
        { name: "Shop", href: "/products" },
        { name: "Collection", href: "/new-collection" },
        { name: "Our Services", href: "/atelier" },
        { name: "FAQ", href: "/shipping" },
        { name: "Customer Care", href: "/refund" },
        { name: "Contact", href: "/atelier#contact" },
        { name: "Cart", href: "/cart" },
      ];
    }

    return [
      { name: "Home", href: "/" },
      { name: "Shop", href: "/products" },
      { name: "Collection", href: "/new-collection" },
      { name: "Atelier", href: "/atelier" },
    ];
  }, [isStuffyClone]);

  const sidebarNavLinks = useMemo(() => {
    if (!isStuffyClone) return navLinks;

    return navLinks.filter(
      (item) =>
        item.name !== "Our Services" && item.name !== "Customer Care",
    );
  }, [isStuffyClone, navLinks]);
  const megaMenuContent = useMemo(
    () => ({
      "/": {
        title: "Home",
        subtitle: "Quickly jump to key storefront experiences from one clean overview.",
        links: [
          { label: "Shop Essentials", href: "/products", description: "Browse all products", icon: Shirt },
          { label: "Featured Collection", href: "/new-collection", description: "Explore latest curated drops", icon: Layers },
          { label: "Atelier Contact", href: "/atelier", description: "Talk to our team", icon: PhoneCall },
          { label: "View Bag", href: "/cart", description: "Review selected items", icon: ShoppingBag },
        ],
      },
      "/products": {
        title: "Shop",
        subtitle: "Filter by category, size, stock, and discover products faster.",
        links: [
          { label: "All Products", href: "/products", description: "Complete catalog", icon: Compass },
          { label: "New Collection", href: "/new-collection", description: "Latest editorial set", icon: Sparkles },
          { label: "Go To Cart", href: "/cart", description: "Continue checkout journey", icon: ShoppingBag },
        ],
      },
      "/new-collection": {
        title: "Collection",
        subtitle: "Editorial narratives and focused product storytelling.",
        links: [
          { label: "Collection Story", href: "/new-collection", description: "View current collection", icon: Layers },
          { label: "Shop Products", href: "/products", description: "Return to full catalog", icon: Shirt },
          { label: "Contact Atelier", href: "/atelier", description: "Ask about fit and delivery", icon: PhoneCall },
        ],
      },
      "/atelier": {
        title: "Atelier",
        subtitle: "Service, support, and direct communication with Rare Atelier.",
        links: [
          { label: "Contact Page", href: "/atelier", description: "Reach us directly", icon: PhoneCall },
          { label: "Browse Shop", href: "/products", description: "Continue shopping", icon: Shirt },
          { label: "New Collection", href: "/new-collection", description: "Discover latest drop", icon: Sparkles },
        ],
      },
    }),
    [],
  );

  const getGlassChrome = (mode: "light" | "dark", options?: { active?: boolean }) => {
    if (options?.active === false) {
      return {
        background: "transparent",
        backdropFilter: "none",
        borderColor: "transparent",
        boxShadow: "none",
      };
    }

    return mode === "light"
      ? {
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.72) 48%, rgba(255,255,255,0.68) 100%)",
          backdropFilter: "blur(16px) saturate(150%)",
          WebkitBackdropFilter: "blur(16px) saturate(150%)",
          borderColor: "rgba(255,255,255,0.50)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
        }
      : {
          background:
            "linear-gradient(135deg, rgba(10,10,10,0.82) 0%, rgba(16,16,16,0.72) 52%, rgba(12,12,12,0.68) 100%)",
          backdropFilter: "blur(16px) saturate(150%)",
          WebkitBackdropFilter: "blur(16px) saturate(150%)",
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.06)",
        };
  };

  const getInnerPageChrome = (darkMode: boolean) => {
    if (!darkMode) {
      return {
        background: "#ffffff",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        borderColor: "rgba(0,0,0,0.08)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
      };
    }

    return {
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.74) 42%, rgba(248,246,242,0.68) 100%)",
      backdropFilter: "blur(18px) saturate(145%)",
      WebkitBackdropFilter: "blur(18px) saturate(145%)",
      borderColor: "rgba(255,255,255,0.38)",
      boxShadow: "0 1px 0 rgba(255,255,255,0.18), 0 12px 40px rgba(0,0,0,0.14)",
    };
  };

  const announcementItems = [...ANNOUNCEMENT_ITEMS, ...ANNOUNCEMENT_ITEMS];
  const announceHeight = announceRef.current?.offsetHeight ?? 28;
  const forceSolidLightNavbar = isInnerStorefrontRoute;
  const isHeroMegaOpen = isHeroRoute && !hasScrolledPastThreshold && Boolean(activeMegaNavHref);
  const isStuffyLanding = isStuffyClone && location === "/";
  const shouldUseDarkStuffyChrome = isStuffyClone && theme === "dark";
  const navForegroundColor = isHeroMegaOpen
    ? "#111111"
    : forceSolidLightNavbar
    ? "#111111"
    : useHeroContrastState
      ? "#ffffff"
      : isDark
        ? "#ffffff"
        : "#ffffff";
  const navLinkColor = navForegroundColor;
  const navChrome = isHeroMegaOpen
    ? {
        background: "#ffffff",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        borderColor: "rgba(0,0,0,0.08)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
      }
    : forceSolidLightNavbar
    ? getInnerPageChrome(isDark)
    : getGlassChrome(isDark ? "light" : "dark", { active: shouldUseChrome });
  const logoFilter = navForegroundColor === "#111111"
    ? "brightness(0)"
    : "brightness(0) invert(1)";
  const navUnderlineColor = isHeroMegaOpen ? "#111111" : useHeroContrastState ? "#ffffff" : navForegroundColor;
  const navTextShadow = isHeroMegaOpen
    ? "none"
    : useHeroContrastState
    ? "0 2px 12px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.15)"
    : "none";
  const mobileMenuSurface = shouldUseDarkStuffyChrome
    ? {
        background: "rgba(10,10,10,0.96)",
        borderColor: "rgba(255,255,255,0.14)",
        mutedBorder: "rgba(255,255,255,0.10)",
        text: "rgba(255,255,255,0.94)",
        textMuted: "rgba(255,255,255,0.56)",
        tile: "rgba(255,255,255,0.04)",
        iconBg: "rgba(255,255,255,0.06)",
        accent: "#ffffff",
        accentText: "#111111",
      }
    : {
        background: "#ffffff",
        borderColor: "rgba(17,17,17,0.16)",
        mutedBorder: "rgba(17,17,17,0.12)",
        text: "#000000",
        textMuted: "rgba(0,0,0,0.62)",
        tile: "#ffffff",
        iconBg: "rgba(0,0,0,0.04)",
        accent: "#000000",
        accentText: "#ffffff",
      };

  const clearMegaCloseTimer = () => {
    if (megaCloseTimerRef.current) {
      window.clearTimeout(megaCloseTimerRef.current);
      megaCloseTimerRef.current = null;
    }
  };

  const queueMegaClose = () => {
    clearMegaCloseTimer();
    megaCloseTimerRef.current = window.setTimeout(() => {
      setActiveMegaNavHref(null);
    }, 180);
  };

  const openMega = (href: string) => {
    clearMegaCloseTimer();
    setActiveMegaNavHref(href);
  };

  const activeMegaMenu = activeMegaNavHref
    ? megaMenuContent[activeMegaNavHref as keyof typeof megaMenuContent]
    : null;
  const megaPanelTheme = {
    shellBg: isHeroMegaOpen ? "#ffffff" : theme === "dark" ? "rgba(6,6,6,0.96)" : "rgba(255,255,255,0.97)",
    shellBorder: isHeroMegaOpen ? "rgba(0,0,0,0.08)" : theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    cardBg: isHeroMegaOpen ? "#ffffff" : theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(248,248,248,0.94)",
    cardBorder: isHeroMegaOpen ? "rgba(0,0,0,0.08)" : theme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
    body: isHeroMegaOpen ? "rgba(0,0,0,0.74)" : theme === "dark" ? "rgba(255,255,255,0.86)" : "rgba(0,0,0,0.74)",
    muted: isHeroMegaOpen ? "rgba(0,0,0,0.52)" : theme === "dark" ? "rgba(255,255,255,0.56)" : "rgba(0,0,0,0.52)",
    strong: isHeroMegaOpen ? "#111111" : theme === "dark" ? "#ffffff" : "#111111",
  };

  const mobileMenu =
    typeof document === "undefined"
      ? null
      : createPortal(
          <AnimatePresence>
            {isMobileMenuOpen ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={isStuffyClone ? "fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm" : "fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm lg:hidden"}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <motion.aside
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                  className={isStuffyClone ? "fixed inset-y-0 left-0 z-[121] flex w-[min(88vw,360px)] max-w-[360px] flex-col border-r" : "fixed inset-y-0 left-0 z-[81] flex w-[min(82vw,340px)] max-w-[340px] flex-col border-r lg:hidden"}
                  style={{
                    background: mobileMenuSurface.background,
                    color: mobileMenuSurface.text,
                    borderColor: mobileMenuSurface.borderColor,
                    boxShadow: "0 24px 72px rgba(0,0,0,0.18)",
                  }}
                >
                  <div
                    className="grid grid-cols-[40px_1fr_40px] items-center border-b px-4 py-4 sm:px-5"
                    style={{ borderColor: mobileMenuSurface.mutedBorder }}
                  >
                    <div />
                    <Link
                      href="/"
                      className="inline-flex items-center justify-self-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <img
                        src="/images/newproductpagelogo-removebg-preview.png"
                        alt="Rare Atelier"
                        className="h-auto w-full max-w-[10.5rem] object-contain sm:max-w-[12rem]"
                        style={{
                          filter: theme === "dark"
                            ? "brightness(0) invert(1) drop-shadow(0 0 14px rgba(255,255,255,0.28))"
                            : "brightness(0)",
                        }}
                      />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border"
                      style={{
                        borderColor: mobileMenuSurface.mutedBorder,
                        background: mobileMenuSurface.iconBg,
                        color: mobileMenuSurface.text,
                      }}
                      aria-label="Close menu"
                    >
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-8 py-6 sm:px-9">
                    <nav className="flex flex-col">
              {sidebarNavLinks.map((item, index) => {
                const isActive = location === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="border-b py-5 text-[16px] font-bold uppercase tracking-[0.22em] transition-opacity duration-200"
                            style={{
                              fontFamily: "\"Archivo Narrow\", system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                              borderColor: mobileMenuSurface.mutedBorder,
                              color: isActive ? mobileMenuSurface.accent : mobileMenuSurface.text,
                              opacity: isActive ? 1 : 0.78,
                            }}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </nav>

                    <div
                      className="mt-6 flex items-center justify-between border-t pt-5"
                      style={{ borderColor: mobileMenuSurface.mutedBorder }}
                    >
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.24em]"
                        style={{ color: mobileMenuSurface.textMuted, fontFamily: "var(--font-mono)" }}
                      >
                        Theme
                      </p>
                      <ThemeTogglerButton
                        theme={theme}
                        onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="rounded-full px-1 py-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                        iconClassName="h-4 w-4"
                        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                      />
                    </div>

                    {isAuthenticated && user ? (
                      <div
                        className="mt-8 border-t pt-6"
                        style={{ borderColor: mobileMenuSurface.mutedBorder }}
                      >
                        <p className="text-sm font-semibold">{user.name || user.email}</p>
                        <p
                          className="mt-1 text-[10px] uppercase tracking-[0.22em]"
                          style={{ color: mobileMenuSurface.textMuted, fontFamily: "var(--font-mono)" }}
                        >
                          {user.role}
                        </p>
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setLocation(dashboardPath);
                            }}
                            className="text-[10px] uppercase tracking-[0.18em]"
                            style={{
                              color: mobileMenuSurface.text,
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                          Dashboard
                        </button>
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            logout();
                          }}
                          className="rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em]"
                          style={{
                            background: "#1f8f4e",
                            color: "#ffffff",
                            fontFamily: "var(--font-mono)",
                            boxShadow: "0 10px 24px rgba(31,143,78,0.24)",
                          }}
                        >
                          Logout
                        </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="border-t px-6 py-4"
                    style={{ borderColor: mobileMenuSurface.mutedBorder }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        openCartSidebar();
                      }}
                      className="flex w-full items-center justify-between text-left"
                      style={{ color: mobileMenuSurface.text }}
                    >
                      <div>
                        <p
                          className="text-[10px] uppercase tracking-[0.22em]"
                          style={{ color: mobileMenuSurface.textMuted, fontFamily: "var(--font-mono)" }}
                        >
                          Bag
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {cartItemsCount} item{cartItemsCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ShoppingBag className="h-5 w-5" />
                    </button>
                  </div>
                </motion.aside>
              </>
            ) : null}
          </AnimatePresence>,
          document.body,
        );

  if (isStuffyClone) {
    const chromeColor = isStuffyLanding
      ? theme === "dark"
        ? "rgba(255,255,255,0.92)"
        : "rgba(17,17,17,0.92)"
      : theme === "dark"
        ? "rgba(255,255,255,0.92)"
        : "rgba(17,17,17,0.92)";
    const chromeBg = isStuffyLanding
      ? "transparent"
      : isStuffyProductDetail && !isScrolled
        ? "transparent"
      : isStuffyProductDetail
        ? theme === "dark"
          ? "rgba(13,17,23,0.18)"
          : "#ffffff"
      : theme === "dark"
        ? "rgba(13,17,23,0.68)"
        : "#ffffff";
    const chromeBorder = isStuffyLanding
      ? "transparent"
      : isStuffyProductDetail && !isScrolled
        ? "transparent"
      : isStuffyProductDetail
        ? theme === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(17,17,17,0.10)"
      : theme === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(17,17,17,0.10)";
    const chromeBackdrop = isStuffyLanding || (isStuffyProductDetail && !isScrolled) ? "none" : "blur(14px)";
    const landingControlBackground = isStuffyLanding
      ? "transparent"
      : isStuffyProductDetail
      ? theme === "dark"
        ? "rgba(15,23,42,0.18)"
        : "#ffffff"
      : theme === "dark"
        ? "rgba(22,27,34,0.82)"
        : "#ffffff";
    const landingControlBorder = isStuffyLanding
      ? "transparent"
      : theme === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(17,17,17,0.10)";
    const landingControlShadow = isStuffyLanding
      ? "none"
      : theme === "dark"
      ? "0 12px 30px rgba(0,0,0,0.24)"
      : "0 12px 30px rgba(15,23,42,0.08)";

    return (
      <>
        {mobileMenu}
        <header className="fixed inset-x-0 top-0 z-[110] pointer-events-auto">
          <div
            className="relative flex w-full items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-8"
            style={{
              background: chromeBg,
              borderBottom: `1px solid ${chromeBorder}`,
              backdropFilter: chromeBackdrop,
              paddingTop: "max(env(safe-area-inset-top), 1rem)",
              paddingRight: "max(env(safe-area-inset-right), 2px)",
              paddingLeft: "max(env(safe-area-inset-left), 2px)",
            }}
            
          >
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="group inline-flex min-h-11 items-center gap-3 rounded-full px-3 py-2 text-[13px] font-bold uppercase tracking-[0.28em] transition-opacity hover:opacity-80 sm:px-4 sm:text-[14px]"
              style={{
                color: chromeColor,
                fontFamily: '"Archivo Narrow", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                background: landingControlBackground,
                border: `1px solid ${landingControlBorder}`,
                boxShadow: landingControlShadow,
              }}
              aria-label="Open menu"
            >
              <span className="flex w-5 flex-col gap-1.5" aria-hidden="true">
                <span className="h-px w-3 bg-current transition-all duration-300 ease-out group-hover:w-5" />
                <span className="h-px w-5 bg-current transition-all duration-300 ease-out" />
                <span className="h-px w-4 self-end bg-current transition-all duration-300 ease-out group-hover:w-2" />
              </span>
              <span>Menu</span>
            </button>

            <div className="pointer-events-none absolute inset-x-0 flex justify-center px-20 sm:px-28 md:px-36">
              {isStuffyLanding ? null : (
                <Link href="/" className="pointer-events-auto inline-flex items-center justify-center">
                  <img
                    src="/images/newproductpagelogo-removebg-preview.png"
                    alt="Rare Atelier"
                    className="h-auto w-full max-w-[12rem] object-contain sm:max-w-[15rem] md:max-w-[18rem]"
                    style={{
                      filter: theme === "dark"
                        ? "brightness(0) invert(1) drop-shadow(0 0 18px rgba(255,255,255,0.38)) drop-shadow(0 0 34px rgba(255,255,255,0.16))"
                        : "brightness(0)",
                    }}
                  />
                </Link>
              )}
            </div>

            <div className="ml-auto flex items-center justify-end gap-2 sm:gap-2.5">
              <div className="[&>div>div]:border-none [&>div>div]:bg-transparent">
                <SearchBar iconColor={chromeColor} minimal={isStuffyLanding && theme !== "dark"} />
              </div>
              <ThemeTogglerButton
                theme={theme}
                onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={`inline-flex items-center justify-center rounded-full transition-colors hover:bg-white/10 ${
                  isStuffyLanding
                    ? "[&_.MuiSwitch-root]:-mx-2 [&_.MuiSwitch-root]:scale-[0.72]"
                    : "px-1"
                }`}
                style={{
                  color: chromeColor,
                  border: `1px solid ${chromeBorder}`,
                  background: landingControlBackground,
                  boxShadow: landingControlShadow,
                }}
                iconClassName="h-5 w-5"
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              />
              <button
                type="button"
                onClick={() => openCartSidebar()}
                className="relative flex h-11 w-11 items-center justify-center rounded-full"
                style={{
                  color: chromeColor,
                  border: `1px solid ${chromeBorder}`,
                  background: landingControlBackground,
                  boxShadow: landingControlShadow,
                }}
                aria-label="Open cart"
              >
                <ShoppingBag className="h-5 w-5" />
                {cartItemsCount > 0 ? (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                    style={{ background: chromeColor, color: isStuffyLanding || theme === "dark" ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.92)" }}
                  >
                    {cartItemsCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </header>
      </>
    );
  }
  return (
    <>
      <header
        id="nav"
        className="fixed inset-x-0 z-[60]"
        onMouseEnter={clearMegaCloseTimer}
        onMouseLeave={queueMegaClose}
        style={{
          top: 0,
          transition:
            "transform 0.42s cubic-bezier(.4,0,.2,1), background 0.55s var(--ease), backdrop-filter 0.55s var(--ease), border-color 0.55s var(--ease), box-shadow 0.55s var(--ease)",
          transform: isNavHidden ? "translateY(-115%)" : "translateY(0)",
          background: navChrome.background,
          backdropFilter: navChrome.backdropFilter,
          borderBottom: `1px solid ${navChrome.borderColor}`,
          boxShadow: navChrome.boxShadow,
        }}
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div
            className="grid items-center gap-4 py-4"
            style={{ gridTemplateColumns: "1fr auto 1fr", minHeight: "var(--nav-h)" }}
          >
            <div className="hidden items-center gap-6 lg:flex">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative px-1 py-2 text-[12px] font-semibold uppercase transition-all duration-300 hover:-translate-y-[1px] after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:transition-transform after:duration-300"
                  style={{
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.18em",
                    color: navLinkColor,
                    opacity: location === item.href ? 1 : 0.88,
                    textShadow: navTextShadow,
                  }}
                  onMouseEnter={(event) => {
                    setHoveredNavHref(item.href);
                    openMega(item.href);
                  }}
                  onMouseLeave={() => {
                    setHoveredNavHref((current) => (current === item.href ? null : current));
                    queueMegaClose();
                  }}
                  aria-current={location === item.href ? "page" : undefined}
                >
                  {item.name}
                  <span
                    className="absolute bottom-0 left-0 h-px w-full origin-left transition-transform duration-300"
                    style={{
                      background: navUnderlineColor,
                      boxShadow: shouldUseChrome
                        ? navForegroundColor === "#111111"
                          ? "0 0 12px rgba(0,0,0,0.16)"
                          : "0 0 12px rgba(255,255,255,0.34)"
                        : "none",
                      transform:
                        location === item.href || hoveredNavHref === item.href
                          ? "scaleX(1)"
                          : "scaleX(0)",
                    }}
                  />
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center"
                style={{ color: navForegroundColor }}
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            <Link href="/" className="flex justify-self-center items-center justify-center text-center">
              <span
                className={
                  isProductDetailRoute
                    ? "mx-auto text-[clamp(1rem,2.1vw,1.55rem)] font-bold uppercase tracking-[0.42em]"
                    : "mx-auto text-[13px] font-bold uppercase tracking-[0.42em] sm:text-[14px] lg:text-[15px]"
                }
                style={{
                  color: isProductDetailRoute ? "#ffffff" : navForegroundColor,
                  fontFamily: "\"Archivo Narrow\", system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                  textShadow: isProductDetailRoute ? "0 2px 12px rgba(0,0,0,0.42)" : "none",
                  mixBlendMode: isProductDetailRoute ? "difference" : "normal",
                  transform: isProductDetailRoute ? "translateY(1px)" : "none",
                }}
              >
                Rare Atelier
              </span>
            </Link>

            <div className="ml-auto flex items-center justify-end gap-1 sm:gap-2">
              <div className="hidden sm:block [&>div>div]:border-none [&>div>div]:bg-transparent">
                <SearchBar iconColor={navForegroundColor} />
              </div>
              <ThemeTogglerButton
                theme={theme}
                onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="inline-flex items-center justify-center rounded-full px-1"
                style={{
                  color: navForegroundColor,
                  textShadow: useHeroContrastState ? "0 0 14px rgba(255,255,255,0.28)" : "none",
                }}
                iconClassName="h-5 w-5"
              />
              <button
                type="button"
                onClick={() => openCartSidebar()}
                className="relative flex h-10 w-10 items-center justify-center"
                style={{
                  color: navForegroundColor,
                  textShadow: useHeroContrastState ? "0 0 14px rgba(255,255,255,0.28)" : "none",
                }}
              >
                <ShoppingBag className="h-5 w-5" />
                {cartItemsCount > 0 ? (
                  <span
                    className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px]"
                    style={{
                      background: "var(--gold)",
                      color: "var(--bg)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {cartItemsCount}
                  </span>
                ) : null}
              </button>
              {isAuthenticated && user ? (
                <button
                  type="button"
                  title="Admin Dashboard"
                  onClick={() => setLocation(dashboardPath)}
                  className="flex h-10 w-10 items-center justify-center"
                  style={{ color: navForegroundColor }}
                >
                  <LayoutDashboard className="h-4.5 w-4.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <AnimatePresence>
          {activeMegaMenu ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="hidden overflow-hidden border-t lg:block"
              onMouseEnter={clearMegaCloseTimer}
              onMouseLeave={queueMegaClose}
              style={{
                background: megaPanelTheme.shellBg,
                backdropFilter: "blur(18px) saturate(130%)",
                WebkitBackdropFilter: "blur(18px) saturate(130%)",
                borderColor: megaPanelTheme.shellBorder,
              }}
            >
              <div className="mx-auto max-w-[1440px] px-6 py-5 lg:px-8">
                <div
                  className="rounded-2xl border p-5 md:p-6"
                  style={{
                    background: megaPanelTheme.cardBg,
                    borderColor: megaPanelTheme.cardBorder,
                    boxShadow:
                      theme === "dark"
                        ? "0 20px 42px rgba(0,0,0,0.34)"
                        : "0 22px 44px rgba(0,0,0,0.08)",
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeMegaNavHref}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                      className="grid grid-cols-12 gap-6"
                    >
                      <div className="col-span-4">
                        <p
                          className="text-[10px] font-bold uppercase tracking-[0.2em]"
                          style={{ color: megaPanelTheme.muted, fontFamily: "var(--font-mono)" }}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Home className="h-3.5 w-3.5" />
                            {activeMegaMenu.title}
                          </span>
                        </p>
                        <p className="mt-3 text-sm leading-6" style={{ color: megaPanelTheme.body }}>
                          {activeMegaMenu.subtitle}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {activeMegaMenu.links.slice(0, 2).map((entry) => (
                            <span
                              key={`${activeMegaNavHref}-chip-${entry.href}`}
                              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                              style={{
                                borderColor: megaPanelTheme.cardBorder,
                                color: megaPanelTheme.strong,
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              <entry.icon className="h-3.5 w-3.5" />
                              {entry.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="col-span-8 grid gap-3 sm:grid-cols-2">
                        {activeMegaMenu.links.map((entry, index) => {
                          const Icon = entry.icon;
                          return (
                            <motion.div
                              key={`${activeMegaNavHref}-${entry.href}-${entry.label}`}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.025, duration: 0.16 }}
                            >
                              <Link
                                href={entry.href}
                                onClick={() => setActiveMegaNavHref(null)}
                                className="group block rounded-xl border px-4 py-3 transition-all duration-200 hover:-translate-y-[1px]"
                                style={{
                                  borderColor: megaPanelTheme.cardBorder,
                                  background: theme === "dark" ? "rgba(255,255,255,0.02)" : "#ffffff",
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <span
                                      className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
                                      style={{
                                        background: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                                        color: megaPanelTheme.strong,
                                      }}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </span>
                                    <span>
                                      <span
                                        className="block text-[11px] font-black uppercase tracking-[0.16em]"
                                        style={{
                                          color: megaPanelTheme.strong,
                                          fontFamily: "var(--font-mono)",
                                        }}
                                      >
                                        {entry.label}
                                      </span>
                                      <span className="mt-1 block text-xs" style={{ color: megaPanelTheme.body }}>
                                        {entry.description}
                                      </span>
                                    </span>
                                  </div>
                                  <ArrowRight
                                    className="h-4 w-4 shrink-0 translate-x-0 opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                                    style={{ color: megaPanelTheme.strong }}
                                  />
                                </div>
                              </Link>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>
      {mobileMenu}
    </>
  );
}
