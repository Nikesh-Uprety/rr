import { useRef, useMemo, useState, useEffect, useLayoutEffect } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { type ProductApi } from "@/lib/api";

interface InfiniteScrollGalleryProps {
  products: ProductApi[];
  isDark: boolean;
}

function InfiniteScrollGallery({ products, isDark }: InfiniteScrollGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => {
    const cols: ProductApi[][] = [[], [], []];
    products.forEach((product, i) => {
      cols[i % 3].push(product);
    });
    return cols;
  }, [products]);

  if (products.length === 0) {
    return (
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <p className="uppercase text-[10px] tracking-widest font-bold text-neutral-400">
            No products found.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative bg-neutral-50 dark:bg-neutral-950">
      <div className="py-10 md:py-14 px-6 md:px-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.55em] text-neutral-500 dark:text-neutral-400 md:text-xs">
          Explore the Collection
        </p>
        <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-black dark:text-white sm:text-4xl md:text-5xl">
          New Arrivals
        </h2>
      </div>

      <div ref={containerRef} className="flex w-full min-h-screen">
        {columns.map((col, i) => {
          const isReverse = i % 2 === 0;
          return (
            <ScrollColumn
              key={i}
              products={col}
              isDark={isDark}
              reverse={isReverse}
              containerRef={containerRef}
            />
          );
        })}
      </div>
    </section>
  );
}

function ScrollColumn({
  products,
  isDark,
  reverse,
  containerRef,
}: {
  products: ProductApi[];
  isDark: boolean;
  reverse: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [yPercent, setYPercent] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const elementHeight = list.offsetHeight;
    const viewportHeight = window.innerHeight;
    const extraSpace = viewportHeight * 0.2;
    const total = elementHeight + viewportHeight + extraSpace;

    setScrollDistance(total);
  }, [products]);

  useEffect(() => {
    if (!reverse) return;

    const container = containerRef.current;
    if (!container) return;

    const updatePosition = () => {
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const scrolled = -rect.top;
      const totalScroll = scrollDistance;

      if (totalScroll <= 0) return;

      const progress = Math.max(0, Math.min(1, scrolled / totalScroll));
      setYPercent(progress * 100);
    };

    const handleScroll = () => {
      requestAnimationFrame(updatePosition);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    updatePosition();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [reverse, scrollDistance, containerRef]);

  return (
    <div
      className={`flex-1 min-w-0 flex flex-col ${reverse ? "h-screen" : ""}`}
      style={reverse ? { flexDirection: "column-reverse" } : {}}
    >
      <div
        ref={listRef}
        className={`flex flex-col ${reverse ? "flex-col-reverse" : ""}`}
        style={{
          willChange: "transform",
          ...(reverse ? { transform: `translateY(${yPercent}%)` } : {}),
        }}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, isDark }: { product: ProductApi; isDark: boolean }) {
  const gallery = useMemo(() => {
    try {
      return product.galleryUrls ? JSON.parse(product.galleryUrls) : [];
    } catch {
      return [];
    }
  }, [product.galleryUrls]);
  const secondaryImage = gallery.length > 1 ? gallery[1] : null;

  const salePercentage = useMemo(() => {
    if (!product.originalPrice || Number(product.originalPrice) <= product.price) return null;
    const orig = Number(product.originalPrice);
    const curr = product.price;
    return Math.round(((orig - curr) / orig) * 100);
  }, [product.originalPrice, product.price]);

  return (
    <Link href={`/product/${product.id}`} className="group relative block w-full overflow-hidden">
      <div className="aspect-[6/7] overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative">
        <img
          src={product.imageUrl ?? ""}
          alt={product.name}
          className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
          style={{
            filter: isDark
              ? "saturate(0.96) contrast(1.02)"
              : "saturate(1.14) contrast(1.06) brightness(1.02)",
          }}
        />

        {secondaryImage && (
          <img
            src={secondaryImage}
            alt={`${product.name} alternate view`}
            className="absolute inset-0 w-full h-full object-cover opacity-0 transition-all duration-700 ease-out group-hover:opacity-100 group-hover:scale-105"
            style={{
              filter: isDark
                ? "saturate(0.96) contrast(1.02)"
                : "saturate(1.14) contrast(1.06) brightness(1.02)",
            }}
          />
        )}

        {salePercentage && (
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-red-600 border border-red-500 rounded-sm z-10 shadow-lg shadow-red-900/40">
            <span className="text-xs font-black tracking-widest text-white uppercase italic">
              -{salePercentage}% OFF
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700">
          <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.4em] text-white/90 font-bold">
                View Details
              </span>
              <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                {product.name}
              </h3>
            </div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-500 shadow-xl">
            <ArrowUpRight className="w-3.5 h-3.5 text-black" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default InfiniteScrollGallery;
