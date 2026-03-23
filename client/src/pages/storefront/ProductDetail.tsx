import { useState, useMemo, useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { fetchProductById, fetchProducts, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { Helmet } from "react-helmet-async";

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s || !s.trim()) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Map a point in the container to image % for background-position; matches CSS object-fit: cover + center. */
function objectCoverPointToImagePercent(
  px: number,
  py: number,
  cw: number,
  ch: number,
  iw: number,
  ih: number,
): { x: number; y: number } {
  if (!(iw > 0 && ih > 0 && cw > 0 && ch > 0)) {
    return { x: (px / cw) * 100, y: (py / ch) * 100 };
  }
  const scale = Math.max(cw / iw, ch / ih);
  const rw = iw * scale;
  const rh = ih * scale;
  const ox = (cw - rw) / 2;
  const oy = (ch - rh) / 2;
  const u = (px - ox) / scale;
  const v = (py - oy) / scale;
  const clampedU = Math.min(Math.max(u, 0), iw);
  const clampedV = Math.min(Math.max(v, 0), ih);
  return { x: (clampedU / iw) * 100, y: (clampedV / ih) * 100 };
}

/** Client coords relative to main image content box (inside border); used for hit-test and object-cover mapping. */
function pointerInMainContentBox(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): { inside: boolean; x: number; y: number; cw: number; ch: number } {
  // Small tolerance prevents flicker when pointer sits exactly on an edge pixel.
  const EDGE_TOLERANCE_PX = 1.5;
  const rect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  const bl = parseFloat(cs.borderLeftWidth) || 0;
  const bt = parseFloat(cs.borderTopWidth) || 0;
  const cw = el.clientWidth;
  const ch = el.clientHeight;
  const x = clientX - rect.left - bl;
  const y = clientY - rect.top - bt;
  const inside =
    x >= -EDGE_TOLERANCE_PX &&
    y >= -EDGE_TOLERANCE_PX &&
    x <= cw + EDGE_TOLERANCE_PX &&
    y <= ch + EDGE_TOLERANCE_PX;
  return { inside, x, y, cw, ch };
}

export default function ProductDetail() {
  const [, params] = useRoute<{ id: string }>("/product/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const addItem = useCartStore((state) => state.addItem);

  const productId = params?.id ?? "";

  const { data: product, isLoading } = useQuery<ProductApi | null>({
    queryKey: ["products", productId],
    queryFn: () => fetchProductById(productId),
    enabled: !!productId,
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
  const [slideTrigger, setSlideTrigger] = useState(0);
  const [hoverMedia, setHoverMedia] = useState(false);
  const [pointerOnMain, setPointerOnMain] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [currentImageSrc, setCurrentImageSrc] = useState("");
  const [panelZoomEnabled, setPanelZoomEnabled] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [sizeRecommendation, setSizeRecommendation] = useState<string | null>(null);
  const galleryCloseTimeoutRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const mainImageRef = useRef<HTMLDivElement | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const activeImageNaturalRef = useRef({ w: 0, h: 0 });
  const selectedMainImgRef = useRef<HTMLImageElement | null>(null);

  const colors = useMemo(() => parseJsonArray(product?.colorOptions ?? undefined), [product?.colorOptions]);
  const sizes = useMemo(() => parseJsonArray(product?.sizeOptions ?? undefined), [product?.sizeOptions]);
  const galleryUrls = useMemo(() => parseJsonArray(product?.galleryUrls ?? undefined), [product?.galleryUrls]);
  const mainImageUrl = product?.imageUrl ?? "";
  const allImages = useMemo(() => {
    const list = mainImageUrl ? [mainImageUrl, ...galleryUrls] : [...galleryUrls];
    return list.length ? list : [""];
  }, [mainImageUrl, galleryUrls]);
  const displayImage = allImages[selectedImageIndex] ?? allImages[0];
  const lensHalf = 65;
  const zoomLevel = 2.5;

  useEffect(() => {
    setCurrentImageSrc(displayImage || "");
  }, [displayImage]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
    const update = () => setPanelZoomEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (panelZoomEnabled) return;
    setHoverMedia(false);
    setPointerOnMain(false);
  }, [panelZoomEnabled]);

  useEffect(() => {
    if (selectedImageIndex > allImages.length - 1) {
      setSelectedImageIndex(0);
    }
  }, [allImages.length, selectedImageIndex]);

  useEffect(() => {
    if (allImages.length <= 1 || !allImages[0]) return;
    if (isGalleryOpen) return;
    const interval = window.setInterval(() => {
      setSelectedImageIndex((prev) => (prev + 1) % allImages.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [allImages, slideTrigger, isGalleryOpen]);

  useEffect(() => {
    if (!isGalleryOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGalleryVisible(false);
      }
      if (event.key === "ArrowRight") {
        setSelectedImageIndex((prev) => (prev + 1) % allImages.length);
        setSlideTrigger((prev) => prev + 1);
      }
      if (event.key === "ArrowLeft") {
        setSelectedImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
        setSlideTrigger((prev) => prev + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allImages.length, isGalleryOpen]);

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

  const applyMainPointerFromClient = (clientX: number, clientY: number) => {
    lastPointerRef.current = { x: clientX, y: clientY };
    if (!panelZoomEnabled || !hoverMedia) return;
    const el = mainImageRef.current;
    if (!el) return;
    const { inside, x, y, cw, ch } = pointerInMainContentBox(el, clientX, clientY);
    if (inside) {
      setPointerOnMain(true);
      setLensPos({ x: x - lensHalf, y: y - lensHalf });
      const { w: iw, h: ih } = activeImageNaturalRef.current;
      const { x: zx, y: zy } = objectCoverPointToImagePercent(x, y, cw, ch, iw, ih);
      setZoomPos({ x: Number(zx.toFixed(2)), y: Number(zy.toFixed(2)) });
    } else {
      setPointerOnMain(false);
    }
  };

  useLayoutEffect(() => {
    if (!product) return;
    const img = selectedMainImgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      activeImageNaturalRef.current = { w: img.naturalWidth, h: img.naturalHeight };
    } else {
      activeImageNaturalRef.current = { w: 0, h: 0 };
    }
    const { x: lx, y: ly } = lastPointerRef.current;
    applyMainPointerFromClient(lx, ly);
  }, [product?.id, selectedImageIndex, displayImage, panelZoomEnabled, hoverMedia]);

  useEffect(() => {
    if (!product) return;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    let cancelled = false;
    let attachAttempts = 0;

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (cancelled) return;
        const { x, y } = lastPointerRef.current;
        applyMainPointerFromClient(x, y);
      });
    };

    const attach = () => {
      const el = mainImageRef.current;
      if (!el) {
        if (attachAttempts < 60) {
          attachAttempts += 1;
          raf = requestAnimationFrame(attach);
        }
        return;
      }
      ro = new ResizeObserver(schedule);
      ro.observe(el);
    };

    attach();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [product?.id, panelZoomEnabled, hoverMedia]);

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

  const effectiveColor = selectedColor ?? (colors[0] ?? null);
  const effectiveSize = selectedSize ?? (sizes[0] ?? null);

  const handleAddToCart = () => {
    addItem(
      {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        stock: product.stock,
        category: product.category ?? "",
        sku: "",
        images: allImages.filter(Boolean),
        variants: [],
      },
      { size: effectiveSize ?? "One Size", color: effectiveColor ?? "Default" },
      quantity,
    );
    const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
    toast({ title: "Added to bag", duration: isMobileOrTablet ? 1500 : undefined });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setLocation("/checkout");
  };

  const resetSlideshow = () => {
    setSlideTrigger((prev) => prev + 1);
  };

  const goToImage = (index: number, manual = false) => {
    if (!allImages.length) return;
    const next = (index + allImages.length) % allImages.length;
    setSelectedImageIndex(next);
    if (manual) resetSlideshow();
  };

  const goToNextImage = (manual = false) => {
    goToImage(selectedImageIndex + 1, manual);
  };

  const goToPreviousImage = (manual = false) => {
    goToImage(selectedImageIndex - 1, manual);
  };

  const openGallery = () => {
    setIsGalleryOpen(true);
  };

  const closeGallery = () => {
    setIsGalleryVisible(false);
  };

  const getSizeRecommendation = () => {
    const parsedWeight = Number(weightKg);
    const parsedFt = Number(heightFt);
    const parsedIn = Number(heightIn);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setSizeRecommendation("Please enter a valid weight in kg.");
      return;
    }

    const hasHeight = Number.isFinite(parsedFt) && parsedFt >= 0 && Number.isFinite(parsedIn) && parsedIn >= 0;
    const heightNote = hasHeight ? ` for ${parsedFt}'${parsedIn}"` : "";

    if (parsedWeight < 60) {
      setSizeRecommendation(`Recommended size${heightNote}: S/M`);
      return;
    }
    if (parsedWeight <= 75) {
      setSizeRecommendation(`Recommended size${heightNote}: M/L`);
      return;
    }
    if (parsedWeight <= 90) {
      setSizeRecommendation(`Recommended size${heightNote}: L/XL`);
      return;
    }
    setSizeRecommendation(`Recommended size${heightNote}: XL`);
  };

  const handleMainImagePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (!panelZoomEnabled) return;
    const el = mainImageRef.current;
    if (!el) return;
    const { inside } = pointerInMainContentBox(el, event.clientX, event.clientY);
    if (!inside) return;
    setHoverMedia(true);
    applyMainPointerFromClient(event.clientX, event.clientY);
  };

  const handleMainImagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!panelZoomEnabled) return;
    if (event.pointerType === "touch") return;
    const el = mainImageRef.current;
    if (!el) return;
    const { inside } = pointerInMainContentBox(el, event.clientX, event.clientY);
    if (!inside) {
      setHoverMedia(false);
      setPointerOnMain(false);
      return;
    }
    if (!hoverMedia) setHoverMedia(true);
    applyMainPointerFromClient(event.clientX, event.clientY);
  };

  const handleMainImagePointerLeave = () => {
    if (!panelZoomEnabled) return;
    setHoverMedia(false);
    setPointerOnMain(false);
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
    <div className="container mx-auto px-4 py-24 max-w-6xl mt-10">
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
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
        <div className="flex w-full flex-col gap-4 lg:w-3/5 lg:flex-row lg:items-start lg:gap-6">
          {allImages.length > 1 && (
            <div className="scrollbar-hide hidden max-h-[min(100%,70vh)] w-[72px] shrink-0 flex-col gap-2 self-start overflow-y-auto lg:flex">
              {allImages.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => goToImage(i, true)}
                  onClick={() => goToImage(i, true)}
                  className={`aspect-[4/5] w-full shrink-0 overflow-hidden rounded-sm border-2 bg-muted transition-all ${
                    selectedImageIndex === i
                      ? "border-black border-opacity-100 dark:border-white"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={url || ""} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-4">
              <div
                ref={mainImageRef}
                className={`relative box-border aspect-[4/5] overflow-hidden rounded-sm border border-border bg-muted lg:min-h-0 lg:flex-1 ${
                  panelZoomEnabled ? "cursor-pointer lg:cursor-crosshair" : "cursor-pointer"
                }`}
                onClick={() => {
                  if (didSwipeRef.current) {
                    didSwipeRef.current = false;
                    return;
                  }
                  if (panelZoomEnabled) return;
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
                    if (deltaX < 0) goToNextImage(true);
                    if (deltaX > 0) goToPreviousImage(true);
                  }
                  setTouchStartX(null);
                }}
                onPointerEnter={handleMainImagePointerEnter}
                onPointerMove={handleMainImagePointerMove}
                onPointerLeave={handleMainImagePointerLeave}
              >
                <div className="absolute inset-0 overflow-hidden">
                  {product.stock === 0 && (
                    <div className="absolute left-3 top-3 z-20 bg-black/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white lg:left-4 lg:top-4 lg:px-4 lg:py-2">
                      Out of Stock
                    </div>
                  )}

                  {allImages.map((url, idx) => (
                    <img
                      key={`${url}-${idx}`}
                      ref={selectedImageIndex === idx ? selectedMainImgRef : undefined}
                      src={url || ""}
                      alt={`${product.name} - view ${idx + 1}`}
                      className={`absolute inset-0 h-full w-full select-none object-cover object-center transition-opacity duration-700 ${
                        selectedImageIndex === idx ? "opacity-100" : "opacity-0"
                      }`}
                      onLoad={(e) => {
                        if (idx !== selectedImageIndex) return;
                        const t = e.currentTarget;
                        activeImageNaturalRef.current = {
                          w: t.naturalWidth,
                          h: t.naturalHeight,
                        };
                        applyMainPointerFromClient(lastPointerRef.current.x, lastPointerRef.current.y);
                      }}
                    />
                  ))}
                </div>

                {panelZoomEnabled && pointerOnMain && currentImageSrc ? (
                  <div
                    className="pointer-events-none absolute z-30 hidden rounded-full border border-black/15 lg:block dark:border-white/40"
                    style={{
                      width: 130,
                      height: 130,
                      left: lensPos.x,
                      top: lensPos.y,
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[rgba(255,255,255,0.2)]" />
                      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[rgba(255,255,255,0.2)]" />
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                className={`hidden min-h-0 shrink-0 flex-col justify-end overflow-hidden transition-opacity duration-150 ease-out lg:flex lg:w-[min(36vw,420px)] ${
                  panelZoomEnabled && hoverMedia ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                aria-hidden
              >
                <div className="box-border aspect-[4/5] w-full max-w-full overflow-hidden rounded-sm border border-border bg-muted">
                  <div
                    className="h-full w-full"
                    style={
                      hoverMedia && currentImageSrc
                        ? {
                            backgroundImage: `url("${currentImageSrc}")`,
                            backgroundSize: `${zoomLevel * 100}%`,
                            backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                            backgroundRepeat: "no-repeat",
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>

            {allImages.length > 1 && (
              <div className="mt-0 overflow-x-auto lg:hidden">
                <div className="flex min-w-max gap-2 pr-2">
                  {allImages.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToImage(i, true)}
                      className={`h-[64px] w-[52px] overflow-hidden rounded-sm border transition-all ${
                        selectedImageIndex === i ? "border-black dark:border-white" : "border-transparent opacity-70"
                      }`}
                      aria-label={`Select image ${i + 1}`}
                    >
                      <img src={url || ""} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Details right column */}
        <div className="flex-1 min-w-0 lg:max-w-[400px] lg:pl-6 lg:pt-4">
          <h1 
            style={{
              fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              lineHeight: '36px',
              color: 'var(--brand-product-detail)'
            }}
            className="uppercase tracking-tight mb-2"
          >
            {product.name}
          </h1>
          {product.shortDetails && (
            <p className="text-sm text-muted-foreground mb-4">
              {product.shortDetails}
            </p>
          )}
          <p 
            style={{
              fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              lineHeight: '36px',
              color: 'var(--brand-product-detail)'
            }}
            className="mb-8 flex flex-col items-start gap-1"
          >
            {product.saleActive && Number(product.salePercentage) > 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-primary font-black">
                    {formatPrice(Number(product.price) * (1 - Number(product.salePercentage) / 100))}
                  </span>
                  <span className="text-base text-muted-foreground line-through font-medium opacity-60">
                    {formatPrice(product.price)}
                  </span>
                </div>
                <div className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 mt-2">
                  {product.salePercentage}% OFF SALE
                </div>
              </>
            ) : (
              formatPrice(product.price)
            )}
          </p>

          <div className="space-y-6">
            {colors.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-bold">
                  Color
                </p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`min-w-[2rem] h-8 px-3 border text-xs font-medium transition-all rounded-sm ${
                        effectiveColor === c
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <Sheet open={isSizeGuideOpen} onOpenChange={setIsSizeGuideOpen}>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-bold">
                    Size
                  </p>
                  <div className="flex justify-end mb-3">
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-[0.2em] font-light text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors"
                      >
                        Size &amp; Fit Guide &#8594;
                      </button>
                    </SheetTrigger>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSize(s)}
                        className={`w-12 h-10 border text-xs font-medium transition-all rounded-sm ${
                          effectiveSize === s
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <SheetContent
                  side="right"
                  className="w-full sm:max-w-md md:max-w-lg p-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90"
                >
                  <div className="h-full overflow-y-auto px-5 py-6 sm:px-7 sm:py-8">
                    <SheetTitle className="text-3xl font-semibold tracking-tight mb-6">
                      Size &amp; Fit Guide
                    </SheetTitle>

                    <div className="border border-border/70 rounded-sm p-4 sm:p-5 mb-6">
                      <h3 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-3">
                        Our Models
                      </h3>
                      <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
                        <p>Male Model: 5&apos;11&quot; height · 72kg · wears size XL</p>
                        <p>Female Model: 5&apos;3&quot; height · 54kg · wears size M</p>
                      </div>
                    </div>

                    <div className="border border-border/70 rounded-sm p-4 sm:p-5 mb-6">
                      <h3 className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
                        Size Recommendation Tool
                      </h3>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={heightFt}
                          onChange={(event) => setHeightFt(event.target.value)}
                          placeholder="Height (ft)"
                          className="h-10 px-3 border border-border bg-background text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={heightIn}
                          onChange={(event) => setHeightIn(event.target.value)}
                          placeholder="Height (in)"
                          className="h-10 px-3 border border-border bg-background text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={weightKg}
                          onChange={(event) => setWeightKg(event.target.value)}
                          placeholder="Weight (kg)"
                          className="h-10 px-3 border border-border bg-background text-sm rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={getSizeRecommendation}
                        className="w-full h-10 rounded-none uppercase tracking-[0.2em] text-[10px] font-bold"
                      >
                        Get Size Recommendation
                      </Button>
                      {sizeRecommendation && (
                        <p className="mt-3 text-sm text-foreground/90">{sizeRecommendation}</p>
                      )}
                    </div>

                    <div className="border border-border/70 rounded-sm overflow-hidden">
                      <h3 className="text-sm uppercase tracking-[0.2em] text-muted-foreground px-4 py-3 border-b border-border/70">
                        Size Chart
                      </h3>
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr className="text-left">
                            <th className="px-4 py-3 font-medium border-b border-border/70">Size</th>
                            <th className="px-4 py-3 font-medium border-b border-border/70">Chest</th>
                            <th className="px-4 py-3 font-medium border-b border-border/70">Length</th>
                            <th className="px-4 py-3 font-medium border-b border-border/70">Shoulder</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-background">
                            <td className="px-4 py-3 border-b border-border/60">M</td>
                            <td className="px-4 py-3 border-b border-border/60">42 inch</td>
                            <td className="px-4 py-3 border-b border-border/60">26.5 inch</td>
                            <td className="px-4 py-3 border-b border-border/60">18.5 inch</td>
                          </tr>
                          <tr className="bg-muted/20">
                            <td className="px-4 py-3 border-b border-border/60">L</td>
                            <td className="px-4 py-3 border-b border-border/60">44 inch</td>
                            <td className="px-4 py-3 border-b border-border/60">27.5 inch</td>
                            <td className="px-4 py-3 border-b border-border/60">20.5 inch</td>
                          </tr>
                          <tr className="bg-background">
                            <td className="px-4 py-3">XL</td>
                            <td className="px-4 py-3">46 inch</td>
                            <td className="px-4 py-3">28.5 inch</td>
                            <td className="px-4 py-3">22.5 inch</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-bold">
                Quantity
              </p>
              <div className="flex items-center border border-gray-200 w-fit rounded-sm">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-10 text-center text-sm">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="w-full h-14 bg-black text-white hover:bg-gray-900 rounded-none uppercase tracking-[0.2em] text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {product.stock === 0 ? "Out of Stock" : "Add to Bag"}
              </Button>
              <Button
                variant="outline"
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                className="w-full h-14 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 rounded-none uppercase tracking-[0.2em] text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buy Now
              </Button>
            </div>

            <div className="pt-8 space-y-4 border-t border-gray-100">
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                Product Details
              </h4>
              {product.description && (
                <p className="text-sm text-foreground leading-relaxed">
                  {product.description}
                </p>
              )}
              <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
                <li>Fit: Regular fit, designed for comfort and style.</li>
                <li>Material: 100% premium combed cotton.</li>
                <li>Construction: Double-needle hems for durability.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

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
          className={`fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 lg:p-10 transition-opacity duration-200 ${
            isGalleryVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeGallery}
        >
          <button
            type="button"
            className="absolute top-5 right-5 w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50"
            onClick={(e) => {
              e.stopPropagation();
              closeGallery();
            }}
            aria-label="Close gallery"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className={`relative w-full max-w-6xl h-full max-h-[92vh] flex flex-col items-center justify-center transition-transform duration-200 ${
              isGalleryVisible ? "scale-100" : "scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {allImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goToPreviousImage(true)}
                  className="absolute left-0 lg:-left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goToNextImage(true)}
                  className="absolute right-0 lg:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="relative w-full h-full max-h-[78vh]">
              {allImages.map((url, idx) => (
                <img
                  key={`modal-${url}-${idx}`}
                  src={url || ""}
                  alt={`${product.name} fullscreen view ${idx + 1}`}
                  className={`absolute inset-0 m-auto max-w-full max-h-full object-contain rounded-sm shadow-2xl transition-opacity duration-300 ${
                    selectedImageIndex === idx ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>

            {allImages.length > 1 && (
              <div className="w-full max-w-4xl mt-5 overflow-x-auto">
                <div className="flex gap-2 min-w-max px-1">
                  {allImages.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goToImage(i, true)}
                      className={`h-16 w-12 lg:h-20 lg:w-16 rounded-sm overflow-hidden border transition-all ${
                        selectedImageIndex === i ? "border-white" : "border-white/20 opacity-70 hover:opacity-100"
                      }`}
                      aria-label={`Open image ${i + 1}`}
                    >
                      <img src={url || ""} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
