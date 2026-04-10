import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { fetchPageConfig, fetchProducts, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { StorefrontSeo } from "@/components/seo/StorefrontSeo";

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
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

function resolveNamedColorSwatch(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return null;
  return COLOR_NAME_SWATCHES[normalized] ?? null;
}

function parseColorOption(value: string): { label: string; swatch: string | null } {
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/);
  const label = trimmed
    .replace(/\(\s*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\s*\)/g, "")
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
  };
}

export default function Products() {
  const initialState = readShopSearchParams();
  const [page, setPage] = useState(initialState.page);
  const [selectedCardColors, setSelectedCardColors] = useState<Record<string, string>>({});
  const [hoveredCardColors, setHoveredCardColors] = useState<Record<string, string | null>>({});
  const previewTemplateId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("canvasPreviewTemplateId");
    return rawValue && /^\d+$/.test(rawValue) ? rawValue : null;
  }, []);

  const { data: pageConfig } = useQuery({
    queryKey: ["page-config", previewTemplateId],
    queryFn: () => fetchPageConfig(previewTemplateId),
    staleTime: previewTemplateId !== null ? 0 : 5 * 60 * 1000,
    refetchOnMount: previewTemplateId !== null ? "always" : false,
    refetchOnWindowFocus: previewTemplateId !== null,
  });

  const isStuffyClone = pageConfig?.template?.slug === "stuffyclone";
  const pageSize = isStuffyClone ? 16 : 12;
  const shopPath = page > 1 ? `/products?page=${page}` : "/products";

  useEffect(() => {
    window.history.replaceState(window.history.state, "", shopPath);
  }, [shopPath]);

  const { data: productsData, isLoading, isError, refetch } = useQuery<{ products: ProductApi[]; total: number }>({
    queryKey: ["products", { page, limit: pageSize }],
    queryFn: () => fetchProducts({ page, limit: pageSize }),
    staleTime: 1000 * 60 * 5,
  });

  const products = productsData?.products ?? [];
  const totalProducts = productsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));

  return (
    <div className="min-h-screen w-full bg-white pb-16 pt-20 text-neutral-950 sm:pt-24">
      <StorefrontSeo
        title="Shop Rare Atelier | Premium Streetwear Collection"
        description="Browse the Rare Atelier shop for premium streetwear, new arrivals, curated categories, and elevated everyday essentials."
        canonicalPath={shopPath}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Rare Atelier shop",
          url: typeof window !== "undefined" ? `${window.location.origin}${shopPath}` : shopPath,
          numberOfItems: products.length,
        }}
      />

      <div className="w-full bg-white px-3 pr-1 sm:px-4 sm:pr-2 lg:px-6 xl:px-7 2xl:px-8">
        <div className="min-h-[400px] text-neutral-900">
          {isLoading ? (
            <div className="flex min-h-[400px] w-full items-center justify-center col-span-full">
              <BrandedLoader />
            </div>
          ) : isError ? (
            <div className="space-y-4 py-20 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Failed to load products. Try again.
              </p>
              <button
                onClick={() => refetch()}
                className="rounded-lg border border-neutral-600 px-4 py-2 text-[10px] uppercase tracking-widest transition-colors hover:bg-neutral-100"
              >
                Retry
              </button>
            </div>
          ) : (
            <div>
              {products.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 xl:grid-cols-4">
                  {products.map((product, index) => {
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
                    const activeColor = hoveredCardColors[product.id] ?? selectedCardColors[product.id] ?? "";
                    const activeColorImages = activeColor ? normalizedColorMap[normalizeColorLabel(activeColor)] ?? [] : [];
                    const primaryImage = activeColorImages[0] ?? mainImage;
                    const secondaryImage = activeColorImages[1] ?? hoverImage ?? primaryImage;
                    const activeColorLabel = activeColor ? parseColorOption(activeColor).label : null;
                    const hasSaleBadge = Boolean(product.saleActive && Number(product.salePercentage) > 0);
                    const showNewInBadge = index < 5;
                    const saleBadgeTopClass = showNewInBadge ? "top-11" : "top-3";
                    const stockBadgeTopClass = showNewInBadge
                      ? hasSaleBadge
                        ? "top-[4.55rem]"
                        : "top-11"
                      : hasSaleBadge
                        ? "top-12"
                        : "top-3";
                    const displayPrice =
                      hasSaleBadge
                        ? formatPrice(Number(product.price) * (1 - Number(product.salePercentage) / 100))
                        : formatPrice(product.price);

                    return (
                      <Link
                        key={product.id}
                        href={`/product/${product.id}?from=${encodeURIComponent(shopPath)}`}
                        className="group block"
                      >
                        <div className="mb-2">
                          <div className={`relative overflow-hidden rounded-none border ${isStuffyClone ? "aspect-[5/6] border-neutral-100 bg-white" : "aspect-[3/5] border-neutral-100 bg-white"}`}>
                            {showNewInBadge ? (
                              <div className="absolute left-3 top-3 z-10 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-950">
                                NEW IN
                              </div>
                            ) : null}
                            {hasSaleBadge ? (
                              <div className={`absolute left-3 z-10 rounded-sm bg-red-600 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-xl ${saleBadgeTopClass}`}>
                                {product.salePercentage}% OFF
                              </div>
                            ) : null}
                            {Number(product.stock) === 0 ? (
                              <div className={`absolute left-3 z-10 rounded bg-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white ${stockBadgeTopClass}`}>
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

                        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 text-neutral-950">
                          <div className="min-w-0 space-y-1">
                            <h3
                              className="truncate text-[rgb(17,17,17)]"
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
                                  hasSaleBadge ? "text-red-700" : "text-neutral-700"
                                }`}
                              >
                                {displayPrice}
                              </p>
                              {hasSaleBadge ? (
                                <p className="text-[10px] text-neutral-500 line-through opacity-70">
                                  {formatPrice(product.price)}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {colorOptions.length > 0 ? (
                            <div className="flex max-w-[6rem] shrink-0 flex-col items-end text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {colorOptions.map((color) => {
                                  const parsed = parseColorOption(color);
                                  const normalizedColor = normalizeColorLabel(color);
                                  const isActive = normalizeColorLabel(activeColor) === normalizedColor;
                                  const colorImages = normalizedColorMap[normalizedColor] ?? [];
                                  const selectorImage = colorImages[0] ?? mainImage;

                                  return (
                                    <button
                                      key={`${product.id}-${color}`}
                                      type="button"
                                      className="group/color flex w-[42px] flex-col items-center gap-1 text-center"
                                      onMouseEnter={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setHoveredCardColors((prev) => ({ ...prev, [product.id]: color }));
                                      }}
                                      onMouseLeave={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setHoveredCardColors((prev) => ({ ...prev, [product.id]: null }));
                                      }}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setSelectedCardColors((prev) => ({ ...prev, [product.id]: color }));
                                      }}
                                      onFocus={() => {
                                        setHoveredCardColors((prev) => ({ ...prev, [product.id]: color }));
                                      }}
                                      onBlur={() => {
                                        setHoveredCardColors((prev) => ({ ...prev, [product.id]: null }));
                                      }}
                                      aria-label={`Select ${parsed.label} color`}
                                      aria-pressed={isActive}
                                    >
                                      <span
                                        className={`overflow-hidden rounded-md border transition ${
                                          isActive
                                            ? "border-neutral-900 shadow-[0_0_0_1px_rgba(17,17,17,0.08)]"
                                            : "border-neutral-200"
                                        }`}
                                      >
                                        <img
                                          src={selectorImage}
                                          alt={`${product.name} in ${parsed.label}`}
                                          loading="lazy"
                                          className="h-11 w-[42px] object-cover transition-transform duration-300 group-hover/color:scale-[1.03]"
                                        />
                                      </span>
                                      <span
                                        className={`w-full truncate text-[8px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                                          isActive ? "text-neutral-950" : "text-neutral-500"
                                        }`}
                                      >
                                        {parsed.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                  No products found.
                </div>
              )}

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
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 text-neutral-950 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageNumber = index + 1;
                    if (totalPages > 5) {
                      if (page <= 3) pageNumber = index + 1;
                      else if (page >= totalPages - 2) pageNumber = totalPages - 4 + index;
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
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
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
                      setPage((currentPage) => Math.min(totalPages, currentPage + 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={page >= totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 text-neutral-950 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
