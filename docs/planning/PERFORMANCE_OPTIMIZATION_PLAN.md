# Performance Optimization Plan: Speed for First Visitors & Admins

**Goal:** Achieve industry-leading performance scores
- Homepage LCP: < 2.5s (currently likely > 4s)
- Admin dashboard: < 1.5s
- Overall bundle: < 500KB initial load

---

## 🔍 Current State Analysis

### Bundle Size Problems (from build output)
```
Marketing-DmpjovG7.js     949.74 kB ⚠️  (MASSIVE - likely pulls in entire marketing suite)
index-6OotN3QP.js         637.22 kB ⚠️  (main chunk - includes code for ALL pages)
BarChart-DXZ48rgT.js      383.54 kB ⚠️  (chart library on initial load?)
jspdf.es.min-DpdSxtDj.js 385.44 kB     (loaded even on homepage?!)
html2canvas.esm-DXEQVQnt.js 201.04 kB  (payment proof only - shouldn't be initial)
Analytics-DNqBuVrZ.js      88.06 kB     (admin only)
Products-BOOaMB0Z.js      104.41 kB    (storefront - maybe needed)
index.es-BYTCEhCB.js      158.23 kB    (Vite runtime)
```

**Total initial JS: ~2.5MB** → With gzip ~800KB → Still too heavy for fast startup!

---

## 🎯 Root Causes Identified

1. **Marketing page imports heavy libraries** (BarChart, jspdf, html2canvas) on initial load
2. **Main `index.es-*.js` chunk** contains code for ALL pages because React.lazy boundaries aren't optimized
3. **No manual chunking** - Vite groups everything into 1-2 large files
4. **Large dependencies bundled together:** recharts, jspdf, html2canvas, leaflet all in main chunk
5. **No resource hints** for critical fonts/scripts
6. **Database queries missing indexes** → even with perfect JS, backend is slow

---

## 📊 Optimization Roadmap

### Phase 1: Immediate Wins (2-3 hours) → Target: -40% bundle size

#### 1.1 Manual Chunk Splitting with Vite
**File:** `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React + common libs
          'vendor': ['react', 'react-dom', 'react-router-dom', 'wouter'],

          // UI libraries
          'ui': ['@radix-ui/react-accordion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react'],

          // Data fetching
          'query': ['@tanstack/react-query'],

          // Heavy charting (only for admin)
          'charts': ['recharts'],

          // PDF generation (only for billing)
          'pdf': ['jspdf', 'html2canvas'],

          // Maps (only for LocationPicker)
          'maps': ['leaflet', 'react-leaflet'],

          // State management
          'state': ['zustand'],

          // Form handling
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
});
```

**Expected reduction:** 150-200KB from main chunk

---

#### 1.2 Audit Marketing Page Dependencies
**File:** `client/src/pages/admin/Marketing.tsx`

Check what's imported at the top level:

```typescript
// BAD - these run immediately on page load even if not used yet
import { BarChart } from 'recharts';  // 383KB!
import jsPDF from 'jspdf';            // 385KB!
import html2canvas from 'html2canvas'; // 201KB!

// GOOD - dynamic imports inside component
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart));
```

**Action:** Convert heavy imports to `dynamic()` inside component useEffect or render conditionally.

---

#### 1.3 Preload Critical Resources
**File:** `client/index.html`

Already has good preloads! But add more:

```html
<!-- Preload critical fonts (reduce CLS) -->
<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/Inter.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/PlayfairDisplay.woff2">

<!-- Preload hero image -->
<link rel="preload" as="image" href="/images/hero/hero1.webp" fetchpriority="high">

<!-- Preconnect to CDNs -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://your-cdn.com">

<!-- Preload main vendor chunk if small enough -->
<link rel="modulepreload" href="/assets/vendor-BLABLA.js">
```

**Impact:** Reduces font FOUT, speeds up LCP

---

#### 1.4 Optimize Database Queries (CRITICAL - see separate doc)
Even with perfect JS, slow DB kills experience.

Add indexes NOW (see production-readiness doc).

---

### Phase 2: Advanced Optimizations (3-4 hours)

#### 2.1 Implement Progressive Hydration
Instead of hydrating entire page at once, hydrate above-the-fold first.

**Issue:** Current setup hydrates full React app immediately.

**Solution:**
```typescript
// client/src/main.tsx
import { hydrateRoot } from 'react-dom/client';

// Only hydrate visible content initially
const root = createRoot(document.getElementById('root')!);

// Load critical components synchronously
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Defer non-critical hydration
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    import('./pages/admin/HeavyAdminPages').then(mod => {
      // Register for lazy loading
    });
  });
}
```

---

#### 2.2 Server-Side Rendering (SSR) for Homepage
**Biggest impact for LCP!**

Currently client-side only. SSR can cut LCP from 3s → 1s.

