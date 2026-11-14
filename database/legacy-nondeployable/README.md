# Archived non-deployable database proposals

These files are preserved for audit/history only. They are **not** migrations and must never be executed against any Supabase or PostgreSQL project.

- `003_tenant_organogram_dynamic_rbac.sql` defines a parallel `tenant_memberships` identity model that conflicts with the canonical schema under `supabase/migrations/`.
- `002_catalog_orders_inventory_schema.sql` contains invalid `CREATE POLICY IF NOT EXISTS` syntax, permissive `USING (true)` policies, text tenant identifiers, and no safe tenant-consistent authorization model. It must be rebuilt, not deployed.

Future schema work must be authored as a new, reviewed migration in the canonical migration directory, with explicit tenant/scope predicates, safe grants, and RLS tests.
