import { lazy, Suspense, useState, useMemo, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/store/cart";
import { useThemeStore } from "@/store/theme";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronLeft, FileText, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchProductById, fetchProducts, type ProductApi, type ProductSizeChart } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { StorefrontSeo } from "@/components/seo/StorefrontSeo";
const SizeFitGuide = lazy(() => import("@/components/product/SizeFitGuide"));

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s || !s.trim()) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
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

const SHIRT_SIZE_CHART: ProductSizeChart = {
  image: "/images/sizecharts/shirt.svg",
  units: "cm",
  measureOverlay: {
    shoulder: { top: "11%", left: "20%", width: "60%" },
    chest: { top: "40%", left: "25%", width: "50%" },
    length: { top: "12%", left: "80%", height: "70%" },
    sleeve: { top: "28%", left: "13%", height: "48%", rotate: "-20deg" },
  },
  measurements: [
    { size: "XS", length: 70, shoulder: 50, chest: 60, sleeve: 62 },
    { size: "S", length: 72, shoulder: 52, chest: 62, sleeve: 63 },
    { size: "M", length: 74, shoulder: 54, chest: 64, sleeve: 64 },
    { size: "L", length: 76, shoulder: 56, chest: 66, sleeve: 65 },
    { size: "XL", length: 78, shoulder: 58, chest: 68, sleeve: 66 },
    { size: "XXL", length: 80, shoulder: 60, chest: 70, sleeve: 67 },
  ],
};

const HOODIE_SIZE_CHART: ProductSizeChart = {
  image: "/images/sizecharts/hoodie.svg",
  units: "cm",
  measureOverlay: {
    shoulder: { top: "10%", left: "20%", width: "60%" },
    chest: { top: "45%", left: "25%", width: "50%" },
    length: { top: "15%", left: "80%", height: "65%" },
    sleeve: { top: "30%", left: "10%", height: "50%", rotate: "-25deg" },
  },
  measurements: [
    { size: "XS", length: 66, shoulder: 52, chest: 58, sleeve: 60 },
    { size: "S", length: 68, shoulder: 54, chest: 60, sleeve: 61 },
    { size: "M", length: 70, shoulder: 56, chest: 62, sleeve: 62 },
    { size: "L", length: 72, shoulder: 58, chest: 64, sleeve: 63 },
    { size: "XL", length: 74, shoulder: 60, chest: 66, sleeve: 64 },
    { size: "XXL", length: 76, shoulder: 62, chest: 68, sleeve: 65 },
  ],
};

const PANTS_SIZE_CHART: ProductSizeChart = {
  image: "/images/sizecharts/pants.svg",
  units: "cm",
  measureOverlay: {
    waist: { top: "24%", left: "30%", width: "40%" },
    hip: { top: "36%", left: "26%", width: "48%" },
    inseam: { top: "44%", left: "52%", height: "42%" },
    outseam: { top: "24%", left: "68%", height: "62%" },
  },
  measurements: [
    { size: "XS", waist: 72, inseam: 70, outseam: 98 },
    { size: "S", waist: 76, inseam: 72, outseam: 100 },
    { size: "M", waist: 80, inseam: 74, outseam: 102 },
    { size: "L", waist: 84, inseam: 76, outseam: 104 },
    { size: "XL", waist: 88, inseam: 78, outseam: 106 },
    { size: "XXL", waist: 92, inseam: 80, outseam: 108 },
  ],
};

function resolveSizeChart(product: ProductApi | null): ProductSizeChart {
  if (product?.sizeChart?.measurements?.length) {
    return product.sizeChart;
  }

  const signature = `${product?.name ?? ""} ${product?.category ?? ""}`.toLowerCase();
  if (/(pant|trouser|jean|cargo|bottom)/.test(signature)) {
    return PANTS_SIZE_CHART;
  }
  if (/(hoodie|sweatshirt|pullover)/.test(signature)) {
    return HOODIE_SIZE_CHART;
  }
  return SHIRT_SIZE_CHART;
}

