# OQ-0005 — Offline sync identity binding, idempotency, and rejected-operation recovery

**Status:** Blocking before legacy writes are moved behind the tenant API  
**Date logged:** 2026-11-15  
**Module:** Field Shell / IndexedDB / sync queue / API mutations / audit

## Question

What is the approved offline mutation contract when a field device is offline, the user or tenant changes, a request is retried, or the server rejects a queued operation?

## Findings from checked-in code

1. `src/services/syncQueue.js` persists only `entity`, `action`, and `payload` (plus local retry metadata) in IndexedDB.
2. Queue records are not bound to the authenticated Supabase user or selected tenant at enqueue time.
3. Several payloads carry client-controlled `assistant` or `rep` strings. These values cannot be accepted as the authenticated actor by the future API.
4. `syncSingleItem()` sends direct table upserts/deletes to Supabase. It does not send a stable operation identifier as a server idempotency key.
5. For `PGRST204`, `23503`, and `42P01`, the worker returns `true`; `processQueue()` then deletes the queue item. A schema-cache mismatch, foreign-key violation, or missing relation can silently discard an offline mutation.
6. Other failures retry up to the configured attempt limit, after which the item is marked `failed_permanently`. No durable operator recovery/export workflow is evident in this service.

## Why it matters

Offline check-ins, attendance, orders, claims, and field evidence may be business-critical. A retry must not create duplicates, an account switch must not upload one user's data under another user's session, and a rejected mutation must not be deleted as though it succeeded.

The API must derive `user_id`, `tenant_id`, membership, permissions, and organizational scope from the verified bearer token and server-side membership resolution. It must not trust `assistant`, `rep`, tenant IDs, or role values in the queued payload.

## Options

1. **Minimal queue repair:** stop treating schema/constraint errors as success; keep failed items and surface a recoverable error state. This prevents immediate silent deletion but does not solve identity binding or idempotency.
2. **Authenticated operation envelope:** assign a client-generated UUID to every operation, persist the authenticated user and tenant context at enqueue, pause syncing when the current identity differs, and submit the operation to an authenticated API endpoint. The API derives actor/tenant from the token and uses a transactionally unique idempotency ledger.
3. **Drop-and-recreate offline storage:** replace the current queue and local schema wholesale. This is not acceptable without a migration plan for pending queue entries and the offline-first prototype.

## Recommendation

Use option 2 as the target. Implement option 1 as a separately tested interim bug fix only after confirming the existing UI can display and recover permanently rejected queue items. Do not silently discard queue records.

Suggested operation envelope (proposal, not approved contract):

- `operation_id`: client-generated UUID, stable across retries.
- `entity_type` / `operation_type`: allowlisted domain operation, not an arbitrary table name.
- `payload_version`: schema version for deterministic validation/upcasting.
- `payload`: domain data only; never authority claims.
- `created_at_client`: client timestamp for diagnostics, not authoritative ordering.
- `created_by_user_id` and `tenant_id`: local binding for account/tenant mismatch detection only; server ignores them as authorization claims.
- API derives authoritative user, tenant, membership, and org scope from the access token and database.
- Server idempotency key: unique `(tenant_id, operation_id)`, persisted in the same transaction as the business mutation and audit event.
- Rejected operations remain in a dead-letter/recovery state with a safe error code, retryability classification, and export/retry action.

## Decisions required

- Should pending operations be paused or quarantined when a user signs out, changes account, or switches tenant? Recommendation: pause and require explicit resolution; never auto-rebind.
- What is the conflict policy for concurrent updates to the same retailer, order, attendance record, or claim?
- Which operations may be retried automatically, and which require user correction or manager review?
- What retention period and export mechanism apply to permanently rejected operations?
- Should the client generate operation UUIDs at enqueue time and keep them stable across device restarts? Recommendation: yes.

## Affected modules

`src/services/syncQueue.js`, `src/services/idbStorage.js`, `src/services/storage.js`, legacy auth, API mutation routes, transactional database RPCs, audit events, and offline-sync UI.

## Blocking status

**Blocking before any operational write endpoint or multi-tenant offline synchronization is enabled.** The current direct-to-Supabase sync path must not be assumed to provide tenant identity, idempotency, or safe rejected-operation recovery.
