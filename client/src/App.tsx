import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, onlineManager, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";

import Navbar from "@/components/layout/Navbar";
import AdminLayout from "@/components/layout/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getDefaultAdminPath } from "@/lib/adminAccess";
import { canAccessAdminPanel } from "@shared/auth-policy";

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import Footer from "@/components/layout/Footer";
import { TopLoadingBar } from "@/components/layout/TopLoadingBar";
import CartSidebar from "@/components/layout/CartSidebar";
import { fetchCategories, fetchPageConfig, fetchProducts } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import SentryTest from "@/components/SentryTest";
import {
  applyStorefrontFontPreset,
  isStorefrontFontPreset,
} from "@/lib/storefrontFonts";

const loadHomePage = () => import("@/pages/storefront/Home");
const loadProductsPage = () => import("@/pages/storefront/Products");
const loadProductDetailPage = () => import("@/pages/storefront/ProductDetail");
const loadNewCollectionPage = () => import("@/pages/storefront/NewCollection");
const loadAtelierPage = () => import("@/pages/storefront/Contact");
const loadCartPage = () => import("@/pages/storefront/Cart");
const loadCheckoutPage = () => import("@/pages/storefront/Checkout");
const loadPaymentProcessPage = () => import("@/pages/storefront/PaymentProcess");
const loadOrderSuccessPage = () => import("@/pages/storefront/OrderSuccess");
const loadAdminDashboardPage = () => import("@/pages/admin/Dashboard");
const loadAdminProductsPage = () => import("@/pages/admin/Products");
const loadAdminInventoryPage = () => import("@/pages/admin/Inventory");
const loadAdminOrdersPage = () => import("@/pages/admin/Orders");
const loadAdminBillsPage = () => import("@/pages/admin/Bills");
const loadAdminCustomersPage = () => import("@/pages/admin/Customers");
const loadAdminMessagesPage = () => import("@/pages/admin/Messages");
const loadAdminStoreUsersPage = () => import("@/pages/admin/StoreUsers");
const loadAdminStoreUserProfilePage = () => import("@/pages/admin/StoreUserProfile");
const loadAdminPOSPage = () => import("@/pages/admin/POS");
const loadAdminAnalyticsPage = () => import("@/pages/admin/Analytics");
const loadAdminPromoCodesPage = () => import("@/pages/admin/PromoCodes");
const loadAdminMarketingPage = () => import("@/pages/admin/Marketing");
const loadAdminLogsPage = () => import("@/pages/admin/Logs");
const loadAdminProfilePage = () => import("@/pages/admin/Profile");
const loadAdminNotificationsPage = () => import("@/pages/admin/Notifications");
const loadAdminDevFontPage = () => import("@/pages/admin/DevFont");
const loadAdminLandingPageManagerPage = () => import("@/pages/admin/LandingPageManager");
const loadAdminImagesPage = () => import("@/pages/admin/Images");
const loadAdminStorefrontImagesPage = () => import("@/pages/admin/StorefrontImagePicker");
const loadLoginPage = () => import("@/pages/auth/Login");
const loadNotFoundPage = () => import("@/pages/not-found");
const loadLegalPlaceholderPage = () => import("@/pages/storefront/LegalPlaceholder");
const loadViewBillPage = () => import("@/pages/storefront/ViewBill");

