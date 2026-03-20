# Admin Portal Core Changes Report (Today Only)

Prepared for: Arnav  
Date: 2026-03-20  
Scope: Changes committed on `2026-03-20` (excluding commits from earlier dates).

## Commit Summary (2026-03-20)

### 1) `7968176` - feat: Implemented and fixed and changed a lot of things in the admin portal
Primary focus: Admin portal core overhaul (routing, layout, admin pages, API, and supporting backend wiring).
Key files:
`client/src/components/layout/AdminLayout.tsx`
`client/src/components/layout/TopLoadingBar.tsx`
`client/src/components/ProtectedRoute.tsx`
`client/src/lib/adminApi.ts`
`client/src/pages/admin/Customers.tsx`
`client/src/pages/admin/Images.tsx`
`client/src/pages/admin/Marketing.tsx`
`client/src/pages/admin/Orders.tsx`
`client/src/pages/admin/POS.tsx`
`client/src/pages/admin/Products.tsx`
`client/src/pages/admin/PromoCodes.tsx`
`client/src/pages/admin/StoreUsers.tsx`
`server/middleware/requireAdmin.ts`
`server/routes.ts`
`server/storage.ts`
`server/email.ts`
`shared/schema.ts`

### 2) `7ff0ff0` - refactor: Move "As Seen On Instagram" section ... + update CSP allowlist
Purpose: Security-related update to support Instagram embeds and keep storefront CSP aligned.
Key files:
`client/src/pages/storefront/NewCollection.tsx`
`server/middleware/security.ts`

### 3) `8cc222f` - feat: Enhance storefront functionality by adding a new "Storefront Images" admin page ...
Purpose: Admin-driven image override support for storefront + admin cart activity notifications.
Key files:
`client/src/pages/admin/StorefrontImagePicker.tsx`
`client/src/pages/storefront/Home.tsx`
`client/src/store/cart.ts`
`server/routes.ts`
`server/uploads.ts`
`server/lib/imageService.ts`
`server/storage.ts`
`server/vite.ts`
`vite.config.ts`

### 4) `49cf812` - feat: Introduce uploads persistence configuration (env var support)
Purpose: Make uploads/image persistence configurable for local vs production deployments.
Key files:
`.env.example`
`md/railway_uploads_persistence.md`
`script/smoke-test-uploads.ts`
`server/index.ts`
`server/lib/imageService.ts`
`server/middleware/security.ts`
`server/routes.ts`
`server/vite.ts`

### 5) `e67db2a` - refactor: Simplify order email parameters + consistent shipping fee usage
Purpose: Clean up order email parameter construction and keep shipping fee handling consistent.
Key files:
`.env.example`
`script/smtp-test.ts`
`server/middleware/security.ts`
`server/routes.ts`

### 6) `d2f5813` - feat: Add order confirmation and status update emails
Purpose: Add the missing email triggers/endpoints for order confirmation and order status updates.
Key files:
`server/routes.ts`

### 7) `5388460` - feat: Redesign Atelier page + add a data wipe safeguard to seed script
Purpose: Storefront/seed safety; also includes updates to email-related server code used by workflows.
Key files:
`server/email.ts`
`server/seed.ts`
`client/src/pages/storefront/Contact.tsx`
`client/src/pages/storefront/Home.tsx`
`client/src/pages/storefront/NewCollection.tsx`
`client/src/pages/storefront/ProductDetail.tsx`

## Admin Portal Focus (What to Review)

1. Admin access + portal routing
`client/src/components/ProtectedRoute.tsx`
`server/middleware/requireAdmin.ts`
`client/src/components/layout/AdminLayout.tsx`

2. Admin UI pages updated today
`client/src/pages/admin/Customers.tsx`
`client/src/pages/admin/Images.tsx`
`client/src/pages/admin/Marketing.tsx`
`client/src/pages/admin/Orders.tsx`
`client/src/pages/admin/POS.tsx`
`client/src/pages/admin/Products.tsx`
`client/src/pages/admin/PromoCodes.tsx`
`client/src/pages/admin/StoreUsers.tsx`

3. Admin image/media functionality and persistence
`client/src/pages/admin/StorefrontImagePicker.tsx`
`server/lib/imageService.ts`
`server/storage.ts`
`server/uploads.ts`
`md/railway_uploads_persistence.md`

4. Order email flows (relevant to admin operations)
`server/routes.ts`
`server/email.ts`

## Files Touched (Today) - High Level

Admin portal UI/runtime:
`client/src/components/layout/AdminLayout.tsx`
`client/src/components/layout/TopLoadingBar.tsx`
`client/src/components/ProtectedRoute.tsx`
`client/src/lib/adminApi.ts`
`client/src/pages/admin/*`

Admin portal backend support:
`server/routes.ts`
`server/storage.ts`
`server/uploads.ts`
`server/lib/imageService.ts`
`server/middleware/requireAdmin.ts`

Email + security support:
`server/email.ts`
`server/middleware/security.ts`
`script/smtp-test.ts`

Upload persistence config + verification:
`.env.example`
`md/railway_uploads_persistence.md`
`script/smoke-test-uploads.ts`

