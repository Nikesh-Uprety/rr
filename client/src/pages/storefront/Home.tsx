import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHomeFeaturedProducts, fetchPageConfig, fetchProducts, type ProductApi } from "@/lib/api";
import { useScroll, useTransform, motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { ArrowUp } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import { ScrollProgress } from "@/components/ScrollProgress";

const QuoteSection = lazy(() => import("@/components/home/QuoteSection"));
const FeaturedCollection = lazy(() => import("@/components/home/FeaturedCollection"));
const CampaignBanner = lazy(() => import("@/components/home/CampaignBanner"));
const NewArrivalsSection = lazy(() => import("@/components/home/NewArrivalsSection"));
const GoldTickerSection = lazy(() => import("@/components/home/GoldTickerSection"));
const FreshReleaseSection = lazy(() => import("@/components/home/FreshReleaseSection"));
const OurServices = lazy(() => import("@/components/home/OurServices"));
const ContactSection = lazy(() => import("@/components/home/ContactSection"));

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

function DeferredSection({
  children,
  minHeightClassName = "min-h-[32rem]",
}: {
  children: ReactNode;
  minHeightClassName?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {isVisible ? (
        <Suspense fallback={<div className={`${minHeightClassName} animate-pulse rounded-[2rem] bg-muted/30`} />}>
          {children}
        </Suspense>
      ) : (
        <div className={`${minHeightClassName} rounded-[2rem] bg-transparent`} aria-hidden="true" />
      )}
    </div>
  );
}

export default function Home() {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
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
  const isCanvasPreview = previewTemplateId !== null;

  const { data: featuredProductsData = { products: [], total: 0 }, isSuccess: isFeaturedSuccess } = useQuery({
    queryKey: ["products", "featured", { limit: 2 }],
    queryFn: () => fetchProducts({ limit: 2 }),
    enabled: !isCanvasPreview,
  });

  const featuredProducts = featuredProductsData.products;

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
    return newArrivalsSource.slice(0, 4);
  }, [newArrivalsSource]);

  const { data: pageConfig, isLoading: pageConfigLoading } = useQuery({
    queryKey: ["page-config", previewTemplateId],
    queryFn: () => fetchPageConfig(previewTemplateId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Device detection
  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      setIsMobile(width < 1024);
      setIsTablet(width >= 768 && width < 1024);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
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
  const [showGoToTop, setShowGoToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowGoToTop(window.scrollY > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const defaultSections = [
    { id: -1, sectionType: "hero", isVisible: true, config: {}, orderIndex: 1 },
    { id: -2, sectionType: "quote", isVisible: true, config: {}, orderIndex: 2 },
    { id: -3, sectionType: "featured", isVisible: true, config: {}, orderIndex: 3 },
    { id: -4, sectionType: "campaign", isVisible: true, config: {}, orderIndex: 4 },
    { id: -5, sectionType: "arrivals", isVisible: true, config: {}, orderIndex: 5 },
    { id: -6, sectionType: "services", isVisible: true, config: {}, orderIndex: 6 },
  ];

  const templateSlug = pageConfig?.template?.slug;
  const isMaisonNocturne = templateSlug === "maison-nocturne";
  const isNikeshDesign = templateSlug === "nikeshdesign";
  const sortedSections = (
    pageConfigLoading
      ? []
      : pageConfig?.sections?.length
        ? pageConfig.sections
        : defaultSections
  ).filter((s: any) => s.isVisible)
    .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
    .filter((section: any) => previewSectionId == null || Number(section.id) === previewSectionId);
  const activeSections = (() => {
    if (!isMaisonNocturne) return sortedSections;
    const featured = sortedSections.filter((section: any) => section.sectionType === "featured");
    if (!featured.length) return sortedSections;
    const withoutFeatured = sortedSections.filter((section: any) => section.sectionType !== "featured");
    let lastArrivalsIndex = -1;
    withoutFeatured.forEach((section: any, index: number) => {
      if (section.sectionType === "arrivals") lastArrivalsIndex = index;
    });
    if (lastArrivalsIndex === -1) return sortedSections;
    return [
      ...withoutFeatured.slice(0, lastArrivalsIndex + 1),
      ...featured,
      ...withoutFeatured.slice(lastArrivalsIndex + 1),
    ];
  })();
  const isLuxuryEditorialTemplate = pageConfigLoading || isMaisonNocturne || isNikeshDesign;
  const shouldRenderFallbackContact = !pageConfigLoading && !activeSections.some((s: any) => s.sectionType === "contact");

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
            isTablet={isTablet}
            isTransitioning={isTransitioning}
            onVideoError={() => setVideoFailed(true)}
            heroVideoRef={heroVideoRef}
            config={section.config}
          />
        );
      case "quote":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[18rem]">
            <QuoteSection config={section.config} />
          </DeferredSection>
        );
      case "featured": {
        const featuredConfig = isMaisonNocturne
          ? { ...(section.config ?? {}), variant: "editorial" }
          : section.config;
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[44rem]">
            <FeaturedCollection
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
              config={featuredConfig}
            />
          </DeferredSection>
        );
      }
      case "ticker":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[10rem]">
            <GoldTickerSection config={section.config} />
          </DeferredSection>
        );
      case "campaign":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[34rem]">
            <CampaignBanner
              exploreCollectionImage={campaignBannerImage}
              parallaxOffset={parallaxY}
              imageAlt={campaignBannerAltText}
              config={section.config}
            />
          </DeferredSection>
        );
      case "arrivals":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[34rem]">
            <NewArrivalsSection
              newArrivals={normalizedNewArrivals}
              isNewArrivalsSuccess={isCanvasPreview || isNewArrivalsSuccess}
              config={section.config}
            />
          </DeferredSection>
        );
      case "services":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[22rem]">
            <OurServices config={section.config} />
          </DeferredSection>
        );
      case "contact":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[26rem]">
            <ContactSection />
          </DeferredSection>
        );
      case "fresh-release":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[30rem]">
            <FreshReleaseSection config={section.config} />
          </DeferredSection>
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
        {/* Always render ContactSection at the bottom when not already present */}
        {shouldRenderFallbackContact && (
          <DeferredSection minHeightClassName="min-h-[26rem]">
            <ContactSection />
          </DeferredSection>
        )}
      </main>
    </div>
  );
}
