import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Palette,
  Plus,
  RefreshCw,
  Sparkles,
  Monitor,
  Tablet,
  Smartphone,
  ArrowRightLeft,
  Trash2,
  Lock,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { fetchProducts, type ProductApi } from "@/lib/api";
import {
  fetchAdminImages,
  uploadAdminImage,
  type AdminImageAsset,
} from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UploadProgress } from "@/components/ui/upload-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MAISON_NOCTURNE_DEFAULT_HERO_SLIDES, type CanvasHeroSlide } from "@shared/canvasDefaults";
import {
  STOREFRONT_FONT_FAMILIES,
  STOREFRONT_FONT_OPTIONS,
  type StorefrontFontPreset,
} from "@/lib/storefrontFonts";

type CanvasTemplate = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  tier: string;
  priceNpr: number;
  isPurchased: boolean;
  isActive: boolean;
};

type CanvasSection = {
  id: number;
  templateId: number;
  sectionType: string;
  label: string | null;
  orderIndex: number;
  isVisible: boolean;
  config: Record<string, unknown> | null;
};

type CanvasSettings = {
  id?: number;
  activeTemplateId?: number | null;
  activeTemplate?: CanvasTemplate | null;
  fontPreset?: StorefrontFontPreset | null;
};

const TEMPLATE_PREVIEW_FALLBACKS: Record<string, string> = {
  "rare-dark-luxury": "/images/landingpage3.webp",
  "clean-minimal": "/images/landingpage4.webp",
  "editorial-grid": "/images/landingpage3.webp",
};
const HIDDEN_CANVAS_TEMPLATE_SLUGS = new Set(["nikeshdesign"]);

const CANVAS_TAB_ITEMS = [
  {
    value: "templates",
    label: "Templates",
    hint: "Pick a homepage",
    icon: Sparkles,
    iconClassName: "from-fuchsia-500 via-pink-500 to-amber-400 text-white",
  },
  {
    value: "sections",
    label: "Sections",
    hint: "Edit each block",
    icon: GripVertical,
    iconClassName: "from-sky-500 via-cyan-500 to-blue-500 text-white",
  },
  {
    value: "theme",
    label: "Theme",
    hint: "Tune the feel",
    icon: Palette,
    iconClassName: "from-emerald-500 via-teal-500 to-lime-400 text-white",
  },
] as const;

const SECTION_TYPE_GROUPS = [
  { label: "Hero", types: ["hero"] },
  { label: "Product", types: ["featured", "arrivals", "fresh-release"] },
  { label: "Editorial", types: ["ticker", "quote", "campaign"] },
  { label: "Utility", types: ["services", "back-to-top", "faq"] },
] as const;

const SECTION_PREVIEW_STYLES: Record<string, string> = {
  hero: "from-zinc-950 via-zinc-900 to-amber-900",
  ticker: "from-amber-400 via-yellow-300 to-amber-500",
  quote: "from-stone-900 via-neutral-800 to-stone-700",
  featured: "from-slate-950 via-slate-900 to-zinc-700",
  campaign: "from-purple-950 via-zinc-900 to-amber-900",
  arrivals: "from-slate-100 via-white to-slate-300 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700",
  services: "from-emerald-100 via-white to-emerald-200 dark:from-emerald-950 dark:via-neutral-900 dark:to-emerald-900/50",
  "back-to-top": "from-zinc-800 via-zinc-700 to-zinc-600 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-700",
  faq: "from-rose-100 via-white to-amber-100 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-700",
  "fresh-release": "from-neutral-950 via-neutral-900 to-sky-900",
};

const CANVAS_ELEVATED_CARD_CLASS =
  "rounded-3xl border border-black/10 bg-gradient-to-b from-white/95 via-white to-slate-50/80 shadow-[0_14px_32px_rgba(15,23,42,0.12)] dark:border-white/[0.10] dark:bg-gradient-to-b dark:from-neutral-950/95 dark:via-neutral-950 dark:to-neutral-900/70 dark:shadow-[0_20px_45px_rgba(0,0,0,0.55)]";

const CANVAS_ELEVATED_PANEL_CLASS =
  "rounded-2xl border border-black/10 bg-gradient-to-b from-white/90 to-slate-50/70 shadow-[0_8px_20px_rgba(15,23,42,0.08)] dark:border-white/[0.10] dark:bg-gradient-to-b dark:from-white/[0.05] dark:to-white/[0.02] dark:shadow-[0_12px_28px_rgba(0,0,0,0.4)]";

const MAX_CANVAS_IMAGE_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_CANVAS_IMAGE_UPLOAD_LABEL = "30MB";

type SectionDraft = {
  label: string;
  variant: string;
  image: string;
  title: string;
  text: string;
  hint: string;
  attribution: string;
  eyebrow: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  layoutPreset: string;
  items: string;
  heroSlides: string;
  campaignImages: string;
  serviceCards: string;
  productIds: string;
  columns: string;
  rawConfig: string;
};

type MediaPickerTarget =
  | { type: "hero"; index: number }
  | { type: "campaign"; index: number }
  | { type: "section" };

type SectionPreset = {
  id: string;
  label: string;
  apply: Partial<SectionDraft>;
};

type SectionMutationArgs = {
  sectionId: number;
  payload: Partial<CanvasSection>;
  feedback?: "save" | "silent";
};

type HeroSlideDraft = {
  tag: string;
  headline: string;
  eyebrow: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  duration: string;
};

const serializeHeroSlides = (slides: HeroSlideDraft[]) =>
  slides
    .map((slide) =>
      [
        slide.tag,
        slide.headline,
        slide.eyebrow,
        slide.body,
        slide.ctaLabel,
        slide.ctaHref,
        slide.image,
        slide.duration,
      ].join(" | "),
    )
    .join("\n");

const formatHeroSlideDraft = (slide?: Partial<CanvasHeroSlide>): HeroSlideDraft => ({
  tag: typeof slide?.tag === "string" ? slide.tag : "",
  headline: typeof slide?.headline === "string" ? slide.headline : "",
  eyebrow: typeof slide?.eyebrow === "string" ? slide.eyebrow : "",
  body: typeof slide?.body === "string" ? slide.body : "",
  ctaLabel: typeof slide?.ctaLabel === "string" ? slide.ctaLabel : "",
  ctaHref: typeof slide?.ctaHref === "string" ? slide.ctaHref : "",
  image: typeof slide?.image === "string" ? slide.image : "",
  duration:
    slide?.duration != null && Number.isFinite(Number(slide.duration))
      ? String(slide.duration)
      : "",
});

const deserializeHeroSlides = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [tag = "", headline = "", eyebrow = "", body = "", ctaLabel = "", ctaHref = "", image = "", duration = ""] = line
        .split("|")
        .map((part) => part.trim());
      return { tag, headline, eyebrow, body, ctaLabel, ctaHref, image, duration };
    });