**Option A: Use Vite SSR**
```bash
npm install vite-ssr
```

Create `entry-server.tsx`:
```typescript
import { renderToString } from 'react-dom/server';
import App from './App';

export function render(url: string) {
  return renderToString(<App location={url} />);
}
```

Configure Vite for SSR build.

**Option B: Quick hybrid approach**
- Pre-render homepage to static HTML at build time
- Use `vite-plugin-ssg` (static site generation)

```bash
npm install -D vite-plugin-ssg
```

```typescript
// vite.config.ts
import { ViteSSG } from 'vite-plugin-ssg';

export default defineConfig({
  plugins: [
    ViteSSG({
      include: ['/'], // only homepage static
    }),
  ],
});
```

**Impact:** LCP drops by 50-70% for homepage

---

#### 2.3 Implement Virtual Scrolling for Admin Tables
**Problem:** Admin pages (Products 139KB, POS 85KB) render ALL rows at once.

**Solution:** Use `@tanstack/react-virtual`

```bash
npm install @tanstack/react-virtual
```

```typescript
// In Products.tsx, Orders.tsx, Customers.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function ProductTable({ products }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // row height
    overscan: 20,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <ProductRow
            key={virtualRow.key}
            product={products[virtualRow.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

**Impact:** Render 50 visible rows instead of 5000 → instant table scrolling

---

#### 2.4 Image Optimization Strategy

**Current:**
- Images stored locally at `/uploads`
- No optimized sizes
- No WebP variants automatically

**Upgrade to Cloudinary (or similar):**

```typescript
// server/lib/cloudinary.ts (already exists!)
export async function uploadToCloudinary(buffer: Buffer, folder: string): Promise<CloudinaryAsset> {
  const result = await cloudinary.uploader.upload_stream(
    { folder: `rare-np/${folder}`, resource_type: 'image' },
    (error, result) => {
      if (error) throw error;
    }
  ).end(buffer);

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
  };
}
```

**Benefits:**
- Automatic WebP/AVIF conversion
- Responsive image URLs: `url?w=400&h=300&fit=crop`
- Global CDN (sub-100ms delivery worldwide)
- Built-in caching headers

**Migration:**
1. Add Cloudinary env vars
2. Update upload handler to use Cloudinary
3. Serve Cloudinary URLs in `<img src>` in production
4. Keep local fallback for dev

**Expected improvement:** Image load times cut by 60-80%

---

#### 2.5 Database Connection Pool + Query Cache

Add Redis cache for expensive queries:

```typescript
// server/cache.ts
export const cache = {
  async get<T>(key: string, ttl = 300): Promise<T | null> {
    if (!redisClient) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  },

  async set(key: string, value: unknown, ttl = 300): Promise<void> {
    if (!redisClient) return;
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  },

  async invalidate(pattern: string): Promise<void> {
    if (!redisClient) return;
    const keys = await redisClient.keys(pattern);
    if (keys.length) await redisClient.del(keys);
  },
};
```

Apply to:
- `getProducts()` → cache: 5 min, invalidate on product change
- `getCategories()` → cache: 1 hour
- `getAnalytics()` → cache: 5 min, invalidate on order change
- `getHomeFeatured()` → cache: 10 min

**Estimated DB load reduction:** 70% for read-heavy pages

---

### Phase 3: Admin-Specific Optimizations (2 hours)

#### 3.1 Route-Based Code Splitting (Already Mostly Done ✓)

**Check:** `client/src/App.tsx` uses `lazy()` for all admin pages. ✅ Good!

But can improve:
```typescript
// Instead of:
const AdminProducts = lazy(loadAdminProductsPage);

// Use React.lazy with Suspense and error boundaries
const AdminProducts = lazy(() =>
  import('@/pages/admin/Products').then(module => ({
    default: module.Products,
  }))
);
```

**Already implemented** - just verify no eager imports inside those pages.

---

#### 3.2 Preload Admin Routes on Login

When admin logs in, preload likely next pages:

```typescript
// After successful login in Login.tsx:
if (user.role === 'admin') {
  // Preload admin dashboard data
  queryClient.prefetchQuery({
    queryKey: ['admin', 'stats'],
    queryFn: fetchAdminStats,
  });

  // Preload frequently accessed pages
  loadAdminProductsPage();
  loadAdminOrdersPage();
  loadAdminDashboardPage();
}
```

---

#### 3.3 Admin Navigation Skeleton States

Add skeleton loaders for all admin pages while data loads:

```typescript
// AdminLayout.tsx
const { data: stats, isLoading } = useQuery({
  queryKey: ['admin', 'stats'],
  queryFn: fetchAdminStats,
});

