# RARE.np — Project Skills & Architecture Reference
> This file is the **permanent knowledge base** for Cursor AI.
> Read this file at the start of every session before touching any code.
> Never delete or overwrite this file.

---

## Project Identity

| Key | Value |
|-----|-------|
| Project Name | RARE.np |
| Type | Full-stack e-commerce + admin platform |
| Brand (Storefront) | RARE / RARE.np |
| Brand (Admin) | ULTIMATEX |
| Repo | https://github.com/Nikesh-Uprety/RARE.np |
| Stack | React + Vite (client) · Express (server) · Drizzle ORM · PostgreSQL |
| Node version | 18+ |
| Package manager | npm |

---

## Repository Structure

```
RARE.np/
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx                 # Router + ProtectedRoute logic
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx      # Storefront navbar (auth-aware)
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── AdminLayout.tsx # Admin sidebar shell
│   │   │   └── ui/                 # shadcn/ui components (DO NOT EDIT)
│   │   ├── pages/
│   │   │   ├── storefront/
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── Products.tsx    # Uses MOCK_PRODUCTS → migrate to API
│   │   │   │   ├── ProductDetail.tsx
│   │   │   │   ├── Cart.tsx
│   │   │   │   ├── Checkout.tsx
│   │   │   │   └── OrderSuccess.tsx
│   │   │   ├── admin/
│   │   │   │   ├── Analytics.tsx
│   │   │   │   ├── Products.tsx
│   │   │   │   ├── Orders.tsx
│   │   │   │   ├── Customers.tsx
│   │   │   │   └── POS.tsx
│   │   │   └── auth/
│   │   │       └── Login.tsx       # To be created
│   │   ├── store/
│   │   │   └── cart.ts             # Zustand cart store
│   │   └── lib/
│   │       └── queryClient.ts      # TanStack React Query client
│
├── server/
│   ├── index.ts                    # Express app entry, middleware setup
│   ├── routes.ts                   # All API route definitions
│   ├── storage.ts                  # IStorage interface + MemStorage + PgStorage
│   ├── db.ts                       # Drizzle DB client (to be created)
│   └── static.ts                   # Serves built client in production
│
├── shared/
│   └── schema.ts                   # Drizzle schema (single source of truth for types)
│
├── drizzle.config.ts               # Drizzle Kit config
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Tech Stack — Full Reference

### Frontend (client/)
| Layer | Library | Version/Notes |
|-------|---------|---------------|
| Framework | React 18 | Vite-based, NOT Next.js |
| Routing | react-router-dom v6 | File-based pages in /pages |
| Styling | TailwindCSS | CSS variables for theming |
| Components | shadcn/ui | In client/src/components/ui — never edit |
| State | Zustand | Cart store in store/cart.ts |
| Data fetching | @tanstack/react-query | queryClient in lib/queryClient.ts |
| Forms | react-hook-form + zod | Used on checkout + login |
| Charts | Recharts | Used in Analytics page |
| Animation | Framer Motion | Page transitions, modals |
| HTTP client | fetch() / axios | Use fetch with queryClient |

### Backend (server/)
| Layer | Library | Notes |
|-------|---------|-------|
| Runtime | Node.js 18+ | |
| Server | Express.js | |
| ORM | Drizzle ORM | Schema in shared/schema.ts |
| Database | PostgreSQL | Via Neon or local pg |
| Auth | Passport.js + express-session | LocalStrategy, bcryptjs |
| Session store | connect-pg-simple | Postgres-backed sessions |
| Validation | Zod | On all API request bodies |
| Password | bcryptjs | Hash on register, compare on login |

### Database
| Key | Value |
|-----|-------|
| Engine | PostgreSQL |
| ORM | Drizzle |
| Config | drizzle.config.ts |
| Schema file | shared/schema.ts |
| Migration cmd | `npm run db:push` |
| Seed cmd | `npm run db:seed` (to be created) |

---

## Design System

### Theme Modes
Three modes switchable via `data-theme` on `<html>`:

```css
[data-theme="light"]  → white bg, dark text
[data-theme="dark"]   → near-black bg, light text
[data-theme="warm"]   → warm beige bg, reduced blue light, amber accents
```

Stored in `localStorage("theme")`. ThemeProvider reads on mount and sets `document.documentElement.dataset.theme` before first paint to prevent flash.

### Core CSS Variables (must exist in globals.css)
```css
--bg-primary       /* page background */
--bg-secondary     /* slightly offset surfaces */
--bg-card          /* card backgrounds */
--bg-sidebar       /* admin sidebar bg */
--accent           /* forest green: #2D4A35 light/warm, #4A7A5A dark */
--accent-hover     /* hover state of accent */
--accent-text      /* always white */
--text-primary     /* main text */
--text-secondary   /* muted labels */
--text-muted       /* disabled/placeholder text */
--border           /* subtle borders */
--shadow           /* card shadow */
--shadow-md        /* elevated shadow */
```

### Typography
- **Headings / Numbers / Prices:** `Playfair Display` (serif) — import via Google Fonts
- **UI / Body / Labels:** `DM Sans` (sans) — import via Google Fonts
- **Admin sidebar brand:** DM Sans, 9px, uppercase, letter-spacing 0.2em

### Accent Color
Forest green `#2D4A35` is the ONLY accent. No blue, purple, or orange anywhere.
In dark mode: lightened to `#4A7A5A` for visibility.

