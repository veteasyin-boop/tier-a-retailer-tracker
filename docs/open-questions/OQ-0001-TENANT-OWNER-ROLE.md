# OQ-0001 — Tenant owner and initial administrator role

**Status:** Blocking  
**Date logged:** 2026-11-15  
**Module:** Identity, tenancy, RBAC, tenant provisioning  
**Authority:** GROWTA-MASTER-PRD-001 §§18–19, 45, 98

## Question

Which tenant-scoped role should be assigned to the first user who owns/administers a newly provisioned tenant?

## Context

The current schema and Phase 1 migration contain the legacy roles:

- `SUPER_ADMIN`
- `STATE_HEAD`
- `TERRITORY_MANAGER`
- `FIELD_OFFICER`

The PRD's permission matrix distinguishes a tenant-level **Admin** from a **Super Admin Platform scope**. The current database role catalogue does not contain a dedicated tenant administrator role. The existing `SUPER_ADMIN` description grants platform-wide/system governance semantics and must not be assigned to a tenant owner.

The provisioning API cannot safely activate a tenant owner or grant administrative capabilities until this distinction is explicit. Reusing `STATE_HEAD` would silently change its documented sales-management meaning.

## Why this matters

- The first tenant administrator needs to invite and manage members, assign approved tenant roles, and administer tenant configuration.
- Tenant administrators must never gain cross-tenant/platform access.
- The API must not invent a role or permissions, or allow a client to self-assign them.
- Role assignment must be atomic with tenant membership provisioning and audited.

## Options

1. **Recommended — add a dedicated `TENANT_ADMIN` role.** It is tenant-scoped and distinct from platform `SUPER_ADMIN`. Define its exact permission set, including membership administration, role assignment, tenant settings, and audit visibility. The role must never authorize access outside its own tenant.
2. **Reuse `STATE_HEAD`.** This avoids a new role but conflates state sales supervision with tenant administration and is not recommended.
3. **Keep tenant provisioning platform-operated only.** Do not assign tenant-admin capabilities until a later approved role design; this delays self-service tenant administration.

## Recommendation

Approve option 1. Define `TENANT_ADMIN` as a tenant-scoped role with only tenant-local administration permissions. Keep `SUPER_ADMIN` reserved for platform operations. The exact permission codes and actions should be reviewed before implementation.

## Affected modules

- Tenant provisioning and invitations
- Membership lifecycle
- RBAC and permission catalogue
- Audit logging
- Tenant settings and administration UI

## Blocking status

**Blocking for tenant-owner provisioning and invitation APIs.** Read-only authenticated identity and membership endpoints can be implemented independently. No role should be assigned automatically until this question is resolved.
