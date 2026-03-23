import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";

import Navbar from "@/components/layout/Navbar";
import AdminLayout from "@/components/layout/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import React, { lazy, Suspense, useCallback, useEffect, useState, startTransition } from "react";
import Home from "@/pages/storefront/Home";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import Footer from "@/components/layout/Footer";
import { TopLoadingBar } from "@/components/layout/TopLoadingBar";
import { fetchCategories, fetchProducts } from "@/lib/api";

const loadProductsPage = () => import("@/pages/storefront/Products");
const loadProductDetailPage = () => import("@/pages/storefront/ProductDetail");
const loadNewCollectionPage = () => import("@/pages/storefront/NewCollection");
const loadContactPage = () => import("@/pages/storefront/Contact");
const loadCartPage = () => import("@/pages/storefront/Cart");
const loadCheckoutPage = () => import("@/pages/storefront/Checkout");
const loadPaymentProcessPage = () => import("@/pages/storefront/PaymentProcess");
const loadOrderSuccessPage = () => import("@/pages/storefront/OrderSuccess");
const loadAdminDashboardPage = () => import("@/pages/admin/Dashboard");
const loadAdminProductsPage = () => import("@/pages/admin/Products");
const loadAdminOrdersPage = () => import("@/pages/admin/Orders");
const loadAdminBillsPage = () => import("@/pages/admin/Bills");
const loadAdminCustomersPage = () => import("@/pages/admin/Customers");
const loadAdminStoreUsersPage = () => import("@/pages/admin/StoreUsers");
const loadAdminPOSPage = () => import("@/pages/admin/POS");
const loadAdminAnalyticsPage = () => import("@/pages/admin/Analytics");
const loadAdminPromoCodesPage = () => import("@/pages/admin/PromoCodes");
const loadAdminMarketingPage = () => import("@/pages/admin/Marketing");
const loadAdminLogsPage = () => import("@/pages/admin/Logs");
const loadAdminProfilePage = () => import("@/pages/admin/Profile");
const loadAdminNotificationsPage = () => import("@/pages/admin/Notifications");
const loadAdminLandingPageManagerPage = () => import("@/pages/admin/LandingPageManager");
const loadAdminImagesPage = () => import("@/pages/admin/Images");
const loadAdminStorefrontImagesPage = () => import("@/pages/admin/StorefrontImagePicker");
const loadLoginPage = () => import("@/pages/auth/Login");
const loadNotFoundPage = () => import("@/pages/not-found");
const loadLegalPlaceholderPage = () => import("@/pages/storefront/LegalPlaceholder");

const Products = lazy(loadProductsPage);
const ProductDetail = lazy(loadProductDetailPage);
const NewCollection = lazy(loadNewCollectionPage);
const Contact = lazy(loadContactPage);
const Cart = lazy(loadCartPage);
const Checkout = lazy(loadCheckoutPage);
const PaymentProcess = lazy(loadPaymentProcessPage);
const OrderSuccess = lazy(loadOrderSuccessPage);
const AdminDashboard = lazy(loadAdminDashboardPage);
const AdminProducts = lazy(loadAdminProductsPage);
const AdminOrders = lazy(loadAdminOrdersPage);
const AdminBills = lazy(loadAdminBillsPage);
const AdminCustomers = lazy(loadAdminCustomersPage);
const AdminStoreUsers = lazy(loadAdminStoreUsersPage);
const AdminPOS = lazy(loadAdminPOSPage);
const AdminAnalytics = lazy(loadAdminAnalyticsPage);
const AdminPromoCodes = lazy(loadAdminPromoCodesPage);
const AdminMarketing = lazy(loadAdminMarketingPage);
const AdminLogs = lazy(loadAdminLogsPage);
const AdminProfilePage = lazy(loadAdminProfilePage);
const AdminNotifications = lazy(loadAdminNotificationsPage);
const AdminLandingPageManager = lazy(loadAdminLandingPageManagerPage);
const AdminImages = lazy(loadAdminImagesPage);
const AdminStorefrontImages = lazy(loadAdminStorefrontImagesPage);
const LoginPage = lazy(loadLoginPage);
const NotFound = lazy(loadNotFoundPage);
const LegalPlaceholder = lazy(loadLegalPlaceholderPage);

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

  if (cleanPath === "/" || cleanPath === "") return Promise.resolve();
  if (cleanPath === "/products" || cleanPath === "/shop") return loadProductsPage();
  if (cleanPath.startsWith("/product/")) return loadProductDetailPage();
  if (cleanPath === "/new-collection") return loadNewCollectionPage();
  if (cleanPath === "/atelier" || cleanPath === "/contact") return loadContactPage();
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
  if (cleanPath === "/admin/products") return loadAdminProductsPage();
  if (cleanPath === "/admin/orders") return loadAdminOrdersPage();
  if (cleanPath === "/admin/customers") return loadAdminCustomersPage();
  if (cleanPath === "/admin/store-users") return loadAdminStoreUsersPage();
  if (cleanPath === "/admin/bills") return loadAdminBillsPage();
  if (cleanPath === "/admin/pos") return loadAdminPOSPage();
  if (cleanPath === "/admin/images") return loadAdminImagesPage();
  if (cleanPath === "/admin/storefront-images") return loadAdminStorefrontImagesPage();
  if (cleanPath === "/admin/notifications") return loadAdminNotificationsPage();
  if (cleanPath === "/admin/landing-page") return loadAdminLandingPageManagerPage();
  if (cleanPath === "/admin/login") return loadLoginPage();
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
        queryFn: () => fetchProducts({ page: 1 }),
      }),
    ]);
  }

  return Promise.resolve();
}

