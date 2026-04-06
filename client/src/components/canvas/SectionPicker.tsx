import { useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SECTION_CATEGORY_META,
  SECTION_TYPES,
  type SectionCategory,
  type SectionType,
  type SectionTypeDefinition,
} from "@/lib/sectionTypes";

type PickerCategory = "all" | SectionCategory;

interface SectionPickerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onAdd: (sectionType: SectionType) => void;
  existingSectionTypes?: SectionType[];
}

function PreviewShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-[110px] overflow-hidden rounded-xl border border-white/10 bg-[#111113] p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PreviewCard({ className }: { className?: string }) {
  return <div className={cn("rounded-md border border-white/10 bg-white/5", className)} />;
}

function renderPreview(type: SectionType) {
  switch (type) {
    case "hero-slider":
      return (
        <PreviewShell className="bg-[radial-gradient(circle_at_top_right,_rgba(201,168,76,0.22),_transparent_42%),linear-gradient(135deg,#151515_0%,#1f1a12_40%,#0f0f11_100%)]">
          <div className="space-y-2">
            <div className="h-2.5 w-14 rounded-full bg-[#c9a84c]/70" />
            <div className="space-y-1">
              <div className="h-3 w-20 rounded-full bg-white/85" />
              <div className="h-3 w-24 rounded-full bg-white/70" />
            </div>
            <div className="h-6 w-14 rounded-full bg-[#c9a84c]" />
          </div>
        </PreviewShell>
      );
    case "hero-video":
      return (
        <PreviewShell className="bg-[linear-gradient(135deg,#101314_0%,#183028_48%,#0f0f11_100%)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_55%)]" />
          <div className="relative flex h-full items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-2.5 w-16 rounded-full bg-white/80" />
              <div className="h-2.5 w-12 rounded-full bg-white/60" />
              <div className="h-5 w-12 rounded-full bg-[#c9a84c]" />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10">
              <div className="ml-0.5 h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-[#f0ede8]" />
            </div>
          </div>
        </PreviewShell>
      );
    case "hero-split":
      return (
        <PreviewShell>
          <div className="grid h-full grid-cols-[1.2fr_0.9fr] gap-2">
            <div className="space-y-2 rounded-lg bg-white/[0.04] p-2.5">
              <div className="h-2 w-12 rounded-full bg-[#c9a84c]/70" />
              <div className="h-3 w-20 rounded-full bg-white/80" />
              <div className="h-3 w-16 rounded-full bg-white/65" />
              <div className="h-5 w-14 rounded-full bg-[#c9a84c]" />
            </div>
            <PreviewCard className="bg-[linear-gradient(135deg,rgba(201,168,76,0.24),rgba(255,255,255,0.05))]" />
          </div>
        </PreviewShell>
      );
    case "featured-products":
    case "category-grid":
    case "new-arrivals":
      return (
        <PreviewShell>
          <div className="mb-2 h-2.5 w-20 rounded-full bg-white/80" />
          <div className="grid grid-cols-3 gap-2">
            {["◌", "✦", "◇"].map((icon, index) => (
              <div key={`${type}-${index}`} className="space-y-1.5">
                <div className="flex h-12 items-center justify-center rounded-md bg-white/[0.06] text-[13px] text-[#c9a84c]">
                  {icon}
                </div>
                <div className="h-2 w-8 rounded-full bg-white/70" />
                <div className="h-2 w-5 rounded-full bg-[#c9a84c]/70" />
              </div>
            ))}
          </div>
        </PreviewShell>
      );
    case "testimonial":
      return (
        <PreviewShell>
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="text-[10px] tracking-[0.18em] text-[#c9a84c]">★★★★★</div>
            <div className="space-y-1">
              <div className="h-2 w-24 rounded-full bg-white/75" />
              <div className="h-2 w-20 rounded-full bg-white/60" />
            </div>
            <div className="h-2 w-12 rounded-full bg-[#c9a84c]/60" />
          </div>
        </PreviewShell>
      );
    case "faq":
      return (
        <PreviewShell>
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div
                key={`faq-${row}`}
                className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
              >
                <div className="h-2 w-20 rounded-full bg-white/70" />
                <div className="text-xs text-[#c9a84c]">+</div>
              </div>
            ))}
          </div>
        </PreviewShell>
      );
    case "cta-banner":
    case "campaign-banner":
      return (
        <PreviewShell className="bg-[linear-gradient(135deg,#20180d_0%,#0e0e10_100%)]">
          <div className="flex h-full items-end justify-between rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/10 p-3">
            <div className="space-y-1.5">
              <div className="h-2 w-12 rounded-full bg-[#c9a84c]/80" />
              <div className="h-3 w-20 rounded-full bg-white/80" />
            </div>
            <div className="h-5 w-12 rounded-full bg-[#c9a84c]" />
          </div>
        </PreviewShell>
      );
    case "gallery":
      return (
        <PreviewShell>
          <div className="grid h-full grid-cols-3 gap-2">
            <PreviewCard className="row-span-2" />
            <PreviewCard className="h-full" />
            <PreviewCard className="h-full" />
            <PreviewCard className="col-span-2 h-full" />
            <PreviewCard className="h-full" />
          </div>
        </PreviewShell>
      );
    case "video":
      return (
        <PreviewShell className="bg-[linear-gradient(135deg,#13201a_0%,#101113_100%)]">
          <div className="flex h-full items-center justify-center">
            <div className="flex h-14 w-20 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
              <div className="ml-0.5 h-0 w-0 border-y-[7px] border-y-transparent border-l-[12px] border-l-[#c9a84c]" />
            </div>
          </div>
        </PreviewShell>
      );
    case "newsletter":
      return (
        <PreviewShell>
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="h-2 w-14 rounded-full bg-[#c9a84c]/75" />
            <div className="h-2 w-24 rounded-full bg-white/75" />
            <div className="flex w-full max-w-[150px] gap-1">
              <div className="h-6 flex-1 rounded-full border border-white/10 bg-white/[0.05]" />
              <div className="h-6 w-12 rounded-full bg-[#c9a84c]" />
            </div>
          </div>
        </PreviewShell>
      );
    case "countdown":
      return (
        <PreviewShell>
          <div className="flex h-full items-center justify-center gap-1.5">
            {[0, 1, 2].map((box) => (
              <div key={`countdown-${box}`} className="flex items-center gap-1.5">
                <div className="flex h-11 w-10 items-center justify-center rounded-md bg-white/[0.06] text-sm font-semibold text-[#f0ede8]">
                  12
                </div>
                {box < 2 ? <div className="text-[#c9a84c]">:</div> : null}
              </div>
            ))}
          </div>
        </PreviewShell>
      );
    case "map":
      return (
        <PreviewShell className="bg-[linear-gradient(135deg,#102118_0%,#1d3528_50%,#0d1210_100%)]">
          <div className="flex h-full items-center justify-center">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-[#c9a84c]/20" />
              <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c9a84c]" />
            </div>
          </div>
        </PreviewShell>
      );
    case "ticker":
      return (
        <PreviewShell className="bg-[#0d0d0f]">
          <div className="flex h-full items-center gap-3 overflow-hidden text-[10px] uppercase tracking-[0.16em] text-[#c9a84c]">
            <span>World Wide Shipping</span>
            <span>•</span>
            <span>Private Drop Live</span>
            <span>•</span>
            <span>Tailored Service</span>
          </div>
        </PreviewShell>
      );
    case "quote":
      return (
        <PreviewShell>
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="text-xl text-[#c9a84c]">"</div>
            <div className="space-y-1">
              <div className="h-2 w-24 rounded-full bg-white/75" />
              <div className="h-2 w-16 rounded-full bg-white/55" />
            </div>
          </div>
        </PreviewShell>
      );
    case "divider":
      return (
        <PreviewShell>
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="h-px w-full bg-[#c9a84c]/40" />
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#c9a84c]">Collection</div>
            <div className="h-px w-full bg-[#c9a84c]/40" />
          </div>
        </PreviewShell>
      );
    case "text-block":
      return (
        <PreviewShell>
          <div className="space-y-2 pt-2">
            <div className="h-2.5 w-24 rounded-full bg-white/80" />
            <div className="h-2.5 w-full rounded-full bg-white/50" />
            <div className="h-2.5 w-5/6 rounded-full bg-white/45" />
            <div className="h-2.5 w-2/3 rounded-full bg-white/35" />
          </div>
        </PreviewShell>
      );
    case "services":
      return (
        <PreviewShell>
          <div className="grid h-full grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <div key={`services-${item}`} className="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/[0.04]">
                <div className="h-6 w-6 rounded-full border border-[#c9a84c]/40" />
                <div className="h-2 w-10 rounded-full bg-white/55" />
              </div>
            ))}
          </div>
        </PreviewShell>
      );
    case "fresh-release":
      return (
        <PreviewShell className="bg-[linear-gradient(135deg,#0f1114_0%,#1a1d28_60%,#201810_100%)]">
          <div className="grid h-full grid-cols-[1fr_1.1fr] gap-2">
            <div className="rounded-lg bg-white/[0.05]" />
            <div className="space-y-2 rounded-lg bg-white/[0.04] p-2.5">
              <div className="h-2 w-12 rounded-full bg-[#c9a84c]/75" />
              <div className="h-3 w-16 rounded-full bg-white/80" />
              <div className="h-2 w-20 rounded-full bg-white/50" />
            </div>
          </div>
        </PreviewShell>
      );
    case "contact":
    case "back-to-top":
      return (
        <PreviewShell>
          <div className="flex h-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4">
            <div className="space-y-1.5">
              <div className="h-2 w-12 rounded-full bg-white/75" />
              <div className="h-2 w-20 rounded-full bg-white/45" />
            </div>
            <div className="h-8 w-8 rounded-full border border-[#c9a84c]/45" />
          </div>
        </PreviewShell>
      );
    default:
      return (
        <PreviewShell>
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-white/45">
            Section
          </div>
        </PreviewShell>
      );
  }
}

