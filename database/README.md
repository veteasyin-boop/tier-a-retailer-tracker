# Database assets and deployment rules

## Canonical deployable schema

**Only `supabase/migrations/` is part of the Supabase migration history.** Apply those migrations only to a disposable local Supabase instance during development. A live project requires a separately reviewed backup, schema-drift, identity-mapping, and rollback plan.

## Legacy schema snapshots — do not execute

Files under `database/schema/` are historical source snapshots, not migrations. They are not synchronized with the canonical migration chain and must not be run with psql, the Supabase SQL editor, or an automated deployment job.

In particular, `002_catalog_orders_inventory_schema.sql` is unsafe:
- it uses invalid PostgreSQL syntax (`CREATE POLICY IF NOT EXISTS`);
- its `USING (true)` policies do not isolate tenants;
- several tables use text tenant IDs and lack tenant-consistent foreign keys;
- it grants broad access patterns that are incompatible with the current membership authorization model.

Do not repair this snapshot in place and then deploy it. Rebuild catalog, order, and inventory tables as reviewed migrations against the canonical tenant and organizational model, with explicit tenant and scope policies plus integration tests.

## Archived alternate RBAC proposal

`legacy-nondeployable/` contains an earlier standalone organogram/RBAC proposal and its test. It defines a second, incompatible identity model (`tenant_memberships`, etc.). It is retained only for historical reference and is not part of the migration chain. Do not apply it.

## Required workflow

1. Add schema changes only under `supabase/migrations/`, using the Supabase CLI migration workflow.
2. Test migrations against local Supabase and run `supabase test db`.
3. Review RLS, grants, indexes, foreign keys, functions, and SECURITY DEFINER privileges.
4. Do not connect or migrate a production project until the project reference and rollout plan are explicitly approved.
