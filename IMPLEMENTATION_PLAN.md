# Production Launch Implementation Plan

**Priority Order: Critical Path to Launch**
Follow this order to minimize risk and ensure each fix builds on previous ones.

---

## Phase 1: Foundation (Days 1-3) — Must Complete First

### Task 1.1: Database Performance Indexes
**Estimated time:** 1 hour
**Risk:** High (blocking, affects all users)
**Rollback:** Simple (drop indexes)

#### Steps:
1. Create migration file:
   ```bash
   drizzle-kit generate
   # Or manually:
   drizzle-kit generate:pg --schema=shared/schema.ts --out=migrations/
   ```

2. Add indexes to `shared/schema.ts` or create separate migration:
   ```sql
   -- migrations/0002_add_indexes.sql
   CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
   CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
   CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
   CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
   CREATE INDEX IF NOT EXISTS idx_products_home_featured ON products(home_featured) WHERE home_featured = true;
   CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
   CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_id ON otp_tokens(user_id);
   CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at);
   ```

3. Apply to production:
   ```bash
   DATABASE_URL=production-db npm run db:push
   ```

4. **Verify:**
   ```sql
   SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename IN ('orders', 'products', 'customers');
   ```

---

### Task 1.2: Email Configuration Hardening
**Estimated time:** 30 minutes
**Risk:** High (OTP breaks if email fails)

#### Steps:
1. Fix `server/email.ts`:
   - Remove hardcoded `upretynikesh021@gmail.com`
   - Use `process.env.SENDER_EMAIL || process.env.SMTP_USER`
   - Add `transporter.verify()` on startup

2. Add to `server/index.ts` before `registerRoutes()`:
   ```typescript
   import { validateEmailConfig } from './email';

   // In startup sequence:
   const emailValid = await validateEmailConfig();
   if (!emailValid && process.env.NODE_ENV === 'production') {
     throw new Error('Email configuration invalid - fix SMTP settings');
   }
   ```

3. Update `.env.example`:
   ```
   SENDER_EMAIL=hello@rarenp.com
   SENDER_NAME=RARE Nepal
   ```

4. Test in staging:
   ```bash
   E2E_TEST_MODE=0 npm run dev
   # Create test user, verify OTP email sends correctly
   ```

---

### Task 1.3: Health Check Endpoint
**Estimated time:** 30 minutes
**Risk:** Low (additive only)

#### Steps:
1. Create `server/health.ts` (see PRODUCTION_READINESS_REVIEW.md for code)

2. Import and register in `server/index.ts`:
   ```typescript
   import { healthCheck } from './health';

   app.get('/health', async (req, res) => {
     const result = await healthCheck();
     res.json(result);
   });
   ```

3. Test:
   ```bash
   curl http://localhost:5000/health
   # Should return { status: 'ok', timestamp: ..., checks: { database: true, ... } }
   ```

4. Configure Render health check:
   - In Render dashboard, set health check path to `/health`
   - Expected 200 response

---

## Phase 2: Production Hardening (Days 4-6)

### Task 2.1: Replace Rate Limiting with Redis
**Estimated time:** 2 hours
**Risk:** Medium (affects all API requests)
**Rollback:** Switch back to in-memory store

#### Steps:
1. Install Redis client:
   ```bash
   npm install redis connect-redis
   ```

2. Create `server/middleware/rateLimit.ts`:
   ```typescript
   import { RateLimit } from 'express-rate-limit';
   import { RedisStore } from 'connect-redis';
   import { createClient } from 'redis';

   const redisClient = createClient({
     url: process.env.REDIS_URL,
   });

   await redisClient.connect();

   export function createRateLimitMiddleware(options?: { windowMs?: number; max?: number }) {
     return new RateLimit({
       store: new RedisStore({
         client: redisClient,
         prefix: 'rate-limit:',
       }),
       windowMs: options?.windowMs || 60 * 1000,
       max: options?.max || 10,
       message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
       standardHeaders: true,
       legacyHeaders: false,
     });
   }
   ```