const Home = lazy(loadHomePage);
const Products = lazy(loadProductsPage);
const ProductDetail = lazy(loadProductDetailPage);
const NewCollection = lazy(loadNewCollectionPage);
const Contact = lazy(loadAtelierPage);
const Cart = lazy(loadCartPage);
const Checkout = lazy(loadCheckoutPage);
const PaymentProcess = lazy(loadPaymentProcessPage);
const OrderSuccess = lazy(loadOrderSuccessPage);
const AdminDashboard = lazy(loadAdminDashboardPage);
const AdminProducts = lazy(loadAdminProductsPage);
const AdminInventory = lazy(loadAdminInventoryPage);
const AdminOrders = lazy(loadAdminOrdersPage);
const AdminBills = lazy(loadAdminBillsPage);
const AdminCustomers = lazy(loadAdminCustomersPage);
const AdminMessages = lazy(loadAdminMessagesPage);
const AdminStoreUsers = lazy(loadAdminStoreUsersPage);
const AdminStoreUserProfile = lazy(loadAdminStoreUserProfilePage);
const AdminPOS = lazy(loadAdminPOSPage);
const AdminAnalytics = lazy(loadAdminAnalyticsPage);
const AdminPromoCodes = lazy(loadAdminPromoCodesPage);
const AdminMarketing = lazy(loadAdminMarketingPage);
const AdminLogs = lazy(loadAdminLogsPage);
const AdminProfilePage = lazy(loadAdminProfilePage);
const AdminNotifications = lazy(loadAdminNotificationsPage);
const AdminDevFontPage = lazy(loadAdminDevFontPage);
const AdminLandingPageManager = lazy(loadAdminLandingPageManagerPage);
const AdminImages = lazy(loadAdminImagesPage);
const AdminStorefrontImages = lazy(loadAdminStorefrontImagesPage);
const Canvas = lazy(() => import("@/pages/admin/Canvas"));
const CanvasPage = lazy(() => import("@/pages/admin/CanvasPage"));
const DynamicPage = lazy(() => import("@/pages/storefront/DynamicPage"));
const LoginPage = lazy(loadLoginPage);
const NotFound = lazy(loadNotFoundPage);
const LegalPlaceholder = lazy(loadLegalPlaceholderPage);
const ViewBill = lazy(loadViewBillPage);

function RouteSwitchSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border/60 bg-background/90" />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 h-6 w-44 rounded-md bg-muted animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function normalizePath(path: string): string {
  return path.split("?")[0].split("#")[0];
}

function preloadRouteModule(path: string): Promise<unknown> {
  const cleanPath = normalizePath(path);

  if (cleanPath === "/" || cleanPath === "") return loadHomePage();
  if (cleanPath === "/products" || cleanPath === "/shop") return loadProductsPage();
  if (cleanPath.startsWith("/product/")) return loadProductDetailPage();
  if (cleanPath === "/new-collection") return loadNewCollectionPage();
  if (cleanPath === "/atelier") return loadAtelierPage();
  if (cleanPath === "/cart") return loadCartPage();
  if (cleanPath === "/checkout") return loadCheckoutPage();
  if (cleanPath === "/checkout/payment") return loadPaymentProcessPage();
  if (cleanPath.startsWith("/order-confirmation/") || cleanPath.startsWith("/checkout/success/")) {
    return loadOrderSuccessPage();
  }
  if (cleanPath === "/admin") return loadAdminDashboardPage();
  if (cleanPath === "/admin/profile") return loadAdminProfilePage();
  if (cleanPath === "/admin/analytics") return loadAdminAnalyticsPage();
  if (cleanPath === "/admin/marketing") return loadAdminMarketingPage();
  if (cleanPath === "/admin/logs") return loadAdminLogsPage();
  if (cleanPath === "/admin/promo-codes") return loadAdminPromoCodesPage();
  if (cleanPath === "/admin/products" || cleanPath === "/admin/products/new") return loadAdminProductsPage();
  if (cleanPath === "/admin/inventory") return loadAdminInventoryPage();
  if (cleanPath === "/admin/orders") return loadAdminOrdersPage();
  if (cleanPath === "/admin/customers") return loadAdminCustomersPage();
  if (cleanPath === "/admin/messages") return loadAdminMessagesPage();
  if (/^\/admin\/store-users\/[^/]+$/.test(cleanPath)) return loadAdminStoreUserProfilePage();
  if (cleanPath === "/admin/store-users") return loadAdminStoreUsersPage();
  if (cleanPath === "/admin/bills") return loadAdminBillsPage();
  if (cleanPath === "/admin/pos") return loadAdminPOSPage();
  if (cleanPath === "/admin/images") return loadAdminImagesPage();
  if (cleanPath === "/admin/storefront-images") return loadAdminStorefrontImagesPage();
  if (cleanPath === "/admin/notifications") return loadAdminNotificationsPage();
  if (cleanPath === "/admin/dev-font") return loadAdminDevFontPage();
  if (cleanPath === "/admin/landing-page") return loadAdminLandingPageManagerPage();
  if (cleanPath === "/admin/login") return loadLoginPage();
  if (cleanPath.startsWith("/bill/")) return loadViewBillPage();
  if (cleanPath === "/shipping" || cleanPath === "/refund" || cleanPath === "/privacy" || cleanPath === "/terms") {
    return loadLegalPlaceholderPage();
  }

  return loadNotFoundPage();
}

