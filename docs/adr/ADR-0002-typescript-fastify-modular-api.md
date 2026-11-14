# ADR-0002: TypeScript Fastify Modular API

**Status:** Accepted for the development branch  
**Date:** 2026-11-15  
**Authority:** GROWTA-MASTER-PRD-001 §§5–7; TECHNOLOGY-BASELINE; GROWTA-API-SPEC-001

## Context

Growta requires a trusted server-side boundary for tenant identity, authorization, organizational data scopes, transactional mutations, and audit logging. The current repository is a Vite/vanilla-JavaScript prototype with Supabase client integration; it does not contain a backend service.

The approved technology baseline permits a Fastify or FastAPI service layer. The dynamic organization document previously referred to NestJS, but no NestJS application or dependency exists in this repository. The backend framework must be made explicit before implementation.

## Decision

Build the first backend as a **TypeScript + Fastify modular monolith** under `services/api`.

- Use the existing Node.js 20+ runtime baseline.
- Keep the Vite prototype intact; do not rewrite or relocate it as part of API foundation work.
- Keep Supabase PostgreSQL as the system of record and Supabase Auth as the identity provider.
- Keep domain modules in one deployable API process initially.
- Use explicit modules for identity, tenancy, authorization, organization, audit, and health/diagnostics.
- Use request-scoped authenticated identity and validated tenant context. `X-Tenant-ID` is a selector only, never proof of membership.
- Use a server-only Supabase service credential for privileged writes; never expose it to browser/PWA code.
- Preserve database RLS as a second authorization boundary. API checks do not replace RLS.
- Add a separate worker only when asynchronous workload or isolation justifies it.

## Why Fastify

Fastify is directly aligned with the approved Node service-layer baseline, supports TypeScript, has a small runtime footprint, and avoids introducing a heavier application framework before the domain boundaries and service contracts are established. Domain modules and dependency boundaries will be explicit in repository code rather than relying on framework conventions.

## Consequences

- A new TypeScript API package and its pinned dependencies are required.
- Existing browser code must continue using only publishable/anon Supabase credentials.
- The API must verify Supabase JWTs, resolve active membership for the selected tenant, evaluate tenant permissions, resolve explicit data scopes, and write audit records for mutations.
- No operational data endpoint may be exposed until its RLS policy and API authorization are tested together.
- NestJS is not part of this repository's API runtime unless a future ADR supersedes this decision.

## Security constraints

- Never trust tenant IDs, user IDs, role codes, org-unit IDs, or scopes supplied by clients.
- Never use a service-role credential in the browser.
- Validate all request bodies, path parameters, query parameters, and headers.
- Apply rate limits to authentication-adjacent and mutation endpoints.
- Use parameterized database operations; no string-built SQL.
- Log request IDs and security-relevant outcomes without logging bearer tokens or secrets.
- Enforce tenant predicates and database RLS on every tenant-owned query.

## Verification gate

The API foundation is accepted only after type-check, lint, unit tests, integration tests against local Supabase, JWT verification tests, cross-tenant denial tests, permission-denial tests, and audit-atomicity tests pass. No production deployment is authorized by this ADR.
