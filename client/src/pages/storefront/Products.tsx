import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import {
  fetchCategories,
  fetchPageConfig,
  fetchProducts,
  type CategoryApi,
  type ProductApi,
} from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { useThemeStore } from "@/store/theme";
import { StorefrontSeo } from "@/components/seo/StorefrontSeo";
import {
  getStorefrontProductsCategoryLayout,
  normalizeStorefrontProductsLayoutConfig,
  STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY,
  type StorefrontProductsLayoutConfig,
} from "@shared/storefrontProductsLayout";

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
}

const COLOR_NAME_SWATCHES: Record<string, string> = {
  black: "#111111",
  white: "#f5f5f5",
  cream: "#f2eadf",
  ivory: "#fff8e7",
  beige: "#d8c3a5",
  tan: "#c19a6b",
  brown: "#7a5a43",
  mocha: "#7b5b45",
  chocolate: "#5d3a1a",
  camel: "#c19a6b",
  grey: "#7c7c7c",
  gray: "#7c7c7c",
  charcoal: "#36454f",
  silver: "#bfc5cc",
  blue: "#2548b1",
  navy: "#1f2a44",
  "navy blue": "#1f2a44",
  royal: "#4169e1",
  "royal blue": "#4169e1",
  sky: "#76b5ff",
  "sky blue": "#76b5ff",
  baby: "#a9d6ff",
  "baby blue": "#a9d6ff",
  teal: "#0f766e",
  turquoise: "#40e0d0",
  green: "#2f7d32",
  olive: "#556b2f",
  sage: "#9caf88",
  mint: "#98ff98",
  red: "#c62828",
  maroon: "#6b1f2a",
  burgundy: "#6d213c",
  wine: "#722f37",
  pink: "#f7a6ec",
  blush: "#e8b4b8",
  rose: "#e11d48",
  purple: "#7c3aed",
  lavender: "#b497d6",
  lilac: "#c8a2c8",
  yellow: "#facc15",
  mustard: "#d4a017",
  orange: "#f97316",
  gold: "#c9a84c",
};

const DESKTOP_GRID_CLASS_NAMES: Record<number, string> = {
  2: "lg:grid-cols-2 xl:grid-cols-2",
  3: "lg:grid-cols-3 xl:grid-cols-3",
  4: "lg:grid-cols-4 xl:grid-cols-4",
  5: "lg:grid-cols-5 xl:grid-cols-5",
  6: "lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6",
};

function resolveNamedColorSwatch(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return null;
  return COLOR_NAME_SWATCHES[normalized] ?? null;
}

function parseColorOption(value: string): { label: string; swatch: string | null } {
  const trimmed = value.trim();
  const hexMatch = trimmed.match(
    /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/,
  );
  const label = trimmed
    .replace(
      /\(\s*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\s*\)/g,
      "",
    )
    .replace(/\|\s*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/g, "")
    .trim();

  return {
    label: label || trimmed,
    swatch: hexMatch?.[0] ?? resolveNamedColorSwatch(label || trimmed),
  };
}

function normalizeColorLabel(value: string | null | undefined): string {
  return parseColorOption(value ?? "").label.trim().toLowerCase();
}

function normalizeCategoryToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[_\s-]+/g, "");
}

function resolveProductCategoryKey(
  product: ProductApi,
  categories: CategoryApi[],
): string {
  const rawCategory = (product.category ?? "").trim();
  if (!rawCategory) return STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY;

  const normalized = normalizeCategoryToken(rawCategory);
  const matchedCategory = categories.find((category) => {
    const normalizedSlug = normalizeCategoryToken(category.slug);
    const normalizedName = normalizeCategoryToken(category.name);
    return normalizedSlug === normalized || normalizedName === normalized;
  });

  return matchedCategory?.slug ?? rawCategory;
}

function getHoverImage(product: ProductApi): string {
  const gallery = parseJsonArray(product.galleryUrls);
  const main = product.imageUrl ?? "";
  if (gallery.length === 0) return main;
  if (gallery[0] && gallery[0] !== main) return gallery[0];
  return (gallery[1] ?? main) as string;
}

