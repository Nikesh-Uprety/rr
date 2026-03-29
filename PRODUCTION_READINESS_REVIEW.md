# Production Readiness Review & Optimization Plan

**Date:** 2026-03-25
**Status:** CRITICAL ISSUES IDENTIFIED - Must be addressed before launch
**Goal:** Optimize for performance, stability, and reliability in production

---

## Executive Summary

The RARE Nepal e-commerce platform is functionally complete with core commerce flows working. However, several **critical production-ready issues** must be fixed before launching for a client. This document provides a prioritized action plan to ensure the application is fast, stable, and crash-resistant in production.

### Risk Assessment

| Category | Risk Level | Status |
|----------|------------|--------|
| **Database Performance** | 🔴 HIGH | Poorly optimized queries, missing indexes |
| **Rate Limiting** | 🔴 HIGH | In-memory store fails across multiple instances |
| **Email Configuration** | 🔴 HIGH | Hardcoded fallbacks, no validation |
| **Logging Pollution** | 🟡 MEDIUM | 169+ console calls, no production separation |
| **File Uploads** | 🟡 MEDIUM | No persistence guarantee, no cleanup |
| **Security Headers** | 🟡 MEDIUM | CSP uses unsafe-inline, weak HSTS |
| **Error Handling** | 🟢 LOW | Generally good, some gaps |
| **Monitoring** | 🔴 HIGH | No health checks, no metrics |
| **Build Configuration** | 🟢 LOW | Works but has warnings |

---

## Critical Blockers (Must Fix Before Launch)

### 1. 🔴 Database Query Optimization & Indexes

**Problem:**
- No indexes on frequently queried columns (email, status, categories, dates)
- Analytics queries use raw SQL intervals that won't scale with large datasets
- N+1 query risks in storage layer (some queries fetch related data inefficiently)
- No query result caching

**Impact:**
- Slow page loads under load
- Database CPU spikes
- Potential timeout crashes

**Fixes Required:**

```sql
-- Add these indexes to shared/schema.ts and create a migration
-- Or run manually in production database:

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_verified ON orders(payment_verified) WHERE payment_verified IS NULL;

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_home_featured ON products(home_featured) WHERE home_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_ranking ON products(ranking);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock) WHERE stock > 0;

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Bills indexes
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

-- OTP tokens indexes
CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_id ON otp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at);

-- Media assets
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets(category);
```

**Action Items:**
- [ ] Create Drizzle migration file with all indexes
- [ ] Test query performance before/after with EXPLAIN ANALYZE
- [ ] Optimize `getAnalytics()` to use materialized views or caching for large date ranges
- [ ] Consider adding Redis caching for frequently accessed data (products, categories)

**File to modify:** `shared/schema.ts` (add indexes via migration)

---

### 2. 🔴 Replace In-Memory Rate Limiting with Redis

**Problem:**
- `server/middleware/security.ts` uses in-memory object `rateLimitStore`
- Won't work with multiple server instances (load balancing)
- Data lost on server restart
- Memory grows unbounded

**Impact:**
- Rate limiting ineffective in production (unless single instance)
- Potential security vulnerability
- OOM crash risk under sustained attack

**Fixes Required:**

**Option A (Recommended - Redis):**
```bash
npm install connect-redis redis
```

```typescript
// server/middleware/rateLimit.ts (new file)
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

export function createRateLimitMiddleware() {
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rate-limit:',
    }),
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
  });
}
```

**Option B (Quick fix if no Redis):**
- Use database-backed store (PostgreSQL)
- Or deploy as single instance (not recommended for production)

**Action Items:**
- [ ] Add Redis to dependencies if not already present
- [ ] Configure Redis connection (add REDIS_URL to `.env`)
- [ ] Replace in-memory rate limiter with Redis store
- [ ] Apply to all rate-limited routes: `/api/auth/register`, `/api/contact`, `/api/newsletter/subscribe`
- [ ] Consider adding rate limiting to login endpoint

---

### 3. 🔴 Email Configuration Validation & Reliability

**Problem:**
- `server/email.ts` has hardcoded fallback sender email: `upretynikesh021@gmail.com`
- No validation that SMTP credentials are valid on startup
- Email errors silently caught and only logged (user never knows if email failed)
- No retry logic, no queue

