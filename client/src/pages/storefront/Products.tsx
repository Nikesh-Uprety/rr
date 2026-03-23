import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { fetchProducts, fetchCategories, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { Slider } from "@/components/ui/slider";

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

export default function Products() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategory = searchParams.get("category");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(initialCategory || "all");
  const [sortBy, setSortBy] = useState("newest");

  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [priceBounds, setPriceBounds] = useState<[number, number]>([0, 1000]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const filters = useMemo(
    () => ({
      category: category === "all" ? undefined : category,
      search: search || undefined,
      sortBy,
      page: 1,
    }),
    [category, search, sortBy],
  );

  const {
    data: products,
    isLoading,
    isError,
    refetch,
  } = useQuery<ProductApi[]>({
    queryKey: ["products", filters],
    queryFn: () => fetchProducts(filters),
  });

  const availableSizes = useMemo(() => {
    if (!products) return [];
    const sizeSet = new Set<string>();
    products.forEach((product) => {
      parseJsonArray(product.sizeOptions).forEach((size) => sizeSet.add(size));
    });
    return Array.from(sizeSet);
  }, [products]);

  const availableColors = useMemo(() => {
    if (!products) return [];
    const colorSet = new Set<string>();
    products.forEach((product) => {
      parseJsonArray(product.colorOptions).forEach((color) => colorSet.add(color));
    });
    return Array.from(colorSet);
  }, [products]);

  useEffect(() => {
    if (!products || products.length === 0) return;
    const prices = products
      .map((p) => Number(p.price))
      .filter((p) => Number.isFinite(p));
    if (prices.length === 0) return;

    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));

    setPriceBounds([min, max]);
    setPriceRange((prev) => {
      const isDefault = prev[0] === 0 && prev[1] === 1000;
      if (isDefault) return [min, max];
      const clampedMin = Math.max(min, Math.min(prev[0], max));
      const clampedMax = Math.max(clampedMin, Math.min(prev[1], max));
      return [clampedMin, clampedMax];
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];

    const filtered = products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category ?? "").toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        category === "all" || (p.category ?? "") === category;

      const price = Number(p.price);
      const matchesPriceRange =
        Number.isFinite(price) && price >= priceRange[0] && price <= priceRange[1];

      const productSizes = parseJsonArray(p.sizeOptions);
      const productColors = parseJsonArray(p.colorOptions);

      const matchesSizes =
        selectedSizes.length === 0 ||
        selectedSizes.some((size) => productSizes.includes(size));

      const matchesColors =
        selectedColors.length === 0 ||
        selectedColors.some((color) => productColors.includes(color));

      const matchesStock = !inStockOnly || p.stock > 0;
      const matchesSale =
        !onSaleOnly || (Boolean(p.saleActive) && Number(p.salePercentage) > 0);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesPriceRange &&
        matchesSizes &&
        matchesColors &&
        matchesStock &&
        matchesSale
      );
    });

    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-high":
        filtered.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "newest":
      default:
        filtered.sort((a, b) => Number(b.id) - Number(a.id));
        break;
    }

    return filtered;
  }, [
    products,
    search,
    category,
    priceRange,
    selectedSizes,
    selectedColors,
    inStockOnly,
    onSaleOnly,
    sortBy,
  ]);

  const toggleChip = (
    value: string,
    selected: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const clearAllFilters = () => {
    setSelectedSizes([]);
    setSelectedColors([]);
    setInStockOnly(false);
    setOnSaleOnly(false);
    setPriceRange(priceBounds);
  };

  return (
    <div className="container mx-auto px-4 py-20 mt-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-black uppercase tracking-tight mb-2">All Products</h1>
      </div>

      <div>
        <div className="rounded-3xl p-6 md:p-10 backdrop-blur-xl bg-white/90 dark:bg-neutral-950/95 border border-black/[0.06] dark:border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-zinc-900 dark:text-white min-h-[400px]">
          <div className="mb-8 pb-4 border-b border-black/[0.06] dark:border-white/[0.06] space-y-4">
            <p
              style={{ fontFamily: "Roboto, sans-serif" }}
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-neutral-400"
            >
              Showing {filteredProducts.length} results
            </p>

            <div className="w-full overflow-x-auto scrollbar-hide rounded-2xl border border-black/20 dark:border-white/30 p-1.5">
              <div className="flex w-max min-w-full items-center justify-center gap-2 px-1 py-1">
                <button
                  onClick={() => setCategory("all")}
                  style={{ fontFamily: "Roboto, sans-serif" }}
                  className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    category === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-zinc-600 dark:text-zinc-300 border-black/[0.12] dark:border-white/[0.18] hover:border-primary hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.slug)}
                    style={{ fontFamily: "Roboto, sans-serif" }}
                    className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      category === cat.slug
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-zinc-600 dark:text-zinc-300 border-black/[0.12] dark:border-white/[0.18] hover:border-primary hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <span
                style={{ fontFamily: "Roboto, sans-serif" }}
                className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-neutral-400"
              >
                Sort By
              </span>
              <select
                style={{ fontFamily: "Roboto, sans-serif" }}
                className="h-10 pl-4 pr-10 bg-white/50 dark:bg-neutral-900 border border-black/[0.06] dark:border-neutral-800 rounded text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-black dark:focus:ring-white appearance-none cursor-pointer text-zinc-900 dark:text-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
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
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
              <aside className="lg:sticky lg:top-28 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md p-5 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-200">
                    Filters
                  </h2>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>

                <section className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    Price Range
                  </h3>
                  <Slider
                    className="cursor-grab active:cursor-grabbing"
                    min={priceBounds[0]}
                    max={priceBounds[1]}
                    step={1}
                    value={[priceRange[0], priceRange[1]]}
                    onValueChange={(value) => {
                      if (value.length === 2) {
                        setPriceRange([value[0], value[1]]);
                      }
                    }}
                  />
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    <span>{formatPrice(priceRange[0])}</span>
                    <span>{formatPrice(priceRange[1])}</span>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    Size
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.length === 0 ? (
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">No size options</p>
                    ) : (
                      availableSizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => toggleChip(size, selectedSizes, setSelectedSizes)}
                          className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            selectedSizes.includes(size)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-black/[0.12] dark:border-white/[0.18] text-zinc-600 dark:text-zinc-300 hover:border-primary"
                          }`}
                        >
                          {size}
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    Color
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.length === 0 ? (
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">No color options</p>
                    ) : (
                      availableColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() =>
                            toggleChip(color, selectedColors, setSelectedColors)
                          }
                          className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            selectedColors.includes(color)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-black/[0.12] dark:border-white/[0.18] text-zinc-600 dark:text-zinc-300 hover:border-primary"
                          }`}
                        >
                          {color}
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    Other
                  </h3>
                  <label className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    In stock only
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onSaleOnly}
                      onChange={(e) => setOnSaleOnly(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    On sale only
                  </label>
                </section>
              </aside>

              <div>
                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filteredProducts.map((product) => (
                      <Link
                        key={product.id}
                        href={`/product/${product.id}`}
                        className="group block"
                      >
                        <div className="aspect-[3/4] overflow-hidden bg-white/[0.04] mb-4 relative rounded-xl border border-white/[0.06] transition-all duration-300 group-hover:border-white/[0.15] group-hover:shadow-[0_8px_24px_rgba(255,255,255,0.06)]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.open(`/product/${product.id}`, "_blank");
                            }}
                            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Open product in new tab"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          {product.saleActive && Number(product.salePercentage) > 0 && (
                            <div className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-sm shadow-xl animate-pulse">
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
                            src={product.imageUrl ?? ""}
                            alt={product.name}
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                          />
                        </div>
                        <div className="space-y-1">
                          <h3
                            className="mb-1 truncate transition-colors group-hover:opacity-80"
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
                              className={`text-sm font-bold uppercase tracking-wider ${product.saleActive ? "text-primary" : "text-zinc-500 dark:text-neutral-400"}`}
                            >
                              {product.saleActive && Number(product.salePercentage) > 0
                                ? formatPrice(
                                    Number(product.price) *
                                      (1 - Number(product.salePercentage) / 100),
                                  )
                                : formatPrice(product.price)}
                            </p>
                            {product.saleActive && Number(product.salePercentage) > 0 && (
                              <p className="text-[10px] text-zinc-400 dark:text-neutral-500 line-through opacity-60">
                                {formatPrice(product.price)}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center uppercase text-[10px] tracking-widest font-bold text-neutral-400 dark:text-neutral-500">
                    No products found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
