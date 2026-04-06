import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "@/lib/adminAccess";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

function getPageTitle(pathname: string): string | undefined {
  const navItem = ADMIN_NAV_ITEMS.find((item) => item.href === pathname);
  if (navItem) return navItem.label;

  const pathSegments = pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  if (lastSegment) {
    return lastSegment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return undefined;
}

function getInventorySubpageLabel(search: string): string | undefined {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");

  switch (tab) {
    case "inventory":
      return "Inventory";
    case "movements":
      return "Stock Movements";
    case "settings":
      return "Settings";
    case "overview":
    case null:
      return "Inventory Overview";
    default:
      return undefined;
  }
}

function getBreadcrumbs(pathname: string, search: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  breadcrumbs.push({ label: "Dashboard", href: "/admin" });

  if (segments.length <= 1) return breadcrumbs;

  if (pathname === "/admin/inventory") {
    breadcrumbs.push({ label: "Inventory", href: "/admin/inventory" });
    const inventorySubpage = getInventorySubpageLabel(search);
    if (inventorySubpage && inventorySubpage !== "Inventory") {
      breadcrumbs.push({ label: inventorySubpage, isCurrent: true });
    } else {
      breadcrumbs[breadcrumbs.length - 1] = { label: "Inventory", isCurrent: true };
    }
    return breadcrumbs;
  }

  let accumulatedPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    accumulatedPath += `/${segment}`;

    // Skip /admin since we already have "Dashboard" as the first breadcrumb
    if (accumulatedPath === "/admin") continue;

    const navItem = ADMIN_NAV_ITEMS.find((item) => item.href === accumulatedPath);
    const isLast = i === segments.length - 1;

    if (navItem) {
      breadcrumbs.push({
        label: navItem.label,
        href: isLast ? undefined : navItem.href,
        isCurrent: isLast,
      });
    } else if (isLast) {
      const pageTitle = getPageTitle(pathname);
      if (pageTitle) {
        breadcrumbs.push({
          label: pageTitle,
          isCurrent: true,
        });
      }
    }
  }

  return breadcrumbs;
}

export function AdminBreadcrumbs() {
  const [location] = useLocation();
  const pathname = location.split("?")[0];
  const [search, setSearch] = useState(() =>
    typeof window === "undefined" ? "" : window.location.search.replace(/^\?/, ""),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncSearch = () => setSearch(window.location.search.replace(/^\?/, ""));
    const syncSearchFromEvent = (event: Event) => {
      const nextTab = (event as CustomEvent<{ tab?: string }>).detail?.tab;
      if (nextTab && nextTab !== "overview") {
        setSearch(`tab=${nextTab}`);
        return;
      }
      if (nextTab === "overview") {
        setSearch("");
        return;
      }
      syncSearch();
    };

    syncSearch();
    window.addEventListener("popstate", syncSearch);
    window.addEventListener("admin-inventory-tab-change", syncSearchFromEvent as EventListener);

    return () => {
      window.removeEventListener("popstate", syncSearch);
      window.removeEventListener("admin-inventory-tab-change", syncSearchFromEvent as EventListener);
    };
  }, [pathname]);

  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname, search), [pathname, search]);

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          )}
          {crumb.href && !crumb.isCurrent ? (
            <Link
              href={crumb.href}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {index === 0 && <Home className="h-3 w-3" />}
              <span className="truncate max-w-[120px]">{crumb.label}</span>
            </Link>
          ) : (
            <span
              className={cn(
                "font-medium truncate max-w-[160px]",
                crumb.isCurrent
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