**Impact:**
- Emails sent from wrong address in production
- Critical OTP and order emails may fail silently
- Poor user experience

**Fixes Required:**

```typescript
// server/email.ts - fix hardcoded values
const SENDER_EMAIL = process.env.SENDER_EMAIL || process.env.SMTP_USER;
const SENDER_NAME = process.env.SENDER_NAME || "RARE Nepal";

// Add startup validation
export async function validateEmailConfig(): Promise<boolean> {
  if (!isSMTPConfigured) {
    logger.error("Email configuration incomplete", {
      missing: !SMTP_HOST && "SMTP_HOST",
      missing: !SMTP_USER && "SMTP_USER",
      missing: !SMTP_PASS && "SMTP_PASS"
    });
    return false;
  }

  try {
    await transporter.verify();
    logger.info("Email service validated successfully");
    return true;
  } catch (err) {
    logger.error("Email service validation failed", { error: err });
    return false;
  }
}

// Call in server/index.ts startup
await validateEmailConfig();
```

**Environment Variables to Add:**
```
SENDER_EMAIL=your-business-email@domain.com
SENDER_NAME=RARE Nepal
```

**Action Items:**
- [ ] Remove hardcoded fallback email
- [ ] Add startup validation with `transporter.verify()`
- [ ] Throw error if SMTP misconfigured in production (fail fast)
- [ ] Add alerts/monitoring for email failures
- [ ] Consider email queue (Bull/Redis) for reliability

---

### 4. 🔴 Add Health Check & Monitoring Endpoints

**Problem:**
- No health check endpoint for Kubernetes/Render liveness/readiness probes
- No metrics endpoint for monitoring
- No way to verify app is working without full request

**Impact:**
- Can't automate deployment health checks
- Unaware of crashes/downtime
- Hard to debug production issues

**Fixes Required:**

```typescript
// server/health.ts (new file)
import { db } from './db';
import { storage } from './storage';

export async function healthCheck(): Promise<{
  status: 'ok' | 'error';
  timestamp: string;
  checks: {
    database: boolean;
    redis?: boolean;
    storage: boolean;
    uptime: number;
  };
}> {
  const checks = {
    database: false,
    storage: false,
    uptime: process.uptime(),
  };

  // Check database
  try {
    await db.execute('SELECT 1');
    checks.database = true;
  } catch (err) {
    checks.database = false;
  }

  // Check storage
  try {
    await storage.getCategories();
    checks.storage = true;
  } catch (err) {
    checks.storage = false;
  }

  // Check Redis if configured
  if (process.env.REDIS_URL) {
    try {
      // Add Redis check
      checks.redis = true;
    } catch {
      checks.redis = false;
    }
  }

  const healthy = checks.database && checks.storage;
  return {
    status: healthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    checks,
  };
}

// In server/index.ts, add route:
app.get('/health', async (req, res) => {
  const result = await healthCheck();
  res.json(result);
});
```

**Action Items:**
- [ ] Create `/health` endpoint (liveness + readiness combined)
- [ ] Return JSON with component statuses
- [ ] Configure Render health check in render.yaml
- [ ] Add Prometheus metrics endpoint (optional but valuable)
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)

---

### 5. 🔴 Fix Production Build Configuration

**Problem:**
- `script/build.ts` uses top-level await in conditional imports (Vite plugins)
- `import.meta` usage with CJS format causes warnings
- Build currently works but is fragile

**Impact:**
- Build may fail in future Node/esbuild versions
- Unclear errors during CI/CD

**Fixes Required:**

`vite.config.ts` - Remove Replit-specific plugins from production build:

```typescript
// Move conditional plugin loading to separate config or remove for production
// Current code at lines 31-41 causes esbuild issues

// Change to:
const isDevelopment = process.env.NODE_ENV !== "production";

const plugins = [
  react(),
  runtimeErrorOverlay(),
  tailwindcss(),
  metaImagesPlugin(),
  viteImagemin({...}),
];

// Only add Replit plugins in development (not during build)
if (isDevelopment && process.env.REPL_ID !== undefined) {
  // These plugins are only for Replit dev environment
  // They don't need to be in the build config at all
  const { cartographer } = await import("@replit/vite-plugin-cartographer");
  plugins.push(cartographer());
  const { devBanner } = await import("@replit/vite-plugin-dev-banner");
  plugins.push(devBanner());
}

export default defineConfig({
  plugins,
  // ... rest
});
```