function getBadgeLabel(badge?: SectionTypeDefinition["badge"]) {
  if (!badge) return null;
  if (badge === "popular") return "Popular";
  return badge.toUpperCase();
}

export function SectionPicker({
  open,
  onOpenChange,
  isOpen,
  onClose,
  onAdd,
  existingSectionTypes = [],
}: SectionPickerProps) {
  const actualOpen = isOpen ?? open ?? false;
  const close = () => {
    onClose?.();
    onOpenChange?.(false);
  };
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<PickerCategory>("all");

  const isSearching = search.trim().length > 0;
  const normalizedQuery = search.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    return SECTION_TYPES.filter((section) => {
      if (
        normalizedQuery &&
        !section.label.toLowerCase().includes(normalizedQuery) &&
        !section.description.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }

      if (!isSearching && activeCategory !== "all" && section.category !== activeCategory) {
        return false;
      }

      return true;
    });
  }, [activeCategory, isSearching, normalizedQuery]);

  const groupedSections = useMemo(() => {
    return SECTION_CATEGORY_META.filter((category) => category.id !== "all")
      .map((category) => ({
        ...category,
        sections: filteredSections.filter((section) => section.category === category.id),
      }))
      .filter((group) => group.sections.length > 0);
  }, [filteredSections]);

  const counts = useMemo(() => {
    const allCount = SECTION_TYPES.length;
    return SECTION_CATEGORY_META.reduce<Record<string, number>>((acc, category) => {
      if (category.id === "all") {
        acc[category.id] = allCount;
        return acc;
      }

      acc[category.id] = SECTION_TYPES.filter((section) => section.category === category.id).length;
      return acc;
    }, {});
  }, []);

  return (
    <Dialog
      open={actualOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
        else onOpenChange?.(true);
      }}
    >
      <DialogContent className="overflow-hidden border border-[#c9a84c]/20 bg-[#0c0c0e] p-0 text-[#f0ede8] sm:max-w-[920px]">
        <div className="flex h-[78vh] max-h-[760px] flex-col">
          <DialogHeader className="border-b border-white/10 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="font-serif text-[28px] font-medium tracking-[0.04em] text-[#f0ede8]">
                  Add a Section
                </DialogTitle>
                <p className="mt-1 text-sm text-[#a09d97]">
                  Build pages with Rare Atelier blocks without leaving the canvas.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.04] text-[#a09d97] hover:bg-white/[0.08] hover:text-[#f0ede8]"
                onClick={close}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f7c76]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sections"
                className="h-11 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-[#f0ede8] placeholder:text-[#7f7c76] focus-visible:border-[#c9a84c]/40 focus-visible:ring-[#c9a84c]/20"
              />
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className="hidden w-[190px] shrink-0 border-r border-white/10 bg-[#101013] p-4 md:block">
              <div className="space-y-1">
                {SECTION_CATEGORY_META.map((category) => {
                  const isActive = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "border-[#c9a84c]/40 bg-[#c9a84c]/10 text-[#e2c47a]"
                          : "border-transparent text-[#a09d97] hover:bg-white/[0.04] hover:text-[#f0ede8]",
                      )}
                    >
                      <span className="text-sm font-medium">{category.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em]",
                          isActive
                            ? "bg-[#c9a84c]/15 text-[#e2c47a]"
                            : "bg-white/[0.06] text-[#7f7c76]",
                        )}
                      >
                        {counts[category.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-h-0 flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto px-5 py-4">
                {isSearching ? (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold tracking-[0.08em] text-[#f0ede8]">
                          Search Results
                        </h3>
                        <p className="text-xs text-[#7f7c76]">
                          {filteredSections.length} matching sections
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredSections.map((section) => {
                        const disabled = section.unique && existingSectionTypes.includes(section.type);
                        return (
                          <button
                            key={section.type}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              onAdd(section.type);
                              close();
                            }}
                            className={cn(
                              "group overflow-hidden rounded-2xl border text-left transition-all",
                              disabled
                                ? "cursor-not-allowed border-white/10 bg-white/[0.03] opacity-45"
                                : "border-white/10 bg-[#131316] hover:-translate-y-0.5 hover:border-[#c9a84c]/35 hover:shadow-[0_22px_40px_rgba(0,0,0,0.32)]",
                            )}
                          >
                            <div className="relative p-3">
                              {renderPreview(section.type)}
                              {!disabled ? (
                                <div className="absolute inset-3 flex items-center justify-center rounded-xl bg-[#c9a84c]/0 opacity-0 transition-all group-hover:bg-[#c9a84c]/16 group-hover:opacity-100">
                                  <span className="rounded-full border border-[#c9a84c]/40 bg-[#0c0c0e]/90 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[#f0ede8]">
                                    + Add
                                  </span>
                                </div>
                              ) : null}
                            </div>
                            <div className="space-y-1 px-4 pb-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#f0ede8]">{section.label}</span>
                                {section.badge ? (
                                  <Badge className="border-[#c9a84c]/25 bg-[#c9a84c]/12 text-[10px] uppercase tracking-[0.12em] text-[#e2c47a] hover:bg-[#c9a84c]/12">
                                    {getBadgeLabel(section.badge)}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs leading-5 text-[#7f7c76]">{section.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-7">
                    {groupedSections.map((group) => (
                      <section key={group.id} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#e2c47a]">
                            {group.label}
                          </h3>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {group.sections.map((section) => {
                            const disabled = section.unique && existingSectionTypes.includes(section.type);
                            return (
                              <button
                                key={section.type}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  onAdd(section.type);
                                  close();
                                }}
                                className={cn(
                                  "group overflow-hidden rounded-2xl border text-left transition-all",
                                  disabled
                                    ? "cursor-not-allowed border-white/10 bg-white/[0.03] opacity-45"
                                    : "border-white/10 bg-[#131316] hover:-translate-y-0.5 hover:border-[#c9a84c]/35 hover:shadow-[0_22px_40px_rgba(0,0,0,0.32)]",
                                )}
                              >
                                <div className="relative p-3">
                                  {renderPreview(section.type)}
                                  {!disabled ? (
                                    <div className="absolute inset-3 flex items-center justify-center rounded-xl bg-[#c9a84c]/0 opacity-0 transition-all group-hover:bg-[#c9a84c]/16 group-hover:opacity-100">
                                      <span className="rounded-full border border-[#c9a84c]/40 bg-[#0c0c0e]/90 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[#f0ede8]">
                                        + Add
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="space-y-1 px-4 pb-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-[#f0ede8]">{section.label}</span>
                                    {section.badge ? (
                                      <Badge className="border-[#c9a84c]/25 bg-[#c9a84c]/12 text-[10px] uppercase tracking-[0.12em] text-[#e2c47a] hover:bg-[#c9a84c]/12">
                                        {getBadgeLabel(section.badge)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="text-xs leading-5 text-[#7f7c76]">{section.description}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
            <div className="flex items-center gap-2 text-sm text-[#a09d97]">
              <Sparkles className="h-4 w-4 text-[#c9a84c]" />
              <span>{filteredSections.length} sections available</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/[0.03] text-[#f0ede8] hover:bg-white/[0.06]"
              onClick={close}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
