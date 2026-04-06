import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Eye,
  Loader2,
  Monitor,
  Plus,
  Settings,
  Smartphone,
  Tablet,
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

function getPreviewWidth(viewport: PreviewViewport) {
  if (viewport === "tablet") return "max-w-[768px]";
  if (viewport === "mobile") return "max-w-[390px]";
  return "max-w-full";
}

function PagePreview({
  page,
  sections,
  selectedSectionId,
  onSelectSection,
  viewport,
}: {
  page: CanvasPage;
  sections: CanvasSection[];
  selectedSectionId: number | null;
  onSelectSection: (id: number) => void;
  viewport: PreviewViewport;
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
  const faqSections = visibleSections.filter((section) => section.sectionType === "faq");
  const nonFaqSections = visibleSections.filter((section) => section.sectionType !== "faq");
  const hasContact = visibleSections.some((section) => section.sectionType === "contact");
  const hasBackToTop = visibleSections.some((section) => section.sectionType === "back-to-top");
  const hasFaq = visibleSections.length > 0 && faqSections.length > 0;

  const heroImages = heroSections.length > 0
    ? ((heroSections[0].config?.slides as Array<{ image?: string }> | undefined)
        ?.map((slide) => slide.image)
        .filter((image): image is string => Boolean(image)) ?? HERO_IMAGES_FALLBACK)
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

  return (
    <div className="min-h-full bg-[#0d0d10]">
      <main>
        {nonFaqSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={cn(
              "group relative block w-full cursor-pointer text-left transition-all",
              selectedSectionId === section.id &&
                "ring-2 ring-inset ring-[#c9a84c] shadow-[0_0_0_1px_rgba(201,168,76,0.35)]",
            )}
            onClick={() => onSelectSection(section.id)}
          >
            <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-[#c9a84c]/35 bg-[#100f0d]/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d7b66a] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {getSectionLabel(section)}
            </div>
            {renderSection(section, previewCtx, `page-preview-${page.id}`)}
          </button>
        ))}

        {!hasContact ? (
          <div className="border-y border-dashed border-white/10 bg-black/10 px-6 py-10 text-center text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Default contact section renders on the storefront when no custom contact block is present.
          </div>
        ) : null}

        {!hasBackToTop ? (
          <div className="border-b border-dashed border-white/10 bg-black/10 px-6 py-8 text-center text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Back to top section renders automatically on the storefront.
          </div>
        ) : null}

        {faqSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={cn(
              "group relative block w-full cursor-pointer text-left transition-all",
              selectedSectionId === section.id &&
                "ring-2 ring-inset ring-[#c9a84c] shadow-[0_0_0_1px_rgba(201,168,76,0.35)]",
            )}
            onClick={() => onSelectSection(section.id)}
          >
            <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-[#c9a84c]/35 bg-[#100f0d]/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d7b66a] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {getSectionLabel(section)}
            </div>
            {renderSection(section, previewCtx, `page-preview-faq-${page.id}`)}
          </button>
        ))}

        {!hasFaq && visibleSections.length > 0 ? (
          <div className="border-b border-dashed border-white/10 bg-black/10 px-6 py-10 text-center text-xs uppercase tracking-[0.22em] text-muted-foreground">
            FAQ renders automatically on the storefront when no custom FAQ block is present.
          </div>
        ) : null}
      </main>
    </div>
  );
}

