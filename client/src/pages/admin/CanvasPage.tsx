import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { PageListSidebar } from "@/components/canvas/PageListSidebar";
import { CreatePageDialog } from "@/components/canvas/CreatePageDialog";
import { PageMetadataForm } from "@/components/canvas/PageMetadataForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FileText,
  Palette,
  Type,
  Home,
  Layout,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  GripVertical,
  Eye,
  EyeOff,
  Image,
  Upload,
  Settings,
  Plus,
  Check,
  Trash2,
  X,
  Loader2,
  Edit,
} from "lucide-react";
import {
  Label,
  Skeleton,
  OptimizedImage,
} from "@/components/ui";
import {
  matchesLogoPreset,
  STOREFRONT_BRANDING_QUERY_KEY,
  STOREFRONT_LOGO_PRESETS,
} from "@/lib/storefrontBranding";
import { STOREFRONT_FONT_OPTIONS, STOREFRONT_FONT_FAMILIES, type StorefrontFontPreset } from "@/lib/storefrontFonts";
import type { CanvasPage, SiteBranding, ColorPreset, CanvasTemplate } from "@/lib/adminApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCanvasPages, updateCanvasPage, reorderCanvasPages, getBranding, updateBranding, getColorPresets, createColorPreset, updateColorPreset, activateColorPreset, deleteColorPreset, uploadProductImageFile, getCanvasTemplates } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ActiveTab = "pages" | "templates" | "theme" | "branding" | "navigation";

const CUSTOMIZATION_TABS: Array<{
  id: ActiveTab;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    id: "pages",
    label: "Pages",
    description: "Edit full-page storefront layouts",
    icon: FileText,
  },
  {
    id: "templates",
    label: "Templates",
    description: "Start from Rare Atelier defaults",
    icon: Layout,
  },
  {
    id: "theme",
    label: "Theme",
    description: "Typography and presentation system",
    icon: Type,
  },
  {
    id: "branding",
    label: "Branding",
    description: "Logos, colors, and visual assets",
    icon: Palette,
  },
  {
    id: "navigation",
    label: "Navigation",
    description: "Header links and page ordering",
    icon: LinkIcon,
  },
];