function preloadRouteData(path: string): Promise<unknown> {
  const cleanPath = normalizePath(path);

  if (cleanPath === "/products" || cleanPath === "/shop") {
    return Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["categories"],
        queryFn: fetchCategories,
      }),
      queryClient.prefetchQuery({
        queryKey: [
          "products",
          { category: undefined, search: undefined, sortBy: "newest", page: 1 },
        ],
        queryFn: () => fetchProducts({ page: 1 }).then(r => r.products),
      }),
    ]);
  }

  return Promise.resolve();
}

async function preloadRouteBeforeNavigate(path: string): Promise<void> {
  const PRELOAD_TIMEOUT_MS = 320;
  const preloadTasks = Promise.allSettled([
    preloadRouteModule(path),
    preloadRouteData(path),
  ]).then(() => undefined);

  await Promise.race([
    preloadTasks,
    new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, PRELOAD_TIMEOUT_MS);
    }),
  ]);
}

function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const previewTemplateId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("canvasPreviewTemplateId");
    return rawValue && /^\d+$/.test(rawValue) ? rawValue : null;
  }, []);
  const previewFontPreset = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("canvasFontPreset");
    return isStorefrontFontPreset(rawValue) ? rawValue : null;
  }, []);
  const { data: pageConfig } = useQuery({
    queryKey: ["page-config", previewTemplateId],
    queryFn: () => fetchPageConfig(previewTemplateId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Finish the pre-loader when the main app layout has mounted
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).finishLoading) {
      // Small timeout to allow the layout to fully render first
      setTimeout(() => {
        (window as any).finishLoading();
      }, 40);
    }
  }, []);

  useEffect(() => {
    const effectivePreset = previewFontPreset
      ?? (isStorefrontFontPreset(pageConfig?.fontPreset) ? pageConfig.fontPreset : null);
    applyStorefrontFontPreset(effectivePreset);

    return () => {
      applyStorefrontFontPreset(null);
    };
  }, [pageConfig?.fontPreset, previewFontPreset]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <CartSidebar />
      <Footer />
    </div>
  );
}

