import { useMemo } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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

type CanvasSettings = {
  id?: number;
  activeTemplateId?: number | null;
  activeTemplate?: CanvasTemplate | null;
};

interface TemplatesTabProps {
  templates: CanvasTemplate[];
  templatesLoading: boolean;
  settings: CanvasSettings | null;
  settingsLoading: boolean;
  selectedTemplateId: number | null;
  setSelectedTemplateId: (id: number | null) => void;
  effectiveTemplateId: number | null;
  activateMutation: ReturnType<typeof useMutation>;
  toast: ReturnType<typeof useToast>;
  queryClient: QueryClient;
  previewKey: number;
  setPreviewKey: (key: number) => void;
}

export function TemplatesTab({
  templates,
  templatesLoading,
  settings,
  settingsLoading,
  selectedTemplateId,
  setSelectedTemplateId,
  effectiveTemplateId,
  activateMutation,
  toast,
  queryClient,
  previewKey,
  setPreviewKey
}: TemplatesTabProps) {
  const premiumTemplates = useMemo(
    () => templates.filter((template) => template.tier === "premium"),
    [templates]
  );

  const freeTemplates = useMemo(
    () => templates.filter((template) => template.tier !== "premium"),
    [templates]
  );

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === effectiveTemplateId) ?? null,
    [templates, effectiveTemplateId]
  );

  const renderTemplatePreview = (template: CanvasTemplate) => {
    if (template.slug === "nikeshdesign") {
      return (
        <div
          className="relative h-28 overflow-hidden bg-[#0c0b09]"
          style={
            template.thumbnailUrl
              ? {
                  backgroundImage: `linear-gradient(180deg,rgba(12,11,9,0.18),rgba(12,11,9,0.84)), url(${template.thumbnailUrl})`,
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
            template.thumbnailUrl
              ? {
                  backgroundImage: `linear-gradient(180deg,rgba(12,11,9,0.15),rgba(12,11,9,0.82)), url(${template.thumbnailUrl})`,
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
              Maison Nocturne
            </h4>
            <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[rgba(232,228,219,0.48)]">
              Editorial Story Layout
            </p>
          </div>
          <div className="absolute bottom-0 right-0 h-16 w-24 bg-[radial-gradient(circle_at_bottom_right,rgba(201,169,110,0.35),transparent_60%)]" />
        </div>
      );
    }

    if (template.thumbnailUrl) {
      return (
        <div
          className="h-28 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-700"
          style={{
            backgroundImage: `url(${template.thumbnailUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
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
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-fuchsia-50 via-white to-amber-50 p-6 shadow-sm dark:from-fuchsia-950/20 dark:via-neutral-950 dark:to-amber-950/10">
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

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-4">
              <Tabs
                value="templates"
                onValueChange={() => {}}
                orientation="vertical"
                className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)] xl:grid-cols-1"
              >
                <TabsList className="grid h-auto grid-cols-1 gap-2 bg-transparent p-0">
                  <TabsTrigger value="templates" className="justify-start rounded-xl px-4 py-3">
                    Templates
                  </TabsTrigger>
                </TabsList>

                <div className="space-y-4">
                  <TabsContent value="templates" className="mt-0 space-y-5">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Premium Templates
                      </h2>
                      <div className="mt-3 grid gap-4">
                        {premiumTemplates.map((template) => {
                          const isActive = settings?.activeTemplate?.id === template.id || settings?.activeTemplateId === template.id;
                          const isSelected = effectiveTemplateId === template.id;
                          return (
                            <Card
                              key={template.id}
                              className={`overflow-hidden rounded-2xl border transition-all ${
                                isActive ? "border-emerald-500 shadow-emerald-100 dark:shadow-none" : "border-border/60"
                              } ${isSelected ? "ring-2 ring-fuchsia-300 dark:ring-fuchsia-700" : ""}`}
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
                                  ) : null}
                                </div>
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
                                    onClick={() => {
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

                    <Separator />

                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Free Templates
                      </h2>
                      <div className="mt-3 grid gap-4">
                        {freeTemplates.map((template) => {
                          const isActive = settings?.activeTemplate?.id === template.id || settings?.activeTemplateId === template.id;
                          const isSelected = effectiveTemplateId === template.id;
                          return (
                            <Card
                              key={template.id}
                              className={`overflow-hidden rounded-2xl border transition-all ${
                                isActive ? "border-emerald-500" : "border-border/60"
                              } ${isSelected ? "ring-2 ring-sky-300 dark:ring-sky-700" : ""}`}
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
                                    onClick={() => {
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
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
