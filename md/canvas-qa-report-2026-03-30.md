# RARE.NP Admin Canvas QA Review Report

Prepared for: **Arnav (QA Team)**
Prepared by: Engineering
Date: **March 30, 2026**
Environment: `rr` workspace (`/home/nikesh/rr`)

---

## 1. Scope and Objective

This report covers:

1. The **complete Canvas admin page feature set** currently implemented.
2. The **core changes completed today (March 30, 2026)** across Canvas and related admin areas.
3. The **tests performed** and QA verification checklist.

---

## 2. Canvas Page – Complete Feature Inventory

### 2.1 Core Navigation and Workspace Structure

The Canvas page is organized into three primary tabs:

1. **Templates**
2. **Sections**
3. **Theme**

These provide an end-to-end homepage composition workflow from template selection to section editing and visual typography checks.

---

### 2.2 Template Management Features

Implemented capabilities:

1. Fetch and display available templates from API.
2. Support for **premium** and **free** template groupings.
3. Selection and activation flow for homepage template publishing.
4. Active template highlighting and selection states.
5. Hidden/internal template filtering (`nikeshdesign`).
6. Full-page preview iframe with refresh control.
7. “Preview Site” quick access for live storefront review.

Behavioral notes:

1. Template activation invalidates Canvas settings and page config cache.
2. UI returns success/error toast feedback for publish actions.

---

### 2.3 Section Management Features

Implemented section operations:

1. Section list by selected template (ordered by `orderIndex`).
2. Drag-and-drop reordering with persisted backend updates.
3. Add section by type.
4. Edit section content/config.
5. Toggle visibility (show/hide).
6. Duplicate section.
7. Move section to another template.
8. Delete section.

Additional management UX:

1. Section group collapsibles (Hero/Product/Editorial/Utility).
2. Type-specific miniature visual previews in section cards.
3. Selected section metadata panel (visibility/order/type).

---

### 2.4 Section Editor Coverage by Type

The editor supports both structured fields and advanced JSON config.

#### Hero Section

1. Multi-slide editing with per-slide fields:
   - tag, headline, eyebrow, body
   - CTA label + href
   - image URL
   - duration
2. Hero slide add/remove/reorder operations.
3. Secondary CTA support.
4. Presets support (e.g., “Luxury Story”, “Product Focus”).

#### Ticker Section

1. Ticker item editing via list text format.

#### Quote Section

1. Statement text editing.
2. Attribution editing.

#### Featured Section

1. Title/hint controls.
2. Product ID input.
3. Visual product picker with selected state and remove action.

#### Campaign Section

1. Eyebrow/title/body/CTA fields.
2. Layout preset options.
3. Grid image collection editing (index/label/image).
4. Image assignment via picker or URL.

#### Services Section

1. Title/body controls.
2. Service cards list editor.

#### Fresh Release Section

1. Section title and intro text.
2. Desktop columns setting.
3. Product ID list + visual product picker.

#### Advanced Mode

1. Raw JSON config text area for direct config override.

---

### 2.5 Media Library and Asset Handling

Implemented capabilities:

1. Media picker dialog for section/hero/campaign image targeting.
2. Provider switching:
   - `local`
   - `cloudinary`
3. Shared library browsing and image selection.
4. Device upload into selected provider.
5. Post-upload auto-apply to current target field.
6. Max upload size guard: **30MB**.
7. User feedback for upload success/failure/oversize warning.

---

### 2.6 Theme Tab and Font Preview Features

Implemented capabilities:

1. Font preset picker in Theme tab.
2. Supported preset set:
   - Inter
   - Roboto Slab
   - Space Grotesk
   - IBM Plex Sans
3. Right-side live font preview panel showing sample text and numerals.
4. “Active Font Preset” summary card in dedicated theme area.
5. Real-time update behavior when preset changes.

---

### 2.7 Canvas Dark Mode and Visual System

Implemented visual improvements:

1. Elevated card/panel style system (shared constants).
2. Better dark mode depth (gradients, subtle border/ring, layered shadows).
3. Active state visual improvements (selection emphasis, readable contrast).
4. Section/Theme panels now maintain stronger dark-mode readability and hierarchy.

---

## 3. Today’s Core Changes (March 30, 2026)

### 3.1 Canvas Page Core Changes

Primary updates:

1. Added type-safe font preset model (`ThemeFontPreset`) and font-family mapping.
2. Added shared elevated style constants for consistent panel/card treatment.
3. Upgraded Theme tab with live right-side font preview panel.
4. Enhanced “Theme Controls” area with active font summary + live preview card.
5. Improved dark-mode readability and depth for section cards/panels.
6. Improved selected section visual emphasis and hover/focus states.

