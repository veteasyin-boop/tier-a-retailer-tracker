# GROWTA REST API & IDEMPOTENT CONTRACT SPECIFICATION

**Document ID:** GROWTA-API-SPEC-001  
**Authority:** GROWTA-MASTER-PRD-001 (Section 68, 88, Milestone 06)  
**Version:** 1.0.0 (OpenAPI 3.1 Compliant Architecture)  

---

## 1. GLOBAL PROTOCOL & HEADERS

All incoming API requests to the Growta Modular Monolith backend must provide:

| Header | Type | Description | Mandatory |
| :--- | :--- | :--- | :--- |
| `Authorization` | String | `Bearer <JWT_TOKEN>` issued by server auth | Yes (except public login) |
| `X-Tenant-ID` | UUID | Active tenant UUID (`a0000000-0000-0000-0000-000000000001`) | Yes |
| `Idempotency-Key` | String | Unique UUID generated on client for state-mutating requests (`POST`/`PATCH`) | Yes for mutations |
| `Content-Type` | String | `application/json` | Yes |

---

## 2. STANDARD RESPONSE ENVELOPES

### Success Envelope (2xx)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_1728000000_abc",
    "timestamp": "2026-10-04T01:14:00.000Z",
    "version": "v1"
  }
}
```

### Error Envelope (4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT",
    "message": "Human readable error description",
    "details": []
  },
  "meta": {
    "requestId": "req_1728000000_xyz",
    "timestamp": "2026-10-04T01:14:00.000Z"
  }
}
```

---

## 3. CORE ENDPOINT MATRIX

### 3.1 Authentication & Tenancy
- `POST /api/v1/auth/login`: Authenticate with email/phone & password or OTP. Returns JWT + Tenant claims.
- `POST /api/v1/auth/refresh`: Refresh expired session token.
- `GET /api/v1/tenants/me`: Return current organization profile, assigned territory, and role permissions.

### 3.2 Counter Directory & CRM
- `GET /api/v1/retailers`: Query counters with filtering by `hq`, `block`, `status`, pagination, and search.
- `POST /api/v1/retailers`: Register new retail dealer.
- `PATCH /api/v1/retailers/:id`: Update counter details (audit logged).
- `POST /api/v1/retailers/bulk-reassign`: Bulk reassign counters to a new territory or assistant.

### 3.3 Field Visits & GPS Integrity
- `POST /api/v1/visits/check-in`: Submit GPS check-in with distance validation against dealer geocenter.
- `GET /api/v1/visits/logs`: Query check-in history with filters.

### 3.4 Attendance & Statutory Muster Roll
- `POST /api/v1/attendance/punch-in`: Record morning shift start with GPS stamp.
- `POST /api/v1/attendance/punch-out`: Close daily shift, compute working minutes.
- `POST /api/v1/attendance/regularize`: Submit shift regularization with reason.
- `PATCH /api/v1/attendance/:id/approve`: Manager approval for regularization.
- `GET /api/v1/attendance/muster-roll`: Generate statutory Form XVI / Form D monthly grid.

### 3.5 Commercial Orders
- `POST /api/v1/orders`: Book commercial sales order at dealer counter.
- `GET /api/v1/orders`: Query orders with status filtering.

### 3.6 Travel Allowance (TA/DA)
- `POST /api/v1/tada/claims`: Submit daily mileage claim and bill attachments.
- `PATCH /api/v1/tada/claims/:id/status`: Approve or reject TA/DA claim with manager remarks.

### 3.7 Audit Log Inspection
- `GET /api/v1/audit/logs`: Query immutable historical audit trail by entity or action.
