# Growta API — Phase 1 HTTP Contract

**Status:** Development-branch contract for the currently implemented read-only API.  
**Base path:** `/api/v1`

This document describes the implemented API only. It does not authorize unimplemented provisioning, invitation, owner, role-management, organization-mutation, or operational-data endpoints.

## 1. Request authentication and tenant selection

All endpoints except `GET /health` require a valid Supabase bearer token. Tenant-scoped endpoints additionally require:

| Header | Required | Contract |
|---|---:|---|
| `Authorization` | Yes | `Bearer <Supabase access token>`; token is validated with Supabase Auth |
| `X-Tenant-ID` | Yes, except `GET /api/v1/tenants` | UUID selecting the tenant context; selection is not authorization |
| `Accept` | No | Prefer `application/json` |

A request succeeds only if the selected tenant exists and is active, and the authenticated Supabase user has an active membership in that tenant. Permissions are resolved from active tenant roles assigned to that membership. The platform-only `SUPER_ADMIN` role is excluded from tenant role resolution.

The API uses a server-side Supabase service-role client for data access after validating the user token. The service-role key must never be exposed to browser code.

## 2. Endpoints

### `GET /health`

Public liveness endpoint. Query parameters do not change its public status.

**Success — 200**

```json
{
  "success": true,
  "data": { "status": "ok" },
  "meta": {
    "timestamp": "2026-11-15T00:00:00.000Z",
    "version": "v1"
  }
}
```

### `GET /api/v1/tenants`

Lists active tenants in which the authenticated Supabase Auth user has an active membership. This endpoint is used immediately after email/password sign-in, before the user selects a tenant.

**Authorization:** valid Supabase bearer token. No `X-Tenant-ID` header is accepted or required.

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "UUID",
      "name": "Tenant name",
      "slug": "tenant-slug"
    }
  ],
  "meta": {
    "requestId": "request UUID",
    "timestamp": "2026-11-15T00:00:00.000Z",
    "version": "v1",
    "limit": 100
  }
}
```

The server filters memberships by the verified Auth user ID and `status = active`, and excludes inactive tenants. The response is capped at 100 memberships. The selected tenant must still be sent as `X-Tenant-ID` on subsequent tenant-scoped requests; every such request independently verifies active membership and permissions. An empty array means the authenticated account has no active tenant membership. It does not create or provision a tenant.

### `GET /api/v1/tenants/me`

Returns the authenticated user's selected tenant membership context.

**Authorization:** valid bearer token + active selected tenant + active membership.

**Success — 200**

```json
{
  "success": true,
  "data": {
    "tenantId": "UUID",
    "userId": "UUID",
    "membershipId": "UUID",
    "roleCodes": ["TENANT_DEFINED_ROLE"],
    "permissions": ["organization.read"],
    "primaryOrgUnit": {
      "id": "UUID",
      "code": "UNIT_CODE",
      "name": "Unit name",
      "parentId": null
    },
    "designation": {
      "id": "UUID",
      "code": "DESIGNATION_CODE",
      "name": "Designation"
    },
    "scopedOrgUnitIds": ["UUID"]
  },
  "meta": {
    "requestId": "request UUID",
    "timestamp": "2026-11-15T00:00:00.000Z",
    "version": "v1"
  }
}
```

`primaryOrgUnit` and `designation` may be `null`. The arrays may be empty. Primary org placement and reporting relationships do not grant data access; `scopedOrgUnitIds` represents explicit additional org scopes returned by the scope resolver.

### Organization metadata endpoints

All three endpoints require `organization.read` and return tenant-wide organization metadata. They do not apply org-unit scope filtering; do not use them as operational-record access endpoints.

- `GET /api/v1/organization/unit-types`
- `GET /api/v1/organization/units`
- `GET /api/v1/organization/designations`

**Query parameters**

| Parameter | Default | Constraints |
|---|---:|---|
| `limit` | 50 | Integer 1–100 |
| `offset` | 0 | Integer 0–10000 |
| `includeInactive` | `false` | String `true` or `false` |
| `parentId` | — | UUID; organizational units endpoint only |
| `rootsOnly` | `false` | String `true` or `false`; organizational units endpoint only |

All three endpoints accept `limit`, `offset`, and `includeInactive`. Only `GET /organization/units` accepts `parentId` and `rootsOnly`; sending either parameter to the unit-types or designations endpoint is rejected. `parentId` and `rootsOnly=true` cannot be used together. Unknown query parameters are rejected.

**Success — 200**

```json
{
  "success": true,
  "data": [],
  "meta": {
    "requestId": "request UUID",
    "timestamp": "2026-11-15T00:00:00.000Z",
    "version": "v1",
    "limit": 50,
    "offset": 0,
    "total": 0
  }
}
```

The row fields are endpoint-specific:
- Unit types: `id, tenant_id, code, name, description, sort_order, is_active, created_at`.
- Units: `id, tenant_id, unit_type_id, parent_id, code, name, description, is_active, created_at, updated_at`.
- Designations: `id, tenant_id, code, name, description, is_active, created_at`.

### `GET /api/v1/audit-events`

Returns immutable audit history for the selected tenant.

**Authorization:** `audit.read`.

**Query parameters**

| Parameter | Default | Constraints |
|---|---:|---|
| `limit` | 50 | Integer 1–100 |
| `entityType` | — | Trimmed string, 1–100 characters |
| `cursor` | — | Opaque base64url cursor, 1–512 characters |

Unknown query parameters are rejected. Results are ordered by `created_at DESC, id DESC`. The API reads one extra row to determine whether a next page exists.

**Cursor payload (internal representation)**

```json
{
  "createdAt": "2026-11-15T10:00:00.000Z",
  "id": "UUID"
}
```

Clients must treat `nextCursor` as opaque and pass it unchanged to the next request. It is a pagination position, not an authorization token; every page independently validates membership, permission, and tenant filtering.

**Success — 200**

```json
{
  "success": true,
  "data": [],
  "meta": {
    "requestId": "request UUID",
    "timestamp": "2026-11-15T00:00:00.000Z",
    "version": "v1",
    "limit": 50,
    "nextCursor": null
  }
}
```

Audit rows expose `id, actor_user_id, request_id, action, entity_type, entity_id, before_data, after_data, metadata, created_at`. `nextCursor` is `null` when there is no further page.

## 3. Error envelope

Errors use this general shape:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": []
  },
  "meta": {
    "requestId": "request UUID",
    "timestamp": "2026-11-15T00:00:00.000Z"
  }
}
```

