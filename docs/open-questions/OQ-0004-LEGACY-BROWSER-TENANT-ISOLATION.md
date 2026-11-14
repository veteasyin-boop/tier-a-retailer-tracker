# OQ-0004 — Legacy browser data-plane tenant isolation and authentication

**Status:** Blocking before the existing browser application is enabled for multiple tenants or exposed to real tenant data  
**Date logged:** 2026-11-15  
**Module:** Legacy field operations, Supabase browser access, authentication, multi-tenancy  
**Authority:** Repository security requirements and existing prototype behavior

## Question

How will the existing single-tenant browser/PWA data plane be migrated to authenticated, tenant-scoped server access without breaking its offline-first field workflows?

## Findings from checked-in code

1. The browser application constructs a Supabase client and performs direct table reads/writes from `src/services/supabase.js` and `src/services/storage.js`. It is not routed exclusively through the new API.
2. The legacy schema snapshots `supabase_schema.sql` and `supabase_schema_rls.sql` contain operational tables such as retailers, check-ins, orders, inventory, attendance, leave, farmer meetings, and KPI records without a `tenant_id` column.
3. `supabase_schema.sql` defines multiple policies with `USING (true)`, including policies targeting public/anonymous access. These policies are not tenant isolation.
4. `supabase_schema_rls.sql` derives manager access from JWT role/user metadata and an email substring check, and derives field-representative access from `user_metadata.rep_name`. User metadata is user-editable and must not be treated as a trusted authorization claim. An email containing `admin` is not proof of manager authority.
5. `src/services/auth.js` contains a default manager PIN (`2026`), persists the manager flag in browser session storage, stores the selected representative in local storage, and compares representative passwords in browser code.
6. `supabase_schema.sql` includes a plaintext `assistants.password` column with default `rep123`; `src/services/supabase.js` reads and writes that field.
7. The legacy operational schema does not have a verified mapping from its assistant/representative identity to `auth.users` and the new tenant membership model.
8. `supabase_schema.sql` and `supabase_schema_rls.sql` are divergent snapshots of overlapping tables (including `assistants`, `retailers`, and `check_in_logs`). A migration cannot safely assume either file exactly matches the deployed database.
9. `src/services/syncQueue.js` stores `{ entity, action, payload }` in IndexedDB without binding the queued operation to an authenticated user or tenant. The payload includes client-supplied `assistant` / `rep` values. The server must derive actor and tenant from the verified token, never from these payload fields.
10. The current sync worker treats `PGRST204`, `23503`, and `42P01` errors as success (`return true`), which causes `processQueue()` to delete the queued item. A schema mismatch or foreign-key violation can therefore silently discard an offline mutation. The worker also retries all other failures until the retry limit without a user-facing dead-letter/recovery workflow.

These findings describe checked-in source. The read-only diagnostic `supabase/diagnostics/tenant-rls-access-inventory.sql` must also be run against the actual development project to inventory deployed grants, policies, RLS flags, indexes, and SECURITY DEFINER functions. The deployed state may differ from the source snapshots.

## Authentication decision

The product owner selected **existing email/password sign-in** as the retained user-facing authentication method. The accepted implementation decision is recorded in `docs/adr/ADR-0003-supabase-auth-email-password.md`.

This means:
- Supabase Auth `signInWithPassword` is the only supported authentication authority for tenant users.
- Each person receives an individual Auth account; local manager PINs, shared representative passwords, plaintext `assistants.password`, email-substring role inference, and user-editable metadata are not trusted.
- After sign-in, the client discovers active memberships through `GET /api/v1/tenants`, then selects a tenant from that server response.
- Legacy credentials are not imported. The migration uses verified identity reconciliation and a password-reset/invitation flow.
- The legacy login remains isolated to the controlled single-tenant prototype until the API-backed UI and identity mapping are ready.

The authentication-method decision is resolved. The actual mapping of legacy representative rows to verified email addresses and Auth user IDs, and the operator responsible for that reconciliation, remain unresolved.

## Why it matters

The current prototype is not safe to treat as a multi-tenant application boundary. A browser client can invoke Supabase APIs directly; broad policies can expose or mutate data independently of the new API's tenant checks. Tables without tenant identity cannot be isolated by tenant RLS. Client-side PINs, local-storage representative selection, and user-editable metadata do not establish server-side identity or authorization.

The new API's explicit tenant checks do not protect requests made directly by the legacy browser Supabase client.

## Options

1. **Keep the legacy application single-tenant and isolated.** Restrict project access, rotate/remove weak credentials, and do not onboard multiple customer tenants until a replacement data plane is ready.
2. **Migrate legacy operations behind the new API.** Add tenant identity and verified Auth membership mapping, then move each browser read/write to an API route with server-side permission and organizational-scope enforcement. Preserve IndexedDB/local offline queues and synchronize through authenticated API endpoints.
3. **Expose legacy tables directly with new RLS.** This requires a table-by-table tenant_id backfill, verified user-to-membership mapping, strict RLS policies, grants, and removal of every permissive policy. It is higher risk because the legacy schema has inconsistent identifiers and many write paths.

## Recommendation

Use option 2 as the target architecture. Keep the existing prototype available only in its current controlled/single-tenant environment during migration. Do not attempt a blanket RLS rewrite or add tenant_id columns without a domain-specific mapping and backfill plan.

Migration sequence:

1. Inventory the actual deployed schema with the read-only diagnostic; snapshot and classify every table, policy, grant, view, trigger, and SECURITY DEFINER function.
2. Define the canonical mapping from each legacy representative/assistant to a Supabase Auth user, tenant membership, role, and organizational placement. Never infer identity from display name, email substring, or mutable user metadata.
3. Introduce tenant keys and verified mapping for each operational entity. Plan composite foreign keys and tenant-leading indexes where appropriate.
4. Move one vertical slice at a time (read first, then mutations) behind the API. Enforce tenant, permission, and explicit org-scope predicates on every query.
5. Add offline synchronization idempotency, conflict handling, audit transaction semantics, and integration tests before retiring direct browser table access.
6. Remove broad legacy grants/policies and plaintext/client-side credentials only after the corresponding API path is live and verified.
7. Redesign the offline sync envelope and state machine before switching any write path: persist a client operation UUID plus the authenticated account/tenant context at enqueue; pause the queue if the active account/tenant differs; derive the authoritative actor and tenant on the API; make server writes idempotent; and retain rejected operations for correction/export instead of deleting them as successful.

## Decisions required

- Confirm whether the existing prototype remains single-tenant during the migration.
- Define the canonical mapping from each legacy assistant/representative row to a verified individual email address and Supabase Auth user ID, and identify who verifies and approves that mapping.
- Approve the data migration and retention policy for legacy passwords, attendance, GPS check-ins, farmer/retailer records, and offline queues.
- Define which roles may read or mutate each operational domain and how org scopes filter those records.
- Approve the offline queue's account-switch behavior, idempotency contract, conflict policy, and dead-letter recovery UX.

## Affected modules

Legacy browser auth, Supabase client adapter, offline storage/sync queue, assistants, retailers, check-ins, orders, inventory, attendance, leave, TA/DA, farmer CRM, audit events, tenant provisioning, and operational RLS.

## Blocking status

**Blocking before multi-tenant onboarding and before exposing legacy operational tables to new tenant users.** Do not claim the legacy browser data plane is protected by the new API's tenant authorization. Do not change existing production policies or credentials as part of this documentation task.
