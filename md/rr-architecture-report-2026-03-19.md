# RARE Nepal (rr) — Codebase Architecture Report
**Date**: 2026-03-19  
**Repo**: `rr`  

## Executive summary
This repository is a **TypeScript + Node.js monolith**: one server process provides:
- a **React (Vite) single-page app** for customer/admin UI
- an **Express API** (under `/api/*`)
- an **admin notifications WebSocket** (`/ws/admin/notifications`)

The main persistence layer is **PostgreSQL**, accessed through **Drizzle ORM** with schema/types in `shared/`.

## Technology stack
- **Frontend**: React + Vite (in `client/`)
- **Backend**: Express (in `server/`)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Passport Local + cookie-backed sessions (session store in Postgres)
- **Realtime**: `ws` WebSocket server
- **Media**: local uploads on disk (`uploads/*`) + Cloudinary integration
- **Email**: Nodemailer (Mailjet credentials referenced by env example)

## Repository layout (high level)
- **`client/`**: React SPA, bundled by Vite
- **`server/`**: Express app, routes, auth, middleware, websocket, DB access, seed script
- **`shared/`**: Drizzle schema + shared types
- **`script/`**: build script (bundles server + builds client)
- **`migrations/`**: Drizzle migrations output (configured)
- **`md/`**: project docs/reports (this report lives here)

## Runtime architecture
The application runs as a single Node process that serves the SPA and API, and hosts the WebSocket endpoint.

![Runtime architecture](./rr_runtime_architecture.png)

### Key boundaries
- **HTTP boundary**: Browser ↔ Express (SPA + `/api/*`)
- **WS boundary**: Browser (admin) ↔ WebSocket server (`/ws/admin/notifications`)
- **Data boundary**: Server ↔ PostgreSQL (Drizzle schema in `shared/schema.ts`)
- **File boundary**: Server ↔ local disk (`uploads/*`)
- **Third-party boundary**: Server ↔ Cloudinary, SMTP provider

## Build & deploy packaging
Build produces two outputs:
- **Client build**: Vite output to `dist/public`
- **Server bundle**: esbuild bundles `server/index.ts` to `dist/index.cjs`

![Build pipeline](./rr_build_pipeline.png)

### NPM scripts (from `package.json`)
- **`npm run dev`**: starts backend with `tsx` (dev mode), uses Vite middleware
- **`npm run build`**: runs `script/build.ts` (client build + server bundle)
- **`npm run start`**: runs production server `node dist/index.cjs`
- **`npm run db:push`**: pushes schema via `drizzle-kit`
- **`npm run db:seed`**: seeds initial data via `server/seed.ts`

## Entry points and “centers of gravity”
- **Backend entry**: `server/index.ts`
  - Express setup, sessions, auth wiring, API route registration
  - dev: Vite middleware, prod: static serving from `dist/public`
  - initializes WebSocket server
- **API surface**: `server/routes.ts`
  - main REST endpoints (auth flows, admin ops, uploads/media, etc.)
- **Auth**: `server/auth.ts`
  - Passport local strategy and session serialization
- **Database**: `server/db.ts` + `shared/schema.ts`
  - Drizzle connection and schema definition
- **Storage abstraction**: `server/storage.ts`
  - `PgStorage` (primary) and memory stub
- **Realtime**: `server/websocket.ts`
  - admin notifications WS endpoint

## Data model & migrations
- **Schema source of truth**: `shared/schema.ts`
- **Migrations output dir**: `migrations/` (per `drizzle.config.ts`)
- **Operational workflow**:
  - schema change → `npm run db:push` (or migrations) → update seed if needed

## Security & middleware notes (high-level)
- session cookies + server-side session store in Postgres
- security middleware is centralized under `server/middleware/security.ts`
- API + WS are served from the same origin in typical deployments (simplifies CORS)

## Operational dependencies (external systems)
- **PostgreSQL**: required (`DATABASE_URL`)
- **Cloudinary**: media management
- **SMTP (Mailjet)**: outbound emails (OTP/invites/notifications)
- **Local disk**: uploads directory (ensure persistence in hosting environments)

## Suggested “mental model” for contributors
1. Start at `server/index.ts` (boot sequence and wiring).
2. Follow `server/routes.ts` for API behavior.
3. Look at `shared/schema.ts` to understand entities and DB relationships.
4. Use `server/storage.ts` as the data-access boundary; keep route handlers thin.
5. For realtime/admin notifications, inspect `server/websocket.ts`.

---
## Appendix: diagrams source
The diagrams in this report are generated from Mermaid sources in:
- `md/rr_runtime_architecture.mmd`
- `md/rr_build_pipeline.mmd`
