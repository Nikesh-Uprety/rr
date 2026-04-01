import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

interface CampaignBannerProps {
  exploreCollectionImage: string;
  parallaxOffset: any;
  imageAlt?: string;
  config?: Record<string, any>;
}

const CAMPAIGN_IMAGE_HARD_FALLBACK = "/images/home-campaign-editorial.webp";

function handleCampaignImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  preferredFallback: string,
) {
  const image = event.currentTarget;
  const current = image.getAttribute("src") ?? "";
  const fallback = preferredFallback || CAMPAIGN_IMAGE_HARD_FALLBACK;

  if (current !== fallback) {
    image.setAttribute("src", fallback);
    return;
  }

  if (current !== CAMPAIGN_IMAGE_HARD_FALLBACK) {
    image.setAttribute("src", CAMPAIGN_IMAGE_HARD_FALLBACK);
  }
}

const DEFAULT_LOOKBOOK_LABELS = [
  "Vol. I — Essentials",
  "Outerwear",
  "Street",
  "The Silhouette",
  "Footwear",
  "Archive",
  "Editorial",
  "Lookbook IV",
];

function getLookbookGridClasses(layoutPreset?: string) {
  if (layoutPreset === "balanced") {
    return [
      "md:col-span-4 md:row-span-2",
      "md:col-span-4",
      "md:col-span-4",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-4",
    ];
  }

  if (layoutPreset === "stacked") {
    return [
      "md:col-span-6 md:row-span-2",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-6",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-6",
      "md:col-span-6",
    ];
  }

  return [
    "md:col-span-5 md:row-span-2",
    "md:col-span-3",
    "md:col-span-4",
    "md:col-span-4",
    "md:col-span-3",
    "md:col-span-3",
    "md:col-span-4",
    "md:col-span-5",
  ];
}

