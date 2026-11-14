# OQ-0003 — Database authorization context for tenant API queries

**Status:** Blocking before adding new tenant operational-data APIs; current read-only routes remain protected by explicit application-level checks  
**Date logged:** 2026-11-15  
**Module:** API platform, database authorization, multi-tenancy  
**Authority:** Growta tenant isolation and RLS architecture requirements

## Question

Should tenant-owned API reads continue using the Supabase `service_role` client with explicit tenant predicates and server-side permission checks, or should tenant-owned reads execute with the authenticated user's JWT so PostgreSQL RLS also evaluates each request?

## Current implementation

- `services/api/src/platform/supabase.ts` creates a server-side `service_role` client.
- The API validates the incoming Supabase access token through Auth, resolves active tenant membership and permissions, and then executes route queries through the service-role client.
- Service-role requests bypass PostgreSQL RLS. Therefore RLS does **not** provide a second isolation boundary for current API queries.
- Current route queries explicitly filter tenant-owned data by `tenant_id`; tenant resolution also filters the selected tenant and authenticated user.
- Tests assert tenant predicates for identity/RBAC, organization and audit queries. The database RLS suite separately tests authenticated/browser access paths.
- The audit table currently grants read/write access only to `service_role`; it has no authenticated-user SELECT policy.

## Why it matters

With a service-role client, a missing or incorrect tenant predicate can expose another tenant's data even when RLS is enabled. The current approach can be safe only if the API's explicit tenant filtering and authorization checks remain complete and regression-tested for every query.

A user-JWT-scoped client would let RLS evaluate tenant membership for eligible reads, but the existing legacy `tenants` table policies depend on `app.current_tenant_id`, and audit reads currently have no authenticated SELECT policy. Switching clients without a policy audit would break routes or create inconsistent access semantics.

## Options

1. **Continue service-role access with stricter application controls.** Keep explicit tenant predicates, fail-closed permission guards, a shared tenant-scoped data-access layer, and tests proving every query is tenant constrained. This is the least disruptive short-term approach but remains dependent on application correctness.
2. **Use user-JWT-scoped clients for tenant-owned reads.** Add/verify membership-based RLS policies and grants for each API table, including a permission-gated audit SELECT policy. Keep service-role access only for explicitly trusted server operations and transactional RPCs. This provides defense in depth but requires careful policy migration and integration tests.
3. **Use a direct PostgreSQL transaction layer.** Resolve identity and enforce tenant predicates/permissions inside database functions or transaction-scoped access. This can centralize enforcement but introduces additional runtime and operational complexity.

## Recommendation

Adopt option 2 incrementally for tenant-owned read routes after a table-by-table RLS/grant audit. Retain the current service-role path for identity bootstrap/lookups and privileged transactional operations only where justified. Do not switch the client globally until legacy tenant policies and audit SELECT authorization are addressed and verified.

## Decisions required

- Approve the target access pattern for tenant-owned reads.
- Define which tables may be queried with user JWTs and which require trusted server access.
- Approve membership-based RLS for legacy `tenants` reads without relying on caller-controlled `app.current_tenant_id`.
- Approve a permission-gated authenticated SELECT policy for `growta_audit_events`, or explicitly retain audit reads behind a trusted service-role repository.
- Define the required integration tests before migrating any route.

## Affected modules

Supabase client factory, tenant-context resolver, organization API, audit API, future operational data repositories, RLS policies, grants, API integration tests.

## Blocking status

**Blocking before new tenant operational-data APIs are added.** Current read-only endpoints remain available under their explicit application-level tenant predicates, membership checks, permission guards, and regression tests. Do not claim that service-role queries are protected by RLS.
