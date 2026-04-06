import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import HeroSection from "@/components/home/HeroSection";
import { ScrollProgress } from "@/components/ScrollProgress";
import { renderSection, type RenderSectionContext } from "@/lib/renderSection";
import { getPublicPageConfig } from "@/lib/adminApi";
import { fetchProducts, type ProductApi } from "@/lib/api";
import { Suspense, lazy } from "react";

const ContactSection = lazy(() => import("@/components/home/ContactSection"));
const BackToTopSection = lazy(() => import("@/components/home/BackToTopSection"));
const FaqSection = lazy(() => import("@/components/home/FaqSection"));

function DeferredSection({
  children,
  minHeightClassName = "min-h-[20rem]",
}: {
  children: React.ReactNode;
  minHeightClassName?: string;
}) {
  return (
    <Suspense
      fallback={
        <div className={`${minHeightClassName} flex items-center justify-center`}>
          <div className="h-1 w-24 rounded-full bg-muted animate-pulse" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const HERO_IMAGES_FALLBACK = [
  "/images/landingpage3.webp",
  "/images/landingpage4.webp",
  "/images/home-campaign-editorial.webp",
];

export default function DynamicPage() {
  const [location] = useLocation();
  const slug = location === "/" ? "/" : location;

  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { data: pageConfig, isLoading: pageConfigLoading, error } = useQuery({
    queryKey: ["/api/public/page-config", slug],
    queryFn: () => getPublicPageConfig(slug),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: featuredProducts } = useQuery({
    queryKey: ["/api/products", { category: "featured" }],
    queryFn: () => fetchProducts({ category: "featured", limit: 8 }),
    enabled: !!pageConfig,
    staleTime: 5 * 60 * 1000,
  });

  const { data: newArrivals } = useQuery({
    queryKey: ["/api/products", { newArrival: true }],
    queryFn: () => fetchProducts({ newArrival: true, limit: 8 }),
    enabled: !!pageConfig,
    staleTime: 5 * 60 * 1000,
  });

  const sections = pageConfig?.sections || [];
  const page = pageConfig?.page || null;

  const heroSections = sections.filter((s: any) => s.sectionType === "hero");
  const nonFaqSections = sections.filter((s: any) => s.sectionType !== "faq");
  const faqSections = sections.filter((s: any) => s.sectionType === "faq");
  const hasContact = sections.some((s: any) => s.sectionType === "contact");
  const hasBackToTop = sections.some((s: any) => s.sectionType === "back-to-top");
  const hasFaq = sections.length > 0 && faqSections.length > 0;

  const heroImages = heroSections.length > 0
    ? (heroSections[0].config?.slides as any[])?.map((slide: any) => slide.image).filter(Boolean) || HERO_IMAGES_FALLBACK
    : HERO_IMAGES_FALLBACK;

  function handleHeroNext() {
    if (heroImages.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
      setIsTransitioning(false);
    }, 600);
  }

  function handleHeroPrev() {
    if (heroImages.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setHeroIndex((prev) => (prev - 1 + heroImages.length) % heroImages.length);
      setIsTransitioning(false);
    }, 600);
  }

  function handleHeroGoTo(index: number) {
    setIsTransitioning(true);
    setTimeout(() => {
      setHeroIndex(index);
      setIsTransitioning(false);
    }, 600);
  }

  const featuredProductsList = featuredProducts?.products || [];
  const newArrivalsList = newArrivals?.products || [];

  const renderCtx: RenderSectionContext = useMemo(() => ({
    heroImages,
    heroIndex,
    heroLoading: heroImages.length > 0 ? "loading" : "loaded",
    videoFailed,
    isMobile,
    isTablet,
    isTransitioning,
    onVideoError: () => setVideoFailed(true),
    heroVideoRef,
    featuredProducts: featuredProductsList,
    isFeaturedSuccess: featuredProductsList.length > 0,
    lifestyleImages: {},
    newArrivals: newArrivalsList,
    isNewArrivalsSuccess: newArrivalsList.length > 0,
    onCarouselNext: handleHeroNext,
    onCarouselPrev: handleHeroPrev,
    onCarouselGoTo: handleHeroGoTo,
  }), [heroImages, heroIndex, videoFailed, isMobile, isTablet, isTransitioning, featuredProductsList, newArrivalsList]);

  if (pageConfigLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-1 w-24 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  if (error || !pageConfig || (page && page.status !== "published" && page.slug !== "/")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">404</h1>
          <p className="text-muted-foreground">Page not found.</p>
        </div>
      </div>
    );
  }

  const pageTitle = page?.seoTitle || page?.title || "Rare Atelier";
  const pageDesc = page?.seoDescription || page?.description || "";

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollProgress />
      <Helmet>
        <title>{pageTitle}</title>
        {pageDesc && <meta name="description" content={pageDesc} />}
        {page?.seoImage && (
          <>
            <meta property="og:image" content={page.seoImage} />
            <meta property="og:title" content={pageTitle} />
            {pageDesc && <meta property="og:description" content={pageDesc} />}
          </>
        )}
      </Helmet>

      <main>
        {nonFaqSections.map((section: any) => renderSection(section, renderCtx))}

        {!hasContact && (
          <DeferredSection minHeightClassName="min-h-[26rem]">
            <ContactSection />
          </DeferredSection>
        )}

        {!hasBackToTop && (
          <DeferredSection minHeightClassName="min-h-[16rem]">
            <BackToTopSection imageUrl="/images/home-campaign-editorial.webp" />
          </DeferredSection>
        )}

        {faqSections.map((section: any) => renderSection(section, renderCtx))}

        {!hasFaq && sections.length > 0 && (
          <DeferredSection minHeightClassName="min-h-[24rem]">
            <FaqSection />
          </DeferredSection>
        )}
      </main>
    </div>
  );
}
