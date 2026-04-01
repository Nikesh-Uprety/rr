# RARE.NP — Codex Project Context

## Overview
- Project: `RARE.NP`
- Type: fashion e-commerce website with storefront, checkout, online payment proof flow, POS, and internal admin portal
- Workspace root: `/home/nikesh/rr`

## Current Stack
- Frontend: React, Vite, TailwindCSS, Wouter, TanStack Query, Zustand
- Backend: Node.js, Express
- Database: Neon PostgreSQL via Drizzle ORM
- Auth: Passport session auth with role-aware access control
- Testing:
  - Unit/integration: Vitest
  - Browser E2E: Playwright

## Quick Condition Snapshot
- Overall condition: functional with core commerce and admin flows covered by automated tests
- Storefront:
  - product browsing, cart, checkout, order confirmation, and payment-proof upload are implemented
  - guest checkout path has been stabilized with local order caching and cart persistence
- Admin:
  - order verification and product CRUD flows are covered in browser tests
  - store-user onboarding now enforces first-login OTP setup
- Auth/security:
  - OTP code is no longer leaked in login responses
  - plaintext passwords are no longer emailed to internal users
  - expired OTP codes are rejected, and resend now refreshes unused expired OTP sessions
- Test health:
  - typecheck is green
  - unit auth and regression tests are green
  - onboarding OTP browser coverage passes on dedicated E2E server

## Main App Areas
- Storefront:
  - home page
  - products and product detail
  - cart
  - checkout
  - payment proof upload
  - order confirmation
- Admin panel:
  - dashboard
  - orders
  - products
  - store users
  - customers
  - bills
  - POS
  - promo codes
  - notifications
  - profile

## Auth and Security Notes
- Internal roles currently treated as admin-panel roles:
  - `admin`
  - `owner`
  - `manager`
  - `staff`
- Shared role policy lives in `shared/auth-policy.ts`
- First-login 2FA onboarding is implemented for newly created internal users
- User model includes `requires_2fa_setup`
- Login must not expose OTP codes in API responses
- Store-user welcome emails must not include plaintext passwords
- `E2E_TEST_MODE=1` disables outbound email sending for deterministic browser tests

## Most Recent Core Changes
- Added migration: `migrations/0001_add_requires_2fa_setup.sql`
- Enforced first-login OTP setup for new internal users
- Removed OTP leakage from login responses
- Removed plaintext password from store-user welcome email
- Added shared auth-role policy for backend and frontend
- Added route-level auth tests and onboarding Playwright coverage
- Fixed expired OTP resend flow so unused expired sessions can be refreshed
- Added dedicated browser coverage for:
  - admin order verification
  - admin product CRUD
  - first-login OTP setup
  - expired OTP rejection plus resend recovery
- Added E2E-safe email bypass for browser test runs

## Important Backend Files
- `server/routes.ts`: main API route registration
- `server/authHandlers.ts`: login, verify-2fa, and store-user auth handlers
- `server/auth.ts`: Passport auth/session wiring
- `server/storage.ts`: DB-backed application storage
- `server/email.ts`: SMTP and E2E mail bypass logic
- `server/middleware/requireAdmin.ts`: admin route guard
- `shared/schema.ts`: Drizzle schema definitions

## Important Frontend Files
- `client/src/pages/auth/Login.tsx`: login + OTP flow
- `client/src/components/ProtectedRoute.tsx`: route protection
- `client/src/pages/admin/StoreUsers.tsx`: internal user management
- `client/src/pages/admin/Orders.tsx`: admin order workflow
- `client/src/pages/admin/Products.tsx`: product CRUD
- `client/src/pages/admin/POS.tsx`: point-of-sale flow
- `client/src/pages/storefront/Checkout.tsx`: checkout flow
- `client/src/pages/storefront/PaymentProcess.tsx`: payment proof flow
- `client/src/pages/storefront/OrderSuccess.tsx`: post-checkout confirmation
- `client/src/store/cart.ts`: cart state

## Session Start Checklist
Use this at the beginning of a new Codex session inside this project.

### 1. Read project health quickly
- Read this file first
- Check git state:
```bash
git status --short
```