**Better approach:** Separate `vite.config.dev.ts` and `vite.config.prod.ts`

**Action Items:**
- [ ] Remove Replit-specific plugins from production build path
- [ ] Ensure `npm run build` produces clean bundle without errors
- [ ] Test build in production-like environment

---

### 6. 🔴 Improve Session Cookie Security

**Problem:**
- Session cookie `maxAge: 7 days` is long but no sliding expiration
- Cookie `secure` flag only set in production, but should also require HTTPS
- No `SameSite` configuration (defaults to Lax, which is okay but should be explicit)
- No session regeneration on login (fixation vulnerability)

**Impact:**
- Session security could be improved
- Vulnerable to session fixation attacks

**Fixes Required:**

```typescript
// server/index.ts - session configuration
const sessionMiddleware = session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production", // true in prod
    httpOnly: true,
    sameSite: 'lax' as const, // explicit
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
});

// Add session regeneration on login
// In authHandlers.ts, after successful password check:
req.session.regenerate((err) => {
  if (err) {
    return done(err);
  }
  req.login(user, (err) => {
    // ...
  });
});
```

**Action Items:**
- [ ] Add `sameSite: 'lax'` to session cookie
- [ ] Regenerate session on login (prevent fixation)
- [ ] Consider shorter session duration (e.g., 1 day) with refresh mechanism
- [ ] Ensure HTTPS only in production (set `secure: true`, use proxy)

---

## High Priority (Fix Soon)

### 7. 🟡 Reduce Console Logging Volume

**Problem:**
- 169+ `console.log/warn/error` calls in server code
- Console used for request logging (already done by middleware)
- Leftover debug logs will pollute production logs

**Impact:**
- Log noise makes debugging harder
- Performance overhead (string concatenation, JSON.stringify)
- Sensitive data may be leaked

**Fixes Required:**

```typescript
// Replace console logs with logger
// Search: console.log, console.warn, console.error
// Replace with: logger.info(), logger.warn(), logger.error()

// Examples from routes.ts to fix:
- console.log(`[SMTP] OTP email sent to: ${to}`) → logger.info()
- console.warn() → logger.warn()
- console.error() → logger.error()

// Remove or guard debug logs:
if (process.env.NODE_ENV === 'development') {
  console.log('debug info');
}
```

**Action Items:**
- [ ] Audit all `console.*` calls in `server/routes.ts` (92 instances)
- [ ] Replace with `logger` service
- [ ] Remove any remaining debug logs or guard with `NODE_ENV !== 'production'`
- [ ] Set up log aggregation (Papertrail, LogDNA) in production

---

### 8. 🟡 Database Connection Pool Sizing

**Problem:**
- Default Pool configuration with no explicit limits
- `connectionTimeoutMillis: 5000` is good
- Missing: `max`, `idleTimeoutMillis`, `connectionLimit`

**Impact:**
- Too many connections can overwhelm PostgreSQL
- Too few causes request queuing and timeouts

**Fixes Required:**

```typescript
// server/db.ts
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000, // close idle connections after 30s
  max: 20, // adjust based on instance size (usually 2-4 per GB RAM)
  allowExitOnIdle: true, // important for serverless
});
```

**Action Items:**
- [ ] Set `max` connections based on Render instance size
- [ ] Add `idleTimeoutMillis: 30000`
- [ ] Monitor connection count in production
- [ ] Document expected pool size for scaling

---

### 9. 🟡 File Uploads: Persistence & Validation

**Problem:**
- Uploads stored in `UPLOADS_DIR` but no validation of persistent storage in production
- No automatic cleanup of orphaned files
- No size validation beyond multer limit (5MB per file)
- No virus scanning (security risk)

**Impact:**
- Uploads may be lost on container restart if volume not mounted
- Disk space can fill up over time
- Security vulnerability if malicious files uploaded

**Fixes Required:**

**Persistence Check on Startup:**
```typescript
// server/index.ts - add early check
const uploadsWritable = await fs.promises.access(UPLOADS_DIR, fs.constants.W_OK)
  .then(() => true)
  .catch(() => false);

if (!uploadsWritable) {
  logger.error("Uploads directory not writable", { dir: UPLOADS_DIR });
  if (process.env.NODE_ENV === 'production') {
    throw new Error("Uploads directory must be writable in production");
  }
}
```

