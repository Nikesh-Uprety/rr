import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHomeFeaturedProducts, fetchProducts, type ProductApi } from "@/lib/api";
import { useScroll, useTransform } from "framer-motion";
import { Helmet } from "react-helmet-async";
import OurServices from "@/components/home/OurServices";
import HeroSection from "@/components/home/HeroSection";
import QuoteSection from "@/components/home/QuoteSection";
import FeaturedCollection from "@/components/home/FeaturedCollection";
import CampaignBanner from "@/components/home/CampaignBanner";
import NewArrivalsSection from "@/components/home/NewArrivalsSection";
import GoldTickerSection from "@/components/home/GoldTickerSection";
import FreshReleaseSection from "@/components/home/FreshReleaseSection";
import { ScrollProgress } from "@/components/ScrollProgress";

type SiteAsset = {
  id: string;
  section: string;
  imageUrl: string;
  altText: string | null;
  deviceTarget: string;
  assetType: "image" | "video";
  videoUrl: string | null;
  sortOrder: number;
  active: boolean;
};

const HERO_IMAGES_FALLBACK = [
  "/images/landingpage3.webp",
  "/images/landingpage4.webp",
  "/images/home-campaign-editorial.webp",
];

// For now we hardwire the Featured Collection + Explore visuals.
// Users can override these via the admin "Storefront Images" picker (localStorage).
const FEATURE_COLLECTION_IMAGE_SLOTS_DEFAULT = [
  "/images/feature1.webp",
  "/images/feature2.webp",
  "/images/feature3.webp",
];
const EXPLORE_COLLECTION_IMAGE_DEFAULT = "/images/home-campaign-editorial.webp";

const LIFESTYLE_IMAGES_FALLBACK = [
  "/images/feature1.webp",
  "/images/feature2.webp",
  "/images/feature3.webp",
  "/images/home-campaign-editorial.webp",
];

const PREVIEW_PRODUCTS: ProductApi[] = [
  {
    id: "canvas-preview-1",
    name: "Editorial Trouser",
    shortDetails: "Canvas preview sample",
    description: "Canvas preview sample",
    price: 12800,
    imageUrl: "/images/feature1.webp",
    galleryUrls: JSON.stringify(["/images/feature1.webp", "/images/home-campaign-editorial.webp"]),
    category: "featured",
    stock: 10,
    colorOptions: JSON.stringify(["#1f1f1f", "#c7b9a6"]),
    sizeOptions: JSON.stringify(["S", "M", "L"]),
    saleActive: false,
    homeFeatured: true,
    homeFeaturedImageIndex: 0,
  },
  {
    id: "canvas-preview-2",
    name: "Structured Knit",
    shortDetails: "Canvas preview sample",
    description: "Canvas preview sample",
    price: 11200,
    imageUrl: "/images/feature2.webp",
    galleryUrls: JSON.stringify(["/images/feature2.webp", "/images/landingpage4.webp"]),
    category: "featured",
    stock: 8,
    colorOptions: JSON.stringify(["#292524", "#e7dfd1"]),
    sizeOptions: JSON.stringify(["S", "M", "L"]),
    saleActive: false,
    homeFeatured: true,
    homeFeaturedImageIndex: 0,
  },
  {
    id: "canvas-preview-3",
    name: "Maison Layer",
    shortDetails: "Canvas preview sample",
    description: "Canvas preview sample",
    price: 14900,
    imageUrl: "/images/feature3.webp",
    galleryUrls: JSON.stringify(["/images/feature3.webp", "/images/landingpage3.webp"]),
    category: "arrivals",
    stock: 6,
    colorOptions: JSON.stringify(["#171717", "#8a7861"]),
    sizeOptions: JSON.stringify(["M", "L", "XL"]),
    saleActive: false,
    homeFeatured: true,
    homeFeaturedImageIndex: 0,
  },
  {
    id: "canvas-preview-4",
    name: "Altitude Coat",
    shortDetails: "Canvas preview sample",
    description: "Canvas preview sample",
    price: 16800,
    imageUrl: "/images/landingpage3.webp",
    galleryUrls: JSON.stringify(["/images/landingpage3.webp", "/images/landingpage4.webp"]),
    category: "arrivals",
    stock: 5,
    colorOptions: JSON.stringify(["#0f0f10", "#d9d4cb"]),
    sizeOptions: JSON.stringify(["M", "L"]),
    saleActive: false,
    homeFeatured: true,
    homeFeaturedImageIndex: 0,
  },
];

