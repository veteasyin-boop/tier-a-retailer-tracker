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
- A tenant is accessible only when the authenticated user has an `active` membership.
- `private.has_tenant_permission(tenant_id, permission_code)` checks active membership, tenant role assignment, active tenant role, and the mapped permission.
- Tenant-owned catalogues use composite foreign keys so a role, membership, or scope cannot reference an object from a different tenant.
- RLS is enabled on every new table. Browser clients can read only their own membership/profile/role/scope context and their tenant's role catalogue. Membership and role-assignment writes are server-only.
- Scope metadata currently supports the approved domain entities Organization and Territory. Self scope is implicit through membership ownership; broader team/region/state scope needs explicit domain definitions before it is added.

## Existing-data mapping

- Global roles and permissions are copied for every existing tenant.
- Existing `public.role_permissions` mappings are copied per tenant.
- No rows are inserted into `memberships` or `membership_roles` for legacy `public.users`; an administrator must verify and map each actual Auth identity in a later provisioning workflow.

## Development setup and verification

Requires Docker and Supabase CLI.

```bash
supabase start
supabase test db
```

The SQL test suite creates two isolated tenants and two Auth users inside a transaction, verifies cross-tenant RLS, membership and permission checks, scope visibility, and self-service restrictions, then rolls back the fixtures.

Apply the migration only to a disposable local/development database during Phase 1 review. Do not run `supabase db push` against production. A production rollout requires a separately approved migration plan, backup/restore rehearsal, and verified Auth-user mapping.

## Known follow-up work

1. Build a server-side tenant provisioning/invitation workflow using service-role credentials held only by the NestJS API.
2. Define and approve the exact identity-management permissions before enabling tenant administrators to invite users or mutate roles/scopes.
3. Add scope-aware authorization to each domain query/API; membership scope metadata alone does not automatically filter existing operational tables.
4. Add a verified migration process from legacy `public.users` to Auth identities.
