# RARE.NP Inventory Changes Report

Date: 2026-03-26  
Project: `rr` (React + Vite + TailwindCSS + shadcn/ui + TanStack Query + Express + Drizzle + Neon PostgreSQL)

## 1. Executive Summary
This change cycle introduced a full inventory-management foundation for RARE.NP and then hardened it after live validation and review.

The work covered:
- variant-based inventory tracking with `product_variants`
- admin inventory APIs and inventory dashboard support
- storefront size-aware stock handling
- order and POS stock deduction tied to sizes
- regression fixes to preserve non-standard sizes like `XXL`
- legacy stock fallback protection for products without seeded variants

The end result is that inventory now works at per-size level while remaining backward-compatible with legacy product-level stock.

## 2. Core Implementation Changes

### 2.1 Schema and Inventory Model
The database model was extended to support variant inventory properly.

Key additions:
- `products.cost_price`
- `products.sku`
- new `product_variants` table with:
  - `id`
  - `product_id`
  - `size`
  - `color`
  - `sku`
  - `stock`
  - timestamps
- `order_items.variant_id`
- `order_items.size`

Performance indexes were also added:
- `products.category`
- `order_items.product_id`
- `product_variants(product_id, size)`

### 2.2 Admin Inventory Backend
Inventory routes were added and updated in the backend:
- `GET /api/admin/inventory/summary`
- `GET /api/admin/inventory/products`
- `PATCH /api/admin/inventory/:productId/stock`
- `POST /api/admin/inventory/seed-variants`

Implemented behavior:
- summary totals now calculate from variant rows
- inventory list groups stock per size
- stock editing updates variant rows and recomputes product total stock
- one-time seeding distributes legacy product stock into `S / M / L / XL`
- summary endpoint now uses a simple in-memory cache

### 2.3 Admin Inventory Frontend
A dedicated inventory page was created for admin users with:
- KPI summary cards
- low-stock / critical alert banner
- category stock breakdown
- stock health overview
- searchable inventory table
- CSV export
- per-size stock restock modal

The restock modal now supports dynamic sizes:
- standard sizes `S / M / L / XL`
- additional sizes like `XXL` when present in inventory data

### 2.4 Storefront Product Detail
The storefront product detail page was upgraded to consume variant stock from the API.

Changes included:
- product detail API now returns `variants` and `stockBySize`
- size selector now respects per-size stock
- out-of-stock sizes are disabled and visually crossed out
- low-stock messaging is shown per size
- quantity is capped by selected size stock
- below-the-fold images use `loading="lazy"`
- main hero image remains `loading="eager"`
- product query now uses a 2-minute `staleTime`

After regression fixes, the storefront size selector now preserves all configured product sizes, not just `S / M / L / XL`.

### 2.5 Orders and POS Stock Deduction
Both online checkout and POS flows were updated to deduct stock by size:
- if a matching variant exists, that size stock is decremented
- product-level stock is recomputed from variants when variant rows exist
- if no variant rows exist for a product, stock now falls back to legacy `products.stock` decrement logic

This prevents silent inventory corruption for legacy products that were not seeded yet.

### 2.6 Orders Page Enhancements
Admin orders UI now shows size-aware order information:
- list preview includes item size, e.g. `Khumbu Hoodie (M) × 1`
- order detail panel shows `Size: M` badge

## 3. Regression Fixes Applied
During review, three important regressions were found and fixed:

### 3.1 Dynamic Size Preservation on PDP
Issue:
- storefront size selector had been hard-coded to `S / M / L / XL`

Fix:
- size list is now derived from:
  - `sizeOptions`
  - `stockBySize`
  - variant rows

Result:
- sizes like `XXL` now render correctly on the storefront

### 3.2 Inventory API Size Preservation
Issue:
- inventory API only returned `S / M / L / XL`

Fix:
- `stockBySize` now returns the full size map from `product_variants`
- admin inventory modal now supports editing extra sizes too

Result:
- additional sizes no longer disappear from admin inventory workflows

### 3.3 Legacy POS / Checkout Fallback
Issue:
- products without variant rows could have stock overwritten to `0`

Fix:
- when no variant rows exist, the system decrements `products.stock` directly instead of recomputing from an empty variant set

Result:
- legacy non-seeded products now preserve correct stock behavior

## 4. Files Touched
Primary implementation files:
- `shared/schema.ts`
- `server/routes.ts`
- `server/storage.ts`
- `client/src/lib/api.ts`
- `client/src/lib/adminApi.ts`
- `client/src/pages/admin/Inventory.tsx`
- `client/src/pages/admin/Orders.tsx`
- `client/src/pages/storefront/ProductDetail.tsx`
- `client/src/pages/storefront/Checkout.tsx`

Routing and navigation support for inventory had already been added earlier through:
- `client/src/App.tsx`
- `client/src/lib/adminAccess.ts`

## 5. Verification Performed
The implementation was tested in staged passes: API verification, browser verification, regression verification, and fallback verification.

### 5.1 TypeScript Validation
Focused `tsc --noEmit` verification was run against all touched files.

Result:
- touched files were clean
- only unrelated pre-existing errors remained in `server/auth.ts`

### 5.2 Inventory API Verification
Verified:
- inventory summary returns real values
- inventory product list returns real per-size stock
- seeded inventory totals are non-zero

Observed summary response:
- `totalProducts: 70`
- `totalSkus: 350`
- `totalQuantity: 3338`
- `totalInventoryValue: 8346520`
- `totalInventoryCost: 4173260`

Observed inventory product response for the test product included:
- `S: 2`
- `M: 3`
- `L: 3`
- `XL: 2`

Later regression verification confirmed:
- `XXL: 4` was also preserved when temporarily added

### 5.3 Admin Inventory UI Verification
Verified in the browser:
- inventory page loads
- stat cards show real numbers
- category breakdown shows real stock data
- stock health overview shows real counts
- restock modal opens with per-size rows
- saving a stock change updates inventory data

### 5.4 Storefront Verification
Verified in the browser:
- out-of-stock size buttons become disabled
- disabled size button shows diagonal line overlay
- low-stock size messaging appears
- dynamic size rendering now includes `XXL` when present in `sizeOptions`
- hero image remains eager-loaded
- thumbnails and related images are lazy-loaded

### 5.5 Orders Verification
Verified:
- online order creation stores item size
- admin orders list shows size in item preview
- admin order detail panel shows `Size: ...` badge

### 5.6 Legacy Stock Fallback Verification
A temporary product with:
- stock = `5`
- zero variant rows

was created specifically to test the legacy fallback.

A POS bill was issued against that product with quantity `1`.

Verified outcome:
- product stock became `4`
- product stock did not become `0`

This confirmed the fallback logic is working for non-seeded products.

All temporary verification records created for this test were cleaned up afterward.

## 6. Final Outcome
This work moved inventory from product-level stock only to a safer hybrid model:
- variant-aware where variants exist
- legacy-safe where variants do not yet exist

The major business impact is:
- admins can now see and edit per-size inventory
- storefront customers see real size availability
- order and POS flows deduct stock correctly
- dynamic sizes such as `XXL` are preserved across storefront and admin surfaces
- legacy products no longer risk stock being zeroed during POS checkout

Overall, the inventory system is now materially more accurate, more maintainable, and closer to production-ready behavior across admin and storefront flows.