**Add Upload Cleanup Job:**
```typescript
// Run daily to cleanup orphaned files
async function cleanupOrphanedUploads() {
  // Query mediaAssets table for all registered files
  // Delete files in uploads dir not in database
  // Run via cron or setInterval in production only
}
```

**Action Items:**
- [ ] Add startup writability check for `UPLOADS_DIR`
- [ ] Ensure Render volume mounted at `/uploads` and `UPLOADS_DIR=/uploads`
- [ ] Implement periodic cleanup of orphaned files
- [ ] Consider adding file size limits in `.env` (UPLOAD_MAX_SIZE)
- [ ] Add virus scanning integration (ClamAV) for security

---

### 10. 🟡 Security Header Hardening

**Problem:**
- CSP includes `'unsafe-inline'` for scripts and styles (reduces XSS protection)
- HSTS includes `includeSubDomains` but not `preload`
- No `X-Permitted-Cross-Domain-Policies`
- No `Referrer-Policy` set (it is set, good)

**Fixes Required:**

```typescript
// server/middleware/security.ts

// 1. Remove unsafe-inline from CSP (requires refactoring inline scripts/styles)
// Current:
// "script-src 'self' 'unsafe-inline' https://www.instagram.com"
// Better: use nonce or hash for inline scripts, or move to external files
// If not feasible immediately, keep but monitor as TODO

// 2. Add preload to HSTS (requires 1+ year of max-age and register with Chrome)
res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

// 3. Add missing headers:
res.set("X-Permitted-Cross-Domain-Policies", "none");
res.set("Cross-Origin-Embedder-Policy", "require-corp"); // optional, breaks some embeds
res.set("Cross-Origin-Opener-Policy", "same-origin"); // optional

// 4. Add Content-Type-Options with nosniff (already present ✓)
```

**Action Items:**
- [ ] Audit inline scripts/styles in frontend; remove or use nonce/hash
- [ ] Update CSP to remove `'unsafe-inline'` after refactoring
- [ ] Add `preload` to HSTS (minimum 2 years)
- [ ] Add `X-Permitted-Cross-Domain-Policies: none`
- [ ] Consider adding COOP/COEP headers for Spectre/meltdown protection

---

### 11. 🟡 Image Optimization & CDN

**Problem:**
- Images stored and served locally from `/uploads`
- No caching headers set on static uploads
- Multiple image sizes not generated (only WebP via sharp)
- No CDN in front (bandwidth costs, latency)

**Impact:**
- Slow image loading globally
- High bandwidth costs
- Poor SEO (page speed)

**Fixes Required:**

**Option A (Quick):**
```typescript
// Add cache headers for static uploads
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '1y',
  immutable: true,
  etag: true,
  lastModified: true,
}));
```

**Option B (Recommended for production):**
- Integrate Cloudinary or similar CDN
- Upload all images to Cloudinary in `processAndStoreImage()`
- Replace local file serving with Cloudinary URLs
- Use transforms for different sizes

**Action Items:**
- [ ] Set cache-control headers on static uploads (1 year)
- [ ] Generate multiple sizes (thumbnail, medium, large) on upload
- [ ] Plan Cloudinary integration (already have code in `lib/cloudinary.ts`)
- [ ] Migrate existing uploads to CDN

---

### 12. 🟡 Client-Side Performance

**Problem:**
- Large bundle size (all admin pages lazy-loaded but Home, Products, Cart, etc. load eagerly?)
- No code splitting granularity
- No resource hints (preload, prefetch)
- Heavy components (POS.tsx 85KB, Products.tsx 139KB, Analytics.tsx 45KB) load on demand but could be optimized

**Impact:**
- Slow initial page load
- Poor mobile experience
- Higher bounce rate

**Fixes Required:**

**Bundle Analysis:**
```bash
npm install -D rollup-plugin-visualizer
# Add to vite.config.ts to generate bundle analysis
```

**Optimization Steps:**
1. Verify all admin pages are lazy-loaded (already done ✓ - check `App.tsx`)
2. Add resource hints for critical assets
3. Optimize images (already using WebP ✓)
4. Consider reducing React Query staleTime (currently 5min - okay)
5. Implement virtual scrolling for large lists (products, orders, customers tables)

