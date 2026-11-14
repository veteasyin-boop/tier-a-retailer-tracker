# Growta One — Phase 1 Tenant Identity & RBAC

**Status:** Implemented on branch `growta-one/phase-1-tenant-rbac`  
**Scope:** Additive identity, tenant membership, role, permission, and scope foundation.

## Safety guarantees

- Existing `tenants`, `organizations`, `territories`, `users`, `roles`, `permissions`, `role_permissions`, and field-operation tables are not dropped, renamed, or rewritten.
- Existing global role and permission definitions are copied into tenant-scoped catalogues. The source catalogues remain unchanged.
- Existing application users are not linked to Supabase Auth automatically. The legacy `public.users` table has no verified `auth.users` identity mapping; guessing would risk granting access to the wrong person.
- No production database was connected to or migrated by this work.
- Membership, role assignment, and scope assignment writes are restricted to trusted server-side provisioning. Browser clients cannot create memberships or grant themselves roles/scopes.

## Added objects

| Object | Purpose |
|---|---|
| `auth_profiles` | Safe profile fields keyed to `auth.users.id` |
| `memberships` | User-to-tenant membership and lifecycle status |
| `growta_permissions` | Permission catalogue copied from existing `public.permissions` |
| `tenant_roles` | Tenant-specific role definitions copied from existing `public.roles` |
| `tenant_role_permissions` | Tenant-scoped role-to-permission mappings |
| `membership_roles` | Role assignments for a tenant membership |
| `tenant_scope_assignments` | Organization or territory scope assignments |

## Authorization model

- Authentication identity comes from Supabase Auth `auth.uid()`; client-selected roles, email patterns, user metadata, and local PINs are not authorization sources.
- A tenant is accessible only when the authenticated user has an `active` membership and the tenant itself is active.
- `private.has_tenant_permission(tenant_id, permission_code)` checks active membership, tenant role assignment, active tenant role, and the mapped permission.
- Tenant-owned catalogues use composite foreign keys so a role, membership, or scope cannot reference an object from a different tenant.
- RLS is enabled on every new table. Browser clients can read only their own membership/profile/role/scope context and their tenant's role catalogue. Membership and role-assignment writes are server-only.
- Scope metadata currently supports the approved domain entities Organization and Territory. Self scope is implicit in membership ownership; broader team/region/state scope needs explicit domain definitions before it is added.

## Existing-data mapping

- Global roles and permissions are copied for every existing tenant.
- Existing `public.role_permissions` mappings are copied per tenant.
- No rows are inserted into `memberships` or `membership_roles` for legacy `public.users`; an administrator must verify and map each actual Auth identity in a later provisioning workflow.

## Local development and verification

The first migration is a conflict-safe bootstrap snapshot of the repository's existing core schema and Bihar seed:

- `database/schema/001_core_multi_tenant_schema.sql`
- `database/seeds/001_bihar_initial_seed.sql`

It uses `CREATE TABLE IF NOT EXISTS`, guarded policy creation, and conflict-safe seed inserts. The next migration adds the tenant identity/RBAC tables. The catalog/orders/inventory SQL file is deliberately not included in this phase; it has a separate legacy policy syntax defect that needs its own review.

Requires Docker and the Supabase CLI:

```bash
supabase start
supabase test db
supabase db lint
```

The pgTAP suite creates two isolated tenants and Auth users in a transaction. It verifies RLS activation, cross-tenant visibility, permission checks, and that authenticated users cannot create memberships, roles, role assignments, or scopes. Test fixtures are rolled back.

**Do not link a production project or run `supabase db push` against production.** A production rollout requires a separately approved migration plan, backup/restore rehearsal, and verified Auth-user mapping. The legacy `current_setting('app.current_tenant_id')` policies on pre-existing core tables are preserved for compatibility; they are not the authorization mechanism for the new membership tables and must be replaced with verified membership-based policies before those legacy tables are exposed through the new tenant API.

## Known follow-up work

1. Build a server-side tenant provisioning/invitation workflow using service-role credentials held only by the NestJS API.
2. Define the exact identity-management permission semantics before enabling tenant administrators to invite users or mutate roles/scopes.
3. Add scope-aware authorization to each domain query/API; scope metadata alone does not automatically filter existing operational tables.
4. Add a verified migration process from legacy `public.users` to Auth identities.


## API foundation verification

The development branch currently exposes the following authenticated read surface:
- `GET /api/v1/tenants/me` — active tenant membership context.
- `GET /api/v1/organization/unit-types`, `/units`, and `/designations` — tenant-wide organization metadata protected by `organization.read`.
- `GET /api/v1/audit-events` — tenant-filtered audit history protected by `audit.read`, with bounded filters and composite keyset pagination.

The API request boundary validates the Supabase bearer token, active tenant, and active membership before resolving permissions. Cross-tenant membership selection is denied. The API unit suite verifies tenant predicates for identity, role, permission, scope, organization, and audit queries. CI passed the API type-check/unit suite and all 45 pgTAP database/RLS tests on commit `16a2f34`. On commit `cbb61e0`, API type-check/unit tests passed again, all 45 pgTAP tests passed, and the fixture-backed populated PostgREST audit pagination test passed.

The database CI runs a fixture-backed PostgREST integration test against five local audit rows sharing one timestamp. It verifies the composite cursor's UUID tie-break ordering across three pages, with no duplicate or skipped records. The test creates its Auth user and audit rows only against the disposable local Supabase instance and refuses non-local URLs.

No tenant provisioning, invitation, owner bootstrap/transfer, role mutation, organization mutation, or operational business-data endpoints are implemented. These remain blocked by unresolved provisioning/delegation decisions and the need for explicit per-domain scope contracts. No production database has been linked or migrated.

## Additional security and API hardening

- Organization metadata endpoints now use endpoint-specific query schemas. Tree filters are accepted only by the organizational-units endpoint; unsupported filters are rejected rather than silently ignored.
- The HTTP Bearer authentication scheme is parsed case-insensitively, as required by HTTP authentication scheme semantics.
- API regression tests verify authentication on every extracted route, audit permission enforcement, exact tenant selection, tenant predicates on identity/RBAC/organization/audit queries, and organizational tree-filter behavior.
- **Service-role boundary:** API data queries currently use the Supabase `service_role` client, which bypasses RLS. Explicit tenant predicates and server-side membership/permission checks are therefore the effective API isolation boundary. RLS protects browser/non-service-role access paths, not these API queries. See `docs/open-questions/OQ-0003-API-SERVICE-ROLE-RLS-BOUNDARY.md`.
- Legacy role grants are not changed. `docs/open-questions/OQ-0002-LEGACY-STATE-HEAD-PERMISSIONS.md` records the broad `STATE_HEAD` grant and the unassigned `TERRITORY_MANAGER` seed role; `supabase/diagnostics/legacy-role-permission-audit.sql` provides a read-only grant inventory.
- OQ-0001 remains blocking for tenant provisioning, owner bootstrap/transfer, invitations, and role delegation. OQ-0002 blocks assigning unreviewed legacy roles. OQ-0003 blocks adding tenant operational-data APIs until the database authorization context is approved.
