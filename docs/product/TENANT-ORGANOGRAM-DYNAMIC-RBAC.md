# Tenant Organogram & Dynamic RBAC Specification

**Status:** Implementation foundation added; API integration and production rollout blocked by OQ-0007.
**Migration:** `database/schema/003_tenant_organogram_dynamic_rbac.sql`

## Design principles

1. A Supabase Auth identity is global; a tenant membership is tenant-specific.
2. One identity may have memberships in multiple tenants.
3. Designations describe a person's job title. Roles grant permissions. They are deliberately separate.
4. Organizational units are tenant-owned and their hierarchy is tenant-defined.
5. Reporting lines are tenant-specific and support primary and dotted-line relationships.
6. Data scopes are explicit: `tenant`, `unit`, `subtree`, and `self`.
7. Permission grants are constrained: a role manager can assign only permissions they themselves hold; a membership manager cannot assign a role whose permission set exceeds their own.
8. Database authorization uses the verified Supabase identity (`auth.uid()`) and RLS. `X-Tenant-ID` is context selection, never proof of access.

## Data model

| Table | Purpose | Tenant isolation |
|---|---|---|
| `tenant_org_units` | Configurable hierarchy such as State → Region → Zone → Territory → HQ, or Department → Team | `tenant_id`, composite parent FK, RLS |
| `tenant_designations` | Tenant-defined designations such as ASM, RSM, TSM, Sales Officer | `tenant_id`, RLS |
| `tenant_memberships` | Links `auth.users` to a tenant; stores employee code, display name, designation and unit | Unique `(tenant_id, auth_user_id)`, composite FKs, RLS |
| `tenant_permission_catalog` | Platform permission vocabulary | Global read-only catalog |
| `tenant_roles` | Tenant-defined role definitions | Unique `(tenant_id, role_key)`, RLS |
| `tenant_role_permissions` | Permissions granted to a tenant role | Composite tenant/role FK, RLS |
| `tenant_membership_roles` | Many-to-many role assignment to a membership | Composite tenant/membership and tenant/role FKs, RLS |
| `tenant_membership_scopes` | Explicit record-access scope assignments | Composite tenant FKs, RLS and delegated-scope check |
| `tenant_reporting_lines` | Primary and dotted-line manager relationships | Composite tenant FKs, cycle guard, RLS |
| `tenant_org_audit_events` | Trigger-written audit trail for organizational and RBAC mutations | Tenant RLS; no client write policy |

### Important distinction

The migration creates the authorization and organizational metadata foundation. It does **not** yet retrofit every operational table (retailers, visits, attendance, orders, inventory) with subtree-aware RLS. Those tables must be mapped to tenant memberships and organizational scopes before users can be promised row-level scope enforcement.

## API contract (backend implementation required)

All endpoints are authenticated and tenant-scoped. The API must validate the Supabase access token server-side, derive the actor from the verified JWT `sub`, confirm active membership in the requested tenant, and enforce the permission named below. Never authorize from email, user-editable Auth metadata, request body user IDs, or `X-Tenant-ID` alone.

| Method | Route | Permission | Contract |
|---|---|---|---|
| GET | `/api/v1/tenants/:tenantId/org-units` | `organization.read` | List units; support parent, type, active filters |
| POST | `/api/v1/tenants/:tenantId/org-units` | `organization.manage` | Create unit; validate parent belongs to same tenant |
| PATCH | `/api/v1/tenants/:tenantId/org-units/:unitId` | `organization.manage` | Update unit; reject hierarchy cycles |
| GET | `/api/v1/tenants/:tenantId/designations` | `organization.read` or `designation.manage` | List tenant designations |
| POST | `/api/v1/tenants/:tenantId/designations` | `designation.manage` | Create tenant designation |
| GET | `/api/v1/tenants/:tenantId/memberships` | `membership.read` | Paginated membership list |
| POST | `/api/v1/tenants/:tenantId/memberships` | `membership.manage` | Provision/invite a membership; invitation flow remains an open dependency |
| PATCH | `/api/v1/tenants/:tenantId/memberships/:membershipId` | `membership.manage` | Update employee profile, designation, unit, status |
| GET | `/api/v1/tenants/:tenantId/roles` | `role.manage` | List roles and permission assignments |
| POST | `/api/v1/tenants/:tenantId/roles` | `role.manage` | Create a tenant role |
| PUT | `/api/v1/tenants/:tenantId/roles/:roleId/permissions` | `role.manage` | Replace role permissions; only grant permissions actor holds |
| PUT | `/api/v1/tenants/:tenantId/memberships/:membershipId/roles` | `membership.manage` + `role.manage` | Assign roles; target role permissions must be a subset of actor's effective permissions |
| PUT | `/api/v1/tenants/:tenantId/memberships/:membershipId/scopes` | `scope.assign` + `membership.manage` | Assign scopes no broader than actor's own scope |
| PUT | `/api/v1/tenants/:tenantId/reporting-lines` | `reporting.manage` | Create/update primary or dotted reporting lines |
| GET | `/api/v1/tenants/:tenantId/audit/org` | `audit.read` | Read immutable organizational/RBAC audit events |

Mutation endpoints must validate request bodies, use transactions, emit audit events, apply rate limits to invitations and membership changes, and return the standard API response envelope defined in `docs/api/OPENAPI_SPECIFICATION.md`.

## RLS and security model

- All tenant tables in the migration have RLS enabled.
- Authorization helper functions live in the non-exposed `growta_private` schema and use `SECURITY DEFINER` only to avoid recursive RLS checks. They have fixed empty search paths, fully qualified object names, and explicit execution grants.
- RLS checks active memberships and active tenant roles; it does not trust `raw_user_meta_data`.
- Role assignment checks prevent assigning permissions the actor does not possess.
- Scope assignment checks prevent delegating a broader organizational scope than the actor holds.
- Reporting and organization-unit triggers reject primary hierarchy cycles.
- Audit events are trigger-written; authenticated clients receive SELECT only.
- No tenant owner bootstrap is implemented in this migration. Provisioning must be performed through a separately reviewed trusted bootstrap flow (OQ-0001).
- Do not use Supabase service-role credentials in browser code. Server-side service-role operations must be narrowly scoped and independently authorize the verified actor.

## Migration and rollout

1. Confirm the Supabase project used by the configured tenant API and identify the backend repository (OQ-0007).
2. Apply the migration to a non-production database first.
3. Run the schema and two-tenant RLS tests in `database/tests/003_tenant_organogram_rls.sql`.
4. Run Supabase security and performance advisors.
5. Implement the API routes above in the actual tenant API service.
6. Backfill/associate existing tenant users only after identity mapping is verified. Do not infer Auth identities from email alone.
7. Retrofit operational tables with tenant and organizational scope enforcement as a separate migration.
8. Enable UI management screens only after server-side endpoints and RLS tests pass.

## Known limitations / next work

- The actual tenant API implementation is not present in the inspected repository paths; this branch adds the database contract, not unverified frontend calls.
- Existing legacy `users`, `roles`, and `organizations` tables are untouched.
- The migration is not applied to any Supabase project.
- Membership invitation/bootstrap and operational-table scope enforcement remain blocking dependencies.