export default function Home() {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const dragStartX = useRef(0);
  const isDragging = useRef(false);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Featured Collection visuals (feature1/2/3) and Explore banner (explore.webp).
  // Defaults come from client public files; overrides come from admin picker via localStorage.
  const [featureCollectionImages, setFeatureCollectionImages] = useState<string[]>(
    FEATURE_COLLECTION_IMAGE_SLOTS_DEFAULT,
  );
  const [exploreCollectionImage, setExploreCollectionImage] = useState<string>(
    EXPLORE_COLLECTION_IMAGE_DEFAULT,
  );

  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const previewTemplateId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("canvasPreviewTemplateId");
    return rawValue && /^\d+$/.test(rawValue) ? rawValue : null;
  }, []);
  const previewSectionId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("canvasSectionId");
    return rawValue && /^-?\d+$/.test(rawValue) ? Number(rawValue) : null;
  }, []);
  const previewFontPreset = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("canvasFontPreset");
  }, []);
  const isCanvasPreview = previewTemplateId !== null;

  const { data: featuredProducts = [], isSuccess: isFeaturedSuccess } = useQuery({
    queryKey: ["products", "featured", { limit: 2 }],
    queryFn: () => fetchProducts({ limit: 2 }),
    enabled: !isCanvasPreview,
  });

  const { data: newArrivals = [], isSuccess: isNewArrivalsSuccess } = useQuery({
    queryKey: ["products", "home-featured"],
    queryFn: fetchHomeFeaturedProducts,
    enabled: !isCanvasPreview,
  });

  const {
    data: heroAssets = [],
    isLoading: heroLoading,
  } = useQuery<SiteAsset[]>({
    queryKey: ["siteAssets", "hero"],
    queryFn: () =>
      fetch("/api/site-assets/hero")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
    staleTime: 5 * 60 * 1000,
    enabled: !isCanvasPreview,
  });

  const { data: campaignAssets = [] } = useQuery<SiteAsset[]>({
    queryKey: ["siteAssets", "new_collection"],
    queryFn: () =>
      fetch("/api/site-assets/new_collection")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
    staleTime: 5 * 60 * 1000,
    enabled: !isCanvasPreview,
  });

  const previewProducts = useMemo(() => PREVIEW_PRODUCTS, []);
  const featuredProductsSource = isCanvasPreview ? previewProducts.slice(0, 2) : featuredProducts;
  const newArrivalsSource = isCanvasPreview ? previewProducts : newArrivals;
  const normalizedNewArrivals = useMemo(() => {
    return newArrivalsSource.slice(0, 8);
  }, [newArrivalsSource]);

  const { data: pageConfig, isLoading: pageConfigLoading } = useQuery({
    queryKey: ["page-config", previewTemplateId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (previewTemplateId) {
        params.set("templateId", previewTemplateId);
      }
      const url = params.toString()
        ? `/api/public/page-config?${params.toString()}`
        : "/api/public/page-config";
      return fetch(url).then((r) => r.json());
    },
    staleTime: 30 * 1000,
  });

  // Device detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load admin overrides (if any) for Featured + Explore visuals.
  useEffect(() => {
    try {
      const rawFeatures = localStorage.getItem("storefront_feature_images");
      if (rawFeatures) {
        const parsed = JSON.parse(rawFeatures);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .map((x) => (typeof x === "string" ? x : ""))
            .filter(Boolean);
          if (normalized.length > 0) setFeatureCollectionImages(normalized.slice(0, 3));
        }
      }

      const rawExplore = localStorage.getItem("storefront_explore_image");
      if (rawExplore && typeof rawExplore === "string") {
        setExploreCollectionImage(rawExplore);
      }
    } catch {
      // ignore localStorage errors and keep defaults
    }
  }, []);

  const showHeroVideo = !isCanvasPreview && isMobile && !videoFailed;
  const heroLoadingState = isCanvasPreview ? false : heroLoading;

  // Hero images from CMS assets (fallback to placeholder)
  const heroImages = useMemo(() => {
    const images = heroAssets
      .filter(a => a.active && a.assetType === "image")
      .map(a => a.imageUrl);
    return images.length > 0 ? images : HERO_IMAGES_FALLBACK;
  }, [heroAssets]);

  const lifestyleImages =
    featureCollectionImages.length > 0 ? featureCollectionImages : LIFESTYLE_IMAGES_FALLBACK;

  const campaignBannerImage =
    exploreCollectionImage || (campaignAssets[0]?.imageUrl ?? "/images/explore.webp");

  // Finish pre-loader only when data is ready (Hydration-First)
  useEffect(() => {
    // Don't block the whole page on product queries/assets.
    // Reveal once the page config is ready; the rest can stream in progressively.
    const canRevealPage = !pageConfigLoading;

    if (canRevealPage) {
      if (typeof (window as any).finishLoading === 'function') {
        (window as any).finishLoading();
      }
    }
  }, [pageConfigLoading]);

  // Preload static campaign images
  useEffect(() => {
    // Avoid preloading large image sets on first paint (can easily add seconds on slow networks).
    // Warm only the first hero + campaign image, and defer the rest until the browser is idle.
    const initial = [heroImages[0], campaignBannerImage].filter(Boolean) as string[];

    const warm = (src: string) => {
      if (!src || src.startsWith("http")) return;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    };

    initial.forEach(warm);

    const deferred = () => {
      const rest = Array.from(new Set([...heroImages.slice(1), ...lifestyleImages])).filter(Boolean) as string[];
      rest.forEach(warm);
    };

    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(deferred, { timeout: 1500 });
      return () => (window as any).cancelIdleCallback?.(id);
    }

    const t = setTimeout(deferred, 900);
    return () => clearTimeout(t);
  }, [campaignBannerImage, heroImages, lifestyleImages]);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCarouselIndex(index);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  const goNext = useCallback(() => {
    goToSlide((carouselIndex + 1) % lifestyleImages.length);
  }, [carouselIndex, goToSlide, lifestyleImages.length]);

  const goPrev = useCallback(() => {
    goToSlide((carouselIndex - 1 + lifestyleImages.length) % lifestyleImages.length);
  }, [carouselIndex, goToSlide, lifestyleImages.length]);

  // Pause auto-scroll on interaction, resume after 5s
  const pauseAutoScroll = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      autoPlayRef.current = setInterval(() => {
        setCarouselIndex((i) => (i + 1) % lifestyleImages.length);
      }, 5000);
    }, 5000);
  }, [lifestyleImages.length]);

  const handleCarouselNext = useCallback(() => {
    pauseAutoScroll();
    goNext();
  }, [goNext, pauseAutoScroll]);

  const handleCarouselPrev = useCallback(() => {
    pauseAutoScroll();
    goPrev();
  }, [goPrev, pauseAutoScroll]);

  const handleCarouselGoTo = useCallback((index: number) => {
    pauseAutoScroll();
    goToSlide(index);
  }, [goToSlide, pauseAutoScroll]);

  // Auto-scroll effect for lifestyle carousel + hero image fallback cycling
  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % lifestyleImages.length);
    }, 5000);

    // Cycle hero images when video isn't used (desktop) or video failed.
    let heroInterval: ReturnType<typeof setInterval> | null = null;
    if ((!showHeroVideo || videoFailed) && heroImages.length > 1) {
      heroInterval = setInterval(() => {
        setHeroIndex((prev) => (prev + 1) % heroImages.length);
      }, 6000);
    }

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      if (heroInterval) clearInterval(heroInterval);
    };
  }, [lifestyleImages.length, heroImages.length, videoFailed, showHeroVideo]);


  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    pauseAutoScroll();
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    pauseAutoScroll();
    e.preventDefault();
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = dragStartX.current - e.clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };
  const handleMouseLeave = () => {
    if (isDragging.current) {
      isDragging.current = false;
    }
  };

  const parallaxY = yParallax;
  const campaignBannerAltText = campaignAssets[0]?.altText || "Campaign story";
  const defaultSections = [
    { id: -1, sectionType: "hero", isVisible: true, config: {}, orderIndex: 1 },
    { id: -2, sectionType: "quote", isVisible: true, config: {}, orderIndex: 2 },
    { id: -3, sectionType: "featured", isVisible: true, config: {}, orderIndex: 3 },
    { id: -4, sectionType: "campaign", isVisible: true, config: {}, orderIndex: 4 },
    { id: -5, sectionType: "arrivals", isVisible: true, config: {}, orderIndex: 5 },
    { id: -6, sectionType: "services", isVisible: true, config: {}, orderIndex: 6 },
  ];

  const activeSections = (
    pageConfigLoading
      ? []
      : pageConfig?.sections?.length
        ? pageConfig.sections
        : defaultSections
  ).filter((s: any) => s.isVisible)
    .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
    .filter((section: any) => previewSectionId == null || Number(section.id) === previewSectionId);
  const isMaisonNocturne = pageConfig?.template?.slug === "maison-nocturne";
  const isNikeshDesign = pageConfig?.template?.slug === "nikeshdesign";
  const isLuxuryEditorialTemplate = pageConfigLoading || isMaisonNocturne || isNikeshDesign;

  useEffect(() => {
    if (!isLuxuryEditorialTemplate || isCanvasPreview) return;
    const nodes = Array.from(document.querySelectorAll(".reveal, .p-card, .ed-cell"));
    if (!nodes.length) return;

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.style.opacity = "0";
      node.style.transform = node.classList.contains("ed-cell") ? "scale(0.97)" : "translateY(36px)";
      node.style.transition = "opacity 0.85s var(--ease), transform 0.85s var(--ease)";
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!(entry.target instanceof HTMLElement)) return;
          if (!entry.isIntersecting) return;
          entry.target.style.opacity = "1";
          entry.target.style.transform = entry.target.classList.contains("ed-cell") ? "scale(1)" : "translateY(0)";
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [activeSections, isCanvasPreview, isLuxuryEditorialTemplate]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const originalDisplay = root.style.getPropertyValue("--font-display");
    const originalBody = root.style.getPropertyValue("--font-body");
    const originalMono = root.style.getPropertyValue("--font-mono");

    const presets: Record<string, { display: string; body: string; mono: string }> = {
      inter: {
        display: "'Playfair Display', Georgia, serif",
        body: "'Inter', sans-serif",
        mono: "'DM Mono', monospace",
      },
      "roboto-slab": {
        display: "'Roboto Slab', 'Playfair Display', serif",
        body: "'Roboto Slab', Georgia, serif",
        mono: "'DM Mono', monospace",
      },
      "space-grotesk": {
        display: "'Playfair Display', Georgia, serif",
        body: "'Space Grotesk', 'DM Sans', sans-serif",
        mono: "'DM Mono', monospace",
      },
      "ibm-plex-sans": {
        display: "'Playfair Display', Georgia, serif",
        body: "'IBM Plex Sans', 'DM Sans', sans-serif",
        mono: "'DM Mono', monospace",
      },
    };

    const preset = previewFontPreset ? presets[previewFontPreset] : null;
    if (!preset) {
      root.style.removeProperty("--font-display");
      root.style.removeProperty("--font-body");
      root.style.removeProperty("--font-mono");
      return () => {
        if (originalDisplay) root.style.setProperty("--font-display", originalDisplay);
        if (originalBody) root.style.setProperty("--font-body", originalBody);
        if (originalMono) root.style.setProperty("--font-mono", originalMono);
      };
    }

    root.style.setProperty("--font-display", preset.display);
    root.style.setProperty("--font-body", preset.body);
    root.style.setProperty("--font-mono", preset.mono);

    return () => {
      if (originalDisplay) root.style.setProperty("--font-display", originalDisplay);
      else root.style.removeProperty("--font-display");
      if (originalBody) root.style.setProperty("--font-body", originalBody);
      else root.style.removeProperty("--font-body");
      if (originalMono) root.style.setProperty("--font-mono", originalMono);
      else root.style.removeProperty("--font-mono");
    };
  }, [previewFontPreset]);

  function renderSection(section: any) {
    switch (section.sectionType) {
      case "hero":
        return (
          <HeroSection
            key={section.id}
            heroImages={heroImages}
            heroIndex={heroIndex}
            heroLoading={heroLoadingState}
            videoFailed={videoFailed}
            isMobile={isMobile}
            isTransitioning={isTransitioning}
            onVideoError={() => setVideoFailed(true)}
            heroVideoRef={heroVideoRef}
            config={section.config}
          />
        );
      case "quote":
        return (
          <QuoteSection
            key={section.id}
            config={section.config}
          />
        );
      case "featured":
        return (
          <FeaturedCollection
            key={section.id}
            featuredProducts={featuredProductsSource ?? []}
            isFeaturedSuccess={isCanvasPreview || isFeaturedSuccess}
            featureCollectionImages={lifestyleImages}
            carouselIndex={carouselIndex}
            isTransitioning={isTransitioning}
            onCarouselNext={handleCarouselNext}
            onCarouselPrev={handleCarouselPrev}
            onCarouselGoTo={handleCarouselGoTo}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            config={section.config}
          />
        );
      case "ticker":
        return (
          <GoldTickerSection
            key={section.id}
            config={section.config}
          />
        );
      case "campaign":
        return (
          <CampaignBanner
            key={section.id}
            exploreCollectionImage={campaignBannerImage}
            parallaxOffset={parallaxY}
            imageAlt={campaignBannerAltText}
            config={section.config}
          />
        );
      case "arrivals":
        return (
          <NewArrivalsSection
            key={section.id}
            newArrivals={normalizedNewArrivals}
            isNewArrivalsSuccess={isCanvasPreview || isNewArrivalsSuccess}
            config={section.config}
          />
        );
      case "services":
        return (
          <OurServices
            key={section.id}
            config={section.config}
          />
        );
      case "fresh-release":
        return (
          <FreshReleaseSection
            key={section.id}
            config={section.config}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        paddingTop: isLuxuryEditorialTemplate ? 0 : "5rem",
        background: isLuxuryEditorialTemplate ? "var(--bg)" : undefined,
      }}
    >
      {/* Scroll Progress Indicator - Minimal premium line at top */}
      {isCanvasPreview ? null : <ScrollProgress />}
      <Helmet>
        <title>Rare Atelier | Home - Premium Streetwear</title>
        <meta name="description" content="Welcome to Rare Atelier. Explore our premium streetwear and minimal luxury collection. Authentic style, timeless designs." />
        <meta property="og:title" content="Rare Atelier | Premium Streetwear" />
        <meta property="og:url" content={window.location.origin} />
      </Helmet>
      <main className={isLuxuryEditorialTemplate ? "bg-[var(--bg)] text-[var(--fg)]" : undefined}>
        {activeSections.map(renderSection)}
      </main>
    </div>
  );
}
