export type SectionCategory =
  | "hero"
  | "products"
  | "content"
  | "media"
  | "interactive"
  | "utility";

export type SectionBadge = "new" | "popular" | "pro";

export type SectionType =
  | "hero-slider"
  | "hero-video"
  | "hero-split"
  | "featured-products"
  | "new-arrivals"
  | "category-grid"
  | "testimonial"
  | "faq"
  | "cta-banner"
  | "gallery"
  | "video"
  | "newsletter"
  | "countdown"
  | "map"
  | "ticker"
  | "quote"
  | "divider"
  | "text-block"
  | "campaign-banner"
  | "services"
  | "fresh-release"
  | "contact"
  | "back-to-top";

export interface SectionTypeDefinition {
  type: SectionType;
  apiType: string;
  label: string;
  category: SectionCategory;
  description: string;
  defaultConfig: Record<string, unknown>;
  badge?: SectionBadge;
  unique?: boolean;
  variant?: string;
  supportsRendering?: boolean;
}

export const SECTION_CATEGORY_META: Array<{
  id: "all" | SectionCategory;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "hero", label: "Hero" },
  { id: "products", label: "Products" },
  { id: "content", label: "Content" },
  { id: "media", label: "Media" },
  { id: "interactive", label: "Interactive" },
  { id: "utility", label: "Utility" },
];