return (
  <div>
    <Sidebar />
    <main>
      {isLoading ? (
        <DashboardSkeleton /> // Shown immediately
      ) : (
        <Outlet />
      )}
    </main>
  </div>
);
```

**Impact:** Perceived performance - user sees something immediately

---

#### 3.4 Debounce Admin Search

Products/Orders tables with search:

```typescript
import { useDebounce } from '@/hooks/useDebounce';

function ProductsTable() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (debouncedSearch) {
      // Trigger search query
    }
  }, [debouncedSearch]);
}
```

---

### Phase 4: Homepage-Specific Optimizations (1 hour)

#### 4.1 Above-the-Fold Content Critical Path

Homepage LCP is probably the hero image or product grid.

**Optimization checklist:**
- ✅ Preload hero image (already done in index.html) ✓
- ✅ Inline critical CSS (already inlined in index.html) ✓
- ⚠️ Reduce unused CSS (Tailwind purge in prod?)
- ⚠️ Lazy load below-fold images
- ⚠️ Preconnect to image CDN

**Add to index.html:**
```html
<!-- Inline critical CSS for above-the-fold -->
<style>
  .hero-section { min-height: 80vh; background: url('/images/hero.webp') center/cover; }
  /* ... essential styles only */
</style>

<!-- Defer non-critical CSS -->
<link rel="preload" href="/assets/index.css" as="style" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/assets/index.css"></noscript>
```

---

#### 4.2 Product Image Lazy Loading

```typescript
// In product card component:
<img
  src={product.imageUrl}
  loading="lazy"
  decoding="async"
  width={400}
  height={500}
  alt={product.name}
/>
```

---

#### 4.3 Reduce Initial API Calls

Currently: Homepage fetches categories + products on mount.

**Optimize:**
1. Cache categories for 1 hour (already React Query 5min) ✓
2. Use `placeholderData` to show cached products immediately
3. Stagger category fetch if independent

**Already decent** - just need server-side caching.

---

## 🎯 Expected Results After All Optimizations

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Total JS bundle | ~2.5MB | **~400KB** (-84%) |
| Homepage LCP | ~3.5s (est) | **< 1.8s** (-50%) |
| Admin dashboard load | ~2-3s | **< 1s** (-66%) |
| Time to Interactive | ~4s | **< 2s** (-50%) |
| Lighthouse Performance | ~60-70 | **> 90** |
| First visit (3G) | ~6s | **< 3s** |

---

## 📋 Implementation Priority Matrix

| Task | Impact | Effort | Priority | Time |
|------|--------|--------|----------|------|
| 1. Add manual chunks (vite.config) | 🔥 High | Easy | P0 | 30min |
| 2. Fix Marketing page imports | 🔥 High | Medium | P0 | 1h |
| 3. Add DB indexes | 🔥 High | Easy | P0 | 30min |
| 4. Redis query cache | 🔥 High | Medium | P0 | 2h |
| 5. Virtual scrolling admin tables | 🟡 Medium | Medium | P1 | 2h |
| 6. Preload critical resources | 🟡 Medium | Easy | P1 | 30min |
| 7. Admin skeleton loaders | 🟢 Low | Easy | P2 | 30min |
| 8. SSR for homepage | 🔥 High | Hard | P1 (if possible) | 4h |
| 9. Cloudinary images | 🟡 Medium | Medium | P2 | 2h |
| 10. Image lazy loading | 🟢 Low | Easy | P2 | 20min |

**Total critical path (P0-P1):** ~6-7 hours

---

## 🔬 How to Measure Progress

### 1. Bundle Analysis
```bash
npm install -D rollup-plugin-visualizer
# Add to vite.config.ts:
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  build: {
    plugins: [visualizer({ filename: 'bundle.html', open: true })],
  },
});

