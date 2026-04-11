import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Eye,
  ImageIcon,
  Loader2,
  Monitor,
  Plus,
  Settings,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { fetchProducts } from "@/lib/api";
import { renderSection, type RenderSectionContext } from "@/lib/renderSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SortableSectionList } from "./SortableSectionList";
import { SectionPicker } from "./SectionPicker";
import { PageMetadataForm } from "./PageMetadataForm";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import type { CanvasPage, CanvasSection } from "@/lib/adminApi";
import {
  addPageSection,
  deletePageSection,
  duplicateCanvasPage,
  duplicateCanvasSection,
  getCanvasPage,
  getPageSections,
  toggleCanvasPagePublish,
  updateCanvasPage,
  updatePageSection,
  reorderPageSections,
  generatePreviewToken,
  uploadProductImageFile,
} from "@/lib/adminApi";
import {
  getSectionLabel,
  getSectionTypeDefinitionById,
  resolveSectionTypeDefinition,
  type SectionType,
} from "@/lib/sectionTypes";
import { useToast } from "@/hooks/use-toast";

interface PageEditorProps {
  pageId: number;
  onBack: () => void;
}

type PreviewViewport = "desktop" | "tablet" | "mobile";

type SectionEditorDraft = {
  label: string;
  isVisible: boolean;
  configText: string;
};

type SectionImageTarget =
  | {
      id: string;
      label: string;
      url: string | null;
      kind: "field";
      field: string;
    }
  | {
      id: string;
      label: string;
      url: string | null;
      kind: "slide";
      index: number;
    }
  | {
      id: string;
      label: string;
      url: string | null;
      kind: "images";
      index: number;
    };

const HERO_IMAGES_FALLBACK = [
  "/images/landingpage3.webp",
  "/images/landingpage4.webp",
  "/images/home-campaign-editorial.webp",
];

const VIEWPORT_BUTTONS: Array<{
  id: PreviewViewport;
  label: string;
  icon: typeof Monitor;
}> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

function buildSectionDraft(section: CanvasSection | null): SectionEditorDraft {
  return {
    label: section?.label ?? getSectionLabel(section ?? { sectionType: "", label: "", config: {} }),
    isVisible: section?.isVisible ?? true,
    configText: JSON.stringify(section?.config ?? {}, null, 2),
  };
}

function parseSectionConfigText(configText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(configText || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return null;
  }
}

function getSectionImageTargets(
  section: CanvasSection | null,
  config: Record<string, unknown> | null,
): SectionImageTarget[] {
  if (!section || !config) return [];

  const targets: SectionImageTarget[] = [];
  const imageFields = [
    "image",
    "imageUrl",
    "backgroundImage",
    "desktopImage",
    "mobileImage",
    "posterImage",
    "fallbackImage",
  ];

  for (const field of imageFields) {
    if (!Object.prototype.hasOwnProperty.call(config, field)) continue;
    const value = config[field];
    if (typeof value === "string" || value == null) {
      targets.push({
        id: `field:${field}`,
        label: field.replace(/([A-Z])/g, " $1").replace(/^./, (match) => match.toUpperCase()),
        url: typeof value === "string" ? value : null,
        kind: "field",
        field,
      });
    }
  }

  const slides = Array.isArray(config.slides) ? config.slides : [];
  if (slides.length > 0) {
    slides.forEach((slide, index) => {
      const image =
        slide && typeof slide === "object" && typeof (slide as { image?: unknown }).image === "string"
          ? ((slide as { image: string }).image ?? null)
          : null;
      targets.push({
        id: `slide:${index}`,
        label: `Hero slide ${index + 1}`,
        url: image,
        kind: "slide",
        index,
      });
    });
  } else if (section.sectionType === "hero") {
    targets.push({
      id: "slide:0",
      label: "Hero slide 1",
      url: null,
      kind: "slide",
      index: 0,
    });
  }

  const images = Array.isArray(config.images) ? config.images : [];
  images.forEach((item, index) => {
    const image =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? typeof (item as { image?: unknown }).image === "string"
            ? ((item as { image: string }).image ?? null)
            : typeof (item as { src?: unknown }).src === "string"
              ? ((item as { src: string }).src ?? null)
              : null
          : null;

    targets.push({
      id: `images:${index}`,
      label: `Gallery image ${index + 1}`,
      url: image,
      kind: "images",
      index,
    });
  });

  return targets;
}

function applySectionImageTarget(
  config: Record<string, unknown>,
  target: SectionImageTarget,
  url: string,
): Record<string, unknown> {
  if (target.kind === "field") {
    return { ...config, [target.field]: url };
  }

  if (target.kind === "slide") {
    const slides = Array.isArray(config.slides) ? [...config.slides] : [];
    const currentSlide =
      slides[target.index] && typeof slides[target.index] === "object"
        ? { ...(slides[target.index] as Record<string, unknown>) }
        : {};
    slides[target.index] = { ...currentSlide, image: url };
    return { ...config, slides };
  }

  const images = Array.isArray(config.images) ? [...config.images] : [];
  const currentImage = images[target.index];
  if (currentImage && typeof currentImage === "object" && !Array.isArray(currentImage)) {
    images[target.index] = { ...(currentImage as Record<string, unknown>), image: url };
  } else {
    images[target.index] = url;
  }
  return { ...config, images };
}

function getPreviewWidth(viewport: PreviewViewport) {
  if (viewport === "tablet") return "max-w-[920px]";
  if (viewport === "mobile") return "max-w-[440px]";
  return "max-w-[1560px]";
}

type HeroSlideDraft = {
  tag: string;
  headline: string;
  eyebrow: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
};