function MaisonNocturneLookbook({
  exploreCollectionImage,
  config,
}: {
  exploreCollectionImage: string;
  config?: Record<string, any>;
}) {
  const images =
    Array.isArray(config?.images) && config.images.length > 0
      ? config.images
      : Array.from({ length: 8 }, (_, index) => ({
          image: config?.fallbackImage ?? exploreCollectionImage,
          label: DEFAULT_LOOKBOOK_LABELS[index],
          index: `0${index + 1}`,
        }));
  const gridClasses = getLookbookGridClasses(config?.layoutPreset);
  const eyebrow = config?.eyebrow ?? "Editorial / Lookbook";
  const title = config?.title ?? "Frames from the atelier.";
  const text =
    config?.text ??
    "A magazine-style grid of campaign stills, silhouettes, and styling cues built from the current Rare visual language.";

  return (
    <section
      className="py-20 sm:py-24"
      style={{ background: "var(--bg)" }}
      data-navbar-trigger="maison-nocturne"
    >
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="reveal mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.28em] text-[var(--gold)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {eyebrow}
            </p>
            <h2
              className="mt-4 text-balance leading-[0.98]"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(34px, 5vw, 64px)",
                color: "var(--fg)",
              }}
            >
              {title}
            </h2>
          </div>
          <p
            className="max-w-md text-sm leading-6 text-[var(--fg-dim)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {text}
          </p>
        </div>

        <div className="grid auto-rows-[230px] grid-cols-1 gap-[6px] md:grid-cols-12 md:auto-rows-[300px] xl:auto-rows-[340px]">
          {images.slice(0, 8).map((item: any, index: number) => (
            <div
              key={`${item.label}-${index}`}
              className={`ed-cell group relative overflow-hidden ${gridClasses[index] ?? "md:col-span-3"}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={item.image || exploreCollectionImage}
                  alt={item.label}
                  className="h-full w-full object-cover brightness-[0.96] saturate-[1.22] contrast-[1.03] dark:brightness-[0.6] dark:saturate-[0.95] dark:contrast-[1] transition duration-700 group-hover:scale-[1.06]"
                  onError={(event) =>
                    handleCampaignImageError(event, exploreCollectionImage)
                  }
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-black/6 to-transparent dark:from-black/80 dark:via-black/30 dark:to-black/15" />
              </div>
              <span
                className="absolute right-4 top-4 text-[9px] uppercase tracking-[0.24em] text-[rgba(232,228,219,0.32)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {item.index ?? `0${index + 1}`}
              </span>
              <div className="absolute inset-x-0 bottom-0 translate-y-4 px-5 pb-5 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                <p
                  className="text-[9px] uppercase tracking-[0.22em] text-[var(--fg)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {item.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NikeshDesignLookbook({
  exploreCollectionImage,
  config,
}: {
  exploreCollectionImage: string;
  config?: Record<string, any>;
}) {
  const images =
    Array.isArray(config?.images) && config.images.length > 0
      ? config.images
      : Array.from({ length: 8 }, (_, index) => ({
          image: config?.fallbackImage ?? exploreCollectionImage,
          label: DEFAULT_LOOKBOOK_LABELS[index],
          index: `0${index + 1}`,
        }));
  const gridClasses = getLookbookGridClasses(config?.layoutPreset);

  return (
    <section className="py-20 sm:py-24" style={{ background: "var(--bg)" }}>
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="editorial-grid grid auto-rows-[230px] grid-cols-1 gap-[6px] md:grid-cols-12 md:auto-rows-[300px] xl:auto-rows-[340px]">
          {images.slice(0, 8).map((item: any, index: number) => (
            <div
              key={`${item.label}-${index}`}
              className={`ed-cell group relative overflow-hidden ${gridClasses[index] ?? "md:col-span-3"}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={item.image || exploreCollectionImage}
                  alt={item.label}
                  className="h-full w-full object-cover brightness-[0.96] saturate-[1.22] contrast-[1.03] dark:brightness-[0.6] dark:saturate-[0.95] dark:contrast-[1] transition duration-700 group-hover:scale-[1.06]"
                  onError={(event) =>
                    handleCampaignImageError(event, exploreCollectionImage)
                  }
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-black/6 to-transparent dark:from-black/80 dark:via-black/30 dark:to-black/15" />
              </div>
              <span
                className="absolute right-4 top-4 text-[9px] uppercase tracking-[0.24em] text-[rgba(232,228,219,0.32)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {item.index ?? `0${index + 1}`}
              </span>
              <div className="absolute inset-x-0 bottom-0 translate-y-4 px-5 pb-5 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                <p
                  className="text-[9px] uppercase tracking-[0.22em] text-[var(--fg)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {item.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CampaignBanner({
  exploreCollectionImage,
  parallaxOffset,
  imageAlt = "Campaign story",
  config,
}: CampaignBannerProps) {
  if (config?.variant === "nikeshdesign-lookbook") {
    return <NikeshDesignLookbook exploreCollectionImage={exploreCollectionImage} config={config} />;
  }

  if (config?.variant === "maison-nocturne-lookbook") {
    return <MaisonNocturneLookbook exploreCollectionImage={exploreCollectionImage} config={config} />;
  }

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "1960 / 1176" }}
    >
      <motion.div className="absolute inset-0 h-full w-full">
        <img
          alt={imageAlt}
          className="w-full h-full object-cover object-center"
          src={exploreCollectionImage}
          onError={(event) =>
            handleCampaignImageError(event, CAMPAIGN_IMAGE_HARD_FALLBACK)
          }
        />
      </motion.div>
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="group flex items-center gap-3 px-7 py-3.5 rounded-full bg-black/85 hover:bg-black text-white transition-all duration-300 shadow-xl hover:shadow-2xl backdrop-blur-sm border border-white/10"
          aria-label="Go to top"
        >
          <ArrowUp className="w-4 h-4 transition-transform group-hover:-translate-y-1" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em]">Back to Top</span>
        </button>
      </div>
    </section>
  );
}
