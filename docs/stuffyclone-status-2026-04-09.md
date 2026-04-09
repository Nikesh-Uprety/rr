# StuffyClone Template Status Report (v1)

Date: 2026-04-09

## What You Asked For (High-Level)
- Make `stuffyclone` the active premium template and keep other templates intact.
- New StuffyClone landing experience (full-bleed hero image + centered overlay menu).
- StuffyClone nav: left “Menu” drawer + top-center brand logo + right-side search + cart.
- StuffyClone shop: max 4 columns, clean padding, color swatches, smooth hover slide animation.
- Color-specific product imagery via `colorImageMap`.
- Admin fixes: storyboard circle image clarity, size preview scroll, cost price field, inventory defaults.
- Admin orders: “View Bill” button, alignment, Nepali currency prefix `रू`.
- New “Add Order” route scaffold.
- Performance: lazy-load heavy embeds; reduce first-load jank.

## Core Changes Implemented

### 1) Template Activation + Seed Updates
- Added / ensured template definition for `stuffyclone` (display name: “Stussy Clone”) in:
  - `/home/nikesh/rr/server/routes.ts`
- Updated the seed default so newly seeded environments default to `stuffyclone` active.
- Added a small utility script to activate any template slug (fixes “home page showing previous template”):
  - `/home/nikesh/rr/script/activate-template.ts`

### 2) New StuffyClone Landing (Home)
- Full-screen hero image: `/images/stussy.webp`
- Center overlay menu (Shop / Collection / Atelier / Cart / Admin)
- Social icons under the menu (Instagram link updated to `https://www.instagram.com/rareofficial.au/`).
- Bottom-right shortcut icon linking to New Collection.
- Removed the “boxed” look for the center menu overlay so it sits directly on the hero.
- Performance: hero image is `fetchPriority="high"` and eager loaded.
  - `/home/nikesh/rr/client/src/pages/storefront/Home.tsx`

### 3) StuffyClone Navbar / Drawer / Global Logo
- StuffyClone gets a dedicated top bar:
  - Left: “Menu” (text-only)
  - Center: the new logo (top middle across pages)
  - Right: search + cart
- Updated to use the new logo file everywhere needed:
  - `/images/newproductpagelogo.png`
- Dark/light behavior:
  - Dark mode or hero landing: logo inverts to bright white.
  - Light mode: logo stays black.
  - `/home/nikesh/rr/client/src/components/layout/Navbar.tsx`

### 4) Shop Page (StuffyClone)
- Grid caps at 4 columns on large screens.
- Product cards show color swatches (filled squares) under the price.
- Smooth hover image animation:
  - Primary image slides left
  - Secondary slides in from right
- Color swatch hover/click persists selected color per product card.
- Fixed dropdown menus (“Sort by”, “More”, etc.) not being usable under the StuffyClone navbar by increasing Radix dropdown z-index:
  - `/home/nikesh/rr/client/src/components/ui/dropdown-menu.tsx`
- Removed a duplicate StuffyClone-specific shop header + side menu that was conflicting with the global navbar.
  - `/home/nikesh/rr/client/src/pages/storefront/Products.tsx`

### 5) Color-Specific Images (DB + Admin + Storefront)
- Added `colorImageMap` on products (`jsonb`) to store `color -> image[]` mapping.
  - `/home/nikesh/rr/shared/schema.ts`
  - `/home/nikesh/rr/migrations/0006_add_color_image_map.sql`
- Storefront shop uses `colorImageMap` to select the main + hover image based on active swatch.
  - `/home/nikesh/rr/client/src/pages/storefront/Products.tsx`
- Admin add/edit product flow updated to support assigning images per color.
  - `/home/nikesh/rr/client/src/pages/admin/AddProductWizard.tsx`
  - `/home/nikesh/rr/client/src/pages/admin/Products.tsx`

### 6) Admin UX Fixes
- Orders page improvements:
  - Nepali currency prefix `रू`
  - “View Bill” is now a compact button (“View Bill” only)
  - Dark mode chart labels fixed for visibility
  - `/home/nikesh/rr/client/src/pages/admin/Orders.tsx`
  - `/home/nikesh/rr/client/src/components/admin/OrdersTrendChart.tsx`
- Customers page:
  - Shows 10 per page with pagination
  - More colorful/visible bar styling
  - `/home/nikesh/rr/client/src/pages/admin/Customers.tsx`
  - `/home/nikesh/rr/client/src/components/admin/CustomerSpendingChart.tsx`
- Admin theme:
  - Admin panel defaults to light mode (independent from storefront theme) but can be toggled.
  - `/home/nikesh/rr/client/src/components/layout/AdminLayout.tsx`

### 7) New Order Creation Route (Scaffold)
- Added a new admin page scaffold:
  - `/home/nikesh/rr/client/src/pages/admin/OrdersNew.tsx`
- (Backend endpoint for full order creation + stock adjustments still needs final wiring if you want it fully functional end-to-end.)

### 8) Performance / Loading
- Lazy-load Instagram embed script on New Collection using `IntersectionObserver` (loads before user reaches it).
  - `/home/nikesh/rr/client/src/pages/storefront/NewCollection.tsx`
- Search suggestions dropdown z-index raised so it renders above StuffyClone navbar.
  - `/home/nikesh/rr/client/src/components/layout/SearchBar.tsx`

## Test Data / Seed (For Browser Testing)
To quickly test the color swatches + hover slide animation in Shop, I added a seed script that upserts 8 products with `colorImageMap`:
- `/home/nikesh/rr/script/seed-stuffy-test-products.ts`

Commands (WSL):
```bash
cd /home/nikesh/rr
TMPDIR=/tmp TMP=/tmp TEMP=/tmp npx tsx script/seed-stuffy-test-products.ts
```

## Commands I Ran (Verification)
- Typecheck:
  - `npm run check` (PASS)
- Unit tests:
  - `npm run test:unit` (PASS)
- Build:
  - `TMPDIR=/tmp TMP=/tmp TEMP=/tmp npm run build` (PASS)
- DB schema sync:
  - `npm run db:push` (PASS)
- Activated Stuffyclone:
  - `TMPDIR=/tmp TMP=/tmp TEMP=/tmp npx tsx script/activate-template.ts stuffyclone` (PASS)

## Notes / Known Follow-Ups
- The full “Add Order” workflow still needs backend endpoint + order item creation + stock decrement rules to match your exact business logic.
- If you want the exact Instagram embed HTML snippet verbatim, we can swap it in, but the current embed + lazy-load approach is already optimized and renders correctly with Instagram’s embed.js.
