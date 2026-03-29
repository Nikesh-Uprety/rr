import { useState, useMemo, useEffect, useRef, type WheelEvent as ReactWheelEvent } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Minus, Plus, ShieldCheck, Truck, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchProductById, fetchProducts, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { Helmet } from "react-helmet-async";
import SizeFitGuide from "@/components/product/SizeFitGuide";

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s || !s.trim()) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function getDominantWheelDelta(deltaY: number, deltaX: number): number {
  return Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
}

export default function ProductDetail() {
  const [, params] = useRoute<{ id: string }>("/product/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const addItem = useCartStore((state) => state.addItem);
  const openCartSidebar = useCartStore((state) => state.openCartSidebar);

  const productId = params?.id ?? "";

  const { data: product, isLoading } = useQuery<ProductApi | null>({
    queryKey: ["products", productId],
    queryFn: () => fetchProductById(productId),
    enabled: !!productId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: relatedProductsRaw = [] } = useQuery<ProductApi[]>({
    queryKey: ["products", { category: product?.category, limit: 5 }],
    queryFn: () => fetchProducts({ category: product?.category || undefined, limit: 5 }),
    enabled: !!product?.category,
  });

  const relatedProducts = useMemo(() => {
    return (relatedProductsRaw || []).filter(p => p.id !== product?.id).slice(0, 4);
  }, [relatedProductsRaw, product?.id]);

  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [imageMotionTick, setImageMotionTick] = useState(0);
  const [imageMotionDirection, setImageMotionDirection] = useState<"down" | "up">("down");
  const [imageMotionDistance, setImageMotionDistance] = useState(1);
  const [mainImageScrollUnlocked, setMainImageScrollUnlocked] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const galleryCloseTimeoutRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const galleryWheelLockRef = useRef(false);
  const pageWheelLockRef = useRef(false);
  const mainImageViewportRef = useRef<HTMLDivElement | null>(null);

  const colors = useMemo(() => parseJsonArray(product?.colorOptions ?? undefined), [product?.colorOptions]);
  const stockBySize = product?.stockBySize ?? {};
  const configuredSizes = useMemo(
    () => parseJsonArray(product?.sizeOptions ?? undefined),
    [product?.sizeOptions],
  );
  const availableSizes = useMemo(() => {
    const ordered = new Set<string>();

    configuredSizes.forEach((size) => {
      const normalized = size.trim();
      if (normalized) ordered.add(normalized);
    });

    Object.keys(stockBySize).forEach((size) => {
      const normalized = size.trim();
      if (normalized) ordered.add(normalized);
    });

    (product?.variants ?? []).forEach((variant) => {
      const normalized = variant.size.trim();
      if (normalized) ordered.add(normalized);
    });

    return Array.from(ordered);
  }, [configuredSizes, product?.variants, stockBySize]);
  const galleryUrls = useMemo(() => parseJsonArray(product?.galleryUrls ?? undefined), [product?.galleryUrls]);
  const mainImageUrl = product?.imageUrl ?? "";
  const allImages = useMemo(() => {
    const list = mainImageUrl ? [mainImageUrl, ...galleryUrls] : [...galleryUrls];
    return list.length ? list : [""];
  }, [mainImageUrl, galleryUrls]);

  useEffect(() => {
    if (selectedImageIndex > allImages.length - 1) {
      setSelectedImageIndex(0);
    }
  }, [allImages.length, selectedImageIndex]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setImageMotionTick(0);
    setMainImageScrollUnlocked(allImages.length <= 1);
  }, [product?.id, allImages.length]);

  useEffect(() => {
    if (!isGalleryOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGalleryVisible(false);
      }
      if (event.key === "ArrowRight") {
        goToImage(selectedImageIndex + 1, { direction: "down" });
      }
      if (event.key === "ArrowLeft") {
        goToImage(selectedImageIndex - 1, { direction: "up" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allImages.length, isGalleryOpen, selectedImageIndex]);

  const shouldLockMainPageScroll = !isGalleryOpen && allImages.length > 1 && !mainImageScrollUnlocked;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isGalleryOpen || shouldLockMainPageScroll ? "hidden" : "";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isGalleryOpen, shouldLockMainPageScroll]);

  useEffect(() => {
    if (!isGalleryOpen) return;
    const raf = window.requestAnimationFrame(() => setIsGalleryVisible(true));
    return () => window.cancelAnimationFrame(raf);
  }, [isGalleryOpen]);

  useEffect(() => {
    if (isGalleryVisible || !isGalleryOpen) return;
    galleryCloseTimeoutRef.current = window.setTimeout(() => {
      setIsGalleryOpen(false);
    }, 220);
    return () => {
      if (galleryCloseTimeoutRef.current) {
        window.clearTimeout(galleryCloseTimeoutRef.current);
      }
    };
  }, [isGalleryOpen, isGalleryVisible]);

  useEffect(() => {
    if (isGalleryOpen || allImages.length <= 1 || mainImageScrollUnlocked) return;

    const onPageWheel = (event: WheelEvent) => {
      if (!mainImageViewportRef.current) return;

      event.preventDefault();
      event.stopPropagation();

      if (pageWheelLockRef.current) return;
      const delta = getDominantWheelDelta(event.deltaY, event.deltaX);
      if (Math.abs(delta) < 8) return;

      pageWheelLockRef.current = true;
      window.setTimeout(() => {
        pageWheelLockRef.current = false;
      }, 130);

      if (delta > 0) {
        if (selectedImageIndex < allImages.length - 1) {
          goToImage(selectedImageIndex + 1, { direction: "down" });
        } else {
          setMainImageScrollUnlocked(true);
        }
        return;
      }

      if (selectedImageIndex > 0) {
        goToImage(selectedImageIndex - 1, { direction: "up" });
      }
    };

    window.addEventListener("wheel", onPageWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onPageWheel);
    };
  }, [allImages.length, isGalleryOpen, mainImageScrollUnlocked, selectedImageIndex]);

  const effectiveColor = selectedColor ?? (colors[0] ?? null);
  const effectiveSize = selectedSize;
  const selectedVariantStock = selectedSize
    ? (stockBySize[selectedSize as keyof typeof stockBySize] ?? 0)
    : null;

  useEffect(() => {
    if (availableSizes.length === 0) {
      if (selectedSize !== null) {
        setSelectedSize(null);
      }
      return;
    }

    const hasValidSelectedSize =
      selectedSize !== null && availableSizes.includes(selectedSize) && (stockBySize[selectedSize] ?? 0) > 0;

    if (hasValidSelectedSize) {
      return;
    }

    const firstInStockSize = availableSizes.find((size) => (stockBySize[size] ?? 0) > 0) ?? null;
    if (firstInStockSize !== selectedSize) {
      setSelectedSize(firstInStockSize);
    }
  }, [availableSizes, selectedSize, stockBySize]);

  useEffect(() => {
    if (selectedVariantStock !== null && quantity > selectedVariantStock) {
      setQuantity(1);
    }
  }, [quantity, selectedVariantStock]);

  if (isLoading || !product) {
    if (isLoading) {
      return (
        <div className="min-h-[80vh] flex items-center justify-center">
          <BrandedLoader />
        </div>
      );
    }
    return (
      <div className="container mx-auto px-4 py-32 max-w-6xl text-center">
        <p className="uppercase text-[10px] tracking-widest font-bold text-muted-foreground">
          Product not found.
        </p>
        <Button asChild className="mt-6 rounded-none px-10">
          <Link href="/products">Back to collection</Link>
        </Button>
      </div>
    );
  }
  const hasSale = Boolean(product.saleActive) && Number(product.salePercentage) > 0;
  const effectiveUnitPrice = hasSale
    ? Number(product.price) * (1 - Number(product.salePercentage) / 100)
    : Number(product.price);

  const handleAddToCart = () => {
    addItem(
      {
        id: product.id,
        name: product.name,
        price: effectiveUnitPrice,
        originalPrice:
          hasSale ? Number(product.price) : null,
        salePercentage:
          product.salePercentage !== null && product.salePercentage !== undefined
            ? Number(product.salePercentage)
            : null,
        saleActive: hasSale,
        stock: product.stock,
        category: product.category ?? "",
        sku: "",
        images: allImages.filter(Boolean),
        variants: (product.variants ?? []).map((variant) => ({
          size: variant.size,
          color: variant.color ?? "Default",
        })),
      },
      { size: effectiveSize ?? "One Size", color: effectiveColor ?? "Default" },
      quantity,
    );
    const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
    toast({ title: "Added to bag", duration: isMobileOrTablet ? 1500 : undefined });
    openCartSidebar();
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setLocation("/checkout");
  };

  const goToImage = (
    index: number,
    options?: { direction?: "down" | "up"; distance?: number },
  ) => {
    if (!allImages.length) return;
    const currentIndex = selectedImageIndex;
    const next = (index + allImages.length) % allImages.length;
    if (next === currentIndex) return;
    const inferredDirection =
      options?.direction ??
      (next === 0 && currentIndex === allImages.length - 1
        ? "down"
        : next === allImages.length - 1 && currentIndex === 0
          ? "up"
          : next > currentIndex
            ? "down"
            : "up");
    const inferredDistance = Math.max(1, options?.distance ?? Math.abs(next - currentIndex));
    setImageMotionDirection(inferredDirection);
    setImageMotionDistance(inferredDistance);
    setImageMotionTick((prev) => prev + 1);
    setSelectedImageIndex(next);
  };

  const goToNextImage = () => {
    goToImage(selectedImageIndex + 1, { direction: "down", distance: 1 });
  };

  const goToPreviousImage = () => {
    goToImage(selectedImageIndex - 1, { direction: "up", distance: 1 });
  };

  const openGallery = () => {
    setIsGalleryOpen(true);
  };

  const closeGallery = () => {
    setIsGalleryVisible(false);
  };

  const handleGalleryWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (galleryWheelLockRef.current) return;

    const delta = getDominantWheelDelta(event.deltaY, event.deltaX);
    const threshold = 12;
    if (Math.abs(delta) < threshold) return;

    galleryWheelLockRef.current = true;
    window.setTimeout(() => {
      galleryWheelLockRef.current = false;
    }, 140);

    const isScrollDown = delta > 0;
    const isAtFirst = selectedImageIndex === 0;
    const isAtLast = selectedImageIndex === allImages.length - 1;

    if (isScrollDown) {
      if (isAtLast) {
        closeGallery();
        return;
      }
      goToImage(selectedImageIndex + 1, { direction: "down" });
      return;
    }

    if (isAtFirst) {
      closeGallery();
      return;
    }
    goToImage(selectedImageIndex - 1, { direction: "up" });
  };

  const handleMainImageWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (isGalleryOpen || allImages.length <= 1) return;
    const delta = getDominantWheelDelta(event.deltaY, event.deltaX);
    if (Math.abs(delta) < 8) return;

    event.preventDefault();
    event.stopPropagation();

    if (pageWheelLockRef.current) return;
    pageWheelLockRef.current = true;
    window.setTimeout(() => {
      pageWheelLockRef.current = false;
    }, 130);

    if (delta > 0) {
      if (selectedImageIndex < allImages.length - 1) {
        goToImage(selectedImageIndex + 1, { direction: "down", distance: 1 });
      } else if (!mainImageScrollUnlocked) {
        setMainImageScrollUnlocked(true);
      } else {
        goToImage(0, { direction: "down", distance: allImages.length - 1 });
      }
      return;
    }

    if (selectedImageIndex > 0) {
      goToImage(selectedImageIndex - 1, { direction: "up", distance: 1 });
    } else if (mainImageScrollUnlocked) {
      goToImage(allImages.length - 1, { direction: "up", distance: allImages.length - 1 });
    }
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": allImages.filter(Boolean),
    "description": product.description || product.shortDetails || "",
    "brand": {
      "@type": "Brand",
      "name": "Rare Atelier"
    },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": "NPR",
      "price": product.price,
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  };

  return (
    <div className="mt-10 w-full px-3 py-24 sm:px-6 lg:px-8 xl:px-10">
      <style>{`
        @keyframes product-image-slide-down {
          0% { transform: translateY(-72px) scale(0.992); opacity: 0; filter: blur(5px); }
          100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0px); }
        }
        @keyframes product-image-slide-up {
          0% { transform: translateY(72px) scale(0.992); opacity: 0; filter: blur(5px); }
          100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0px); }
        }
        @keyframes accordion-fade-down {
          0% { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Helmet>
        <title>{`${product.name} | Rare Atelier`}</title>
        <meta name="description" content={product.shortDetails || product.description?.substring(0, 160) || `Buy ${product.name} at Rare Atelier.`} />
        <meta property="og:title" content={`${product.name} | Rare Atelier`} />
        <meta property="og:description" content={product.shortDetails || `Rare Atelier: ${product.name}`} />
        <meta property="og:image" content={mainImageUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={window.location.href} />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <div className="grid gap-8 lg:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.9fr)_minmax(300px,1fr)] lg:gap-8 xl:gap-10">
        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <h1
            style={{
              fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif",
              fontWeight: 600,
              fontSize: "24px",
              lineHeight: "36px",
              color: "var(--brand-product-detail)",
            }}
            className="uppercase tracking-tight"
          >
            {product.name}
          </h1>

          {product.category ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {product.category}
            </p>
          ) : null}

          {product.shortDetails ? <p className="text-sm leading-relaxed text-muted-foreground">{product.shortDetails}</p> : null}

          <p
            style={{
              fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif",
              fontWeight: 600,
              fontSize: "24px",
              lineHeight: "36px",
              color: "var(--brand-product-detail)",
            }}
            className="flex flex-col items-start gap-1"
          >
            {product.saleActive && Number(product.salePercentage) > 0 ? (
              <>
                <span className="flex items-center gap-3">
                  <span className="font-black text-primary">
                    {formatPrice(Number(product.price) * (1 - Number(product.salePercentage) / 100))}
                  </span>
                  <span className="text-base font-medium text-muted-foreground line-through opacity-60">
                    {formatPrice(product.price)}
                  </span>
                </span>
                <span className="mt-1 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  {product.salePercentage}% OFF SALE
                </span>
              </>
            ) : (
              formatPrice(product.price)
            )}
          </p>

          <div className="space-y-2 border-t border-border pt-5">
            <details open className="group rounded-md border border-border/80 bg-background/70 px-3 py-2 transition-colors duration-200 open:border-foreground/20">
              <summary className="list-none cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground transition-colors duration-200 group-open:text-foreground" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-200 group-open:text-foreground">
                      Description
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-all duration-300 group-open:rotate-180 group-open:text-foreground" />
                </div>
              </summary>
              <div className="pt-3 pb-1 text-[15px] leading-7 text-foreground/90 [animation:accordion-fade-down_190ms_ease-out]">
                {product.description || "This piece is crafted in limited runs with a clean, tailored streetwear silhouette."}
              </div>
            </details>

            <details className="group rounded-md border border-border/80 bg-background/70 px-3 py-2 transition-colors duration-200 open:border-foreground/20">
              <summary className="list-none cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground transition-colors duration-200 group-open:text-foreground" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-200 group-open:text-foreground">
                      Product Details
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-all duration-300 group-open:rotate-180 group-open:text-foreground" />
                </div>
              </summary>
              <ul className="space-y-2 pt-3 pb-1 text-[14px] leading-7 text-muted-foreground [animation:accordion-fade-down_190ms_ease-out]">
                <li className="flex items-start gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-foreground/50" />
                  <span>Limited-run production with refined finishing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-foreground/50" />
                  <span>Built for daily wear with elevated streetwear structure.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-foreground/50" />
                  <span>Category: {product.category || "Rare Atelier Signature"}.</span>
                </li>
              </ul>
            </details>

            <details className="group rounded-md border border-border/80 bg-background/70 px-3 py-2 transition-colors duration-200 open:border-foreground/20">
              <summary className="list-none cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground transition-colors duration-200 group-open:text-foreground" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-200 group-open:text-foreground">
                      Shipping & Returns
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-all duration-300 group-open:rotate-180 group-open:text-foreground" />
                </div>
              </summary>
              <div className="space-y-2 pt-3 pb-1 text-[14px] leading-7 text-muted-foreground [animation:accordion-fade-down_190ms_ease-out]">
                <p>Shipping across Nepal in 2-5 business days.</p>
                <p>Easy exchange support for size issues when stock is available.</p>
              </div>
            </details>
          </div>
        </aside>

        <section className="space-y-4 lg:min-w-0">
          <div className="flex min-w-0 flex-col gap-4">
            <div
              ref={mainImageViewportRef}
              className="relative h-[72vh] min-h-[500px] overflow-hidden rounded-sm border border-border bg-black/5 sm:h-[76vh] lg:h-[86vh] dark:bg-black/40"
              onWheel={handleMainImageWheel}
              onClick={() => {
                if (didSwipeRef.current) {
                  didSwipeRef.current = false;
                  return;
                }
                openGallery();
              }}
              onTouchStart={(event) => {
                didSwipeRef.current = false;
                if (event.touches[0]) {
                  setTouchStartX(event.touches[0].clientX);
                }
              }}
              onTouchEnd={(event) => {
                if (touchStartX === null) return;
                const deltaX = event.changedTouches[0].clientX - touchStartX;
                if (Math.abs(deltaX) > 40) {
                  didSwipeRef.current = true;
                  if (deltaX < 0) goToNextImage();
                  if (deltaX > 0) goToPreviousImage();
                }
                setTouchStartX(null);
              }}
            >
              {product.stock === 0 ? (
                <div className="absolute left-3 top-3 z-20 bg-black/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white lg:left-4 lg:top-4 lg:px-4 lg:py-2">
                  Out of Stock
                </div>
              ) : null}

              {allImages.length > 1 ? (
                <div className="scrollbar-hide absolute left-3 top-1/2 z-20 hidden max-h-[74%] w-[70px] -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-md border border-white/30 bg-black/20 p-2 backdrop-blur-sm lg:flex">
                  {allImages.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        goToImage(i);
                      }}
                      className={`aspect-[4/5] w-full shrink-0 overflow-hidden rounded-sm border transition-all ${
                        selectedImageIndex === i
                          ? "border-white opacity-100"
                          : "border-white/30 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={url || ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}

              <img
                key={`main-${selectedImageIndex}-${imageMotionTick}`}
                src={allImages[selectedImageIndex] || ""}
                alt={`${product.name} - view ${selectedImageIndex + 1}`}
                loading={selectedImageIndex === 0 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full select-none object-cover object-center"
                style={{
                  animation:
                    imageMotionTick > 0
                      ? imageMotionDirection === "down"
                        ? `product-image-slide-down ${Math.max(180, 320 - Math.min(imageMotionDistance - 1, 4) * 30)}ms cubic-bezier(0.22, 1, 0.36, 1)`
                        : `product-image-slide-up ${Math.max(180, 320 - Math.min(imageMotionDistance - 1, 4) * 30)}ms cubic-bezier(0.22, 1, 0.36, 1)`
                      : "none",
                }}
              />
            </div>
          </div>

          {allImages.length > 1 ? (
            <div className="overflow-x-auto lg:hidden">
              <div className="flex min-w-max gap-2 pr-2">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToImage(i)}
                    className={`h-[64px] w-[52px] overflow-hidden rounded-sm border transition-all ${
                      selectedImageIndex === i ? "border-black dark:border-white" : "border-transparent opacity-70"
                    }`}
                    aria-label={`Select image ${i + 1}`}
                  >
                    <img src={url || ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          {colors.length > 0 ? (
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`h-8 min-w-[2rem] rounded-sm border px-3 text-xs font-medium transition-all ${
                      effectiveColor === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Size</p>
            <div className="mb-3 flex justify-start">
              <button
                onClick={() => setShowSizeGuide(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground underline decoration-foreground underline-offset-4 transition-opacity duration-200 hover:opacity-70"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                Size &amp; Fit Guide
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {availableSizes.map((size) => {
                const sizeStock = stockBySize[size] ?? 0;
                const isOutOfStock = sizeStock === 0;
                const isLowStock = sizeStock > 0 && sizeStock <= 5;
                const isSelected = selectedSize === size;

                return (
                  <div key={size} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => !isOutOfStock && setSelectedSize(size)}
                      disabled={isOutOfStock}
                      className={`relative h-12 w-12 rounded-md border text-sm font-medium transition-all duration-200 ${
                        isSelected
                          ? "border-foreground bg-foreground text-background"
                          : isOutOfStock
                            ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/40"
                            : "cursor-pointer border-border hover:border-foreground"
                      }`}
                    >
                      {size}
                      {isOutOfStock ? (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <svg
                            className="absolute inset-0 h-full w-full text-muted-foreground/30"
                            viewBox="0 0 48 48"
                            preserveAspectRatio="none"
                          >
                            <line x1="4" y1="4" x2="44" y2="44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </span>
                      ) : null}
                    </button>

                    {isOutOfStock ? (
                      <span className="text-center text-[10px] leading-tight text-muted-foreground/60">
                        Out of
                        <br />
                        stock
                      </span>
                    ) : null}

                    {isLowStock && !isOutOfStock ? (
                      <span className="text-center text-[10px] leading-tight text-amber-500">
                        Only {sizeStock}
                        <br />
                        left
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {selectedSize && selectedVariantStock !== null ? (
              <p
                className={`mt-2 text-xs ${
                  selectedVariantStock === 0
                    ? "text-red-500"
                    : selectedVariantStock <= 5
                      ? "text-amber-500"
                      : "text-muted-foreground"
                }`}
              >
                {selectedVariantStock === 0
                  ? "This size is not available in store"
                  : selectedVariantStock <= 5
                    ? `Only ${selectedVariantStock} units left in this size`
                    : `${selectedVariantStock} in stock`}
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Quantity</p>
            <div className="flex w-fit items-center rounded-sm border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input
                type="number"
                min={1}
                max={selectedVariantStock ?? 99}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="w-12 bg-transparent text-center text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity(Math.min(selectedVariantStock ?? 99, quantity + 1))}
                className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              data-testid="product-add-to-bag"
              onClick={handleAddToCart}
              disabled={!selectedSize || selectedVariantStock === 0}
              className="h-14 w-full rounded-none bg-black text-xs font-bold uppercase tracking-[0.2em] text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!selectedSize
                ? "Select a size"
                : selectedVariantStock === 0
                  ? "Out of Stock"
                  : "Add to Bag"}
            </Button>
            <Button
              data-testid="product-buy-now"
              variant="outline"
              onClick={handleBuyNow}
              disabled={!selectedSize || selectedVariantStock === 0}
              className="h-14 w-full rounded-none border-zinc-900 text-xs font-bold uppercase tracking-[0.2em] text-zinc-900 transition-all hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
            >
              Buy Now
            </Button>
          </div>
        </aside>
      </div>

      <SizeFitGuide open={showSizeGuide} onClose={() => setShowSizeGuide(false)} />

      <div className="mt-24 pt-16 border-t border-gray-100">
        <h2 className="text-xl font-black uppercase tracking-tighter text-center mb-12">
          You May Also Like
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {relatedProducts.map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group block"
              onClick={() => {
                window.scrollTo(0, 0);
              }}
            >
              <div className="aspect-[3/4] overflow-hidden bg-neutral-100 dark:bg-neutral-900 mb-4 relative rounded-sm">
                <img
                  src={p.imageUrl ?? ""}
                  alt={p.name}
                  loading="lazy"
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold truncate uppercase tracking-tight">{p.name}</h3>
                <div className="flex items-center gap-2">
                  <p className={`text-xs uppercase tracking-widest ${p.saleActive ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {p.saleActive && Number(p.salePercentage) > 0 
                      ? formatPrice(Number(p.price) * (1 - Number(p.salePercentage) / 100))
                      : formatPrice(p.price)
                    }
                  </p>
                  {p.saleActive && Number(p.salePercentage) > 0 && (
                    <p className="text-[10px] text-muted-foreground line-through opacity-60">
                      {formatPrice(p.price)}
                    </p>
                  )}
                  {p.saleActive && Number(p.salePercentage) > 0 && (
                    <span className="bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-sm shadow-xl inline-block ml-1">
                      {p.salePercentage}% OFF
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {isGalleryOpen && (
        <div
          className={`fixed inset-0 z-[80] flex items-center justify-center bg-black/35 backdrop-blur-[1.5px] transition-opacity duration-200 ${
            isGalleryVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeGallery}
          onWheel={handleGalleryWheel}
        >
          <button
            type="button"
            className="absolute right-5 top-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-black transition-colors hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              closeGallery();
            }}
            aria-label="Close gallery"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className={`relative flex h-full w-full items-center justify-center px-6 pb-24 pt-8 transition-transform duration-200 lg:px-14 lg:pb-28 ${
              isGalleryVisible ? "scale-100" : "scale-95"
            }`}
          >
            <div className="absolute left-5 top-6 z-40 text-[10px] font-bold uppercase tracking-[0.2em] text-white/85">
              {String(selectedImageIndex + 1).padStart(2, "0")} / {String(allImages.length).padStart(2, "0")}
            </div>

            {allImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    goToPreviousImage();
                  }}
                  className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white transition-colors hover:bg-black/45 lg:left-8 lg:h-12 lg:w-12"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    goToNextImage();
                  }}
                  className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white transition-colors hover:bg-black/45 lg:right-8 lg:h-12 lg:w-12"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div
              className="relative h-full w-full max-w-[min(92vw,1600px)]"
              onClick={(event) => event.stopPropagation()}
            >
              {allImages.map((url, idx) => (
                <img
                  key={`modal-${url}-${idx}`}
                  src={url || ""}
                  alt={`${product.name} fullscreen view ${idx + 1}`}
                  loading="lazy"
                  className={`absolute inset-0 h-full w-full object-contain transition-[opacity,transform] duration-300 ease-out ${
                    selectedImageIndex === idx ? "translate-y-0 opacity-100" : "-translate-y-5 opacity-0"
                  }`}
                />
              ))}
            </div>

            {allImages.length > 1 ? (
              <div className="scrollbar-hide absolute bottom-6 left-1/2 z-30 w-[min(88vw,860px)] -translate-x-1/2 overflow-x-auto">
                <div className="flex min-w-max items-center gap-2 rounded-md border border-white/20 bg-black/25 p-2 backdrop-blur-sm">
                  {allImages.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        goToImage(i);
                      }}
                      className={`h-16 w-12 overflow-hidden rounded-sm border transition-all lg:h-20 lg:w-16 ${
                        selectedImageIndex === i ? "border-white opacity-100" : "border-white/30 opacity-70 hover:opacity-100"
                      }`}
                      aria-label={`Open image ${i + 1}`}
                    >
                      <img src={url || ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
