# Payment QR Dynamic Integration Report

Date: 2026-04-05
Project: RARE storefront/admin

## Objective
Implemented dynamic, per-method QR handling for checkout payment flow so eSewa, Khalti, and Fonepay show different QR images, and made QR assets manageable via Admin Images categories.

## Implemented Changes

### 1. Backend: Dynamic QR Endpoint
File: `server/routes.ts`

- Added payment QR category constants:
  - `payment_qr_esewa`
  - `payment_qr_khalti`
  - `payment_qr_fonepay`
- Added default fallback QR URLs for all 3 methods.
- Added public endpoint:
  - `GET /api/storefront/payment-qr`
- Endpoint behavior:
  - Reads latest image from `media_assets` per category.
  - Returns:
    - `esewaQrUrl`
    - `khaltiQrUrl`
    - `fonepayQrUrl`
  - Falls back to defaults when category has no uploaded image.

### 2. Admin Panel: Payment QR Categories
File: `client/src/pages/admin/Images.tsx`

- Extended image category union with:
  - `payment_qr_esewa`
  - `payment_qr_khalti`
  - `payment_qr_fonepay`
- Added visible labels in category selector:
  - Payment QR • eSewa
  - Payment QR • Khalti
  - Payment QR • Fonepay
- Existing upload/update/delete behavior now supports these QR categories.

### 3. Frontend API Helper
File: `client/src/lib/api.ts`

- Added `PaymentQrConfig` interface.
- Added `fetchPaymentQrConfig()` to load dynamic QR config from:
  - `/api/storefront/payment-qr`
- Added client-side fallback payload in case response has no data.

### 4. Checkout Payment Process: Per-Method QR Rendering
File: `client/src/pages/storefront/PaymentProcess.tsx`

- Integrated React Query fetch for dynamic QR config.
- Added normalized method support (`esewa`, `khalti`, `fonepay`, `bank`).
- Updated QR rendering logic to show method-specific QR:
  - eSewa → `esewaQrUrl`
  - Khalti → `khaltiQrUrl`
  - Fonepay → `fonepayQrUrl`
- Removed same-QR-for-all behavior.
- Added method-specific fallback constants to avoid regressions when API data is unavailable.

### 5. Checkout Payment Logos (Previously requested)
File: `client/src/pages/storefront/Checkout.tsx`

- Using high-quality local logo assets:
  - `/images/esewa-logo.png`
  - `/images/khalti-logo.png`
  - `/images/fonepay-logo.png`
- Kept Khalti slight alignment adjustment (`mr-2`) as requested.

## Verification

- TypeScript compile check passed:
  - `npm run check`

## Operational Flow After Deployment

1. Admin uploads QR image under a payment QR category in Admin Images.
2. Storefront payment page fetches `/api/storefront/payment-qr`.
3. Selected method displays its corresponding QR image.
4. If missing, method-specific fallback is shown.

## Notes

- One unrelated untracked file exists locally:
  - `client/public/images/esewa-logo.webp`
- It is not required for this feature implementation.