Implemented boundary and route errors include:

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `INVALID_TENANT_ID` | Missing or malformed `X-Tenant-ID` |
| 400 | `INVALID_QUERY` | Query parameters fail validation |
| 400 | `INVALID_CURSOR` | Audit cursor cannot be decoded or validated |
| 401 | `UNAUTHORIZED` | Missing/invalid bearer token or tenant context |
| 401 | `INVALID_TOKEN` | Supabase rejected or did not resolve the access token |
| 403 | `TENANT_INACTIVE` | Selected tenant is inactive or unavailable |
| 403 | `TENANT_ACCESS_DENIED` | No active membership in selected tenant |
| 403 | `PERMISSION_DENIED` | Required tenant permission is absent |
| 500 | `*_LOOKUP_FAILED` | Identity, authorization, or organization context lookup failed |
| 500 | `ORGANIZATION_QUERY_FAILED` | Organization metadata query failed |
| 500 | `AUDIT_QUERY_FAILED` | Audit history query failed |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

Error messages and details are not a stable machine contract beyond the error code and HTTP status. Do not expose database errors, tokens, or service credentials to clients.

## 4. Tenant isolation and scope boundaries

- Every tenant-owned query in these routes includes an explicit `tenant_id = selectedTenantId` predicate.
- These API routes use the server-side Supabase `service_role` client. Supabase service-role requests bypass RLS; RLS therefore does **not** provide a second enforcement layer for these API queries. Explicit tenant predicates and server-side membership/permission checks are the effective API authorization boundary.
- RLS still protects browser and other non-service-role access paths. Never describe service-role API queries as RLS-protected.
- The selected tenant header is never accepted as proof of membership.
- Organization metadata is tenant-wide by approved contract. No implicit manager/reporting-line filtering is performed.
- No operational business-data route is implemented until its domain-specific scope contract is approved.
- Sensitive writes must combine the domain mutation and audit insert in one PostgreSQL transaction/RPC; a separate PostgREST audit insert is not atomic with a business write.

## 5. Deliberate non-contracts

The following are not available in this API phase: tenant provisioning, first-owner bootstrap, owner transfer/recovery, invitations, role/permission mutation, delegation, org-unit/designation mutation, and operational business-data reads/writes. Their implementation remains gated by the documented open questions and domain scope decisions.
