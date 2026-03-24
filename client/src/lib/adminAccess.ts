import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  CreditCard,
  Images,
  LayoutGrid,
  Megaphone,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Tags,
  User,
  Users,
  ChevronsLeftRight,
} from "lucide-react";
import {
  canAccessAdminPage,
  canAccessAdminPanel,
  getAdminAllowedPages,
  normalizeAdminRole,
  type AdminPageKey,
} from "@shared/auth-policy";

export interface AdminNavItem {
  page: AdminPageKey;
  href: string;
  label: string;
  type: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { page: "dashboard", href: "/admin", icon: LayoutGrid, label: "Dashboard", type: "system" },
  { page: "analytics", href: "/admin/analytics", icon: BarChart, label: "Analytics", type: "analytics" },
  { page: "products", href: "/admin/products", icon: Package, label: "Products", type: "product" },
  { page: "orders", href: "/admin/orders", icon: ShoppingBag, label: "Orders", type: "order" },
  { page: "pos", href: "/admin/pos", icon: CreditCard, label: "Point of Sale", type: "pos" },
  { page: "bills", href: "/admin/bills", icon: Receipt, label: "Bills", type: "bill" },
  { page: "customers", href: "/admin/customers", icon: User, label: "Customers", type: "customer" },
  { page: "store-users", href: "/admin/store-users", icon: Users, label: "Store Users", type: "team" },
  { page: "promo-codes", href: "/admin/promo-codes", icon: Tags, label: "Promo Codes", type: "promo" },
  { page: "marketing", href: "/admin/marketing", icon: Megaphone, label: "Marketing", type: "marketing" },
  { page: "images", href: "/admin/images", icon: Images, label: "Images", type: "media" },
  {
    page: "storefront-images",
    href: "/admin/storefront-images",
    icon: Settings,
    label: "Storefront Images",
    type: "system",
  },
  {
    page: "landing-page",
    href: "/admin/landing-page",
    icon: ChevronsLeftRight,
    label: "Landing Page",
    type: "system",
  },
];

const ADMIN_ROUTE_BY_PAGE: Record<AdminPageKey, string> = {
  dashboard: "/admin",
  profile: "/admin/profile",
  notifications: "/admin/notifications",
  analytics: "/admin/analytics",
  marketing: "/admin/marketing",
  logs: "/admin/logs",
  products: "/admin/products",
  orders: "/admin/orders",
  customers: "/admin/customers",
  "store-users": "/admin/store-users",
  bills: "/admin/bills",
  pos: "/admin/pos",
  "promo-codes": "/admin/promo-codes",
  images: "/admin/images",
  "storefront-images": "/admin/storefront-images",
  "landing-page": "/admin/landing-page",
};

const ADMIN_DEFAULT_PAGE_ORDER: AdminPageKey[] = [
  "dashboard",
  "orders",
  "pos",
  "bills",
  "customers",
  "products",
  "promo-codes",
  "marketing",
  "analytics",
  "store-users",
  "images",
  "storefront-images",
  "landing-page",
  "notifications",
  "profile",
  "logs",
];

export function getAdminNavigation(role: string | null | undefined): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => canAccessAdminPage(role, item.page));
}

export function getDefaultAdminPath(role: string | null | undefined): string {
  if (!canAccessAdminPanel(role)) {
    return "/";
  }

  for (const page of ADMIN_DEFAULT_PAGE_ORDER) {
    if (canAccessAdminPage(role, page)) {
      return ADMIN_ROUTE_BY_PAGE[page];
    }
  }

  return "/admin/profile";
}

export function getRoleLabel(role: string | null | undefined): string {
  const normalizedRole = normalizeAdminRole(role);
  switch (normalizedRole) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "csr":
      return "CSR";
    case "staff":
      return "Staff";
    default:
      return "Customer";
  }
}

export function getAdminRedirectPath(
  role: string | null | undefined,
  requiredPage?: AdminPageKey,
): string {
  if (!canAccessAdminPanel(role)) {
    return "/";
  }

  if (requiredPage && canAccessAdminPage(role, requiredPage)) {
    return ADMIN_ROUTE_BY_PAGE[requiredPage];
  }

  const allowedPages = getAdminAllowedPages(role);
  if (allowedPages.includes("dashboard")) {
    return ADMIN_ROUTE_BY_PAGE.dashboard;
  }

  return getDefaultAdminPath(role);
}