async function preloadRouteBeforeNavigate(path: string): Promise<void> {
  const PRELOAD_TIMEOUT_MS = 2500;
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
  // Finish the pre-loader when the main app layout has mounted
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).finishLoading) {
      // Small timeout to allow the layout to fully render first
      setTimeout(() => {
        (window as any).finishLoading();
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-200 ease-in-out">
      <Navbar />
      <main className="flex-1 flex flex-col transition-colors duration-200 ease-in-out">
        {children}
      </main>
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

  if (user && (user.role === "admin" || user.role === "staff")) {
    return <Redirect to="/admin" />;
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
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/profile">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminProfilePage />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/analytics">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminAnalytics />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/marketing">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminMarketing />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/logs">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminLogs />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/promo-codes">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminPromoCodes />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/products">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminProducts />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/orders">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminOrders />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/customers">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminCustomers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/store-users">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminStoreUsers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/bills">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminBills />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/pos">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminPOS />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/images">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminImages />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/storefront-images">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminStorefrontImages />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/notifications">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminNotifications />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/landing-page">
        <ProtectedRoute requireAdmin>
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
      <Route path="/contact">
        <Redirect to="/atelier" />
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
      
      <Route component={NotFound} />
    </Switch>
  );
}

function RouterShell({
  routeTransitioning,
  setRouteTransitioning,
}: {
  routeTransitioning: boolean;
  setRouteTransitioning: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [location] = useLocation();
  const pathname = location.split("?")[0];

  useEffect(() => {
    if (routeTransitioning) {
      setRouteTransitioning(false);
    }
  }, [pathname, routeTransitioning, setRouteTransitioning]);

  return (
    <>
      <TopLoadingBar isLoading={routeTransitioning} />
      <div
        className={
          routeTransitioning
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

function App() {
  const [routeTransitioning, setRouteTransitioning] = useState(false);

  const aroundNav = useCallback(
    (
      navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => void,
      to: string,
      options?: { replace?: boolean; state?: unknown },
    ) => {
      setRouteTransitioning(true);
      void preloadRouteBeforeNavigate(to)
        .catch(() => undefined)
        .finally(() => {
          startTransition(() => {
            navigate(to, options);
          });
        });
    },
    [],
  );

  useEffect(() => {
    // Critical warm-up for first Home -> Shop navigation
    void preloadRouteBeforeNavigate("/products");

    const warmup = () => {
      void loadProductsPage();
      void loadProductDetailPage();
      void loadNewCollectionPage();
      void loadContactPage();
      void loadCartPage();
      void loadCheckoutPage();
      void loadAdminDashboardPage();
      void loadAdminProductsPage();
      void loadAdminOrdersPage();
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

    const timeout = globalThis.setTimeout(warmup, 500);
    return () => globalThis.clearTimeout(timeout);
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <WouterRouter aroundNav={aroundNav}>
            <RouterShell
              routeTransitioning={routeTransitioning}
              setRouteTransitioning={setRouteTransitioning}
            />
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