export default function ProductDetail() {
  const [, params] = useRoute<{ id: string }>("/product/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme } = useThemeStore();
  const addItem = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const openCartSidebar = useCartStore((state) => state.openCartSidebar);
  const closeCartSidebar = useCartStore((state) => state.closeCartSidebar);

  const productId = params?.id ?? "";

  const { data: product, isLoading } = useQuery<ProductApi | null>({
    queryKey: ["products", productId],
    queryFn: () => fetchProductById(productId),
    enabled: !!productId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: relatedProductsRaw = [] } = useQuery<ProductApi[]>({
    queryKey: ["products", { category: product?.category, limit: 5 }],
    queryFn: () => fetchProducts({ category: product?.category || undefined, limit: 5 }).then(r => r.products),
    enabled: !!product?.category,
    staleTime: 5 * 60 * 1000,
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
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [isTinyPreviewMode, setIsTinyPreviewMode] = useState(false);
  const [isPreviewRailExpanded, setIsPreviewRailExpanded] = useState(true);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [desktopReelProgress, setDesktopReelProgress] = useState(0);
  const galleryCloseTimeoutRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const productStageRef = useRef<HTMLDivElement | null>(null);
  const galleryScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const gallerySectionRefs = useRef<Array<HTMLElement | null>>([]);
  const desktopReelProgressRef = useRef(0);
  const desktopWheelFrameRef = useRef<number | null>(null);

  const colors = useMemo(() => parseJsonArray(product?.colorOptions ?? undefined), [product?.colorOptions]);
  const colorOptions = useMemo(
    () => colors.map((color) => ({ value: color, ...parseColorOption(color) })),
    [colors],
  );
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
  const productSizeChart = useMemo(() => resolveSizeChart(product ?? null), [product]);
  const backToShopHref = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedFrom = searchParams.get("from");

    if (requestedFrom && (requestedFrom.startsWith("/products") || requestedFrom.startsWith("/shop"))) {
      return requestedFrom;
    }

    return "/products";
  }, []);

  useEffect(() => {
    if (selectedImageIndex > allImages.length - 1) {
      setSelectedImageIndex(0);
    }
  }, [allImages.length, selectedImageIndex]);

  useEffect(() => {
    desktopReelProgressRef.current = desktopReelProgress;
  }, [desktopReelProgress]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 379px)");
    const syncPreviewRailMode = () => {
      const isTiny = mediaQuery.matches;
      setIsTinyPreviewMode(isTiny);
      setIsPreviewRailExpanded(!isTiny);
    };

    syncPreviewRailMode();
    mediaQuery.addEventListener("change", syncPreviewRailMode);

    return () => {
      mediaQuery.removeEventListener("change", syncPreviewRailMode);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const syncMobileOrTablet = () => setIsMobileOrTablet(mediaQuery.matches);
    syncMobileOrTablet();
    mediaQuery.addEventListener("change", syncMobileOrTablet);
    return () => {
      mediaQuery.removeEventListener("change", syncMobileOrTablet);
    };
  }, []);

  useEffect(() => {
    setSelectedImageIndex(0);
    setDesktopReelProgress(0);
    desktopReelProgressRef.current = 0;
  }, [product?.id, allImages.length, isMobileOrTablet]);

  useEffect(() => {
    if (!isGalleryOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGalleryVisible(false);
      }
      if (event.key === "ArrowRight") {
        goToImage(selectedImageIndex + 1);
      }
      if (event.key === "ArrowLeft") {
        goToImage(selectedImageIndex - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allImages.length, isGalleryOpen, selectedImageIndex]);

  const isDarkMode = theme === "dark";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehaviorY;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;

    const shouldLockOverflow = isGalleryOpen;
    document.body.style.overflow = shouldLockOverflow ? "hidden" : "";
    document.documentElement.style.overflow = shouldLockOverflow ? "hidden" : "";
    document.body.style.overscrollBehaviorY = shouldLockOverflow ? "none" : "";
    document.documentElement.style.overscrollBehaviorY = shouldLockOverflow ? "none" : "";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehaviorY = previousBodyOverscroll;
      document.documentElement.style.overscrollBehaviorY = previousHtmlOverscroll;
    };
  }, [isGalleryOpen]);

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
    if (!isGalleryOpen) return;

    const container = galleryScrollContainerRef.current;
    const sections = gallerySectionRefs.current.filter(
      (section): section is HTMLElement => Boolean(section),
    );
    if (!container || sections.length === 0) return;

    const activeSection = sections[selectedImageIndex];
    if (!activeSection) return;

    const sectionTop = activeSection.offsetTop;
    container.scrollTo({
      top: Math.max(0, sectionTop),
      behavior: "auto",
    });
  }, [isGalleryOpen, selectedImageIndex]);

  useEffect(() => {
    if (!isGalleryOpen) return;

    const sections = gallerySectionRefs.current.filter(
      (section): section is HTMLElement => Boolean(section),
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        const nextIndex = Number((visible.target as HTMLElement).dataset.index ?? -1);
        if (nextIndex >= 0 && nextIndex !== selectedImageIndex) {
          setSelectedImageIndex(nextIndex);
        }
      },
      {
        root: galleryScrollContainerRef.current,
        threshold: [0.3, 0.55, 0.75],
        rootMargin: "-8% 0px -8% 0px",
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [isGalleryOpen, selectedImageIndex]);

  useEffect(() => {
    if (isMobileOrTablet || isGalleryOpen) return;
    if (allImages.length <= 1) {
      setDesktopReelProgress(0);
      return;
    }

    const maxProgress = allImages.length - 1;
    const progressStep = 0.0018;

    const flushReelProgress = () => {
      desktopWheelFrameRef.current = null;
      setDesktopReelProgress(desktopReelProgressRef.current);
    };

    const onWheel = (event: WheelEvent) => {
      const stage = productStageRef.current;
      if (!stage) return;

      const rect = stage.getBoundingClientRect();
      const isStageInFocus =
        rect.top <= 24 &&
        rect.bottom >= window.innerHeight * 0.72;

      if (!isStageInFocus) return;

      const movingDown = event.deltaY > 0;
      const movingUp = event.deltaY < 0;
      const current = desktopReelProgressRef.current;
      const atStart = current <= 0.001;
      const atEnd = current >= maxProgress - 0.001;

      const shouldLockScroll =
        (movingDown && !atEnd) ||
        (movingUp && !atStart);

      if (!shouldLockScroll) return;

      event.preventDefault();

      const next = Math.min(maxProgress, Math.max(0, current + event.deltaY * progressStep));
      desktopReelProgressRef.current = next;

      if (desktopWheelFrameRef.current === null) {
        desktopWheelFrameRef.current = window.requestAnimationFrame(flushReelProgress);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      if (desktopWheelFrameRef.current !== null) {
        window.cancelAnimationFrame(desktopWheelFrameRef.current);
        desktopWheelFrameRef.current = null;
      }
      window.removeEventListener("wheel", onWheel);
    };
  }, [allImages.length, isGalleryOpen, isMobileOrTablet]);

  const desktopReelMaxProgress = Math.max(allImages.length - 1, 0);
  const clampedDesktopReelProgress = Math.min(Math.max(desktopReelProgress, 0), desktopReelMaxProgress);
  const desktopReelBaseIndex = Math.floor(clampedDesktopReelProgress);
  const desktopReelNextIndex = Math.min(desktopReelBaseIndex + 1, Math.max(allImages.length - 1, 0));
  const desktopReelTransition =
    desktopReelBaseIndex === desktopReelNextIndex ? 0 : clampedDesktopReelProgress - desktopReelBaseIndex;
  const activeDesktopPreviewIndex =
    desktopReelTransition >= 0.5 ? desktopReelNextIndex : desktopReelBaseIndex;
  const desktopReelGap = 4;

  useEffect(() => {
    if (isMobileOrTablet || isGalleryOpen) return;
    if (selectedImageIndex !== activeDesktopPreviewIndex) {
      setSelectedImageIndex(activeDesktopPreviewIndex);
    }
  }, [activeDesktopPreviewIndex, isGalleryOpen, isMobileOrTablet, selectedImageIndex]);

  const effectiveColor = selectedColor ?? (colors[0] ?? null);
  const effectiveSize = selectedSize;
  const selectedVariant = useMemo(() => {
    if (!effectiveSize) return null;
    return (
      product?.variants?.find((variant) => {
        if (variant.size !== effectiveSize) return false;
        if (!effectiveColor) return true;
        return normalizeColorLabel(variant.color ?? "Default") === normalizeColorLabel(effectiveColor);
      }) ?? null
    );
  }, [effectiveColor, effectiveSize, product?.variants]);
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

  const buildCartPayload = () => ({
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
    sku: product.id,
    images: allImages.filter(Boolean),
    variants: (product.variants ?? []).map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: parseColorOption(variant.color ?? "Default").label,
    })),
  });

  const buildVariantPayload = () => ({
    id: selectedVariant?.id,
    size: effectiveSize ?? "One Size",
    color: parseColorOption(effectiveColor ?? "Default").label,
  });

  const handleAddToCart = () => {
    addItem(
      buildCartPayload(),
      buildVariantPayload(),
      quantity,
    );
    const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
    toast({ title: "Added to bag", duration: isMobileOrTablet ? 1500 : undefined });
    openCartSidebar();
  };

  const handleBuyNow = () => {
    closeCartSidebar();
    clearCart();
    addItem(
      buildCartPayload(),
      buildVariantPayload(),
      quantity,
    );
    setLocation("/checkout");
  };

  const goToImage = (index: number) => {
    if (!allImages.length) return;
    const next = (index + allImages.length) % allImages.length;
    if (next === selectedImageIndex) return;
    setSelectedImageIndex(next);
  };

  const goToImageInModal = (targetIndex: number) => {
    if (!allImages.length) return;
    const next = (targetIndex + allImages.length) % allImages.length;
    const targetSection = gallerySectionRefs.current[next];
    if (!targetSection) return;
    setSelectedImageIndex(next);

    const container = galleryScrollContainerRef.current;
    if (!container) {
      targetSection.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const sectionTop = targetSection.offsetTop;
    container.scrollTo({
      top: Math.max(0, sectionTop),
      behavior: "smooth",
    });
  };

  const goToNextImage = () => {
    goToImage(selectedImageIndex + 1);
  };

  const goToPreviousImage = () => {
    goToImage(selectedImageIndex - 1);
  };

  const previewImage = (index: number) => {
    if (index === selectedImageIndex || index < 0 || index >= allImages.length) return;
    if (!isMobileOrTablet && allImages.length > 1) {
      desktopReelProgressRef.current = index;
      setSelectedImageIndex(index);
      setDesktopReelProgress(index);
      return;
    }
    setSelectedImageIndex(index);
  };

  const openGallery = (index?: number) => {
    if (typeof index === "number") {
      setSelectedImageIndex(index);
    }
    setIsGalleryOpen(true);
  };

  const closeGallery = () => {
    setIsGalleryVisible(false);
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

  const compactBreadcrumbProductLabel = product.name.toUpperCase();

  return (
    <div className="relative w-full px-3 pb-16 pt-0 sm:px-6 lg:px-8 xl:px-10">
      <StorefrontSeo
        title={`${product.name} | Rare Atelier`}
        description={
          product.shortDetails ||
          product.description?.substring(0, 160) ||
          `Buy ${product.name} at Rare Atelier.`
        }
        image={mainImageUrl}
        canonicalPath={`/product/${product.id}`}
        type="product"
        structuredData={structuredData}
      />

      <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 sm:top-4">
        <Link href="/" className="pointer-events-auto inline-flex items-center justify-center" aria-label="Go to homepage">
          <img
            src="/images/logo.webp"
            alt="Rare Atelier"
            className="h-14 w-auto object-contain mix-blend-difference sm:h-16 lg:h-20"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </Link>
      </div>

      <div className="pointer-events-none absolute left-3 top-4 z-40 max-w-[calc(100vw-8.5rem)] sm:left-6 sm:top-5 lg:left-8 xl:left-10">
        <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-black/10 bg-white/88 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/62 dark:text-white">
          <Link href="/" className="shrink-0 transition-opacity hover:opacity-65">
            Home
          </Link>
          <span className="opacity-45">{">"}</span>
          <Link href={backToShopHref} className="shrink-0 transition-opacity hover:opacity-65">
            Shop
          </Link>
          <span className="opacity-45">{">"}</span>
          <span className="min-w-0 max-w-[12ch] truncate sm:max-w-[18ch] lg:max-w-[26ch]">
            {compactBreadcrumbProductLabel}
          </span>
        </div>
      </div>

      <div
        ref={productStageRef}
        className="relative lg:min-h-screen"
      >
        <div className="grid gap-8 lg:h-screen lg:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.9fr)_minmax(300px,1fr)] lg:items-start lg:gap-8 xl:gap-10">
        <aside className="space-y-5 lg:py-24">
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
              <div className="pt-3 pb-1 text-[15px] leading-7 text-foreground/90">
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
              <ul className="space-y-2 pt-3 pb-1 text-[14px] leading-7 text-muted-foreground">
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
              <div className="space-y-2 pt-3 pb-1 text-[14px] leading-7 text-muted-foreground">
                <p>Shipping across Nepal in 2-5 business days.</p>
                <p>Easy exchange support for size issues when stock is available.</p>
              </div>
            </details>
          </div>
        </aside>

        <section className="space-y-4 lg:min-w-0 lg:py-0">
          <div className="relative min-w-0">
            <div
              className="relative h-[72vh] min-h-[520px] overflow-hidden rounded-sm border border-border/60 bg-black/5 sm:h-[76vh] lg:h-screen dark:border-white/10 dark:bg-black/35"
              onClick={() => {
                if (didSwipeRef.current) {
                  didSwipeRef.current = false;
                  return;
                }
                openGallery(selectedImageIndex);
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
                <div className="absolute left-3 top-16 z-20 bg-black/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white lg:left-4 lg:top-20 lg:px-4 lg:py-2">
                  Out of Stock
                </div>
              ) : null}

              {!isMobileOrTablet && allImages.length > 1 ? (
                <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-sm border border-white/20 bg-black/35 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm">
                  <span>
                    {String(activeDesktopPreviewIndex + 1).padStart(2, "0")} / {String(allImages.length).padStart(2, "0")}
                  </span>
                  <span className="h-3 w-px bg-white/25" />
                  <span className="text-white/80">Scroll to move through images</span>
                </div>
              ) : null}

              {allImages.length > 1 && !isMobileOrTablet ? (
                <div
                  className={`scrollbar-hide absolute left-2 top-1/2 z-40 -translate-y-1/2 overflow-y-auto rounded-md border border-white/30 bg-black/20 backdrop-blur-sm transition-all duration-200 sm:left-3 ${
                    isTinyPreviewMode && !isPreviewRailExpanded
                      ? "max-h-[36%] w-[26px] p-1"
                      : "flex max-h-[72%] w-[54px] flex-col gap-1.5 p-1.5 sm:w-[70px] sm:gap-2 sm:p-2"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {isTinyPreviewMode && !isPreviewRailExpanded ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsPreviewRailExpanded(true);
                      }}
                      className="flex h-9 w-full items-center justify-center rounded-sm border border-white/40 bg-black/45 text-[10px] font-black text-white"
                      aria-label="Expand image preview rail"
                    >
                      ••
                    </button>
                  ) : (
                    <>
                      {isTinyPreviewMode ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsPreviewRailExpanded(false);
                          }}
                          className="mb-1 flex h-6 w-full items-center justify-center rounded-sm border border-white/35 bg-black/45 text-[10px] font-black text-white/90"
                          aria-label="Collapse image preview rail"
                        >
                          −
                        </button>
                      ) : null}
                      {allImages.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            previewImage(i);
                          }}
                          className={`aspect-[4/5] w-full shrink-0 overflow-hidden rounded-sm border transition-all ${
                            activeDesktopPreviewIndex === i
                              ? "border-white opacity-100"
                              : "border-white/30 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img src={url || ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              ) : null}

              {isMobileOrTablet || allImages.length <= 1 ? (
                <img
                  src={allImages[selectedImageIndex] || ""}
                  alt={`${product.name} - view ${selectedImageIndex + 1}`}
                  loading={selectedImageIndex === 0 ? "eager" : "lazy"}
                  className="absolute inset-0 z-20 h-full w-full select-none object-cover object-top"
                />
              ) : (
                <div className="absolute inset-0">
                  <img
                    src={allImages[desktopReelBaseIndex] || ""}
                    alt={`${product.name} - view ${desktopReelBaseIndex + 1}`}
                    loading={desktopReelBaseIndex === 0 ? "eager" : "lazy"}
                    className="absolute inset-0 z-20 h-full w-full select-none object-cover object-top"
                    style={{
                      transform: `translate3d(0, ${desktopReelTransition * -(100 + desktopReelGap)}%, 0)`,
                      transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                  {desktopReelNextIndex !== desktopReelBaseIndex ? (
                    <img
                      src={allImages[desktopReelNextIndex] || ""}
                      alt={`${product.name} - view ${desktopReelNextIndex + 1}`}
                      loading="lazy"
                      className="absolute inset-0 z-30 h-full w-full select-none object-cover object-top"
                      style={{
                        transform: `translate3d(0, ${(1 - desktopReelTransition) * (100 + desktopReelGap)}%, 0)`,
                        transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    />
                  ) : null}
                </div>
              )}
            </div>

            {isMobileOrTablet && allImages.length > 1 ? (
              <div className="scrollbar-hide -mt-1 overflow-x-auto">
                <div className="flex min-w-max snap-x snap-mandatory gap-2 pb-1">
                  {allImages.map((url, i) => (
                    <button
                      key={`thumb-${i}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        previewImage(i);
                      }}
                      className={`snap-start h-20 w-16 overflow-hidden rounded-sm border transition-all ${
                        selectedImageIndex === i ? "border-foreground" : "border-border opacity-80"
                      }`}
                      aria-label={`View image ${i + 1}`}
                    >
                      <img src={url || ""} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Tap a preview or swipe the image
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-6 lg:py-24">
          <div className="flex justify-end">
            <Link
              href={backToShopHref}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700 transition-all hover:-translate-y-0.5 hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-100 dark:hover:text-neutral-100"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back to shop</span>
            </Link>
          </div>

          {colorOptions.length > 0 ? (
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Color</p>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-all ${
                      effectiveColor === color.value
                        ? "border-foreground bg-foreground/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                    }`}
                    aria-label={`Select ${color.label} color`}
                  >
                    <span
                      className="h-5 w-5 rounded-sm border border-black/10 shadow-sm"
                      style={{
                        background:
                          color.swatch ??
                          "linear-gradient(135deg, rgba(120,120,120,0.15), rgba(120,120,120,0.35))",
                      }}
                    />
                    <span>{color.label}</span>
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
                max={selectedVariantStock ?? 1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Math.min(selectedVariantStock ?? 1, Number(event.target.value) || 1)))}
                className="w-12 bg-transparent text-center text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity(Math.min(selectedVariantStock ?? 1, quantity + 1))}
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
      </div>

      <Suspense fallback={null}>
        {showSizeGuide ? (
          <SizeFitGuide
            open={showSizeGuide}
            onClose={() => setShowSizeGuide(false)}
            productName={product.name}
            sizeChart={productSizeChart}
            productImage={allImages.find(Boolean) ?? null}
            selectedSize={selectedSize}
          />
        ) : null}
      </Suspense>

      <div className="mt-24 pt-16 border-t border-gray-100">
        <h2 className="text-xl font-black uppercase tracking-tighter text-center mb-12">
          You May Also Like
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {relatedProducts.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}?from=${encodeURIComponent(backToShopHref)}`}
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
          className={`fixed inset-0 z-[80] transition-[opacity] duration-200 ${
            isGalleryVisible ? "opacity-100" : "opacity-0"
          }`}
          style={{ background: isDarkMode ? "#050505" : "#ffffff" }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeGallery();
            }
          }}
        >
          <div
            className={`relative flex h-full w-full items-stretch justify-center transition-transform duration-200 ${
              isGalleryVisible ? "scale-100" : "scale-[0.985]"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute left-5 top-5 z-40 text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: isDarkMode ? "rgba(255,255,255,0.72)" : "rgba(17,17,17,0.68)" }}
            >
              {String(selectedImageIndex + 1).padStart(2, "0")} / {String(allImages.length).padStart(2, "0")}
            </div>

            <div className="flex h-full w-full items-stretch gap-4 px-2 pt-0 pb-4 sm:px-4 lg:gap-6 lg:px-6">
              {allImages.length > 1 ? (
                <div
                  className="hidden w-[92px] shrink-0 overflow-y-auto rounded-2xl border p-2 backdrop-blur lg:block"
                  style={{
                    borderColor: isDarkMode ? "rgba(255,255,255,0.10)" : "rgba(17,17,17,0.10)",
                    background: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(17,17,17,0.03)",
                  }}
                >
                  <div className="flex flex-col gap-2">
                    {allImages.map((url, i) => (
                      <button
                        key={`modal-rail-${i}`}
                        type="button"
                        onClick={() => {
                          goToImageInModal(i);
                        }}
                        className="aspect-[4/5] w-full overflow-hidden rounded-sm border transition-all"
                        style={{
                          borderColor:
                            selectedImageIndex === i
                              ? isDarkMode
                                ? "rgba(255,255,255,0.70)"
                                : "rgba(17,17,17,0.60)"
                              : isDarkMode
                                ? "rgba(255,255,255,0.12)"
                                : "rgba(17,17,17,0.12)",
                          opacity: selectedImageIndex === i ? 1 : 0.72,
                        }}
                        aria-label={`Open image ${i + 1}`}
                      >
                        <img
                          src={url || ""}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div
                ref={galleryScrollContainerRef}
                className="scrollbar-hide min-w-0 flex-1 overflow-y-auto"
              >
                <div className="mx-auto flex w-full max-w-[min(99vw,1880px)] flex-col">
                  {allImages.map((url, index) => (
                    <section
                      key={`gallery-section-${index}`}
                      ref={(element) => {
                        gallerySectionRefs.current[index] = element;
                      }}
                      data-index={index}
                      className="relative min-h-screen px-0 pb-5 sm:pb-6 lg:pb-8"
                    >
                      <div className="flex min-h-[calc(100vh-5.5rem)] items-start justify-center px-0">
                        <img
                          src={url || ""}
                          alt={`${product.name} fullscreen view ${index + 1}`}
                          loading={index === selectedImageIndex ? "eager" : "lazy"}
                          decoding="async"
                          className="h-auto w-full max-w-none object-contain"
                          style={{ imageRendering: "auto" }}
                        />
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
