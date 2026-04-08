import { useState, useRef, type MouseEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, X, ZoomIn } from "lucide-react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";

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

function normalizeFeatureCollectionImages(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
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

function ImageGalleryModal({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef(0);

  const goNext = () => setCurrentIndex((i) => (i + 1) % images.length);
  const goPrev = () => setCurrentIndex((i) => (i - 1 + images.length) % images.length);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center"
        onClick={onClose}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-110"
          aria-label="Close gallery"
        >
          <X className="h-6 w-6" />
        </button>

        <div
          className="absolute inset-0 z-10"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            const deltaX = touchStartX.current - event.changedTouches[0].clientX;
            if (Math.abs(deltaX) < 48) return;
            if (deltaX > 0) goNext();
            else goPrev();
          }}
        />

        <div className="absolute left-1/2 top-6 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 backdrop-blur-xl">
          <ZoomIn className="h-4 w-4 text-white/70" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
            Lookbook Viewer
          </span>
        </div>

        <div className="absolute bottom-8 left-1/2 z-30 flex w-[min(92vw,980px)] -translate-x-1/2 flex-col items-center gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/20 md:flex"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/20 md:flex"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/8 px-4 py-2 backdrop-blur-xl">
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 md:hidden"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/70">
              {currentIndex + 1} / {images.length}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 md:hidden"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex max-w-full gap-3 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 sm:h-20 sm:w-14 ${
                  i === currentIndex
                    ? "scale-100 border-white/70 shadow-[0_12px_30px_rgba(255,255,255,0.14)]"
                    : "scale-95 border-white/10 opacity-65 hover:opacity-100"
                }`}
                aria-label={`Go to image ${i + 1}`}
              >
                <img src={src} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
                <div className={`absolute inset-0 transition-colors ${i === currentIndex ? "bg-transparent" : "bg-black/30"}`} />
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.img
            key={images[currentIndex]}
            src={images[currentIndex]}
            alt={`Gallery image ${currentIndex + 1}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
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
    <section className="products-wrap py-10 sm:py-14" style={{ background: "var(--bg2)" }}>
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="products-head reveal mb-7 flex flex-col gap-2.5 md:mb-10 md:flex-row md:items-end md:justify-between">
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

        <div className="products-scroll relative left-1/2 w-screen -translate-x-1/2 overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:overflow-visible md:pb-0">
          <div className="grid min-w-full grid-cols-2 gap-3 px-3 sm:px-4 md:flex md:min-w-max md:gap-5 md:px-6 lg:px-8 xl:px-10">
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
                  className="group p-card block w-full md:w-[clamp(320px,33vw,500px)] md:shrink-0"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <div className="relative overflow-hidden rounded-[1.15rem] border border-white/85 bg-white p-1.5 shadow-[0_20px_44px_-28px_rgba(15,23,42,0.34)] dark:border-white/14 dark:bg-[#121212]">
                    <div className="aspect-[3/4] overflow-hidden rounded-[0.95rem] border border-white/15 bg-black/20">
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
                  <div className="pt-3.5">
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
          className="mt-5 flex items-center justify-end gap-3 pr-2 text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]"
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
  const collectionImages = normalizeFeatureCollectionImages(featureCollectionImages);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);

  if (config?.variant === "nikeshdesign-featured") {
    return <NikeshDesignFeatured featuredProducts={products} config={config} />;
  }

  if (config?.variant === "maison-nocturne") {
    return <MaisonNocturneFeatured featuredProducts={products} config={config} />;
  }

  return (
    <section className="py-10 sm:py-14">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="mb-7 flex items-end justify-between md:mb-10">
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

        {/* Lookbook Carousel - Clickable images with gallery */}
        <div
          className="group/carousel relative left-1/2 mb-8 aspect-[4/5] w-screen -translate-x-1/2 overflow-hidden bg-neutral-100 dark:bg-neutral-900 sm:aspect-[16/10] md:mb-10 md:aspect-[2/1] xl:aspect-[21/9] cursor-grab active:cursor-grabbing select-none"
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
            {collectionImages.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => { setGalleryStartIndex(i); setGalleryOpen(true); }}
                className="h-full w-full shrink-0 relative group/slide"
              >
                <img
                  src={src}
                  alt={`Featured collection image ${i + 1}`}
                  className="h-full w-full object-cover object-center transition-transform duration-700 group-hover/slide:scale-105"
                  draggable={false}
                />
                {/* Hover overlay with zoom icon */}
                <div className="absolute inset-0 bg-black/0 group-hover/slide:bg-black/30 transition-all duration-500 flex items-center justify-center">
                  <div className="opacity-0 group-hover/slide:opacity-100 transition-all duration-500 transform translate-y-4 group-hover/slide:translate-y-0">
                    <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white">
                      <ZoomIn className="h-5 w-5" />
                      <span className="text-xs font-mono uppercase tracking-[0.2em]">Explore</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

        <button
          onClick={(e) => { e.stopPropagation(); onCarouselPrev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onCarouselNext(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2.5 items-center bg-black/20 backdrop-blur-sm rounded-full px-3 py-2">
          {collectionImages.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onCarouselGoTo?.(i); }}
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6">
          {products.map((product, i) => (
            <FeaturedProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </div>

      {/* Full-screen image gallery modal */}
      {galleryOpen && (
        <ImageGalleryModal
          images={collectionImages}
          initialIndex={galleryStartIndex}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </section>
  );
}
