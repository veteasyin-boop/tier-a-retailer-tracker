# Tenant Discovery API Contract

**Status:** Frontend-consumed contract; backend implementation not verified  
**Consumers:** `src/services/auth.js`, `src/services/apiClient.js`  
**Base URL:** `VITE_API_BASE_URL`  
**Prefix:** `/api/v1`

This document records only behavior required by the current frontend. It is not evidence that a production API implementation exists.

## Authentication

- The user signs in with Supabase Auth email/password. Preserve this flow.
- Every tenant API request sends `Authorization: Bearer <supabase_access_token>`.
- The API must validate the access token and derive the authenticated user ID from its verified subject. Never trust a user ID supplied in a request body or header.
- Tenant selection is context, not authorization. The API must verify that the authenticated user has an active membership in the requested tenant on every request.
- The browser sends `X-Tenant-ID` only for tenant-specific context. It must never be treated as proof of membership.
- The client uses `credentials: omit`; the API must not depend on cookie authentication.

## Endpoints currently called

### `GET /api/v1/tenants`

Lists active tenant memberships for the authenticated user.

**Request headers**
```http
Authorization: Bearer <supabase_access_token>
Accept: application/json
```

**Minimum response consumed by the frontend**
```json
{
  "success": true,
  "data": [
    {
      "id": "tenant-uuid",
      "name": "Tenant display name"
    }
  ]
}
```

The frontend requires `data` to be an array and each tenant to expose a stable string `id`. Additional display fields may be returned, but must not be used as authorization claims.

### `GET /api/v1/tenants/me`

Resolves the authenticated user's context for the selected tenant.

**Request headers**
```http
Authorization: Bearer <supabase_access_token>
X-Tenant-ID: <tenant-uuid>
Accept: application/json
```

**Minimum response consumed by the frontend**
```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-uuid",
    "userId": "supabase-auth-user-uuid",
    "permissions": ["retailer.read", "organization.read"]
  }
}
```

Required invariants:
- `data.tenantId` must equal the authorized tenant selected by the request.
- `data.userId` must equal the subject of the verified Supabase access token.
- `data.permissions` must be the effective permission set for this user in this tenant, not a global role list.
- A role/designation from one tenant must not carry over to another tenant.
- Permission codes are tenant-context data for UI gating only. Every API operation must independently authorize server-side.

## Response envelope

The existing client requires:
- Success: HTTP 2xx and JSON `{ "success": true, "data": ... }`.
- Error: non-2xx or `success !== true`. If present, the client displays `error.message` and stores `error.code`.

Recommended error envelope:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication is required."
  }
}
```

Use appropriate HTTP statuses: 401 unauthenticated/invalid token, 403 authenticated but not a member or not permitted, 404 unknown tenant/resource where disclosure policy permits, 422 validation error, 429 rate limited, and 5xx unexpected server failure.

## Tenant isolation requirements

1. Resolve actor identity from the verified Supabase JWT only.
2. Verify active tenant membership for every request, including tenant discovery/context endpoints.
3. Bind all tenant-owned reads and writes to the verified tenant ID.
4. Use database RLS as a second enforcement layer; do not rely on frontend capability checks.
5. Never return memberships, roles, permissions, or records belonging to another tenant.
6. Treat browser storage `growta_selected_tenant` as an untrusted preference. Revalidate it server-side.
7. Log authorization denials with request ID, actor ID, tenant ID and route; do not log access tokens or passwords.

## Known contract drift to resolve before implementation

- `docs/product/TENANT-ORGANOGRAM-DYNAMIC-RBAC.md` currently describes tenant-specific routes using `/tenants/:tenantId/...`, while the existing frontend sends `X-Tenant-ID` to `/tenants/me`.
- `docs/api/OPENAPI_SPECIFICATION.md` describes server-issued JWTs in its global headers, while the existing frontend authenticates with Supabase Auth access tokens.
- The exact backend repository, deployed API URL, Supabase project reference, tenant response display fields, and membership provisioning flow remain unverified.

Do not add new client endpoints or deploy/apply database changes until these decisions are reconciled with the actual backend.
