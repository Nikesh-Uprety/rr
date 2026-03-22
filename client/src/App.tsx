import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";

import Navbar from "@/components/layout/Navbar";
import AdminLayout from "@/components/layout/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import React, { lazy, Suspense, useEffect } from "react";
import Home from "@/pages/storefront/Home";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import Footer from "@/components/layout/Footer";
import { TopLoadingBar } from "@/components/layout/TopLoadingBar";

// Lazy load non-critical components
const Products = lazy(() => import("@/pages/storefront/Products"));
const ProductDetail = lazy(() => import("@/pages/storefront/ProductDetail"));
const NewCollection = lazy(() => import("@/pages/storefront/NewCollection"));
const Contact = lazy(() => import("@/pages/storefront/Contact"));
const Cart = lazy(() => import("@/pages/storefront/Cart"));
const Checkout = lazy(() => import("@/pages/storefront/Checkout"));
const PaymentProcess = lazy(() => import("@/pages/storefront/PaymentProcess"));
const OrderSuccess = lazy(() => import("@/pages/storefront/OrderSuccess"));

const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("@/pages/admin/Products"));
const AdminOrders = lazy(() => import("@/pages/admin/Orders"));
const AdminBills = lazy(() => import("@/pages/admin/Bills"));
const AdminCustomers = lazy(() => import("@/pages/admin/Customers"));
const AdminStoreUsers = lazy(() => import("@/pages/admin/StoreUsers"));
const AdminPOS = lazy(() => import("@/pages/admin/POS"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminPromoCodes = lazy(() => import("@/pages/admin/PromoCodes"));
const AdminMarketing = lazy(() => import("@/pages/admin/Marketing"));
const AdminLogs = lazy(() => import("@/pages/admin/Logs"));
const AdminProfilePage = lazy(() => import("@/pages/admin/Profile"));
const AdminNotifications = lazy(() => import("@/pages/admin/Notifications"));
const AdminLandingPageManager = lazy(() => import("@/pages/admin/LandingPageManager"));
const AdminImages = lazy(() => import("@/pages/admin/Images"));
const AdminStorefrontImages = lazy(() => import("@/pages/admin/StorefrontImagePicker"));

const LoginPage = lazy(() => import("@/pages/auth/Login"));
const NotFound = lazy(() => import("@/pages/not-found"));
const LegalPlaceholder = lazy(() => import("@/pages/storefront/LegalPlaceholder"));

function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const pathname = location.split("?")[0];
  const isFetching = useIsFetching();
  const [isRouteChanging, setIsRouteChanging] = React.useState(false);

  React.useEffect(() => {
    setIsRouteChanging(true);
    const timeout = setTimeout(() => setIsRouteChanging(false), 400);
    return () => clearTimeout(timeout);
  }, [pathname]);

  const isLoading = isRouteChanging || isFetching > 0;
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
      <TopLoadingBar isLoading={isLoading} />
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

function Router() {
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

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<div className="fixed inset-0 z-50 bg-background" />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;