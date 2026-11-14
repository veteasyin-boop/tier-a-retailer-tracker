-- Read-only tenant/RLS/access inventory for the Growta development database.
-- Run with a database role allowed to inspect pg_catalog and information_schema.
-- This script performs SELECTs only; it does not alter policies, grants, data, or schema.

-- 1. Public base tables: RLS state, tenant key presence, and approximate size.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  EXISTS (
    SELECT 1
    FROM pg_attribute a
    WHERE a.attrelid = c.oid
      AND a.attname = 'tenant_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) AS has_tenant_id,
  EXISTS (
    SELECT 1
    FROM pg_attribute a
    WHERE a.attrelid = c.oid
      AND a.attname = 'organization_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) AS has_organization_id,
  c.reltuples::bigint AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

-- 2. Every public RLS policy, including role target, command, USING, and WITH CHECK.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Explicit table privileges granted to browser and server roles.
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- 4. Tenant-leading indexes. A tenant_id index that is not the first key
-- column may not support the common tenant_id equality predicate efficiently.
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef ~* 'USING [^(]+\\(tenant_id([, )]|$)'
ORDER BY tablename, indexname;

-- 5. SECURITY DEFINER functions and execute grants. Review each callable
-- SECURITY DEFINER function for fixed search_path, safe SQL, and least privilege.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.prosecdef AS security_definer,
  p.proconfig AS function_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
ORDER BY n.nspname, p.proname;

-- 6. Views and their security-invoker setting (where supported by this Postgres version).
SELECT
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;
