import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts, fetchCategories, type ProductApi } from "@/lib/api";
import { ArrowUpRight } from "lucide-react";

// Masonry layout assignment: vary aspect ratios for visual interest
const ASPECT_PATTERNS = [
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[4/5]",
];

function getAspect(index: number) {
  return ASPECT_PATTERNS[index % ASPECT_PATTERNS.length];
}

// Scroll-reveal hook using IntersectionObserver
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function RevealImage({
  product,
  index,
}: {
  product: ProductApi;
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal();
  const aspect = getAspect(index);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${(index % 4) * 80}ms` }}
    >
      <Link href={`/product/${product.id}`} className="group block relative overflow-hidden rounded-sm">
        <div className={`${aspect} overflow-hidden bg-neutral-100 dark:bg-neutral-800`}>
          <img
            src={product.imageUrl ?? ""}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            loading="lazy"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-500">
              <ArrowUpRight className="w-4 h-4 text-black" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="columns-2 md:columns-3 xl:columns-4 gap-4 space-y-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className={`${getAspect(i)} bg-neutral-200 dark:bg-neutral-800 rounded-sm animate-pulse break-inside-avoid`}
        />
      ))}
    </div>
  );
}

export default function NewCollection() {
  const { data: products, isLoading } = useQuery<ProductApi[]>({
    queryKey: ["products", "all-collection"],
    queryFn: () => fetchProducts(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const getCategoryDisplayName = (slug: string) => {
    if (slug === "uncategorized") return "Other";
    const c = categories.find((x) => x.slug === slug);
    return (
      c?.name ??
      slug
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (w) => w.toUpperCase())
    );
  };

  const productsByCategory = useMemo(() => {
    if (!products) return new Map<string, ProductApi[]>();
    const map = new Map<string, ProductApi[]>();
    for (const p of products) {
      const cat = p.category ?? "uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [products]);

  return (
    <div className="flex flex-col min-h-screen pt-20">
      {/* Hero Banner */}
      <section className="relative w-full py-28 md:py-40 overflow-hidden bg-neutral-950">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-white/[0.03] blur-3xl" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800/20 via-transparent to-transparent" />

        <div className="relative container mx-auto px-6 text-center">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.5em] text-neutral-500 font-bold mb-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
            Curated Pieces, Captured in Detail
          </p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight leading-none animate-in fade-in slide-in-from-bottom-4 duration-1000">
            The Collection
          </h1>
          <div className="mt-8 flex justify-center gap-3 animate-in fade-in duration-1000" style={{ animationDelay: "400ms" }}>
            <div className="h-px w-16 bg-neutral-700 self-center" />
            <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-600 font-medium">
              {products ? products.length : "—"} Pieces
            </span>
            <div className="h-px w-16 bg-neutral-700 self-center" />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 md:py-24 container mx-auto px-4 md:px-6 max-w-7xl">
        {isLoading ? (
          <GallerySkeleton />
        ) : (
          Array.from(productsByCategory.entries()).map(([catSlug, prods]) => (
            <div key={catSlug} className="mb-20 last:mb-0">
              {/* Category heading */}
              <div className="flex items-center gap-4 mb-10">
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                <h2 className="text-[11px] md:text-xs font-bold uppercase tracking-[0.35em] text-neutral-400 dark:text-neutral-500 shrink-0">
                  {getCategoryDisplayName(catSlug)}
                </h2>
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              </div>

              {/* Masonry grid */}
              <div className="columns-2 md:columns-3 xl:columns-4 gap-3 md:gap-4">
                {prods.map((product, i) => (
                  <div key={product.id} className="break-inside-avoid mb-3 md:mb-4">
                    <RevealImage product={product} index={i} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {!isLoading && products && products.length === 0 && (
          <div className="py-20 text-center">
            <p className="uppercase text-[10px] tracking-widest font-bold text-neutral-400">
              No products found.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
