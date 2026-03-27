import { Link, useLocation } from "wouter";
import { ShoppingBag, Sun, Moon, LayoutDashboard, Menu, X, Search } from "lucide-react";
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
  const [hideAnnouncement, setHideAnnouncement] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const announceRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((acc, item) => acc + item.quantity, 0),
  );
  const { user, isAuthenticated } = useCurrentUser();
  const queryClient = useQueryClient();
  const previewTemplateId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("canvasPreviewTemplateId");
    return rawValue && /^\d+$/.test(rawValue) ? rawValue : null;
  }, []);
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
  const isMaisonNocturne = isStorefront && pageConfig?.template?.slug === "maison-nocturne";
  const isNikeshDesign = isStorefront && pageConfig?.template?.slug === "nikeshdesign";
  const isLuxuryEditorialHome = isMaisonNocturne || isNikeshDesign;
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
    if (!isLuxuryEditorialHome) {
      setIsScrolled(false);
      setHideAnnouncement(false);
      setIsNavHidden(false);
      return;
    }

    const onScroll = () => {
      const y = window.scrollY;
      if (isMaisonNocturne) {
        const trigger = document.querySelector<HTMLElement>("[data-navbar-trigger='maison-nocturne']");
        if (trigger) {
          const triggerBottom = trigger.offsetTop + trigger.offsetHeight;
          setIsScrolled(y > Math.max(60, triggerBottom - 120));
        } else {
          setIsScrolled(false);
        }
      } else {
        setIsScrolled(y > 60);
      }
      const announceHeight = announceRef.current?.offsetHeight ?? 0;
      setHideAnnouncement(y > announceHeight);

      if (isMaisonNocturne) {
        const lastY = lastScrollYRef.current;
        if (y <= 24) {
          setIsNavHidden(false);
        } else if (y > lastY + 6) {
          setIsNavHidden(true);
        } else if (y < lastY - 6) {
          setIsNavHidden(false);
        }
        lastScrollYRef.current = y;
      }
    };

    const frame = window.requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isLuxuryEditorialHome, isMaisonNocturne]);

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

  if (isLuxuryEditorialHome) {
    const announcementItems = [...ANNOUNCEMENT_ITEMS, ...ANNOUNCEMENT_ITEMS];
    const announceHeight = announceRef.current?.offsetHeight ?? 28;
    const showTopAnnouncement = !isMaisonNocturne;
    const isMaisonLight = isMaisonNocturne && theme !== "dark";
    const isHomeRoute = location === "/";
    const isTransparentState = isHomeRoute && !isScrolled;
    const shouldUseChrome = !isHomeRoute || isScrolled;
    const navLinkColor = isTransparentState && isMaisonNocturne
      ? "rgba(24,20,17,0.84)"
      : isMaisonLight
        ? "rgba(24,20,17,0.82)"
        : "var(--fg)";
    const navChrome = shouldUseChrome
      ? isMaisonLight
        ? {
            background: "rgba(244, 239, 231, 0.42)",
            backdropFilter: "blur(12px) saturate(128%)",
            borderColor: "rgba(24,20,17,0.08)",
            boxShadow: "0 12px 40px rgba(104, 122, 145, 0.10)",
          }
        : {
            background: "rgba(21,18,15,0.56)",
            backdropFilter: "blur(12px) saturate(132%)",
            borderColor: "rgba(232,228,219,0.12)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.24)",
          }
      : {
          background: "transparent",
          backdropFilter: "none",
          borderColor: "transparent",
          boxShadow: "none",
        };
    const logoFilter = isTransparentState
      ? isMaisonNocturne
        ? "brightness(0)"
        : "brightness(0) invert(1)"
      : theme === "dark"
        ? "brightness(0) invert(1)"
        : "brightness(0)";

    return (
      <>
        {showTopAnnouncement ? (
          <div
            ref={announceRef}
            className="fixed inset-x-0 top-0 z-[61] overflow-hidden border-b"
            style={{
              background: "var(--gold)",
              color: "var(--bg)",
              borderColor: "rgba(12,11,9,0.08)",
              transform: hideAnnouncement ? "translateY(-100%)" : "translateY(0)",
              transition: "transform 0.45s cubic-bezier(.4,0,.2,1)",
            }}
          >
            <div className="rare-announce-track flex w-max items-center py-2">
              {announcementItems.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="shrink-0 px-6 text-[10px] uppercase"
                  style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.2em" }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <header
          id="nav"
          className="fixed inset-x-0 z-[60]"
          style={{
            top: showTopAnnouncement ? (hideAnnouncement ? 0 : announceHeight) : 0,
            transition:
              "top 0.45s cubic-bezier(.4,0,.2,1), transform 0.42s cubic-bezier(.4,0,.2,1), background 0.55s var(--ease), backdrop-filter 0.55s var(--ease), border-color 0.55s var(--ease), box-shadow 0.55s var(--ease)",
            transform: isMaisonNocturne && isNavHidden ? "translateY(-115%)" : "translateY(0)",
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
                    className="relative py-1 text-[10.5px] font-semibold uppercase transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-[var(--gold)] after:transition-transform after:duration-300 hover:after:scale-x-100"
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.2em",
                      color: navLinkColor,
                      textShadow: isMaisonNocturne && isTransparentState ? "0 1px 10px rgba(255,255,255,0.08)" : "none",
                    }}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center"
                  style={{ color: isTransparentState && isMaisonNocturne ? "#181411" : isMaisonLight ? "#181411" : "var(--fg)" }}
                  aria-label="Toggle menu"
                >
                  {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>

              <Link href="/" className="justify-self-center text-center">
                {isMaisonNocturne ? (
                  <img
                    src="/images/logo.webp"
                    alt="Rare Atelier"
                    className="mx-auto h-10 w-auto object-contain sm:h-11"
                    style={{
                      filter: logoFilter,
                      transition: "filter 0.25s ease, opacity 0.25s ease, transform 0.25s ease",
                      opacity: shouldUseChrome ? 0.96 : 1,
                    }}
                  />
                ) : (
                  <span
                    className="block text-[18px] uppercase"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      letterSpacing: "0.45em",
                      color: "var(--fg)",
                    }}
                  >
                    Rare Atelier
                  </span>
                )}
                {isMaisonNocturne ? null : (
                  <span
                    className="mt-1 block text-[7px] uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.35em",
                      color: "var(--gold)",
                    }}
                  >
                    Kathmandu · Est. 2022
                  </span>
                )}
              </Link>

              <div className="ml-auto flex items-center justify-end gap-1 sm:gap-2">
                <div className="hidden sm:block [&>div>div]:border-none [&>div>div]:bg-transparent">
                  <SearchBar />
                </div>
                {isNikeshDesign ? null : (
                  <button
                    type="button"
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    className="flex h-10 w-10 items-center justify-center"
                    style={{ color: isTransparentState && isMaisonNocturne ? "#181411" : isMaisonLight ? "#181411" : "var(--fg)" }}
                    aria-label="Toggle theme"
                  >
                    {theme === "light" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
                  </button>
                )}
                <Link href="/cart" className="relative flex h-10 w-10 items-center justify-center" style={{ color: isTransparentState && isMaisonNocturne ? "#181411" : isMaisonLight ? "#181411" : "var(--fg)" }}>
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
                </Link>
                {isNikeshDesign ? (
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                    className="hidden h-10 w-10 items-center justify-center lg:flex"
                    style={{ color: isTransparentState && isMaisonNocturne ? "#181411" : isMaisonLight ? "#181411" : "var(--fg)" }}
                    aria-label="Toggle menu"
                  >
                    <span className="flex w-5 flex-col gap-[5px]">
                      <span className="block h-px w-full bg-current" />
                      <span className="block h-px w-[70%] bg-current" />
                    </span>
                  </button>
                ) : null}
                {isAuthenticated && user && !isNikeshDesign ? (
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
                  background: isMaisonLight ? "rgba(247,243,236,0.92)" : "rgba(12,11,9,0.96)",
                  backdropFilter: isMaisonLight ? "blur(18px) saturate(135%)" : "blur(24px) saturate(180%)",
                  borderColor: isMaisonLight ? "rgba(24,20,17,0.08)" : "var(--border)",
                }}
              >
                <div className="mb-4 sm:hidden">
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-11 w-full items-center rounded-full border px-4"
                    style={{ borderColor: isMaisonLight ? "rgba(24,20,17,0.08)" : "var(--border)", color: isMaisonLight ? "rgba(24,20,17,0.6)" : "var(--fg-dim)" }}
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
                        color: location === item.href ? "var(--bg)" : isMaisonLight ? "#181411" : "var(--fg)",
                        background: location === item.href ? "var(--gold)" : "transparent",
                        border: `1px solid ${location === item.href ? "var(--gold)" : (isMaisonLight ? "rgba(24,20,17,0.08)" : "var(--border)")}`,
                      }}
                    >
                      {item.name}
                    </Link>
                  ))}
                </nav>
                {isAuthenticated && user ? (
                  <div className="mt-4 flex items-center justify-between rounded-3xl border px-4 py-3" style={{ borderColor: isMaisonLight ? "rgba(24,20,17,0.08)" : "var(--border)" }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: isMaisonLight ? "#181411" : "var(--fg)" }}>
                        {user.name || user.email}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: isMaisonLight ? "rgba(24,20,17,0.6)" : "var(--fg-dim)", fontFamily: "var(--font-mono)" }}>
                        {user.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLocation(dashboardPath)}
                        className="rounded-full border px-3 py-2 text-[10px] uppercase"
                        style={{ borderColor: isMaisonLight ? "rgba(24,20,17,0.08)" : "var(--border)", color: isMaisonLight ? "#181411" : "var(--fg)", fontFamily: "var(--font-mono)" }}
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
      </>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-background border-none">
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-12">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden relative z-[80] flex h-10 w-10 flex-col items-center justify-center gap-[6px] focus:outline-none"
              aria-label="Toggle menu"
            >
              <motion.span
                animate={isMobileMenuOpen ? { rotate: 45, y: 8.5 } : { rotate: 0, y: 0 }}
                className="h-[2px] w-6 bg-current transition-colors"
                style={{ originX: "50%", originY: "50%" }}
              />
              <motion.span
                animate={isMobileMenuOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                className="h-[2px] w-6 bg-current transition-colors"
              />
              <motion.span
                animate={isMobileMenuOpen ? { rotate: -45, y: -8.5 } : { rotate: 0, y: 0 }}
                className="h-[2px] w-6 bg-current transition-colors"
                style={{ originX: "50%", originY: "50%" }}
              />
            </button>
            <Link href="/" className="transition-opacity hover:opacity-80">
              <img src="/images/logo.webp" alt="Logo" className="h-10 md:h-12 w-auto object-contain dark:brightness-0 dark:invert" />
            </Link>
          </div>

          <nav className="hidden md:flex items-center bg-gray-50 dark:bg-muted/50 rounded-full px-2 py-1 space-x-1">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${
                  location === item.href
                    ? "bg-white dark:bg-background shadow-sm"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <SearchBar />

            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 dark:hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
            >
              {theme === "light" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {isAuthenticated && user && (
              <button
                type="button"
                title="Admin Dashboard"
                onClick={() => setLocation(dashboardPath)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 dark:hover:bg-muted transition-colors"
              >
                <LayoutDashboard className="w-5 h-5 text-emerald-500" />
              </button>
            )}

            {cartItemsCount > 0 && (
              <Link
                href="/cart"
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 dark:hover:bg-muted transition-colors relative"
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-bold">
                  {cartItemsCount}
                </span>
              </Link>
            )}

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt={user.name || user.email}
                    className="w-8 h-8 rounded-full object-cover border-2 border-black/10 dark:border-white/10"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center text-xs font-semibold">
                    {initials}
                  </div>
                )}
                {user.role !== "admin" && user.role !== "staff" && (
                  <button
                    onClick={() => logout()}
                    className="hidden sm:inline text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                  >
                    Logout
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-white dark:bg-neutral-950 z-[70] shadow-2xl p-8 pt-24 flex flex-col"
            >
              <nav className="flex flex-col space-y-2 mb-12">
                {navLinks.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + (i * 0.05) }}
                  >
                    <Link
                      href={item.href}
                      className={`block px-6 py-4 rounded-full text-lg font-bold tracking-tight transition-all ${
                        location === item.href
                          ? "bg-black text-white dark:bg-white dark:text-black scale-[1.02] shadow-lg"
                          : "text-muted-foreground hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-primary"
                      }`}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <div className="mt-auto space-y-6 border-t pt-8 border-gray-100 dark:border-neutral-900">
                {!isAuthenticated ? null : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-col space-y-4"
                  >
                    <div className="flex flex-col gap-4 p-4 bg-gray-50 dark:bg-neutral-900 rounded-3xl border border-gray-100 dark:border-neutral-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {user?.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt={user?.name || user?.email}
                              className="w-12 h-12 rounded-full object-cover border-2 border-black/10 dark:border-white/10 shadow-inner"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center text-sm font-bold shadow-inner">
                              {initials}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-black truncate max-w-[140px] tracking-tight">
                              {user?.name || user?.email}
                            </span>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">
                              {user?.role}
                            </span>
                          </div>
                        </div>
                        {user && (
                          <button
                            onClick={() => setLocation(dashboardPath)}
                            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white dark:bg-neutral-800 shadow-sm border border-gray-100 dark:border-neutral-700 hover:scale-105 active:scale-95 transition-transform"
                            title="Admin Dashboard"
                          >
                            <LayoutDashboard className="w-5 h-5 text-emerald-500" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => logout()}
                        className="w-full h-12 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-[10px] uppercase font-black tracking-[0.2em] transition-all shadow-lg shadow-red-500/20 active:scale-95"
                      >
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="flex justify-between items-center px-4">
                  <div className="flex flex-col">
                    <p className="text-[9px] uppercase tracking-[0.4em] font-black text-gray-400 mb-1">
                      Elite Craftsmanship
                    </p>
                    <p className="text-[9px] uppercase tracking-[0.4em] font-black text-gray-300">
                      Rare Atelier &copy; 2025
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 dark:bg-neutral-900 hover:scale-105 transition-transform"
                    >
                      {theme === "light" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
