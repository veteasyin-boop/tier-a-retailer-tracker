# OQ-0007: Production Supabase Project Alignment

**Module:** Identity / tenant API / database deployment  
**Status:** Blocking for live database rollout; resolved for repository/API source alignment  
**Updated:** 2026-11-15

## Resolution

The tenant API source of truth for this codebase is now identified: `services/api` in this repository, on branch `growta-one/phase-2-dynamic-organogram`. It is a TypeScript + Fastify service, not NestJS. Its tenant discovery and tenant-context endpoints are documented in `docs/api/TENANT_DISCOVERY_API_CONTRACT.md`.

The canonical schema history is `supabase/migrations/`. The standalone `database/schema/003_tenant_organogram_dynamic_rbac.sql` proposal was a separate, incompatible model and has been moved to `database/legacy-nondeployable/` for reference only.

## Remaining question

Which Supabase project reference is the intended development/staging/production target for this API, and which existing project contains the authoritative legacy tenant and operational data?

Do not send service-role keys or database passwords. A project reference and confirmation of environment ownership are sufficient to plan the next controlled validation.

## Why it matters

The migration chain references Supabase Auth `auth.users` and existing Growta tenant tables. Running it against the wrong project could create a parallel identity model, conflict with existing tables, or expose operational data incorrectly.

## Options

1. **Use the existing authoritative Supabase project** after read-only schema/policy inventory, migration-history comparison, and verified Auth identity mapping.
2. **Use a separate development project** for migration rehearsal, with explicit approval and no production data copied unless appropriately protected.
3. **Create a new production project** only after data migration, identity mapping, backup, rollback, and cost plans are approved.

## Blocking boundary

This question blocks linking a hosted project, applying migrations to a hosted database, production tenant provisioning, and production deployment. It does not block repository-only development, local Supabase tests, or static security work.

## Required evidence before live rollout

- Confirmed project reference and environment (development, staging, or production).
- Read-only inventory of existing tables, RLS flags, policies, grants, indexes, functions, and migration history.
- Reconciled schema drift and a tested migration/rollback plan.
- Verified mapping from existing application users to Supabase Auth identities; never infer identity matches from email or display name alone.