### Status Badge Pattern
All status indicators use: colored dot (6px circle) + pill shape + semantic color
- `completed` → green
- `pending` → amber
- `cancelled` → red/pink
- Never use raw colored text without the pill wrapper

### Admin Sidebar
- Width: 56px fixed
- Icon-only (no text labels)
- Active icon: 36px circle, `--accent` bg, white icon
- Notification dot: 8px circle on Orders icon when pending exist
- User avatar: bottom, initials circle

---

## API Contract

### Auth Routes
```
POST /api/auth/register    body: { name, email, password }
POST /api/auth/login       body: { email, password }
POST /api/auth/logout      (clears session)
GET  /api/auth/me          returns: { id, name, email, role } or 401
```

### Storefront Routes (public)
```
GET  /api/products                  ?category=&search=&page=&limit=
GET  /api/products/:id
POST /api/orders                    body: { items[], shipping, paymentMethod }
GET  /api/orders/:id                (requires auth for customer-owned orders)
```

### Admin Routes (requires admin role)
```
GET    /api/admin/products          ?search=&category=&page=
POST   /api/admin/products          body: product data
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id

GET    /api/admin/orders            ?status=&search=&page=
PUT    /api/admin/orders/:id        body: { status }
GET    /api/admin/orders/export     → CSV

GET    /api/admin/customers
GET    /api/admin/customers/:id

GET    /api/admin/analytics         ?range=7d|30d|90d|1y
```