**Action Items:**
- [ ] Generate bundle analyzer report
- [ ] Identify largest dependencies (jspdf, html2canvas, recharts, leaflet)
- [ ] Lazy load heavy admin-only libraries dynamically
- [ ] Add `<link rel="preload">` for critical fonts, CSS
- [ ] Audit mobile performance with Lighthouse

---

## Medium Priority (Important but Not Blocking)

### 13. 🟢 Error Handling & Monitoring Gaps

**Problem:**
- No Sentry/error tracking service configured
- No alerting on production errors
- Error logs only in console
- No request ID correlation across services

**Fixes Required:**
- [ ] Add Sentry SDK
- [ ] Set up alerts for 5xx errors
- [ ] Correlate logs with request IDs
- [ ] Implement dead letter queue for failed email

---

### 14. 🟢 Database Migration Strategy

**Problem:**
- Using `drizzle-kit push` (schema sync) not proper migrations
- No rollback capability
- Schema drift risk in production

**Fixes Required:**
- [ ] Use `drizzle-kit generate` to create proper migration files
- [ ] Store migrations in version control
- [ ] Create migration runner for production
- [ ] Document rollback procedure

---

### 15. 🟢 Cache Strategy Implementation

**Problem:**
- React Query caches client-side only
- No server-side caching (Redis) for expensive queries
- Analytics queries hit database on every page load

**Fixes Required:**
- [ ] Add Redis for caching:
  - Product listings (5 min)
  - Categories (1 hour)
  - Analytics (5 min)
- [ ] Implement cache invalidation on data changes
- [ ] Add cache headers for public API responses

---

### 16. 🟢 Environment Variable Validation

**Problem:**
- No validation that required env vars are set on startup
- Silent failures when vars missing
- Hard to debug in production

**Fixes Required:**