export default function CanvasPage() {
  const [location] = useLocation();
  const { user } = useCurrentUser();
  const isSuperAdmin = user?.role?.toLowerCase() === "superadmin";
  const readTabFromUrl = (): ActiveTab => {
    if (typeof window === "undefined") return "pages";
    const params = new URLSearchParams(window.location.search);
    const value = params.get("tab");
    return CUSTOMIZATION_TABS.some((tab) => tab.id === value)
      ? (value as ActiveTab)
      : "pages";
  };
  const initialTab = useMemo<ActiveTab>(() => readTabFromUrl(), []);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCreateTemplate, setSelectedCreateTemplate] = useState<CanvasTemplate | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/admin/canvas/templates"],
    queryFn: getCanvasTemplates,
  });

  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["/api/admin/canvas/pages"],
    queryFn: getCanvasPages,
  });

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  );

  const canvasTabs = useMemo(
    () =>
      CUSTOMIZATION_TABS.filter((tab) => {
        if (tab.id === "branding" || tab.id === "theme") return false;
        if (!isSuperAdmin && (tab.id === "pages" || tab.id === "templates" || tab.id === "navigation")) return false;
        return true;
      }),
    [isSuperAdmin],
  );

  useEffect(() => {
    if (typeof window === "undefined" || isSuperAdmin) return;
    window.history.replaceState({}, "", "/admin/canvas/branding");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [isSuperAdmin]);

  useEffect(() => {
    const syncFromUrl = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      setActiveTab(readTabFromUrl());

      const nextPageId = Number(params.get("pageId"));
      if (params.get("tab") === "pages" && Number.isFinite(nextPageId) && nextPageId > 0) {
        setSelectedPageId(nextPageId);
        return;
      }

      if (params.get("panel") === "list" || params.get("tab") !== "pages") {
        setSelectedPageId(null);
      }
    };

    syncFromUrl();

    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("canvas-customization-nav", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("canvas-customization-nav", syncFromUrl);
    };
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    if (activeTab !== "pages") {
      params.delete("panel");
      params.delete("pageId");
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", nextUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new Event("canvas-customization-nav"));
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeTab === "branding") {
      window.history.replaceState({}, "", "/admin/canvas/branding");
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    if (activeTab === "theme") {
      window.history.replaceState({}, "", "/admin/canvas/theme");
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    if (!isSuperAdmin && (activeTab === "pages" || activeTab === "templates" || activeTab === "navigation")) {
      window.history.replaceState({}, "", "/admin/canvas/branding");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [activeTab, isSuperAdmin]);

  if (!isSuperAdmin) {
    return null;
  }

  function handlePageSelect(id: number) {
    setSelectedPageId(id);
    setActiveTab("pages");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "pages");
      params.set("panel", "details");
      params.set("pageId", String(id));
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", nextUrl);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new Event("canvas-customization-nav"));
    }
  }

  function handleOpenBuilder(id: number) {
    if (typeof window === "undefined") return;
    window.history.pushState({}, "", `/admin/canvas/builder?pageId=${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function handlePageCreated(id: number) {
    setSelectedPageId(id);
    setSelectedCreateTemplate(null);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "pages");
      params.set("panel", "details");
      params.set("pageId", String(id));
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", nextUrl);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new Event("canvas-customization-nav"));
    }
  }

  function handleDeletePage(_id: number) {
    if (selectedPageId === _id) {
      setSelectedPageId(null);
    }
  }

  function handlePreview(page: CanvasPage) {
    const slug = page.slug === "/" ? "" : page.slug;
    window.open(`/storefront${slug}`, "_blank");
  }

  const sidebarWidth = sidebarCollapsed ? "w-12" : "w-64";
  const activeTabMeta = canvasTabs.find((tab) => tab.id === activeTab);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div
        className={cn(
          "border-r bg-card/50 flex flex-col transition-all duration-300 shrink-0",
          sidebarWidth
        )}
      >
        {/* Collapse toggle */}
        <div className="flex items-center justify-between p-3 border-b">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Layout className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold tracking-wide">Canvas</span>
              <Badge variant="outline" className="text-[9px] font-bold text-muted-foreground">
                BETA
              </Badge>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 ml-auto"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Nav items */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-3">
              <div className="space-y-1.5">
                {canvasTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50 text-muted-foreground"
                      )}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{tab.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {tab.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* Collapsed icon nav */}
        {sidebarCollapsed && (
          <div className="flex-1 flex flex-col items-center gap-4 py-4">
            {canvasTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        )}
        </div>

      {activeTab === "pages" && (
        <>
          <div className="w-72 border-r bg-card/30 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-sm font-bold">Pages</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a page to manage or create a new one.
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <PageListSidebar
              selectedId={selectedPageId}
              onSelect={handlePageSelect}
              onCreatePage={() => setShowCreateDialog(true)}
              onDeletePage={handleDeletePage}
              onPreview={handlePreview}
            />
          </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#f7f8fc_0%,#eef3ff_100%)]">
            <div className="border-b border-black/10 bg-white/85 px-6 py-5 backdrop-blur-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#4565d0]">
                Page Studio
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Build pages from a focused canvas, not an inline preview.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Select a page, review its metadata here, then open the dedicated builder to add sections,
                preview changes, and shape the storefront live.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {pagesLoading ? (
                <div className="grid gap-4 lg:grid-cols-[1.6fr,1fr]">
                  <Skeleton className="h-[320px] w-full rounded-[32px]" />
                  <Skeleton className="h-[320px] w-full rounded-[32px]" />
                </div>
              ) : selectedPage ? (
                <div className="grid gap-6 lg:grid-cols-[1.65fr,1fr]">
                  <div className="rounded-[32px] border border-[#bfd1ff] bg-white p-8 shadow-[0_24px_60px_rgba(69,101,208,0.10)]">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-[#bfd1ff] bg-[#eef3ff] text-[#3654b1]">
                            {selectedPage.isHomepage ? "Homepage" : "Storefront Page"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "border-transparent",
                              selectedPage.status === "published"
                                ? "bg-emerald-500/10 text-emerald-700"
                                : "bg-slate-900/5 text-slate-600",
                            )}
                          >
                            {selectedPage.status === "published" ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <div>
                          <h3 className="text-3xl font-semibold tracking-tight text-slate-950">
                            {selectedPage.title}
                          </h3>
                          <p className="mt-2 font-mono text-sm text-slate-500">{selectedPage.slug}</p>
                        </div>
                        <p className="max-w-2xl text-sm leading-7 text-slate-600">
                          {selectedPage.description ||
                            "Open this page in the builder to add sections, refine composition, and preview the storefront layout without reloading the page."}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-[#d6e0ff] bg-[#f8fbff] px-5 py-4 text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Navigation
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          {selectedPage.showInNav ? "Shown in storefront nav" : "Hidden from nav"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Sort order {selectedPage.sortOrder}</p>
                      </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => handleOpenBuilder(selectedPage.id)}
                        className="rounded-[24px] border border-[#8fa8ff] bg-[#4565d0] px-5 py-5 text-left text-white shadow-[0_16px_36px_rgba(69,101,208,0.26)] transition-transform hover:-translate-y-0.5"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">Builder</p>
                        <p className="mt-3 text-xl font-semibold">Open visual builder</p>
                        <p className="mt-2 text-sm text-white/80">
                          Edit on a blank live canvas with section controls and instant rendering.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreview(selectedPage)}
                        className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-left transition-colors hover:border-[#bfd1ff] hover:bg-[#f8fbff]"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Preview</p>
                        <p className="mt-3 text-xl font-semibold text-slate-950">Open storefront page</p>
                        <p className="mt-2 text-sm text-slate-600">
                          Check the public page in a separate tab without exposing the builder UI.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMetadataForm(true)}
                        className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-left transition-colors hover:border-[#bfd1ff] hover:bg-[#f8fbff]"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Settings</p>
                        <p className="mt-3 text-xl font-semibold text-slate-950">Edit page metadata</p>
                        <p className="mt-2 text-sm text-slate-600">
                          Update title, slug, SEO details, and navigation visibility from one clean sheet.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-[#d6e0ff] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#4565d0]">
                        Builder Flow
                      </p>
                      <div className="mt-4 space-y-4 text-sm text-slate-600">
                        <div>
                          <p className="font-semibold text-slate-950">1. Open Builder</p>
                          <p className="mt-1">Jump into the dedicated page canvas instead of editing inside the list view.</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-950">2. Add Sections</p>
                          <p className="mt-1">Start from a blank white page and drop in hero, product, quote, services, and utility sections.</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-950">3. Refine Live</p>
                          <p className="mt-1">Click a section, adjust content, swap imagery, and watch the canvas update without a page reload.</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-dashed border-[#bfd1ff] bg-[#f8fbff] p-6">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                        Current Selection
                      </p>
                      <p className="mt-3 text-lg font-semibold text-slate-950">{selectedPage.title}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {selectedPage.seoTitle || "No custom SEO title set yet."}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-[#bfd1ff] bg-white text-[#3654b1]">
                          {selectedPage.isHomepage ? "Pinned Home" : "Secondary Page"}
                        </Badge>
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                          {selectedPage.showInNav ? "Navigation On" : "Navigation Off"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="max-w-xl rounded-[32px] border border-dashed border-[#bfd1ff] bg-white px-10 py-14 text-center shadow-[0_24px_60px_rgba(69,101,208,0.08)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#4565d0]">
                      Page Studio
                    </p>
                    <h3 className="mt-4 text-3xl font-semibold text-slate-950">
                      Pick a page to manage, then open the dedicated builder.
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      The live preview no longer takes over this screen. Use this area for page selection and
                      settings, then step into the builder only when you want to design the canvas.
                    </p>
                    <Button className="mt-8" onClick={() => setShowCreateDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Blank Page
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab !== "pages" ? (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b bg-card/40 px-6 py-5">
            <h2 className="text-lg font-semibold">{activeTabMeta?.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{activeTabMeta?.description}</p>
          </div>

          {activeTab === "templates" ? (
            <TemplatesPanel
              templates={templates}
              isLoading={templatesLoading}
              onUseTemplate={(template) => {
                setSelectedCreateTemplate(template);
                setShowCreateDialog(true);
              }}
            />
          ) : null}

          {activeTab === "navigation" ? <NavigationManager /> : null}
        </div>
      ) : null}

      {/* Create Page Dialog */}
      <CreatePageDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setSelectedCreateTemplate(null);
        }}
        onSuccess={handlePageCreated}
        templateId={selectedCreateTemplate?.id ?? null}
        templateName={selectedCreateTemplate?.name ?? null}
      />

      {selectedPage ? (
        <PageMetadataForm
          page={selectedPage}
          open={showMetadataForm}
          onOpenChange={setShowMetadataForm}
        />
      ) : null}
    </div>
  );
}

function TemplatesPanel({
  templates,
  isLoading,
  onUseTemplate,
}: {
  templates: CanvasTemplate[];
  isLoading: boolean;
  onUseTemplate: (template: CanvasTemplate) => void;
}) {
  const featuredTemplates = useMemo(
    () =>
      templates.filter(
        (template) => template.slug === "maison-nocturne" || template.slug === "editorial-grid",
      ),
    [templates],
  );

  const orderedTemplates = useMemo(() => {
    const order = ["maison-nocturne", "editorial-grid"];
    return featuredTemplates.slice().sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  }, [featuredTemplates]);

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-[28px]" />
          <Skeleton className="h-80 w-full rounded-[28px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Rare Atelier Templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start new pages from the two default Rare Atelier layouts carried over from Canvas Beta.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {orderedTemplates.map((template) => {
            const isPremium = template.slug === "maison-nocturne";
            return (
              <div
                key={template.id}
                className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101012] text-white shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
              >
                <div
                  className={cn(
                    "relative h-56 overflow-hidden",
                    isPremium
                      ? "bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.24),transparent_34%),linear-gradient(135deg,#15110d_0%,#0b0b0d_100%)]"
                      : "bg-[linear-gradient(135deg,#1d1c22_0%,#0e0e11_100%)]",
                  )}
                >
                  <div className="absolute inset-0 opacity-80">
                    <div className="absolute left-8 top-8">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d4b460]">
                        {isPremium ? "Premium" : "Free"}
                      </p>
                      <h3 className="mt-4 font-serif text-3xl text-white">{template.name}</h3>
                      <p className="mt-2 max-w-xs text-sm text-white/60">
                        {template.description ?? "Rare Atelier storefront template"}
                      </p>
                    </div>
                    <div className="absolute bottom-8 right-8 grid w-40 gap-2">
                      <div className="h-16 rounded-2xl border border-white/10 bg-white/[0.05]" />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-20 rounded-2xl border border-white/10 bg-white/[0.05]" />
                        <div className="h-20 rounded-2xl border border-white/10 bg-white/[0.08]" />
                        <div className="h-20 rounded-2xl border border-white/10 bg-white/[0.05]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-white/10 bg-white/[0.04] uppercase tracking-[0.18em]",
                        isPremium ? "text-[#d4b460]" : "text-white/70",
                      )}
                    >
                      {isPremium ? "Rare Atelier Official" : "Rare Atelier Draft"}
                    </Badge>
                    {isPremium ? (
                      <Badge className="bg-[#c9a84c] text-black hover:bg-[#c9a84c]">PREMIUM</Badge>
                    ) : (
                      <Badge variant="secondary">FREE</Badge>
                    )}
                  </div>

                  <p className="text-sm text-white/68">
                    {isPremium
                      ? "Cinematic editorial layout with the polished Rare Atelier storefront direction."
                      : "Draft-friendly magazine layout for experimenting with collections, copy, and section structure."}
                  </p>

                  <Button
                    onClick={() => onUseTemplate(template)}
                    className="w-full bg-[#c9a84c] text-black hover:bg-[#d8b865]"
                  >
                    Use Template For New Page
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TypographyManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branding, isLoading } = useQuery({
    queryKey: ["/api/admin/canvas/branding"],
    queryFn: getBranding,
  });

  const updateBrandingMutation = useMutation({
    mutationFn: (data: Partial<SiteBranding>) => updateBranding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/branding"] });
      toast({ title: "Font updated", description: "Typography preset has been applied." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update font.", variant: "destructive" });
    },
  });

  const currentFont = (branding?.fontPreset || "inter") as StorefrontFontPreset;

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Type className="h-5 w-5" />
            Typography
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a font preset for your storefront.
          </p>
        </div>

        <div className="grid gap-3">
          {STOREFRONT_FONT_OPTIONS.map((option) => {
            const families = STOREFRONT_FONT_FAMILIES[option.id as StorefrontFontPreset];
            const isActive = currentFont === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => updateBrandingMutation.mutate({ fontPreset: option.id })}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-lg border text-left transition-colors",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-muted/50 hover:border-muted/100 hover:bg-muted/30"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ fontFamily: families.preview }}>
                      {option.label}
                    </p>
                    {isActive && (
                      <Badge variant="default" className="text-[9px] px-1.5 py-0">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                </div>
                <div className="text-2xl font-bold text-muted-foreground/20" style={{ fontFamily: families.preview }}>
                  Aa
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 rounded-lg border bg-muted/30">
          <p className="text-xs text-muted-foreground mb-3">Preview</p>
          <p className="text-xl font-semibold mb-2" style={{ fontFamily: STOREFRONT_FONT_FAMILIES[currentFont].display }}>
            The quick brown fox
          </p>
          <p className="text-sm" style={{ fontFamily: STOREFRONT_FONT_FAMILIES[currentFont].body }}>
            jumps over the lazy dog. 0123456789.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => updateBrandingMutation.mutate({ fontPreset: "inter" })}
          disabled={currentFont === "inter"}
        >
          Reset to default
        </Button>
      </div>
    </div>
  );
}

export function BrandingManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [showLogoDarkDialog, setShowLogoDarkDialog] = useState(false);
  const [showFaviconDialog, setShowFaviconDialog] = useState(false);
  const [showFooterDialog, setShowFooterDialog] = useState(false);
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ColorPreset | null>(null);

  const { data: branding, isLoading: brandingLoading } = useQuery({
    queryKey: ["/api/admin/canvas/branding"],
    queryFn: getBranding,
  });

  const { data: colorPresets, isLoading: presetsLoading } = useQuery({
    queryKey: ["/api/admin/canvas/colors"],
    queryFn: getColorPresets,
  });

  const [activePresetId, setActivePresetId] = useState<number | null>(null);

  const updateBrandingMutation = useMutation({
    mutationFn: (data: Partial<SiteBranding>) => updateBranding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/branding"] });
      queryClient.invalidateQueries({ queryKey: STOREFRONT_BRANDING_QUERY_KEY });
      toast({ title: "Branding saved", description: "Branding settings updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save branding.", variant: "destructive" });
    },
  });

  const createPresetMutation = useMutation({
    mutationFn: (data: Partial<ColorPreset>) => createColorPreset(data),
    onSuccess: (preset) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/colors"] });
      setActivePresetId(preset.id);
      toast({ title: "Color preset created", description: `"${preset.presetName}" has been created.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create color preset.", variant: "destructive" });
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ColorPreset> }) => updateColorPreset(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/colors"] });
      toast({ title: "Color preset updated", description: "Color preset has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update color preset.", variant: "destructive" });
    },
  });

  const activatePresetMutation = useMutation({
    mutationFn: (id: number) => activateColorPreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/colors"] });
      toast({ title: "Color preset activated", description: "Color preset is now active." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to activate color preset.", variant: "destructive" });
    },
  });

  const deletePresetMutation = useMutation({
    mutationFn: (id: number) => deleteColorPreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/colors"] });
      toast({ title: "Color preset deleted", description: "Color preset has been removed." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete color preset.", variant: "destructive" });
    },
  });

  const applyLogoPreset = (presetId: string) => {
    const preset = STOREFRONT_LOGO_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    updateBrandingMutation.mutate({
      logoUrl: preset.logoUrl,
      logoDarkUrl: preset.logoDarkUrl ?? preset.logoUrl,
    });
  };

  if (brandingLoading || presetsLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        {/* Logo & Favicon Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Image className="h-5 w-5" />
            Logo & Favicon
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your brand logo (light and dark versions) and favicon.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Logo Light Upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                Logo (Light Mode)
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLogoDialog(true)}
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </Button>
              </Label>
              {branding?.logoUrl ? (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Current logo:</p>
                  <OptimizedImage
                    src={branding.logoUrl}
                    alt="Brand logo"
                    className="h-16 w-auto rounded border border-muted/50"
                    priority
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No logo uploaded</p>
              )}
            </div>

            {/* Favicon Upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                Favicon
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFaviconDialog(true)}
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </Button>
              </Label>
              {branding?.faviconUrl ? (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Current favicon:</p>
                  <OptimizedImage
                    src={branding.faviconUrl}
                    alt="Favicon"
                    className="h-8 w-8 rounded"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No favicon uploaded</p>
              )}
            </div>

            {/* Logo Dark Upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                Logo (Dark Mode)
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLogoDarkDialog(true)}
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </Button>
              </Label>
              {branding?.logoDarkUrl ? (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">Current dark logo:</p>
                  <OptimizedImage
                    src={branding.logoDarkUrl}
                    alt="Brand logo dark"
                    className="h-16 w-auto rounded border border-muted/50"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No dark logo uploaded</p>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <h4 className="text-sm font-semibold">Preset Logos</h4>
              <p className="text-xs text-muted-foreground">
                Apply one of the previous storefront logos instantly, or upload a new one above.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {STOREFRONT_LOGO_PRESETS.map((preset) => {
                const isActive = matchesLogoPreset(branding, preset);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyLogoPreset(preset.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-muted/60 hover:border-muted hover:bg-muted/20",
                    )}
                  >
                    <div
                      className="flex min-h-[8.5rem] items-center justify-center rounded-lg border border-muted/50 p-4"
                      style={{ background: preset.previewBackground ?? "#ffffff" }}
                    >
                      <img
                        src={preset.logoUrl}
                        alt={preset.label}
                        className={cn("h-auto w-auto max-w-full object-contain", preset.previewClassName ?? "max-h-14")}
                      />
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{preset.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                      </div>
                      {isActive ? (
                        <Badge variant="default" className="shrink-0 text-[9px] uppercase tracking-[0.18em]">
                          <Check className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Color Presets Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Schemes
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create and manage color presets for your brand.
          </p>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingPreset(null);
                  setShowColorDialog(true);
                }}
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Create New Preset
              </Button>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                {colorPresets?.length || 0} presets
              </Badge>
            </div>

            <div className="mt-4">
              {colorPresets && colorPresets.length > 0 ? (
                <div className="space-y-2">
                  {colorPresets.map((preset) => (
                    <ColorPresetItem
                      key={preset.id}
                      preset={preset}
                      isActive={activePresetId === preset.id}
                      onActivate={() => activatePresetMutation.mutate(preset.id)}
                      onEdit={() => {
                        setEditingPreset(preset);
                        setShowColorDialog(true);
                      }}
                      onDelete={() => deletePresetMutation.mutate(preset.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No color presets created yet. Create your first preset to get started.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Footer Settings
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Customize your storefront footer.
          </p>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              Footer Logo
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFooterDialog(true)}
              >
                <Upload className="h-3 w-3" />
                Upload
              </Button>
            </Label>
            {branding?.footerLogoUrl ? (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Current footer logo:</p>
                <OptimizedImage
                  src={branding.footerLogoUrl}
                  alt="Footer logo"
                  className="h-12 w-auto rounded border border-muted/50"
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No footer logo uploaded</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Footer Text</Label>
            <Input
              placeholder="© 2026 Rare Atelier. All rights reserved."
              defaultValue={branding?.footerText || ""}
              onChange={(e) => {
                updateBrandingMutation.mutate({ footerText: e.target.value });
              }}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Upload Dialogs */}
      <ImageUploadDialog
        open={showLogoDialog}
        onOpenChange={setShowLogoDialog}
        title="Upload Logo (Light Mode)"
        maxSizeMB={2}
        accept="image/png,image/jpeg,image/svg+xml"
        onSuccess={(url) => updateBrandingMutation.mutate({ logoUrl: url })}
      />
      <ImageUploadDialog
        open={showLogoDarkDialog}
        onOpenChange={setShowLogoDarkDialog}
        title="Upload Logo (Dark Mode)"
        maxSizeMB={2}
        accept="image/png,image/jpeg,image/svg+xml"
        onSuccess={(url) => updateBrandingMutation.mutate({ logoDarkUrl: url })}
      />
      <ImageUploadDialog
        open={showFaviconDialog}
        onOpenChange={setShowFaviconDialog}
        title="Upload Favicon"
        maxSizeMB={0.5}
        accept="image/png,image/x-icon,image/svg+xml"
        onSuccess={(url) => updateBrandingMutation.mutate({ faviconUrl: url })}
      />
      <ImageUploadDialog
        open={showFooterDialog}
        onOpenChange={setShowFooterDialog}
        title="Upload Footer Logo"
        maxSizeMB={2}
        accept="image/png,image/jpeg,image/svg+xml"
        onSuccess={(url) => updateBrandingMutation.mutate({ footerLogoUrl: url })}
      />

      {/* Color Preset Dialog */}
      <ColorPresetDialog
        open={showColorDialog}
        onOpenChange={(open) => {
          setShowColorDialog(open);
          if (!open) setEditingPreset(null);
        }}
        preset={editingPreset}
        onSave={(data) => {
          if (editingPreset) {
            updatePresetMutation.mutate({ id: editingPreset.id, data });
          } else {
            createPresetMutation.mutate(data);
          }
        }}
      />
    </div>
  );
}

function ImageUploadDialog({ open, onOpenChange, title, maxSizeMB, accept, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  maxSizeMB: number;
  accept: string;
  onSuccess: (url: string) => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > maxSizeMB * 1024 * 1024) {
      toast({ title: "File too large", description: `Maximum size is ${maxSizeMB}MB.`, variant: "destructive" });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadProductImageFile(file, (p) => setProgress(p));
      onSuccess(url);
      toast({ title: "Image uploaded", description: "File has been uploaded successfully." });
      setFile(null);
      setPreview(null);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Failed to upload image.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            className="w-full"
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {file ? file.name : "Choose file"}
          </Button>
          {preview && (
            <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30">
              <img src={preview} alt="Preview" className="max-h-32 max-w-full object-contain" />
            </div>
          )}
          {file && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading... {progress}%
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
              {uploading && (
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ColorPresetDialog({ open, onOpenChange, preset, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: ColorPreset | null;
  onSave: (data: Partial<ColorPreset>) => void;
}) {
  const [name, setName] = useState(preset?.presetName || "");
  const [bgPrimary, setBgPrimary] = useState(preset?.bgPrimary || "#ffffff");
  const [bgSecondary, setBgSecondary] = useState(preset?.bgSecondary || "#f5f5f5");
  const [textPrimary, setTextPrimary] = useState(preset?.textPrimary || "#000000");
  const [textSecondary, setTextSecondary] = useState(preset?.textSecondary || "#666666");
  const [accentColor, setAccentColor] = useState(preset?.accentColor || "#3b82f6");
  const [borderColor, setBorderColor] = useState(preset?.borderColor || "#e5e5e5");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      presetName: name,
      bgPrimary,
      bgSecondary,
      textPrimary,
      textSecondary,
      accentColor,
      borderColor,
    });
    onOpenChange(false);
  };

  function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 rounded border cursor-pointer shrink-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
          maxLength={7}
        />
        <Label className="text-xs text-muted-foreground whitespace-nowrap w-24">{label}</Label>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{preset ? "Edit" : "Create"} Color Preset</DialogTitle>
          <DialogDescription>
            {preset ? "Update the color values for this preset." : "Define a new color scheme for your brand."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Preset Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ocean Blue, Midnight..."
            />
          </div>

          <div className="space-y-3">
            <Label>Colors</Label>
            <ColorField label="Background" value={bgPrimary} onChange={setBgPrimary} />
            <ColorField label="Background 2" value={bgSecondary} onChange={setBgSecondary} />
            <ColorField label="Text" value={textPrimary} onChange={setTextPrimary} />
            <ColorField label="Text 2" value={textSecondary} onChange={setTextSecondary} />
            <ColorField label="Accent" value={accentColor} onChange={setAccentColor} />
            <ColorField label="Border" value={borderColor} onChange={setBorderColor} />
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="rounded-lg border p-4 space-y-3"
              style={{ backgroundColor: bgPrimary, borderColor }}
            >
              <div
                className="rounded p-3"
                style={{ backgroundColor: bgSecondary }}
              >
                <p style={{ color: textPrimary }} className="text-sm font-semibold">
                  Sample Heading
                </p>
                <p style={{ color: textSecondary }} className="text-xs mt-1">
                  This is how your color scheme will look.
                </p>
              </div>
              <button
                className="px-3 py-1.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: accentColor }}
              >
                Accent Button
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {preset ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ColorPresetItem({ preset, isActive, onActivate, onEdit, onDelete }: { preset: ColorPreset; isActive: boolean; onActivate: () => void; onEdit: () => void; onDelete: () => void }) {
  const swatchBg = preset.accentColor || "#3b82f6";
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-muted/50 hover:border-muted/100 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium"
            style={{ backgroundColor: `${swatchBg}20`, color: swatchBg }}
          >
            Aa
          </div>
          <div>
            <p className="text-sm font-medium">{preset.presetName}</p>
            <p className="text-xs text-muted-foreground">
              bg: {preset.bgPrimary || 'var(--background)'} • text: {preset.textPrimary || 'var(--foreground)'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Badge
          variant={isActive ? "default" : "secondary"}
          className={isActive ? "text-[9px] px-2 py-0.5" : "text-[9px] px-1.5 py-0"}
        >
          {isActive ? "Active" : "Inactive"}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onActivate}
          title="Activate this preset"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onEdit}
          title="Edit preset"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-6 w-6 p-0 ml-1"
          onClick={onDelete}
          title="Delete preset"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NavigationManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pages, isLoading } = useQuery({
    queryKey: ["/api/admin/canvas/pages"],
    queryFn: getCanvasPages,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CanvasPage> }) => updateCanvasPage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => reorderCanvasPages(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/pages"] });
      toast({ title: "Navigation reordered", description: "Nav order has been updated." });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sortedPages = [...(pages || [])].sort((a, b) => {
      if (a.isHomepage) return -1;
      if (b.isHomepage) return 1;
      return a.sortOrder - b.sortOrder;
    });

    const oldIndex = sortedPages.findIndex((p) => p.id === active.id);
    const newIndex = sortedPages.findIndex((p) => p.id === over.id);
    const newOrder = arrayMove(sortedPages, oldIndex, newIndex);
    reorderMutation.mutate(newOrder.map((p) => p.id));
  }

  function handleToggleNav(page: CanvasPage, checked: boolean) {
    updateMutation.mutate({ id: page.id, data: { showInNav: checked } });
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-1 w-24 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  const sortedPages = [...(pages || [])].sort((a, b) => {
    if (a.isHomepage) return -1;
    if (b.isHomepage) return 1;
    return a.sortOrder - b.sortOrder;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Storefront Navigation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage which pages appear in the storefront navigation bar and their order.
          </p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedPages.map((page) => (
                <NavigationItem
                  key={page.id}
                  page={page}
                  onToggleNav={handleToggleNav}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-6 p-4 rounded-lg border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Drag pages to reorder. Toggle "Show in nav" to control visibility in the storefront header.
          </p>
        </div>
      </div>
    </div>
  );
}

function NavigationItem({ page, onToggleNav }: { page: CanvasPage; onToggleNav: (page: CanvasPage, checked: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-1"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {page.isHomepage ? (
        <Home className="h-4 w-4 text-muted-foreground shrink-0" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{page.title}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{page.slug}</p>
      </div>

      <Badge
        variant={page.status === "published" ? "default" : "secondary"}
        className={cn(
          "text-[9px] px-1.5 py-0 h-4",
          page.status === "published" ? "bg-emerald-500/20 text-emerald-400" : ""
        )}
      >
        {page.status === "published" ? "Live" : "Draft"}
      </Badge>

      <div className="flex items-center gap-2">
        {page.showInNav ? (
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
        <Switch
          checked={page.showInNav}
          onCheckedChange={(checked) => onToggleNav(page, checked)}
          disabled={page.isHomepage}
        />
      </div>
    </div>
  );
}
