# Development Plan - RARE.NP E-Commerce Platform

**Last Updated:** April 2, 2026  
**Completion:** ~85-90%  
**Estimated to Production-Ready:** 40-60 developer hours

---

## Phase 1: Infrastructure & Production Hardening (Do First)

### 1.1 Redis-Backed Rate Limiting
- **Current:** In-memory rate limiter (lost on restart, not multi-instance safe)
- **Task:** Replace with Redis-backed rate limiter using existing Redis connection
- **Files:** `server/middleware/security.ts`
- **Estimate:** 2-3 hours

### 1.2 Health Check Endpoint
- **Task:** Add `/health` endpoint for deployment probes (Railway, etc.)
- **Checks:** Database connectivity, Redis connectivity, disk space
- **Files:** `server/routes.ts`
- **Estimate:** 1-2 hours

### 1.3 Environment Variable Validation
- **Task:** Add startup validation for required env vars with clear error messages
- **Files:** New `server/env.ts` or add to `server/index.ts`
- **Estimate:** 1 hour

### 1.4 Email Configuration Hardening
- **Current:** Hardcoded Gmail credentials in .env
- **Task:** Remove hardcoded fallback, add startup email config validation
- **Files:** `server/email.ts`
- **Estimate:** 1-2 hours

### 1.5 Upload Directory Persistence Check
- **Task:** Validate UPLOADS_DIR writability on startup with clear warning
- **Files:** `server/uploads.ts` or `server/index.ts`
- **Estimate:** 1 hour

---

## Phase 2: Security & Code Quality

### 2.1 Replace Console Logs with Structured Logger
- **Current:** 169+ `console.log` calls in server code
- **Task:** Replace all with `server/logger.ts` structured logger
- **Estimate:** 3-4 hours

### 2.2 Security Header Hardening
- **Current:** CSP uses `unsafe-inline`, HSTS missing `preload`
- **Task:** Tighten CSP, add HSTS preload, review all security headers
- **Files:** `server/middleware/security.ts`
- **Estimate:** 2-3 hours

### 2.3 Database Connection Pool Tuning
- **Task:** Add `max`, `idleTimeoutMillis`, `allowExitOnIdle` settings
- **Files:** `server/db.ts`
- **Estimate:** 1 hour

### 2.4 Build Configuration Cleanup
- **Task:** Separate Replit-specific plugins from production Vite config
- **Files:** `vite.config.ts`
- **Estimate:** 1-2 hours

---

## Phase 3: UI/UX Polish & Frontend Improvements

### 3.1 Legal Pages Content
- **Current:** Placeholder pages for `/shipping`, `/refund`, `/privacy`, `/terms`
- **Task:** Add real content or integrate with a CMS
- **Estimate:** 2-3 hours

### 3.2 Admin Table Virtualization
- **Current:** Large lists (products, orders, customers) render all rows
- **Task:** Add virtual scrolling for tables with 50+ rows
- **Estimate:** 3-4 hours

### 3.3 Server-Side Caching
- **Task:** Add Redis caching for expensive queries (analytics, product listings)
- **Estimate:** 3-4 hours

### 3.4 Contact Page Cleanup
- **Current:** Two contact page files (`Contact.tsx`, `ContactPage.tsx`) - redundancy
- **Task:** Consolidate and clean up
- **Estimate:** 1-2 hours

### 3.5 Image CDN Integration
- **Current:** Cloudinary code exists but not fully integrated
- **Task:** Complete Cloudinary integration for all product/storefront images
- **Estimate:** 3-4 hours

---

## Phase 4: Testing & Reliability

### 4.1 Expand E2E Test Coverage
- **Missing:** POS flow, bills generation, promo codes, marketing, analytics, Canvas
- **Task:** Add E2E specs for all uncovered admin flows
- **Estimate:** 4-6 hours

### 4.2 Proper Drizzle Migrations
- **Current:** Using `db:push` (no rollback)
- **Task:** Set up proper migration workflow with rollback support
- **Estimate:** 2-3 hours

### 4.3 Audit Logging
- **Task:** Add audit logs for store-user creation, login failures, OTP events
- **Estimate:** 2-3 hours

---

## Phase 5: SEO & Accessibility

### 5.1 SEO Improvements
- **Task:** Add sitemap.xml, robots.txt, structured data (JSON-LD), comprehensive meta tags
- **Estimate:** 2-3 hours

### 5.2 Accessibility Audit
- **Task:** WCAG 2.1 AA compliance verification and fixes
- **Estimate:** 3-4 hours

---

## Immediate Next Steps (This Week)

1. **Verify environment setup** - Ensure all services connect (DB, Redis, Meilisearch, Cloudinary)
2. **Create UI/UX Frontend Developer skill** - Set up specialized skill for frontend work
3. **Run health checks** - TypeScript, unit tests, E2E tests
4. **Start Phase 1** - Health check endpoint + env validation (quick wins)

---

## Architecture Quick Reference

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + Vite + TailwindCSS v4 + Radix UI |
| Routing | Wouter |
| State | TanStack Query (server) + Zustand (client) |
| Backend | Express 5 + Passport.js |
| Database | PostgreSQL + Drizzle ORM |
| Cache/Sessions | Redis |
| Search | Meilisearch |
| Storage | Tigris S3 + Cloudinary |
| Monitoring | Sentry |
| Testing | Vitest + Playwright |
