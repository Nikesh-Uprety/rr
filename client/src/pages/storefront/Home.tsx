import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchHomeFeaturedProducts, fetchPageConfig, fetchProducts, type ProductApi } from "@/lib/api";
import { useScroll, useTransform, motion, AnimatePresence } from "framer-motion";
import { ArrowUp, ArrowUpRight, Facebook, Instagram } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import { ScrollProgress } from "@/components/ScrollProgress";
import { StorefrontSeo } from "@/components/seo/StorefrontSeo";
import { useThemeStore } from "@/store/theme";
import { getPublicBranding } from "@/lib/adminApi";
import {
  getStorefrontLogoFilter,
  resolveStorefrontLogo,
  STOREFRONT_BRANDING_QUERY_KEY,
} from "@/lib/storefrontBranding";

const QuoteSection = lazy(() => import("@/components/home/QuoteSection"));
const FeaturedCollection = lazy(() => import("@/components/home/FeaturedCollection"));
const CampaignBanner = lazy(() => import("@/components/home/CampaignBanner"));
const NewArrivalsSection = lazy(() => import("@/components/home/NewArrivalsSection"));
const GoldTickerSection = lazy(() => import("@/components/home/GoldTickerSection"));
const FreshReleaseSection = lazy(() => import("@/components/home/FreshReleaseSection"));
const OurServices = lazy(() => import("@/components/home/OurServices"));
const ContactSection = lazy(() => import("@/components/home/ContactSection"));
const FaqSection = lazy(() => import("@/components/home/FaqSection"));
const BackToTopSection = lazy(() => import("@/components/home/BackToTopSection"));
const FlexibleContentSection = lazy(() => import("@/components/home/FlexibleContentSection"));

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
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
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
  const forcedThemeRef = useRef<"light" | "dark" | "warm" | null>(null);

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
  const { data: publicBrandingData } = useQuery({
    queryKey: STOREFRONT_BRANDING_QUERY_KEY,
    queryFn: getPublicBranding,
    staleTime: 5 * 60 * 1000,
  });
  const storefrontBranding = publicBrandingData?.branding;

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

  const shouldHardRefreshConfig = previewTemplateId !== null;
  const { data: pageConfig, isLoading: pageConfigLoading } = useQuery({
    queryKey: ["page-config", previewTemplateId],
    queryFn: () => fetchPageConfig(previewTemplateId),
    staleTime: shouldHardRefreshConfig ? 0 : 5 * 60 * 1000,
    refetchOnMount: shouldHardRefreshConfig ? "always" : false,
    refetchOnWindowFocus: shouldHardRefreshConfig,
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
    const siteImages = heroAssets
      .filter((asset) => asset.active && asset.assetType === "image")
      .map((asset) => asset.imageUrl)
      .filter(Boolean);

    const templateSlug = pageConfig?.template?.slug;
    if (templateSlug !== "stuffyclone") {
      return siteImages.length > 0 ? siteImages : HERO_IMAGES_FALLBACK;
    }

    const heroSection = (pageConfig?.sections ?? [])
      .filter((section: any) => section.isVisible)
      .sort((left: any, right: any) => left.orderIndex - right.orderIndex)
      .filter((section: any) => previewSectionId == null || Number(section.id) === previewSectionId)
      .find((section: any) => section.sectionType === "hero");

    const configuredSlides = Array.isArray(heroSection?.config?.slides)
      ? heroSection.config.slides
          .map((slide: any) => (typeof slide?.image === "string" ? slide.image.trim() : ""))
          .filter(Boolean)
      : [];

    if (configuredSlides.length > 0) {
      return configuredSlides;
    }

    if (siteImages.length > 0) {
      return siteImages;
    }

    return ["/images/stussy.webp"];
  }, [heroAssets, pageConfig?.sections, pageConfig?.template?.slug, previewSectionId]);

  const lifestyleImages =
    featureCollectionImages.length > 0 ? featureCollectionImages : LIFESTYLE_IMAGES_FALLBACK;

  const campaignBannerImage =
    exploreCollectionImage || (campaignAssets[0]?.imageUrl ?? "/images/explore.webp");
  const landingLogo = resolveStorefrontLogo(storefrontBranding, "dark");
  const landingLogoFilter = getStorefrontLogoFilter({
    branding: storefrontBranding,
    variant: "dark",
    glow: true,
  });

  // Finish pre-loader only when data is ready (Hydration-First)
  const hasFinishedLoadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasFinishedLoadingRef.current) return;
    if (pageConfigLoading) return;
    if (heroLoadingState) return;

    const finish = () => {
      if (hasFinishedLoadingRef.current) return;
      if (typeof (window as any).finishLoading === "function") {
        (window as any).finishLoading();
      }
      hasFinishedLoadingRef.current = true;
    };

    const timeout = window.setTimeout(finish, 24);
    return () => window.clearTimeout(timeout);
  }, [heroLoadingState, pageConfigLoading]);

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
    { id: -7, sectionType: "back-to-top", isVisible: true, config: {}, orderIndex: 7 },
    { id: -8, sectionType: "faq", isVisible: true, config: {}, orderIndex: 8 },
  ];

  const templateSlug = pageConfig?.template?.slug;
  const isRareDarkLuxury = templateSlug === "rare-dark-luxury";
  const isMaisonNocturne = templateSlug === "maison-nocturne";
  const isNikeshDesign = templateSlug === "nikeshdesign";
  const isStuffyClone = templateSlug === "stuffyclone";
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
  const isLuxuryEditorialTemplate = pageConfigLoading || isMaisonNocturne || isNikeshDesign || isRareDarkLuxury;
  const shouldRenderFallbackContact = !pageConfigLoading && !activeSections.some((s: any) => s.sectionType === "contact");
  const shouldRenderFallbackBackToTop =
    !pageConfigLoading &&
    isMaisonNocturne &&
    previewSectionId == null &&
    !activeSections.some((s: any) => s.sectionType === "back-to-top");
  const shouldRenderFallbackFaq =
    !pageConfigLoading &&
    previewSectionId == null &&
    !activeSections.some((s: any) => s.sectionType === "faq");
  const faqSections = activeSections.filter((section: any) => section.sectionType === "faq");
  const nonFaqSections = activeSections.filter((section: any) => section.sectionType !== "faq");

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
    if (isRareDarkLuxury) {
      if (theme !== "dark") {
        if (forcedThemeRef.current == null) {
          forcedThemeRef.current = theme;
        }
        setTheme("dark");
      }
      return;
    }

    if (forcedThemeRef.current && theme !== forcedThemeRef.current) {
      const previousTheme = forcedThemeRef.current;
      forcedThemeRef.current = null;
      setTheme(previousTheme);
    }
  }, [isRareDarkLuxury, setTheme, theme]);

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
            <ContactSection config={section.config} />
          </DeferredSection>
        );
      case "testimonial":
      case "gallery":
      case "video":
      case "countdown":
      case "map":
      case "text-block":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[26rem]">
            <FlexibleContentSection type={section.sectionType} config={section.config} />
          </DeferredSection>
        );
      case "back-to-top": {
        const config = (section.config ?? {}) as Record<string, unknown>;
        const imageFromConfig =
          typeof config.image === "string" && config.image.trim().length > 0
            ? config.image.trim()
            : "";
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[16rem]">
            <BackToTopSection
              imageUrl={imageFromConfig || campaignBannerImage || "/images/home-campaign-editorial.webp"}
              imageAlt={campaignBannerAltText}
            />
          </DeferredSection>
        );
      }
      case "faq":
        return (
          <DeferredSection key={section.id} minHeightClassName="min-h-[24rem]">
            <FaqSection config={section.config} />
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

  if (isStuffyClone) {
    const isDarkTheme = theme === "dark";
    const landingForeground = "#111111";
    const landingMenuForeground = "#ffffff";
    const landingIconForeground = "#ffffff";
    const stuffyLandingImage =
      heroImages[heroIndex % Math.max(heroImages.length, 1)] ??
      heroImages[0] ??
      "/images/stussy.webp";
    const landingLogoFilter = "brightness(0) invert(1)";
    const landingTextShadow = isDarkTheme
      ? "0 0 14px rgba(255,255,255,0.22)"
      : "0 2px 14px rgba(255,255,255,0.5)";
    const socialHoverShadow = isDarkTheme
      ? "drop-shadow(0 0 10px rgba(255,255,255,0.16))"
      : "drop-shadow(0 2px 12px rgba(255,255,255,0.42))";
    const landingMenuLinkClass =
      "relative inline-flex transition-transform duration-300 hover:-translate-y-[1px] after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:content-[''] after:transition-transform after:duration-300 hover:after:scale-x-100";

    return (
      <div className="relative h-screen h-[100svh] w-full overflow-hidden bg-black" style={{ color: landingForeground }}>
        <StorefrontSeo
          title="Rare Atelier | Stussy Clone"
          description="A minimal landing experience for the StuffyClone template."
          canonicalPath="/"
          image={heroImages[0] || "/images/stussy.webp"}
          structuredData={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Rare Atelier",
            url: typeof window !== "undefined" ? window.location.origin : "/",
          }}
        />
        <div className="relative h-full w-full overflow-hidden">
          <img
            src={stuffyLandingImage}
            alt="Stussy Clone Landing"
            className="absolute inset-0 h-full w-full object-cover"
            sizes="100vw"
            style={{ transform: "translateZ(0)" }}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <div
            className="relative z-10 flex h-full box-border flex-col"
            style={{
              paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
              paddingRight: "max(env(safe-area-inset-right), 0.75rem)",
              paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)",
              paddingLeft: "max(env(safe-area-inset-left), 0.75rem)",
            }}
          >
            <div className="flex flex-1 items-center justify-center px-5 pt-20 sm:px-8 sm:pt-24 md:px-10">
              <div className="relative w-full max-w-[min(88vw,40rem)] -translate-y-6 px-4 py-6 text-center sm:-translate-y-8 sm:px-8 sm:py-8">
                <div className="relative z-20 flex -translate-y-4 justify-center sm:-translate-y-5">
                  <div
                    className="w-full overflow-hidden"
                    style={{
                      maxWidth: "16.8rem",
                      height: "11.25rem",
                    }}
                  >
                    <img
                      src={landingLogo.src}
                      alt="Rare Atelier"
                      className="w-full object-contain object-top"
                      style={{
                        filter: landingLogoFilter,
                      }}
                    />
                  </div>
                </div>
                <ul
                  className="relative z-10 mt-3 space-y-5 text-[clamp(1rem,0.55rem+1.2vw,1.55rem)] uppercase tracking-[0.24em] sm:mt-4 sm:space-y-6 sm:tracking-[0.32em]"
                  style={{
                    fontFamily: "'Archivo Narrow', 'Arial Narrow', sans-serif",
                    fontWeight: 700,
                    textShadow: landingTextShadow,
                  }}
                >
                  <li>
                    <Link
                      href="/products"
                      className={landingMenuLinkClass}
                      style={{ color: landingMenuForeground }}
                    >
                      Shop
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/gallery"
                      className={landingMenuLinkClass}
                      style={{ color: landingMenuForeground }}
                    >
                      Gallery
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/atelier"
                      className={landingMenuLinkClass}
                      style={{ color: landingMenuForeground }}
                    >
                      Atelier
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/cart"
                      className={landingMenuLinkClass}
                      style={{ color: landingMenuForeground }}
                    >
                      Cart
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/atelier#contact"
                      className={landingMenuLinkClass}
                      style={{ color: landingMenuForeground }}
                    >
                      Support
                    </Link>
                  </li>
                </ul>
                <div className="relative z-10 mt-8 flex items-center justify-center gap-5">
                  <a
                    href="https://www.instagram.com/rareofficial.au/"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="inline-flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:opacity-80"
                    style={{ color: landingIconForeground, filter: socialHoverShadow }}
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                  <a
                    href="https://www.tiktok.com/@rare.np"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="TikTok"
                    className="inline-flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:opacity-80"
                    style={{ color: landingIconForeground, filter: socialHoverShadow }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-5 w-5 fill-current"
                    >
                      <path d="M16.7 5.4c.8.9 1.9 1.5 3.1 1.6v2.8c-1.6-.1-3.1-.7-4.3-1.7v6.4c0 3-2.4 5.4-5.4 5.4S4.7 17.5 4.7 14.5c0-3 2.4-5.4 5.4-5.4.3 0 .6 0 .9.1v2.9c-.3-.1-.6-.2-.9-.2-1.4 0-2.6 1.1-2.6 2.6s1.1 2.6 2.6 2.6 2.6-1.1 2.6-2.6V3.8h2.8c0 .6.2 1.2.6 1.6z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.facebook.com/rarenp"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                    className="inline-flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5 hover:opacity-80"
                    style={{ color: landingIconForeground, filter: socialHoverShadow }}
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
            <div
              className="pointer-events-auto absolute bottom-6 right-5 sm:right-6 md:bottom-8 md:right-8"
              style={{
                bottom: "max(env(safe-area-inset-bottom), 1.5rem)",
              }}
            >
              <Link
                href="/gallery"
                className="inline-flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-md transition-transform duration-300 hover:-translate-y-1 sm:h-16 sm:w-16"
                style={{
                  color: landingForeground,
                  borderColor: isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(17,17,17,0.28)",
                  background: isDarkTheme ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.42)",
                }}
                aria-label="Go to gallery"
              >
                <ArrowUpRight className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
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
      <StorefrontSeo
        title="Rare Atelier | Premium Streetwear"
        description="Welcome to Rare Atelier. Explore premium streetwear, minimal luxury, and signature editorial collections crafted for everyday style."
        canonicalPath="/"
        image={heroImages[0] || "/images/landingpage3.webp"}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Rare Atelier",
          url: typeof window !== "undefined" ? window.location.origin : "/",
          potentialAction: {
            "@type": "SearchAction",
            target: typeof window !== "undefined" ? `${window.location.origin}/products` : "/products",
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <main className={isLuxuryEditorialTemplate ? "bg-[var(--bg)] text-[var(--fg)]" : undefined}>
        {nonFaqSections.map(renderSection)}
        {/* Always render ContactSection at the bottom when not already present */}
        {shouldRenderFallbackContact && (
          <>
            {shouldRenderFallbackBackToTop ? (
              <DeferredSection minHeightClassName="min-h-[16rem]">
                <BackToTopSection
                  imageUrl={campaignBannerImage || "/images/home-campaign-editorial.webp"}
                  imageAlt={campaignBannerAltText}
                />
              </DeferredSection>
            ) : null}
            <DeferredSection minHeightClassName="min-h-[26rem]">
              <ContactSection />
            </DeferredSection>
          </>
        )}
        {faqSections.map(renderSection)}
        {shouldRenderFallbackFaq && (
          <DeferredSection minHeightClassName="min-h-[24rem]">
            <FaqSection />
          </DeferredSection>
        )}
      </main>
    </div>
  );
}
