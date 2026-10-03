# TECHNOLOGY BASELINE — GROWTA

**Document ID:** GROWTA-ENG-TECH-001  
**Authority:** GROWTA-MASTER-PRD-001 (Section 6)  
**Status:** Approved Prototype Baseline  
**Last Updated:** 2026-10-04  

---

## 1. RUNTIME & DEVELOPMENT ENVIRONMENT

| Component | Target Version | Current Prototype Baseline | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | v20.x LTS | v20+ Windows Node | Core runtime for tooling and API services |
| **Package Manager** | npm v10.x | npm.cmd | Always invoke `npm.cmd` on Windows PowerShell |
| **Build Bundler** | Vite 5.4.14 | Vite 5.4.14 | ESM fast dev server with production minification |
| **Operating System Target** | Linux (Prod) / Windows (Dev) | Windows 11 x64 | Cross-platform compatibility required |

---

## 2. FRONTEND PLATFORM (WEB & PWA SHELL)

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Core Structure** | Semantic HTML5 | - | Mobile and enterprise web shells |
| **Styling & Design System** | Vanilla CSS3 Tokens | Custom Design System | CSS variables, responsive bento grids, glassmorphism |
| **Typography** | Google Fonts | Outfit, Plus Jakarta Sans | Modern agritech enterprise typography |
| **Client Scripting** | Vanilla ES Modules (ESM) | ES2022+ | Zero framework bloat for maximum field speed |
| **Mapping Engine** | Leaflet / OpenStreetMap | Leaflet v1.9.4 CDN | GPS coordinate visualization, TSP route overlays |
| **Spreadsheet Processing** | SheetJS (xlsx) | v0.18.5 | Excel import/export of retailer directories & rosters |
| **Offline Storage** | IndexedDB + localStorage | Custom Wrapper (`idbStorage.js`) | Storefront photos, large blobs, offline queues |

---

## 3. BACKEND & PERSISTENCE PLATFORM

| Layer | Technology | Current Baseline | Target Enterprise Architecture |
| :--- | :--- | :--- | :--- |
| **Database Engine** | PostgreSQL 15+ | Supabase PostgreSQL 15 | Multi-tenant relational database with RLS |
| **Cloud Client SDK** | `@supabase/supabase-js` | v2.117.2 | Real-time WebSocket subscriptions and PostgREST |
| **Backend API** | Modular Monolith | Direct PostgREST Client | Fastify / FastAPI Node/Python service layer |
| **Caching & Queuing** | Redis 7+ | In-memory IDB queue | Async task workers and GPS point ingestion |
| **Object Media Storage** | S3 / Supabase Storage | IndexedDB client cache | Dealer storefront photos, TA/DA receipt images |

---

## 4. SECURITY & AUTHENTICATION BASELINE

| Component | Specification |
| :--- | :--- |
| **Authentication** | Supabase Auth (JWT with refresh tokens) + Local Manager PIN (`8888`) |
| **Authorization** | Role-Based Access Control (Field Rep, Territory Manager, State Head, Super Admin) |
| **Tenant Isolation** | PostgreSQL Row-Level Security (RLS) scoped by `tenant_id` |
| **Audit Trails** | Append-only `audit_logs` table for all state mutations |

---

## 5. DEPENDENCY VERSION RULES

Per Section 6 of GROWTA-MASTER-PRD-001:
1. Agents **MUST NOT** upgrade dependencies casually.
2. Any version bump requires:
   - Specific justification (security CVE or required feature).
   - Compatibility impact assessment.
   - Successful execution of test suite and `npm run build`.
   - Documentation in changelog.