function LoginRoute() {
  const { user, isLoading } = useCurrentUser();

  // Authentication check complete

  if (isLoading) {
    return <BrandedLoader fullScreen />;
  }

  if (user && canAccessAdminPanel(user.role)) {
    return <Redirect to={getDefaultAdminPath(user.role, user.adminPageAccess)} />;
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <LoginPage />;
}

function AppRoutes() {
  return (
    <Switch>
      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute requiredAdminPage="dashboard">
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/canvas">
        <ProtectedRoute requiredAdminPage="landing-page">
          <AdminLayout>
            <CanvasPage />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/canvas/legacy">
        <ProtectedRoute requiredAdminPage="landing-page">
          <AdminLayout>
            <Canvas />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/profile">
        <ProtectedRoute requiredAdminPage="profile">
          <AdminLayout>
            <AdminProfilePage />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/analytics">
        <ProtectedRoute requiredAdminPage="analytics">
          <AdminLayout>
            <AdminAnalytics />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/marketing">
        <ProtectedRoute requiredAdminPage="marketing">
          <AdminLayout>
            <AdminMarketing />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/logs">
        <ProtectedRoute requiredAdminPage="logs">
          <AdminLayout>
            <AdminLogs />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/promo-codes">
        <ProtectedRoute requiredAdminPage="promo-codes">
          <AdminLayout>
            <AdminPromoCodes />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/products/new">
        <ProtectedRoute requiredAdminPage="products">
          <AdminLayout>
            <AdminProducts />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/products">
        <ProtectedRoute requiredAdminPage="products">
          <AdminLayout>
            <AdminProducts />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/inventory">
        <ProtectedRoute requiredAdminPage="products">
          <AdminLayout>
            <AdminInventory />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/orders">
        <ProtectedRoute requiredAdminPage="orders">
          <AdminLayout>
            <AdminOrders />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/customers">
        <ProtectedRoute requiredAdminPage="customers">
          <AdminLayout>
            <AdminCustomers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/messages">
        <ProtectedRoute requiredAdminPage="messages">
          <AdminLayout>
            <AdminMessages />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/store-users">
        <ProtectedRoute requiredAdminPage="store-users">
          <AdminLayout>
            <AdminStoreUsers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/store-users/:id">
        <ProtectedRoute requiredAdminPage="store-users">
          <AdminLayout>
            <AdminStoreUserProfile />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/bills">
        <ProtectedRoute requiredAdminPage="bills">
          <AdminLayout>
            <AdminBills />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/pos">
        <ProtectedRoute requiredAdminPage="pos">
          <AdminLayout>
            <AdminPOS />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/images">
        <ProtectedRoute requiredAdminPage="images">
          <AdminLayout>
            <AdminImages />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/storefront-images">
        <ProtectedRoute requiredAdminPage="storefront-images">
          <AdminLayout>
            <AdminStorefrontImages />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/notifications">
        <ProtectedRoute requiredAdminPage="notifications">
          <AdminLayout>
            <AdminNotifications />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/dev-font">
        <ProtectedRoute requiredAdminPage="profile">
          <AdminLayout>
            <AdminDevFontPage />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/landing-page">
        <ProtectedRoute requiredAdminPage="landing-page">
          <AdminLayout>
            <AdminLandingPageManager />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Storefront Routes */}
      <Route path="/">
        <StorefrontLayout>
          <Home />
        </StorefrontLayout>
      </Route>
      <Route path="/products">
        <StorefrontLayout>
          <Products />
        </StorefrontLayout>
      </Route>
      <Route path="/shop">
        <Redirect to="/products" />
      </Route>
      <Route path="/product/:id">
        <StorefrontLayout>
          <ProductDetail />
        </StorefrontLayout>
      </Route>
      <Route path="/new-collection">
        <StorefrontLayout>
          <NewCollection />
        </StorefrontLayout>
      </Route>
      <Route path="/atelier">
        <StorefrontLayout>
          <Contact />
        </StorefrontLayout>
      </Route>
      <Route path="/cart">
        <StorefrontLayout>
          <Cart />
        </StorefrontLayout>
      </Route>
      <Route path="/checkout">
        <StorefrontLayout>
          <Checkout />
        </StorefrontLayout>
      </Route>
      <Route path="/checkout/payment">
        <StorefrontLayout>
          <PaymentProcess />
        </StorefrontLayout>
      </Route>
      <Route path="/order-confirmation/:orderId">
        <StorefrontLayout>
          <OrderSuccess />
        </StorefrontLayout>
      </Route>
      <Route path="/checkout/success/:id">
        <StorefrontLayout>
          <OrderSuccess />
        </StorefrontLayout>
      </Route>
      <Route path="/admin/login">
        <LoginRoute />
      </Route>
      
      {/* Sentry Testing Route */}
      <Route path="/sentry-test">
        <StorefrontLayout>
          <SentryTest />
        </StorefrontLayout>
      </Route>

      {/* Legal Placeholders */}
      <Route path="/shipping">
        <StorefrontLayout>
          <LegalPlaceholder />
        </StorefrontLayout>
      </Route>
      <Route path="/refund">
        <StorefrontLayout>
          <LegalPlaceholder />
        </StorefrontLayout>
      </Route>
      <Route path="/privacy">
        <StorefrontLayout>
          <LegalPlaceholder />
        </StorefrontLayout>
      </Route>
      <Route path="/terms">
        <StorefrontLayout>
          <LegalPlaceholder />
        </StorefrontLayout>
      </Route>

      {/* Public Bill View */}
      <Route path="/bill/:billNumber">
        <ViewBill />
      </Route>
      
      {/* Dynamic Canvas Pages — catch-all, must be before NotFound */}
      <Route path="/*">
        <DynamicPage />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function RouterShell({
  routeTransitioning,
  setRouteTransitioning,
  isCanvasPreview,
}: {
  routeTransitioning: boolean;
  setRouteTransitioning: React.Dispatch<React.SetStateAction<boolean>>;
  isCanvasPreview: boolean;
}) {
  const [location] = useLocation();
  const pathname = location.split("?")[0];

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // Ignore unsupported browser/history cases.
    }

    // Reset scroll consistently on all route changes to prevent browser-restored flashes.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    });
  }, [location]);

  useEffect(() => {
    if (routeTransitioning) {
      setRouteTransitioning(false);
    }
  }, [pathname, routeTransitioning, setRouteTransitioning]);

  return (
    <>
      <TopLoadingBar isLoading={routeTransitioning && !isCanvasPreview} />
      <div
        className={
          routeTransitioning && !isCanvasPreview
            ? "opacity-85 transition-opacity duration-150 ease-out"
            : "opacity-100"
        }
      >
        <Suspense fallback={<RouteSwitchSkeleton />}>
          <AppRoutes />
        </Suspense>
      </div>
    </>
  );
}