---

### 3.2 Analytics Core Changes

Primary updates:

1. Updated header typography to align with other admin pages.
2. Calendar default switched to **month view**.
3. Sales heatmap logic updated:
   - **No sales → red**
   - **Sales → foreground-based intensity**
4. Previous-month summary panel added beside current month calendar.
5. Tooltip/legend updates for clearer sales vs no-sales interpretation.
6. Grid/line contrast reduced to remove excessive “white line” visual noise.
7. Added note that calendar includes website orders + POS orders + direct POS sales.

Backend data correctness update:

1. Calendar API year default now uses `new Date().getFullYear()` instead of hardcoded 2025.
2. Analytics calendar aggregation now merges:
   - Online/POS order revenue
   - Direct POS bill revenue (issued, POS, no linked order)

---

### 3.3 Admin-Wide Dark Mode Core Changes

Primary updates:

1. Introduced scoped admin dark shell classes in layout (`admin-panel-root`, `admin-panel-shell`, `admin-panel-content`).
2. Added shared dark-mode surface treatment in global CSS:
   - radial/linear dark background layering
   - softer border colors
   - elevated card shadows
   - reduced harsh table divider visibility
3. Dark destructive color updated for visibility improvements.
4. Marketing stats cards updated to brighter/colorful palette in both modes, with improved contrast in dark mode.

---

### 3.4 Theme Switch Performance/Flicker Fix

Primary updates:

1. Admin theme toggle switched from `useEffect` to `useLayoutEffect` for pre-paint application.
2. Added transient `theme-switching` class to disable transitions during switch frame.
3. Added instant class swapping (`light/dark/warm`) and explicit `color-scheme` set.
4. Applied same instant-switch logic to storefront theme store (`useThemeStore`), preventing delayed unreadable state during theme toggle and page changes.

---

### 3.5 Related Committed Core Changes (Earlier Today)

Latest committed feature bundle (`67fd7a2`):

1. Admin Messages improvements (inbox behavior and admin experience).
2. Cloudinary-based profile image upload support and related backend wiring.

---

## 4. Tests Performed (Execution Summary)

Automated checks executed:

1. `npm run build` after dark-mode/admin changes.
2. `npm run build` after theme-switch performance changes.
3. `npm run build` after storefront instant theme switch integration.

Result:

1. **Build passed successfully** in all runs.
2. No compile-time TypeScript/Vite build blockers observed.

Notes:

1. This report includes build-level verification only.
2. No automated E2E suite run was executed in this reporting step.

---

## 5. QA Checklist for Arnav (Canvas-Focused)

### 5.1 Templates Tab

1. Select each visible template and confirm card selection state.
2. Activate a template and verify storefront reflects new template.
3. Confirm “Full Page Preview” refresh button updates iframe.

### 5.2 Sections Tab

1. Add one section of each available type.
2. Reorder sections by drag-drop and verify persistent order after reload.
3. Toggle visibility and verify storefront hide/show behavior.
4. Duplicate section and confirm independent editable copy.
5. Move section to another template and confirm presence in destination.
6. Delete section and verify removal persistence.

### 5.3 Section Editor by Type

1. Hero slides: add/edit/remove/reorder slide rows; verify storefront hero rendering.
2. Campaign grid: modify image entries and labels; verify preview + storefront.
3. Featured/Fresh release product pickers: select/remove products and validate product cards.
4. Services cards: edit text, links, and verify storefront output.
5. Advanced JSON: save valid JSON and verify state; test invalid JSON error handling.

### 5.4 Media Picker / Upload

1. Open media dialog from hero/section/campaign targets.
2. Switch provider local ↔ cloudinary and verify list updates.
3. Upload valid image and verify auto-apply.
4. Upload >30MB file and verify warning flow.

### 5.5 Theme Tab

1. Cycle all 4 font presets.
2. Verify right-side preview updates instantly per font.
3. Verify active font summary card matches selected preset.

### 5.6 Dark Mode + Theme Switch Performance

1. Toggle dark/light rapidly on admin and storefront.
2. Navigate between pages during/after toggle.
3. Confirm no 1-second unreadable flash or delayed style reconciliation.

---

## 6. Risk and Follow-up Notes

1. Build-level validation is complete; visual/state regressions still require QA pass.
2. Media provider behavior depends on provider credentials and asset availability in each environment.
3. Canvas preview iframe behavior should be verified against both active and selected template contexts.

---

## 7. Recommended QA Sign-off Criteria

Sign-off recommended once:

1. All checklist items in Section 5 pass on staging.
2. No theme-switch flicker is observed across admin/storefront paths.
3. Canvas section CRUD + reorder + publish flows are verified end-to-end.

