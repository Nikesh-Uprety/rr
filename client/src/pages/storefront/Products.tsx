import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownWideNarrow, ExternalLink, Palette, Ruler, Sparkles, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchProducts, fetchCategories, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { StorefrontBreadcrumbs } from "@/components/product/StorefrontBreadcrumbs";
import { StorefrontSeo } from "@/components/seo/StorefrontSeo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s || !s.trim()) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a)
      ? a.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function getHoverImage(product: ProductApi): string {
  const gallery = parseJsonArray(product.galleryUrls);
  const main = product.imageUrl ?? "";
  if (gallery.length === 0) return main;
  if (gallery[0] && gallery[0] !== main) return gallery[0];
  return (gallery[1] ?? main) as string;
}

const SORT_LABELS: Record<string, string> = {
  newest: "Newest",
  "price-low": "Price Low",
  "price-high": "Price High",
  "best-seller": "Best Seller",
  "highest-stock": "Highest Stock",
};

function readShopSearchParams() {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    category: searchParams.get("category") || "all",
    sortBy: searchParams.get("sort") || "newest",
    stockFilter: searchParams.get("stock") || "all",
    sizeFilter: searchParams.get("size") || "all",
    colorFilter: searchParams.get("color") || "all",
    page: Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1),
  };
}

export default function Products() {
  const initialState = readShopSearchParams();

  const [category, setCategory] = useState<string>(initialState.category);
  const [sortBy, setSortBy] = useState(initialState.sortBy);
  const [stockFilter, setStockFilter] = useState(initialState.stockFilter);
  const [sizeFilter, setSizeFilter] = useState(initialState.sizeFilter);
  const [colorFilter, setColorFilter] = useState(initialState.colorFilter);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [page, setPage] = useState(initialState.page);
  const PAGE_SIZE = 10;
  const hasInitializedFilters = useRef(false);

  const shopPath = useMemo(() => {
    const params = new URLSearchParams();

    if (category !== "all") params.set("category", category);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (stockFilter !== "all") params.set("stock", stockFilter);
    if (sizeFilter !== "all") params.set("size", sizeFilter);
    if (colorFilter !== "all") params.set("color", colorFilter);
    if (page > 1) params.set("page", String(page));

    const query = params.toString();
    return `/products${query ? `?${query}` : ""}`;
  }, [category, colorFilter, page, sizeFilter, sortBy, stockFilter]);

  useEffect(() => {
    if (!isSortMenuOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehaviorY;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehaviorY = "none";
    document.documentElement.style.overscrollBehaviorY = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehaviorY = previousBodyOverscroll;
      document.documentElement.style.overscrollBehaviorY = previousHtmlOverscroll;
    };
  }, [isSortMenuOpen]);

  useEffect(() => {
    window.history.replaceState(window.history.state, "", shopPath);
  }, [shopPath]);

  useEffect(() => {
    if (!hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      return;
    }
    setPage(1);
  }, [category, sortBy, stockFilter, sizeFilter, colorFilter]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const filters = useMemo(
    () => ({
      category: category === "all" ? undefined : category,
      page,
      limit: PAGE_SIZE,
    }),
    [category, page],
  );

  const {
    data: productsData,
    isLoading,
    isError,
    refetch,
  } = useQuery<{ products: ProductApi[]; total: number }>({
    queryKey: ["products", filters],
    queryFn: () => fetchProducts(filters),
    staleTime: 1000 * 60 * 5,
  });

  const products = productsData?.products ?? [];
  const totalProducts = productsData?.total ?? 0;

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const filteredByCategory =
      category === "all" ? [...products] : products.filter((p) => (p.category ?? "") === category);

    const filtered = filteredByCategory.filter((product) => {
      if (stockFilter === "in-stock" && Number(product.stock) <= 0) return false;
      if (stockFilter === "out-of-stock" && Number(product.stock) > 0) return false;
      if (stockFilter === "on-sale" && !(product.saleActive && Number(product.salePercentage) > 0)) return false;

      if (sizeFilter !== "all") {
        const sizeOptions = parseJsonArray(product.sizeOptions);
        const variantSizes = (product.variants ?? []).map((variant) => variant.size).filter(Boolean);
        const sizeSet = new Set([...sizeOptions, ...variantSizes]);
        if (!sizeSet.has(sizeFilter)) return false;
      }

      if (colorFilter !== "all") {
        const colorOptions = parseJsonArray(product.colorOptions);
        const variantColors = (product.variants ?? [])
          .map((variant) => variant.color ?? "")
          .filter((color) => Boolean(color));
        const colorSet = new Set([...colorOptions, ...variantColors]);
        if (!colorSet.has(colorFilter)) return false;
      }

      return true;
    });

    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-high":
        filtered.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "best-seller":
        filtered.sort((a, b) => Number(b.ranking ?? 0) - Number(a.ranking ?? 0));
        break;
      case "highest-stock":
        filtered.sort((a, b) => Number(b.stock) - Number(a.stock));
        break;
      case "newest":
      default:
        filtered.sort((a, b) => Number(b.id) - Number(a.id));
        break;
    }

    return filtered;
  }, [
    products,
    category,
    sortBy,
    stockFilter,
    sizeFilter,
    colorFilter,
  ]);

  const availableSizes = useMemo(() => {
    if (!products) return [];
    const sizeSet = new Set<string>();
    products.forEach((product) => {
      parseJsonArray(product.sizeOptions).forEach((size) => sizeSet.add(size));
      (product.variants ?? []).forEach((variant) => {
        if (variant.size?.trim()) sizeSet.add(variant.size.trim());
      });
    });
    return Array.from(sizeSet);
  }, [products]);

  const availableColors = useMemo(() => {
    if (!products) return [];
    const colorSet = new Set<string>();
    products.forEach((product) => {
      parseJsonArray(product.colorOptions).forEach((color) => colorSet.add(color));
      (product.variants ?? []).forEach((variant) => {
        const color = variant.color?.trim();
        if (color) colorSet.add(color);
      });
    });
    return Array.from(colorSet);
  }, [products]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sortBy !== "newest") count += 1;
    if (stockFilter !== "all") count += 1;
    if (sizeFilter !== "all") count += 1;
    if (colorFilter !== "all") count += 1;
    return count;
  }, [sortBy, stockFilter, sizeFilter, colorFilter]);

  const MAX_INLINE_CATEGORIES = 6;
  const inlineCategories = categories.slice(0, MAX_INLINE_CATEGORIES);
  const overflowCategories = categories.slice(MAX_INLINE_CATEGORIES);
  const isOverflowSelected = overflowCategories.some((cat) => cat.slug === category);

  return (
    <div className="w-full pb-16 pt-4 pl-3 pr-1 sm:pt-6 sm:pl-4 sm:pr-2 lg:pl-6 lg:pr-2 xl:pl-7 xl:pr-2 2xl:pl-8 2xl:pr-2">
      <StorefrontSeo
        title={
          category !== "all"
            ? `${category.charAt(0).toUpperCase() + category.slice(1)} | Shop Rare Atelier`
            : "Shop Rare Atelier | Premium Streetwear Collection"
        }
        description={
          category !== "all"
            ? `Browse ${category} pieces from Rare Atelier. Discover premium silhouettes, refined details, and limited streetwear drops.`
            : "Browse the Rare Atelier shop for premium streetwear, new arrivals, curated categories, and elevated everyday essentials."
        }
        canonicalPath={shopPath}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: category !== "all" ? `${category} collection` : "Rare Atelier shop",
          url:
            typeof window !== "undefined"
              ? `${window.location.origin}${shopPath}`
              : shopPath,
          numberOfItems: filteredProducts.length,
        }}
      />

      <div className="w-full">
        <div className="mb-6">
          <StorefrontBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Shop" },
            ]}
          />
        </div>

        <div className="mb-8 border-b border-border/70 pb-5 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
            All Products
          </h1>
          <p
            style={{ fontFamily: "Roboto, sans-serif" }}
            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-300"
          >
            Showing {filteredProducts.length} results
          </p>
        </div>

        <div className="min-h-[400px] text-neutral-900 dark:text-neutral-100">
          <div className="mb-10 space-y-5">
            <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
              <div className="w-full overflow-x-auto scrollbar-hide md:col-start-2 md:w-auto md:max-w-full md:justify-self-center">
                <div className="flex w-max min-w-full items-center gap-4 md:min-w-0 md:flex-wrap md:justify-center md:gap-5">
                  <button
                    onClick={() => setCategory("all")}
                    style={{ fontFamily: "Roboto, sans-serif" }}
                    className={`shrink-0 border-b-2 px-1 py-1 text-sm md:text-base font-medium uppercase tracking-[0.16em] transition-colors ${
                      category === "all"
                        ? "border-current text-neutral-900 dark:text-neutral-100"
                        : "border-transparent text-neutral-800/85 dark:text-neutral-300/85 hover:text-neutral-900 dark:hover:text-neutral-100"
                    }`}
                  >
                    All
                  </button>
                  {inlineCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.slug)}
                      style={{ fontFamily: "Roboto, sans-serif" }}
                      className={`shrink-0 border-b-2 px-1 py-1 text-sm md:text-base font-medium uppercase tracking-[0.16em] transition-colors ${
                        category === cat.slug
                          ? "border-current text-neutral-900 dark:text-neutral-100"
                          : "border-transparent text-neutral-800/85 dark:text-neutral-300/85 hover:text-neutral-900 dark:hover:text-neutral-100"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                  {overflowCategories.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          style={{ fontFamily: "Roboto, sans-serif" }}
                          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-sm transition-colors ${
                            isOverflowSelected
                              ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                              : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          <span>More</span>
                          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/90 px-1.5 text-[9px] font-black tracking-normal text-black">
                            {overflowCategories.length}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[12rem] rounded-xl border border-black/10 bg-white/95 p-2 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/15 dark:bg-neutral-900/95 dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
                        <DropdownMenuLabel className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-700 dark:text-neutral-200">
                          <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-200" />
                            More Categories
                          </span>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={category}
                          onValueChange={(value) => setCategory(value)}
                        >
                          {overflowCategories.map((cat) => (
                            <DropdownMenuRadioItem key={cat.id} value={cat.slug}>
                              {cat.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-start whitespace-nowrap md:col-start-3 md:justify-self-end">
                <DropdownMenu open={isSortMenuOpen} onOpenChange={setIsSortMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      style={{ fontFamily: "Roboto, sans-serif" }}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-900 shadow-sm transition-all hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                      <span>{SORT_LABELS[sortBy] ? `Sort: ${SORT_LABELS[sortBy]}` : "Sort By"}</span>
                      {activeFilterCount > 0 ? (
                        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-neutral-100 px-1.5 text-[9px] font-black tracking-normal text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100">
                          {activeFilterCount}
                        </span>
                      ) : null}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isSortMenuOpen ? "rotate-180" : ""}`} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[18rem] rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-[0_12px_32px_rgba(15,23,42,0.1)] backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95 dark:shadow-[0_12px_32px_rgba(0,0,0,0.3)]">
                    <DropdownMenuLabel className="px-0 text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-700 dark:text-neutral-200">
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                        Sort & Filter
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <div className="space-y-2">
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-300">
                        <span className="inline-flex items-center gap-1.5">
                          <ArrowDownWideNarrow className="h-3.5 w-3.5 text-blue-500" />
                          Sort By
                        </span>
                      </label>
                      <select
                        style={{ fontFamily: "Roboto, sans-serif" }}
                        className="h-9 w-full rounded border border-black/[0.1] bg-transparent px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-900 focus:ring-1 focus:ring-black dark:border-white/[0.24] dark:text-neutral-100 dark:focus:ring-white"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sort products"
                      >
                        <option value="newest">Newest</option>
                        <option value="price-low">Price Low</option>
                        <option value="price-high">Price High</option>
                        <option value="best-seller">Best Seller</option>
                        <option value="highest-stock">Highest Stock</option>
                      </select>
                    </div>

                    <div className="mt-3 space-y-2">
                      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-300">
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                          Stock
                        </span>
                      </label>
                      <select
                        style={{ fontFamily: "Roboto, sans-serif" }}
                        className="h-9 w-full rounded border border-black/[0.1] bg-transparent px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-900 focus:ring-1 focus:ring-black dark:border-white/[0.24] dark:text-neutral-100 dark:focus:ring-white"
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value)}
                        aria-label="Filter products by stock or sale"
                      >
                        <option value="all">All</option>
                        <option value="on-sale">On Sale</option>
                        <option value="in-stock">In Stock</option>
                        <option value="out-of-stock">Out of Stock</option>
                      </select>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-300">
                          <span className="inline-flex items-center gap-1.5">
                            <Ruler className="h-3.5 w-3.5 text-indigo-500" />
                            Size
                          </span>
                        </label>
                        <select
                          style={{ fontFamily: "Roboto, sans-serif" }}
                          className="h-9 w-full rounded border border-black/[0.1] bg-transparent px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-900 focus:ring-1 focus:ring-black dark:border-white/[0.24] dark:text-neutral-100 dark:focus:ring-white"
                          value={sizeFilter}
                          onChange={(e) => setSizeFilter(e.target.value)}
                          aria-label="Filter products by size"
                        >
                          <option value="all">All</option>
                          {availableSizes.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-300">
                          <span className="inline-flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5 text-fuchsia-500" />
                            Color
                          </span>
                        </label>
                        <select
                          style={{ fontFamily: "Roboto, sans-serif" }}
                          className="h-9 w-full rounded border border-black/[0.1] bg-transparent px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-900 focus:ring-1 focus:ring-black dark:border-white/[0.24] dark:text-neutral-100 dark:focus:ring-white"
                          value={colorFilter}
                          onChange={(e) => setColorFilter(e.target.value)}
                          aria-label="Filter products by color"
                        >
                          <option value="all">All</option>
                          {availableColors.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-3 h-8 w-full rounded border border-black/20 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-white/25 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      onClick={() => {
                        setSortBy("newest");
                        setStockFilter("all");
                        setSizeFilter("all");
                        setColorFilter("all");
                      }}
                    >
                      Reset Filters
                    </button>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px] w-full col-span-full">
              <BrandedLoader />
            </div>
          ) : isError ? (
            <div className="py-20 text-center space-y-4">
              <p className="uppercase text-[10px] tracking-widest font-bold text-neutral-400 dark:text-neutral-500">
                Failed to load products. Try again.
              </p>
              <button
                onClick={() => refetch()}
                className="text-[10px] uppercase tracking-widest border border-neutral-600 dark:border-neutral-300 px-4 py-2 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div>
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-3 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5">
                  {filteredProducts.map((product) => {
                    const hoverImage = getHoverImage(product);
                    const mainImage = product.imageUrl ?? hoverImage ?? "";
                      return (
                        <Link
                          key={product.id}
                          href={`/product/${product.id}?from=${encodeURIComponent(shopPath)}`}
                          className="group block"
                        >
                        <div className="mb-2">
                          <div className="relative aspect-[3/5] overflow-hidden rounded-md border border-white/80 bg-zinc-50 dark:border-white/20 dark:bg-zinc-900/70">
                          <button
                            type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(`/product/${product.id}?from=${encodeURIComponent(shopPath)}`, "_blank");
                              }}
                            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Open product in new tab"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          {product.saleActive && Number(product.salePercentage) > 0 && (
                            <div className="absolute top-3 left-3 z-10 bg-red-600 text-white text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-sm shadow-xl animate-pulse">
                              {product.salePercentage}% OFF
                            </div>
                          )}
                          {product.stock === 0 && (
                            <div
                              className={`absolute ${product.saleActive ? "top-12" : "top-3"} left-3 z-10 bg-black/80 dark:bg-neutral-800/90 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded`}
                            >
                              Out of Stock
                            </div>
                          )}
                          <img
                            src={mainImage}
                            alt={product.name}
                            className="absolute inset-0 h-full w-full object-cover opacity-100 group-hover:opacity-0 transition-none"
                          />
                          <img
                            src={hoverImage}
                            alt={product.name}
                            className="absolute inset-0 h-full w-full object-cover opacity-0 group-hover:opacity-100 transition-none"
                          />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h3
                            className="mb-1 truncate"
                            style={{
                              fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif",
                              fontWeight: 700,
                              fontSize: "18px",
                              lineHeight: "27px",
                            }}
                          >
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-sm font-bold uppercase tracking-wider ${
                                product.saleActive
                                  ? "text-red-700 dark:text-red-400"
                                  : "text-neutral-500 dark:text-neutral-400"
                              }`}
                            >
                              {product.saleActive && Number(product.salePercentage) > 0
                                ? formatPrice(
                                    Number(product.price) *
                                      (1 - Number(product.salePercentage) / 100),
                                  )
                                : formatPrice(product.price)}
                            </p>
                            {product.saleActive && Number(product.salePercentage) > 0 && (
                              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 line-through opacity-70">
                                {formatPrice(product.price)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center uppercase text-[10px] tracking-widest font-bold text-neutral-400 dark:text-neutral-500">
                  No products found.
                </div>
              )}

              {totalProducts > PAGE_SIZE && (
                <div className="mt-12 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={page === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(5, Math.ceil(totalProducts / PAGE_SIZE)) }, (_, i) => {
                    const totalPages = Math.ceil(totalProducts / PAGE_SIZE);
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setPage(pageNum);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                          pageNum === page
                            ? "bg-[#2C3E2D] text-white dark:bg-[#4ADE80] dark:text-[#1A251B]"
                            : "border border-border/60 text-foreground hover:bg-muted"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      setPage((p) => Math.min(Math.ceil(totalProducts / PAGE_SIZE), p + 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={page >= Math.ceil(totalProducts / PAGE_SIZE)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
