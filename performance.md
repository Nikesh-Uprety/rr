# RARE.NP — Site Performance Log

Track first-load performance on every meaningful commit.
Measure using Chrome DevTools → Network tab → Hard Reload (Ctrl+Shift+R).
Record the **DOMContentLoaded** and **Load** times shown at the bottom of the Network tab.

---

## How to Measure

1. Open Chrome → DevTools (F12) → Network tab
2. Check "Disable cache"
3. Hard reload: Ctrl + Shift + R
4. Record the three numbers at the bottom:
   - **DCL** = DOMContentLoaded (ms)
   - **Load** = Full page load (ms)
   - **FCP** = First Contentful Paint (from Lighthouse or Performance tab)
5. Paste the commit hash and note what changed

---

## Performance Targets

| Metric              | Target     | Warning    | Critical   |
|---------------------|------------|------------|------------|
| DOMContentLoaded    | < 800ms    | 800–1500ms | > 1500ms   |
| Full Load           | < 1500ms   | 1500–3000ms| > 3000ms   |
| First Contentful Paint | < 1000ms | 1000–2000ms | > 2000ms |
| API /auth/me        | < 100ms    | 100–300ms  | > 300ms    |
| API /products       | < 200ms    | 200–500ms  | > 500ms    |

---

## Commit Performance History

### [BASELINE]
- **Date:** 2026-03-10
- **Commit:** `initial baseline — pre-optimization`
- **Branch:** main
- **DCL:** ___ ms
- **Load:** ___ ms
- **FCP:** ___ ms
- **Notes:** Record this before any changes as your baseline reference.

---

<!-- COPY THIS BLOCK FOR EVERY NEW COMMIT -->
<!--
### [v?.?]
- **Date:** YYYY-MM-DD
- **Commit:** `git commit hash or message`
- **Branch:** 
- **DCL:** ___ ms
- **Load:** ___ ms
- **FCP:** ___ ms
- **Bundle size delta:** +/- __ KB
- **Notes:** What changed and why it affected performance
-->
---

## Log

| # | Date | Commit | DCL (ms) | Load (ms) | FCP (ms) | Delta | Notes |
|---|------|--------|----------|-----------|----------|-------|-------|
| 1 | 2026-03-10 | `baseline` | — | — | — | — | Fill in before first change |

---

## Known Bottlenecks (Running List)

- [ ] `/api/auth/me` called on every page load — no caching (seen in logs: 84–108ms each hit)
- [ ] `/api/admin/notifications` polled repeatedly (275–318ms, 4+ calls in logs)
- [ ] Product images served as WebP via wsrv.nl proxy — good, but no width hints on `<img>` tags
- [ ] PostgreSQL SSL mode warning on every startup — resolve before prod
- [ ] Gmail SMTP EAUTH error on startup — causes delay in email flows

---

## Optimization History

| Date | Change | Before | After | Improvement |
|------|--------|--------|-------|-------------|
| —    | —      | —      | —     | —           |

---

## Rules

- Measure BEFORE and AFTER every significant change
- If load time increases by more than 200ms — investigate before merging
- Bundle size should never increase by more than 50KB without justification
- All new admin-only features must be **lazy loaded** so they never affect storefront load time
