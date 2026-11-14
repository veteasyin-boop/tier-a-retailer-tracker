-- Growta One tenant identity/RBAC tests.
-- Run against a disposable local Supabase database with: supabase test db

BEGIN;
SET search_path TO public, extensions;

SELECT plan(16);

-- Isolated fixtures; all rows are rolled back at the end of this test.
INSERT INTO public.tenants (id, name, slug, tier, is_active) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'Growta RBAC Test A', 'growta-rbac-test-a', 'Test', true),
  ('a1000000-0000-4000-8000-000000000002', 'Growta RBAC Test B', 'growta-rbac-test-b', 'Test', true);

INSERT INTO public.organizations (id, tenant_id, name, code, state, country, is_active) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Test Org A', 'TEST-A', 'Bihar', 'India', true),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'Test Org B', 'TEST-B', 'Bihar', 'India', true);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'rbac-a@example.test', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'rbac-b@example.test', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth_profiles (user_id, full_name) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'RBAC User A'),
  ('c1000000-0000-4000-8000-000000000002', 'RBAC User B');

INSERT INTO public.memberships (id, tenant_id, user_id, status) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001', 'active'),
  ('d1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'c1000000-0000-4000-8000-000000000002', 'active');

INSERT INTO public.growta_permissions (code, category, description)
VALUES ('test.permission', 'Test', 'Test-only permission')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.tenant_roles (id, tenant_id, code, name, description, is_system) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'TEST_READER', 'Test Reader A', 'Test role', false),
  ('e1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'TEST_READER', 'Test Reader B', 'Test role', false);

INSERT INTO public.tenant_role_permissions (tenant_id, role_id, permission_code) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'test.permission'),
  ('a1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'test.permission');

INSERT INTO public.membership_roles (tenant_id, membership_id, role_id) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002');

INSERT INTO public.tenant_scope_assignments (tenant_id, membership_id, organization_id) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000001';

SELECT is((SELECT count(*)::int FROM public.memberships), 1, 'user sees only their own membership');
SELECT is((SELECT count(*)::int FROM public.memberships WHERE tenant_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'user cannot see another tenant membership');
SELECT is((SELECT count(*)::int FROM public.tenant_roles WHERE tenant_id = 'a1000000-0000-4000-8000-000000000001'), 1, 'member can read roles in their tenant');
SELECT is((SELECT count(*)::int FROM public.tenant_roles WHERE tenant_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'member cannot read another tenant roles');
SELECT is((SELECT count(*)::int FROM public.tenant_role_permissions WHERE tenant_id = 'a1000000-0000-4000-8000-000000000001'), 1, 'member can read permission mappings in their tenant');
SELECT is((SELECT count(*)::int FROM public.tenant_role_permissions WHERE tenant_id = 'a1000000-0000-4000-8000-000000000002'), 0, 'member cannot read another tenant permission mappings');
SELECT is((SELECT count(*)::int FROM public.membership_roles), 1, 'user sees only their own role assignments');
SELECT is((SELECT count(*)::int FROM public.tenant_scope_assignments), 1, 'user sees only their own scope assignments');
SELECT is((SELECT count(*)::int FROM public.auth_profiles), 1, 'user sees only their own profile');
SELECT ok(private.has_tenant_membership('a1000000-0000-4000-8000-000000000001'), 'active membership check succeeds for own tenant');
SELECT ok(NOT private.has_tenant_membership('a1000000-0000-4000-8000-000000000002'), 'active membership check fails for another tenant');
SELECT ok(private.has_tenant_permission('a1000000-0000-4000-8000-000000000001', 'test.permission'), 'permission check succeeds for assigned role');
SELECT ok(NOT private.has_tenant_permission('a1000000-0000-4000-8000-000000000002', 'test.permission'), 'permission check fails across tenants');
SELECT throws_ok(
  $$ INSERT INTO public.memberships (tenant_id, user_id, status)
     VALUES ('a1000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000001', 'active') $$,
  '42501',
  'authenticated user cannot create or self-assign memberships'
);

UPDATE public.auth_profiles
SET full_name = 'RBAC User A Updated'
WHERE user_id = 'c1000000-0000-4000-8000-000000000001';
SELECT is(
  (SELECT full_name FROM public.auth_profiles WHERE user_id = 'c1000000-0000-4000-8000-000000000001'),
  'RBAC User A Updated',
  'user can update their own safe profile fields'
);
SELECT is(
  (SELECT full_name FROM public.auth_profiles WHERE user_id = 'c1000000-0000-4000-8000-000000000002'),
  'RBAC User B',
  'user cannot update another users profile'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
