# Admin Dashboard Export 24h Update Report

Date: 2026-04-09
Project: Rare Atelier / Stuffy template branch workspace

## 1) Objective Completed
Implemented a new admin export workflow so the **Dashboard Export** button now downloads a **last-24-hours CSV report** instead of lifetime order history.

## 2) Core Changes Implemented

### Backend
- Added and stabilized endpoint:
  - `GET /api/admin/dashboard/export`
  - File: `/home/nikesh/rr/server/routes.ts`
- Export logic now includes 24h-scoped data for:
  - Active products snapshot
  - Inventory stock-in movements
  - Sales rows from orders + order items (excluding cancelled)
  - Store vs POS split
  - KPI summary metrics (Revenue, COGS, Profit, Orders, Units Sold, Inventory Value, Low/Out stock count)
- CSV includes workbook-style helper rows for formula model compatibility:
  - `IFERROR(VLOOKUP(...))`
  - `SUMIF(...) - SUMIF(...)`
  - `IF(cell="","",...)`

### Frontend
- Dashboard export action changed to new endpoint:
  - File: `/home/nikesh/rr/client/src/pages/admin/Dashboard.tsx`
  - `Export Report` now calls `exportDashboard24hCSVInstant()`
- Added new API helpers:
  - File: `/home/nikesh/rr/client/src/lib/adminApi.ts`
  - `exportDashboard24hCSV()`
  - `exportDashboard24hCSVInstant()`

## 3) Behavior Change (Before vs After)
- Before:
  - Dashboard export downloaded `/api/admin/orders/export`
  - Output was lifetime order-oriented CSV
- After:
  - Dashboard export downloads `/api/admin/dashboard/export`
  - Output is 24-hour operational analytics CSV for easier spreadsheet analysis

## 4) Testing Performed

### A) Type Check
Command:
- `npm run check`

Result:
- **Failed** due to pre-existing TypeScript issues unrelated to this export patch:
  - `/home/nikesh/rr/client/src/pages/admin/AddProductWizard.tsx` (implicit `any` for `color`)
  - `/home/nikesh/rr/client/src/pages/storefront/ProductDetail.tsx` (variant `id` type mismatch)

### B) Unit Test Suite
Command:
- `npm run test:unit`

Result:
- **Passed**
- 10 test files passed
- 43 tests passed
- 0 failed

### C) Endpoint Access Smoke Check
Command:
- `curl -i http://localhost:5000/api/admin/dashboard/export`

Result:
- Returned `403 Forbidden` when unauthenticated (expected behavior for admin-protected route)

## 5) Current Status
- New 24h dashboard export workflow is implemented and wired to the dashboard UI.
- Unit tests pass.
- Global TS check still fails because of unrelated pre-existing typing issues.

## 6) Recommended Next Fixes
1. Fix TS typing issues in `AddProductWizard.tsx` and `ProductDetail.tsx` to restore clean `npm run check`.
2. Optionally align other admin export buttons (Orders/Customers/Analytics) to the same workbook-style CSV layout if you want one consistent spreadsheet workflow everywhere.
3. Add a tiny CSV export validation test (header + required sections) for regression safety.
