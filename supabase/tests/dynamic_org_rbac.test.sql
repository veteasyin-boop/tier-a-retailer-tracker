-- Growta One Phase 2 configurable organization model tests.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(22);

INSERT INTO public.tenants (id, name, slug, tier, is_active) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'Org Test Tenant A', 'org-test-a', 'Test', true),
  ('a2000000-0000-4000-8000-000000000002', 'Org Test Tenant B', 'org-test-b', 'Test', true);

INSERT INTO auth.users (id, email) VALUES
  ('c2000000-0000-4000-8000-000000000001', 'org-user-a@example.test'),
  ('c2000000-0000-4000-8000-000000000002', 'org-user-manager@example.test'),
  ('c2000000-0000-4000-8000-000000000003', 'org-user-b@example.test');

INSERT INTO public.memberships (id, tenant_id, user_id, status) VALUES
  ('d2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'active'),
  ('d2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000002', 'active'),
  ('d2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000003', 'active'),
  -- The same human is a member of both tenants; tenant-local membership IDs differ.
  ('d2000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'active');

INSERT INTO public.org_unit_types (id, tenant_id, code, name) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'DIVISION', 'Division'),
  ('e2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'BRANCH', 'Branch'),
  ('e2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000002', 'DEPOT', 'Depot');

INSERT INTO public.org_units (id, tenant_id, unit_type_id, parent_id, code, name) VALUES
  ('f2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', NULL, 'NORTH', 'North Division'),
  ('f2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'NORTH-BRANCH', 'North Branch'),
  ('f2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000003', NULL, 'DEPOT-1', 'Depot 1');

INSERT INTO public.designations (id, tenant_id, code, name) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'REGIONAL_LEAD', 'Regional Lead'),
  ('b2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'AREA_LEAD', 'Area Lead');

INSERT INTO public.membership_org_assignments (tenant_id, membership_id, org_unit_id, designation_id) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002');

INSERT INTO public.growta_permissions (code, category, description) VALUES
  ('tenant.a.only', 'Test', 'Permission only for tenant A role'),
  ('tenant.b.only', 'Test', 'Permission only for tenant B role')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.tenant_roles (id, tenant_id, code, name) VALUES
  ('e2000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001', 'ASM', 'Area Sales Manager'),
  ('e2000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000002', 'RSM', 'Regional Sales Manager');

INSERT INTO public.tenant_role_permissions (tenant_id, role_id, permission_code) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000004', 'tenant.a.only'),
  ('a2000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000005', 'tenant.b.only');

INSERT INTO public.membership_roles (tenant_id, membership_id, role_id) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000004'),
  ('a2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000005');

INSERT INTO public.membership_org_unit_scopes (tenant_id, membership_id, org_unit_id, include_descendants) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', true);

INSERT INTO public.membership_reporting_relationships (tenant_id, membership_id, reports_to_membership_id, relationship_type) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002', 'primary');

SELECT is(
  (SELECT count(*)::int FROM public.resolve_membership_org_unit_scope(
    'a2000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001'
  )),
  2,
  'scope resolver includes explicitly assigned unit and descendants'
);

SELECT ok((
  SELECT bool_and(c.relrowsecurity)
  FROM pg_class AS c
  WHERE c.oid IN (
    'public.org_unit_types'::regclass, 'public.org_units'::regclass,
    'public.designations'::regclass, 'public.membership_org_assignments'::regclass,
    'public.membership_org_unit_scopes'::regclass,
    'public.membership_reporting_relationships'::regclass
  )
), 'RLS enabled on all organization and placement tables');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'c2000000-0000-4000-8000-000000000001';

SELECT is((SELECT count(*)::int FROM public.memberships WHERE user_id = 'c2000000-0000-4000-8000-000000000001'), 2,
  'same Auth user can hold separate memberships in two tenants');
SELECT is((SELECT tr.code FROM public.membership_roles AS mr
  JOIN public.tenant_roles AS tr ON tr.tenant_id = mr.tenant_id AND tr.id = mr.role_id
  WHERE mr.tenant_id = 'a2000000-0000-4000-8000-000000000001'
    AND mr.membership_id = 'd2000000-0000-4000-8000-000000000001'), 'ASM',
  'same user has tenant A role code ASM');
SELECT is((SELECT tr.code FROM public.membership_roles AS mr
  JOIN public.tenant_roles AS tr ON tr.tenant_id = mr.tenant_id AND tr.id = mr.role_id
  WHERE mr.tenant_id = 'a2000000-0000-4000-8000-000000000002'
    AND mr.membership_id = 'd2000000-0000-4000-8000-000000000004'), 'RSM',
  'same user has tenant B role code RSM');
SELECT ok(private.has_tenant_permission('a2000000-0000-4000-8000-000000000001', 'tenant.a.only'),
  'tenant A permission is resolved from tenant A role assignment');
SELECT ok(private.has_tenant_permission('a2000000-0000-4000-8000-000000000002', 'tenant.b.only'),
  'tenant B permission is resolved from tenant B role assignment');
SELECT ok(NOT private.has_tenant_permission('a2000000-0000-4000-8000-000000000001', 'tenant.b.only'),
  'tenant B permission does not leak into tenant A');
SELECT ok(NOT private.has_tenant_permission('a2000000-0000-4000-8000-000000000002', 'tenant.a.only'),
  'tenant A permission does not leak into tenant B');
SELECT is((SELECT org_unit_id FROM public.membership_org_assignments
  WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'
    AND membership_id = 'd2000000-0000-4000-8000-000000000001'),
  'f2000000-0000-4000-8000-000000000002'::uuid,
  'tenant A membership keeps its own organizational placement');
SELECT is((SELECT org_unit_id FROM public.membership_org_assignments
  WHERE tenant_id = 'a2000000-0000-4000-8000-000000000002'
    AND membership_id = 'd2000000-0000-4000-8000-000000000004'),
  'f2000000-0000-4000-8000-000000000003'::uuid,
  'tenant B membership keeps a different organizational placement');

SELECT is((SELECT count(*)::int FROM public.org_units WHERE tenant_id = 'a2000000-0000-4000-8000-000000000001'), 2, 'member can read their tenant org units');
SELECT is((SELECT count(*)::int FROM public.org_units WHERE tenant_id = 'a2000000-0000-4000-8000-000000000002'), 0, 'member cannot read another tenant org units');
SELECT is((SELECT count(*)::int FROM public.membership_org_assignments), 1, 'member sees their primary organizational assignment');
SELECT is((SELECT count(*)::int FROM public.membership_org_unit_scopes), 1, 'member sees their additional scope assignments');
SELECT is((SELECT count(*)::int FROM public.membership_reporting_relationships), 1, 'member sees their reporting relationship');
SELECT throws_ok(
  $$ INSERT INTO public.org_units (tenant_id, unit_type_id, code, name)
     VALUES ('a2000000-0000-4000-8000-000000000001',
             'e2000000-0000-4000-8000-000000000001', 'SELF-MADE', 'Self Made') $$,
  '42501', 'permission denied for table org_units',
  'authenticated member cannot create organizational units directly'
);
RESET ROLE;

SELECT throws_ok(
  $$ INSERT INTO public.org_units (tenant_id, unit_type_id, parent_id, code, name)
     VALUES ('a2000000-0000-4000-8000-000000000001',
             'e2000000-0000-4000-8000-000000000001',
             'f2000000-0000-4000-8000-000000000003',
             'CROSS-TENANT-PARENT', 'Invalid Cross Tenant Parent') $$,
  '23503', NULL, 'organizational unit cannot reference a parent in another tenant'
);
SELECT throws_ok(
  $$ UPDATE public.org_units SET parent_id = 'f2000000-0000-4000-8000-000000000002'
     WHERE id = 'f2000000-0000-4000-8000-000000000001' $$,
  '23514', 'Organizational unit hierarchy cannot contain a cycle',
  'organizational hierarchy cycles are rejected'
);
SELECT throws_ok(
  $$ INSERT INTO public.membership_reporting_relationships
       (tenant_id, membership_id, reports_to_membership_id, relationship_type)
     VALUES ('a2000000-0000-4000-8000-000000000001',
             'd2000000-0000-4000-8000-000000000002',
             'd2000000-0000-4000-8000-000000000001', 'primary') $$,
  '23514', 'Primary reporting relationships cannot contain a cycle',
  'primary reporting cycles are rejected'
);
SELECT throws_ok(
  $$ INSERT INTO public.membership_org_assignments (tenant_id, membership_id, org_unit_id)
     VALUES ('a2000000-0000-4000-8000-000000000001',
             'd2000000-0000-4000-8000-000000000001',
             'f2000000-0000-4000-8000-000000000001') $$,
  '23505', NULL, 'membership can have only one primary organizational assignment'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.growta_permissions WHERE code = 'organization.manage')
  AND EXISTS (SELECT 1 FROM public.growta_permissions WHERE code = 'membership.manage')
  AND EXISTS (SELECT 1 FROM public.growta_permissions WHERE code = 'scope.assign'),
  'flexible organization and authorization permissions are registered'
);

SELECT * FROM finish();
ROLLBACK;
