const ADMIN_PANEL_ROLES = ["owner", "admin", "manager", "csr", "staff"] as const;

export const ADMIN_PAGE_KEYS = [
  "dashboard",
  "profile",
  "notifications",
  "analytics",
  "marketing",
  "logs",
  "products",
  "orders",
  "customers",
  "store-users",
  "bills",
  "pos",
  "promo-codes",
  "images",
  "storefront-images",
  "landing-page",
] as const;

export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number];
export type AdminPageKey = (typeof ADMIN_PAGE_KEYS)[number];

const FULL_ACCESS_ADMIN_PAGES: readonly AdminPageKey[] = ADMIN_PAGE_KEYS;

const ADMIN_PAGE_ACCESS: Record<AdminPanelRole, readonly AdminPageKey[]> = {
  owner: FULL_ACCESS_ADMIN_PAGES,
  admin: FULL_ACCESS_ADMIN_PAGES,
  manager: [
    "dashboard",
    "profile",
    "notifications",
    "marketing",
    "products",
    "orders",
    "customers",
    "bills",
    "pos",
    "promo-codes",
  ],
  staff: [
    "dashboard",
    "profile",
    "notifications",
    "products",
    "orders",
    "customers",
    "bills",
    "pos",
    "promo-codes",
  ],
  csr: [
    "dashboard",
    "profile",
    "notifications",
    "orders",
    "customers",
    "bills",
  ],
};

export function normalizeAdminRole(role: string | null | undefined): AdminPanelRole | null {
  if (!role) return null;
  const normalized = role.toLowerCase() as AdminPanelRole;
  return ADMIN_PANEL_ROLES.includes(normalized) ? normalized : null;
}

export function canAccessAdminPanel(role: string | null | undefined): boolean {
  return normalizeAdminRole(role) !== null;
}

export function getAdminAllowedPages(role: string | null | undefined): AdminPageKey[] {
  const normalizedRole = normalizeAdminRole(role);
  return normalizedRole ? [...ADMIN_PAGE_ACCESS[normalizedRole]] : [];
}

export function canAccessAdminPage(
  role: string | null | undefined,
  page: AdminPageKey,
): boolean {
  const normalizedRole = normalizeAdminRole(role);
  if (!normalizedRole) return false;
  return ADMIN_PAGE_ACCESS[normalizedRole].includes(page);
}

export function requiresTwoFactorChallenge(input: {
  twoFactorEnabled?: boolean | number | null;
  requires2FASetup?: boolean | null;
}): boolean {
  return !!input.twoFactorEnabled || !!input.requires2FASetup;
}

export { ADMIN_PANEL_ROLES };
