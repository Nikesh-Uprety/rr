import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ADMIN_FONT_OPTIONS,
  DEFAULT_ADMIN_FONT_SETTINGS,
  type AdminFontMode,
  type AdminFontScale,
  persistAdminFontSettings,
  readAdminFontSettings,
} from "@/lib/adminFont";
import { Type } from "lucide-react";

export default function AdminDevFontPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<AdminFontMode>(() => readAdminFontSettings().mode);
  const [scale, setScale] = useState<AdminFontScale>(() => readAdminFontSettings().scale);

  const apply = (next: { mode?: AdminFontMode; scale?: AdminFontScale }) => {
    const settings = {
      mode: next.mode ?? mode,
      scale: next.scale ?? scale,
    };
    setMode(settings.mode);
    setScale(settings.scale);
    persistAdminFontSettings(settings);
    const label = ADMIN_FONT_OPTIONS.find((item) => item.mode === settings.mode)?.label || settings.mode;
    toast({
      title: "Admin font updated",
      description: `${label} • ${settings.scale}`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Dev Font</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preview and switch admin-panel fonts only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Font Family
          </CardTitle>
          <CardDescription>Choose typography style for admin UI.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {ADMIN_FONT_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => apply({ mode: option.mode })}
              className={`rounded-xl border p-4 text-left transition-colors ${
                mode === option.mode
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <p className="font-semibold">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
              {mode === option.mode ? (
                <Badge className="mt-3" variant="secondary">Active</Badge>
              ) : null}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Font Size</CardTitle>
          <CardDescription>Adjust admin readability scale.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(["normal", "medium", "large", "very-large"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={scale === item ? "default" : "outline"}
              onClick={() => apply({ scale: item })}
            >
              {item}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setMode(DEFAULT_ADMIN_FONT_SETTINGS.mode);
              setScale(DEFAULT_ADMIN_FONT_SETTINGS.scale);
              persistAdminFontSettings(DEFAULT_ADMIN_FONT_SETTINGS);
              toast({
                title: "Admin font reset",
                description: "Default admin typography restored.",
              });
            }}
          >
            Reset
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Quick sample for headings, body, and metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <h2 className="text-2xl font-semibold">Rare Atelier Admin Typography</h2>
          <p className="text-sm text-muted-foreground">
            This preview reflects your currently selected admin font family and scale.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Sample Label</p>
            <p className="mt-2 text-base">
              The quick brown fox jumps over the lazy dog. 1234567890.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