const DEFAULT_MAISON_HERO_SLIDE_DRAFTS = MAISON_NOCTURNE_DEFAULT_HERO_SLIDES.map((slide) =>
  formatHeroSlideDraft(slide),
);
const DEFAULT_MAISON_HERO_SLIDES_TEXT = serializeHeroSlides(DEFAULT_MAISON_HERO_SLIDE_DRAFTS);
export default function Canvas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [pendingSelectionSectionId, setPendingSelectionSectionId] = useState<number | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);
  const [previewFontPreset, setPreviewFontPreset] = useState<StorefrontFontPreset>("inter");
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [draggedHeroSlideIndex, setDraggedHeroSlideIndex] = useState<number | null>(null);
  const [draggedCampaignImageIndex, setDraggedCampaignImageIndex] = useState<number | null>(null);
  const [openSectionGroups, setOpenSectionGroups] = useState<Record<string, boolean>>({
    Hero: true,
    Product: true,
    Editorial: true,
    Utility: true,
  });
  const [mediaPickerTarget, setMediaPickerTarget] = useState<MediaPickerTarget | null>(null);
  const [mediaProvider, setMediaProvider] = useState<"local" | "cloudinary">("local");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [savingSectionId, setSavingSectionId] = useState<number | null>(null);
  const [bootedPreviewViewports, setBootedPreviewViewports] = useState({
    desktop: false,
    tablet: false,
    mobile: false,
  });
  const [previewLoaderVisible, setPreviewLoaderVisible] = useState(true);
  const [previewBootProgress, setPreviewBootProgress] = useState(8);
  const [warmedPreviewTemplateIds, setWarmedPreviewTemplateIds] = useState<number[]>([]);
  const [sectionDraft, setSectionDraft] = useState<SectionDraft>({
    label: "",
    variant: "",
    image: "",
    title: "",
    text: "",
    hint: "",
    attribution: "",
    eyebrow: "",
    ctaLabel: "",
    ctaHref: "",
    secondaryCtaLabel: "",
    secondaryCtaHref: "",
    layoutPreset: "",
    items: "",
    heroSlides: "",
    campaignImages: "",
    serviceCards: "",
    productIds: "",
    columns: "",
    rawConfig: "{}",
  });
  const [previewKey, setPreviewKey] = useState(0);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<CanvasTemplate[]>({
    queryKey: ["admin", "canvas", "templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/canvas/templates");
      return res.json();
    },
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<CanvasSettings>({
    queryKey: ["admin", "canvas", "settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/canvas/settings");
      return res.json();
    },
  });

  const effectiveTemplateId = selectedTemplateId ?? settings?.activeTemplate?.id ?? settings?.activeTemplateId ?? null;

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<CanvasSection[]>({
    queryKey: ["admin", "canvas", "sections", effectiveTemplateId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/canvas/templates/${effectiveTemplateId}/sections`);
      return res.json();
    },
    enabled: !!effectiveTemplateId,
  });
  const { data: productOptions = [] } = useQuery<ProductApi[]>({
    queryKey: ["admin", "canvas", "product-options"],
    queryFn: () => fetchProducts({ limit: 200 }).then(r => r.products),
    staleTime: 60 * 1000,
  });
  const { data: mediaOptions = [], isLoading: mediaLoading } = useQuery<AdminImageAsset[]>({
    queryKey: ["admin", "canvas", "media-library", mediaProvider],
    queryFn: () =>
      fetchAdminImages({
        provider: mediaProvider,
        limit: 120,
      }),
    enabled: !!mediaPickerTarget,
    staleTime: 60 * 1000,
  });

  const activateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const res = await apiRequest("PATCH", `/api/admin/canvas/templates/${templateId}/activate`, {});
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "settings"] });
      await queryClient.invalidateQueries({ queryKey: ["page-config"] });
      toast({
        title: "Homepage updated successfully.",
        variant: "success",
      });
      setPreviewKey((prev) => prev + 1);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to publish homepage",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async (fontPreset: StorefrontFontPreset) => {
      const res = await apiRequest("PATCH", "/api/admin/canvas/settings", {
        fontPreset,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "settings"] });
      await queryClient.invalidateQueries({ queryKey: ["page-config"] });
      toast({
        title: "Storefront font updated",
        variant: "success",
      });
      setPreviewKey((prev) => prev + 1);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update font theme",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sectionMutation = useMutation({
    mutationFn: async ({ sectionId, payload }: SectionMutationArgs) => {
      const res = await apiRequest("PATCH", `/api/admin/canvas/sections/${sectionId}`, payload);
      return res.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "sections", effectiveTemplateId] });
      await queryClient.invalidateQueries({ queryKey: ["page-config"] });
      if (variables.feedback === "save") {
        toast({
          title: "Section saved successfully",
          description: "Your Canvas selection has been updated.",
          variant: "success",
        });
        setPreviewKey((prev) => prev + 1);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update section",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_data, _error, variables) => {
      if (variables.feedback === "save") {
        setSavingSectionId((current) => (current === variables.sectionId ? null : current));
      }
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: async (sectionType: string) => {
      const res = await apiRequest("POST", `/api/admin/canvas/templates/${effectiveTemplateId}/sections`, {
        sectionType,
        label: sectionType.replace(/-/g, " "),
        orderIndex: sections.length + 1,
        config: {},
      });
      return res.json();
    },
    onSuccess: async (newSection: CanvasSection) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "sections", effectiveTemplateId] });
      if (newSection?.id) {
        setPendingSelectionSectionId(newSection.id);
        setSelectedSectionId(newSection.id);
      }
      setActiveTab("sections");
      toast({
        title: "Section added",
        variant: "success",
      });
      setPreviewKey((prev) => prev + 1);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add section",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/canvas/sections/${sectionId}`);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "sections", effectiveTemplateId] });
      await queryClient.invalidateQueries({ queryKey: ["page-config"] });
      toast({
        title: "Section removed",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove section",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateSectionMutation = useMutation({
    mutationFn: async (sectionId: number) => {
      const res = await apiRequest("POST", `/api/admin/canvas/sections/${sectionId}/duplicate`);
      return res.json();
    },
    onSuccess: async (duplicate: CanvasSection) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "sections", effectiveTemplateId] });
      await queryClient.invalidateQueries({ queryKey: ["page-config"] });
      if (duplicate?.id) {
        setPendingSelectionSectionId(duplicate.id);
        setSelectedSectionId(duplicate.id);
      }
      setActiveTab("sections");
      toast({
        title: "Section duplicated",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to duplicate section",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveSectionTemplateMutation = useMutation({
    mutationFn: async ({ sectionId, templateId }: { sectionId: number; templateId: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/canvas/sections/${sectionId}/move-template`, {
        templateId,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "sections"] });
      await queryClient.invalidateQueries({ queryKey: ["page-config"] });
      toast({
        title: "Section moved",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to move section",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_CANVAS_IMAGE_UPLOAD_BYTES) {
        throw new Error(`File exceeds ${MAX_CANVAS_IMAGE_UPLOAD_LABEL} limit`);
      }
      return uploadAdminImage({
        file,
        category: "landing_page",
        provider: mediaProvider,
        onProgress: (value) => {
          setShowUploadProgress(true);
          setUploadProgress(value);
        },
      });
    },
    onSuccess: async (asset) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "media-library"] });
      if (!asset.url) {
        toast({
          title: "Upload finished without URL",
          description: "The asset was uploaded but could not be inserted into the section.",
          variant: "destructive",
        });
        setShowUploadProgress(false);
        setUploadProgress(0);
        return;
      }
      applyPickedImage(asset.url);
      setUploadProgress(100);
      setTimeout(() => setShowUploadProgress(false), 700);
      toast({
        title: "Image uploaded",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      setShowUploadProgress(false);
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCanvasImageUploadSelection = (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_CANVAS_IMAGE_UPLOAD_BYTES) {
      toast({
        title: "Large image skipped",
        description: `Files over ${MAX_CANVAS_IMAGE_UPLOAD_LABEL} are not allowed. Reduce the image size or upload a smaller file.`,
        variant: "warning",
        duration: 2000,
      });
      return;
    }
    uploadMediaMutation.mutate(file);
  };

  const reorderSectionsMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: number; targetId: number }) => {
      const current = sortedSections.slice();
      const sourceIndex = current.findIndex((section) => section.id === sourceId);
      const targetIndex = current.findIndex((section) => section.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

      const next = current.slice();
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);

      await apiRequest("PATCH", "/api/admin/canvas/sections/reorder", {
        orderedIds: next.map((section) => section.id),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "canvas", "sections", effectiveTemplateId] });
      await queryClient.invalidateQueries({ queryKey: ["page-config"] });
      toast({
        title: "Section order updated",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reorder sections",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const visibleTemplates = useMemo(
    () => templates.filter((template) => !HIDDEN_CANVAS_TEMPLATE_SLUGS.has(template.slug)),
    [templates],
  );

  useEffect(() => {
    if (selectedTemplateId) return;
    if (!visibleTemplates.length) return;
    const activeTemplate = templates.find(
      (template) =>
        template.id === (settings?.activeTemplate?.id ?? settings?.activeTemplateId ?? null),
    );
    if (activeTemplate && HIDDEN_CANVAS_TEMPLATE_SLUGS.has(activeTemplate.slug)) {
      setSelectedTemplateId(visibleTemplates[0].id);
    }
  }, [selectedTemplateId, settings?.activeTemplate?.id, settings?.activeTemplateId, templates, visibleTemplates]);

  const premiumTemplates = useMemo(
    () => visibleTemplates.filter((template) => template.tier === "premium"),
    [visibleTemplates],
  );
  const freeTemplates = useMemo(
    () => visibleTemplates.filter((template) => template.tier !== "premium"),
    [visibleTemplates],
  );

  const selectedTemplate = useMemo(
    () => visibleTemplates.find((template) => template.id === effectiveTemplateId) ?? null,
    [visibleTemplates, effectiveTemplateId],
  );
  const sortedSections = useMemo(
    () => sections.slice().sort((a, b) => a.orderIndex - b.orderIndex),
    [sections],
  );
  const selectedSection = useMemo(
    () => sortedSections.find((section) => section.id === selectedSectionId) ?? sortedSections[0] ?? null,
    [selectedSectionId, sortedSections],
  );

  const getDefaultDraftForSection = (section: CanvasSection | null): SectionDraft => {
    const sectionType = section?.sectionType ?? "";
    const label = section?.label ?? sectionType;

    if (sectionType === "hero") {
      return {
        label,
        variant: section?.config && typeof section.config === "object" && typeof section.config["variant"] === "string" ? String(section.config["variant"]) : "",
        image: "",
        title: "",
        text: "",
        hint: "",
        attribution: "",
        eyebrow: "",
        ctaLabel: "",
        ctaHref: "",
        secondaryCtaLabel: "Discover Atelier",
        secondaryCtaHref: "/atelier",
        layoutPreset: "",
        items: "",
        heroSlides: DEFAULT_MAISON_HERO_SLIDES_TEXT,
        campaignImages: "",
        serviceCards: "",
        productIds: "",
        columns: "",
        rawConfig: JSON.stringify({}, null, 2),
      };
    }

    if (sectionType === "campaign") {
      return {
        label,
        variant: section?.config && typeof section.config === "object" && typeof section.config["variant"] === "string" ? String(section.config["variant"]) : "",
        image: "",
        title: "Frames from the atelier.",
        text: "A magazine-style grid of campaign stills, silhouettes, and styling cues built from the current Rare visual language.",
        hint: "",
        attribution: "",
        eyebrow: "Editorial / Lookbook",
        ctaLabel: "Explore Collection",
        ctaHref: "/new-collection",
        secondaryCtaLabel: "",
        secondaryCtaHref: "",
        layoutPreset: "editorial",
        items: "",
        heroSlides: "",
        campaignImages: "",
        serviceCards: "",
        productIds: "",
        columns: "",
        rawConfig: JSON.stringify({}, null, 2),
      };
    }

    if (sectionType === "featured") {
      return {
        label,
        variant: "",
        image: "",
        title: "Featured Collection",
        text: "",
        hint: "Drag to explore →",
        attribution: "",
        eyebrow: "",
        ctaLabel: "",
        ctaHref: "",
        secondaryCtaLabel: "",
        secondaryCtaHref: "",
        layoutPreset: "",
        items: "",
        heroSlides: "",
        campaignImages: "",
        serviceCards: "",
        productIds: "",
        columns: "",
        rawConfig: JSON.stringify({}, null, 2),
      };
    }

    if (sectionType === "services") {
      return {
        label,
        variant: "",
        image: "",
        title: "Our Services",
        text: "Door-to-Door Delivery Across Nepal 🇳🇵",
        hint: "",
        attribution: "",
        eyebrow: "",
        ctaLabel: "",
        ctaHref: "",
        secondaryCtaLabel: "",
        secondaryCtaHref: "",
        layoutPreset: "",
        items: "",
        heroSlides: "",
        campaignImages: "",
        serviceCards:
          "Fast Delivery | Nationwide door-to-door shipping. | Shop Now | /shop\nMade In Nepal | Designed and produced with Himalayan craft value. | See Products | /new-collection\nEasy Exchange | Reach out and we will help you swap with confidence. | Contact Us | atelier-contact",
        productIds: "",
        columns: "",
        rawConfig: JSON.stringify({}, null, 2),
      };
    }

    if (sectionType === "faq") {
      return {
        label,
        variant: "",
        image: "",
        title: "Frequently Asked Questions",
        text: "Everything you need to know before placing your order.",
        hint: "",
        attribution: "",
        eyebrow: "",
        ctaLabel: "",
        ctaHref: "",
        secondaryCtaLabel: "",
        secondaryCtaHref: "",
        layoutPreset: "",
        items:
          "How do I place an order? | Browse products, add them to your cart, and complete checkout with shipping and payment details.\nCan I modify or cancel my order? | Yes, before shipping. Once an order is processed and dispatched, edits and cancellations are no longer available.\nWhat payment methods do you accept? | We currently support online payment options shown at checkout, plus verified payment channels configured by Rare Atelier.",
        heroSlides: "",
        campaignImages: "",
        serviceCards: "",
        productIds: "",
        columns: "",
        rawConfig: JSON.stringify({}, null, 2),
      };
    }

    if (sectionType === "back-to-top") {
      return {
        label,
        variant: "",
        image: "/images/home-campaign-editorial.webp",
        title: "Back to Top",
        text: "Image section shown above contact with a quick return action.",
        hint: "",
        attribution: "",
        eyebrow: "",
        ctaLabel: "",
        ctaHref: "",
        secondaryCtaLabel: "",
        secondaryCtaHref: "",
        layoutPreset: "",
        items: "",
        heroSlides: "",
        campaignImages: "",
        serviceCards: "",
        productIds: "",
        columns: "",
        rawConfig: JSON.stringify({}, null, 2),
      };
    }

    return {
      label,
      variant: "",
      image: "",
      title: "",
      text: "",
      hint: "",
      attribution: "",
      eyebrow: "",
      ctaLabel: "",
      ctaHref: "",
      secondaryCtaLabel: "",
      secondaryCtaHref: "",
      layoutPreset: "",
      items: "",
      heroSlides: "",
      campaignImages: "",
      serviceCards: "",
      productIds: "",
      columns: "",
      rawConfig: JSON.stringify({}, null, 2),
    };
  };

  const getSectionPresets = (section: CanvasSection | null): SectionPreset[] => {
    switch (section?.sectionType) {
      case "hero":
        return [
          {
            id: "luxury-story",
            label: "Luxury Story",
            apply: {
              secondaryCtaLabel: "Discover Atelier",
              secondaryCtaHref: "/atelier",
              heroSlides: DEFAULT_MAISON_HERO_SLIDES_TEXT,
            },
          },
          {
            id: "product-focus",
            label: "Product Focus",
            apply: {
              secondaryCtaLabel: "View Collection",
              secondaryCtaHref: "/new-collection",
              heroSlides:
                "Product Focus / 01 | Statement Outerwear | Engineered for the season | Sharp construction, premium feel, and a clear monochrome silhouette. | Shop Jackets | /products | https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1800&q=80 | 6500\nProduct Focus / 02 | Refined Layers | Tailored for the new collection | A quiet editorial setup with stronger contrasts and purposeful detail. | View Collection | /new-collection | https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=80 | 6200\nProduct Focus / 03 | Atelier Notes | Crafted with intent | Studio-led storytelling for the atelier page and campaign rhythm. | Atelier | /atelier | https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=80 | 6400",
            },
          },
        ];
      case "campaign":
        return [
          {
            id: "editorial-lookbook",
            label: "Editorial",
            apply: {
              eyebrow: "Editorial / Lookbook",
              title: "Frames from the atelier.",
              text: "A magazine-style grid of campaign stills, silhouettes, and styling cues built from the current Rare visual language.",
              ctaLabel: "Explore Collection",
              ctaHref: "/new-collection",
              layoutPreset: "editorial",
            },
          },
          {
            id: "balanced-grid",
            label: "Balanced Grid",
            apply: {
              eyebrow: "Campaign Grid",
              title: "The season in motion.",
              text: "A cleaner and more balanced rhythm for editorial images across the homepage.",
              ctaLabel: "See The Drop",
              ctaHref: "/products",
              layoutPreset: "balanced",
            },
          },
        ];
      case "featured":
        return [
          {
            id: "editors-rail",
            label: "Editor's Rail",
            apply: {
              title: "Featured Collection",
              hint: "Drag to explore →",
            },
          },
          {
            id: "new-drop",
            label: "New Drop",
            apply: {
              title: "New Drop Highlights",
              hint: "Selected pieces from the latest release",
            },
          },
        ];
      case "services":
        return [
          {
            id: "trust-pillars",
            label: "Trust Pillars",
            apply: {
              title: "Our Services",
              text: "Door-to-Door Delivery Across Nepal 🇳🇵",
              serviceCards:
                "Fast Delivery | Nationwide door-to-door shipping. | Shop Now | /shop\nMade In Nepal | Designed and produced with Himalayan craft value. | See Products | /new-collection\nEasy Exchange | Reach out and we will help you swap with confidence. | Contact Us | atelier-contact",
            },
          },
          {
            id: "concierge",
            label: "Concierge",
            apply: {
              title: "Client Care",
              text: "Premium support before and after every order.",
              serviceCards:
                "Personal Styling | Get help choosing sizing and combinations. | Book Help | /atelier\nFast Dispatch | Priority handling for ready-to-ship pieces. | Shop Ready Stock | /shop\nAftercare Support | Exchanges and care guidance with quick response. | Contact Support | atelier-contact",
            },
          },
        ];
      case "faq":
        return [
          {
            id: "store-policy",
            label: "Store Policy",
            apply: {
              title: "Shipping, Payment & Returns",
              text: "Quick answers to the most common checkout and delivery questions.",
              items:
                "How long does delivery take? | Orders usually dispatch within 24-48 hours, with delivery timelines based on destination.\nCan I return items? | Eligible returns follow our return policy window. Contact support with your order number.\nDo you support online payments? | Yes. Available payment options appear on checkout based on current gateway setup.",
            },
          },
          {
            id: "ordering-help",
            label: "Ordering Help",
            apply: {
              title: "Need Help Before Ordering?",
              text: "Answers for sizing, payment, shipping, and order updates.",
              items:
                "How do I choose size? | Use our size guide on each product page and contact support if you need fitting help.\nCan I change my order after payment? | You can request changes before dispatch. Once shipped, modifications are not possible.\nWhere can I track my order? | Tracking updates are shared after confirmation and dispatch.",
            },
          },
        ];
      case "back-to-top":
        return [
          {
            id: "editorial-scroll",
            label: "Editorial Scroll",
            apply: {
              title: "Back to Top",
              text: "Image section above contact with smooth return-to-top action.",
              image: "/images/home-campaign-editorial.webp",
            },
          },
          {
            id: "minimal-scroll",
            label: "Minimal Scroll",
            apply: {
              title: "Return",
              text: "Keep the footer transition clean and intentional.",
              image: "/images/landingpage3.webp",
            },
          },
        ];
      default:
        return [];
    }
  };

  useEffect(() => {
    if (!sortedSections.length) {
      setSelectedSectionId(null);
      setPendingSelectionSectionId(null);
      return;
    }
    if (pendingSelectionSectionId) {
      const pendingExists = sortedSections.some((section) => section.id === pendingSelectionSectionId);
      if (pendingExists) {
        setSelectedSectionId(pendingSelectionSectionId);
        setPendingSelectionSectionId(null);
      }
      return;
    }
    if (!selectedSectionId || !sortedSections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(sortedSections[0].id);
    }
  }, [pendingSelectionSectionId, selectedSectionId, sortedSections]);

  useEffect(() => {
    if (!settings?.fontPreset) return;
    setPreviewFontPreset(settings.fontPreset);
  }, [settings?.fontPreset]);

  useEffect(() => {
    if (!previewLoaderVisible) return;
    setPreviewBootProgress(8);
    const timer = window.setInterval(() => {
      setPreviewBootProgress((current) => {
        if (current >= 72) return current;
        return Math.min(72, current + Math.max(2, (76 - current) * 0.12));
      });
    }, 120);

    return () => window.clearInterval(timer);
  }, [previewLoaderVisible]);

  useEffect(() => {
    if (!bootedPreviewViewports[previewViewport]) {
      setPreviewLoaderVisible(true);
    } else {
      setPreviewLoaderVisible(false);
    }
  }, [bootedPreviewViewports, previewViewport]);

  useEffect(() => {
    if (!selectedSection) {
      setSectionDraft(getDefaultDraftForSection(null));
      return;
    }

    const config = (selectedSection?.config ?? {}) as Record<string, unknown>;
    const items = Array.isArray(config.items)
      ? config.items
          .map((item) => {
            if (selectedSection?.sectionType === "faq") {
              if (!item || typeof item !== "object") return "";
              const entry = item as Record<string, unknown>;
              const title = typeof entry.title === "string" ? entry.title : "";
              const content = typeof entry.content === "string" ? entry.content : "";
              return [title, content].join(" | ").trim();
            }
            return typeof item === "string" ? item : "";
          })
          .filter(Boolean)
          .join("\n")
      : "";
    const heroSlides = Array.isArray(config.slides)
      ? config.slides
          .map((slide) => {
            if (!slide || typeof slide !== "object") return "";
            const entry = slide as Record<string, unknown>;
            return [
              typeof entry.tag === "string" ? entry.tag : "",
              typeof entry.headline === "string" ? entry.headline : "",
              typeof entry.eyebrow === "string" ? entry.eyebrow : "",
              typeof entry.body === "string" ? entry.body : "",
              typeof entry.ctaLabel === "string" ? entry.ctaLabel : "",
              typeof entry.ctaHref === "string" ? entry.ctaHref : "",
              typeof entry.image === "string" ? entry.image : "",
              entry.duration != null && Number.isFinite(Number(entry.duration))
                ? String(entry.duration)
                : "",
            ].join(" | ");
          })
          .filter(Boolean)
          .join("\n")
      : "";
    const campaignImages = Array.isArray(config.images)
      ? config.images
          .map((item) => {
            if (!item || typeof item !== "object") return "";
            const entry = item as Record<string, unknown>;
            return [
              typeof entry.index === "string" ? entry.index : "",
              typeof entry.label === "string" ? entry.label : "",
              typeof entry.image === "string" ? entry.image : "",
            ].join(" | ");
          })
          .filter(Boolean)
          .join("\n")
      : "";
    const serviceCards = Array.isArray(config.cards)
      ? config.cards
          .map((item) => {
            if (!item || typeof item !== "object") return "";
            const entry = item as Record<string, unknown>;
            return [
              typeof entry.title === "string" ? entry.title : "",
              typeof entry.text === "string" ? entry.text : "",
              typeof entry.buttonLabel === "string" ? entry.buttonLabel : "",
              typeof entry.target === "string" ? entry.target : "",
            ].join(" | ");
          })
          .filter(Boolean)
          .join("\n")
      : "";

    setSectionDraft({
      ...getDefaultDraftForSection(selectedSection),
      label: selectedSection?.label ?? "",
      variant: typeof config.variant === "string" ? config.variant : "",
      image: typeof config.image === "string" ? config.image : "",
      title: typeof config.title === "string" ? config.title : "",
      text: typeof config.text === "string" ? config.text : "",
      hint: typeof config.hint === "string" ? config.hint : "",
      attribution: typeof config.attribution === "string" ? config.attribution : "",
      eyebrow: typeof config.eyebrow === "string" ? config.eyebrow : "",
      ctaLabel: typeof config.ctaLabel === "string" ? config.ctaLabel : "",
      ctaHref: typeof config.ctaHref === "string" ? config.ctaHref : "",
      secondaryCtaLabel: typeof config.secondaryCtaLabel === "string" ? config.secondaryCtaLabel : "",
      secondaryCtaHref: typeof config.secondaryCtaHref === "string" ? config.secondaryCtaHref : "",
      layoutPreset: typeof config.layoutPreset === "string" ? config.layoutPreset : "",
      items,
      heroSlides: heroSlides || getDefaultDraftForSection(selectedSection).heroSlides,
      campaignImages,
      serviceCards: serviceCards || getDefaultDraftForSection(selectedSection).serviceCards,
      productIds: Array.isArray(config.productIds)
        ? config.productIds.map((id) => String(id)).join(", ")
        : "",
      columns: typeof config.columns === "number" ? String(config.columns) : "",
      rawConfig: JSON.stringify(config, null, 2),
    });
  }, [selectedSection]);

  const handleMoveSection = (section: CanvasSection, direction: -1 | 1) => {
    const sorted = sortedSections;
    const currentIndex = sorted.findIndex((item) => item.id === section.id);
    const swapIndex = currentIndex + direction;
    if (currentIndex < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const swapTarget = sorted[swapIndex];
    sectionMutation.mutate({ sectionId: section.id, payload: { orderIndex: swapTarget.orderIndex } });
    sectionMutation.mutate({ sectionId: swapTarget.id, payload: { orderIndex: section.orderIndex } });
  };

  const previewTemplateId = effectiveTemplateId ?? visibleTemplates[0]?.id ?? settings?.activeTemplateId ?? null;
  const selectedThemeFont =
    STOREFRONT_FONT_OPTIONS.find((font) => font.id === previewFontPreset) ?? STOREFRONT_FONT_OPTIONS[0];
  const selectedThemeFontFamily = STOREFRONT_FONT_FAMILIES[selectedThemeFont.id].preview;
  const buildPreviewUrl = (templateId: number) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/?${new URLSearchParams(
          Object.fromEntries(
            [
              ["canvasPreviewTemplateId", String(templateId)],
              previewFontPreset ? ["canvasFontPreset", previewFontPreset] : null,
              previewKey ? ["canvasPreviewRefresh", String(previewKey)] : null,
            ].filter(Boolean) as Array<[string, string]>,
          ),
        ).toString()}`
      : "/";

  const previewFrameStyle =
    previewViewport === "mobile"
      ? {
          transform: "scale(0.94)",
          width: "106.383%",
          height: "calc(812px / 0.94)",
        }
      : previewViewport === "tablet"
        ? {
            transform: "scale(0.9)",
            width: "111.1112%",
            height: "calc(1024px / 0.9)",
          }
        : {
            transform: "scale(0.88)",
            width: "113.6364%",
            height: "calc(1080px / 0.88)",
          };

  const previewViewportShellClass =
    previewViewport === "mobile"
      ? "mx-auto w-[min(100%,390px)] rounded-[2.6rem] border border-black/10 bg-[#0b0b0d] p-3 shadow-[0_24px_64px_rgba(15,23,42,0.22)] dark:border-white/[0.10] dark:bg-black dark:shadow-[0_28px_72px_rgba(0,0,0,0.58)]"
      : previewViewport === "tablet"
        ? "mx-auto w-[min(100%,820px)] rounded-[2.2rem] border border-black/10 bg-[#111214] p-3 shadow-[0_24px_64px_rgba(15,23,42,0.18)] dark:border-white/[0.10] dark:bg-black dark:shadow-[0_28px_72px_rgba(0,0,0,0.58)]"
      : "h-[760px] overflow-hidden rounded-3xl border border-border/40 bg-white xl:h-[860px] 2xl:h-[920px] dark:border-white/[0.06] dark:bg-neutral-950";

  const previewCardTitle =
    activeTab === "theme"
      ? "Theme Preview"
      : activeTab === "sections"
        ? "Section Preview"
        : "Full Page Preview";
  const currentPreviewTemplate =
    visibleTemplates.find((template) => template.id === previewTemplateId) ?? visibleTemplates[0] ?? null;
  const renderablePreviewTemplates = visibleTemplates.filter(
    (template) => template.id === previewTemplateId || warmedPreviewTemplateIds.includes(template.id),
  );

  useEffect(() => {
    if (!previewTemplateId) return;
    setWarmedPreviewTemplateIds((current) =>
      current.includes(previewTemplateId) ? current : [...current, previewTemplateId],
    );
  }, [previewTemplateId]);

  const handleSaveSectionDraft = () => {
    if (!selectedSection) return;

    let nextConfig: Record<string, unknown> = {};
    try {
      nextConfig = sectionDraft.rawConfig.trim()
        ? JSON.parse(sectionDraft.rawConfig)
        : {};
    } catch {
      toast({
        title: "Invalid config JSON",
        description: "Please fix the JSON before saving.",
        variant: "destructive",
      });
      return;
    }

    nextConfig = { ...nextConfig };

    const assignOrDelete = (key: string, value: unknown) => {
      const shouldDelete =
        value == null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);

      if (shouldDelete) {
        delete nextConfig[key];
        return;
      }

      nextConfig[key] = value;
    };

    const variant = sectionDraft.variant.trim();
    const image = sectionDraft.image.trim();
    assignOrDelete("variant", variant);
    assignOrDelete("image", image);

    const title = sectionDraft.title.trim();
    const text = sectionDraft.text.trim();
    const hint = sectionDraft.hint.trim();
    const attribution = sectionDraft.attribution.trim();
    const eyebrow = sectionDraft.eyebrow.trim();
    const ctaLabel = sectionDraft.ctaLabel.trim();
    const ctaHref = sectionDraft.ctaHref.trim();
    const secondaryCtaLabel = sectionDraft.secondaryCtaLabel.trim();
    const secondaryCtaHref = sectionDraft.secondaryCtaHref.trim();
    const layoutPreset = sectionDraft.layoutPreset.trim();
    const items = sectionDraft.items
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const productIds = sectionDraft.productIds
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const columns = Number(sectionDraft.columns);
    const heroSlides = sectionDraft.heroSlides
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [tag = "", headline = "", eyebrow = "", body = "", ctaLabel = "", ctaHref = "", image = "", duration = ""] = line
          .split("|")
          .map((part) => part.trim());
        return {
          tag,
          headline,
          eyebrow,
          body,
          ctaLabel,
          ctaHref,
          image,
          duration: Number(duration) || undefined,
        };
      })
      .filter((slide) => slide.headline || slide.body || slide.ctaLabel || slide.ctaHref || slide.tag || slide.image || slide.eyebrow);
    const campaignImages = sectionDraft.campaignImages
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [index = "", label = "", image = ""] = line
          .split("|")
          .map((part) => part.trim());
        return { index, label, image };
      })
      .filter((item) => item.label || item.image || item.index);
    const serviceCards = sectionDraft.serviceCards
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [cardTitle = "", cardText = "", buttonLabel = "", target = ""] = line
          .split("|")
          .map((part) => part.trim());
        return {
          title: cardTitle,
          text: cardText,
          buttonLabel,
          target,
        };
      })
      .filter((item) => item.title || item.text || item.buttonLabel || item.target);
    const faqItems = sectionDraft.items
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [faqTitle = "", faqContent = ""] = line.split("|").map((part) => part.trim());
        return { title: faqTitle, content: faqContent };
      })
      .filter((item) => item.title || item.content);

    switch (selectedSection.sectionType) {
      case "hero":
        assignOrDelete("slides", heroSlides);
        assignOrDelete("secondaryCtaLabel", secondaryCtaLabel);
        assignOrDelete("secondaryCtaHref", secondaryCtaHref);
        break;
      case "ticker":
        assignOrDelete("items", items);
        break;
      case "quote":
        assignOrDelete("text", text);
        assignOrDelete("attribution", attribution);
        break;
      case "featured":
        assignOrDelete("title", title);
        assignOrDelete("hint", hint);
        assignOrDelete("label", sectionDraft.label.trim());
        assignOrDelete("productIds", productIds);
        break;
      case "fresh-release":
        assignOrDelete("title", title);
        assignOrDelete("text", text);
        assignOrDelete("productIds", productIds);
        assignOrDelete(
          "columns",
          Number.isFinite(columns) && columns >= 2 && columns <= 4 ? columns : undefined,
        );
        break;
      case "campaign":
        assignOrDelete("title", title);
        assignOrDelete("text", text);
        assignOrDelete("eyebrow", eyebrow);
        assignOrDelete("ctaLabel", ctaLabel);
        assignOrDelete("ctaHref", ctaHref);
        assignOrDelete("layoutPreset", layoutPreset);
        assignOrDelete("images", campaignImages);
        break;
      case "arrivals":
      case "services":
        assignOrDelete("title", title);
        assignOrDelete("text", text);
        if (selectedSection.sectionType === "services") {
          assignOrDelete("cards", serviceCards);
        }
        break;
      case "faq":
        assignOrDelete("title", title);
        assignOrDelete("text", text);
        assignOrDelete("items", faqItems);
        break;
      default:
        assignOrDelete("title", title);
        assignOrDelete("text", text);
        assignOrDelete("hint", hint);
        assignOrDelete("attribution", attribution);
        assignOrDelete("items", items);
        assignOrDelete("productIds", productIds);
        assignOrDelete(
          "columns",
          Number.isFinite(columns) && columns >= 2 && columns <= 4 ? columns : undefined,
        );
        break;
    }

    setSavingSectionId(selectedSection.id);
    sectionMutation.mutate({
      sectionId: selectedSection.id,
      payload: {
        label: sectionDraft.label.trim() || selectedSection.sectionType,
        config: nextConfig,
      },
      feedback: "save",
    });
  };

  const buildDraftPreviewConfig = (section: CanvasSection) => {
    const config: Record<string, unknown> = {};
    const label = sectionDraft.label.trim();
    const variant = sectionDraft.variant.trim();
    const image = sectionDraft.image.trim();
    const eyebrow = sectionDraft.eyebrow.trim();
    const title = sectionDraft.title.trim();
    const text = sectionDraft.text.trim();
    const hint = sectionDraft.hint.trim();
    const attribution = sectionDraft.attribution.trim();
    const ctaLabel = sectionDraft.ctaLabel.trim();
    const ctaHref = sectionDraft.ctaHref.trim();
    const secondaryCtaLabel = sectionDraft.secondaryCtaLabel.trim();
    const secondaryCtaHref = sectionDraft.secondaryCtaHref.trim();
    const layoutPreset = sectionDraft.layoutPreset.trim();

    if (label) config.label = label;
    if (variant) config.variant = variant;
    if (image) config.image = image;
    if (eyebrow) config.eyebrow = eyebrow;
    if (title) config.title = title;
    if (text) config.text = text;
    if (hint) config.hint = hint;
    if (attribution) config.attribution = attribution;
    if (ctaLabel) config.ctaLabel = ctaLabel;
    if (ctaHref) config.ctaHref = ctaHref;
    if (secondaryCtaLabel) config.secondaryCtaLabel = secondaryCtaLabel;
    if (secondaryCtaHref) config.secondaryCtaHref = secondaryCtaHref;
    if (layoutPreset) config.layoutPreset = layoutPreset;

    if (section.sectionType === "hero") {
      const slides = deserializeHeroSlides(sectionDraft.heroSlides);
      if (slides.length) config.slides = slides;
    }

    if (section.sectionType === "ticker") {
      const items = sectionDraft.items
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (items.length) config.items = items;
    }

    if (section.sectionType === "faq") {
      const items = sectionDraft.items
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [title = "", content = ""] = line.split("|").map((part) => part.trim());
          return { title, content };
        })
        .filter((item) => item.title || item.content);
      if (items.length) config.items = items;
    }

    if (section.sectionType === "campaign") {
      const images = sectionDraft.campaignImages
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [index = "", labelValue = "", imageValue = ""] = line
            .split("|")
            .map((part) => part.trim());
          return { index, label: labelValue, image: imageValue };
        })
        .filter((item) => item.image || item.label || item.index);
      if (images.length) config.images = images;
    }

    if (section.sectionType === "featured" || section.sectionType === "fresh-release") {
      const productIds = sectionDraft.productIds
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (productIds.length) config.productIds = productIds;
    }

    if (section.sectionType === "fresh-release") {
      const columns = Number(sectionDraft.columns);
      if (Number.isFinite(columns)) config.columns = columns;
    }

    if (section.sectionType === "services") {
      const cards = sectionDraft.serviceCards
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [cardTitle = "", cardText = "", buttonLabel = "", target = ""] = line
            .split("|")
            .map((part) => part.trim());
          return {
            title: cardTitle,
            text: cardText,
            buttonLabel,
            target,
          };
        })
        .filter((card) => card.title || card.text || card.buttonLabel || card.target);
      if (cards.length) config.cards = cards;
    }

    return config;
  };

  const renderSectionMiniPreview = (section: CanvasSection) => {
    const isSelected = selectedSection?.id === section.id;
    const draftConfig = isSelected ? buildDraftPreviewConfig(section) : null;
    const config =
      draftConfig ??
      (section.config && typeof section.config === "object"
        ? (section.config as Record<string, unknown>)
        : {});
    const previewImage = typeof config.image === "string" ? config.image : "";
    const heroSlides = Array.isArray(config.slides)
      ? config.slides.filter((slide): slide is Record<string, unknown> => !!slide && typeof slide === "object")
      : [];
    const firstHeroSlide = heroSlides[0];
    const heroHeadline = typeof firstHeroSlide?.headline === "string" ? firstHeroSlide.headline : "";
    const heroTag = typeof firstHeroSlide?.tag === "string" ? firstHeroSlide.tag : "";
    const heroImage = typeof firstHeroSlide?.image === "string" ? firstHeroSlide.image : "";
    const tickerItems = Array.isArray(config.items)
      ? config.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const quoteText = typeof config.text === "string" ? config.text : "";
    const quoteAttribution = typeof config.attribution === "string" ? config.attribution : "";
    const featuredTitle = typeof config.title === "string" ? config.title : "";
    const featuredHint = typeof config.hint === "string" ? config.hint : "";
    const freshReleaseIds = Array.isArray(config.productIds)
      ? config.productIds.map((id) => String(id))
      : [];
    const freshReleaseProducts = productOptions
      .filter((product) => freshReleaseIds.includes(String(product.id)))
      .slice(0, 4);
    const featuredProducts = productOptions.slice(0, 3);
    const campaignImages = Array.isArray(config.images)
      ? config.images
          .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
          .slice(0, 4)
      : [];
    const servicesText = typeof config.text === "string" ? config.text : "";
    const faqItems = Array.isArray(config.items)
      ? config.items
          .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
          .map((item) => ({
            title: typeof item.title === "string" ? item.title : "",
            content: typeof item.content === "string" ? item.content : "",
          }))
          .filter((item) => item.title || item.content)
          .slice(0, 2)
      : [];
    const effectivePreviewImage = heroImage || previewImage;

    return (
      <div
        className={`relative h-28 overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${SECTION_PREVIEW_STYLES[section.sectionType] ?? "from-neutral-950 via-neutral-900 to-neutral-800"}`}
        style={
          effectivePreviewImage
            ? {
                backgroundImage: `linear-gradient(180deg,rgba(8,8,8,0.16),rgba(8,8,8,0.68)), url(${effectivePreviewImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(201,169,110,0.16)_0%,transparent_38%),linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.62)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-8 bg-[linear-gradient(90deg,rgba(255,255,255,0.12),transparent)]" />
        <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/70">
          {section.isVisible ? "Live" : "Hidden"}
        </div>

        {section.sectionType === "hero" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-[8px] uppercase tracking-[0.26em] text-[rgba(201,169,110,0.9)]">
              {heroTag || section.sectionType}
            </p>
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-white/95">
              {heroHeadline || section.label || section.sectionType}
            </p>
            <div className="mt-2 flex gap-1">
              {heroSlides.slice(0, 4).map((_, index) => (
                <span
                  key={`hero-progress-${section.id}-${index}`}
                  className={`h-1 flex-1 rounded-full ${
                    index === 0 ? "bg-[rgba(201,169,110,0.95)]" : "bg-white/25"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : null}

        {section.sectionType === "ticker" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="overflow-hidden rounded-lg border border-black/10 bg-black/20 px-2 py-1.5">
              <div className="flex gap-4 whitespace-nowrap text-[9px] uppercase tracking-[0.18em] text-black/80">
                {(tickerItems.length ? tickerItems : [section.label ?? "Ticker preview"]).slice(0, 3).map((item, index) => (
                  <span key={`ticker-item-${section.id}-${index}`} className="truncate">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {section.sectionType === "quote" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="line-clamp-2 text-xs italic text-white/90">
                {quoteText || section.label || section.sectionType}
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.2em] text-[rgba(201,169,110,0.9)]">
                {quoteAttribution || "Statement"}
              </p>
            </div>
          </div>
        ) : null}

        {section.sectionType === "fresh-release" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            {freshReleaseProducts.length ? (
              <div className="grid grid-cols-4 gap-1.5">
                {freshReleaseProducts.map((product) => (
                  <div
                    key={`fresh-release-thumb-${section.id}-${product.id}`}
                    className="overflow-hidden rounded-md border border-white/10 bg-black/20"
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-10 w-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-full bg-white/10" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-white/75">
                Select products for preview
              </div>
            )}
          </div>
        ) : null}

        {section.sectionType === "campaign" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            {campaignImages.length ? (
              <div className="grid grid-cols-4 gap-1.5">
                {campaignImages.map((item, index) => {
                  const image = typeof item.image === "string" ? item.image : "";
                  const label = typeof item.label === "string" ? item.label : `Grid ${index + 1}`;
                  return (
                    <div
                      key={`campaign-thumb-${section.id}-${index}`}
                      className="overflow-hidden rounded-md border border-white/10 bg-black/20"
                    >
                      {image ? (
                        <img
                          src={image}
                          alt={label}
                          className="h-10 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-full items-center justify-center bg-white/10 text-[8px] uppercase tracking-[0.18em] text-white/65">
                          {label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-white/75">
                Add grid images for preview
              </div>
            )}
          </div>
        ) : null}

        {section.sectionType === "featured" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <p className="line-clamp-1 text-xs font-semibold text-white/92">
                {featuredTitle || section.label || section.sectionType}
              </p>
              <p className="mt-1 line-clamp-1 text-[8px] uppercase tracking-[0.18em] text-[rgba(201,169,110,0.9)]">
                {featuredHint || "Curated product rail"}
              </p>
              <div className="mt-2 flex gap-1.5">
                {featuredProducts.map((product) => (
                  <div
                    key={`featured-thumb-${section.id}-${product.id}`}
                    className="overflow-hidden rounded-md border border-white/10 bg-black/20"
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-9 w-9 object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 bg-white/10" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {section.sectionType === "services" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {["Craft", "Delivery", "Support"].map((item, index) => (
                <div
                  key={`service-pill-${section.id}-${index}`}
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-center"
                >
                  <p className="text-[8px] uppercase tracking-[0.18em] text-white/85">
                    {item}
                  </p>
                </div>
              ))}
            </div>
            {servicesText ? (
              <p className="mt-2 line-clamp-1 text-[8px] uppercase tracking-[0.18em] text-white/70">
                {servicesText}
              </p>
            ) : null}
          </div>
        ) : null}

        {section.sectionType === "faq" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              {(faqItems.length ? faqItems : [{ title: "Frequently Asked Questions", content: "" }]).map((item, index) => (
                <p
                  key={`faq-preview-${section.id}-${index}`}
                  className="line-clamp-1 text-[9px] uppercase tracking-[0.16em] text-white/85"
                >
                  {item.title}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {section.sectionType === "back-to-top" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/90">Back to Top</p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.16em] text-white/70">
                Image + scroll action
              </p>
            </div>
          </div>
        ) : null}

        {!["hero", "ticker", "quote", "fresh-release", "campaign", "featured", "services", "faq", "back-to-top"].includes(section.sectionType) ? (
          <div className="absolute left-3 top-3 right-3">
            <p className="text-[9px] uppercase tracking-[0.24em] text-[rgba(201,169,110,0.88)]">
              {section.sectionType}
            </p>
            <p className="mt-2 line-clamp-2 text-sm font-semibold text-white/90">
              {section.label ?? section.sectionType}
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/55">
              Position #{section.orderIndex}
            </p>
          </div>
        ) : (
          <div className="absolute left-3 top-3 right-16">
            <p className="text-[9px] uppercase tracking-[0.24em] text-[rgba(201,169,110,0.88)]">
              {section.sectionType}
            </p>
            <p className="mt-2 line-clamp-1 text-sm font-semibold text-white/90">
              {section.label ?? section.sectionType}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
              Position #{section.orderIndex}
            </p>
          </div>
        )}
      </div>
    );
  };

  const templatesForMove = visibleTemplates.filter((template) => template.id !== effectiveTemplateId);

  const sectionEditorTitle =
    selectedSection?.sectionType === "hero"
      ? "Hero Settings"
      : selectedSection?.sectionType === "ticker"
        ? "Ticker Settings"
      : selectedSection?.sectionType === "quote"
          ? "Statement Settings"
          : selectedSection?.sectionType === "featured"
            ? "Featured Product Settings"
            : selectedSection?.sectionType === "fresh-release"
              ? "Fresh Release Settings"
              : selectedSection?.sectionType === "campaign"
                ? "Editorial Grid Settings"
                : selectedSection?.sectionType === "back-to-top"
                  ? "Back To Top Settings"
                : selectedSection?.sectionType === "faq"
                  ? "FAQ Accordion Settings"
                : "Section Settings";
  const sectionPresets = getSectionPresets(selectedSection);

  const parsedHeroSlides = useMemo(
    () => deserializeHeroSlides(sectionDraft.heroSlides),
    [sectionDraft.heroSlides],
  );

  const parsedCampaignImages = useMemo(
    () =>
      sectionDraft.campaignImages
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [index = "", label = "", image = ""] = line
            .split("|")
            .map((part) => part.trim());
          return { index, label, image };
        }),
    [sectionDraft.campaignImages],
  );

  const parsedServiceCards = useMemo(
    () =>
      sectionDraft.serviceCards
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [title = "", text = "", buttonLabel = "", target = ""] = line
            .split("|")
            .map((part) => part.trim());
          return { title, text, buttonLabel, target };
        }),
    [sectionDraft.serviceCards],
  );

  const updateHeroSlideField = (
    index: number,
    field: "tag" | "headline" | "eyebrow" | "body" | "ctaLabel" | "ctaHref" | "image" | "duration",
    value: string,
  ) => {
    setSectionDraft((prev) => {
      const slides = deserializeHeroSlides(prev.heroSlides);
      const nextSlides = slides.length ? slides : DEFAULT_MAISON_HERO_SLIDE_DRAFTS.map((slide) => ({ ...slide }));
      if (!nextSlides[index]) nextSlides[index] = formatHeroSlideDraft();
      nextSlides[index] = { ...nextSlides[index], [field]: value };
      return {
        ...prev,
        heroSlides: serializeHeroSlides(nextSlides),
      };
    });
  };

  const addHeroSlide = () => {
    setSectionDraft((prev) => ({
      ...prev,
      heroSlides: prev.heroSlides.trim()
        ? `${prev.heroSlides}\n${serializeHeroSlides([formatHeroSlideDraft()])}`
        : DEFAULT_MAISON_HERO_SLIDES_TEXT,
    }));
  };

  const removeHeroSlide = (index: number) => {
    setSectionDraft((prev) => {
      const lines = prev.heroSlides
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      lines.splice(index, 1);
      return { ...prev, heroSlides: lines.join("\n") };
    });
  };

  const updateCampaignImageField = (
    index: number,
    field: "index" | "label" | "image",
    value: string,
  ) => {
    setSectionDraft((prev) => {
      const items = prev.campaignImages
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [itemIndex = "", label = "", image = ""] = line
            .split("|")
            .map((part) => part.trim());
          return { index: itemIndex, label, image };
        });
      const nextItems = items.length ? items : [{ index: "", label: "", image: "" }];
      if (!nextItems[index]) nextItems[index] = { index: "", label: "", image: "" };
      nextItems[index] = { ...nextItems[index], [field]: value };
      return {
        ...prev,
        campaignImages: nextItems
          .map((item) => [item.index, item.label, item.image].join(" | "))
          .join("\n"),
      };
    });
  };

  const addCampaignImage = () => {
    setSectionDraft((prev) => ({
      ...prev,
      campaignImages: prev.campaignImages.trim()
        ? `${prev.campaignImages}\n |  | `
        : " |  | ",
    }));
  };

  const addCampaignImageAndPick = () => {
    const currentItems = sectionDraft.campaignImages
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const nextIndex = currentItems.length;
    addCampaignImage();
    setMediaPickerTarget({ type: "campaign", index: nextIndex });
  };

  const removeCampaignImage = (index: number) => {
    setSectionDraft((prev) => {
      const lines = prev.campaignImages
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      lines.splice(index, 1);
      return { ...prev, campaignImages: lines.join("\n") };
    });
  };

  const updateServiceCardField = (
    index: number,
    field: "title" | "text" | "buttonLabel" | "target",
    value: string,
  ) => {
    setSectionDraft((prev) => {
      const cards = prev.serviceCards
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [title = "", text = "", buttonLabel = "", target = ""] = line
            .split("|")
            .map((part) => part.trim());
          return { title, text, buttonLabel, target };
        });
      const nextCards = cards.length ? cards : [{ title: "", text: "", buttonLabel: "", target: "" }];
      if (!nextCards[index]) nextCards[index] = { title: "", text: "", buttonLabel: "", target: "" };
      nextCards[index] = { ...nextCards[index], [field]: value };
      return {
        ...prev,
        serviceCards: nextCards
          .map((card) => [card.title, card.text, card.buttonLabel, card.target].join(" | "))
          .join("\n"),
      };
    });
  };

  const addServiceCard = () => {
    setSectionDraft((prev) => ({
      ...prev,
      serviceCards: prev.serviceCards.trim()
        ? `${prev.serviceCards}\n |  |  | `
        : " |  |  | ",
    }));
  };

  const removeServiceCard = (index: number) => {
    setSectionDraft((prev) => {
      const lines = prev.serviceCards
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      lines.splice(index, 1);
      return { ...prev, serviceCards: lines.join("\n") };
    });
  };

  const reorderHeroSlides = (sourceIndex: number, targetIndex: number) => {
    setSectionDraft((prev) => {
      const slides = prev.heroSlides
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= slides.length || targetIndex >= slides.length) {
        return prev;
      }
      const next = slides.slice();
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, heroSlides: next.join("\n") };
    });
  };

  const reorderCampaignImages = (sourceIndex: number, targetIndex: number) => {
    setSectionDraft((prev) => {
      const items = prev.campaignImages
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= items.length || targetIndex >= items.length) {
        return prev;
      }
      const next = items.slice();
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, campaignImages: next.join("\n") };
    });
  };

  function applyPickedImage(url: string) {
    if (!mediaPickerTarget) return;

    if (mediaPickerTarget.type === "hero") {
      updateHeroSlideField(mediaPickerTarget.index, "image", url);
    } else if (mediaPickerTarget.type === "campaign") {
      updateCampaignImageField(mediaPickerTarget.index, "image", url);
    } else {
      setSectionDraft((prev) => ({ ...prev, image: url }));
    }

    setMediaPickerTarget(null);
  }

  const selectedProductIds = useMemo(
    () => sectionDraft.productIds
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    [sectionDraft.productIds],
  );

  const toggleDraftProduct = (productId: string) => {
    setSectionDraft((prev) => {
      const currentIds = prev.productIds
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const nextIds = currentIds.includes(productId)
        ? currentIds.filter((id) => id !== productId)
        : [...currentIds, productId];

      return {
        ...prev,
        productIds: nextIds.join(", "),
      };
    });
  };

  const reorderDraftProducts = (sourceIndex: number, targetIndex: number) => {
    setSectionDraft((prev) => {
      const ids = prev.productIds
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= ids.length || targetIndex >= ids.length) {
        return prev;
      }
      const next = ids.slice();
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, productIds: next.join(", ") };
    });
  };

  const reorderServiceCards = (sourceIndex: number, targetIndex: number) => {
    setSectionDraft((prev) => {
      const cards = prev.serviceCards
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= cards.length || targetIndex >= cards.length) {
        return prev;
      }
      const next = cards.slice();
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, serviceCards: next.join("\n") };
    });
  };

  const applySectionPreset = (preset: SectionPreset) => {
    setSectionDraft((prev) => ({
      ...prev,
      ...preset.apply,
      rawConfig: prev.rawConfig,
    }));
  };

  const resetSectionDraft = () => {
    if (!selectedSection) return;
    setSectionDraft(getDefaultDraftForSection(selectedSection));
    toast({
      title: "Section reset in editor",
      description: "Review the defaults and save when you're ready.",
      variant: "success",
    });
  };

  const renderTemplatePreview = (template: CanvasTemplate) => {
    const previewUrl = template.thumbnailUrl || TEMPLATE_PREVIEW_FALLBACKS[template.slug] || null;

    if (template.slug === "nikeshdesign") {
      return (
        <div
          className="relative h-28 overflow-hidden bg-[#0c0b09]"
          style={
            previewUrl
              ? {
                  backgroundImage: `linear-gradient(180deg,rgba(12,11,9,0.18),rgba(12,11,9,0.84)), url(${previewUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(201,169,110,0.14)_0%,transparent_38%),linear-gradient(180deg,transparent_0%,rgba(12,11,9,0.92)_100%)]" />
          <div className="absolute left-4 top-4">
            <p className="text-[8px] uppercase tracking-[0.3em] text-[rgba(201,169,110,0.9)]">Premium Editorial</p>
            <h4 className="mt-2 font-serif text-lg text-[rgba(232,228,219,0.98)]">Nikesh Design</h4>
            <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[rgba(232,228,219,0.48)]">Sample-Driven Homepage</p>
          </div>
        </div>
      );
    }

    if (template.slug === "maison-nocturne") {
      return (
        <div
          className="relative h-28 overflow-hidden bg-[#0c0b09]"
          style={
            previewUrl
              ? {
                  backgroundImage: `linear-gradient(180deg,rgba(12,11,9,0.15),rgba(12,11,9,0.82)), url(${previewUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,169,110,0.22),transparent_38%),linear-gradient(135deg,rgba(17,16,9,0.88)_0%,rgba(12,11,9,0.55)_35%,rgba(27,23,17,0.65)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-[rgba(201,169,110,0.4)]" />
          <div className="absolute left-4 top-4">
            <p className="text-[8px] uppercase tracking-[0.3em] text-[rgba(201,169,110,0.88)]">
              New Luxury
            </p>
            <h4 className="mt-2 font-serif text-lg text-[rgba(232,228,219,0.96)]">
              Rare Atelier Official
            </h4>
            <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[rgba(232,228,219,0.48)]">
              Editorial Story Layout
            </p>
          </div>
          <div className="absolute bottom-0 right-0 h-16 w-24 bg-[radial-gradient(circle_at_bottom_right,rgba(201,169,110,0.35),transparent_60%)]" />
        </div>
      );
    }

    if (previewUrl) {
      return (
        <div
          className="relative h-28 overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-700"
          style={{
            backgroundImage: `linear-gradient(180deg,rgba(12,12,12,0.08),rgba(12,12,12,0.26)), url(${previewUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "top center",
          }}
        >
          <div className="absolute inset-x-3 top-2 h-3 rounded-full border border-white/20 bg-white/15 backdrop-blur-sm" />
        </div>
      );
    }

    if (template.slug === "rare-dark-luxury") {
      return (
        <div className="h-28 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-700" />
      );
    }

    return (
      <div className="h-28 bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/50 bg-gradient-to-br from-fuchsia-50 via-white to-amber-50 p-6 shadow-sm dark:border-white/[0.06] dark:from-fuchsia-950/20 dark:via-neutral-950 dark:to-amber-950/10 dark:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-white shadow-lg">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-medium text-foreground">Canvas</h1>
              <p className="text-sm text-muted-foreground">
                Build and publish the RARE.NP homepage layout from templates and sections.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview Site
            </Button>
            <Button
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
              disabled={!effectiveTemplateId || activateMutation.isPending}
              onClick={() => effectiveTemplateId && activateMutation.mutate(effectiveTemplateId)}
            >
              {activateMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Publishing
                </>
              ) : (
                "Publish Changes"
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card className={CANVAS_ELEVATED_CARD_CLASS}>
          <CardContent className="p-4">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-5"
            >
              <TabsList className="grid h-auto grid-cols-3 gap-2 rounded-3xl border border-black/10 bg-white/80 p-2 shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:border-white/[0.10] dark:bg-white/[0.03] dark:shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                {CANVAS_TAB_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="group justify-start rounded-2xl border border-transparent px-3 py-3 text-left data-[state=active]:border-black/10 data-[state=active]:bg-white/95 data-[state=active]:shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:data-[state=active]:border-white/[0.10] dark:data-[state=active]:bg-white/[0.05] dark:data-[state=active]:shadow-[0_10px_24px_rgba(0,0,0,0.38)]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm transition-transform duration-200 group-data-[state=active]:scale-105 dark:shadow-none",
                            item.iconClassName,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">{item.label}</div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {item.hint}
                          </div>
                        </div>
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <div className="space-y-4">
                <TabsContent value="templates" className="mt-0 space-y-5">
                  <Card className="rounded-3xl border-border/50 bg-white/90 shadow-sm dark:border-white/[0.06] dark:bg-neutral-950/85 dark:shadow-none">
                    <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>Live Preview</CardTitle>
                        <CardDescription>
                          Preview the current homepage selection and switch templates quickly from one compact panel.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center rounded-xl border border-border/60 bg-background/70 p-1">
                          <Button
                            type="button"
                            variant={previewViewport === "desktop" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-lg"
                            onClick={() => setPreviewViewport("desktop")}
                          >
                            <Monitor className="mr-2 h-4 w-4" />
                            Desktop
                            <span className="ml-2 text-[11px] font-medium opacity-75">1440px</span>
                          </Button>
                          <Button
                            type="button"
                            variant={previewViewport === "tablet" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-lg"
                            onClick={() => setPreviewViewport("tablet")}
                          >
                            <Tablet className="mr-2 h-4 w-4" />
                            Tablet
                            <span className="ml-2 text-[11px] font-medium opacity-75">768px</span>
                          </Button>
                          <Button
                            type="button"
                            variant={previewViewport === "mobile" ? "default" : "ghost"}
                            size="sm"
                            className="rounded-lg"
                            onClick={() => setPreviewViewport("mobile")}
                          >
                            <Smartphone className="mr-2 h-4 w-4" />
                            Mobile
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setPreviewLoaderVisible(true);
                            setPreviewBootProgress(8);
                            setPreviewKey((prev) => prev + 1);
                          }}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                      <div className={cn(CANVAS_ELEVATED_PANEL_CLASS, "space-y-3 p-4")}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                            Current Template
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {currentPreviewTemplate?.name ?? "No template selected"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {currentPreviewTemplate?.description ?? "Choose a template to preview it live here."}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {visibleTemplates.map((template) => {
                            const isSelected = template.id === previewTemplateId;
                            const isActive = settings?.activeTemplate?.id === template.id || settings?.activeTemplateId === template.id;
                            return (
                              <button
                                key={`preview-switch-${template.id}`}
                                type="button"
                                onClick={() => {
                                  const isWarmed = warmedPreviewTemplateIds.includes(template.id);
                                  if (!isWarmed) {
                                    setPreviewLoaderVisible(true);
                                    setPreviewBootProgress(8);
                                    setWarmedPreviewTemplateIds((current) =>
                                      current.includes(template.id) ? current : [...current, template.id],
                                    );
                                  }
                                  setSelectedTemplateId(template.id);
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all",
                                  isSelected
                                    ? "border-sky-400 bg-sky-50/70 shadow-[0_8px_20px_rgba(56,189,248,0.16)] dark:bg-sky-950/25"
                                    : "border-black/10 bg-white/80 hover:border-black/20 dark:border-white/[0.10] dark:bg-white/[0.03] dark:hover:border-white/20",
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {template.tier === "premium" ? "Premium template" : "Free template"}
                                  </p>
                                </div>
                                {isActive ? (
                                  <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">Live</Badge>
                                ) : isSelected ? (
                                  <Badge className="shrink-0 bg-sky-600 hover:bg-sky-600">Selected</Badge>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className={previewViewportShellClass}>
                          <div
                            className={cn(
                              "relative overflow-hidden",
                              previewViewport === "mobile"
                                ? "h-[760px] rounded-[2rem] bg-white dark:bg-neutral-950"
                                : previewViewport === "tablet"
                                  ? "h-[920px] rounded-[1.8rem] bg-white dark:bg-neutral-950"
                                : "h-full",
                            )}
                          >
                            {previewViewport === "mobile" ? (
                              <>
                                <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-7 w-36 -translate-x-1/2 rounded-full bg-black shadow-[0_8px_20px_rgba(0,0,0,0.28)]">
                                  <div className="absolute left-1/2 top-1/2 h-2 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-800" />
                                  <div className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-neutral-700 ring-2 ring-neutral-900" />
                                </div>
                                <div className="relative h-full overflow-hidden rounded-[1.7rem] border border-black/10 bg-white dark:border-white/[0.08] dark:bg-neutral-950">
                                  {previewLoaderVisible ? (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050505] text-white">
                                      <div className="loader-content">
                                        <div className="loader-logo whitespace-nowrap" aria-hidden="true">
                                          RARE ATELIER
                                        </div>
                                        <div className="loader-bar-container">
                                          <div
                                            id="loader-progress"
                                            style={{ width: `${previewBootProgress}%` }}
                                          />
                                        </div>
                                        <div className="loader-status">Loading</div>
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="relative origin-top-left" style={previewFrameStyle}>
                                    {renderablePreviewTemplates.map((template) => (
                                      <iframe
                                        key={`${template.id}-${previewKey}-${previewViewport}`}
                                        src={buildPreviewUrl(template.id)}
                                        title={`Canvas preview — ${template.name}`}
                                        loading="eager"
                                        onLoad={() => {
                                          if (template.id === previewTemplateId) {
                                            setPreviewBootProgress(100);
                                            window.setTimeout(() => {
                                              setBootedPreviewViewports((current) => ({
                                                ...current,
                                                [previewViewport]: true,
                                              }));
                                              setPreviewLoaderVisible(false);
                                            }, 140);
                                          }
                                        }}
                                        className={cn(
                                          "absolute inset-0 h-full w-full border-0 transition-opacity duration-150",
                                          template.id === previewTemplateId
                                            ? "opacity-100"
                                            : "pointer-events-none opacity-0",
                                        )}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </>
                            ) : previewViewport === "tablet" ? (
                              <div className="relative h-full overflow-hidden rounded-[1.45rem] border border-black/10 bg-white dark:border-white/[0.08] dark:bg-neutral-950">
                                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center py-3">
                                  <div className="h-1.5 w-20 rounded-full bg-black/10 dark:bg-white/15" />
                                </div>
                                <div className="relative origin-top-left" style={previewFrameStyle}>
                                  {previewLoaderVisible ? (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050505] text-white">
                                      <div className="loader-content">
                                        <div className="loader-logo whitespace-nowrap" aria-hidden="true">
                                          RARE ATELIER
                                        </div>
                                        <div className="loader-bar-container">
                                          <div
                                            id="loader-progress"
                                            style={{ width: `${previewBootProgress}%` }}
                                          />
                                        </div>
                                        <div className="loader-status">Loading</div>
                                      </div>
                                    </div>
                                  ) : null}
                                  {renderablePreviewTemplates.map((template) => (
                                    <iframe
                                      key={`${template.id}-${previewKey}-${previewViewport}`}
                                      src={buildPreviewUrl(template.id)}
                                      title={`Canvas preview — ${template.name}`}
                                      loading="eager"
                                      onLoad={() => {
                                        if (template.id === previewTemplateId) {
                                          setPreviewBootProgress(100);
                                          window.setTimeout(() => {
                                            setBootedPreviewViewports((current) => ({
                                              ...current,
                                              [previewViewport]: true,
                                            }));
                                            setPreviewLoaderVisible(false);
                                          }, 140);
                                        }
                                      }}
                                      className={cn(
                                        "absolute inset-0 h-full w-full border-0 transition-opacity duration-150",
                                        template.id === previewTemplateId
                                          ? "opacity-100"
                                          : "pointer-events-none opacity-0",
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="relative h-full origin-top-left" style={previewFrameStyle}>
                                {previewLoaderVisible ? (
                                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050505] text-white">
                                    <div className="loader-content">
                                      <div className="loader-logo whitespace-nowrap" aria-hidden="true">
                                        RARE ATELIER
                                      </div>
                                      <div className="loader-bar-container">
                                        <div
                                          id="loader-progress"
                                          style={{ width: `${previewBootProgress}%` }}
                                        />
                                      </div>
                                      <div className="loader-status">Loading</div>
                                    </div>
                                  </div>
                                ) : null}
                                {renderablePreviewTemplates.map((template) => (
                                  <iframe
                                    key={`${template.id}-${previewKey}-${previewViewport}`}
                                    src={buildPreviewUrl(template.id)}
                                    title={`Canvas preview — ${template.name}`}
                                    loading="eager"
                                    onLoad={() => {
                                      if (template.id === previewTemplateId) {
                                        setPreviewBootProgress(100);
                                        window.setTimeout(() => {
                                          setBootedPreviewViewports((current) => ({
                                            ...current,
                                            [previewViewport]: true,
                                          }));
                                          setPreviewLoaderVisible(false);
                                        }, 140);
                                      }
                                    }}
                                    className={cn(
                                      "absolute inset-0 h-full w-full border-0 transition-opacity duration-150",
                                      template.id === previewTemplateId
                                        ? "opacity-100"
                                        : "pointer-events-none opacity-0",
                                    )}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Live preview shows only the current selected template. Use the compact switcher to move between templates faster.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
                          Premium Templates
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Premium homepage designs. Unowned premium templates are locked until purchased.
                        </p>
                      </div>
                      <Badge className="bg-amber-500 text-black hover:bg-amber-500">Premium Collection</Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {premiumTemplates.map((template) => {
                        const isActive = settings?.activeTemplate?.id === template.id || settings?.activeTemplateId === template.id;
                        const isSelected = effectiveTemplateId === template.id;
                        const isLocked = !template.isPurchased;
                        const isRareDarkLuxury = template.slug === "rare-dark-luxury";
                        return (
                          <Card
                            key={template.id}
                            role="button"
                            tabIndex={isLocked ? -1 : 0}
                            onClick={() => {
                              if (isLocked) return;
                              setSelectedTemplateId(template.id);
                            }}
                            onKeyDown={(event) => {
                              if (isLocked) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedTemplateId(template.id);
                              }
                            }}
                            className={`overflow-hidden rounded-2xl border transition-all ${
                              isLocked
                                ? "border-border/50 opacity-85 dark:border-white/[0.06]"
                                : isActive
                                  ? "cursor-pointer border-emerald-500 shadow-emerald-100 dark:shadow-none"
                                  : "cursor-pointer border-border/50 dark:border-white/[0.06]"
                            } ${isSelected ? "ring-2 ring-fuchsia-300 dark:ring-fuchsia-700" : ""} ${isLocked ? "" : "hover:-translate-y-0.5 hover:shadow-sm dark:hover:shadow-none"}`}
                          >
                            {renderTemplatePreview(template)}
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="text-base font-semibold">{template.name}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {template.description ?? "No description"}
                                  </p>
                                </div>
                                <Badge className="bg-amber-500 text-black hover:bg-amber-500">PREMIUM</Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {isActive ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge> : null}
                                {template.slug === "maison-nocturne" ? (
                                  <Badge className="bg-fuchsia-600 hover:bg-fuchsia-600">New</Badge>
                                ) : null}
                                {template.isPurchased ? (
                                  <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">
                                    Owned
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
                                    <Lock className="mr-1 h-3 w-3" />
                                    Locked
                                  </Badge>
                                )}
                                {isRareDarkLuxury ? (
                                  <Badge variant="outline" className="border-black/20 text-foreground dark:border-white/20">
                                    One-time purchase
                                  </Badge>
                                ) : null}
                              </div>
                              {isLocked ? (
                                <div className="rounded-xl border border-dashed border-amber-500/50 bg-amber-50/60 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                                  {isRareDarkLuxury
                                    ? "RARE Dark Luxury is locked and will only unlock after a one-time purchase."
                                    : "Purchase this premium template before applying it to the storefront."}
                                </div>
                              ) : null}
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 rounded-xl"
                                  disabled={isLocked}
                                  onClick={() => {
                                    if (isLocked) return;
                                    setSelectedTemplateId(template.id);
                                  }}
                                >
                                  {isLocked ? "Locked" : "Select"}
                                </Button>
                                <Button
                                  className="flex-1 rounded-xl"
                                  disabled={isLocked}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (isLocked) return;
                                    setSelectedTemplateId(template.id);
                                    activateMutation.mutate(template.id);
                                  }}
                                >
                                  {isLocked ? "Purchase Required" : "Activate"}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
                          Free Templates
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Free templates available for instant selection and activation.
                        </p>
                      </div>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Free Collection</Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {freeTemplates.map((template) => {
                        const isActive = settings?.activeTemplate?.id === template.id || settings?.activeTemplateId === template.id;
                        const isSelected = effectiveTemplateId === template.id;
                        return (
                          <Card
                            key={template.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedTemplateId(template.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedTemplateId(template.id);
                              }
                            }}
                            className={`cursor-pointer overflow-hidden rounded-2xl border transition-all ${
                              isActive ? "border-emerald-500" : "border-border/50 dark:border-white/[0.06]"
                            } ${isSelected ? "ring-2 ring-sky-300 dark:ring-sky-700" : ""} hover:-translate-y-0.5 hover:shadow-sm dark:hover:shadow-none`}
                          >
                            {renderTemplatePreview(template)}
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="text-base font-semibold">{template.name}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {template.description ?? "No description"}
                                  </p>
                                </div>
                                <Badge className="bg-emerald-600 hover:bg-emerald-600">FREE</Badge>
                              </div>
                              {isActive ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge> : null}
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 rounded-xl"
                                  onClick={() => setSelectedTemplateId(template.id)}
                                >
                                  Select
                                </Button>
                                <Button
                                  className="flex-1 rounded-xl"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedTemplateId(template.id);
                                    activateMutation.mutate(template.id);
                                  }}
                                >
                                  Activate
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sections" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Sections
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedTemplate?.name ?? settings?.activeTemplate?.name ?? "No template selected"}
                      </p>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="rounded-xl">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Section
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 rounded-2xl p-2">
                        <div className="space-y-2">
                          {SECTION_TYPE_GROUPS.map((group) => (
                            <Collapsible
                              key={group.label}
                              open={openSectionGroups[group.label] ?? true}
                              onOpenChange={(open) =>
                                setOpenSectionGroups((prev) => ({ ...prev, [group.label]: open }))
                              }
                              className="rounded-xl border border-border/60 bg-card"
                            >
                              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left">
                                <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                  {group.label}
                                </span>
                                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {openSectionGroups[group.label] ?? true ? "Hide" : "Show"}
                                </span>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-1 px-2 pb-2">
                                {group.types.map((type) => (
                                  <Button
                                    key={type}
                                    variant="ghost"
                                    className="w-full justify-start rounded-xl"
                                    disabled={!effectiveTemplateId || addSectionMutation.isPending}
                                    onClick={() => addSectionMutation.mutate(type)}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {type}
                                  </Button>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className={cn(CANVAS_ELEVATED_PANEL_CLASS, "p-4")}>
                    <p className="text-sm text-muted-foreground">
                      The full section navigator and editor are shown in the workspace below, with the section list on the left and the selected section details on the right.
                    </p>
                  </div>

                </TabsContent>

                <TabsContent value="theme" className="mt-0 space-y-4">
                  <Card className={cn(CANVAS_ELEVATED_PANEL_CLASS, "rounded-2xl")}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Palette className="h-4 w-4" />
                        Storefront Fonts
                      </CardTitle>
                      <CardDescription>
                        Pick the default storefront font theme. The selected preset applies across all storefront pages and sections.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {STOREFRONT_FONT_OPTIONS.map((font) => (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => {
                            setPreviewFontPreset(font.id);
                            settingsMutation.mutate(font.id);
                          }}
                          className={`rounded-2xl border p-4 text-left transition-all ${
                            previewFontPreset === font.id
                              ? "border-sky-400 bg-sky-50/70 shadow-[0_8px_20px_rgba(56,189,248,0.16)] dark:bg-sky-950/25 dark:shadow-[0_12px_24px_rgba(14,116,144,0.25)]"
                              : "border-black/10 bg-white/80 hover:border-black/20 dark:border-white/[0.10] dark:bg-white/[0.03] dark:hover:border-white/20"
                          }`}
                          disabled={settingsMutation.isPending}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold">{font.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{font.description}</p>
                            </div>
                            {previewFontPreset === font.id ? (
                              <Badge className="bg-sky-600 hover:bg-sky-600">
                                {settingsMutation.isPending ? "Saving" : "Active"}
                              </Badge>
                            ) : null}
                          </div>
                          <div
                            className="mt-4 rounded-xl border border-black/10 bg-white/85 p-4 text-left dark:border-white/[0.10] dark:bg-black/20"
                            style={{ fontFamily: STOREFRONT_FONT_FAMILIES[font.id].preview }}
                          >
                            <p className="text-xl font-semibold text-foreground">Rare Atelier</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Editorial storefront typography preview.
                            </p>
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
        {activeTab === "sections" ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Card className={CANVAS_ELEVATED_CARD_CLASS}>
                <CardHeader>
                  <CardTitle>Section Workspace</CardTitle>
                  <CardDescription>
                    Manage the sections for {selectedTemplate?.name ?? settings?.activeTemplate?.name ?? "the selected template"}.
                    Choose a section on the left, then edit its details on the right.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sortedSections.map((section, index) => (
                    <div
                      key={section.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onClick={() => setSelectedSectionId(section.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedSectionId(section.id);
                        }
                      }}
                      onDragStart={() => setDraggedSectionId(section.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (!draggedSectionId || draggedSectionId === section.id) return;
                        reorderSectionsMutation.mutate({ sourceId: draggedSectionId, targetId: section.id });
                        setDraggedSectionId(null);
                      }}
                      onDragEnd={() => setDraggedSectionId(null)}
                      className={`w-full rounded-2xl p-3 text-left transition-all ${
                        selectedSection?.id === section.id
                          ? "border border-sky-400 bg-sky-50/70 shadow-[0_10px_22px_rgba(14,165,233,0.16)] dark:bg-sky-950/25 dark:shadow-[0_14px_28px_rgba(2,132,199,0.2)]"
                          : `${CANVAS_ELEVATED_PANEL_CLASS} hover:border-black/20 dark:hover:border-white/20`
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1 space-y-3">
                          {renderSectionMiniPreview(section)}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {section.label ?? section.sectionType}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {section.sectionType}
                                </Badge>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  #{section.orderIndex}
                                </span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  {section.isVisible ? "Visible" : "Hidden"}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-xl"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                                  <DropdownMenuLabel>Section Actions</DropdownMenuLabel>
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedSectionId(section.id);
                                    }}
                                  >
                                    Edit section
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      sectionMutation.mutate({
                                        sectionId: section.id,
                                        payload: { isVisible: !section.isVisible },
                                      });
                                    }}
                                  >
                                    {section.isVisible ? (
                                      <>
                                        <EyeOff className="mr-2 h-4 w-4" />
                                        Hide section
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Show section
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={index === 0}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleMoveSection(section, -1);
                                    }}
                                  >
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    Move up
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={index === sortedSections.length - 1}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleMoveSection(section, 1);
                                    }}
                                  >
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    Move down
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      duplicateSectionMutation.mutate(section.id);
                                    }}
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                                      Move to template
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-56 rounded-xl">
                                      {templatesForMove.length ? (
                                        templatesForMove.map((template) => (
                                          <DropdownMenuItem
                                            key={template.id}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              moveSectionTemplateMutation.mutate({
                                                sectionId: section.id,
                                                templateId: template.id,
                                              });
                                            }}
                                          >
                                            {template.name}
                                          </DropdownMenuItem>
                                        ))
                                      ) : (
                                        <DropdownMenuItem disabled>No other templates</DropdownMenuItem>
                                      )}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteSectionMutation.mutate(section.id);
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-6">
              {selectedSection ? (
                <>
                <Card className={CANVAS_ELEVATED_CARD_CLASS}>
                  <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-3">
                      <div>
                        <CardTitle className="text-lg">
                          {selectedSection.label ?? selectedSection.sectionType}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Section details and controls for the live storefront layout.
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          variant="outline"
                          className="rounded-full border-[rgba(201,169,110,0.35)] bg-[rgba(201,169,110,0.12)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[rgba(201,169,110,0.9)]"
                        >
                          {selectedSection.sectionType}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/60 bg-background/70 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-foreground/70"
                        >
                          Position #{selectedSection.orderIndex}
                        </Badge>
                        <Badge
                          variant={selectedSection.isVisible ? "secondary" : "outline"}
                          className={cn(
                            "rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em]",
                            selectedSection.isVisible
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                              : "text-muted-foreground",
                          )}
                        >
                          {selectedSection.isVisible ? "Live" : "Hidden"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() =>
                          sectionMutation.mutate({
                            sectionId: selectedSection.id,
                            payload: { isVisible: !selectedSection.isVisible },
                          })
                        }
                      >
                        {selectedSection.isVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        {selectedSection.isVisible ? "Hide" : "Show"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={sortedSections[0]?.id === selectedSection.id}
                        onClick={() => handleMoveSection(selectedSection, -1)}
                      >
                        <ArrowUp className="mr-2 h-4 w-4" />
                        Move Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={sortedSections[sortedSections.length - 1]?.id === selectedSection.id}
                        onClick={() => handleMoveSection(selectedSection, 1)}
                      >
                        <ArrowDown className="mr-2 h-4 w-4" />
                        Move Down
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-xl"
                        disabled={deleteSectionMutation.isPending}
                        onClick={() => deleteSectionMutation.mutate(selectedSection.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                      <div className={cn(CANVAS_ELEVATED_PANEL_CLASS, "p-4")}>
                        <div className="mx-auto max-w-xl">
                          {renderSectionMiniPreview(selectedSection)}
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <div className="rounded-2xl border border-black/10 bg-background/60 p-4 dark:border-white/[0.10]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Visibility</p>
                          <p className="mt-2 text-sm font-semibold">{selectedSection.isVisible ? "Visible" : "Hidden"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Toggles whether this section appears on the live homepage.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-black/10 bg-background/60 p-4 dark:border-white/[0.10]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Order</p>
                          <p className="mt-2 text-sm font-semibold">#{selectedSection.orderIndex}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Lower numbers render earlier in the page flow.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-black/10 bg-background/60 p-4 dark:border-white/[0.10]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Type</p>
                          <p className="mt-2 text-sm font-semibold">{selectedSection.sectionType}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Determines which editor controls appear below.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-xs text-muted-foreground">
                      This panel updates section data. The Templates tab is still the full live preview.
                    </div>
                  </CardContent>
                </Card>

                <Card className={CANVAS_ELEVATED_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{sectionEditorTitle}</CardTitle>
                    <CardDescription>
                      Use the structured controls for common edits first. Advanced JSON is still available below for anything custom.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sectionPresets.length ? (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Quick Presets</label>
                        <div className="flex flex-wrap gap-2">
                          {sectionPresets.map((preset) => (
                            <Button
                              key={preset.id}
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => applySectionPreset(preset)}
                            >
                              {preset.label}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            className="rounded-xl text-muted-foreground"
                            onClick={resetSectionDraft}
                          >
                            Reset to defaults
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-xl text-muted-foreground"
                          onClick={resetSectionDraft}
                        >
                          Reset to defaults
                        </Button>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Label</label>
                        <Input
                          value={sectionDraft.label}
                          onChange={(event) => setSectionDraft((prev) => ({ ...prev, label: event.target.value }))}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Variant</label>
                        <Input
                          value={sectionDraft.variant}
                          onChange={(event) => setSectionDraft((prev) => ({ ...prev, variant: event.target.value }))}
                          className="rounded-xl"
                          placeholder="Optional visual variant"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Section Image</label>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Use this as the section’s visual cover in Canvas now, and as a reusable image field for future section layouts.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setMediaPickerTarget({ type: "section" })}
                        >
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Choose Image
                        </Button>
                      </div>
                      {sectionDraft.image ? (
                        <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                          <img
                            src={sectionDraft.image}
                            alt={sectionDraft.label || selectedSection.sectionType}
                            className="h-40 w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <Input
                        value={sectionDraft.image}
                        onChange={(event) => setSectionDraft((prev) => ({ ...prev, image: event.target.value }))}
                        placeholder="Optional image URL"
                        className="rounded-xl"
                      />
                    </div>

                    {selectedSection.sectionType === "hero" ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Slides</label>
                          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addHeroSlide}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Slide
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {(parsedHeroSlides.length
                            ? parsedHeroSlides
                            : DEFAULT_MAISON_HERO_SLIDE_DRAFTS).map((slide, index) => (
                            <Card key={`hero-slide-${index}`} className="rounded-2xl border-border/60">
                              <CardContent
                                className="space-y-3 p-4"
                                draggable
                                onDragStart={() => setDraggedHeroSlideIndex(index)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                  if (draggedHeroSlideIndex == null || draggedHeroSlideIndex === index) return;
                                  reorderHeroSlides(draggedHeroSlideIndex, index);
                                  setDraggedHeroSlideIndex(null);
                                }}
                                onDragEnd={() => setDraggedHeroSlideIndex(null)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Slide {index + 1}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setMediaPickerTarget({ type: "hero", index })}>
                                      <ImageIcon className="mr-2 h-4 w-4" />
                                      Choose Image
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => removeHeroSlide(index)}>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                                {slide.image ? (
                                  <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                                    <img src={slide.image} alt={slide.headline || `Slide ${index + 1}`} className="h-32 w-full object-cover" />
                                  </div>
                                ) : null}
                                <div className="grid gap-3 md:grid-cols-2">
                                  <Input value={slide.tag} onChange={(event) => updateHeroSlideField(index, "tag", event.target.value)} placeholder="Tag" className="rounded-xl" />
                                  <Input value={slide.headline} onChange={(event) => updateHeroSlideField(index, "headline", event.target.value)} placeholder="Headline" className="rounded-xl" />
                                </div>
                                <Input value={slide.eyebrow} onChange={(event) => updateHeroSlideField(index, "eyebrow", event.target.value)} placeholder="Eyebrow" className="rounded-xl" />
                                <Textarea value={slide.body} onChange={(event) => updateHeroSlideField(index, "body", event.target.value)} placeholder="Body" className="min-h-20 rounded-xl" />
                                <div className="grid gap-3 md:grid-cols-2">
                                  <Input value={slide.ctaLabel} onChange={(event) => updateHeroSlideField(index, "ctaLabel", event.target.value)} placeholder="CTA label" className="rounded-xl" />
                                  <Input value={slide.ctaHref} onChange={(event) => updateHeroSlideField(index, "ctaHref", event.target.value)} placeholder="CTA href" className="rounded-xl" />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <Input value={slide.image} onChange={(event) => updateHeroSlideField(index, "image", event.target.value)} placeholder="Image URL" className="rounded-xl" />
                                  <Input value={slide.duration} onChange={(event) => updateHeroSlideField(index, "duration", event.target.value)} placeholder="Duration ms (e.g. 6000)" className="rounded-xl" />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            value={sectionDraft.secondaryCtaLabel}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, secondaryCtaLabel: event.target.value }))}
                            className="rounded-xl"
                            placeholder="Secondary CTA label"
                          />
                          <Input
                            value={sectionDraft.secondaryCtaHref}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, secondaryCtaHref: event.target.value }))}
                            className="rounded-xl"
                            placeholder="Secondary CTA href"
                          />
                        </div>
                      </div>
                    ) : null}

                    {selectedSection.sectionType === "ticker" ? (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Ticker Items</label>
                        <Textarea
                          value={sectionDraft.items}
                          onChange={(event) => setSectionDraft((prev) => ({ ...prev, items: event.target.value }))}
                          className="min-h-24 rounded-xl"
                          placeholder="One item per line"
                        />
                      </div>
                    ) : null}

                    {selectedSection.sectionType === "quote" ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Statement Text</label>
                          <Textarea
                            value={sectionDraft.text}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, text: event.target.value }))}
                            className="min-h-24 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Attribution</label>
                          <Input
                            value={sectionDraft.attribution}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, attribution: event.target.value }))}
                            className="rounded-xl"
                          />
                        </div>
                      </>
                    ) : null}

                    {selectedSection.sectionType === "featured" ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Section Title</label>
                          <Input
                            value={sectionDraft.title}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, title: event.target.value }))}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Hint Text</label>
                          <Input
                            value={sectionDraft.hint}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, hint: event.target.value }))}
                            className="rounded-xl"
                            placeholder="Drag to explore →"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Featured Product IDs</label>
                          <Textarea
                            value={sectionDraft.productIds}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, productIds: event.target.value }))}
                            className="min-h-24 rounded-xl font-mono text-xs"
                            placeholder="Comma-separated product ids"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Pick Featured Products</label>
                          {selectedProductIds.length ? (
                            <div className="grid gap-2 md:grid-cols-3">
                              {productOptions
                                .filter((product) => selectedProductIds.includes(String(product.id)))
                                .sort(
                                  (a, b) =>
                                    selectedProductIds.indexOf(String(a.id)) -
                                    selectedProductIds.indexOf(String(b.id)),
                                )
                                .slice(0, 6)
                                .map((product, index, orderedProducts) => (
                                  <div key={`featured-selected-${product.id}`} className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted/30">
                                      {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                                      ) : null}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold">{product.name}</p>
                                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                        Featured preview
                                      </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg"
                                        disabled={index === 0}
                                        onClick={() => reorderDraftProducts(index, index - 1)}
                                      >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg"
                                        disabled={index === orderedProducts.length - 1}
                                        onClick={() => reorderDraftProducts(index, index + 1)}
                                      >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : null}
                          <div className="grid max-h-72 gap-2 overflow-auto rounded-2xl border border-border/60 p-2 md:grid-cols-2">
                            {productOptions.map((product) => {
                              const isSelected = selectedProductIds.includes(String(product.id));
                              return (
                                <button
                                  key={`featured-picker-${product.id}`}
                                  type="button"
                                  onClick={() => toggleDraftProduct(String(product.id))}
                                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                    isSelected
                                      ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20"
                                      : "border-border/60 bg-card hover:border-border"
                                  }`}
                                >
                                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted/30">
                                    {product.imageUrl ? (
                                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{product.name}</p>
                                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                      {product.id}
                                    </p>
                                  </div>
                                  {isSelected ? <Badge className="bg-amber-600 hover:bg-amber-600">Added</Badge> : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : null}

                    {selectedSection.sectionType === "campaign" ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Eyebrow</label>
                            <Input
                              value={sectionDraft.eyebrow}
                              onChange={(event) => setSectionDraft((prev) => ({ ...prev, eyebrow: event.target.value }))}
                              className="rounded-xl"
                              placeholder="Editorial / Lookbook"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Layout Preset</label>
                            <div className="grid grid-cols-3 gap-2">
                              {["editorial", "balanced", "stacked"].map((preset) => (
                                <Button
                                  key={preset}
                                  type="button"
                                  variant={sectionDraft.layoutPreset === preset ? "default" : "outline"}
                                  className="rounded-xl"
                                  onClick={() => setSectionDraft((prev) => ({ ...prev, layoutPreset: preset }))}
                                >
                                  {preset}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Grid Title</label>
                          <Input
                            value={sectionDraft.title}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, title: event.target.value }))}
                            className="rounded-xl"
                            placeholder="Optional title"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Supporting Text</label>
                          <Textarea
                            value={sectionDraft.text}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, text: event.target.value }))}
                            className="min-h-24 rounded-xl"
                            placeholder="Optional supporting copy"
                          />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            value={sectionDraft.ctaLabel}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, ctaLabel: event.target.value }))}
                            className="rounded-xl"
                            placeholder="CTA label"
                          />
                          <Input
                            value={sectionDraft.ctaHref}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, ctaHref: event.target.value }))}
                            className="rounded-xl"
                            placeholder="CTA href"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Grid Images</label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={addCampaignImageAndPick}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Image
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Add an image and pick from the media library in one step. The preview updates instantly.
                          </p>
                          {(parsedCampaignImages.length ? parsedCampaignImages : [{ index: "", label: "", image: "" }]).map((item, index) => (
                            <Card key={`campaign-image-${index}`} className="rounded-2xl border-border/60">
                              <CardContent
                                className="space-y-3 p-4"
                                draggable
                                onDragStart={() => setDraggedCampaignImageIndex(index)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                  if (draggedCampaignImageIndex == null || draggedCampaignImageIndex === index) return;
                                  reorderCampaignImages(draggedCampaignImageIndex, index);
                                  setDraggedCampaignImageIndex(null);
                                }}
                                onDragEnd={() => setDraggedCampaignImageIndex(null)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Grid Item {index + 1}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setMediaPickerTarget({ type: "campaign", index })}>
                                      <ImageIcon className="mr-2 h-4 w-4" />
                                      Choose Image
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => removeCampaignImage(index)}>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                                {item.image ? (
                                  <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                                    <img src={item.image} alt={item.label || `Grid item ${index + 1}`} className="h-32 w-full object-cover" />
                                  </div>
                                ) : null}
                                <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                                  <Input value={item.index} onChange={(event) => updateCampaignImageField(index, "index", event.target.value)} placeholder="01" className="rounded-xl" />
                                  <Input value={item.label} onChange={(event) => updateCampaignImageField(index, "label", event.target.value)} placeholder="Label" className="rounded-xl" />
                                </div>
                                <Input value={item.image} onChange={(event) => updateCampaignImageField(index, "image", event.target.value)} placeholder="Image URL" className="rounded-xl" />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {selectedSection.sectionType === "arrivals" || selectedSection.sectionType === "services" || selectedSection.sectionType === "faq" ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Title</label>
                          <Input
                            value={sectionDraft.title}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, title: event.target.value }))}
                            className="rounded-xl"
                            placeholder="Optional title override"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Text</label>
                          <Textarea
                            value={sectionDraft.text}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, text: event.target.value }))}
                            className="min-h-24 rounded-xl"
                            placeholder="Optional supporting copy"
                          />
                        </div>
                        {selectedSection.sectionType === "services" ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Service Cards</label>
                              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addServiceCard}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Card
                              </Button>
                            </div>
                            {(parsedServiceCards.length
                              ? parsedServiceCards
                              : [{
                                  title: "Fast Delivery",
                                  text: "Nationwide door-to-door shipping.",
                                  buttonLabel: "Shop Now",
                                  target: "/shop",
                                }]).map((card, index, serviceCardList) => (
                              <Card key={`service-card-${index}`} className="rounded-2xl border-border/60">
                                <CardContent className="space-y-3 p-4">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                      Service Card {index + 1}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-xl"
                                        disabled={index === 0}
                                        onClick={() => reorderServiceCards(index, index - 1)}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-xl"
                                        disabled={index === serviceCardList.length - 1}
                                        onClick={() => reorderServiceCards(index, index + 1)}
                                      >
                                        <ArrowDown className="h-4 w-4" />
                                      </Button>
                                      <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => removeServiceCard(index)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remove
                                      </Button>
                                    </div>
                                  </div>
                                  <Input
                                    value={card.title}
                                    onChange={(event) => updateServiceCardField(index, "title", event.target.value)}
                                    placeholder="Card title"
                                    className="rounded-xl"
                                  />
                                  <Textarea
                                    value={card.text}
                                    onChange={(event) => updateServiceCardField(index, "text", event.target.value)}
                                    placeholder="Card description"
                                    className="min-h-20 rounded-xl"
                                  />
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <Input
                                      value={card.buttonLabel}
                                      onChange={(event) => updateServiceCardField(index, "buttonLabel", event.target.value)}
                                      placeholder="Button label"
                                      className="rounded-xl"
                                    />
                                    <Input
                                      value={card.target}
                                      onChange={(event) => updateServiceCardField(index, "target", event.target.value)}
                                      placeholder="/shop or atelier-contact"
                                      className="rounded-xl"
                                    />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : null}
                        {selectedSection.sectionType === "faq" ? (
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                              FAQ Items
                            </label>
                            <Textarea
                              value={sectionDraft.items}
                              onChange={(event) => setSectionDraft((prev) => ({ ...prev, items: event.target.value }))}
                              className="min-h-32 rounded-xl font-mono text-xs"
                              placeholder="Question | Answer (one per line)"
                            />
                            <p className="text-xs text-muted-foreground">
                              Format: <span className="font-mono">Question | Answer</span>
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {selectedSection.sectionType === "fresh-release" ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Section Title</label>
                            <Input
                              value={sectionDraft.title}
                              onChange={(event) => setSectionDraft((prev) => ({ ...prev, title: event.target.value }))}
                              className="rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Desktop Columns</label>
                            <Input
                              value={sectionDraft.columns}
                              onChange={(event) => setSectionDraft((prev) => ({ ...prev, columns: event.target.value }))}
                              className="rounded-xl"
                              placeholder="4"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Intro Text</label>
                          <Textarea
                            value={sectionDraft.text}
                            onChange={(event) => setSectionDraft((prev) => ({ ...prev, text: event.target.value }))}
                            className="min-h-24 rounded-xl"
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Selected Product IDs</label>
                            <Textarea
                              value={sectionDraft.productIds}
                              onChange={(event) => setSectionDraft((prev) => ({ ...prev, productIds: event.target.value }))}
                              className="min-h-24 rounded-xl font-mono text-xs"
                              placeholder="Comma-separated product ids"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Pick Products</label>
                          {selectedProductIds.length ? (
                            <div className="grid gap-2 md:grid-cols-2">
                              {productOptions
                                .filter((product) => selectedProductIds.includes(String(product.id)))
                                .map((product) => (
                                  <div key={`selected-${product.id}`} className="flex items-center gap-3 rounded-xl border border-sky-300 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/20">
                                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted/30">
                                      {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                                      ) : null}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold">{product.name}</p>
                                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                        Selected for preview
                                      </p>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : null}
                          <div className="grid max-h-72 gap-2 overflow-auto rounded-2xl border border-border/60 p-2 md:grid-cols-2">
                            {productOptions.map((product) => {
                              const isSelected = selectedProductIds.includes(String(product.id));
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => toggleDraftProduct(String(product.id))}
                                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                    isSelected
                                      ? "border-sky-400 bg-sky-50/60 dark:bg-sky-950/20"
                                      : "border-border/60 bg-card hover:border-border"
                                  }`}
                                >
                                  <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted/30">
                                    {product.imageUrl ? (
                                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{product.name}</p>
                                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                      {product.id}
                                    </p>
                                  </div>
                                  {isSelected ? <Badge className="bg-sky-600 hover:bg-sky-600">Added</Badge> : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : null}

                    <Separator />

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Advanced Config JSON</label>
                      <Textarea
                        value={sectionDraft.rawConfig}
                        onChange={(event) => setSectionDraft((prev) => ({ ...prev, rawConfig: event.target.value }))}
                        className="min-h-52 rounded-xl font-mono text-xs"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="rounded-xl"
                        onClick={handleSaveSectionDraft}
                        disabled={savingSectionId === selectedSection?.id}
                      >
                        {savingSectionId === selectedSection?.id ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Section"
                        )}
                      </Button>
                      <Button
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                        disabled={!effectiveTemplateId || activateMutation.isPending}
                        onClick={() => effectiveTemplateId && activateMutation.mutate(effectiveTemplateId)}
                      >
                        {activateMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Publishing
                          </>
                        ) : (
                          "Publish Site"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                </>
              ) : (
                <Card className={CANVAS_ELEVATED_CARD_CLASS}>
                  <CardContent className="p-8 text-sm text-muted-foreground">
                    Select a section from the left to edit it.
                  </CardContent>
                </Card>
              )}
              </div>
            </div>
          </>
        ) : activeTab === "theme" ? (
          <Card className={CANVAS_ELEVATED_CARD_CLASS}>
            <CardHeader>
              <CardTitle>Theme Controls</CardTitle>
              <CardDescription>
                The active font preset is applied globally across the storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className={cn(CANVAS_ELEVATED_PANEL_CLASS, "p-5")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Active Font Preset
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{selectedThemeFont.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedThemeFont.description}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Switching fonts updates the storefront theme for every public page and section, including navbar, footer, homepage, products, and checkout.
                </p>
              </div>
              <div className={cn(CANVAS_ELEVATED_PANEL_CLASS, "p-5")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Live Font Preview
                </p>
                <div
                  className="mt-3 rounded-xl border border-black/10 bg-white/85 p-4 dark:border-white/[0.10] dark:bg-black/25"
                  style={{ fontFamily: selectedThemeFontFamily }}
                >
                  <p className="text-2xl font-semibold text-foreground">The quick brown fox</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Jumps over the lazy dog. 0123456789
                  </p>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Live typography sample
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
        </div>
      </div>

      <Dialog
        open={!!mediaPickerTarget}
        onOpenChange={(open) => {
          if (!open) {
            setMediaPickerTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {mediaPickerTarget?.type === "hero"
                ? "Choose Hero Slide Image"
                : mediaPickerTarget?.type === "campaign"
                  ? "Choose Editorial Grid Image"
                  : "Choose Section Image"}
            </DialogTitle>
            <DialogDescription>
              Pick an image from the shared library or upload a new one from your device. New uploads are saved into the same media library for reuse across templates and sections. Maximum upload size: {MAX_CANVAS_IMAGE_UPLOAD_LABEL}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/10 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Media Source
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={mediaProvider === "local" ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setMediaProvider("local")}
                  >
                    Local Library
                  </Button>
                  <Button
                    type="button"
                    variant={mediaProvider === "cloudinary" ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setMediaProvider("cloudinary")}
                  >
                    Cloudinary
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="canvas-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    handleCanvasImageUploadSelection(file);
                    event.currentTarget.value = "";
                  }}
                />
                <label htmlFor="canvas-image-upload">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    asChild
                    disabled={uploadMediaMutation.isPending}
                  >
                    <span>
                      <Plus className="mr-2 h-4 w-4" />
                      {uploadMediaMutation.isPending ? "Uploading..." : "Upload from Device"}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
            {showUploadProgress && (
              <UploadProgress value={uploadProgress} label="Upload progress" className="max-w-none" />
            )}

            {mediaLoading ? (
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-8 text-sm text-muted-foreground">
                Loading media library...
              </div>
            ) : mediaOptions.length ? (
              <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {mediaOptions.filter((asset) => Boolean(asset.url)).map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => applyPickedImage(asset.url!)}
                    className="overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition-all hover:border-sky-400 hover:shadow-sm"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-muted/20">
                      <img
                        src={asset.url!}
                        alt={asset.filename ?? asset.publicId ?? "Library image"}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                      />
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {asset.filename ?? asset.publicId ?? "Untitled image"}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {asset.provider} · {asset.category}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                          Use
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {asset.width && asset.height ? <span>{asset.width} × {asset.height}</span> : null}
                        {asset.bytes ? <span>{Math.max(1, Math.round(asset.bytes / 1024))} KB</span> : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-sm text-muted-foreground">
                No images found in this library yet. Upload one from your device to start building reusable section imagery.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {(templatesLoading || settingsLoading || sectionsLoading) && (
        <p className="text-sm text-muted-foreground">Loading Canvas data…</p>
      )}
    </div>
  );
}