### 2. Run fast code health checks
```bash
npm run check
npm run test:unit
```

### 3. Start a dedicated E2E server for browser validation
Use this instead of a mixed local dev server when verifying core flows:
```bash
E2E_TEST_MODE=1 PORT=5001 npm run dev
```

### 4. Run core browser checks
These are the highest-signal flows for current project stability:
```bash
PLAYWRIGHT_USE_EXISTING=1 PORT=5001 npx playwright test tests/e2e/admin-onboarding.spec.ts
PLAYWRIGHT_USE_EXISTING=1 PORT=5001 npx playwright test tests/e2e/admin.spec.ts
PLAYWRIGHT_USE_EXISTING=1 PORT=5001 npx playwright test tests/e2e/storefront.spec.ts
```

### 5. What these browser checks verify
- `admin-onboarding.spec.ts`
  - first-login OTP setup
  - expired OTP rejection
  - resend recovery
- `admin.spec.ts`
  - admin order verification
  - payment-proof flow integration
  - product create/edit/delete
- `storefront.spec.ts`
  - storefront purchase path
  - checkout and order confirmation path

## Automatic Core Verification Commands
Use these commands as the default project-health routine before significant work:

```bash
npm run check
npm run test:unit
PLAYWRIGHT_USE_EXISTING=1 PORT=5001 npx playwright test tests/e2e/admin-onboarding.spec.ts
PLAYWRIGHT_USE_EXISTING=1 PORT=5001 npx playwright test tests/e2e/admin.spec.ts
```

Optional wider browser coverage:
```bash
PLAYWRIGHT_USE_EXISTING=1 PORT=5001 npx playwright test tests/e2e/storefront.spec.ts
PLAYWRIGHT_USE_EXISTING=1 PORT=5001 npx playwright test tests/e2e/admin-smoke.spec.ts
```

## Testing Notes
- Playwright config: `playwright.config.ts`
- E2E helpers:
  - `tests/e2e/helpers.ts`
  - `tests/e2e/db.ts`
- Key browser specs:
  - `tests/e2e/admin.spec.ts`
  - `tests/e2e/admin-onboarding.spec.ts`
  - `tests/e2e/storefront.spec.ts`
  - `tests/e2e/admin-smoke.spec.ts`
- Onboarding specs are now self-contained and do not depend on the shared Playwright setup project

## Conventions
- Prefer existing patterns over introducing new abstractions without need
- Avoid new dependencies unless justified
- Keep admin and storefront styling aligned with the current design language
- Use stable selectors for E2E where UI text is brittle
- Preserve role and auth behavior when changing login, onboarding, checkout, or order flows

## Suggestions For Future Improvement

### Security
- Replace admin-shared passwords with invite-token or set-password onboarding
- Add rate limiting specifically for login, resend-OTP, and verify-OTP endpoints
- Add audit logs for:
  - store-user creation
  - login failures
  - OTP resend
  - OTP verification success/failure
  - admin access denials
- Confirm production cookies use `secure` and appropriate `sameSite`

### Performance
- Reduce heavy admin page startup requests by deferring non-critical dashboard queries
- Review image optimization and upload processing for large product/media assets
- Add selective query invalidation instead of broad refetches after admin mutations

### Reliability
- Move more E2E flows onto a dedicated test seed/reset path
- Add CI-level browser runs on a clean port with deterministic data
- Add a health endpoint for Playwright readiness instead of probing `/`

### UX / Responsiveness
- Audit mobile admin usability, especially:
  - products
  - orders
  - POS
  - store users
- Review checkout validation and payment instructions for smaller screens
- Add clearer resend/expiry feedback in the OTP UI

### Product / Operations
- Expand regression coverage for:
  - POS sales completion
  - bills generation
  - promo code creation and application
  - marketing/notification pages
- Add a documented role-permission matrix for admin, owner, manager, staff, and csr

## Current Review Artifacts
- `docs/test-report-arnav-review.md`
- `docs/test-report-arnav-review.pdf`
- `docs/auth-otp-regression-report-arnav.md`
- `docs/auth-otp-regression-report-arnav.pdf`
