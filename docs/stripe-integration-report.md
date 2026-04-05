# Stripe Payment Integration — Implementation Report

**Date:** April 5, 2026  
**Project:** RARE.NP E-Commerce Platform  
**Status:** Production Ready ✅

---

## Executive Summary

Stripe Checkout has been fully integrated into the RARE.NP e-commerce platform, enabling customers to pay with credit/debit cards via Stripe's hosted checkout page. The integration supports live USD/NPR exchange rate conversion, automated payment verification via webhooks, and comprehensive security hardening.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CHECKOUT FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Customer selects "Pay by Card" at checkout                      │
│         ↓                                                        │
│  Order created in DB (status: pending, paymentMethod: stripe)    │
│         ↓                                                        │
│  Server creates Stripe Checkout Session (USD, live exchange rate)│
│         ↓                                                        │
│  Customer redirected to Stripe hosted checkout page              │
│         ↓                                                        │
│  Customer enters card details on Stripe (PCI compliant)          │
│         ↓                                                        │
│  Stripe processes payment → success/failure                      │
│         ↓                                                        │
│  Stripe redirects customer back to /order-confirmation/{id}      │
│         ↓                                                        │
│  Stripe sends webhook → /api/payments/webhook                    │
│         ↓                                                        │
│  Webhook verifies signature → updates order (verified, processing)│
│         ↓                                                        │
│  Bill auto-generated (if status = completed)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `server/lib/stripe.ts` | Stripe SDK initialization, checkout session creation, webhook event construction |
| `server/lib/exchangeRate.ts` | Live USD/NPR exchange rate fetching (open.er-api.com), cached 1 hour, fallback to 148 |
| `client/public/images/stripe-logo.svg` | Stripe logo for payment option button |

### Modified Files
| File | Changes |
|------|---------|
| `shared/schema.ts` | Added 4 columns: `stripePaymentIntentId`, `stripeCheckoutSessionId`, `stripePaymentStatus`, `stripeAmountUsdCents` |
| `server/storage.ts` | Added 3 PgStorage + 3 MemStorage methods for Stripe fields |
| `server/routes.ts` | Added `POST /api/payments/create-checkout-session`, `POST /api/payments/webhook`, `POST /api/payments/dev-simulate-success` (dev only), fixed `GET /api/orders/:id` to allow guest access |
| `client/src/pages/storefront/Checkout.tsx` | Added "Pay by Card" option with Stripe logo, direct redirect to Stripe checkout after order creation |
| `client/src/pages/storefront/PaymentProcess.tsx` | Added Stripe payment flow page with redirect button, dev-mode simulate payment |
| `client/src/pages/storefront/OrderSuccess.tsx` | Added "Pay by Card" payment label, pending verification banner |
| `client/src/lib/api.ts` | Added `createCheckoutSession()`, `simulateStripePaymentSuccess()` client functions |
| `package.json` | Added `stripe` dependency (v22.0.0) |
| `.env.example` | Added Stripe env vars documentation |

---

## Database Schema Changes

```sql
ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE orders ADD COLUMN stripe_payment_status TEXT;
ALTER TABLE orders ADD COLUMN stripe_amount_usd_cents INTEGER;
```

Migration applied via `npm run db:push`.

---

## API Endpoints

### Production Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/payments/create-checkout-session` | Public | Creates Stripe Checkout Session, returns checkout URL |
| `POST` | `/api/payments/webhook` | None (signature verified) | Handles Stripe webhook events |
| `GET` | `/api/orders/:id` | Public (guest) / Auth (owner check) | Fetch order details (fixed for guest checkout) |

### Dev-Only Endpoint

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/payments/dev-simulate-success` | Simulates successful Stripe payment (NODE_ENV !== production only) |

---

## Exchange Rate System

| Component | Detail |
|-----------|--------|
| **Source** | `https://open.er-api.com/v6/latest/USD` (free, no API key) |
| **Current Rate** | ~149 NPR per USD (as of April 2026) |
| **Cache Duration** | 1 hour (in-memory) |
| **Fallback Rate** | 148 NPR per USD |
| **Conversion** | `Math.ceil(nprAmount / rate * 100) / 100` (round up to nearest cent) |
| **Stripe Amount** | Converted to integer cents: `Math.round(usdAmount * 100)` |

