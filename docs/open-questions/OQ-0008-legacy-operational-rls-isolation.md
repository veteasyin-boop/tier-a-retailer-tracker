# OQ-0008: Legacy Operational Schema Has No Effective Tenant Isolation

**Module:** Database security / catalog / inventory / orders  
**Status:** Critical blocker before exposing these tables to tenant users  
**Date:** 2026-11-15

## Evidence from repository migrations

### 1. Unrestricted RLS policies in schema 002

`database/schema/002_catalog_orders_inventory_schema.sql` enables RLS on:
- `products`
- `skus`
- `warehouses`
- `inventory_ledgers`
- `orders`
- `order_items`

It then creates `FOR ALL USING (true)` policies for all six tables. These are permissive policies and do not constrain rows by authenticated identity or tenant. RLS being enabled does not make these tables tenant-safe when a permissive policy allows every row.

The migration also contains a comment describing access for authenticated reps and anonymous sync. The actual role grants and deployed policy state must be inspected before deciding whether anonymous clients can reach these tables.

### 2. Tenant identifiers are not relationally enforced

In schema 002, `tenant_id` is `TEXT` with a hard-coded default tenant UUID string. It is not a foreign key to `tenants(id)`. This permits invalid tenant identifiers and silently routes inserts that omit tenant ID into the same default tenant.

### 3. Child and operational records lack tenant binding

- `order_items` has no `tenant_id`; its authorization must be inherited through a tenant-safe parent `orders` join.
- `inventory_ledgers` stores `retailer_id` as unvalidated text.
- `inventory_ledgers.recorded_by` and `assistant_name` are free text, not verified membership references.
- `orders.assistant_name` is free text and does not bind the order to an authenticated tenant membership.
- `skus.product_id`, `inventory_ledgers.sku_id`, and `warehouse_id` use single-column references, not composite tenant-aware foreign keys. Cross-tenant references are therefore not structurally prevented.

### 4. Legacy core schema relies on caller-visible session context

Schema 001 uses `current_setting('app.current_tenant_id', true)` in tenant policies. This is safe only if the setting is established by a trusted server-side transaction after authentication and cannot be chosen by an untrusted database client. That trust boundary is not documented or verified in this repository.

## Required resolution

1. Identify the actual deployed Supabase project and inspect live grants, RLS policies, table owners, and API roles. Do not infer deployed state from migration files alone.
2. Confirm whether any anonymous or authenticated browser clients can access these tables directly.
3. Choose one authoritative identity model: Supabase Auth UUID mapped to a tenant membership, with server-verified actor identity.
4. Add tenant-aware constraints and indexes. For child records, enforce tenant consistency through composite foreign keys or equivalent constraints.
5. Replace permissive policies with deny-by-default policies tied to verified tenant membership and explicit permission/scope checks.
6. For `order_items`, enforce access through the parent order's tenant; do not add a duplicated tenant column without a deliberate consistency design.
7. Remove hard-coded tenant defaults after a safe backfill and compatibility plan.
8. Test cross-tenant SELECT, INSERT, UPDATE, DELETE, and cross-tenant foreign-key attempts using at least two tenants and two Auth users.

## Do not do

- Do not apply a blanket `USING (tenant_id = ...)` policy without verified actor-to-tenant membership.
- Do not trust `X-Tenant-ID`, a client-set GUC, local storage, email, or user-editable Auth metadata as authorization.
- Do not drop/replace the existing permissive policies until data, deployed roles, and legacy sync clients are inventoried.
- Do not assume the repository migration files exactly match production.

## Acceptance criteria

- No browser role can read or mutate another tenant's rows.
- Anonymous access is denied unless a specific public use case is explicitly approved and narrowly scoped.
- Every tenant-owned FK relationship is tenant-consistent.
- Tests prove tenant A cannot access tenant B for every table and CRUD operation.
- Existing single-tenant data and offline sync behavior have a documented migration path.