export function PageEditor({ pageId, onBack }: PageEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const sectionListRef = useRef<HTMLDivElement | null>(null);

  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const [sectionItems, setSectionItems] = useState<CanvasSection[]>([]);
  const [sectionDraft, setSectionDraft] = useState<SectionEditorDraft>(buildSectionDraft(null));
  const [titleDraft, setTitleDraft] = useState("");

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

  useEffect(() => {
    setSectionDraft(buildSectionDraft(selectedSection));
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

  const handleRename = useCallback(
    (id: number, label: string) => {
      patchSectionMutation.mutate({ id, data: { label } });
    },
    [patchSectionMutation],
  );

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
        <div className="w-80 space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
        <div className="flex-1">
          <Skeleton className="h-full w-full rounded-2xl" />
        </div>
        <div className="w-80">
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
    <div className="flex h-full overflow-hidden bg-[#0b0b0d] text-white">
      <div className="flex w-80 shrink-0 flex-col border-r border-white/10 bg-[#101012]">
        <div className="space-y-4 border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white/80 hover:bg-white/5 hover:text-white" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">{page.title}</h3>
              <p className="truncate font-mono text-[10px] text-white/45">{page.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border-white/10 bg-white/[0.03] text-[10px] font-semibold uppercase tracking-[0.18em]",
                page.status === "published" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
              )}
            >
              {page.status === "published" ? "Published" : "Draft"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-white/75 hover:bg-white/5 hover:text-white"
              onClick={() => publishMutation.mutate()}
            >
              {page.status === "published" ? "Unpublish" : "Publish"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-xs text-white/75 hover:bg-white/5 hover:text-white"
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
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center">
              <p className="text-sm text-white/75">No sections yet</p>
              <p className="mt-1 text-xs text-white/45">Start the page with a Rare Atelier section block.</p>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setShowSectionPicker(true)}
            className="flex w-full items-center justify-center rounded-2xl border border-dashed border-[#c9a84c]/30 bg-[#171513] px-4 py-4 text-sm font-semibold text-[#d2b15e] transition-colors hover:border-[#c9a84c]/65 hover:bg-[#1d1914]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add a Section
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/10 bg-[#0f0f12] px-5 py-4">
          <div className="min-w-0 flex-1">
            <Input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft.trim() !== page.title) {
                  pageUpdateMutation.mutate({ title: titleDraft.trim() });
                }
              }}
              className="h-10 border-white/10 bg-white/[0.03] text-base font-semibold text-white"
            />
            <p className="mt-1 text-xs text-white/45">
              Live page preview with section selection and device resizing.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
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
                      ? "bg-[#c9a84c] text-black"
                      : "text-white/65 hover:bg-white/5 hover:text-white",
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
            className="h-9 gap-2 border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/5 hover:text-white"
            onClick={() => window.open(page.slug, "_blank", "noopener,noreferrer")}
          >
            <Eye className="h-4 w-4" />
            Open Page
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-white/80 hover:bg-white/5 hover:text-white"
            onClick={() => setShowMetadataForm(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.12),transparent_28%),linear-gradient(180deg,#0e0e11_0%,#060608_100%)]">
            <div className="border-b border-white/10 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Full Page Live Preview
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6">
              <div className={cn("mx-auto transition-all duration-300", getPreviewWidth(previewViewport))}>
                <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                  <PagePreview
                    page={page}
                    sections={sectionItems}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={setSelectedSectionId}
                    viewport={previewViewport}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#111114]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">
                {selectedSection ? getSectionLabel(selectedSection) : "Section Settings"}
              </h2>
              <p className="mt-1 text-xs text-white/45">
                {selectedSection
                  ? `Edit the selected ${resolveSectionTypeDefinition(selectedSection)?.label ?? selectedSection.sectionType} block.`
                  : "Select a section from the list or preview to customize it."}
              </p>
            </div>

            {selectedSection ? (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.18em] text-white/55">Section Label</Label>
                    <Input
                      value={sectionDraft.label}
                      onChange={(event) =>
                        setSectionDraft((current) => ({ ...current, label: event.target.value }))
                      }
                      className="border-white/10 bg-white/[0.03] text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">Visible on page</p>
                      <p className="text-xs text-white/45">Hidden sections stay in the list but disappear from preview.</p>
                    </div>
                    <Switch
                      checked={sectionDraft.isVisible}
                      onCheckedChange={(checked) =>
                        setSectionDraft((current) => ({ ...current, isVisible: checked }))
                      }
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Section Type</p>
                    <p className="mt-2 text-sm text-white">
                      {resolveSectionTypeDefinition(selectedSection)?.label ?? selectedSection.sectionType}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      Click the live preview to swap between page sections while keeping this panel open.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.18em] text-white/55">Config JSON</Label>
                    <Textarea
                      value={sectionDraft.configText}
                      onChange={(event) =>
                        setSectionDraft((current) => ({ ...current, configText: event.target.value }))
                      }
                      className="min-h-[320px] border-white/10 bg-[#0d0d10] font-mono text-xs text-white"
                    />
                    <p className="text-xs text-white/45">
                      Update copy, images, links, and layout data directly. The preview refreshes after save.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div>
                  <p className="text-sm font-medium text-white">Select a section to edit</p>
                  <p className="mt-2 text-xs text-white/45">
                    You can pick from the left list or click directly on the live page preview.
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-white/10 p-4">
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
    </div>
  );
}