function buildPagePreviewHref(page: CanvasPage, token?: string | null) {
  const slug = page.slug === "/" ? "/" : page.slug;
  if (!token) return slug;
  return slug === "/" ? `/?token=${token}` : `${slug}?token=${token}`;
}

function buildEditableHeroSlides(config: Record<string, unknown> | null): HeroSlideDraft[] {
  if (!config) return [];

  const sourceSlides = Array.isArray(config.slides) && config.slides.length > 0
    ? config.slides
    : [
        {
          tag: typeof config.eyebrow === "string" ? config.eyebrow : "Campaign",
          headline: typeof config.title === "string" ? config.title : "Your hero headline",
          eyebrow: typeof config.eyebrow === "string" ? config.eyebrow : "Story layer",
          body: typeof config.text === "string" ? config.text : "Guide the customer with a simple hero story.",
          ctaLabel: typeof config.ctaLabel === "string" ? config.ctaLabel : "Shop now",
          ctaHref: typeof config.ctaHref === "string" ? config.ctaHref : "/products",
          image: typeof config.image === "string" ? config.image : "",
        },
      ];

  return sourceSlides.map((slide) => {
    const safe = slide && typeof slide === "object" ? slide as Record<string, unknown> : {};
    return {
      tag: typeof safe.tag === "string" ? safe.tag : typeof safe.eyebrow === "string" ? safe.eyebrow : "Campaign",
      headline: typeof safe.headline === "string" ? safe.headline : typeof safe.title === "string" ? safe.title : "Your hero headline",
      eyebrow: typeof safe.eyebrow === "string" ? safe.eyebrow : "Story layer",
      body: typeof safe.body === "string" ? safe.body : typeof safe.text === "string" ? safe.text : "Guide the customer with a simple hero story.",
      ctaLabel: typeof safe.ctaLabel === "string" ? safe.ctaLabel : "Shop now",
      ctaHref: typeof safe.ctaHref === "string" ? safe.ctaHref : "/products",
      image: typeof safe.image === "string" ? safe.image : "",
    };
  });
}

function applyHeroSlidesToConfig(
  config: Record<string, unknown> | null,
  slides: HeroSlideDraft[],
): Record<string, unknown> {
  const nextConfig = { ...(config ?? {}) };
  const normalizedSlides = slides.map((slide) => ({
    tag: slide.tag,
    headline: slide.headline,
    eyebrow: slide.eyebrow,
    body: slide.body,
    ctaLabel: slide.ctaLabel,
    ctaHref: slide.ctaHref,
    image: slide.image,
  }));
  const firstSlide = normalizedSlides[0];

  return {
    ...nextConfig,
    title: firstSlide?.headline ?? nextConfig.title,
    text: firstSlide?.body ?? nextConfig.text,
    eyebrow: firstSlide?.eyebrow ?? nextConfig.eyebrow,
    ctaLabel: firstSlide?.ctaLabel ?? nextConfig.ctaLabel,
    ctaHref: firstSlide?.ctaHref ?? nextConfig.ctaHref,
    slides: normalizedSlides,
  };
}

