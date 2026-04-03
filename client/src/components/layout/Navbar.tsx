import { Link, useLocation } from "wouter";
import { ShoppingBag, LayoutDashboard, Menu, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/store/theme";
import { useCartStore } from "@/store/cart";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { fetchPageConfig } from "@/lib/api";
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
    queryFn: () => fetchPageConfig(previewTemplateId),
    staleTime: 5 * 60 * 1000,
  });

  const isStorefront = !location.startsWith("/admin");
  const isHomeRoute = location === "/";
  const isAtelierRoute = location === "/atelier";
  const isHeroRoute = isHomeRoute || isAtelierRoute;
  const isInnerStorefrontRoute = isStorefront && !isHeroRoute;
  const [hasScrolledPastThreshold, setHasScrolledPastThreshold] = useState(false);
  const isTransparentState = !hasScrolledPastThreshold;
  const shouldUseChrome = hasScrolledPastThreshold || isInnerStorefrontRoute;
  const useHeroContrastState = isTransparentState && isHeroRoute;
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

      const threshold = 80;
      if (y > threshold && !hasScrolledPastThreshold) {
        setHasScrolledPastThreshold(true);
      }

      const previousY = lastScrollYRef.current;
      const delta = y - previousY;
      const nearTop = y <= 40;

      if (nearTop) {
        setIsNavHidden(false);
        setHasScrolledPastThreshold(false);
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
  }, [isStorefront, hasScrolledPastThreshold]);

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
      return getGlassChrome("light", { active: true });
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
  const navForegroundColor = forceSolidLightNavbar
    ? "#111111"
    : useHeroContrastState
      ? "#ffffff"
      : isDark
        ? "#111111"
        : "#ffffff";
  const navLinkColor = navForegroundColor;
  const navChrome = forceSolidLightNavbar
    ? getInnerPageChrome(isDark)
    : getGlassChrome(isDark ? "light" : "dark", { active: shouldUseChrome });
  const logoFilter = navForegroundColor === "#111111"
    ? "brightness(0)"
    : "brightness(0) invert(1)";
  const navUnderlineColor = useHeroContrastState ? "#ffffff" : navForegroundColor;
  const navTextShadow = useHeroContrastState
    ? "0 0 16px rgba(255,255,255,0.34), 0 2px 16px rgba(0,0,0,0.2)"
    : "none";
  const mobileMenuTheme = isDark ? "dark" : "light";
  const mobileMenuSurface =
    mobileMenuTheme === "dark"
      ? {
          background:
            "linear-gradient(180deg, rgba(12,12,12,0.98) 0%, rgba(18,18,18,0.96) 100%)",
          borderColor: "rgba(255,255,255,0.10)",
          mutedBorder: "rgba(255,255,255,0.08)",
          text: "#ffffff",
          textMuted: "rgba(255,255,255,0.62)",
          tile: "rgba(255,255,255,0.04)",
          tileHover: "rgba(255,255,255,0.09)",
          iconBg: "rgba(255,255,255,0.06)",
        }
      : {
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,248,248,0.96) 100%)",
          borderColor: "rgba(17,17,17,0.12)",
          mutedBorder: "rgba(17,17,17,0.08)",
          text: "#111111",
          textMuted: "rgba(17,17,17,0.56)",
          tile: "rgba(17,17,17,0.03)",
          tileHover: "rgba(17,17,17,0.06)",
          iconBg: "rgba(17,17,17,0.05)",
        };

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
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            <Link href="/" className="justify-self-center text-center">
              <img
                src="/images/logo.webp"
                alt="Rare Atelier"
                className="mx-auto h-11 w-auto object-contain sm:h-12 lg:h-14"
                width={1449}
                height={289}
                style={{
                  filter: logoFilter,
                  transition: "filter 0.25s ease",
                  opacity: 1,
                  imageRendering: "-webkit-optimize-contrast",
                  backfaceVisibility: "hidden",
                }}
              />
            </Link>

            <div className="ml-auto flex items-center justify-end gap-1 sm:gap-2">
              <div className="hidden sm:block [&>div>div]:border-none [&>div>div]:bg-transparent">
                <SearchBar iconColor={navForegroundColor} />
              </div>
              <ThemeTogglerButton
                theme={theme}
                onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex h-10 w-10 items-center justify-center"
                style={{
                  color: navForegroundColor,
                  textShadow: useHeroContrastState ? "0 0 14px rgba(255,255,255,0.28)" : "none",
                }}
                iconClassName="h-4.5 w-4.5"
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
                  style={{ color: navForegroundColor }}
                >
                  <LayoutDashboard className="h-4.5 w-4.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[65] bg-black/50 backdrop-blur-sm lg:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                className="fixed inset-y-0 left-0 z-[70] flex w-[min(88vw,380px)] max-w-[380px] flex-col border-r lg:hidden"
                style={{
                  background: mobileMenuSurface.background,
                  color: mobileMenuSurface.text,
                  borderColor: mobileMenuSurface.borderColor,
                  backdropFilter: "blur(22px) saturate(145%)",
                  WebkitBackdropFilter: "blur(22px) saturate(145%)",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.24)",
                }}
              >
                <div
                  className="flex items-center justify-between border-b px-4 py-4 sm:px-5"
                  style={{ borderColor: mobileMenuSurface.mutedBorder }}
                >
                  <div className="min-w-0">
                    <p
                      className="text-[10px] uppercase tracking-[0.3em]"
                      style={{ color: mobileMenuSurface.textMuted, fontFamily: "var(--font-mono)" }}
                    >
                      Navigation
                    </p>
                    <p className="mt-1 text-sm font-semibold">Explore RARE.NP</p>
                  </div>
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

                <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setLocation("/products");
                    }}
                    className="flex h-12 w-full items-center rounded-2xl border px-4 text-left text-[11px] uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.2em",
                      borderColor: mobileMenuSurface.mutedBorder,
                      color: mobileMenuSurface.textMuted,
                      background: mobileMenuSurface.tile,
                    }}
                  >
                    <Search className="mr-3 h-4 w-4" />
                    Search Products
                  </button>

                  <nav className="mt-5 flex flex-col gap-2">
                    {navLinks.map((item, index) => {
                      const isActive = location === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="group rounded-2xl border px-4 py-4"
                          style={{
                            fontFamily: "var(--font-mono)",
                            letterSpacing: "0.18em",
                            borderColor: isActive ? "var(--gold)" : mobileMenuSurface.mutedBorder,
                            background: isActive ? "var(--gold)" : mobileMenuSurface.tile,
                            color: isActive ? "var(--bg)" : mobileMenuSurface.text,
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p
                                className="text-[10px] uppercase"
                                style={{
                                  color: isActive ? "var(--bg)" : mobileMenuSurface.textMuted,
                                }}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </p>
                              <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em]">
                                {item.name}
                              </p>
                            </div>
                            <span
                              className="flex h-9 w-9 items-center justify-center rounded-full border transition-transform duration-300 group-hover:translate-x-0.5"
                              style={{
                                borderColor: isActive ? "rgba(17,17,17,0.14)" : mobileMenuSurface.mutedBorder,
                                background: isActive ? "rgba(17,17,17,0.06)" : mobileMenuSurface.iconBg,
                              }}
                            >
                              <span className="text-base leading-none">+</span>
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </nav>

                  {isAuthenticated && user ? (
                    <div
                      className="mt-5 rounded-[28px] border p-4"
                      style={{
                        borderColor: mobileMenuSurface.mutedBorder,
                        background: mobileMenuSurface.tile,
                      }}
                    >
                      <p className="text-sm font-semibold">{user.name || user.email}</p>
                      <p
                        className="mt-1 text-[10px] uppercase tracking-[0.22em]"
                        style={{ color: mobileMenuSurface.textMuted, fontFamily: "var(--font-mono)" }}
                      >
                        {user.role}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setLocation(dashboardPath);
                          }}
                          className="rounded-2xl border px-3 py-3 text-[10px] uppercase"
                          style={{
                            borderColor: mobileMenuSurface.mutedBorder,
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
                          className="rounded-2xl px-3 py-3 text-[10px] uppercase"
                          style={{
                            background: "var(--gold)",
                            color: "var(--bg)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div
                  className="border-t px-4 py-4 sm:px-5"
                  style={{ borderColor: mobileMenuSurface.mutedBorder }}
                >
                  <div
                    className="flex items-center justify-between rounded-2xl border px-4 py-3"
                    style={{
                      borderColor: mobileMenuSurface.mutedBorder,
                      background: mobileMenuSurface.tile,
                    }}
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
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        openCartSidebar();
                      }}
                      className="flex h-11 min-w-11 items-center justify-center rounded-full px-4"
                      style={{
                        background: mobileMenuTheme === "dark" ? "#ffffff" : "#111111",
                        color: mobileMenuTheme === "dark" ? "#111111" : "#ffffff",
                      }}
                    >
                      <ShoppingBag className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>
      </header>
  );
}
