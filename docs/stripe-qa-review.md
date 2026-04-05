# QA Review: Stripe Payment Integration — Core Changes

**Prepared for:** Arnav Pataley (QA)  
**Date:** April 5, 2026  
**Branch:** `main`  
**Status:** Ready for QA Testing  

---

## What Changed

Stripe Checkout has been integrated as a new payment method. Customers can now pay with credit/debit cards via Stripe's hosted checkout page.

---

## Files Modified (12 files)

### Backend (Server-Side)

| File | What Changed | Risk Level |
|------|-------------|------------|
| `server/lib/stripe.ts` | **NEW** — Stripe SDK init, checkout session creation, webhook verification | Medium |
| `server/lib/exchangeRate.ts` | **NEW** — Live USD/NPR rate fetching from free API, cached 1hr | Low |
| `server/routes.ts` | Added 3 endpoints: `create-checkout-session`, `webhook`, `dev-simulate-success`. Fixed `GET /api/orders/:id` to allow guest access | **High** |
| `server/storage.ts` | Added 3 methods for Stripe fields on orders | Low |
| `shared/schema.ts` | Added 4 DB columns to orders table | Medium |

### Frontend (Client-Side)

| File | What Changed | Risk Level |
|------|-------------|------------|
| `client/src/pages/storefront/Checkout.tsx` | Added "Pay by Card" option. Direct redirect to Stripe after order creation | **High** |
| `client/src/pages/storefront/PaymentProcess.tsx` | Added Stripe payment page with redirect button + dev-mode simulate button | Medium |
| `client/src/pages/storefront/OrderSuccess.tsx` | Added "Pay by Card" label | Low |
| `client/src/lib/api.ts` | Added `createCheckoutSession()`, `simulateStripePaymentSuccess()` | Low |
| `client/public/images/stripe-logo.svg` | **NEW** — Stripe logo asset | None |

### Config

| File | What Changed | Risk Level |
|------|-------------|------------|
| `package.json` | Added `stripe` dependency (v22.0.0) | Low |
| `.env.example` | Added Stripe env vars documentation | None |

---

## Test Scenarios (Priority Order)

### 1. Critical — Stripe Checkout Flow (P0)

**Steps:**
1. Add product to cart → Go to checkout
2. Fill in all required fields
3. Select **"Pay by Card"** (shows Stripe logo)
4. Click **"Confirm Order"**

**Expected:** User is immediately redirected to Stripe's hosted checkout page (URL starts with `checkout.stripe.com`)

**Risk:** If this fails, the entire Stripe integration is broken.

---

### 2. Critical — Payment Completion (P0)

**Steps:**
1. On Stripe checkout page, use test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/30`
   - CVC: `123`
   - Name: `Test User`
   - Country: `United States`
   - Postal: `10001`
2. Click "Pay"

**Expected:**
- Payment succeeds
- Redirected to `/order-confirmation/{orderId}?stripe_status=success`
- Order confirmation page loads with full order details
- Payment method shows "Pay by Card"

**Risk:** If order confirmation shows "Order Not Found", the guest access fix didn't work.

---

### 3. Critical — Webhook Payment Verification (P0)

**Steps:**
1. Complete a Stripe payment (scenario 2)
2. Check admin panel → Orders → Find the order
3. Verify order status

**Expected:**
- `stripePaymentStatus` = `succeeded`
- `paymentVerified` = `verified`
- Order status = `processing` (auto-updated from `pending`)

**Risk:** If webhook fails, payments won't be auto-verified. Admin would need to manually verify.

---

### 4. High — Payment Cancellation (P1)

**Steps:**
1. Select "Pay by Card" → Confirm Order
2. On Stripe page, click "← Back to merchant" or close the tab
3. Return to the site

**Expected:**
- Redirected to `/order-confirmation/{orderId}?stripe_status=cancelled`
- Order exists but payment not verified
- User can retry payment

---

### 5. High — Exchange Rate Conversion (P1)

**Steps:**
1. Create a Stripe order with NPR amount (e.g., NPR 3200)
2. Check the Stripe checkout page

**Expected:**
- Amount shown in USD (e.g., ~$21.46 at rate ~149)
- Stripe charges in USD, not NPR

**Risk:** If conversion is wrong, customers get charged incorrect amounts.

---

### 6. Medium — Dev Mode Simulation (P2)

**Steps:**
1. On local dev server, select "Pay by Card" → Confirm Order
2. On payment page, click "Simulate Successful Payment" (amber button)
3. Verify redirect to order confirmation

**Expected:**
- Instant redirect to order confirmation
- Order shows as verified
- **This button should NOT appear on production**

---

### 7. Medium — Other Payment Methods Unaffected (P2)

**Steps:**
1. Test Cash on Delivery flow
2. Test eSewa payment flow
3. Test Khalti payment flow

**Expected:** All existing payment methods work exactly as before. No regression.

---

### 8. Low — Order Success Page Display (P3)

**Steps:**
1. Complete any order
2. View order confirmation page

**Expected:**
- Payment method label shows correctly for each type
- "Pay by Card" for Stripe orders
- No broken UI or missing data

---

## Known Issues Already Fixed

| Issue | Fix Applied |
|-------|-------------|
| Stripe SDK API version mismatch | Upgraded SDK from v17 to v22 |
| Dynamic imports fail in production build | Switched to static imports |
| Webhook body parser conflict | Use `req.rawBody` from global middleware |
| Guest checkout "Order Not Found" | Allow unauthenticated access by order ID |

---

## Environment Variables Required

These must be set on the deployment environment:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://rare-np-production.up.railway.app
```

---

## Test Card Reference

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 3220` | Requires 3D Secure |

**All cards:** Expiry `12/30`, CVC `123`, any name/country/postal

---

## Deployment Status

- [x] Code committed and pushed to `main`
- [x] Railway auto-deployment triggered
- [x] Database migration applied
- [x] Environment variables configured (test mode)
- [x] Production build passes
- [ ] QA testing (Arnav)
- [ ] UAT sign-off
- [ ] Switch to live Stripe keys (when ready)

---

## Contact

- **Developer:** Nikesh Uprety
- **QA:** Arnav Pataley
- **Report:** See `docs/stripe-integration-report.pdf` for full technical details
