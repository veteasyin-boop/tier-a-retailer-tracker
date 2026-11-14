# Growta One — Dynamic Organization & Authorization Model

**Status:** Phase 2 database foundation implemented on the development branch  
**Architecture:** Tenant-configurable organizational hierarchy + RBAC + explicit data scopes

## Core design rule

Do not encode an organization chart as a fixed list of roles or levels. Each tenant defines its own unit types and hierarchy. Organization placement, job designation, authorization role, reporting relationship, and data scope are separate concepts.

## Data model

| Table | Responsibility |
|---|---|
| `org_unit_types` | Tenant-defined labels/types such as Division, Region, Branch, Depot, HQ |
| `org_units` | Tenant-owned tree of organizational units; parent-child hierarchy has no fixed depth |
| `designations` | Tenant-defined job titles; descriptive only, never grants permissions |
| `membership_org_assignments` | Exactly one primary organizational placement per tenant membership |
| `membership_org_unit_scopes` | Zero or more additional data scopes; each can include descendants |
| `membership_reporting_relationships` | Primary and dotted-line manager relationships |

The existing `tenant_roles`, `tenant_role_permissions`, `membership_roles`, and `tenant_scope_assignments` remain in place. No legacy organization, territory, user, membership, or role records are automatically mapped.

## Authorization evaluation

A request is authorized using:

1. Authenticated Supabase identity.
2. Active tenant membership.
3. Permission granted through one or more tenant roles.
4. Explicit data scope, including descendant expansion where configured.
5. Record-level constraints and tenant ownership.

A job designation and reporting relationship do not grant permissions. A reporting line is not an access grant. The primary organizational placement is descriptive; additional access is explicitly granted in `membership_org_unit_scopes`.

New permission definitions are registered but **not automatically assigned** to existing roles. Tenant role grants must be explicitly configured through a trusted server-side workflow.

## Integrity and security

- Composite foreign keys prevent cross-tenant unit, membership, and designation links.
- One primary org placement per membership is enforced by the primary key.
- Additional scopes are independently assigned and may include descendants.
- Primary reporting has one active manager per subordinate and database cycle protection.
- Organizational hierarchy has database cycle protection and tenant-level advisory locking during mutations.
- Dotted-line reporting is informational and does not inherit access.
- RLS is enabled on all six new tables. Authenticated clients have read-only access; writes are server-side only.
- Service-role credentials must remain in the Fastify API runtime and never in browser/PWA code.
- Every mutation must be audited server-side with tenant, actor, action, entity, and before/after diff.

## Important implementation boundary

This migration creates the data foundation only. The scope resolver, permission delegation rules, invitation/provisioning endpoints, and audit-writing transaction service must be implemented in the TypeScript Fastify modular monolith before operational data APIs rely on this model. Never interpret a supplied `X-Tenant-ID`, role code, or org-unit ID as proof of authorization.

## Verification

The pgTAP suite checks RLS, tenant isolation, read-only browser access, one primary placement, cross-tenant foreign-key protection, hierarchy cycle protection, reporting cycle protection, and permission catalogue registration.

Run in CI/local development:

```bash
supabase start
supabase test db
supabase db lint
```

No production project is linked or modified by this phase.


## API authorization and audit foundation

The Fastify API now includes:
- A reusable permission guard that checks the resolved tenant permission set and denies by default.
- A tenant-scoped `GET /api/v1/audit-events` endpoint protected by `audit.read`.
- Bounded query validation and tenant predicates on audit reads.
- An append-only `growta_audit_events` table referencing Supabase Auth actors rather than legacy `public.users`.
- Browser roles have no direct audit table privileges. The API service role can append and read events but cannot update or delete them.
- Audit indexes support tenant/time, tenant/entity, and tenant/actor queries.

The existing `public.audit_logs` table is a legacy table whose actor foreign key points to `public.users`; it is intentionally not reused for new Auth-backed membership events.

### Transactional audit requirement

`writeAuditEvent()` provides a validated append operation. A separate PostgREST insert cannot be atomic with a business mutation issued in another request. Therefore, every future sensitive mutation must be implemented as a single PostgreSQL RPC/transaction that performs both the domain mutation and audit insert, or use an equivalent transaction-capable database connection. Do not ship a mutation endpoint that performs a write and then independently attempts to log it.

### Current API endpoints

| Endpoint | Authentication | Authorization |
|---|---|---|
| `GET /health` | None | Public health status |
| `GET /api/v1/tenants/me` | Supabase access token + active tenant membership | Membership context |
| `GET /api/v1/audit-events` | Supabase access token + active tenant membership | `audit.read` |

No invitation, owner bootstrap, role mutation, org mutation, or operational business-data endpoints are exposed yet.
