export type AdminFontMode = "iosevka" | "roboto-slab";
export type AdminFontScale = "comfortable" | "large";

export const ADMIN_FONT_MODE_KEY = "admin-font-mode";
export const ADMIN_FONT_SCALE_KEY = "admin-font-scale";
export const ADMIN_FONT_EVENT = "admin-font-settings-updated";

export interface AdminFontSettings {
  mode: AdminFontMode;
  scale: AdminFontScale;
}

export const DEFAULT_ADMIN_FONT_SETTINGS: AdminFontSettings = {
  mode: "iosevka",
  scale: "large",
};

export function readAdminFontSettings(): AdminFontSettings {
  if (typeof window === "undefined") {
    return DEFAULT_ADMIN_FONT_SETTINGS;
  }

  const storedMode = window.localStorage.getItem(ADMIN_FONT_MODE_KEY);
  const storedScale = window.localStorage.getItem(ADMIN_FONT_SCALE_KEY);

  return {
    mode: storedMode === "roboto-slab" ? "roboto-slab" : DEFAULT_ADMIN_FONT_SETTINGS.mode,
    scale: storedScale === "comfortable" ? "comfortable" : DEFAULT_ADMIN_FONT_SETTINGS.scale,
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