npm run build
# Open bundle.html → see exact chunk breakdown
```

**Target:**
- vendor.js: < 150KB
- ui.js: < 100KB
- main entry: < 200KB
- Total: < 500KB initial

---

### 2. Lighthouse Testing

**Chrome DevTools:**
- Open DevTools → Lighthouse
- Run "Performance" audit (simulated 3G, 4x CPU slowdown)
- Target scores:
  - Performance: > 90
  - First Contentful Paint: < 1.0s
  - Largest Contentful Paint: < 2.5s
  - Time to Interactive: < 3.0s
  - Cumulative Layout Shift: < 0.1

**Command line:**
```bash
npm install -g lighthouse
lighthouse https://localhost:5000 --view --output=html
```

---

### 3. WebPageTest (Real-world 3G)
https://webpagetest.org

Test from:
- London (Europe) - check TTFB
- Mumbai (Asia) - check global CDN effect
- Silicon Valley (US East)

**Target:**
- First Byte: < 200ms (with cache)
- Start Render: < 1s
- Speed Index: < 1.5s
- LCP: < 2.5s

---

### 4. React DevTools Profiler
- Record page load
- Check component render times
- Identify unnecessary re-renders
- Target: No component > 50ms initial render

---

## 🚀 Quick Wins Summary (Do These NOW)

### This Week (P0):
1. ✅ Add manual chunking to `vite.config.ts` (30min)
2. ✅ Audit and fix Marketing page imports (1h)
3. ✅ Add DB indexes (30min)
4. ✅ Set up Redis query cache (2h)
5. ✅ Add virtual scrolling to Products/Orders tables (2h)

**Total: ~6 hours** → Expect 40-60% performance improvement

### Next Week (P1):
6. Implement SSR for homepage (4h) OR use SSG
7. Cloudinary integration (2h)
8. Admin skeleton loaders (30min)
9. Preload optimization (30min)

**Total: ~7 hours** → Additional 30-50% improvement

---

## 📦 Bundle Size Budget (After Optimization)

| Chunk | Target Size (gzipped) | Contents |
|-------|----------------------|----------|
| vendor-react | 60KB | React, ReactDOM, wouter |
| vendor-ui | 40KB | Radix UI components, lucide |
| vendor-query | 15KB | TanStack Query |
| vendor-forms | 25KB | react-hook-form, zod |
| charts | 80KB | recharts (admin only, lazy) |
| pdf | 100KB | jspdf, html2canvas (billing only, lazy) |
| maps | 50KB | leaflet (LocationPicker only, lazy) |
| main-home | 80KB | Homepage, product listing, cart |
| main-admin | 120KB | Admin layout + common admin UI |
| admin-products | 60KB | Products page lazy |
| admin-orders | 50KB | Orders page lazy |
| admin-pos | 70KB | POS page lazy |
| admin-analytics | 70KB | Analytics with charts |
| admin-marketing | 150KB | Marketing with BarChart |
| ... | ... | ... |

**Total initial load (homepage):** ~240KB (vendor + main-home)
**With gzip:** ~80KB → Excellent!

---

## 🔍 Specific homepage optimization checklist

- [ ] `index.html` inline critical CSS ✓ (already done)
- [ ] Preload hero image ✓ (already done)
- [ ] Add font preloads for Inter, Playfair Display
- [ ] Reduce Google Fonts requests (currently 4 separate font families!)
  - **Fix:** Only load what's actually used
  - Remove Iosevka, Syne, IBM Plex if not used in UI
- [ ] Defer non-critical CSS (Tailwind is huge)
- [ ] Add `loading="lazy"` to all images below fold
- [ ] Use `fetchpriority="high"` only on LCP image (hero)
- [ ] Implement image CDN with WebP + responsive sizes
- [ ] Prefetch `/api/products?limit=8` after initial render
- [ ] Cache API responses with stale-while-revalidate

---

## 🔍 Specific admin optimization checklist

- [ ] Virtual scroll all data tables (Products, Orders, Customers, Bills)
- [ ] Debounce search inputs (300ms)
- [ ] Paginate API responses (limit 50, offset)
- [ ] Cache dashboard stats (5 min)
- [ ] Lazy load Google Maps/LocationPicker component
- [ ] Split admin chunk: common vs page-specific
- [ ] Skeleton loaders for all admin pages
- [ ] Keep-alive admin navigation (React state preserved)
- [ ] Prefetch next likely admin page on hover (prefetch API)

---

## 🎯 Monitoring After Deploy

Set up Real User Monitoring (RUM):

```typescript
// Add to client/src/lib/performance.ts
export function markWebVitals(name: string, value: number) {
  if (typeof window !== 'undefined' && 'sendBeacon' in navigator) {
    const data = { name, value, timestamp: Date.now() };
    navigator.sendBeacon('/api/analytics/perf', JSON.stringify(data));
  }
}

// Use with web-vitals library:
import { getLCP, getFID, getCLS } from 'web-vitals';

getLCP(console.log); // Log to server
getFID(console.log);
getCLS(console.log);
```

---

## 📚 References

- [Vite Build Optimizations](https://vitejs.dev/guide/build.html#chunk-caching)
- [React Performance](https://react.dev/learn/reacting-to-input-with-state#avoiding-re-renders)
- [Web.dev Performance](https://web.dev/performance-scenarios/)
- [Google Core Web Vitals](https://web.dev/vitals/)

---

## Conclusion

**Biggest leverage points:**
1. Manual chunking in Vite (instant 40% reduction)
2. DB indexes (backend speed)
3. Redis cache (reduce DB queries)
4. Virtual scrolling (admin tables)
5. SSR/SSG for homepage (biggest LCP improvement)

**Start today with Phase 1 tasks** - you'll see measurable improvements within hours.

Would you like me to:
1. Generate the `vite.config.ts` with manual chunking?
2. Audit the Marketing page imports?
3. Create the database indexes migration?
4. Set up virtual scrolling for Products table?