function PagePreview({
  page,
  sections,
  selectedSectionId,
  onSelectSection,
  viewport,
  onAddSection,
  onMoveSection,
  onOpenSettings,
}: {
  page: CanvasPage;
  sections: CanvasSection[];
  selectedSectionId: number | null;
  onSelectSection: (id: number) => void;
  viewport: PreviewViewport;
  onAddSection: () => void;
  onMoveSection: (id: number, direction: "up" | "down") => void;
  onOpenSettings: (id: number) => void;
}) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const { data: featuredProducts } = useQuery({
    queryKey: ["/api/products", { category: "featured", pageId: page.id }],
    queryFn: () => fetchProducts({ category: "featured", limit: 8 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newArrivals } = useQuery({
    queryKey: ["/api/products", { newArrival: true, pageId: page.id }],
    queryFn: () => fetchProducts({ newArrival: true, limit: 8 }),
    staleTime: 5 * 60 * 1000,
  });

  const visibleSections = useMemo(
    () => sections.filter((section) => section.isVisible).sort((a, b) => a.orderIndex - b.orderIndex),
    [sections],
  );

  const heroSections = visibleSections.filter((section) => section.sectionType === "hero");
  const orderedVisibleIds = visibleSections.map((section) => section.id);

  const heroImages = heroSections.length > 0
    ? (() => {
        const heroSection = heroSections[0];
        const slideImages =
          ((heroSection.config?.slides as Array<{ image?: string }> | undefined)
            ?.map((slide) => slide.image)
            .filter((image): image is string => Boolean(image)) ?? []);
        if (slideImages.length > 0) return slideImages;
        if (heroSection.config?.variant === "stuffyclone") return ["/images/stussy.webp"];
        return HERO_IMAGES_FALLBACK;
      })()
    : HERO_IMAGES_FALLBACK;

  const featuredProductsList = featuredProducts?.products ?? [];
  const newArrivalsList = newArrivals?.products ?? [];

  const previewCtx: RenderSectionContext = useMemo(
    () => ({
      heroImages,
      heroIndex,
      heroLoading: heroImages.length > 0 ? "loaded" : "idle",
      videoFailed,
      isMobile: viewport === "mobile",
      isTablet: viewport === "tablet",
      isTransitioning,
      onVideoError: () => setVideoFailed(true),
      featuredProducts: featuredProductsList,
      isFeaturedSuccess: featuredProductsList.length > 0,
      lifestyleImages: {},
      newArrivals: newArrivalsList,
      isNewArrivalsSuccess: newArrivalsList.length > 0,
      onCarouselNext: () => {
        if (heroImages.length <= 1) return;
        setIsTransitioning(true);
        window.setTimeout(() => {
          setHeroIndex((current) => (current + 1) % heroImages.length);
          setIsTransitioning(false);
        }, 450);
      },
      onCarouselPrev: () => {
        if (heroImages.length <= 1) return;
        setIsTransitioning(true);
        window.setTimeout(() => {
          setHeroIndex((current) => (current - 1 + heroImages.length) % heroImages.length);
          setIsTransitioning(false);
        }, 450);
      },
      onCarouselGoTo: (index: number) => {
        setIsTransitioning(true);
        window.setTimeout(() => {
          setHeroIndex(index);
          setIsTransitioning(false);
        }, 450);
      },
      isCanvasPreview: true,
    }),
    [featuredProductsList, heroImages, heroIndex, isTransitioning, newArrivalsList, videoFailed, viewport],
  );

  if (visibleSections.length === 0) {
    return (
      <div className="flex min-h-[720px] items-center justify-center bg-white px-10 py-16 text-neutral-900">
        <button
          type="button"
          onClick={onAddSection}
          className="flex max-w-md flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-[#6c8cff] bg-[#f8fbff] px-12 py-16 text-center transition-colors hover:bg-[#eef3ff]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#4565d0] text-white">
            <Plus className="h-6 w-6" />
          </span>
          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.24em] text-[#4565d0]">
            Start building
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">Add the first section to this blank page</h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Choose a hero, product grid, quote, services, or utility section and it will render here live.
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white text-neutral-900">
      <main>
        {visibleSections.map((section) => (
          <div
            key={section.id}
            role="button"
            tabIndex={0}
            className={cn(
              "group relative block w-full cursor-pointer text-left transition-all",
              selectedSectionId === section.id &&
                "ring-2 ring-inset ring-[#4565d0] shadow-[0_0_0_1px_rgba(69,101,208,0.32)]",
            )}
            onClick={() => onSelectSection(section.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectSection(section.id);
              }
            }}
          >
            <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-[#4565d0]/25 bg-[#132450]/88 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#dbe5ff] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {getSectionLabel(section)}
            </div>
            {selectedSectionId === section.id ? (
              <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-[#bfd1ff] bg-white/92 px-2 py-1 shadow-sm">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveSection(section.id, "up");
                  }}
                  disabled={orderedVisibleIds[0] === section.id}
                  className="rounded-full p-1 text-[#3654b1] transition-colors hover:bg-[#eef3ff] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Move section up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveSection(section.id, "down");
                  }}
                  disabled={orderedVisibleIds[orderedVisibleIds.length - 1] === section.id}
                  className="rounded-full p-1 text-[#3654b1] transition-colors hover:bg-[#eef3ff] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Move section down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenSettings(section.id);
                  }}
                  className="rounded-full p-1 text-[#3654b1] transition-colors hover:bg-[#eef3ff]"
                  aria-label="Open section settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {renderSection(section, previewCtx, `page-preview-${page.id}`)}
          </div>
        ))}
      </main>
    </div>
  );
}