export const SECTION_TYPES: SectionTypeDefinition[] = [
  {
    type: "hero-slider",
    apiType: "hero",
    label: "Hero Slider",
    category: "hero",
    description: "Cinematic hero with layered slides and a gold CTA.",
    badge: "popular",
    unique: true,
    variant: "slider",
    supportsRendering: true,
    defaultConfig: {
      variant: "slider",
      eyebrow: "Rare Atelier",
      title: "A dark editorial entrance for your storefront.",
      text: "Lead with a cinematic first impression and layered storytelling.",
      ctaLabel: "Explore Collection",
      ctaHref: "/products",
    },
  },
  {
    type: "hero-video",
    apiType: "hero",
    label: "Hero with Video",
    category: "hero",
    description: "Immersive opening block with motion-first storytelling.",
    unique: true,
    variant: "video",
    supportsRendering: true,
    defaultConfig: {
      variant: "video",
      eyebrow: "Motion Story",
      title: "Use motion to frame your latest campaign.",
      text: "Pair atmospheric footage with a restrained luxury layout.",
      ctaLabel: "Watch Story",
      ctaHref: "/products",
    },
  },
  {
    type: "hero-split",
    apiType: "hero",
    label: "Hero Split",
    category: "hero",
    description: "Balanced editorial hero with copy on one side and media on the other.",
    unique: true,
    variant: "split",
    supportsRendering: true,
    defaultConfig: {
      variant: "split",
      eyebrow: "Editorial Layout",
      title: "Present a campaign with image and copy in tandem.",
      text: "A composed split layout for launches, capsules, and brand stories.",
      ctaLabel: "Discover More",
      ctaHref: "/products",
    },
  },
  {
    type: "featured-products",
    apiType: "featured",
    label: "Featured Products",
    category: "products",
    description: "Curated merchandise grid with premium product cards.",
    supportsRendering: true,
    defaultConfig: {
      title: "Featured Products",
      text: "Spotlight your hero assortment with a premium edit.",
    },
  },
  {
    type: "new-arrivals",
    apiType: "arrivals",
    label: "New Arrivals",
    category: "products",
    description: "Fresh releases arranged in a clean release grid.",
    badge: "new",
    supportsRendering: true,
    defaultConfig: {
      title: "New Arrivals",
      text: "Show the latest additions to the collection.",
    },
  },
  {
    type: "category-grid",
    apiType: "featured",
    label: "Category Grid",
    category: "products",
    description: "Browse-by-category layout with editorial tiles.",
    variant: "category-grid",
    supportsRendering: true,
    defaultConfig: {
      variant: "category-grid",
      title: "Shop by Category",
      text: "Guide shoppers into your core collections and product families.",
    },
  },
  {
    type: "testimonial",
    apiType: "testimonial",
    label: "Testimonials",
    category: "content",
    description: "Social proof carousel with refined quote styling.",
    badge: "new",
    unique: true,
    supportsRendering: false,
    defaultConfig: {
      title: "What Clients Say",
      items: [],
    },
  },
  {
    type: "faq",
    apiType: "faq",
    label: "FAQ Accordion",
    category: "content",
    description: "Accordion section for delivery, returns, and customer questions.",
    unique: true,
    supportsRendering: true,
    defaultConfig: {
      title: "Frequently Asked Questions",
      items: [],
    },
  },
  {
    type: "cta-banner",
    apiType: "campaign",
    label: "CTA Banner",
    category: "content",
    description: "Full-width call-to-action block for campaigns and promotions.",
    variant: "cta-banner",
    supportsRendering: true,
    defaultConfig: {
      variant: "cta-banner",
      title: "Invite your audience into the next drop.",
      text: "A bold banner for campaign launches and seasonal pushes.",
      ctaLabel: "Shop Now",
      ctaHref: "/products",
    },
  },
  {
    type: "gallery",
    apiType: "gallery",
    label: "Photo Gallery",
    category: "media",
    description: "Masonry-inspired image showcase for editorial storytelling.",
    supportsRendering: false,
    defaultConfig: {
      title: "Gallery",
      images: [],
    },
  },
  {
    type: "video",
    apiType: "video",
    label: "Video Embed",
    category: "media",
    description: "Embedded campaign film or lookbook video module.",
    supportsRendering: false,
    defaultConfig: {
      title: "Campaign Film",
      url: "",
    },
  },
  {
    type: "newsletter",
    apiType: "contact",
    label: "Newsletter Signup",
    category: "interactive",
    description: "Email capture block styled for luxury storefronts.",
    variant: "newsletter",
    unique: true,
    supportsRendering: true,
    defaultConfig: {
      variant: "newsletter",
      title: "Join the Rare List",
      text: "Get launch alerts, private previews, and atelier notes.",
    },
  },
  {
    type: "countdown",
    apiType: "countdown",
    label: "Countdown Timer",
    category: "interactive",
    description: "Launch countdown for timed releases and private drops.",
    supportsRendering: false,
    defaultConfig: {
      title: "Next Drop",
      targetDate: "",
    },
  },
  {
    type: "map",
    apiType: "map",
    label: "Store Map",
    category: "interactive",
    description: "Location block for showroom visits or appointment-based stores.",
    supportsRendering: false,
    defaultConfig: {
      title: "Visit the Store",
      address: "",
    },
  },
  {
    type: "ticker",
    apiType: "ticker",
    label: "Announcement Bar",
    category: "utility",
    description: "Scrolling gold ticker for shipping, launches, and promos.",
    unique: true,
    supportsRendering: true,
    defaultConfig: {
      items: ["Worldwide shipping", "New capsule live now", "Private appointments available"],
    },
  },
  {
    type: "quote",
    apiType: "quote",
    label: "Quote Block",
    category: "utility",
    description: "Editorial statement, manifesto, or founder quote.",
    supportsRendering: true,
    defaultConfig: {
      text: "Crafted slowly. Worn often. Remembered always.",
      attribution: "Rare Atelier",
    },
  },
  {
    type: "divider",
    apiType: "campaign",
    label: "Divider",
    category: "utility",
    description: "Elegant visual break with a label and line detail.",
    variant: "divider",
    supportsRendering: true,
    defaultConfig: {
      variant: "divider",
      title: "Collection Break",
      text: "A refined visual pause between sections.",
    },
  },
  {
    type: "text-block",
    apiType: "text-block",
    label: "Rich Text Block",
    category: "utility",
    description: "Flexible copy section for editorial notes and brand storytelling.",
    supportsRendering: false,
    defaultConfig: {
      title: "Editorial Copy",
      content: "",
    },
  },
  {
    type: "campaign-banner",
    apiType: "campaign",
    label: "Campaign Banner",
    category: "content",
    description: "Existing campaign banner used by the current storefront renderer.",
    supportsRendering: true,
    defaultConfig: {
      title: "Campaign Banner",
      text: "Use a striking image and compact CTA to punctuate the page.",
    },
  },
  {
    type: "services",
    apiType: "services",
    label: "Services",
    category: "utility",
    description: "Current services section for delivery, tailoring, or support highlights.",
    supportsRendering: true,
    defaultConfig: {
      title: "Services",
      items: [],
    },
  },
  {
    type: "fresh-release",
    apiType: "fresh-release",
    label: "Fresh Release",
    category: "products",
    description: "Current release layout used by the existing storefront canvas.",
    supportsRendering: true,
    defaultConfig: {
      title: "Fresh Release",
      text: "Spotlight a newly launched drop with concise copy.",
    },
  },
  {
    type: "contact",
    apiType: "contact",
    label: "Contact",
    category: "interactive",
    description: "Current contact/newsletter-style footer section.",
    unique: true,
    supportsRendering: true,
    defaultConfig: {},
  },
  {
    type: "back-to-top",
    apiType: "back-to-top",
    label: "Back To Top",
    category: "utility",
    description: "Current utility footer section with a visual return-to-top affordance.",
    unique: true,
    supportsRendering: true,
    defaultConfig: {},
  },
];

export function getSectionVariant(config: Record<string, unknown> | null | undefined) {
  return typeof config?.variant === "string" ? config.variant : null;
}

export function getSectionTypeDefinitionById(type: SectionType) {
  return SECTION_TYPES.find((entry) => entry.type === type);
}

export function resolveSectionTypeDefinition(section: {
  sectionType: string;
  config?: Record<string, unknown> | null;
}) {
  const variant = getSectionVariant(section.config);

  return (
    SECTION_TYPES.find(
      (entry) =>
        entry.apiType === section.sectionType &&
        (entry.variant ? entry.variant === variant : true),
    ) ??
    SECTION_TYPES.find((entry) => entry.apiType === section.sectionType) ??
    null
  );
}

export function getSectionLabel(section: {
  sectionType: string;
  label?: string | null;
  config?: Record<string, unknown> | null;
}) {
  return section.label || resolveSectionTypeDefinition(section)?.label || section.sectionType;
}