---

## Security Hardening

| Security Measure | Implementation |
|------------------|----------------|
| **Webhook Signature Verification** | `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` |
| **Raw Body Handling** | Uses `req.rawBody` from global middleware's `verify` callback (avoids body parser conflict) |
| **Amount Verification** | Server calculates USD amount from order total (client cannot manipulate) |
| **Idempotency** | Checks `stripePaymentStatus === "succeeded"` before processing webhook |
| **Environment Validation** | Warns on startup if Stripe keys are missing |
| **SDK Version** | Stripe SDK v22.0.0 (latest API version: 2026-03-25.dahlia) |
| **Test Mode** | Uses `sk_test_` keys — no real money involved |
| **Dev Simulation** | Separate endpoint only available in development mode |
| **PCI Compliance** | Stripe hosted checkout — card data never touches our servers |

---

## Environment Variables

```env
# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://rare-np-production.up.railway.app
```

---

## Webhook Configuration (Stripe Dashboard)

**Endpoint URL:** `https://rare-np-production.up.railway.app/api/payments/webhook`

**Events Subscribed:**
- `checkout.session.completed` — Payment successful
- `checkout.session.expired` — Session expired without payment
- `payment_intent.payment_failed` — Payment declined/failed

---

## User Flow

### Customer Experience
1. Browse products → Add to cart
2. Go to checkout → Fill shipping details
3. Select **"Pay by Card"** (shows Stripe logo)
4. Click **"Confirm Order"**
5. **Instantly redirected to Stripe hosted checkout** (seamless flow)
6. Enter card details on Stripe's secure page
7. Payment processed → Redirected back to order confirmation
8. Order shows "Payment verified via Stripe"

### Admin Experience
1. Order appears in admin dashboard with `paymentMethod: "stripe"`
2. Payment auto-verified via webhook (no manual verification needed)
3. Order status updates to `processing` automatically
4. Bill auto-generated if applicable

---

## Testing

### Local Development
- **Dev Mode Button:** "Simulate Successful Payment" on payment page (amber button)
- **Real Stripe Test:** Card `4242 4242 4242 4242`, expiry `12/30`, CVC `123`
- **Declined Test:** Card `4000 0000 0000 0002`

### Production (Test Mode)
- Same test cards work on production with `sk_test_` keys
- Switch to `sk_live_` keys when ready for real payments

---

## Known Issues Resolved

| Issue | Fix |
|-------|-----|
| Stripe SDK API version mismatch | Upgraded from v17.7.0 to v22.0.0 |
| Dynamic imports fail in esbuild bundle | Switched to static imports |
| Webhook body parser conflict | Use `req.rawBody` from global middleware |
| Guest checkout "Order Not Found" | Allow unauthenticated access by order ID |

---

## Future Improvements

1. **Live Stripe keys** — Switch from `sk_test_` to `sk_live_` for production payments
2. **Refund support** — Add admin ability to refund Stripe payments
3. **Payment analytics** — Dashboard showing Stripe revenue, success rates
4. **Multiple currencies** — Support for additional currencies beyond USD
5. **Saved cards** — Stripe Customer objects for returning customers
6. **Subscription support** — Recurring payments for subscription products
7. **3D Secure** — Enhanced authentication for high-risk transactions

---

## Deployment Checklist

- [x] Stripe SDK v22.0.0 installed
- [x] Database migration applied (4 new columns)
- [x] Environment variables configured (test keys)
- [x] Webhook endpoint registered in Stripe Dashboard
- [x] Production build passes
- [x] Guest checkout order access fixed
- [x] Dev-mode simulation endpoint implemented
- [x] Security hardening applied
- [x] Code committed and pushed to GitHub
- [x] Railway auto-deployment triggered

---

**Report generated by:** Nikesh Uprety  
**Integration developed:** April 5, 2026