3. Update `server/middleware/security.ts`:
   - Remove the old `rateLimit` function
   - Use `createRateLimitMiddleware()` instead

4. Update all route uses:
   ```typescript
   // In routes.ts, replace:
   // app.post('/api/auth/register', rateLimit(), ...)
   // With:
   app.post('/api/auth/register', createRateLimitMiddleware({ max: 5 }), ...)
   ```

5. Add to `.env.example`:
   ```
   REDIS_URL=redis://redisUsername:redisPassword@redis-host:6379
   ```

6. **For Render:** Add Redis instance in dashboard and set REDIS_URL

---

### Task 2.2: Database Connection Pool Tuning
**Estimated time:** 30 minutes
**Risk:** Low (affects DB connections only)

#### Steps:
1. Update `server/db.ts`:
   ```typescript
   export const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === "production"
       ? { rejectUnauthorized: false }
       : false,
     connectionTimeoutMillis: 5000,
     idleTimeoutMillis: 30000,      // NEW
     max: 20,                       // NEW - adjust based on instance size
     allowExitOnIdle: true,         // NEW
   });
   ```

2. Research Render instance size and adjust `max`:
   - Free instance: 5-10
   - Starter: 10-20
   - Standard: 20-50

3. Monitor after deployment via `SELECT count(*) FROM pg_stat_activity;`

---

### Task 2.3: Build Configuration Cleanup
**Estimated time:** 1 hour
**Risk:** Medium (build may break)

#### Steps:
1. Fix `vite.config.ts` top-level await issue:
   - Remove Replit plugin conditional imports from config
   - Move them to separate dev-only config or skip entirely

2. Alternative: Split config:
   ```typescript
   // vite.config.ts (base)
   export default defineConfig({
     plugins: [react(), tailwindcss(), metaImagesPlugin(), viteImagemin({...})],
     // ... rest
   });

   // vite.config.dev.ts
   import baseConfig from './vite.config';
   export default defineConfig({
     ...baseConfig,
     plugins: [
       ...baseConfig.plugins,
       runtimeErrorOverlay(),
       await import("@replit/vite-plugin-cartographer").then(m => m.cartographer()),
       await import("@replit/vite-plugin-dev-banner").then(m => m.devBanner()),
     ],
   });
   ```

3. Test build locally:
   ```bash
   npm run build
   # Should complete without errors
   ```

4. Test artifact:
   ```bash
   ls -lah dist/public/  # should have index.html, assets/
   ls -lah dist/index.cjs  # server bundle
   ```

---

### Task 2.4: Upload Directory Persistence Check
**Estimated time:** 30 minutes
**Risk:** Medium (uploads may be lost)

#### Steps:
1. Update `server/index.ts` startup:
   ```typescript
   // After ensuring uploads dir exists:
   const UPLOADS_DIR = resolveUploadsDir();
   const uploadsWritable = await fs.promises.access(UPLOADS_DIR, fs.constants.W_OK)
     .then(() => true)
     .catch(() => false);

   if (!uploadsWritable) {
     logger.error("Uploads directory not writable", { dir: UPLOADS_DIR });
     if (process.env.NODE_ENV === 'production') {
       throw new Error(`Cannot write to uploads directory: ${UPLOADS_DIR}. Ensure persistent volume is mounted.`);
     }
   }
   ```

2. Update `render.yaml` to mount volume:
   ```yaml
   services:
     - type: web
       name: rare-np
       # ... existing
       volumes:
         - name: uploads
           mountPath: /uploads
   ```

3. In Render dashboard:
   - Create persistent volume named "uploads"
   - Mount to `/uploads`
   - Set env `UPLOADS_DIR=/uploads`

---

## Phase 3: Security & Quality (Days 7-9)

### Task 3.1: Replace Console Logs with Logger
**Estimated time:** 1 hour
**Risk:** Low (non-functional change)

