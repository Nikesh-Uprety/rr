const ADMIN_PANEL_ROLES = ["superadmin", "owner", "admin", "manager", "csr", "staff"] as const;

export const ADMIN_PAGE_KEYS = [
  "dashboard",
  "profile",
  "messages",
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
  "buckets",
  "storefront-images",
  "landing-page",
] as const;

export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number];
export type AdminPageKey = (typeof ADMIN_PAGE_KEYS)[number];

const FULL_ACCESS_ADMIN_PAGES: readonly AdminPageKey[] = ADMIN_PAGE_KEYS;

const ADMIN_PAGE_ACCESS: Record<AdminPanelRole, readonly AdminPageKey[]> = {
  superadmin: FULL_ACCESS_ADMIN_PAGES,
  owner: FULL_ACCESS_ADMIN_PAGES,
  admin: FULL_ACCESS_ADMIN_PAGES,
  manager: [
    "dashboard",
    "profile",
    "messages",
    "notifications",
    "marketing",
    "products",
    "orders",
    "customers",
    "bills",
    "pos",
    "promo-codes",
    "buckets",
  ],
  staff: [
    "dashboard",
    "profile",
    "messages",
    "notifications",
    "products",
    "orders",
    "customers",
    "bills",
    "pos",
    "promo-codes",
    "buckets",
  ],
  csr: [
    "dashboard",
    "profile",
    "messages",
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

export function normalizeAdminPageKey(page: string | null | undefined): AdminPageKey | null {
  if (!page) return null;
  return ADMIN_PAGE_KEYS.includes(page as AdminPageKey) ? (page as AdminPageKey) : null;
}

export function normalizeAdminPageList(
  pages: Array<string | null | undefined> | null | undefined,
): AdminPageKey[] {
  const normalized = (pages ?? [])
    .map((page) => normalizeAdminPageKey(page))
    .filter((page): page is AdminPageKey => Boolean(page));

  return Array.from(new Set(normalized));
}

export function getAdminAllowedPages(
  role: string | null | undefined,
  additionalPages?: Array<string | null | undefined> | null,
): AdminPageKey[] {
  const normalizedRole = normalizeAdminRole(role);
  const basePages = normalizedRole ? [...ADMIN_PAGE_ACCESS[normalizedRole]] : [];
  const extraPages = normalizeAdminPageList(additionalPages);
  return Array.from(new Set([...basePages, ...extraPages]));
}

export function canAccessAdminPage(
  role: string | null | undefined,
  page: AdminPageKey,
  additionalPages?: Array<string | null | undefined> | null,
): boolean {
  const normalizedRole = normalizeAdminRole(role);
  if (!normalizedRole) return false;
  return getAdminAllowedPages(role, additionalPages).includes(page);
}

export function requiresTwoFactorChallenge(input: {
  twoFactorEnabled?: boolean | number | null;
  requires2FASetup?: boolean | null;
}): boolean {
  return !!input.twoFactorEnabled || !!input.requires2FASetup;
}

export { ADMIN_PANEL_ROLES };