### Response Format (all routes)
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string, details?: ZodError[] }
```

---

## Database Schema (shared/schema.ts)

All tables live in `shared/schema.ts`. This is the single source of truth for both server types AND client TypeScript types (via Drizzle's InferSelectModel).

### Tables
- `users` — id, email, password(hashed), name, role(admin|staff|customer), createdAt
- `products` — id, name, slug, sku, price, comparePrice, stock, category, images(json), variants(json), description, isActive, createdAt
- `orders` — id, orderNumber, customerId(fk), status, subtotal, tax, discount, total, paymentMethod, shippingAddr(json), createdAt
- `order_items` — id, orderId(fk), productId(fk), variantId, quantity, priceAtTime
- `customers` — id, userId(fk nullable), firstName, lastName, email, phone, avatarColor, totalSpent, orderCount, createdAt
- `sessions` — managed by connect-pg-simple (auto-created)

---

## Auth Flow

```
1. User visits /login
2. Submits email + password → POST /api/auth/login
3. Server: finds user, bcrypt.compare() → if valid, req.login(user) → session saved to pg
4. Client: react-query invalidates 'currentUser' → GET /api/auth/me refetches → stores in cache
5. Navbar reads currentUser from cache → shows user name + logout
6. /admin/* routes: ProtectedRoute in App.tsx checks currentUser.role === 'admin'
7. /api/admin/* routes: server middleware checks req.user?.role === 'admin'
8. Logout: POST /api/auth/logout → req.logout() → client clears cache
```

---

## Zustand Cart Store (store/cart.ts)

```typescript
interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  variant?: string
  placeholderColor?: string
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, qty: number) => void
  clearCart: () => void
  promoCode: string | null
  discount: number
  applyPromo: (code: string) => boolean
  subtotal: () => number
  total: () => number
  itemCount: () => number
}
// Persisted to localStorage via zustand/middleware persist
```

---

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
SESSION_SECRET=a-long-random-string-min-32-chars

# Optional (payment — Phase 5)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Dev only
NODE_ENV=development
PORT=5000
```

---

## NPM Scripts

```json
{
  "dev": "run client + server concurrently",
  "build": "vite build + tsc server",
  "start": "node dist/server/index.js",
  "db:push": "drizzle-kit push",
  "db:seed": "tsx prisma/seed.ts (or server/seed.ts)",
  "db:studio": "drizzle-kit studio"
}
```

---

## Team Skills & Roles

### Nikesh Uprety (Project Lead & Full-Stack Developer)

#### Core Developer Skills
| Area | Expertise | Proficiency |
|------|-----------|------------|
| **Frontend Development** | React, TypeScript, Vite, TailwindCSS, Radix UI, Framer Motion | Expert |
| **Backend Development** | Node.js, Express.js, Drizzle ORM, PostgreSQL, API Design | Expert |
| **Full-Stack Architecture** | Monolithic codebase design, shared schemas, type safety across tiers | Expert |
| **Authentication & Security** | Passport.js, 2FA implementation, bcryptjs, CORS, rate-limiting, session management | Advanced |
| **Database Design** | PostgreSQL schema design, migrations, data modeling, optimization | Advanced |

#### Design & UX Skills
| Area | Expertise | Proficiency |
|------|-----------|------------|
| **UI/UX Design** | Component design, design systems, user flows, wireframing | Advanced |
| **Visual Design** | Graphics design, brand identity, color theory, typography | Advanced |
| **Design Systems** | TailwindCSS implementation, CSS variables, theme management (light/dark/warm modes) | Expert |
| **Responsive Design** | Mobile-first approach, cross-browser compatibility, accessibility | Advanced |

#### System Architecture & Infrastructure
| Area | Expertise | Proficiency |
|------|-----------|------------|
| **System Architecture** | Full-stack application design, microservice patterns, API design | Expert |
| **Deployment & DevOps** | Render.yaml configuration, environment management, production deployment | Advanced |
| **Performance Optimization** | Bundle optimization, caching strategies, database query optimization | Advanced |
| **Security Architecture** | CORS, rate-limiting, secure headers (CSP, STS, X-Frame-Options), data protection | Advanced |

#### Digital Marketing & SEO
| Area | Expertise | Proficiency |
|------|-----------|------------|
| **SEO Strategy** | On-page SEO, meta tags, structured data, keyword optimization | Advanced |
| **Technical SEO** | Performance optimization for search, Core Web Vitals, crawlability | Intermediate |
| **Brand Management** | Brand identity (RARE/RARE.np), visual consistency, messaging | Advanced |
| **E-commerce Marketing** | Product page optimization, conversion optimization, user retention | Intermediate |

#### Project Management
| Area | Expertise | Proficiency |
|------|-----------|------------|
| **Planning & Requirements** | Feature roadmapping, technical specification, scope management | Advanced |
| **Quality Assurance** | Pre-push verification, manual testing, code review | Advanced |
| **Documentation** | Technical documentation, architecture docs, contributor guides | Advanced |

---

### Key Project Contributions
- **Full-stack e-commerce platform** design and implementation
- **Admin dashboard** with analytics, product management, and order tracking
- **Secure authentication system** with 2FA support
- **Brand-aligned design system** with three theme modes (light/dark/warm)
- **Database architecture** with Drizzle ORM and PostgreSQL
- **Security hardening** (CORS fixes, rate-limiting, security headers)
- **Performance optimization** (bundle optimization, image compression)
- **SEO implementation** (meta tags, structured data, accessibility)

---

## Skill Application Matrix

| Feature | Frontend Skills | Backend Skills | Design Skills | Architecture |
|---------|-----------------|-----------------|---------------|-------------|
| Storefront UI | ✓ React/TypeScript | ✓ API design | ✓ Visual design | ✓ Monolithic |
| Admin Dashboard | ✓ Complex UX | ✓ Admin API | ✓ Design system | ✓ RBAC auth |
| Product Management | ✓ Forms/validation | ✓ CRUD ops | ✓ Thumbnail design | ✓ Schema design |
| Order Processing | ✓ Real-time updates | ✓ Transaction handling | ✓ Status badges | ✓ State flow |
| Authentication | ✓ Protected routes | ✓ Passport + 2FA | ✓ Login UI | ✓ Session store |
| Analytics | ✓ Recharts viz | ✓ Data aggregation | ✓ Dashboard layout | ✓ Query optimization |
| SEO & Metadata | ✓ Meta tag helpers | ✓ Structured data API | ✓ OG images | ✓ Performance |

---

## Coding Rules for Cursor

1. **Never use `any` type.** Use Drizzle's `InferSelectModel<typeof table>` for DB types.
2. **All API request bodies validated with Zod** before touching the DB.
3. **Consistent API response shape:** always `{ success, data }` or `{ success, error }`.
4. **React Query keys convention:** `['products']`, `['products', id]`, `['orders']`, `['currentUser']`
5. **No direct fetch() in components** — always go through react-query hooks.
6. **No inline styles** — use Tailwind classes + CSS variables only.
7. **All images use** `<img>` with explicit width/height + `loading="lazy"` (no Next.js image component — this is Vite/React).
8. **shadcn/ui components live in `client/src/components/ui/`** — never edit those files directly; extend by wrapping.
9. **Admin routes require TWO layers of auth:** server middleware AND client ProtectedRoute.
10. **Cart persists to localStorage** via Zustand persist middleware — never wipe it without user action.
11. **Sessions are Postgres-backed** in production — never use in-memory session store in production.
12. **All DB access goes through `server/storage.ts`** — never import db directly into routes.ts.
