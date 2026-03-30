import type { MouseEvent, TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Link } from "wouter";

import { FeaturedProductCard } from "@/components/home/FeaturedProductCard";
import { formatPrice } from "@/lib/format";

interface FeaturedCollectionProps {
  featuredProducts: any[];
  isFeaturedSuccess: boolean;
  featureCollectionImages: string[];
  carouselIndex: number;
  isTransitioning: boolean;
  onCarouselNext: () => void;
  onCarouselPrev: () => void;
  onCarouselGoTo?: (index: number) => void;
  onTouchStart?: (e: TouchEvent<HTMLDivElement>) => void;
  onTouchMove?: (e: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: () => void;
  onMouseDown?: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseMove?: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (e: MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: () => void;
  config?: Record<string, any>;
}

function resolveFeaturedProducts(
  featuredProducts: any[],
  config?: Record<string, any>,
) {
  const configuredIds = Array.isArray(config?.productIds)
    ? config.productIds.map((id: unknown) => String(id))
    : [];

  if (!configuredIds.length) {
    return featuredProducts;
  }

  const configured = configuredIds
    .map((id) => featuredProducts.find((product) => String(product.id) === id))
    .filter(Boolean);

  return configured.length ? configured : featuredProducts;
}

function MaisonNocturneFeatured({
  featuredProducts,
  config,
}: {
  featuredProducts: any[];
  config?: Record<string, any>;
}) {
  const products = resolveFeaturedProducts(featuredProducts, config);
  const label = config?.label ?? "Featured Products";
  const title = config?.title ?? "Curated silhouettes for the new season.";
  const hint = config?.hint ?? "Drag to explore";

  return (
    <section className="py-20 sm:py-24" style={{ background: "var(--bg2)" }}>
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p
            className="text-[10px] uppercase tracking-[0.28em] text-[var(--gold)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {label}
          </p>
          <h2
            className="mt-4 text-balance leading-[0.98]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(34px, 5.4vw, 68px)",
              color: "var(--fg)",
            }}
          >
            {title}
          </h2>
        </div>

        <div className="mt-14 overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-5 px-1">
            {products.slice(0, 6).map((product: any, index: number) => {
              const colors = (() => {
                try {
                  const parsed = product.colorOptions ? JSON.parse(product.colorOptions) : [];
                  return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
                } catch {
                  return [];
                }
              })();
              const tag = product.saleActive
                ? { label: "Sale", bg: "#b91c1c", color: "#fff" }
                : index % 2 === 0
                  ? { label: "New", bg: "var(--gold)", color: "var(--bg)" }
                  : { label: "SS25", bg: "transparent", color: "var(--fg)" };

              return (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group p-card block shrink-0"
                  style={{
                    width: "clamp(320px, 33vw, 500px)",
                    scrollSnapAlign: "start",
                  }}
                >
                  <div className="relative overflow-hidden border border-[var(--border)] bg-black/20">
                    <div className="aspect-[3/4] overflow-hidden">
                      <img
                        src={product.imageUrl ?? ""}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06] group-hover:brightness-110"
                      />
                    </div>
                    <span
                      className="absolute left-3 top-3 px-3 py-1 text-[9px] uppercase tracking-[0.18em]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        background: tag.bg,
                        color: tag.color,
                        border: tag.bg === "transparent" ? "1px solid var(--border)" : "none",
                      }}
                    >
                      {tag.label}
                    </span>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-6 bg-gradient-to-t from-black/85 via-black/20 to-transparent p-5 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                      <div
                        className="inline-flex items-center gap-2 px-4 py-2"
                        style={{
                          background: "rgba(201,169,110,0.94)",
                          color: "var(--bg)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Quick Add
                      </div>
                    </div>
                  </div>
                  <div className="pt-4">
                    <h3
                      className="text-lg italic"
                      style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
                    >
                      {product.name}
                    </h3>
                    <p
                      className="mt-2 text-[11px] uppercase tracking-[0.18em]"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--gold)" }}
                    >
                      {formatPrice(product.price)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {colors.map((color: string, colorIndex: number) => (
                        <span
                          key={`${product.id}-${color}-${colorIndex}`}
                          className="h-[9px] w-[9px] rounded-full border border-white/20"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <p
          className="mt-6 flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {hint}
          <span className="rare-drag-arrow inline-block">→</span>
        </p>
      </div>
    </section>
  );
}

function NikeshDesignFeatured({
  featuredProducts,
  config,
}: {
  featuredProducts: any[];
  config?: Record<string, any>;
}) {
  const products = resolveFeaturedProducts(featuredProducts, config);
  const label = config?.label ?? "Featured Products";
  const title = config?.title ?? "An edit of the season's strongest silhouettes.";
  const hint = config?.hint ?? "Drag to explore →";

  return (
    <section className="products-wrap py-20 sm:py-24" style={{ background: "var(--bg2)" }}>
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="products-head reveal mb-12 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.28em] text-[var(--gold)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {label}
            </p>
            <h2
              className="mt-4 text-balance leading-[0.98]"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(34px, 5.4vw, 68px)",
                color: "var(--fg)",
              }}
            >
              {title}
            </h2>
          </div>
        </div>

        <div className="products-scroll overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-5 px-1">
            {products.slice(0, 6).map((product: any, index: number) => {
              const colors = (() => {
                try {
                  const parsed = product.colorOptions ? JSON.parse(product.colorOptions) : [];
                  return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
                } catch {
                  return [];
                }
              })();
              const tag = product.saleActive
                ? { label: "Sale", bg: "#b91c1c", color: "#fff" }
                : index % 3 === 0
                  ? { label: "New", bg: "var(--gold)", color: "var(--bg)" }
                  : { label: "SS25", bg: "transparent", color: "var(--fg)" };

              return (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group p-card block shrink-0"
                  style={{ width: "clamp(320px, 33vw, 500px)", scrollSnapAlign: "start" }}
                >
                  <div className="relative overflow-hidden border border-[var(--border)] bg-black/20">
                    <div className="aspect-[3/4] overflow-hidden">
                      <img
                        src={product.imageUrl ?? ""}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06] group-hover:brightness-110"
                      />
                    </div>
                    <span
                      className="absolute left-3 top-3 px-3 py-1 text-[9px] uppercase tracking-[0.18em]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        background: tag.bg,
                        color: tag.color,
                        border: tag.bg === "transparent" ? "1px solid var(--border)" : "none",
                      }}
                    >
                      {tag.label}
                    </span>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-6 bg-gradient-to-t from-black/85 via-black/20 to-transparent p-5 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                      <div
                        className="inline-flex items-center gap-2 px-4 py-2"
                        style={{
                          background: "rgba(201,169,110,0.94)",
                          color: "var(--bg)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Quick Add
                      </div>
                    </div>
                  </div>
                  <div className="pt-4">
                    <h3 className="text-lg italic" style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}>
                      {product.name}
                    </h3>
                    <p
                      className="mt-2 text-[11px] uppercase tracking-[0.18em]"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--gold)" }}
                    >
                      {formatPrice(product.price)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {colors.map((color: string, colorIndex: number) => (
                        <span
                          key={`${product.id}-${color}-${colorIndex}`}
                          className="h-[9px] w-[9px] rounded-full border border-white/20"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <p
          className="mt-6 flex items-center justify-end gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {hint}
        </p>
      </div>
    </section>
  );
}

export default function FeaturedCollection({
  featuredProducts,
  isFeaturedSuccess,
  featureCollectionImages,
  carouselIndex,
  isTransitioning,
  onCarouselNext,
  onCarouselPrev,
  onCarouselGoTo,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  config,
}: FeaturedCollectionProps) {
  void isFeaturedSuccess;
  void isTransitioning;
  const products = resolveFeaturedProducts(featuredProducts, config);

  if (config?.variant === "nikeshdesign-featured") {
    return <NikeshDesignFeatured featuredProducts={products} config={config} />;
  }

  if (config?.variant === "maison-nocturne") {
    return <MaisonNocturneFeatured featuredProducts={products} config={config} />;
  }

  return (
    <section className="py-20 sm:py-24">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="mb-16 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground mb-2">
            Editor's Choice
          </h2>
          <h3 className="text-4xl font-black uppercase tracking-tighter">Featured Collection</h3>
        </div>
        <Link
          href="/products"
          className="text-xs font-bold uppercase tracking-widest border-b border-black pb-1 hover:opacity-60 transition-opacity"
        >
          View All
        </Link>
        </div>

        <div
          className="group/carousel relative mb-16 aspect-[16/10] overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-900 md:aspect-[2/1] xl:aspect-[21/9] cursor-grab active:cursor-grabbing select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        >
          <div
            className="flex h-full transition-transform duration-600 ease-in-out"
            style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
          >
            {featureCollectionImages.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Featured collection image ${i + 1}`}
                className="h-full w-full shrink-0 object-cover object-center"
                draggable={false}
              />
            ))}
          </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onCarouselPrev();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onCarouselNext();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2.5 items-center bg-black/20 backdrop-blur-sm rounded-full px-3 py-2">
          {featureCollectionImages.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                onCarouselGoTo?.(i);
              }}
              className={`rounded-full transition-all duration-500 ease-out ${
                i === carouselIndex
                  ? "w-7 h-2.5 bg-white shadow-lg shadow-white/30"
                  : "w-2.5 h-2.5 bg-white/40 hover:bg-white/70 hover:scale-125"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {products.map((product, i) => (
            <FeaturedProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