#### Steps:
1. Global search/replace in `server/routes.ts`:
   - `console.log(` → `logger.info(`
   - `console.warn(` → `logger.warn(`
   - `console.error(` → `logger.error(`

2. In other files (`server/authHandlers.ts`, `server/email.ts`, etc.)

3. Remove any `console.debug` or add guards:
   ```typescript
   if (process.env.NODE_ENV !== 'production') {
     console.log('debug info');
   }
   ```

4. Verify:
   ```bash
   grep -r "console\." server/ | wc -l  # should be 0 or very low
   ```

---

### Task 3.2: Session Security Enhancements
**Estimated time:** 45 minutes
**Risk:** Medium (affects auth flow)

#### Steps:
1. Add session regeneration in `server/authHandlers.ts`:
   ```typescript
   export const createLoginHandler = () => async (req, res, next) => {
     // ... after password verification
     req.session.regenerate((err) => {
       if (err) {
         return done(err);
       }
       // ... rest of login logic
     });
   };
   ```

2. Update `server/index.ts` session config:
   ```typescript
   cookie: {
     secure: process.env.NODE_ENV === "production",
     httpOnly: true,
     sameSite: 'lax',  // explicit
     maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
   },
   ```

3. Test login flow works correctly with regeneration

---

### Task 3.3: Security Headers Hardening
**Estimated time:** 45 minutes
**Risk:** Low (headers only)

#### Steps:
1. Update `server/middleware/security.ts`:

   ```typescript
   // HSTS - add preload (requires 2+ years to register, but can still set)
   res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

   // Add missing headers
   res.set("X-Permitted-Cross-Domain-Policies", "none");

   // CSP - plan to remove unsafe-inline
   // For now, keep but document as tech debt
   // Track issue to refactor inline scripts in client/
   ```

2. Audit CSP report-uri: add `report-uri` or `report-to` to collect violations

3. Test headers:
   ```bash
   curl -I http://localhost:5000/
   # Check: strict-transport-security, x-frame-options, etc.
   ```

---

## Phase 4: Performance (Days 10-12)

### Task 4.1: Add Database Indexes on Additional Columns
**Estimated time:** 45 minutes
**Risk:** Medium (could lock table briefly)

#### Additional indexes:
```sql
-- Orders payment verification workflow
CREATE INDEX IF NOT EXISTS idx_orders_payment_verified ON orders(payment_verified) WHERE payment_verified IS NULL;

-- Products inventory
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock) WHERE stock > 0;

-- Bills for POS
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_processed_by ON bills(processed_by);

-- Newsletter
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers(email);
```

---

### Task 4.2: Implement Redis Caching
**Estimated time:** 3 hours
**Risk:** Medium (adds complexity)

#### Steps:
1. Create `server/cache.ts`:
   ```typescript
   import { createClient } from 'redis';

   const redisClient = createClient({ url: process.env.REDIS_URL });
   await redisClient.connect();

   export const cache = {
     async get<T>(key: string): Promise<T | null> {
       const val = await redisClient.get(key);
       return val ? JSON.parse(val) : null;
     },
     async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
       await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
     },
     async invalidate(pattern: string): Promise<void> {
       const keys = await redisClient.keys(pattern);
       if (keys.length) await redisClient.del(keys);
     },
   };
   ```

2. Apply to expensive storage methods:
   ```typescript
   async getProducts(filters) {
     const cacheKey = `products:${JSON.stringify(filters)}`;
     const cached = await cache.get<Product[]>(cacheKey);
     if (cached) return cached;

     const products = await this.dbQuery(...);
     await cache.set(cacheKey, products, 300); // 5 min
     return products;
   }

   async getCategories() {
     const cached = await cache.get<Category[]>('categories:all');
     if (cached) return cached;

     const categories = await db.select().from(categories);
     await cache.set('categories:all', categories, 3600); // 1 hour
     return categories;
   }
   ```

