# Archived non-deployable database proposals

These files are preserved for audit/history only. They are **not** migrations and must never be executed against any Supabase or PostgreSQL project.

The archived dynamic-RBAC proposal defines a parallel `tenant_memberships` identity model that conflicts with the canonical schema under `supabase/migrations/`. Its test targets that incompatible model. Future schema work must be authored as a new, reviewed migration in the canonical migration directory.
