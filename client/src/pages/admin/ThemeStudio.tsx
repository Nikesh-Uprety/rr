import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Plus, Type } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { ColorPreset } from "@/lib/adminApi";
import {
  activateColorPreset,
  createColorPreset,
  deleteColorPreset,
  getColorPresets,
  updateColorPreset,
} from "@/lib/adminApi";
import {
  ColorPresetDialog,
  ColorPresetItem,
  TypographyManager,
} from "@/pages/admin/CanvasPage";

function ThemeColorManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ColorPreset | null>(null);

  const { data: colorPresets = [], isLoading } = useQuery({
    queryKey: ["/api/admin/canvas/colors"],
    queryFn: getColorPresets,
  });

  const activePresetId = colorPresets.find((preset) => preset.isActive)?.id ?? null;

  const createPresetMutation = useMutation({
    mutationFn: (data: Partial<ColorPreset>) => createColorPreset(data),
    onSuccess: (preset) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/colors"] });
      toast({ title: "Theme preset created", description: `"${preset.presetName}" is ready to use.` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create theme preset.", variant: "destructive" });
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ColorPreset> }) => updateColorPreset(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/colors"] });
      toast({ title: "Theme preset updated", description: "Theme colors have been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update theme preset.", variant: "destructive" });
    },
  });

  const activatePresetMutation = useMutation({
    mutationFn: (id: number) => activateColorPreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/colors"] });
      toast({ title: "Theme activated", description: "The storefront now uses this color preset." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to activate theme preset.", variant: "destructive" });
    },
  });

  const deletePresetMutation = useMutation({
    mutationFn: (id: number) => deleteColorPreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canvas/colors"] });
      toast({ title: "Theme removed", description: "The preset has been deleted." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete theme preset.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-[28px] border border-[#d6e0ff] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-[#d6e0ff] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#4565d0]">
            Color System
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Storefront theme colors</h2>
          <p className="mt-2 text-sm text-slate-600">
            Activate the palette that should define backgrounds, text contrast, accents, and borders across the storefront.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#bfd1ff] bg-[#eef3ff] text-[#3654b1]">
            {colorPresets.length} presets
          </Badge>
          <Button
            variant="outline"
            onClick={() => {
              setEditingPreset(null);
              setShowColorDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Theme
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {colorPresets.length > 0 ? (
          colorPresets.map((preset) => (
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
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[#bfd1ff] bg-[#f8fbff] px-6 py-8 text-center text-sm text-slate-500">
            No theme presets yet. Create one to control storefront colors from this studio.
          </div>
        )}
      </div>

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

export default function ThemeStudioPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] overflow-hidden bg-[linear-gradient(180deg,#fbfcff_0%,#eef3ff_48%,#f7f8fc_100%)]">
      <div className="border-b border-[#d8e2ff] bg-white/88 px-6 py-6 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#4565d0]">
              Theme Studio
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Tune fonts and storefront color direction without leaving the admin shell.
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Pick the type system and color language that should define the active storefront pages.
              This page keeps those decisions separate from templates so admins can adjust styling safely.
            </p>
          </div>
          <div className="grid min-w-[280px] gap-3 rounded-[28px] border border-[#d6e0ff] bg-[#f8fbff] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#4565d0] text-white">
                <Type className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Typography control</p>
                <p className="text-xs text-slate-500">Switch the active storefront font preset with immediate preview.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#4565d0] shadow-[inset_0_0_0_1px_rgba(69,101,208,0.18)]">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Storefront color system</p>
                <p className="text-xs text-slate-500">Choose the palette that should shape the public-facing brand mood.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="min-w-0 overflow-hidden rounded-[32px] border border-[#d6e0ff] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <TypographyManager />
        </div>
        <ThemeColorManager />
      </div>
    </div>
  );
}