3. Invalidate cache on mutations:
   ```typescript
   async createProduct(data) {
     const product = await db.insert(...);
     await cache.invalidate('products:*');
     await cache.invalidate('categories:*');
     return product;
   }
   ```

---

### Task 4.3: Client-Side Performance Audit
**Estimated time:** 2 hours
**Risk:** Low

#### Steps:
1. Generate bundle analyzer:
   ```bash
   npm install -D rollup-plugin-visualizer
   # Add to vite.config.ts:
   export default defineConfig({
     plugins: [
       visualizer({ filename: 'bundle-analysis.html' }),
     ],
   });
   npm run build
   ```

2. Run Lighthouse:
   - Chrome DevTools → Lighthouse
   - Run on production-like build
   - Target: Performance > 90

3. Identify and lazy load heavy dependencies:
   - `jspdf`, `html2canvas` only needed on checkout/order pages
   - `recharts` only on admin analytics
   - Wrap dynamic imports in components

4. Optimize images:
   - Already using WebP ✓
   - Add `loading="lazy"` to below-the-fold images
   - Use appropriate sizes (don't serve 2000px image for 300px container)

---

## Phase 5: Testing & Validation (Days 13-14)

### Task 5.1: Load Testing
**Estimated time:** 2 hours
**Risk:** Medium (test environment only)

#### Steps:
1. Install k6 or autocannon:
   ```bash
   npm install -g k6
   ```

2. Create `loadtest.js`:
   - Simulate 50 users browsing products, adding to cart, checkout
   - Simulate 10 concurrent admin users
   - Run for 5 minutes

3. Test scenarios:
   - Homepage load
   - Product listing API
   - Checkout flow
   - Admin dashboard

4. Metrics to capture:
   - p95 response time < 500ms for APIs
   - No errors
   - CPU < 70% on test instance
   - Memory stable (no leaks)

---

### Task 5.2: End-to-End Flow Testing
**Estimated time:** 1 hour

#### Must test:
- [ ] User registration with 2FA
- [ ] Complete purchase (payment proof upload)
- [ ] Admin order verification
- [ ] POS session open/close
- [ ] Product CRUD
- [ ] Email notifications (OTP, order confirmation)

---

### Task 5.3: Security Testing
**Estimated time:** 1 hour

#### Checklist:
- [ ] SQL injection: try `' OR 1=1 --` in search, forms
- [ ] XSS: try `<script>alert(1)</script>` in form fields
- [ ] CSRF: Verify session token on state-changing operations
- [ ] Rate limiting: Send 20 rapid requests to login, verify blocked
- [ ] Authentication bypass: Try accessing `/admin` as non-admin
- [ ] File upload: Try uploading .exe, verify blocked

---

## Phase 6: Production Deployment (Day 15)

### Pre-Deployment Checklist

#### Infrastructure
- [ ] Render web service created
- [ ] PostgreSQL database provisioned (Neon or Render Postgres)
- [ ] Redis instance provisioned (if using multi-instance)
- [ ] Persistent volume mounted at `/uploads`
- [ ] Custom domain configured (DNS A record → Render)
- [ ] SSL certificate (Auto-managed by Render)
- [ ] Environment variables set (see list below)

#### Code
- [ ] All Phase 1-5 tasks complete
- [ ] Build succeeds: `npm run build`
- [ ] No console warnings in production build
- [ ] `.env` file complete with production values
- [ ] Secret values rotated (SESSION_SECRET, database password)

#### Monitoring
- [ ] Health check endpoint responding at `/health`
- [ ] Render health check configured
- [ ] Error monitoring (Sentry) configured
- [ ] Log aggregation (Papertrail, etc.) connected
- [ ] Uptime monitor configured (UptimeRobot)

#### Backups
- [ ] Database automated backups enabled (daily)
- [ ] Backup retention policy (30 days)
- [ ] Test restore procedure documented

---

### Environment Variables for Production

Set in Render dashboard → Environment:

```bash
# Core
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
SESSION_SECRET=<generate-64-char-random>
PORT=10000

# Email (SMTP)
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
SMTP_USER=your-mailjet-api-key
SMTP_PASS=your-mailjet-secret-key
SENDER_EMAIL=hello@rarenp.com
SENDER_NAME=RARE Nepal

# Redis (optional but recommended for rate limiting & cache)
REDIS_URL=redis://default:password@redis-host:6379

# CORS (important for API access)
ALLOWED_ORIGINS=https://rarenp.com,https://admin.rarenp.com

# Uploads
UPLOADS_DIR=/uploads

# 2FA
OTP_EXPIRY_MINUTES=10
```

---

### Deployment Steps

1. **Push to main branch** (trigger auto-deploy):
   ```bash
   git checkout main
   git pull
   git merge feature/production-readiness
   git push origin main
   ```

2. **Or manual deploy in Render:**
   - Dashboard → Service → Manual Deploy → Deploy latest

3. **Monitor deployment logs:**
   - Check Render logs for errors
   - Verify `/health` endpoint returns `ok`

4. **Post-deploy verification:**
   ```bash
   # Test health
   curl https://your-app.onrender.com/health

   # Test homepage loads
   curl https://your-app.onrender.com/ | grep -i "rare"

   # Test API
   curl https://your-app.onrender.com/api/products
   ```

5. **Smoke test:**
   - Create test order end-to-end
   - Admin can log in and verify order
   - Email received (check Mailjet dashboard)
   - Files upload successfully

---

## Rollback Plan

If something goes wrong post-deployment:

### Quick Rollback (Code)
1. Render Dashboard → Service → Manual Deploy → Select previous commit
2. Wait for rollback to complete (2-3 minutes)
3. Verify health endpoint
4. Notify team

### Database Rollback (if migration breaks)
```bash
# If new indexes cause issues, drop them:
DROP INDEX IF EXISTS idx_orders_email;
DROP INDEX IF EXISTS idx_products_category;
# ... etc

# Or restore from backup:
pg_restore --host=... --username=... --dbname=... latest_backup.dump
```

### Incident Response
1. **Communication:** Notify stakeholders immediately
2. **Root cause:** Check logs, identify failing component
3. **Decision:** Rollback vs. hotfix
4. **Post-mortem:** Document what happened and prevent recurrence

---

## Success Metrics

After 1 week of production:

- **Uptime:** > 99.9% (less than 43 minutes downtime)
- **Performance:**
  - Homepage load: < 2s (Lighthouse Performance > 90)
  - API p95: < 500ms
- **Errors:** 5xx rate < 0.1%
- **Database:** Connection pool < 80%, no slow queries (> 1s)
- **User Experience:** No user complaints about slowness

---

## Ongoing Maintenance

### Daily
- Monitor error logs
- Check database backup status

### Weekly
- Review performance metrics
- Clear old log files
- Review security logs for suspicious activity

### Monthly
- Database optimization (VACUUM ANALYZE)
- Update dependencies (npm outdated → npm update)
- Review Redis memory usage
- Security audit

---

## Conclusion

Follow this plan sequentially. Each phase builds on the previous.

**Critical Path (must do):** Phase 1 (Tasks 1.1-1.3)
**Important:** Phase 2-3
**Nice to have:** Phase 4-6 (if time permits)

Total estimated time: **40-60 hours** of focused development.

**Recommended allocation:** 1 developer for 2 full weeks, or 2 developers for 1 week.

After completing all Phase 1-3 tasks, the application will be **production-ready** despite remaining Phase 4-6 improvements.

---

## Support

Questions during implementation?
- Refer to `PRODUCTION_READINESS_REVIEW.md` for detailed technical explanations
- `CLAUDE.md` for codebase patterns
- `codex.md` for project context

Good luck with the launch! 🚀
