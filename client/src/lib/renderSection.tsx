import { lazy, Suspense } from "react";

const HeroSection = lazy(() => import("@/components/home/HeroSection"));
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

function resolveStuffyHeroImage(heroImages: string[], config?: Record<string, any>) {
  const configuredSlides = Array.isArray(config?.slides)
    ? config.slides
        .map((slide: any) => (typeof slide?.image === "string" ? slide.image.trim() : ""))
        .filter(Boolean)
    : [];

  return configuredSlides[0] || heroImages[0] || "/images/stussy.webp";
}

function StuffyCloneHeroPreview({
  heroImages,
  config,
}: {
  heroImages: string[];
  config?: Record<string, any>;
}) {
  const image = resolveStuffyHeroImage(heroImages, config);

  return (
    <section className="relative min-h-screen overflow-hidden bg-black text-white">
      <img
        src={image}
        alt="Stuffy landing background"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.18)_42%,rgba(0,0,0,0.52))]" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-24">
        <div className="w-full max-w-[32rem] text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/70">
            Stuffy clone
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[0.18em] text-white">
            Landing background
          </h2>
          <div className="mt-8 space-y-4 text-[0.95rem] font-semibold uppercase tracking-[0.28em] text-white/88">
            <div>Shop</div>
            <div>Gallery</div>
            <div>Atelier</div>
            <div>Cart</div>
            <div>Support</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export interface RenderSectionContext {
  heroImages?: string[];
  heroIndex?: number;
  heroLoading?: string;
  videoFailed?: boolean;
  isMobile?: boolean;
  isTablet?: boolean;
  isTransitioning?: boolean;
  onVideoError?: () => void;
  heroVideoRef?: React.RefObject<HTMLVideoElement | null>;
  featuredProducts?: any[];
  isFeaturedSuccess?: boolean;
  lifestyleImages?: Record<string, string>;
  carouselIndex?: number;
  onCarouselNext?: () => void;
  onCarouselPrev?: () => void;
  onCarouselGoTo?: (index: number) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  newArrivals?: any[];
  isNewArrivalsSuccess?: boolean;
  campaignBannerImage?: string | null;
  campaignBannerAltText?: string | null;
  parallaxOffset?: number;
  isCanvasPreview?: boolean;
}

export function renderSection(section: any, ctx: RenderSectionContext = {}, keyPrefix?: string) {
  const key = keyPrefix ? `${keyPrefix}-${section.id}` : section.id;

  switch (section.sectionType) {
    case "hero":
      if (section.config?.variant === "stuffyclone") {
        return (
          <DeferredSection key={key} minHeightClassName="min-h-screen">
            <StuffyCloneHeroPreview
              heroImages={ctx.heroImages || []}
              config={section.config}
            />
          </DeferredSection>
        );
      }
      return (
        <DeferredSection key={key} minHeightClassName="min-h-screen">
          <HeroSection
            heroImages={ctx.heroImages || []}
            heroIndex={ctx.heroIndex || 0}
            heroLoading={!!ctx.heroLoading}
            videoFailed={ctx.videoFailed || false}
            isMobile={ctx.isMobile || false}
            isTablet={ctx.isTablet || false}
            isTransitioning={ctx.isTransitioning || false}
            onVideoError={ctx.onVideoError || (() => {})}
            heroVideoRef={ctx.heroVideoRef as any}
            config={section.config}
          />
        </DeferredSection>
      );

    case "quote":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[18rem]">
          <QuoteSection config={section.config} />
        </DeferredSection>
      );

    case "featured":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[44rem]">
          <FeaturedCollection
            featuredProducts={ctx.featuredProducts || []}
            isFeaturedSuccess={ctx.isFeaturedSuccess || false}
            featureCollectionImages={Array.isArray(ctx.lifestyleImages) ? ctx.lifestyleImages : []}
            carouselIndex={ctx.carouselIndex || 0}
            isTransitioning={ctx.isTransitioning || false}
            onCarouselNext={ctx.onCarouselNext || (() => {})}
            onCarouselPrev={ctx.onCarouselPrev || (() => {})}
            onCarouselGoTo={ctx.onCarouselGoTo || (() => {})}
            onTouchStart={ctx.onTouchStart}
            onTouchMove={ctx.onTouchMove}
            onTouchEnd={ctx.onTouchEnd}
            onMouseDown={ctx.onMouseDown}
            onMouseMove={ctx.onMouseMove}
            onMouseUp={ctx.onMouseUp}
            onMouseLeave={ctx.onMouseLeave}
            config={section.config}
          />
        </DeferredSection>
      );

    case "ticker":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[10rem]">
          <GoldTickerSection config={section.config} />
        </DeferredSection>
      );

    case "campaign":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[34rem]">
          <CampaignBanner
            exploreCollectionImage={ctx.campaignBannerImage || ""}
            parallaxOffset={ctx.parallaxOffset || 0}
            imageAlt={ctx.campaignBannerAltText || undefined}
            config={section.config}
          />
        </DeferredSection>
      );

    case "arrivals":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[34rem]">
          <NewArrivalsSection
            newArrivals={ctx.newArrivals || []}
            isNewArrivalsSuccess={ctx.isNewArrivalsSuccess || false}
            config={section.config}
          />
        </DeferredSection>
      );

    case "services":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[22rem]">
          <OurServices config={section.config} />
        </DeferredSection>
      );

    case "contact":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[26rem]">
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
        <DeferredSection key={key} minHeightClassName="min-h-[26rem]">
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
        <DeferredSection key={key} minHeightClassName="min-h-[16rem]">
          <BackToTopSection
            imageUrl={
              imageFromConfig ||
              ctx.campaignBannerImage ||
              "/images/home-campaign-editorial.webp"
            }
            imageAlt={ctx.campaignBannerAltText || undefined}
          />
        </DeferredSection>
      );
    }

    case "faq":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[24rem]">
          <FaqSection config={section.config} />
        </DeferredSection>
      );

    case "fresh-release":
      return (
        <DeferredSection key={key} minHeightClassName="min-h-[30rem]">
          <FreshReleaseSection config={section.config} />
        </DeferredSection>
      );

    default:
      return null;
  }
}
