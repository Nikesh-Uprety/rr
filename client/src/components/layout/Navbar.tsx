import { Link, useLocation } from "wouter";
import { ShoppingBag, LayoutDashboard, Menu, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/store/theme";
import { useCartStore } from "@/store/cart";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredNavHref, setHoveredNavHref] = useState<string | null>(null);
  const [hideAnnouncement, setHideAnnouncement] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const announceRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
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
    queryFn: () => {
      const params = new URLSearchParams();
      if (previewTemplateId) {
        params.set("templateId", previewTemplateId);
      }
      const url = params.toString()
        ? `/api/public/page-config?${params.toString()}`
        : "/api/public/page-config";
      return fetch(url).then((r) => r.json());
    },
    staleTime: 30 * 1000,
  });

  const isStorefront = !location.startsWith("/admin");
  const isHomeRoute = location === "/";
  const isNewCollectionRoute = location === "/new-collection";
  const isAtelierRoute = location === "/atelier";
  const isTransparentState = isHomeRoute || (isNewCollectionRoute && !isScrolled) || (isAtelierRoute && !isScrolled);
  const useHeroContrastState = isTransparentState;
  const shouldUseChrome = !isTransparentState;
  const isDark = theme === "dark";
  const dashboardPath = user
    ? canAccessAdminPanel(user.role)
      ? getDefaultAdminPath(user.role)
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
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMobileMenuOpen]);

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

      const previousY = lastScrollYRef.current;
      const delta = y - previousY;
      const nearTop = y <= 40;

      if (nearTop) {
        setIsNavHidden(false);
      } else if (delta > 6) {
        setIsNavHidden(true);
      } else if (delta < -6) {
        setIsNavHidden(false);
      }

      lastScrollYRef.current = y;
    };

    const frame = window.requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isStorefront]);

  if (!isStorefront) return null;

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || (user?.email?.[0] || "U").toUpperCase();

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/products" },
    { name: "New Collection", href: "/new-collection" },
    { name: "Atelier", href: "/atelier" },
  ];

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
            "linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.56) 48%, rgba(248,248,248,0.46) 100%)",
          backdropFilter: "blur(18px) saturate(165%)",
          borderColor: "rgba(255,255,255,0.62)",
          boxShadow: "0 18px 42px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.72)",
        }
      : {
          background:
            "linear-gradient(135deg, rgba(10,10,12,0.72) 0%, rgba(16,16,20,0.52) 52%, rgba(12,12,14,0.42) 100%)",
          backdropFilter: "blur(20px) saturate(175%)",
          borderColor: "rgba(255,255,255,0.14)",
          boxShadow: "0 22px 48px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
        };
  };

  const announcementItems = [...ANNOUNCEMENT_ITEMS, ...ANNOUNCEMENT_ITEMS];
  const announceHeight = announceRef.current?.offsetHeight ?? 28;
  const navLinkColor = useHeroContrastState
    ? "rgba(255,255,255,0.98)"
    : isDark
      ? "#111111"
      : "rgba(255,255,255,0.96)";
  const navChrome = getGlassChrome(isDark ? "light" : "dark", { active: shouldUseChrome });
  const logoFilter = useHeroContrastState
    ? "brightness(0) invert(1)"
    : isDark
      ? "brightness(0)"
      : "brightness(0) invert(1)";
  const navUnderlineColor = useHeroContrastState ? "#ffffff" : isDark ? "#111111" : "#ffffff";
  const navTextShadow = useHeroContrastState
    ? "0 0 16px rgba(255,255,255,0.34), 0 2px 16px rgba(0,0,0,0.2)"
    : isDark
      ? "none"
      : "0 0 14px rgba(255,255,255,0.3)";

  return (
    <header
      id="nav"
      className="fixed inset-x-0 z-[60]"
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
                    event.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(event) => {
                    setHoveredNavHref((current) => (current === item.href ? null : current));
                    event.currentTarget.style.opacity = location === item.href ? "1" : "0.88";
                  }}
                  aria-current={location === item.href ? "page" : undefined}
                >
                  {item.name}
                  <span
                    className="absolute bottom-0 left-0 h-px w-full origin-left transition-transform duration-300"
                    style={{
                      background: navUnderlineColor,
                      boxShadow: shouldUseChrome ? "0 0 12px rgba(255,255,255,0.34)" : "none",
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
                style={{ color: useHeroContrastState ? "#ffffff" : isDark ? "#181411" : "#ffffff" }}
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            <Link href="/" className="justify-self-center text-center">
              <img
                src="/images/logo.webp"
                alt="Rare Atelier"
                className="mx-auto h-11 w-auto object-contain sm:h-12 lg:h-14"
                style={{
                  filter: useHeroContrastState
                    ? `${logoFilter} drop-shadow(0 0 18px rgba(255,255,255,0.42))`
                    : !isDark && shouldUseChrome
                      ? `${logoFilter} drop-shadow(0 0 14px rgba(255,255,255,0.28))`
                    : `${logoFilter} drop-shadow(0 4px 14px rgba(0,0,0,0.18))`,
                  transition: "filter 0.25s ease, transform 0.25s ease",
                  opacity: 1,
                  transform: "translateZ(0)",
                }}
              />
            </Link>

            <div className="ml-auto flex items-center justify-end gap-1 sm:gap-2">
              <div className="hidden sm:block [&>div>div]:border-none [&>div>div]:bg-transparent">
                <SearchBar />
              </div>
              <ThemeTogglerButton
                theme={theme}
                onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex h-10 w-10 items-center justify-center"
                style={{
                  color: useHeroContrastState ? "#ffffff" : isDark ? "#181411" : "#ffffff",
                  textShadow: useHeroContrastState
                    ? "0 0 14px rgba(255,255,255,0.28)"
                    : !isDark && shouldUseChrome
                      ? "0 0 10px rgba(255,255,255,0.28)"
                      : "none",
                }}
                iconClassName="h-4.5 w-4.5"
              />
              <button
                type="button"
                onClick={() => openCartSidebar()}
                className="relative flex h-10 w-10 items-center justify-center"
                style={{
                  color: useHeroContrastState ? "#ffffff" : isDark ? "#181411" : "#ffffff",
                  textShadow: useHeroContrastState
                    ? "0 0 14px rgba(255,255,255,0.28)"
                    : !isDark && shouldUseChrome
                      ? "0 0 10px rgba(255,255,255,0.28)"
                      : "none",
                }}
              >
                <ShoppingBag className="h-4.5 w-4.5" />
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
                  style={{ color: "var(--fg)" }}
                >
                  <LayoutDashboard className="h-4.5 w-4.5 text-[var(--gold)]" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="border-t px-5 py-5 lg:hidden"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, rgba(250,247,243,0.9) 0%, rgba(255,255,255,0.78) 100%)"
                  : "linear-gradient(135deg, rgba(12,11,9,0.92) 0%, rgba(18,18,20,0.82) 100%)",
                backdropFilter: isDark ? "blur(20px) saturate(150%)" : "blur(26px) saturate(185%)",
                borderColor: isDark ? "rgba(255,255,255,0.52)" : "rgba(255,255,255,0.08)",
              }}
            >
              <div className="mb-4 sm:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-11 w-full items-center rounded-full border px-4"
                  style={{ borderColor: isDark ? "rgba(24,20,17,0.08)" : "var(--border)", color: isDark ? "rgba(24,20,17,0.6)" : "var(--fg-dim)" }}
                >
                  <Search className="mr-3 h-4 w-4" />
                  Search products
                </button>
              </div>
              <nav className="flex flex-col gap-2">
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-4 py-3 text-[11px] uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.18em",
                      color: location === item.href ? "var(--bg)" : isDark ? "#181411" : "var(--fg)",
                      background: location === item.href ? "var(--gold)" : "transparent",
                      border: `1px solid ${location === item.href ? "var(--gold)" : (isDark ? "rgba(24,20,17,0.08)" : "var(--border)")}`,
                    }}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
              {isAuthenticated && user ? (
                <div className="mt-4 flex items-center justify-between rounded-3xl border px-4 py-3" style={{ borderColor: isDark ? "rgba(24,20,17,0.08)" : "var(--border)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: isDark ? "#181411" : "var(--fg)" }}>
                      {user.name || user.email}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: isDark ? "rgba(24,20,17,0.6)" : "var(--fg-dim)", fontFamily: "var(--font-mono)" }}>
                      {user.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLocation(dashboardPath)}
                      className="rounded-full border px-3 py-2 text-[10px] uppercase"
                      style={{ borderColor: isDark ? "rgba(24,20,17,0.08)" : "var(--border)", color: isDark ? "#181411" : "var(--fg)", fontFamily: "var(--font-mono)" }}
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => logout()}
                      className="rounded-full px-3 py-2 text-[10px] uppercase"
                      style={{ background: "var(--gold)", color: "var(--bg)", fontFamily: "var(--font-mono)" }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>
  );
}