const CONNECTIVITY_TOAST_DURATION = 1_000_000;
const CONNECTIVITY_CHECK_INTERVAL_MS = 2500;
const CONNECTIVITY_TIMEOUT_MS = 1500;

function getReconnectProgress(elapsedMs: number) {
  if (elapsedMs <= 1200) return 18 + (elapsedMs / 1200) * 30;
  if (elapsedMs <= 6000) return 48 + ((elapsedMs - 1200) / 4800) * 28;
  return Math.min(92, 76 + ((elapsedMs - 6000) / 9000) * 16);
}

async function probeInternetConnection(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!navigator.onLine) return false;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS);

  try {
    await fetch(`https://www.gstatic.com/generate_204?ts=${Date.now()}`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function ConnectivityToastContent({
  checking,
  progress,
  connected,
}: {
  checking: boolean;
  progress: number;
  connected: boolean;
}) {
  return (
    <div className="mt-2 min-w-[260px] space-y-2">
      <div className="flex items-center gap-2 text-xs leading-relaxed opacity-95">
        {connected ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : checking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        <span>
          {connected
            ? "Internet restored. Syncing the latest data now."
            : checking
              ? "Trying to reconnect and refresh your data."
              : "Database sync and live requests will resume as soon as the internet is back."}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/15">
        <div
          className="h-full rounded-full bg-white/90 transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
        />
      </div>
    </div>
  );
}

function ConnectivityMonitor() {
  const { toast } = useToast();
  const toastRef = React.useRef<ReturnType<typeof toast> | null>(null);
  const offlineSinceRef = React.useRef<number | null>(null);
  const hasBeenOfflineRef = React.useRef(false);
  const dismissTimeoutRef = React.useRef<number | null>(null);
  const [isConnected, setIsConnected] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);

  const dismissToast = useCallback(() => {
    if (dismissTimeoutRef.current !== null) {
      window.clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
    toastRef.current?.dismiss();
    toastRef.current = null;
  }, []);

  const showOrUpdateToast = useCallback(
    (next: { connected: boolean; checking: boolean; progress: number }) => {
      const title = next.connected
        ? "Internet connection restored"
        : "Computer not connected to internet";
      const variant = next.connected ? "success" : "warning";
      const description = (
        <ConnectivityToastContent
          connected={next.connected}
          checking={next.checking}
          progress={next.progress}
        />
      );

      if (!toastRef.current) {
        toastRef.current = toast({
          title,
          description,
          variant,
          duration: CONNECTIVITY_TOAST_DURATION,
        });
        return;
      }

      toastRef.current.update({
        id: toastRef.current.id,
        title,
        description,
        variant,
        duration: CONNECTIVITY_TOAST_DURATION,
      });
    },
    [toast],
  );

  const markOffline = useCallback(
    (checking: boolean) => {
      onlineManager.setOnline(false);
      setIsConnected(false);
      setIsChecking(checking);
      if (offlineSinceRef.current === null) {
        offlineSinceRef.current = performance.now();
        hasBeenOfflineRef.current = true;
      }
      const elapsed = performance.now() - offlineSinceRef.current;
      const nextProgress = getReconnectProgress(elapsed);
      setProgress(nextProgress);
      showOrUpdateToast({ connected: false, checking, progress: nextProgress });
    },
    [showOrUpdateToast],
  );

  const markOnline = useCallback(() => {
    onlineManager.setOnline(true);
    const shouldAnnounceRecovery = hasBeenOfflineRef.current;
    offlineSinceRef.current = null;
    setIsConnected(true);
    setIsChecking(false);
    setProgress(100);
    void queryClient.resumePausedMutations().catch(() => undefined);
    void queryClient.refetchQueries({ type: "active" }).catch(() => undefined);
    if (!shouldAnnounceRecovery) {
      dismissToast();
      setProgress(0);
      return;
    }

    hasBeenOfflineRef.current = false;
    showOrUpdateToast({ connected: true, checking: false, progress: 100 });
    if (dismissTimeoutRef.current !== null) {
      window.clearTimeout(dismissTimeoutRef.current);
    }
    dismissTimeoutRef.current = window.setTimeout(() => {
      dismissToast();
      setProgress(0);
    }, 1400);
  }, [dismissToast, showOrUpdateToast]);

  const verifyConnection = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) {
      markOffline(false);
      return;
    }

    setIsChecking(true);
    if (!isConnected) {
      showOrUpdateToast({ connected: false, checking: true, progress });
    }

    const isReachable = await probeInternetConnection();
    if (isReachable) {
      markOnline();
    } else {
      markOffline(true);
    }
  }, [isConnected, markOffline, markOnline, progress, showOrUpdateToast]);

  useEffect(() => {
    void verifyConnection();

    const handleOffline = () => markOffline(false);
    const handleOnline = () => {
      void verifyConnection();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      dismissToast();
    };
  }, [dismissToast, markOffline, verifyConnection]);

  useEffect(() => {
    if (isConnected) return;

    const progressTimer = window.setInterval(() => {
      if (offlineSinceRef.current === null) return;
      const elapsed = performance.now() - offlineSinceRef.current;
      const nextProgress = getReconnectProgress(elapsed);
      setProgress(nextProgress);
      showOrUpdateToast({ connected: false, checking: isChecking, progress: nextProgress });
    }, 180);

    const reconnectTimer = window.setInterval(() => {
      void verifyConnection();
    }, CONNECTIVITY_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(reconnectTimer);
    };
  }, [isChecking, isConnected, showOrUpdateToast, verifyConnection]);

  return null;
}

