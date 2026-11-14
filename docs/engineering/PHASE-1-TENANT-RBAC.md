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
- `GET /api/v1/tenants` — authenticated discovery of active tenant memberships before tenant selection; no tenant header is accepted.
- `GET /api/v1/tenants/me` — active tenant membership context after tenant selection.
- `GET /api/v1/organization/unit-types`, `/units`, and `/designations` — tenant-wide organization metadata protected by `organization.read`.
- `GET /api/v1/audit-events` — tenant-filtered audit history protected by `audit.read`, with bounded filters and composite keyset pagination.

The API request boundary validates the Supabase bearer token, active tenant, and active membership before resolving permissions. Cross-tenant membership selection is denied. The API unit suite verifies tenant predicates for identity, role, permission, scope, organization, and audit queries. Latest verified CI on commit `1321c94792971aead2ed7b7e57f9ea9fa723ab18`: API checks passed (run `43636195159`); database/RLS checks, all 45 pgTAP tests, populated PostgREST audit pagination integration, and local Supabase cleanup passed (run `43636195136`).

The database CI runs a fixture-backed PostgREST integration test against five local audit rows sharing one timestamp. It verifies the composite cursor's UUID tie-break ordering across three pages, with no duplicate or skipped records. The test creates its Auth user and audit rows only against the disposable local Supabase instance and refuses non-local URLs.

No tenant provisioning, invitation, owner bootstrap/transfer, role mutation, organization mutation, or operational business-data endpoints are implemented. These remain blocked by unresolved provisioning/delegation decisions and the need for explicit per-domain scope contracts. No production database has been linked or migrated.

## Additional security and API hardening

- Organization metadata endpoints now use endpoint-specific query schemas. Tree filters are accepted only by the organizational-units endpoint; unsupported filters are rejected rather than silently ignored.
- The HTTP Bearer authentication scheme is parsed case-insensitively, as required by HTTP authentication scheme semantics.
- API regression tests verify authentication on every extracted route, audit permission enforcement, exact tenant selection, tenant predicates on identity/RBAC/organization/audit queries, and organizational tree-filter behavior.
- **Service-role boundary:** API data queries currently use the Supabase `service_role` client, which bypasses RLS. Explicit tenant predicates and server-side membership/permission checks are therefore the effective API isolation boundary. RLS protects browser/non-service-role access paths, not these API queries. See `docs/open-questions/OQ-0003-API-SERVICE-ROLE-RLS-BOUNDARY.md`.
- Legacy role grants are not changed. `docs/open-questions/OQ-0002-LEGACY-STATE-HEAD-PERMISSIONS.md` records the broad `STATE_HEAD` grant and the unassigned `TERRITORY_MANAGER` seed role; `supabase/diagnostics/legacy-role-permission-audit.sql` provides a read-only grant inventory.
- OQ-0001 remains blocking for tenant provisioning, owner bootstrap/transfer, invitations, and role delegation. OQ-0002 blocks assigning unreviewed legacy roles. OQ-0003 blocks adding tenant operational-data APIs until the database authorization context is approved.


## Legacy browser data-plane security review (2026-11-15)

A static review of the existing browser client and legacy schema snapshots found that the prototype is **not ready for multi-tenant onboarding**:

- The browser still calls Supabase directly for operational data from `src/services/supabase.js` and `src/services/storage.js`; those requests bypass the new API's tenant, permission, and org-scope checks.
- Legacy operational tables in `supabase_schema.sql` / `supabase_schema_rls.sql` do not have a `tenant_id` key.
- `supabase_schema.sql` contains permissive `USING (true)` policies, including policies intended for public/browser access.
- `supabase_schema_rls.sql` trusts user-editable JWT `user_metadata` for role and representative identity and treats an email substring as manager evidence.
- `src/services/auth.js` has a default manager PIN, a browser-stored admin session flag, and client-side representative password comparison. `supabase_schema.sql` stores an assistant password in plaintext with a weak default.

These are source-snapshot findings, not a statement about the exact deployed policy/grant state. Run the read-only `supabase/diagnostics/tenant-rls-access-inventory.sql` against the development database to inspect actual RLS flags, policies, grants, tenant-key coverage, tenant-leading indexes, and SECURITY DEFINER functions.

The target is to migrate legacy operations behind authenticated API routes while preserving offline storage and sync. Do not blanket-rewrite legacy RLS or drop the old credential fields before a verified data mapping and replacement flow exists. See:
- `docs/engineering/LEGACY-DATA-PLANE-SECURITY-INVENTORY.md`
- `docs/open-questions/OQ-0004-LEGACY-BROWSER-TENANT-ISOLATION.md`

OQ-0004 blocks multi-tenant onboarding against the legacy browser data plane. OQ-0001 through OQ-0006 remain open as applicable to their stated blockers; the email/password method decision itself is recorded as accepted in ADR-0003. No production policy, credential, or database changes were made.


## Email/password authentication decision (2026-11-15)

The product owner confirmed that the existing email/password sign-in method is to be retained. ADR-0003 records the target: individual Supabase Auth accounts, post-login tenant discovery, server-verified tenant membership, and tenant-defined permissions. Legacy manager PINs, plaintext representative passwords, email-substring role inference, and user-editable metadata are not trusted authorization sources. Legacy credentials are to be reconciled to verified identities and reset through Supabase Auth rather than copied into the new identity system.

The API now provides authenticated `GET /api/v1/tenants` for membership discovery before tenant selection. The route is covered by tests for bearer-token enforcement, no tenant-header requirement, filtering by authenticated user, active membership, and active tenant. This endpoint does not provision accounts or memberships. The legacy browser login UI and direct-Supabase operational data plane have not been cut over; they remain isolated to the existing controlled prototype until the identity mapping, invitation/reset workflow, offline queue ownership, and operational API paths are complete.

See `docs/adr/ADR-0003-supabase-auth-email-password.md`, OQ-0004, OQ-0005, and OQ-0006. The current UI still uses a legacy `isAdmin` boolean and locally selected representative identity; OQ-0006 blocks connecting that UI to tenant memberships until every action is mapped to tenant-defined permissions.
