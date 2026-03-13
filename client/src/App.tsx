import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";

import Navbar from "@/components/layout/Navbar";
import AdminLayout from "@/components/layout/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import { lazy, Suspense, useEffect } from "react";
import Home from "@/pages/storefront/Home";
import { BrandedLoader } from "@/components/ui/BrandedLoader";

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
const AdminPOS = lazy(() => import("@/pages/admin/POS"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminPromoCodes = lazy(() => import("@/pages/admin/PromoCodes"));
const AdminProfilePage = lazy(() => import("@/pages/admin/Profile"));
const AdminNotifications = lazy(() => import("@/pages/admin/Notifications"));

const LoginPage = lazy(() => import("@/pages/auth/Login"));
const NotFound = lazy(() => import("@/pages/not-found"));

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
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <footer className="py-12 border-t mt-auto">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          &copy; 2025 Rare Atelier. All rights reserved.
        </div>
      </footer>
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
      <Route path="/admin/notifications">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminNotifications />
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
      <Route path="/contact">
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
      <Route path="/checkout/success/:id">
        <StorefrontLayout>
          <OrderSuccess />
        </StorefrontLayout>
      </Route>
      <Route path="/admin/login">
        <LoginRoute />
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