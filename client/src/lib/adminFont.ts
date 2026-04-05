export type AdminFontMode =
  | "roboto-slab"
  | "inter"
  | "space-grotesk"
  | "ibm-plex-sans"
  | "avenir-like";
export type AdminFontScale = "normal" | "medium" | "large" | "very-large";

export const ADMIN_FONT_MODE_KEY = "admin-font-mode";
export const ADMIN_FONT_SCALE_KEY = "admin-font-scale";
export const ADMIN_FONT_EVENT = "admin-font-settings-updated";

export interface AdminFontSettings {
  mode: AdminFontMode;
  scale: AdminFontScale;
}

export const ADMIN_FONT_OPTIONS: Array<{
  mode: AdminFontMode;
  label: string;
  description: string;
}> = [
  {
    mode: "roboto-slab",
    label: "Roboto Slab",
    description: "Editorial slab serif with stronger hierarchy.",
  },
  {
    mode: "inter",
    label: "Inter",
    description: "Clean product UI default for broad readability.",
  },
  {
    mode: "space-grotesk",
    label: "Space Grotesk",
    description: "Modern geometric sans with more personality.",
  },
  {
    mode: "ibm-plex-sans",
    label: "IBM Plex Sans",
    description: "Structured system-style font for dashboards.",
  },
  {
    mode: "avenir-like",
    label: "Avenir Style",
    description: "Uses Avenir locally when available, with Montserrat fallback.",
  },
];

export const DEFAULT_ADMIN_FONT_SETTINGS: AdminFontSettings = {
  mode: "inter",
  scale: "large",
};

export function readAdminFontSettings(): AdminFontSettings {
  if (typeof window === "undefined") {
    return DEFAULT_ADMIN_FONT_SETTINGS;
  }

  const storedMode = window.localStorage.getItem(ADMIN_FONT_MODE_KEY);
  const storedScale = window.localStorage.getItem(ADMIN_FONT_SCALE_KEY);

  return {
    mode: ADMIN_FONT_OPTIONS.some((option) => option.mode === storedMode)
      ? (storedMode as AdminFontMode)
      : DEFAULT_ADMIN_FONT_SETTINGS.mode,
    scale: (["normal", "medium", "large", "very-large"] as const).includes(storedScale as any)
      ? (storedScale as AdminFontScale)
      : DEFAULT_ADMIN_FONT_SETTINGS.scale,
  };
}

export function applyAdminFontSettings(settings: AdminFontSettings) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.adminFont = settings.mode;
  document.documentElement.dataset.adminFontScale = settings.scale;
}

export function persistAdminFontSettings(settings: AdminFontSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_FONT_MODE_KEY, settings.mode);
  window.localStorage.setItem(ADMIN_FONT_SCALE_KEY, settings.scale);
  applyAdminFontSettings(settings);
  window.dispatchEvent(new CustomEvent(ADMIN_FONT_EVENT, { detail: settings }));
}
