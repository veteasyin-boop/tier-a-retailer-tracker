# Growta API Module Boundaries

## Purpose

The API remains a modular monolith. Route registration and cross-cutting concerns live in `src/app.ts`; domain route handlers live beside their domain schemas and services.

## Route ownership

| Route module | Registered paths | Responsibility |
|---|---|---|
| Organization | `GET /api/v1/organization/unit-types`, `GET /api/v1/organization/units`, `GET /api/v1/organization/designations` | Read tenant organization metadata |
| Audit | `GET /api/v1/audit-events` | Read immutable audit events with bounded keyset pagination |
| Identity | `GET /api/v1/tenants/me` | Return the authenticated user's selected tenant context |

## Cross-cutting responsibilities

- `app.ts` owns Fastify construction, request IDs, body limit, CORS, rate limiting, error serialization, bearer-token verification, tenant selection, and tenant-context resolution.
- `src/types/fastify.d.ts` declares the request-scoped `tenantContext` property.
- Domain route modules own endpoint-specific query validation, permission checks, tenant-scoped database access, and response serialization.
- Route plugins inherit the parent authentication hook. `/health` remains the only public route.

## Security invariants

1. Every tenant-scoped Supabase query explicitly filters `tenant_id` (or the tenant primary key for the tenant lookup).
2. The API uses a server-side Supabase `service_role` client, which bypasses RLS. Therefore explicit tenant predicates and server-side authorization are the effective API isolation boundary; RLS protects browser/non-service-role access paths but is not a second boundary for these API queries.
3. The bearer token is validated through Supabase Auth before resolving the selected tenant.
4. `X-Tenant-ID` selects a tenant; it is not authorization. Active membership and permissions are resolved server-side.
5. The service-role Supabase client is passed only to server-side route plugins and is never serialized to clients.
6. Permission checks remain fail-closed through the existing authorization guard.
7. This extraction does not add write endpoints, role mutation, invitations, tenant provisioning, or operational data access.

## API compatibility

This change is a structural refactor only. Existing route paths, query schemas, permission names, response envelopes, pagination ordering, and tenant filters are preserved. No database migration is required.

## Verification

The refactor is verified by the existing API type-check and unit/injection test suite, plus the existing Supabase database/RLS and populated PostgREST audit-pagination workflow. Check the branch's GitHub Actions runs for the commit-specific results.
