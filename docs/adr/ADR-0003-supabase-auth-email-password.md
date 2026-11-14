# ADR-0003: Individual Supabase Auth email/password identities for tenant users

**Status:** Accepted for the development branch  
**Date:** 2026-11-15  
**Authority:** Product-owner decision in the Growta implementation conversation; GROWTA-MASTER-PRD-001; ADR-0002

## Context

The legacy field prototype supports a local manager PIN, locally selected representative names, and representative password comparison against the legacy `assistants` table. The manager/representative state is persisted in browser storage. The code also infers a manager role from user-editable Auth metadata or email substrings.

Those mechanisms are not an authentication or authorization boundary and cannot safely support multiple tenants. The new API already validates Supabase Auth access tokens and resolves tenant membership and permissions server-side.

## Decision

Retain **email/password as the user-facing sign-in method**, implemented exclusively through Supabase Auth.

1. Every human operator has an individual Supabase Auth user account. Shared representative credentials are not supported.
2. The browser calls Supabase Auth `signInWithPassword` and sends the returned access token to the API.
3. Immediately after authentication, the client calls `GET /api/v1/tenants` to discover active tenant memberships. The user selects a tenant only from that server response.
4. The client sends the selected tenant UUID as `X-Tenant-ID` on tenant-scoped API calls. The API validates active tenant and membership on every request.
5. Roles, permissions, designation, org placement, and scopes are derived from tenant membership tables. Email addresses, email substrings, Auth user metadata, local storage, session storage, and client-supplied representative names are never authorization sources.
6. Sign-out clears the Supabase Auth session and active tenant selection. The offline queue must pause when the signed-in user or selected tenant changes; pending records are never rebound to another identity.
7. Password reset and recovery use Supabase Auth's supported recovery flow. The application must not implement password storage or verification itself.

## Legacy credential migration

The checked-in prototype includes a default manager PIN and a plaintext `assistants.password` field with a default representative password. These credentials must not be copied into the new identity system or treated as proof of identity.

Each legacy person must be reconciled to a verified individual email address and a tenant membership by an authorized operator. Issue an invitation/password-reset flow for the new Auth identity. Do not automatically map a legacy row to an Auth account by matching display name or email alone. Existing pending offline operations must be retained and quarantined until their creator's identity is resolved.

The legacy PIN/password login must remain available only in the controlled single-tenant prototype during the transition. It must not be enabled for new tenant users or exposed as an alternate bypass around Supabase Auth.

## Tenant discovery API

The development API exposes `GET /api/v1/tenants`, which:
- requires a verified Supabase bearer token;
- does not require `X-Tenant-ID`, because it runs before tenant selection;
- returns only active tenant memberships for the authenticated `auth.users.id`;
- excludes inactive tenants;
- returns no role or permission claims;
- does not create memberships or provision tenants.

All other tenant-scoped endpoints continue requiring `X-Tenant-ID` and independently resolve the authenticated user's active membership and permissions.

## Consequences

- A single email/password account can belong to multiple tenants, with tenant selection after login.
- A tenant's organization chart and role names remain tenant-defined; there is no global manager/field-rep role mapping in the authentication layer.
- Existing prototype authentication UI cannot be switched over safely until the tenant mapping and account recovery/provisioning workflow are implemented.
- Legacy plaintext credentials, local PINs, and metadata-derived roles are migration blockers, not compatibility features.
- Password reset is required for legacy users unless a separate security review approves another migration mechanism. This ADR recommends reset rather than importing known plaintext credentials.

## Security and verification requirements

- Never log passwords, access tokens, refresh tokens, or recovery links.
- Never store passwords in IndexedDB, local storage, application tables, or queued mutations.
- Use HTTPS in deployed environments; restrict CORS to configured application origins.
- Rate-limit sign-in and recovery endpoints at the identity provider and application boundary where applicable.
- Test valid/invalid/expired credentials, inactive memberships, multiple tenant memberships, tenant selector tampering, sign-out, and account switching with pending offline work.
- API authorization tests must prove that changing client metadata, email text, local storage values, or representative names cannot grant tenant access or permissions.

## Out of scope

This ADR does not authorize tenant provisioning, invitation administration, owner bootstrap/transfer, role mutation, operational data APIs, or a production cutover. Those remain gated by OQ-0001 through OQ-0005 and the table-by-table legacy data migration plan.
