# Admin Access Control Core Changes Report (Today Only)

Prepared for: Arnav  
Date: 2026-03-24  
Project: `rr`  
Focus: Role-based access control implementation for the admin portal, including frontend route visibility/guarding and backend API enforcement.

## 1. Executive Summary
Today’s core change was the introduction of a centralized RBAC model for the admin portal.

Before this update:
- admin-capable users were mostly treated as one broad group
- page visibility and backend authorization were not aligned
- restricted roles could still reach many admin APIs if they knew the endpoint

After this update:
- admin access rules are now defined in one shared policy layer
- sidebar visibility, route guarding, login redirects, and backend API protection are all driven from the same role matrix
- restricted roles now receive `403` on protected admin features they should not access

## 2. Role Model Implemented
The following admin-panel roles are now recognized:
- `owner`
- `admin`
- `manager`
- `staff`
- `csr`

Access model implemented:
- `owner`: full admin access
- `admin`: full admin access
- `manager`: staff access plus `marketing`
- `staff`: `products`, `orders`, `customers`, `bills`, `pos`, `promo-codes`
- `csr`: `orders`, `customers`, `bills`

Shared pages allowed to all admin-capable roles:
- `dashboard`
- `profile`
- `notifications`

## 3. Core Changes Implemented

### 3.1 Shared Permission Source of Truth
Primary files:
- `shared/auth-policy.ts`
- `client/src/lib/adminAccess.ts`

What changed:
- Added canonical admin page keys
- Added role normalization and deny-by-default behavior
- Added helpers to determine:
  - whether a user can enter the admin panel
  - which admin pages a role can access
  - the default admin landing page for a role
- Introduced a client-side helper module for admin navigation and redirect logic

Why it matters:
- prevents frontend and backend permission drift
- makes future role additions or permission changes safer and easier

### 3.2 Frontend Route Guarding and Navigation Filtering
Primary files:
- `client/src/components/ProtectedRoute.tsx`
- `client/src/App.tsx`
- `client/src/components/layout/AdminLayout.tsx`
- `client/src/components/layout/Navbar.tsx`
- `client/src/pages/auth/Login.tsx`

What changed:
- Replaced broad `requireAdmin`-only frontend access with page-specific admin guards
- Filtered admin sidebar items based on the current user’s allowed pages
- Updated admin entry points so admin-capable users land on the first allowed page instead of assuming `/admin`
- Updated storefront navbar and login redirect behavior to use the shared role policy
- Added safe redirect behavior when a user manually opens a blocked admin route

Why it matters:
- limited roles no longer see pages they should not use
- direct URL access to blocked admin pages is now handled correctly
- admin routing behavior is consistent across login, navbar entry, and in-app navigation

### 3.3 Backend API Enforcement
Primary files:
- `server/middleware/requireAdmin.ts`
- `server/routes.ts`

What changed:
- Updated `requireAdmin` to use the shared admin-panel role policy
- Added feature-aware backend middleware with page/feature mapping
- Applied backend RBAC by admin feature prefix for:
  - products/categories/attributes/upload-product-image
  - orders
  - analytics
  - customers
  - users/store-users
  - notifications
  - marketing/newsletter/templates/test-email
  - bills
  - pos session APIs
  - logs
  - promo codes
  - images/media
  - storefront image library
  - site assets / landing page management
- Tightened special cases:
  - `GET /api/admin/customers/emails` now requires `marketing`
  - `GET /api/admin/platforms` allows `analytics` or `pos`
  - platform create/delete remains restricted to `analytics`

Why it matters:
- backend now enforces the same access rules as the frontend
- restricted roles cannot bypass UI hiding by calling admin APIs directly

### 3.4 Admin Profile / Management Alignment
Primary file:
- `client/src/pages/admin/Profile.tsx`

What changed:
- Admin-user management visibility is now tied to the shared `store-users` permission instead of a hardcoded `admin` role check
- The “All Admin Users” tab is shown only when the role is allowed to manage store users

Why it matters:
- removes another hardcoded role assumption
- keeps profile-level management features aligned with the new policy model

### 3.5 Test Coverage Updates
Primary files:
- `tests/unit/auth-policy.test.ts`
- `tests/unit/protected-route.test.tsx`
- `tests/unit/require-admin.test.ts`

What changed:
- Added policy coverage for the new role/page matrix
- Added route-guard coverage for blocked page redirects
- Updated middleware tests so `csr` is treated as an admin-panel role under the new access model

## 4. Key Files to Review
Highest-priority review targets:
- `shared/auth-policy.ts`
- `client/src/lib/adminAccess.ts`
- `client/src/components/ProtectedRoute.tsx`
- `client/src/components/layout/AdminLayout.tsx`
- `client/src/App.tsx`
- `server/middleware/requireAdmin.ts`
- `server/routes.ts`

Secondary review targets:
- `client/src/pages/auth/Login.tsx`
- `client/src/components/layout/Navbar.tsx`
- `client/src/pages/admin/Profile.tsx`
- `tests/unit/auth-policy.test.ts`
- `tests/unit/protected-route.test.tsx`
- `tests/unit/require-admin.test.ts`

## 5. Validation and Tests Performed
Validation executed during implementation:
- `npm run check`
- `npm run test:unit -- tests/unit/auth-policy.test.ts tests/unit/protected-route.test.tsx`
- `npm test`
- `npm run check` (final rerun after test fix)

Final result:
- `npm run check`: passed
- `npm test`: passed

Unit test outcome at final state:
- 8 test files passed
- 30 tests passed
- 0 failures

Notable test adjustment:
- `tests/unit/require-admin.test.ts` was updated because `csr` is now intentionally allowed into the admin panel under the new RBAC policy

## 6. Reviewer Notes for Arnav
Suggested review focus:
- verify the page matrix is exactly what product wants for `manager`, `staff`, and `csr`
- verify the backend route grouping matches the intended business boundaries
- verify `dashboard`, `profile`, and `notifications` should remain available to all admin-panel roles
- check whether action-level permissions inside allowed pages are needed as a follow-up phase

## 7. Final Outcome
This change establishes the project’s first coherent end-to-end admin RBAC foundation.

The admin portal now has:
- shared role/page policy definitions
- filtered navigation for limited roles
- guarded page-level routing
- backend API enforcement aligned to the same policy
- updated tests covering the new access behavior

This is a structural security and maintainability improvement, not just a UI visibility change.
