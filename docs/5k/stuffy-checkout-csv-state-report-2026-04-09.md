# Stuffy Checkout + CSV State Report

**Date:** 2026-04-09
**Workspace:** `/home/nikesh/rr`
**Requested by:** Project owner

## 1) Executive Summary

This patch implements the **two-step manual-payment checkout flow** for `eSewa`, `Khalti`, and `Fonepay` so orders are no longer created at checkout submit time for those methods.

New behavior now:
1. Customer fills delivery + contact details in checkout.
2. Customer is routed to payment page.
3. Order is created only when payment screenshot upload is submitted.
4. If proof upload fails after order creation attempt, the order is auto-cancelled as cleanup.
5. On successful payment proof submission, cart is cleared.

## 2) Core Code Changes

### 2.1 Pending checkout staging (manual payments)
- Added pending checkout helpers in:
  - `/home/nikesh/rr/client/src/lib/api.ts`
- New helpers:
  - `cachePendingCheckout(...)`
  - `getPendingCheckout()`
  - `clearPendingCheckout()`
  - `updatePendingCheckoutPaymentMethod(...)`

### 2.2 Checkout flow split by payment type
- Updated:
  - `/home/nikesh/rr/client/src/pages/storefront/Checkout.tsx`
- `cash_on_delivery` and `stripe` still create order on submit.
- `esewa/khalti/fonepay` now:
  - store checkout payload in local storage
  - route to `/checkout/payment?method=<method>`
  - **do not create order yet**

### 2.3 Payment page now finalizes manual payments
- Updated:
  - `/home/nikesh/rr/client/src/pages/storefront/PaymentProcess.tsx`
- When opened without `orderId` but with pending checkout data:
  - on screenshot upload, creates order
  - uploads payment proof
  - if upload fails, attempts `cancelOrder(orderId)` cleanup
  - on success: caches order, clears pending checkout, clears cart, redirects to confirmation

### 2.4 Unit tests updated to match new behavior
- Updated:
  - `/home/nikesh/rr/tests/unit/checkout.test.tsx`
- Adjustments:
  - online manual payments now expect no `createOrder` call from checkout page
  - expect `cachePendingCheckout` and payment-page redirect instead

## 3) Verification Run

## 3.1 Type check
- Command: `npm run check`
- Result: **fails due pre-existing unrelated TS issues**
- Existing failures:
  - `/home/nikesh/rr/client/src/pages/admin/AddProductWizard.tsx` (implicit `any`)
  - `/home/nikesh/rr/client/src/pages/storefront/ProductDetail.tsx` (variant id typing)

## 3.2 Unit tests
- Command: `npm run test:unit`
- Result: **PASS**
- Summary: `10 passed`, `43 passed`

## 3.3 Runtime endpoint smoke checks
- `http://localhost:5000/api/public/page-config` -> `200`
- Active template from response: `stuffyclone` (`isActive: true`)
- `http://localhost:5000/api/admin/dashboard/export` -> `403` (expected without admin auth)
- `http://localhost:5002` -> no active server during check (`000`)

## 4) CSV Export Flow Status

### 4.1 Dashboard export
- Endpoint:
  - `/home/nikesh/rr/server/routes.ts` -> `GET /api/admin/dashboard/export`
- Status: **implemented as last-24-hours export**
- Includes:
  - Products, Purchases, Sales, and Dashboard KPI rows
  - 24h metrics for revenue, COGS, profit, order counts, stock-in, inventory value
  - formula pattern reference rows

### 4.2 Orders export
- Endpoint:
  - `/home/nikesh/rr/server/routes.ts` -> `GET /api/admin/orders/export`
- Status: still exports full order history (all orders)
- Note: This is separate from dashboard 24h export behavior.

## 5) Current Risks / Remaining Work

1. TypeScript build gate still blocked by unrelated existing TS errors.
2. Manual-payment anti-clutter rule is significantly improved, but if create-order succeeds and cancellation cleanup fails during proof upload failure, a cancelled/partial record can still briefly exist.
3. Full browser E2E against `localhost:5002` could not be executed because that server was offline during this run.

## 6) Suggested Next Fixes (Priority)

1. Add a dedicated backend endpoint: `POST /api/orders/create-with-payment-proof` (single atomic flow).
2. Resolve current TS errors in `AddProductWizard.tsx` and `ProductDetail.tsx` to restore `npm run check` green.
3. Add Playwright E2E for:
   - manual payment happy path
   - manual payment upload fail path
   - cart cleared after order complete
4. If required, align `/api/admin/orders/export` to 24h-only behavior too, or keep full-history and rename button labels clearly.

## 7) Final Status

The requested checkout clutter fix for manual methods is now implemented with two-step behavior and unit coverage updated.

