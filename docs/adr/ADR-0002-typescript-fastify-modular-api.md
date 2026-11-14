# ADR-0002: TypeScript Fastify Modular API

**Status:** Accepted; implementation in progress  
**Date:** 2026-11-15  
**Authority:** GROWTA-MASTER-PRD-001 §§5–7; TECHNOLOGY-BASELINE; GROWTA-API-SPEC-001

## Context

Growta is evolving a Vite/vanilla-JavaScript field-sales prototype into a multi-tenant operating system. The repository now contains a TypeScript + Fastify API under `services/api`; the frontend remains the existing Vite application. Supabase PostgreSQL is the system of record and Supabase Auth remains the identity provider.

The API foundation currently implements verified Supabase bearer authentication, tenant selection and active-membership validation, tenant-specific role/permission resolution, organization metadata reads, and audit-event reads. It does **not** yet implement tenant provisioning, role/organization administration, operational data APIs, mutation/audit transactions, or offline write synchronization.

The dynamic-organogram model is implemented in the canonical `supabase/migrations/` chain. The separate historical SQL proposal under `database/schema/003` used a different identity model and is not compatible with the API.

## Decision

Use a **TypeScript + Fastify modular monolith** under `services/api`.

- Keep the Vite prototype intact; productize existing workflows incrementally.
- Keep Supabase PostgreSQL as the system of record and Supabase Auth as the identity provider.
- Keep domain modules in one deployable API process initially.
- Keep modules explicit for identity, tenancy, authorization, organization, audit, operational domains, and diagnostics.
- Treat `X-Tenant-ID` as a selector only, never proof of membership.
- Keep the Supabase service-role credential server-side only.
- Preserve database RLS as a second authorization boundary. Because service-role queries bypass RLS, every API query must also enforce tenant and organizational scope in server-side code.
- Add a separate worker only when asynchronous workload or isolation justifies it.
- Keep `supabase/migrations/` as the sole deployable schema history.

## Why Fastify

Fastify aligns with the approved Node service-layer baseline, supports TypeScript, and has a small runtime footprint. Domain boundaries remain explicit in repository code rather than relying on a heavier framework convention.

## Consequences

- Existing browser code continues to use only publishable/anon Supabase credentials.
- The API verifies Supabase JWTs, resolves active tenant membership, evaluates tenant-specific permissions, and enforces explicit data scopes.
- No operational endpoint is enabled until its tenant predicate, scope filter, RLS posture, and cross-tenant tests are in place.
- NestJS is not part of this repository's API runtime unless a future ADR supersedes this decision.
- Legacy workflows must not be removed while their API-backed replacements are incomplete.

## Security constraints

- Never trust tenant IDs, user IDs, role codes, org-unit IDs, or scopes supplied by clients.
- Never expose service-role credentials to browser/PWA code.
- Validate request bodies, path parameters, query parameters, and headers.
- Apply rate limits to authentication-adjacent and mutation endpoints; configure proxy trust only for known trusted proxy hops.
- Use parameterized database operations; never construct SQL from user input.
- Log request IDs and security-relevant outcomes without bearer tokens or secrets.
- Enforce tenant predicates and organizational scopes on every tenant-owned API query.
- Make business mutations and immutable audit events atomic (transaction or database function).

## Verification gate

The API is not production-ready until type-check, unit tests, local Supabase integration tests, JWT tests, cross-tenant denial tests, scope-denial tests, permission-denial tests, mutation/audit atomicity tests, and offline idempotency tests pass. No production deployment is authorized by this ADR.
