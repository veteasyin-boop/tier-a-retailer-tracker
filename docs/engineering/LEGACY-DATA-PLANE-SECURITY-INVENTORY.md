# Legacy Data-Plane Security Inventory

**Review date:** 2026-11-15  
**Branch:** `growta-one/phase-1-tenant-rbac`  
**Scope:** Checked-in schema and browser code; no production or linked Supabase project was queried.

## Executive assessment

The new Growta API foundation has tenant-aware membership, role, permission, organization, and audit controls. That does **not** make the existing browser application multi-tenant safe: the browser still talks directly to Supabase for operational data, and the legacy schema snapshots contain permissive access policies and tables without a tenant key.

Treat the existing prototype as single-tenant and controlled until its data plane is migrated. Do not onboard independent customer tenants against the legacy direct-browser tables.

## Static source findings

| Area | Evidence | Risk |
|---|---|---|
| Direct browser data access | `src/services/supabase.js` creates a Supabase client and directly queries retailers, check-ins, assistants, tour plans, meetings, plots, competitor intelligence, farmer leads, audits, weekly reviews, quiz data, EOD, leave, attendance, and TA/DA. `src/services/storage.js` also performs direct table writes/deletes. | API tenant checks do not protect these requests. |
| Divergent schema snapshots | `supabase_schema.sql` and `supabase_schema_rls.sql` define incompatible versions of overlapping tables (including `assistants`, `retailers`, and `check_in_logs`). | A migration based on either snapshot alone could corrupt or orphan existing data. Verify deployed schema and reconcile both snapshots first. |
| Missing tenant key | Legacy operational tables in `supabase_schema.sql` and `supabase_schema_rls.sql` do not declare `tenant_id`. | Tenant-level RLS cannot be expressed reliably on these rows without a mapping/backfill. |
| Broad RLS policies | `supabase_schema.sql` has many `FOR ALL USING (true)` policies, including policies described as public read/write. | If corresponding grants are present, browser roles can bypass the intended app-level access checks. RLS policy alone does not grant SQL privileges, so deployed grants must be inspected too. |
| Untrusted role claims | `supabase_schema_rls.sql` uses `auth.jwt() -> 'user_metadata' ->> 'role'`, `rep_name`, and an email `LIKE '%admin%'` check. | User metadata is mutable by the user; email naming conventions are not authorization. |
| Client-side manager session | `src/services/auth.js` defaults manager PIN to `2026`, stores an `isAdmin` flag in session storage, and uses that flag for client-side access decisions. | Browser state is user-controlled and cannot enforce authorization. |
| Plaintext assistant password | `supabase_schema.sql` declares `assistants.password` with default `rep123`; the browser reads and writes it and compares it locally. | Credential disclosure and account impersonation risk. Rotate and remove through a controlled migration; do not simply drop the field before clients are migrated. |
| Identity mapping absent | New memberships reference `auth.users`; legacy assistant/representative records are keyed by names and do not have a verified Auth identity relationship. | Automatically mapping by name/email could assign another person's data access. |

## New API vs. legacy browser boundary

- New API: validates Supabase access tokens, resolves active tenant membership and permissions, and explicitly filters tenant-owned queries. Its service-role client bypasses RLS, so those server-side checks and tenant predicates are the API isolation boundary.
- Legacy browser: sends Supabase requests directly using the anon key and browser session. These calls do not pass through the new API's membership, permission, or org-scope guards.
- New RLS tables: the new identity and dynamic-org migrations have explicit authenticated SELECT policies and restrict membership/role/scope writes. Those controls do not retrofit tenant isolation onto the old operational tables.

## Domain migration inventory

| Domain | Legacy tables (source snapshots) | Required work before multi-tenant access |
|---|---|---|
| Identity / field users | `assistants` | Replace local/name/password identity with verified Auth user + tenant membership + role + org placement. |
| Retailer CRM | `retailers` | Backfill tenant ownership and stable owner/assignment IDs; enforce tenant + org scope on reads/writes. |
| Field evidence | `check_in_logs` | Tenant key, authenticated actor ID, immutable audit semantics, location/photo access controls. |
| Commercial | `orders`, `dealer_stock` | Tenant-scoped references and transactional authorization. |
| Farmer engagement | `farmer_meetings`, `demo_plots`, `farmer_leads`, `competitor_intel` | Tenant ownership, field-level privacy, and org-scope filtering. |
| Workforce | `attendance_records`, `leave_applications`, `tada_claims` | Tenant identity, employee mapping, manager approval authority, and audit transaction boundaries. |
| Performance / workflow | `assistant_kpi_scores`, `aqfs_audits`, `weekly_reviews`, `quiz_questions`, `quiz_states`, `eod_reports`, `tour_plans`, `tour_beat_plans` | Tenant key, role permissions, ownership rules, and explicit data retention. |
| Inventory | `inventory_allocations`, `inventory_movements` | Tenant-owned product/warehouse references, ledger immutability, and tenant-leading indexes. |

The list is based on checked-in schema snapshots. The deployed schema may contain additional objects or differ from the snapshots. The two checked-in snapshots are also structurally divergent: for example, one `assistants` definition uses `name` as its primary key and includes a plaintext password, while the other uses an `id` key and different columns; the `retailers` and `check_in_logs` definitions also differ. This drift must be reconciled against the deployed database before writing a data migration.

## Required deployed-database verification

Run `supabase/diagnostics/tenant-rls-access-inventory.sql` against the development database and retain the output as a reviewed artifact. It reports:

1. Public table RLS/force-RLS flags, tenant/org key presence, estimated rows, and storage.
2. All public RLS policies and their `USING` / `WITH CHECK` expressions.
3. Explicit grants for `anon`, `authenticated`, and `service_role`.
4. Indexes whose leading key is `tenant_id`.
5. SECURITY DEFINER functions, function settings, and execute grants.
6. Public views and their definitions.

This is read-only. Do not run it against production without the normal read-only access approval.

## Recommended migration gates

1. **Containment:** keep the legacy app single-tenant; remove access to sensitive real data from anonymous/public roles after confirming deployed usage and a rollback plan.
2. **Identity:** decide the canonical representative identity and verified Auth mapping; never authorize using local storage, PINs, mutable metadata, or email substrings.
3. **Schema:** add tenant keys and composite tenant-safe foreign keys with explicit backfill/reconciliation reports; add indexes matching tenant predicates and common org-scope filters.
4. **API slice:** move one operational vertical to authenticated API routes. Validate tenant membership, permission, and org scope on every request; keep service-role credentials server-only.
5. **Offline sync:** preserve the offline-first workflow with authenticated idempotent sync, conflict handling, and transactional audit writes.
6. **Retirement:** only after parity tests and production verification, revoke broad grants/policies and remove plaintext credentials and direct browser writes.

## Related blockers

- [OQ-0001 — tenant owner bootstrap and delegation](../open-questions/OQ-0001-TENANT-OWNER-ROLE.md)
- [OQ-0002 — legacy STATE_HEAD permissions](../open-questions/OQ-0002-LEGACY-STATE-HEAD-PERMISSIONS.md)
- [OQ-0003 — API service-role vs. RLS boundary](../open-questions/OQ-0003-API-SERVICE-ROLE-RLS-BOUNDARY.md)
- [OQ-0004 — legacy browser tenant isolation](../open-questions/OQ-0004-LEGACY-BROWSER-TENANT-ISOLATION.md)
