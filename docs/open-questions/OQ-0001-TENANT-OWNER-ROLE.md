# OQ-0001 — Initial tenant-owner bootstrap and permission delegation

**Status:** Blocking for tenant provisioning  
**Date logged:** 2026-11-15  
**Module:** Identity, tenancy, flexible RBAC  
**Authority:** GROWTA-MASTER-PRD-001 §§18–19, 45, 98

## Question

How should the first tenant owner receive initial tenant-administration capabilities, and what restrictions apply when tenant administrators create or delegate roles?

## Context

Growta tenants can have different organization charts, designations, job titles, reporting structures, role names, and data scopes. A fixed `TENANT_ADMIN` / `STATE_HEAD` / `TERRITORY_MANAGER` hierarchy is not appropriate as a universal tenant role model.

The Phase 2 schema separates organizational placement, designation, reporting, RBAC roles, permissions, and additional scopes. The global `SUPER_ADMIN` remains a platform-level concept and must never be assigned as a tenant role.

## Options

1. **Recommended:** Platform-controlled provisioning creates a tenant-specific initial owner membership and tenant-defined owner role (or equivalent tenant-scoped permission bundle). The tenant may define other roles and designations freely. The owner can delegate only permissions the owner is allowed to delegate; platform-only permissions are never delegable.
2. Platform operators manually manage all tenant membership and role grants. This is safer initially but does not support tenant self-administration.
3. Allow any tenant administrator to grant any permission in the tenant. This is flexible but creates privilege-escalation risk and is not recommended.

## Recommendation

Use option 1. Do not hardcode a universal business organogram or designation hierarchy. Keep a small platform-controlled bootstrap boundary, then allow tenant-specific roles and permissions within that boundary. Enforce delegation limits server-side and in transactional database operations.

## Decisions required before provisioning API

- Confirm the initial owner is provisioned only by a platform-controlled workflow.
- Define whether owner-level administration can be transferred, and the required recovery process.
- Define whether tenant roles can delegate all tenant permissions or only an explicit subset.
- Define the immutable platform permission namespace that tenant owners can never grant.

## Affected modules

Tenant provisioning, membership lifecycle, RBAC, role delegation, organization management, audit, tenant recovery.

## Blocking status

**Blocking for tenant creation, owner bootstrap, invitations, and role-management endpoints.** The dynamic organization schema and read-only identity context can be developed independently.
