# OQ-0007: Tenant API and Supabase Project Alignment

**Module:** Identity / tenant API / database deployment  
**Status:** Blocking  
**Date:** 2026-11-15

## Question & Context

Which backend repository and Supabase project are the source of truth for the tenant API used by this frontend?

The current frontend calls `VITE_API_BASE_URL/api/v1/tenants` and `/tenants/me`, and authenticates with Supabase email/password. The inspected Git repository contains the tenant-aware client flow but no corresponding API server implementation in the inspected paths. The configured Supabase project reference embedded in the legacy client does not match the projects visible in the connected Supabase account.

## Why it matters

The dynamic organogram migration references `public.tenants` and Supabase Auth `auth.users`. Applying it to the wrong project, or to a database with a different tenant membership schema, can create an isolated parallel identity model or break tenant authorization.

## Options considered

1. **Identify the actual tenant API repository and its Supabase project** — preferred. Align schema, API, RLS, and deployment in one source of truth.
2. **Adopt the configured legacy frontend Supabase project** — only after confirming ownership, schema, and tenant API compatibility.
3. **Create a separate Growta Supabase project** — only after explicit project and cost approval; requires a deliberate migration and identity/data migration plan.

## Affected modules

- Supabase Auth and tenant discovery
- Tenant membership and owner bootstrap
- Dynamic organogram and RBAC
- Operational data isolation
- API deployment and environment configuration

## Blocking vs. non-blocking

**Blocking** before applying migration to a live database, implementing production tenant API endpoints, or enabling organizational administration UI.


## Repository reconnaissance update — 2026-11-15

The connected GitHub account was searched for likely Growta backend repositories. Repositories named `Growta` and `Growta-Agri` currently expose AI Studio application starter READMEs, while `Growtaa` is empty and `Growtaaa` contains a separate FieldProof build pack. None was verified as the tenant API implementation for this frontend.

The repository's current frontend contract has now been documented in `docs/api/TENANT_DISCOVERY_API_CONTRACT.md`. It records the two existing GET calls and the exact minimum response fields consumed by `src/services/auth.js`. This does not resolve the backend location or Supabase project.

## Required owner input to unblock implementation

Provide the repository URL that contains the deployed `/api/v1/tenants` service, or confirm that no backend exists and explicitly authorize creating a new NestJS API in a named repository. Also identify the Supabase project reference used by that service. Do not share service-role keys or other secrets in chat.
