# Tenant Authentication and Offline Queue Rollout

## Runtime configuration

The browser build requires these public environment variables:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key only |
| `VITE_API_BASE_URL` | HTTPS base URL of the Growta API |

Never put `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or other server secrets in a `VITE_*` variable. Vite embeds every `VITE_*` value in the browser bundle.

Production tenant mode is the default and fails closed. The legacy local prototype shell can only be enabled in a Vite development build with `VITE_ENABLE_LEGACY_PROTOTYPE=true`. This switch is not honored in production. A development-only manager PIN, if needed to inspect the old prototype, must be provided through the non-Vite `LEGACY_MANAGER_PIN` environment variable injected only into the local Vite dev server; there is no source-code or browser-storage default.

## Sign-in flow

1. The user enters their individual email and password.
2. The browser authenticates through Supabase Auth `signInWithPassword`.
3. The browser obtains the verified access token and calls `GET /api/v1/tenants`.
4. The API validates the token and returns only active memberships for that Auth user.
5. The user selects one returned tenant. The browser calls `GET /api/v1/tenants/me` with `X-Tenant-ID`.
6. The API independently resolves active membership, tenant roles, permissions, primary org placement, and explicit org scopes.
7. The UI capability helper maps application capabilities to exact permission codes. It does not infer authorization from role names, email addresses, Auth metadata, or local storage.

There is no self-registration, tenant creation, invitation, or membership bootstrap in this flow. Accounts and memberships must already have been provisioned through an approved server-side process. OQ-0001 remains the blocker for that provisioning workflow.

## Current operational-data boundary

The legacy operational UI is deliberately not loaded in production tenant mode. Its current browser-side Supabase calls target legacy tables without a verified tenant key or consistent RLS policy. An authenticated identity is not sufficient to safely expose those rows.

The tenant login screen therefore reports verified identity and permission context but keeps legacy operational data locked until:
- legacy representative records have a manually verified mapping to Auth user IDs;
- operational tables have a reconciled schema, tenant ownership, indexes, and RLS;
- the relevant reads and writes are moved behind API routes with per-endpoint permission and scope checks;
- audit events and transactional idempotency are part of write operations.

Do not enable the old UI in production by setting a feature flag. It is a development-only prototype path.

## Offline queue safety

IndexedDB database version 2 adds non-destructive queue metadata: `operationId`, `payloadVersion`, `actorUserId`, and `tenantId`. Existing queue rows are preserved during the version upgrade.

Queue behavior:
- legacy rows without user/tenant/operation identity are marked `identity_required`;
- rows bound to an account pause when signed out;
- rows for another user or tenant are marked `identity_mismatch` and never rebound;
- rows for the matching identity remain `awaiting_api_migration` because the transactional tenant write API is not implemented yet;
- schema-cache, missing-table, and foreign-key failures are classified as operator attention, never success;
- the queue can be exported locally as JSON for controlled reconciliation.

Direct browser-to-table sync has been removed from the queue worker. No offline mutation is silently deleted or uploaded under whichever account happens to be signed in. This intentionally pauses automatic synchronization until API mutations use a stable operation ID and commit the business change, idempotency ledger, and audit event in one database transaction.

## Verification

From the repository root:

```bash
npm ci
npm run build
npm run test:security
```

API checks:

```bash
cd services/api
npm install
npm run build
npm test
```

The GitHub Actions workflow runs the frontend build/security tests and API type/unit tests. Database/RLS tests remain a separate CI workflow.

## Rollout sequence

1. Deploy the API and configure the browser's `VITE_API_BASE_URL`.
2. Provision individual Auth accounts and memberships through an approved operator workflow. Do not import plaintext assistant passwords.
3. Reconcile legacy records to Auth identities and tenant ownership from verified source data.
4. Migrate one operational domain at a time to tenant-filtered API routes and RLS.
5. Implement transactional idempotent writes and dead-letter correction/retry UI.
6. Only after domain-by-domain verification, enable the migrated UI modules for tenant memberships.