function readShopSearchParams() {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    page: Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1),
    category:
      searchParams.get("category")?.trim() ||
      STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY,
  };
}

async function fetchAllStorefrontProducts(): Promise<ProductApi[]> {
  const limit = 120;
  const firstPage = await fetchProducts({ page: 1, limit });
  const totalPages = Math.max(1, Math.ceil((firstPage.total ?? 0) / limit));

  if (totalPages <= 1) {
    return firstPage.products;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchProducts({
        page: index + 2,
        limit,
      }),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((pageResult) => pageResult.products);
}

function orderProductsForLayout(
  products: ProductApi[],
  layoutConfig: StorefrontProductsLayoutConfig,
  categoryKey: string,
): ProductApi[] {
  const categoryLayout = getStorefrontProductsCategoryLayout(
    layoutConfig,
    categoryKey,
  );
  const featuredIds = categoryLayout.featuredProductIds;

  if (featuredIds.length === 0) return products;

  const productMap = new Map(products.map((product) => [product.id, product]));
  const featured = featuredIds
    .map((productId) => productMap.get(productId))
    .filter((product): product is ProductApi => Boolean(product));
  const featuredIdSet = new Set(featured.map((product) => product.id));
  const remaining = products.filter((product) => !featuredIdSet.has(product.id));
  return [...featured, ...remaining];
}

export default function Products() {
  const initialState = readShopSearchParams();
  const [page, setPage] = useState(initialState.page);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(
    initialState.category,
  );
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [selectedCardColors, setSelectedCardColors] = useState<
    Record<string, string>
  >({});
  const [hoveredCardColors, setHoveredCardColors] = useState<
    Record<string, string | null>
  >({});
  const categoryCloseTimerRef = useRef<number | null>(null);
  const { theme, setTheme } = useThemeStore();
  const forcedThemeRef = useRef<Parameters<typeof setTheme>[0] | null>(null);
  const isDarkTheme = theme === "dark";

  const previewTemplateId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get(
      "canvasPreviewTemplateId",
    );
    return rawValue && /^\d+$/.test(rawValue) ? rawValue : null;
  }, []);

  const { data: pageConfig } = useQuery({
    queryKey: ["page-config", previewTemplateId],
    queryFn: () => fetchPageConfig(previewTemplateId),
    staleTime: previewTemplateId !== null ? 0 : 5 * 60 * 1000,
    refetchOnMount: previewTemplateId !== null ? "always" : false,
    refetchOnWindowFocus: previewTemplateId !== null,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: allProducts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["products", "storefront-layout-catalog"],
    queryFn: fetchAllStorefrontProducts,
    staleTime: 1000 * 60 * 5,
  });

  const layoutConfig = useMemo(
    () =>
      normalizeStorefrontProductsLayoutConfig(pageConfig?.productsPageConfig ?? {}),
    [pageConfig?.productsPageConfig],
  );

  const templateSlug = pageConfig?.template?.slug ?? null;
  const isStuffyClone = templateSlug === "stuffyclone";
  const isRareDarkLuxury = templateSlug === "rare-dark-luxury";

  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, ProductApi[]>();
    grouped.set(STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY, allProducts);

    allProducts.forEach((product) => {
      const categoryKey = resolveProductCategoryKey(product, categories);
      const existing = grouped.get(categoryKey) ?? [];
      existing.push(product);
      grouped.set(categoryKey, existing);
    });

    return grouped;
  }, [allProducts, categories]);

  const categoryMenuOptions = useMemo(() => {
    const options = [
      {
        key: STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY,
        label: "All products",
        count: allProducts.length,
      },
    ];

    categories.forEach((category) => {
      const count = (productsByCategory.get(category.slug) ?? []).length;
      if (count === 0) return;

      const categoryLayout = getStorefrontProductsCategoryLayout(
        layoutConfig,
        category.slug,
      );
      if (!categoryLayout.showInMenu) return;

      options.push({
        key: category.slug,
        label: category.name,
        count,
      });
    });

    return options;
  }, [allProducts.length, categories, layoutConfig, productsByCategory]);

  useEffect(() => {
    if (!layoutConfig.showCategoryMenu) {
      setSelectedCategoryKey(STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY);
      return;
    }

    const isAvailable = categoryMenuOptions.some(
      (option) => option.key === selectedCategoryKey,
    );
    if (!isAvailable) {
      setSelectedCategoryKey(STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY);
    }
  }, [
    categoryMenuOptions,
    layoutConfig.showCategoryMenu,
    selectedCategoryKey,
  ]);

  const baseProducts = useMemo(() => {
    if (
      !layoutConfig.showCategoryMenu ||
      selectedCategoryKey === STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY
    ) {
      return allProducts;
    }

    return productsByCategory.get(selectedCategoryKey) ?? [];
  }, [
    allProducts,
    layoutConfig.showCategoryMenu,
    productsByCategory,
    selectedCategoryKey,
  ]);

  const orderedProducts = useMemo(
    () => orderProductsForLayout(baseProducts, layoutConfig, selectedCategoryKey),
    [baseProducts, layoutConfig, selectedCategoryKey],
  );

  const currentCategoryLayout = useMemo(
    () => getStorefrontProductsCategoryLayout(layoutConfig, selectedCategoryKey),
    [layoutConfig, selectedCategoryKey],
  );

  const desktopColumns =
    selectedCategoryKey === STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY
      ? layoutConfig.defaultDesktopColumns
      : currentCategoryLayout.desktopColumns;
  const pageSize = Math.max(8, desktopColumns * 4);
  const totalProducts = orderedProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));

  useEffect(() => {
    setPage(1);
  }, [selectedCategoryKey, desktopColumns]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return orderedProducts.slice(start, start + pageSize);
  }, [orderedProducts, page, pageSize]);

  const desktopGridClassName =
    DESKTOP_GRID_CLASS_NAMES[desktopColumns] ?? DESKTOP_GRID_CLASS_NAMES[4];
  const activeCategoryLabel =
    categoryMenuOptions.find((option) => option.key === selectedCategoryKey)?.label ??
    "All products";

  const shopPath = useMemo(() => {
    if (typeof window === "undefined") return "/products";

    const currentSearch = new URLSearchParams(window.location.search);
    const nextParams = new URLSearchParams();
    const previewTemplate = currentSearch.get("canvasPreviewTemplateId");
    const previewFontPreset = currentSearch.get("canvasFontPreset");

    if (previewTemplate) nextParams.set("canvasPreviewTemplateId", previewTemplate);
    if (previewFontPreset) nextParams.set("canvasFontPreset", previewFontPreset);
    if (
      layoutConfig.showCategoryMenu &&
      selectedCategoryKey !== STOREFRONT_PRODUCTS_ALL_CATEGORY_KEY
    ) {
      nextParams.set("category", selectedCategoryKey);
    }
    if (page > 1) {
      nextParams.set("page", String(page));
    }

    return nextParams.toString()
      ? `/products?${nextParams.toString()}`
      : "/products";
  }, [layoutConfig.showCategoryMenu, page, selectedCategoryKey]);

  useEffect(() => {
    window.history.replaceState(window.history.state, "", shopPath);
  }, [shopPath]);

  useEffect(() => {
    return () => {
      if (categoryCloseTimerRef.current) {
        window.clearTimeout(categoryCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRareDarkLuxury) {
      if (theme !== "dark") {
        if (forcedThemeRef.current == null) {
          forcedThemeRef.current = theme;
        }
        setTheme("dark");
      }
      return;
    }

    if (forcedThemeRef.current && theme !== forcedThemeRef.current) {
      const previousTheme = forcedThemeRef.current;
      forcedThemeRef.current = null;
      setTheme(previousTheme);
    }
  }, [isRareDarkLuxury, setTheme, theme]);

  const clearCategoryCloseTimer = () => {
    if (categoryCloseTimerRef.current) {
      window.clearTimeout(categoryCloseTimerRef.current);
      categoryCloseTimerRef.current = null;
    }
  };

  const queueCategoryMenuClose = () => {
    clearCategoryCloseTimer();
    categoryCloseTimerRef.current = window.setTimeout(() => {
      setCategoryMenuOpen(false);
    }, 180);
  };

  return (
    <div
      className="min-h-screen w-full pb-16 pt-[4.5rem] transition-colors duration-300 sm:pt-[5rem]"
      data-shop-theme={isDarkTheme ? "dark" : "light"}
      style={{
        backgroundColor: isDarkTheme ? "#050506" : "#ffffff",
        color: isDarkTheme ? "#f5f5f5" : "#111111",
      }}
    >
      <style>{`
        [data-shop-theme="dark"] {
          background: #050506;
          color: #f5f5f5;
        }

        [data-shop-theme="dark"] .shop-page-surface {
          background: #050506;
        }

        [data-shop-theme="dark"] .shop-page-content {
          color: #f5f5f5;
        }

        [data-shop-theme="dark"] .shop-category-divider {
          border-color: rgba(255,255,255,0.12);
        }

        [data-shop-theme="dark"] .shop-category-trigger {
          border-color: rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.04);
          color: #f5f5f5;
          box-shadow: 0 18px 40px rgba(0,0,0,0.28);
        }

        [data-shop-theme="dark"] .shop-category-trigger:hover {
          border-color: rgba(255,255,255,0.28);
          box-shadow: 0 22px 48px rgba(0,0,0,0.34);
        }

        [data-shop-theme="dark"] .shop-category-panel {
          border-color: rgba(255,255,255,0.12);
          background: rgba(10,10,12,0.94);
          box-shadow: 0 28px 68px rgba(0,0,0,0.42);
        }

        [data-shop-theme="dark"] .shop-category-option {
          color: rgba(255,255,255,0.72);
        }

        [data-shop-theme="dark"] .shop-category-option:hover {
          background: rgba(255,255,255,0.06);
          color: #ffffff;
        }

        [data-shop-theme="dark"] .shop-category-option[data-active="true"] {
          background: #ffffff;
          color: #111111;
        }

        [data-shop-theme="dark"] .shop-category-count {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.62);
        }

        [data-shop-theme="dark"] .shop-category-option[data-active="true"] .shop-category-count {
          background: rgba(17,17,17,0.08);
          color: #111111;
        }

        [data-shop-theme="dark"] .shop-category-chip {
          border-color: rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.74);
        }

        [data-shop-theme="dark"] .shop-category-chip[data-active="true"] {
          border-color: #ffffff;
          background: #ffffff;
          color: #111111;
        }

        [data-shop-theme="dark"] .shop-card-frame {
          border-color: rgba(255,255,255,0.08);
          background: #0b0b0d;
        }

        [data-shop-theme="dark"] .shop-card-meta {
          color: #f5f5f5;
        }

        [data-shop-theme="dark"] .shop-card-title {
          color: #f5f5f5 !important;
        }

        [data-shop-theme="dark"] .shop-card-price {
          color: rgba(255,255,255,0.78);
        }

        [data-shop-theme="dark"] .shop-card-price.is-sale {
          color: #ff9b9b;
        }

        [data-shop-theme="dark"] .shop-strike {
          color: rgba(255,255,255,0.38);
        }

        [data-shop-theme="dark"] .shop-color-swatch {
          border-color: rgba(255,255,255,0.22);
        }

        [data-shop-theme="dark"] .shop-color-swatch:hover {
          border-color: rgba(255,255,255,0.48);
        }

        [data-shop-theme="dark"] .shop-color-swatch[data-active="true"] {
          border-color: #ffffff;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.18);
        }

        [data-shop-theme="dark"] .shop-retry-button,
        [data-shop-theme="dark"] .shop-pagination-button {
          border-color: rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.04);
          color: #f5f5f5;
        }

        [data-shop-theme="dark"] .shop-retry-button:hover,
        [data-shop-theme="dark"] .shop-pagination-button:hover {
          background: rgba(255,255,255,0.08);
        }

        [data-shop-theme="dark"] .shop-pagination-button[data-active="true"] {
          border-color: #ffffff;
          background: #ffffff;
          color: #111111;
        }

        [data-shop-theme="dark"] .shop-empty-state {
          color: rgba(255,255,255,0.52);
        }
      `}</style>
      <StorefrontSeo
        title="Shop Rare Atelier | Premium Streetwear Collection"
        description="Browse the Rare Atelier shop for premium streetwear, new arrivals, curated categories, and elevated everyday essentials."
        canonicalPath={shopPath}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Rare Atelier shop",
          url:
            typeof window !== "undefined"
              ? `${window.location.origin}${shopPath}`
              : shopPath,
          numberOfItems: paginatedProducts.length,
        }}
      />

      <div className="shop-page-surface w-full px-3 pr-1 sm:px-4 sm:pr-2 lg:px-6 xl:px-7 2xl:px-8">
        <div className="shop-page-content min-h-[400px] text-neutral-900">
          {layoutConfig.showCategoryMenu && categoryMenuOptions.length > 1 ? (
            <div className="shop-category-divider mb-4 border-b border-neutral-200 pb-2">
              <div className="hidden justify-center md:flex">
                <div
                  className="relative"
                  onMouseEnter={() => {
                    clearCategoryCloseTimer();
                    setCategoryMenuOpen(true);
                  }}
                  onMouseLeave={queueCategoryMenuClose}
                >
                  <button
                    type="button"
                    className="shop-category-trigger flex min-w-[260px] items-center justify-between rounded-full border border-neutral-200 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-950 transition-all duration-300 hover:border-neutral-900 hover:shadow-[0_12px_24px_rgba(17,17,17,0.08)]"
                    onClick={() => {
                      clearCategoryCloseTimer();
                      setCategoryMenuOpen((current) => !current);
                    }}
                    aria-expanded={categoryMenuOpen}
                  >
                    <span>{activeCategoryLabel}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${
                        categoryMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <div
                    className={`absolute left-1/2 top-full z-20 w-[320px] -translate-x-1/2 pt-2 transition-all duration-300 ${
                      categoryMenuOpen
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none -translate-y-2 opacity-0"
                    }`}
                    onMouseEnter={clearCategoryCloseTimer}
                    onMouseLeave={queueCategoryMenuClose}
                  >
                    <div className="shop-category-panel space-y-1 rounded-[28px] border border-neutral-200 bg-white/95 p-3 shadow-[0_24px_60px_rgba(17,17,17,0.12)] backdrop-blur-xl">
                      {categoryMenuOptions.map((option) => {
                        const isActive = option.key === selectedCategoryKey;

                        return (
                          <button
                            key={option.key}
                            type="button"
                            data-active={isActive ? "true" : "false"}
                            className={`shop-category-option flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all duration-200 ${
                              isActive
                                ? "bg-neutral-950 text-white"
                                : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                            }`}
                            onClick={() => {
                              clearCategoryCloseTimer();
                              setSelectedCategoryKey(option.key);
                              setCategoryMenuOpen(false);
                            }}
                          >
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                              {option.label}
                            </span>
                            <span
                              className={`shop-category-count rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                isActive
                                  ? "bg-white/14 text-white"
                                  : "bg-neutral-100 text-neutral-500"
                              }`}
                            >
                              {option.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
                {categoryMenuOptions.map((option) => {
                  const isActive = option.key === selectedCategoryKey;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      data-active={isActive ? "true" : "false"}
                      className={`shop-category-chip shrink-0 rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                        isActive
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-200 bg-white text-neutral-700"
                      }`}
                      onClick={() => setSelectedCategoryKey(option.key)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-[400px] w-full items-center justify-center">
              <BrandedLoader />
            </div>
          ) : isError ? (
            <div className="space-y-4 py-20 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Failed to load products. Try again.
              </p>
              <button
                onClick={() => refetch()}
                className="shop-retry-button rounded-lg border border-neutral-600 px-4 py-2 text-[10px] uppercase tracking-widest transition-colors hover:bg-neutral-100"
              >
                Retry
              </button>
            </div>
          ) : paginatedProducts.length > 0 ? (
            <div>
              <div
                className={`grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-5 ${desktopGridClassName} lg:gap-x-3 lg:gap-y-6`}
              >
                {paginatedProducts.map((product, index) => {
                  const hoverImage = getHoverImage(product);
                  const mainImage = product.imageUrl ?? hoverImage ?? "";
                  const colorOptions = parseJsonArray(product.colorOptions);
                  const colorImageMap = product.colorImageMap ?? {};
                  const normalizedColorMap = Object.entries(colorImageMap).reduce<Record<string, string[]>>((acc, [key, value]) => {
                    if (Array.isArray(value)) {
                      acc[normalizeColorLabel(key)] = value.filter(Boolean);
                    }
                    return acc;
                  }, {});
                  const activeColor =
                    hoveredCardColors[product.id] ??
                    selectedCardColors[product.id] ??
                    "";
                  const activeColorImages = activeColor
                    ? normalizedColorMap[normalizeColorLabel(activeColor)] ?? []
                    : [];
                  const primaryImage = activeColorImages[0] ?? mainImage;
                  const secondaryImage =
                    activeColorImages[1] ?? hoverImage ?? primaryImage;
                  const hasSaleBadge = Boolean(
                    product.saleActive && Number(product.salePercentage) > 0,
                  );
                  const showNewInBadge = index < 5;
                  const saleBadgeTopClass = showNewInBadge ? "top-11" : "top-3";
                  const stockBadgeTopClass = showNewInBadge
                    ? hasSaleBadge
                      ? "top-[4.55rem]"
                      : "top-11"
                    : hasSaleBadge
                      ? "top-12"
                      : "top-3";
                  const displayPrice = hasSaleBadge
                    ? formatPrice(
                        Number(product.price) *
                          (1 - Number(product.salePercentage) / 100),
                      )
                    : formatPrice(product.price);

                  return (
                    <Link
                      key={product.id}
                      href={`/product/${product.id}?from=${encodeURIComponent(shopPath)}`}
                      className="group block"
                    >
                      <div className="mb-1.5">
                        <div
                          className={`shop-card-frame relative overflow-hidden rounded-none border ${
                            isStuffyClone
                              ? "aspect-[5/6] border-neutral-100 bg-white"
                              : "aspect-[3/5] border-neutral-100 bg-white"
                          }`}
                        >
                          {showNewInBadge ? (
                            <div className="absolute left-3 top-3 z-10 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-950">
                              NEW IN
                            </div>
                          ) : null}
                          {hasSaleBadge ? (
                            <div
                              className={`absolute left-3 z-10 rounded-sm bg-red-600 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-xl ${saleBadgeTopClass}`}
                            >
                              {product.salePercentage}% OFF
                            </div>
                          ) : null}
                          {Number(product.stock) === 0 ? (
                            <div
                              className={`absolute left-3 z-10 rounded bg-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white ${stockBadgeTopClass}`}
                            >
                              Out of Stock
                            </div>
                          ) : null}
                          <img
                            src={primaryImage}
                            alt={product.name}
                            loading="lazy"
                            className={`absolute inset-0 h-full w-full object-cover ${
                              isStuffyClone
                                ? "translate-x-0 transition-transform duration-500 ease-out group-hover:-translate-x-full motion-reduce:translate-x-0 motion-reduce:group-hover:translate-x-0 motion-reduce:opacity-100 motion-reduce:group-hover:opacity-0 motion-reduce:transition-opacity motion-reduce:duration-200"
                                : "opacity-100 transition-opacity duration-300 group-hover:opacity-0"
                            }`}
                          />
                          <img
                            src={secondaryImage}
                            alt={product.name}
                            loading="lazy"
                            className={`absolute inset-0 h-full w-full object-cover ${
                              isStuffyClone
                                ? "translate-x-full transition-transform duration-500 ease-out group-hover:translate-x-0 motion-reduce:translate-x-0 motion-reduce:group-hover:translate-x-0 motion-reduce:opacity-0 motion-reduce:group-hover:opacity-100 motion-reduce:transition-opacity motion-reduce:duration-200"
                                : "opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            }`}
                          />
                        </div>
                      </div>

                      <div className="shop-card-meta mt-2 space-y-1.5 text-neutral-950">
                        <div className="min-w-0 space-y-1">
                          <h3
                            className="shop-card-title truncate text-[rgb(17,17,17)]"
                            style={{
                              fontFamily:
                                "Roboto, ui-sans-serif, system-ui, sans-serif",
                              fontWeight: 700,
                              fontSize: "18px",
                              lineHeight: "27px",
                            }}
                          >
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <p
                              className={`shop-card-price text-sm font-bold uppercase tracking-wider ${
                                hasSaleBadge ? "text-red-700" : "text-neutral-700"
                              }`}
                            >
                              {displayPrice}
                            </p>
                            {hasSaleBadge ? (
                              <p className="shop-strike text-[10px] text-neutral-500 line-through opacity-70">
                                {formatPrice(product.price)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {colorOptions.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {colorOptions.map((color) => {
                              const parsed = parseColorOption(color);
                              const normalizedColor = normalizeColorLabel(color);
                              const isActive =
                                normalizeColorLabel(activeColor) === normalizedColor;

                              return (
                                <button
                                  key={`${product.id}-${color}`}
                                  type="button"
                                  data-active={isActive ? "true" : "false"}
                                  className={`shop-color-swatch h-3.5 w-3.5 rounded-sm border transition-all duration-200 ${
                                    isActive
                                      ? "scale-110 border-neutral-950 shadow-[0_0_0_1px_rgba(17,17,17,0.1)]"
                                      : "border-neutral-300 hover:scale-105 hover:border-neutral-600"
                                  }`}
                                  style={{
                                    backgroundColor: parsed.swatch ?? "#d4d4d4",
                                  }}
                                  onMouseEnter={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setHoveredCardColors((prev) => ({
                                      ...prev,
                                      [product.id]: color,
                                    }));
                                  }}
                                  onMouseLeave={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setHoveredCardColors((prev) => ({
                                      ...prev,
                                      [product.id]: null,
                                    }));
                                  }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setSelectedCardColors((prev) => ({
                                      ...prev,
                                      [product.id]: color,
                                    }));
                                  }}
                                  onFocus={() => {
                                    setHoveredCardColors((prev) => ({
                                      ...prev,
                                      [product.id]: color,
                                    }));
                                  }}
                                  onBlur={() => {
                                    setHoveredCardColors((prev) => ({
                                      ...prev,
                                      [product.id]: null,
                                    }));
                                  }}
                                  aria-label={`Select ${parsed.label} color`}
                                  aria-pressed={isActive}
                                />
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
              {totalProducts > pageSize ? (
                <div className="mt-12 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous page"
                    onClick={() => {
                      setPage((currentPage) => Math.max(1, currentPage - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={page === 1}
                    className="shop-pagination-button flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 text-neutral-950 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageNumber = index + 1;
                    if (totalPages > 5) {
                      if (page <= 3) pageNumber = index + 1;
                      else if (page >= totalPages - 2)
                        pageNumber = totalPages - 4 + index;
                      else pageNumber = page - 2 + index;
                    }

                    return (
                      <button
                        type="button"
                        key={pageNumber}
                        onClick={() => {
                          setPage(pageNumber);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        data-active={pageNumber === page ? "true" : "false"}
                        className={`shop-pagination-button flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                          pageNumber === page
                            ? "bg-[#111111] text-white"
                            : "border border-neutral-300 text-neutral-950 hover:bg-neutral-100"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    aria-label="Next page"
                    onClick={() => {
                      setPage((currentPage) =>
                        Math.min(totalPages, currentPage + 1),
                      );
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={page >= totalPages}
                    className="shop-pagination-button flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 text-neutral-950 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="shop-empty-state py-20 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              No products found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