```typescript
// config/validate.ts
const REQUIRED_VARS = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
];

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

---

### 17. 🟢 Admin Performance Optimization

**Problem:**
- Admin pages like POS, Products, Orders fetch large datasets without pagination or limits
- Dashboard analytics queries hit database directly on load
- No loading states or skeleton screens consistently

**Fixes Required:**
- [ ] Paginate all admin tables (Products, Orders, Customers, Bills)
- [ ] Debounce search inputs
- [ ] Add table virtualization for large datasets
- [ ] Cache dashboard KPIs for 5 minutes
- [ ] Implement "optimistic updates" for mutations

---

### 18. 🟢 Payment Integration Robustness

**Problem:**
- Payment proof upload limited to 5MB (may be too small for high-res photos)
- No retry logic for failed uploads
- Payment verification flow could be clearer

**Fixes Required:**
- [ ] Increase limit to 10-20MB for payment proofs
- [ ] Add resume/retry for large uploads
- [ ] Show clear upload progress
- [ ] Validate image dimensions (minimum 800x600)

---

## Low Priority (Nice to Have)

### 19. ⚪ Testing Improvements

- Add unit tests for storage layer (currently sparse)
- Increase E2E coverage for edge cases
- Add performance regression tests
- Set up CI/CD with automated tests

---

### 20. ⚪ Infrastructure & DevOps

- Set up CDN (Cloudflare or Cloudinary)
- Configure backup strategy for database
- Implement blue-green or canary deployments
- Add database connection pooling metrics
- Set up APM (New Relic, Datadog)

---

### 21. ⚪ SEO & Accessibility

- Add proper meta tags and Open Graph
- Implement sitemap.xml
- Add structured data (JSON-LD)
- WCAG 2.1 AA accessibility audit
- Image alt text review

---

## Quick Wins (Can Do Immediately)

1. ✅ Fix hardcoded email in `server/email.ts` (5 min)
2. ✅ Add health endpoint `/health` (15 min)
3. ✅ Add database pool limits (5 min)
4. ✅ Replace console logs with logger (1 hour)
5. ✅ Add environment validation (10 min)
6. ✅ Add cache headers to uploads (5 min)
7. ✅ Add indexes on `orders.email`, `orders.created_at`, `products.category` (10 min)

Total: ~2 hours for critical quick wins

---

## Recommended Launch Timeline

### Week 1 (Critical)
- [ ] Day 1-2: Database indexes + performance testing
- [ ] Day 2-3: Rate limiting with Redis
- [ ] Day 3: Email config validation
- [ ] Day 4: Health check endpoint + monitoring setup
- [ ] Day 5: Build configuration fixes
- [ ] Day 6: Security headers hardening
- [ ] Day 7: Testing & load testing

### Week 2 (High Priority)
- [ ] Database connection pool tuning
- [ ] File upload persistence validation
- [ ] Image caching/CDN
- [ ] Client-side performance audit
- [ ] Error monitoring (Sentry)

### Week 3 (Polishing)
- [ ] Admin pagination
- [ ] Redis caching for queries
- [ ] Environment validation
- [ ] Final load test & security audit

---

## Testing Checklist Before Production Launch

### Performance
- [ ] Homepage loads in < 2s on 3G (Lighthouse)
- [ ] Admin dashboard loads in < 3s with 1000 orders
- [ ] All API endpoints respond < 200ms p95
- [ ] Database connection pool < 80% utilization under load

### Stability
- [ ] No memory leaks after 24h uptime
- [ ] Handles 100 concurrent users without errors
- [ ] Graceful degradation when Redis/email down
- [ ] Sessions persist correctly

### Security
- [ ] All auth routes rate-limited
- [ ] No sensitive data in logs
- [ ] CSP headers validated (no 'unsafe-inline' if possible)
- [ ] HTTPS enforced
- [ ] SQL injection tested (should be protected by Drizzle)

### Functionality
- [ ] Complete purchase flow works end-to-end
- [ ] Admin can verify orders, upload payment proofs
- [ ] POS flow works (create bill, close session)
- [ ] Email notifications sent (OTP, order confirmations)
- [ ] All file uploads work and persist

---

## Monitoring & Alerting Setup

### Metrics to Track
- CPU / Memory usage
- Database connection count
- Request rate & error rate (4xx, 5xx)
- Response time p50, p95, p99
- Active sessions
- Email queue depth
- Upload storage usage

### Alerts
- 5xx error rate > 1% for 5 minutes
- Error rate spike > 200% baseline
- Disk usage > 80%
- Memory > 90%
- No heartbeat for 5 minutes
- Database connections > 80% of max

---

## Rollback Plan

1. **Database rollback:** Use `pg_dump` backups before migrations
2. **Code rollback:** Keep previous Docker image tag; redeploy previous commit
3. **Feature flags:** Consider adding for risky features
4. **Emergency contacts:** Have on-call person and escalation path

---

## Required Environment Variables for Production

Add to `.env` and Render dashboard:

```bash
# Required
DATABASE_URL=postgresql://... (with ?sslmode=require)
SESSION_SECRET=<64-char-random-string>
NODE_ENV=production
PORT=10000

# Email
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
SMTP_USER=<api-key>
SMTP_PASS=<secret-key>
SENDER_EMAIL=hello@rarenp.com
SENDER_NAME=RARE Nepal

# Optional but recommended
REDIS_URL=redis://redis-host:6379
ALLOWED_ORIGINS=https://rarenp.com,https://admin.rarenp.com (CORS)
UPLOADS_DIR=/uploads (mount persistent volume)
OTP_EXPIRY_MINUTES=10
```

---

## Post-Launch Checklist

- [ ] Enable Render automatic deploys from main branch
- [ ] Set up staging environment (clone of production)
- [ ] Schedule daily database backups
- [ ] Monitor error rates for first 24 hours
- [ ] Review performance metrics after 1 week
- [ ] Get Lighthouse score > 90 for storefront
- [ ] Document incident response process
- [ ] Train team on monitoring dashboard

---

## Conclusion

The codebase is **well-structured** and follows good patterns (layered architecture, separation of concerns, centralized error handling). The main issues are **infrastructure and configuration** rather than code quality.

**Priority order:**
1. Database performance (indexes) - immediately impacts user experience
2. Multi-instance readiness (Redis rate limiting) - affects scalability
3. Email reliability - affects user onboarding and order flow
4. Monitoring (health checks) - needed for deployment safety
5. Build fixes - prevents CI/CD failures

With focused effort over 2-3 weeks, this application can be production-ready and performant under load.

**Estimated total fixes time:** 40-60 developer hours
