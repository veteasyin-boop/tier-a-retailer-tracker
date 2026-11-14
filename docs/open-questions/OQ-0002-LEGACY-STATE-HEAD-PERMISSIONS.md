# OQ-0002 — Legacy STATE_HEAD role authorization semantics

**Status:** Blocking before legacy role migration or tenant operational-data access  
**Date logged:** 2026-11-15  
**Module:** Identity, legacy RBAC compatibility, authorization  
**Authority:** Existing legacy role/permission catalogue and approved tenant RBAC architecture

## Question

Should the legacy `STATE_HEAD` role retain its current broad legacy permission grants when its role definition is copied into each tenant's role catalogue, or must those grants be narrowed/replaced before the role can authorize tenant API operations?

## Context

The legacy role catalogue grants `STATE_HEAD` all permissions currently represented in the legacy permission mapping. The new tenant API excludes the platform-only `SUPER_ADMIN` role from tenant role resolution, but does not currently exclude `STATE_HEAD`. Consequently, a membership assigned a tenant role copied from legacy `STATE_HEAD` may resolve a broad permission set.

The flexible organization model intentionally does not equate job titles, reporting position, or organizational level with authorization. A role's effective permissions must come from explicit tenant role-permission assignments. Silently changing legacy grants during migration would also alter existing behavior without an approved migration rule.

## Existing seed findings

The repository's Bihar seed currently:
- Grants every permission in the legacy catalogue to `STATE_HEAD`.
- Grants every permission in the legacy catalogue to `SUPER_ADMIN` (the new API excludes this role from tenant role resolution).
- Gives `FIELD_OFFICER` a limited explicit permission set.
- Defines `TERRITORY_MANAGER` but does not add any `role_permissions` rows for it in this seed.

These are facts about the checked-in seed, not confirmation that they are the intended production authorization policy. The live development database must be inspected before a migration decision is made.

Use the read-only diagnostic `supabase/diagnostics/legacy-role-permission-audit.sql` after applying the RBAC migration to compare source grants with each tenant's copied grants. It does not change any permissions.


## Why it matters

- Broad legacy grants may unintentionally authorize future tenant API endpoints.
- Treating `STATE_HEAD` as inherently privileged would reintroduce a fixed universal hierarchy.
- Automatically narrowing grants could break existing workflows and violate the non-destructive migration requirement.
- Operational endpoints must not rely on unreviewed legacy permission semantics.

## Options

1. Preserve copied grants exactly, but keep legacy-derived roles out of newly provisioned memberships until each tenant explicitly reviews and accepts the permissions.
2. Define an approved permission-by-permission replacement mapping for legacy roles, then migrate tenant role grants using a reviewed migration.
3. Exclude `STATE_HEAD` from effective tenant authorization as a temporary compatibility restriction. This is a behavior change and requires explicit approval and impact analysis.

No option is selected by this document.

## Decisions required

- Confirm whether legacy `STATE_HEAD` grants are valid tenant permissions in the new model.
- Define the migration treatment for existing role-to-permission mappings.
- Define whether the legacy role code is retained, renamed, or replaced with tenant-defined roles.
- Specify a review/acceptance requirement before a tenant can assign a migrated role.
- Confirm whether any permission codes are platform-only and must be impossible to grant from tenant roles.

## Affected modules

Legacy role/permission migration, tenant role catalogue, membership role assignment, permission resolution, operational API authorization, tenant provisioning.

## Blocking status

**Blocking for assigning legacy `STATE_HEAD` to tenant memberships and for exposing operational endpoints whose authorization depends on the affected grants.** Read-only tenant context and organization metadata endpoints remain available under their existing explicit permissions.