export function PageEditor({ pageId, onBack }: PageEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sectionListRef = useRef<HTMLDivElement | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [activeImageTargetId, setActiveImageTargetId] = useState<string | null>(null);
  const [queuedImageUploadTargetId, setQueuedImageUploadTargetId] = useState<string | null>(null);
  const [uploadingImageTargetId, setUploadingImageTargetId] = useState<string | null>(null);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [sectionItems, setSectionItems] = useState<CanvasSection[]>([]);
  const [sectionDraft, setSectionDraft] = useState<SectionEditorDraft>(buildSectionDraft(null));
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    const previousClasses = root.className;
    const previousColorScheme = root.style.colorScheme;

    // Keep the canvas page preview in the intended storefront light theme
    // instead of letting the saved admin dark theme repaint it black.
    root.classList.remove("dark", "warm");
    root.classList.add("light");
    root.style.colorScheme = "light";

    return () => {
      root.className = previousClasses;
      root.style.colorScheme = previousColorScheme;
    };
  }, []);

  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ["/api/admin/canvas/pages", pageId],
    queryFn: () => getCanvasPage(pageId),
  });

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ["/api/admin/canvas/pages", pageId, "sections"],
    queryFn: () => getPageSections(pageId),
  });

  useEffect(() => {
    setSectionItems((sections ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex));
  }, [sections]);

  useEffect(() => {
    if (!page) return;
    setTitleDraft(page.title);
  }, [page]);

  useEffect(() => {
    if (sectionItems.length === 0) {
      setSelectedSectionId(null);
      setSectionDraft(buildSectionDraft(null));
      setInspectorOpen(false);
      return;
    }

    const stillExists =
      selectedSectionId !== null && sectionItems.some((section) => section.id === selectedSectionId);
    if (!stillExists) {
      setSelectedSectionId(sectionItems[0].id);
    }
  }, [sectionItems, selectedSectionId]);

  const selectedSection = useMemo(
    () => sectionItems.find((section) => section.id === selectedSectionId) ?? null,
    [sectionItems, selectedSectionId],
  );

  const parsedDraftConfig = useMemo(
    () => parseSectionConfigText(sectionDraft.configText),
    [sectionDraft.configText],
  );


  const heroSlides = useMemo(
    () => (selectedSection?.sectionType === "hero" ? buildEditableHeroSlides(parsedDraftConfig) : []),
    [parsedDraftConfig, selectedSection?.sectionType],
  );

  const imageTargets = useMemo(
    () => getSectionImageTargets(selectedSection, parsedDraftConfig),
    [parsedDraftConfig, selectedSection],
  );

  const activeImageTarget = useMemo(
    () => imageTargets.find((target) => target.id === activeImageTargetId) ?? null,
    [activeImageTargetId, imageTargets],
  );
  const isStuffyLandingHero =
    selectedSection?.sectionType === "hero" &&
    parsedDraftConfig?.variant === "stuffyclone";
  const stuffyHeroImageTarget = useMemo(
    () =>
      imageTargets.find((target) => target.id === "slide:0") ??
      imageTargets.find((target) => target.kind === "slide") ??
      null,
    [imageTargets],
  );
  const stuffyHeroImageUrl = stuffyHeroImageTarget?.url ?? heroSlides[0]?.image ?? "";


  const replaceDraftConfig = useCallback((nextConfig: Record<string, unknown>) => {
    setSectionDraft((current) => ({
      ...current,
      configText: JSON.stringify(nextConfig, null, 2),
    }));
  }, []);

  const updateHeroSlidesDraft = useCallback((nextSlides: HeroSlideDraft[]) => {
    replaceDraftConfig(applyHeroSlidesToConfig(parsedDraftConfig, nextSlides));
  }, [parsedDraftConfig, replaceDraftConfig]);

  const previewSections = useMemo(() => {
    if (!selectedSection || !parsedDraftConfig) {
      return sectionItems;
    }

    return sectionItems.map((section) =>
      section.id === selectedSection.id
        ? {
            ...section,
            label: sectionDraft.label.trim() || getSectionLabel(section),
            isVisible: sectionDraft.isVisible,
            config: parsedDraftConfig,
          }
        : section,
    );
  }, [parsedDraftConfig, sectionDraft.isVisible, sectionDraft.label, sectionItems, selectedSection]);

  useEffect(() => {
    setSectionDraft(buildSectionDraft(selectedSection));
    setActiveImageTargetId(null);
  }, [selectedSection]);


  useEffect(() => {
    if (!selectedSection) {
      setInspectorOpen(false);
    }
  }, [selectedSection]);

  const pageUpdateMutation = useMutation({
    mutationFn: (data: Partial<CanvasPage>) => updateCanvasPage(pageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages", pageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to update page.", variant: "destructive" });
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: (data: { sectionType: string; label?: string; config?: Record<string, unknown> }) =>
      addPageSection(pageId, data),
    onMutate: async (payload) => {
      const optimisticId = -Date.now();
      const optimisticSection: CanvasSection = {
        id: optimisticId,
        pageId,
        templateId: null,
        sectionType: payload.sectionType,
        label: payload.label ?? payload.sectionType,
        orderIndex: sectionItems.length + 1,
        isVisible: true,
        config: payload.config ?? {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSectionItems((current) => [...current, optimisticSection]);
      setSelectedSectionId(optimisticId);

      return { optimisticId };
    },
    onSuccess: (createdSection, _payload, context) => {
      setSectionItems((current) =>
        current.map((section) => (section.id === context?.optimisticId ? createdSection : section)),
      );
      setSelectedSectionId(createdSection.id);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages", pageId, "sections"] });
      toast({ title: "Section added", description: "New section has been added to the page." });

      window.setTimeout(() => {
        const row = sectionListRef.current?.querySelector<HTMLElement>(
          `[data-section-row-id="${createdSection.id}"]`,
        );
        row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 60);
    },
    onError: (err: Error, _payload, context) => {
      setSectionItems((current) => current.filter((section) => section.id !== context?.optimisticId));
      setSelectedSectionId((current) => (current === context?.optimisticId ? null : current));
      toast({ title: "Error", description: err.message || "Failed to add section.", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => reorderPageSections(pageId, orderedIds),
    onError: (err: Error) => {
      setSectionItems((sections ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex));
      toast({ title: "Error", description: err.message || "Failed to reorder sections.", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages", pageId, "sections"] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => toggleCanvasPagePublish(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages", pageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages"] });
    },
  });

  const duplicatePageMutation = useMutation({
    mutationFn: () => duplicateCanvasPage(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages"] });
      toast({ title: "Page duplicated", description: "A copy of the page has been created." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to duplicate page.", variant: "destructive" });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: number) => deletePageSection(pageId, sectionId),
    onSuccess: (_data, sectionId) => {
      setSectionItems((current) => current.filter((section) => section.id !== sectionId));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages", pageId, "sections"] });
      toast({ title: "Section deleted", description: "Section has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to delete section.", variant: "destructive" });
    },
  });

  const duplicateSectionMutation = useMutation({
    mutationFn: (sectionId: number) => duplicateCanvasSection(sectionId),
    onSuccess: (section) => {
      setSectionItems((current) => [...current, section].sort((a, b) => a.orderIndex - b.orderIndex));
      setSelectedSectionId(section.id);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages", pageId, "sections"] });
      toast({ title: "Section duplicated", description: "Copy has been added." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to duplicate section.", variant: "destructive" });
    },
  });

  const patchSectionMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CanvasSection>;
    }) => updatePageSection(pageId, id, data),
    onSuccess: (updatedSection) => {
      setSectionItems((current) =>
        current
          .map((section) => (section.id === updatedSection.id ? updatedSection : section))
          .sort((a, b) => a.orderIndex - b.orderIndex),
      );
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages", pageId, "sections"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to update section.", variant: "destructive" });
    },
  });

  const handleAddSection = useCallback(
    (sectionType: SectionType) => {
      const definition = getSectionTypeDefinitionById(sectionType);
      addSectionMutation.mutate({
        sectionType: definition?.apiType || sectionType,
        label: definition?.label || sectionType,
        config: definition?.defaultConfig || {},
      });
    },
    [addSectionMutation],
  );

  const handleReorder = useCallback(
    (orderedIds: number[]) => {
      setSectionItems((current) => {
        const map = new Map(current.map((section) => [section.id, section] as const));
        return orderedIds
          .map((id, index) => {
            const section = map.get(id);
            return section ? { ...section, orderIndex: index + 1 } : null;
          })
          .filter((section): section is CanvasSection => Boolean(section));
      });
      reorderMutation.mutate(orderedIds);
    },
    [reorderMutation],
  );

  const handleToggleVisibility = useCallback(
    (id: number) => {
      const section = sectionItems.find((item) => item.id === id);
      if (!section) return;
      patchSectionMutation.mutate({ id, data: { isVisible: !section.isVisible } });
    },
    [patchSectionMutation, sectionItems],
  );

  const handleDuplicate = useCallback(
    (id: number) => {
      duplicateSectionMutation.mutate(id);
    },
    [duplicateSectionMutation],
  );

  const handleDelete = useCallback(
    (id: number) => {
      deleteSectionMutation.mutate(id);
    },
    [deleteSectionMutation],
  );

  const moveSelectedSection = useCallback(
    (sectionId: number, direction: "up" | "down") => {
      if (!sectionId) return;

      const orderedIds = sectionItems
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((section) => section.id);
      const currentIndex = orderedIds.indexOf(sectionId);
      if (currentIndex === -1) return;

      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= orderedIds.length) return;

      const nextIds = [...orderedIds];
      const [moved] = nextIds.splice(currentIndex, 1);
      nextIds.splice(nextIndex, 0, moved);
      handleReorder(nextIds);
    },
    [handleReorder, sectionItems],
  );

  const handleRename = useCallback(
    (id: number, label: string) => {
      patchSectionMutation.mutate({ id, data: { label } });
    },
    [patchSectionMutation],
  );

  const applyImageToTarget = useCallback(
    (
      target: SectionImageTarget,
      url: string,
      options?: {
        closeLibrary?: boolean;
        successTitle?: string;
        successDescription?: string;
      },
    ) => {
      if (!selectedSection) return;
      const currentConfig = parseSectionConfigText(sectionDraft.configText) ?? {};
      const nextConfig = applySectionImageTarget(currentConfig, target, url);
      const nextText = JSON.stringify(nextConfig, null, 2);

      setSectionDraft((current) => ({ ...current, configText: nextText }));
      patchSectionMutation.mutate(
        {
          id: selectedSection.id,
          data: {
            label: sectionDraft.label.trim() || getSectionLabel(selectedSection),
            isVisible: sectionDraft.isVisible,
            config: nextConfig,
          },
        },
        {
          onSuccess: () => {
            toast({
              title: options?.successTitle ?? "Image updated",
              description:
                options?.successDescription ?? "Section media changed on the builder canvas.",
            });
          },
        },
      );
      if (options?.closeLibrary ?? true) {
        setShowMediaLibrary(false);
      }
    },
    [
      patchSectionMutation,
      sectionDraft.configText,
      sectionDraft.isVisible,
      sectionDraft.label,
      selectedSection,
      toast,
    ],
  );

  const applyImageSelection = useCallback(
    (url: string) => {
      if (!activeImageTarget) return;
      applyImageToTarget(activeImageTarget, url);
    },
    [activeImageTarget, applyImageToTarget],
  );

  const uploadTargetImageMutation = useMutation({
    mutationFn: async ({
      file,
      target,
    }: {
      file: File;
      target: SectionImageTarget;
    }) => {
      const url = await uploadProductImageFile(file);
      return { url, target };
    },
    onMutate: ({ target }) => {
      setUploadingImageTargetId(target.id);
    },
    onSuccess: ({ url, target }) => {
      applyImageToTarget(target, url, {
        closeLibrary: false,
        successTitle: "Image uploaded",
        successDescription: "Uploaded to Tigris and applied to this section.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Upload failed",
        description: err.message || "Failed to upload image to Tigris.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUploadingImageTargetId(null);
      setQueuedImageUploadTargetId(null);
      if (imageUploadInputRef.current) {
        imageUploadInputRef.current.value = "";
      }
    },
  });

  const triggerDirectImageUpload = useCallback((targetId: string) => {
    setQueuedImageUploadTargetId(targetId);
    if (imageUploadInputRef.current) {
      imageUploadInputRef.current.value = "";
      imageUploadInputRef.current.click();
    }
  }, []);

  const handleDirectImageUploadChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !queuedImageUploadTargetId) {
        setQueuedImageUploadTargetId(null);
        return;
      }

      const target = imageTargets.find((item) => item.id === queuedImageUploadTargetId);
      if (!target) {
        setQueuedImageUploadTargetId(null);
        toast({
          title: "Upload failed",
          description: "The selected image slot is no longer available.",
          variant: "destructive",
        });
        return;
      }

      uploadTargetImageMutation.mutate({ file, target });
    },
    [imageTargets, queuedImageUploadTargetId, toast, uploadTargetImageMutation],
  );

  const openStorefrontPreview = useCallback(async () => {
    if (!page) return;

    const previewUrl = page.status === "published"
      ? buildPagePreviewHref(page)
      : buildPagePreviewHref(page, await generatePreviewToken(page.id));

    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }, [page]);

  const handleSaveSection = useCallback(() => {
    if (!selectedSection) return;

    let parsedConfig: Record<string, unknown>;
    try {
      const parsed = JSON.parse(sectionDraft.configText || "{}");
      parsedConfig =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      toast({
        title: "Invalid JSON",
        description: "Fix the configuration JSON before saving this section.",
        variant: "destructive",
      });
      return;
    }

    patchSectionMutation.mutate(
      {
        id: selectedSection.id,
        data: {
          label: sectionDraft.label.trim() || getSectionLabel(selectedSection),
          isVisible: sectionDraft.isVisible,
          config: parsedConfig,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Section saved", description: "Preview and section settings are now updated." });
        },
      },
    );
  }, [patchSectionMutation, sectionDraft, selectedSection, toast]);

  if (pageLoading || sectionsLoading) {
    return (
      <div className="flex h-full gap-6 p-6">
        <div className="w-64 space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
        <div className="flex-1">
          <Skeleton className="h-full w-full rounded-2xl" />
        </div>
        <div className="w-[300px]">
          <Skeleton className="h-full w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Page not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.18),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef3ff_100%)] text-neutral-900">
      <div className="flex w-64 shrink-0 flex-col border-r border-black/10 bg-white/92 backdrop-blur-sm">
        <div className="space-y-4 border-b border-black/10 p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-neutral-600 hover:bg-black/5 hover:text-neutral-900" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">{page.title}</h3>
              <p className="truncate font-mono text-[10px] text-neutral-500">{page.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border-black/10 bg-black/[0.03] text-[10px] font-semibold uppercase tracking-[0.18em]",
                page.status === "published" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
              )}
            >
              {page.status === "published" ? "Published" : "Draft"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-neutral-600 hover:bg-black/5 hover:text-neutral-900"
              onClick={() => publishMutation.mutate()}
            >
              {page.status === "published" ? "Unpublish" : "Publish"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs text-neutral-600 hover:bg-black/5 hover:text-neutral-900"
              onClick={() => duplicatePageMutation.mutate()}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Duplicate
            </Button>
          </div>
        </div>

        <div ref={sectionListRef} className="flex-1 overflow-y-auto p-3">
          {sectionItems.length > 0 ? (
            <SortableSectionList
              sections={sectionItems}
              selectedId={selectedSectionId}
              onSelect={setSelectedSectionId}
              onReorder={handleReorder}
              onRename={handleRename}
              onToggleVisibility={handleToggleVisibility}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-10 text-center">
              <p className="text-sm text-neutral-700">No sections yet</p>
              <p className="mt-1 text-xs text-neutral-500">Start the page with a Rare Atelier section block.</p>
            </div>
          )}
        </div>

        <div className="border-t border-black/10 p-3">
          <button
            type="button"
            onClick={() => setShowSectionPicker(true)}
            className="flex w-full items-center justify-center rounded-[20px] border border-dashed border-[#6c8cff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-4 text-sm font-semibold text-[#3654b1] transition-colors hover:border-[#4565d0] hover:bg-[#eef3ff]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add a Section
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-black/10 bg-white/85 px-5 py-4 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <Input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft.trim() !== page.title) {
                  pageUpdateMutation.mutate({ title: titleDraft.trim() });
                }
              }}
              className="h-10 border-black/10 bg-white text-base font-semibold text-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Dedicated builder canvas with live section rendering and blue selection outlines.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white p-1">
            {VIEWPORT_BUTTONS.map((viewport) => {
              const Icon = viewport.icon;
              const active = previewViewport === viewport.id;
              return (
                <button
                  key={viewport.id}
                  type="button"
                  onClick={() => setPreviewViewport(viewport.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-[#4565d0] text-white"
                      : "text-neutral-600 hover:bg-black/5 hover:text-neutral-900",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {viewport.label}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-2 border border-black/10 bg-white text-neutral-700 hover:bg-black/5 hover:text-neutral-900"
            onClick={() => { void openStorefrontPreview(); }}
          >
            <Eye className="h-4 w-4" />
            Preview Storefront
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={!selectedSection}
            className="h-9 gap-2 border border-black/10 bg-white text-neutral-700 hover:bg-black/5 hover:text-neutral-900 disabled:opacity-45"
            onClick={() => setInspectorOpen((current) => (selectedSection ? !current : false))}
          >
            <Settings className="h-4 w-4" />
            Section Settings
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-neutral-700 hover:bg-black/5 hover:text-neutral-900"
            onClick={() => setShowMetadataForm(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#f7f8fc_0%,#eef3ff_100%)]">
            <div className="border-b border-black/10 px-6 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#4565d0]">
                Builder Canvas
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-6 py-8">
              <div className={cn("mx-auto transition-all duration-300", getPreviewWidth(previewViewport))}>
                <div className="overflow-hidden rounded-[34px] border-2 border-[#bfd1ff] bg-white shadow-[0_32px_90px_rgba(69,101,208,0.18)]">
                  <PagePreview
                    page={page}
                    sections={previewSections}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={setSelectedSectionId}
                    viewport={previewViewport}
                    onAddSection={() => setShowSectionPicker(true)}
                    onMoveSection={moveSelectedSection}
                    onOpenSettings={(id) => {
                      setSelectedSectionId(id);
                      setInspectorOpen(true);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col border-l border-black/10 bg-white/92 backdrop-blur-sm transition-all duration-300",
              inspectorOpen && selectedSection ? "w-[300px]" : "w-[72px]",
            )}
          >
            {inspectorOpen && selectedSection ? (
              <>
                <div className="border-b border-black/10 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-neutral-900">
                        {getSectionLabel(selectedSection)}
                      </h2>
                      <p className="mt-1 text-xs text-neutral-500">
                        Edit the selected {resolveSectionTypeDefinition(selectedSection)?.label ?? selectedSection.sectionType} block.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setInspectorOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.18em] text-neutral-500">Section Label</Label>
                    <Input
                      value={sectionDraft.label}
                      onChange={(event) =>
                        setSectionDraft((current) => ({ ...current, label: event.target.value }))
                      }
                      className="border-black/10 bg-white text-neutral-900"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">Visible on page</p>
                      <p className="text-xs text-neutral-500">Hidden sections stay in the list but disappear from preview.</p>
                    </div>
                    <Switch
                      checked={sectionDraft.isVisible}
                      onCheckedChange={(checked) =>
                        setSectionDraft((current) => ({ ...current, isVisible: checked }))
                      }
                    />
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Section Type</p>
                    <p className="mt-2 text-sm text-neutral-900">
                      {resolveSectionTypeDefinition(selectedSection)?.label ?? selectedSection.sectionType}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Click any block on the canvas, then use the gear to keep editing without leaving the page.
                    </p>
                  </div>

                  {selectedSection.sectionType === "hero" ? (
                    <div className="rounded-2xl border border-[#dbe5ff] bg-[#f8fbff] p-4">
                      {isStuffyLandingHero ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4565d0]">
                              Stuffy landing background
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              This template uses one full-screen background image. Change that image here.
                            </p>
                          </div>
                          <div className="overflow-hidden rounded-[24px] border border-[#d7e4ff] bg-white shadow-sm">
                            <div className="relative aspect-[4/5] bg-black">
                              {stuffyHeroImageUrl ? (
                                <img
                                  src={stuffyHeroImageUrl}
                                  alt="Stuffy landing background preview"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                                  No landing background image selected yet.
                                </div>
                              )}
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
                                  Live background
                                </p>
                                <p className="mt-2 text-lg font-semibold text-white">
                                  Stuffy landing hero
                                </p>
                              </div>
                            </div>
                            <div className="space-y-3 border-t border-[#d7e4ff] bg-white p-4">
                              <p className="line-clamp-1 text-xs text-slate-500">
                                {stuffyHeroImageUrl || "No image URL yet"}
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="justify-start rounded-2xl"
                                  onClick={() => {
                                    if (!stuffyHeroImageTarget) return;
                                    setActiveImageTargetId(stuffyHeroImageTarget.id);
                                    setShowMediaLibrary(true);
                                  }}
                                  disabled={!stuffyHeroImageTarget}
                                >
                                  <ImageIcon className="mr-2 h-4 w-4" />
                                  Choose from media library
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="justify-start rounded-2xl"
                                  disabled={!stuffyHeroImageTarget || uploadTargetImageMutation.isPending}
                                  onClick={() => {
                                    if (!stuffyHeroImageTarget) return;
                                    triggerDirectImageUpload(stuffyHeroImageTarget.id);
                                  }}
                                >
                                  {uploadingImageTargetId === stuffyHeroImageTarget?.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Upload className="mr-2 h-4 w-4" />
                                  )}
                                  {uploadingImageTargetId === stuffyHeroImageTarget?.id
                                    ? "Uploading..."
                                    : "Upload to Tigris"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4565d0]">Hero slides</p>
                              <p className="mt-1 text-xs text-slate-600">Edit hero headlines, CTA text, and slide images without touching JSON.</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => updateHeroSlidesDraft([
                                ...heroSlides,
                                {
                                  tag: "Campaign",
                                  headline: "New slide headline",
                                  eyebrow: "Story layer",
                                  body: "Add a short sentence that explains what this slide is doing.",
                                  ctaLabel: "Shop now",
                                  ctaHref: "/products",
                                  image: "",
                                },
                              ])}
                            >
                              <Plus className="mr-2 h-3.5 w-3.5" />
                              Add slide
                            </Button>
                          </div>
                          <div className="mt-4 space-y-3">
                            {heroSlides.map((slide, index) => (
                              <div key={`hero-slide-${index}`} className="rounded-2xl border border-[#d7e4ff] bg-white p-3 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">Slide {index + 1}</p>
                                    <p className="text-xs text-slate-500">This content updates the live builder canvas instantly.</p>
                                  </div>
                                  {heroSlides.length > 1 ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                      onClick={() => updateHeroSlidesDraft(heroSlides.filter((_, slideIndex) => slideIndex !== index))}
                                    >
                                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                                      Remove
                                    </Button>
                                  ) : null}
                                </div>
                                <div className="mt-3 grid gap-3">
                                  <Input
                                    value={slide.tag}
                                    onChange={(event) => updateHeroSlidesDraft(heroSlides.map((item, slideIndex) => slideIndex === index ? { ...item, tag: event.target.value } : item))}
                                    placeholder="Tag"
                                  />
                                  <Input
                                    value={slide.headline}
                                    onChange={(event) => updateHeroSlidesDraft(heroSlides.map((item, slideIndex) => slideIndex === index ? { ...item, headline: event.target.value } : item))}
                                    placeholder="Headline"
                                  />
                                  <Input
                                    value={slide.eyebrow}
                                    onChange={(event) => updateHeroSlidesDraft(heroSlides.map((item, slideIndex) => slideIndex === index ? { ...item, eyebrow: event.target.value } : item))}
                                    placeholder="Eyebrow"
                                  />
                                  <Textarea
                                    value={slide.body}
                                    onChange={(event) => updateHeroSlidesDraft(heroSlides.map((item, slideIndex) => slideIndex === index ? { ...item, body: event.target.value } : item))}
                                    className="min-h-[100px]"
                                    placeholder="Short supporting copy"
                                  />
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <Input
                                      value={slide.ctaLabel}
                                      onChange={(event) => updateHeroSlidesDraft(heroSlides.map((item, slideIndex) => slideIndex === index ? { ...item, ctaLabel: event.target.value } : item))}
                                      placeholder="CTA label"
                                    />
                                    <Input
                                      value={slide.ctaHref}
                                      onChange={(event) => updateHeroSlidesDraft(heroSlides.map((item, slideIndex) => slideIndex === index ? { ...item, ctaHref: event.target.value } : item))}
                                      placeholder="CTA link"
                                    />
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="justify-start rounded-2xl"
                                      onClick={() => {
                                        setActiveImageTargetId(`slide:${index}`);
                                        setShowMediaLibrary(true);
                                      }}
                                    >
                                      <ImageIcon className="mr-2 h-4 w-4" />
                                      {slide.image ? "Change slide image" : "Add slide image"}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="justify-start rounded-2xl"
                                      disabled={uploadTargetImageMutation.isPending}
                                      onClick={() => triggerDirectImageUpload(`slide:${index}`)}
                                    >
                                      {uploadingImageTargetId === `slide:${index}` ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Upload className="mr-2 h-4 w-4" />
                                      )}
                                      {uploadingImageTargetId === `slide:${index}`
                                        ? "Uploading..."
                                        : "Upload to Tigris"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={() => moveSelectedSection(selectedSection.id, "up")}
                      disabled={sectionItems[0]?.id === selectedSection.id}
                    >
                      <ArrowUp className="mr-2 h-4 w-4" />
                      Move up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={() => moveSelectedSection(selectedSection.id, "down")}
                      disabled={sectionItems[sectionItems.length - 1]?.id === selectedSection.id}
                    >
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Move down
                    </Button>
                  </div>

                  {isStuffyLandingHero ? null : (
                  <div className="rounded-2xl border border-[#dbe5ff] bg-[#f8fbff] p-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-[#4565d0]" />
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4565d0]">
                        Section imagery
                      </p>
                    </div>
                    {imageTargets.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {imageTargets.map((target) => (
                          <div key={target.id} className="flex items-center gap-2">
                            <button
                              type="button"
                              className={cn(
                                "flex min-w-0 flex-1 items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors",
                                activeImageTargetId === target.id
                                  ? "border-[#8fa8ff] bg-white"
                                  : "border-transparent bg-white/60 hover:border-[#bfd1ff]",
                              )}
                              onClick={() => {
                                setActiveImageTargetId(target.id);
                                setShowMediaLibrary(true);
                              }}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-950">{target.label}</p>
                                <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                                  {target.url || "No image selected yet"}
                                </p>
                              </div>
                              <span className="ml-3 shrink-0 text-xs font-semibold text-[#3654b1]">
                                {target.url ? "Change" : "Add"}
                              </span>
                            </button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-11 shrink-0 rounded-2xl px-3"
                              disabled={uploadTargetImageMutation.isPending}
                              onClick={() => triggerDirectImageUpload(target.id)}
                            >
                              {uploadingImageTargetId === target.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs leading-6 text-slate-500">
                        This section does not expose a direct image field yet, so use the config JSON below for advanced media changes.
                      </p>
                    )}
                  </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.18em] text-neutral-500">Config JSON</Label>
                    {isStuffyLandingHero ? (
                      <details className="rounded-2xl border border-black/10 bg-[#fffdf9] p-4">
                        <summary className="cursor-pointer text-sm font-medium text-neutral-900">
                          Advanced JSON
                        </summary>
                        <p className="mt-2 text-xs text-neutral-500">
                          Only open this if you want to edit the raw hero config directly.
                        </p>
                        <Textarea
                          value={sectionDraft.configText}
                          onChange={(event) =>
                            setSectionDraft((current) => ({ ...current, configText: event.target.value }))
                          }
                          className="mt-3 min-h-[220px] border-black/10 bg-white font-mono text-xs text-neutral-900"
                        />
                        {parsedDraftConfig === null ? (
                          <p className="mt-2 text-xs text-red-500">
                            Fix the JSON syntax to restore the live section preview.
                          </p>
                        ) : null}
                      </details>
                    ) : (
                      <>
                        <Textarea
                          value={sectionDraft.configText}
                          onChange={(event) =>
                            setSectionDraft((current) => ({ ...current, configText: event.target.value }))
                          }
                          className="min-h-[320px] border-black/10 bg-[#fffdf9] font-mono text-xs text-neutral-900"
                        />
                        <p className="text-xs text-neutral-500">
                          Update copy, images, links, and layout data directly. The builder canvas updates live while you type.
                        </p>
                        {parsedDraftConfig === null ? (
                          <p className="text-xs text-red-500">
                            Fix the JSON syntax to restore the live section preview.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
                <div className="border-t border-black/10 p-4">
                  <Button
                    onClick={handleSaveSection}
                    disabled={!selectedSection || patchSectionMutation.isPending}
                    className="w-full bg-[#c9a84c] text-black hover:bg-[#d8b865]"
                  >
                    {patchSectionMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving
                      </>
                    ) : (
                      "Save Section"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center px-3">
                <button
                  type="button"
                  disabled={!selectedSection}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-black/10 bg-white text-neutral-700 shadow-sm transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => setInspectorOpen(true)}
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <SectionPicker
        open={showSectionPicker}
        onOpenChange={setShowSectionPicker}
        onAdd={handleAddSection}
        existingSectionTypes={
          sectionItems
            .map((section) => resolveSectionTypeDefinition(section)?.type)
            .filter((type): type is SectionType => Boolean(type))
        }
      />

      <PageMetadataForm
        page={page}
        open={showMetadataForm}
        onOpenChange={setShowMetadataForm}
      />
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={handleDirectImageUploadChange}
      />
      <MediaLibrary
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        onSelect={applyImageSelection}
        category="all"
      />
    </div>
  );
}
