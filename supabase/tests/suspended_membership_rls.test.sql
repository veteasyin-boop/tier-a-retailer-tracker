-- Suspended memberships cannot read role, scope, placement, or reporting metadata.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;

SELECT plan(4);

INSERT INTO public.tenants (id, name, slug, tier, is_active) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'Suspension Test Tenant', 'suspension-test', 'Test', true);

INSERT INTO auth.users (id, email) VALUES
  ('c4000000-0000-4000-8000-000000000001', 'suspended-member@example.test'),
  ('c4000000-0000-4000-8000-000000000002', 'active-manager@example.test');

INSERT INTO public.memberships (id, tenant_id, user_id, status) VALUES
  ('d4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'suspended'),
  ('d4000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', 'active');

INSERT INTO public.membership_roles (tenant_id, membership_id, role_id)
SELECT 'a4000000-0000-4000-8000-000000000001',
       'd4000000-0000-4000-8000-000000000001', id
FROM public.tenant_roles
WHERE tenant_id = 'a4000000-0000-4000-8000-000000000001'
  AND code = 'FIELD_OFFICER';

INSERT INTO public.tenant_scope_assignments (tenant_id, membership_id, organization_id)
SELECT 'a4000000-0000-4000-8000-000000000001',
       'd4000000-0000-4000-8000-000000000001', id
FROM public.organizations
WHERE tenant_id = 'a4000000-0000-4000-8000-000000000001'
LIMIT 1;

INSERT INTO public.org_unit_types (id, tenant_id, code, name) VALUES
  ('e4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'TEAM', 'Team');
INSERT INTO public.org_units (id, tenant_id, unit_type_id, code, name) VALUES
  ('f4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 'TEAM-A', 'Team A');
INSERT INTO public.membership_org_assignments (tenant_id, membership_id, org_unit_id) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001');
INSERT INTO public.membership_org_unit_scopes (tenant_id, membership_id, org_unit_id) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001');
INSERT INTO public.membership_reporting_relationships (tenant_id, membership_id, reports_to_membership_id, relationship_type) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000002', 'primary');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000001';

SELECT is((SELECT count(*)::int FROM public.membership_roles), 0,
  'suspended member cannot read own role assignments');
SELECT is((SELECT count(*)::int FROM public.tenant_scope_assignments), 0,
  'suspended member cannot read own legacy scope assignments');
SELECT is((SELECT count(*)::int FROM public.membership_org_assignments), 0,
  'suspended member cannot read own primary org placement');
SELECT is((SELECT count(*)::int FROM public.membership_org_unit_scopes), 0,
  'suspended member cannot read own additional org scopes');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