function App() {
  const [routeTransitioning, setRouteTransitioning] = useState(false);
  const isCanvasPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("canvasPreviewTemplateId");
  const initialPath =
    typeof window !== "undefined" ? window.location.pathname : "/";

  useEffect(() => {
    // Ensure loader is dismissed for every route family (storefront + admin).
    if (typeof window === "undefined") return;
    const done = (window as { finishLoading?: () => void }).finishLoading;
    if (typeof done !== "function") return;
    const timer = window.setTimeout(() => {
      done();
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  const aroundNav = useCallback(
    (
      navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => void,
      to: string,
      options?: { replace?: boolean; state?: unknown },
    ) => {
      const LOADER_DELAY_MS = 120;
      const loaderTimer = window.setTimeout(() => {
        setRouteTransitioning(true);
      }, LOADER_DELAY_MS);

      void preloadRouteBeforeNavigate(to)
        .catch(() => undefined)
        .finally(() => {
          window.clearTimeout(loaderTimer);
          startTransition(() => {
            navigate(to, options);
          });
        });
    },
    [],
  );

  useEffect(() => {
    if (isCanvasPreview) {
      return;
    }

    // Critical warm-up for first Home -> Shop navigation
    if (!initialPath.startsWith("/admin")) {
      void preloadRouteBeforeNavigate("/products");
    }

    const warmup = () => {
      if (initialPath.startsWith("/admin")) {
        void loadAdminDashboardPage();
        void loadAdminProductsPage();
        void loadAdminInventoryPage();
        void loadAdminOrdersPage();
        void loadAdminProfilePage();
        return;
      }

      void loadProductsPage();
      void loadProductDetailPage();
      void loadNewCollectionPage();
      void loadAtelierPage();
      void loadCartPage();
      void loadCheckoutPage();
    };

    const idleCallback = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    const cancelIdleCallback = (
      globalThis as { cancelIdleCallback?: (id: number) => void }
    ).cancelIdleCallback;

    if (idleCallback) {
      const id = idleCallback(() => warmup());
      return () => cancelIdleCallback?.(id);
    }

    const timeout = globalThis.setTimeout(warmup, initialPath.startsWith("/admin") ? 900 : 1200);
    return () => globalThis.clearTimeout(timeout);
  }, [initialPath, isCanvasPreview]);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <ConnectivityMonitor />
          <WouterRouter aroundNav={aroundNav}>
            <RouterShell
              routeTransitioning={routeTransitioning}
              setRouteTransitioning={setRouteTransitioning}
              isCanvasPreview={isCanvasPreview}
            />
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
