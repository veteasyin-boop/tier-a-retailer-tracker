-- ============================================================================
-- Tenant organogram RLS smoke test (psql)
--
-- Prerequisites:
--   1. Apply 003_tenant_organogram_dynamic_rbac.sql to a disposable test DB.
--   2. Create two Auth users and two tenants.
--   3. Give user A an active membership and organization.read in tenant A only.
--   4. Insert at least one org unit in each tenant.
--
-- Run:
-- psql "$DATABASE_URL" \
--   -v user_a='<auth-user-a-uuid>' \
--   -v tenant_a='<tenant-a-uuid>' \
--   -v tenant_b='<tenant-b-uuid>' \
--   -f database/tests/003_tenant_organogram_rls.sql
--
-- The script intentionally tests as the authenticated role. It must fail
-- closed if user A can read tenant B or if its own tenant permission is absent.
-- ============================================================================
\set ON_ERROR_STOP on

begin;
set local role authenticated;

select set_config('request.jwt.claim.sub', :'user_a', true);
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'user_a', 'role', 'authenticated')::text,
  true
);

select growta_private.has_tenant_permission(:'tenant_a'::uuid, 'organization.read') as has_tenant_a_read
\gset
\if :has_tenant_a_read
  \echo 'PASS: user A has organization.read in tenant A'
\else
  \echo 'FAIL: user A is missing expected tenant A permission'
  rollback;
  \quit 1
\endif

select count(*) = 0 as cross_tenant_isolation
from public.tenant_org_units
where tenant_id = :'tenant_b'::uuid
\gset
\if :cross_tenant_isolation
  \echo 'PASS: user A cannot read tenant B organizational units'
\else
  \echo 'FAIL: cross-tenant rows are visible'
  rollback;
  \quit 1
\endif

select count(*) > 0 as tenant_a_visible
from public.tenant_org_units
where tenant_id = :'tenant_a'::uuid
\gset
\if :tenant_a_visible
  \echo 'PASS: user A can read tenant A organizational units'
\else
  \echo 'FAIL: expected tenant A organizational units were not visible'
  rollback;
  \quit 1
\endif

rollback;
