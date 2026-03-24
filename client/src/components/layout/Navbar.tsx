import { Link, useLocation } from "wouter";
import { ShoppingBag, Sun, Moon, Coffee, LayoutDashboard, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/store/theme";
import { useCartStore } from "@/store/cart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import SearchBar from "./SearchBar";
import { canAccessAdminPanel } from "@shared/auth-policy";
import { getDefaultAdminPath } from "@/lib/adminAccess";

export default function Navbar() {
  const { theme, setTheme } = useThemeStore();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const cartItemsCount = useCartStore((state) =>
    state.items.reduce((acc, item) => acc + item.quantity, 0),
  );
  const { user, isAuthenticated } = useCurrentUser();
  const queryClient = useQueryClient();

  const isStorefront = !location.startsWith("/admin");

  const { mutate: logout } = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  // Close menu on location change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isMobileMenuOpen]);

  if (!isStorefront) return null;

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || (user?.email?.[0] || "U").toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-background border-none">
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-12">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-4">
            {/* Apple-style Animated Hamburger */}
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
            {[
              { name: "Home", href: "/" },
              { name: "Shop", href: "/products" },
              { name: "New Collection", href: "/new-collection" },
              { name: "Atelier", href: "/atelier" },
            ].map((item) => (
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



            {isAuthenticated && user && canAccessAdminPanel(user.role) && (
              <button
                type="button"
                title="Admin Dashboard"
                onClick={() => setLocation(getDefaultAdminPath(user.role))}
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

      {/* Mobile Menu Overlay */}
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
                {[
                  { name: "Home", href: "/" },
                  { name: "Shop", href: "/products" },
                  { name: "New Collection", href: "/new-collection" },
                  { name: "Atelier", href: "/atelier" },
                ].map((item, i) => (
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
                        {canAccessAdminPanel(user?.role) && (
                          <button
                            onClick={() => setLocation(getDefaultAdminPath(user?.role))}
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
