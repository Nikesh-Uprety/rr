import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Navbar from "@/components/layout/Navbar";
import AdminLayout from "@/components/layout/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Home from "@/pages/storefront/Home";
import Products from "@/pages/storefront/Products";
import ProductDetail from "@/pages/storefront/ProductDetail";
import Contact from "@/pages/storefront/Contact";
import Cart from "@/pages/storefront/Cart";
import Checkout from "@/pages/storefront/Checkout";
import PaymentProcess from "@/pages/storefront/PaymentProcess";

import AdminProducts from "@/pages/admin/Products";
import AdminOrders from "@/pages/admin/Orders";
import AdminCustomers from "@/pages/admin/Customers";
import AdminPOS from "@/pages/admin/POS";
import AdminAnalytics from "@/pages/admin/Analytics";

import LoginPage from "@/pages/auth/Login";
import NotFound from "@/pages/not-found";

function StorefrontLayout({ children }: { children: React.ReactNode }) {
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

function Router() {
  return (
    <Switch>
      {/* Admin Routes */}
      <Route path="/admin">
        <Redirect to="/admin/analytics" />
      </Route>
      <Route path="/admin/analytics">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminAnalytics />
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
      <Route path="/admin/pos">
        <ProtectedRoute requireAdmin>
          <AdminLayout>
            <AdminPOS />
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
      <Route path="/login">
        <LoginPage />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;