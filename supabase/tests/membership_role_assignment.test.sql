-- Tenant-safe membership role assignment, privilege containment and audit.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(5);

INSERT INTO public.tenants(id,name,slug,tier,is_active)
VALUES
 ('a8300000-0000-4000-8000-000000000001','Role Assignment Tenant A','role-assign-a','Test',true),
 ('a8300000-0000-4000-8000-000000000002','Role Assignment Tenant B','role-assign-b','Test',true);
INSERT INTO auth.users(id,email) VALUES
 ('c8300000-0000-4000-8000-000000000001','role-assign-admin@example.test'),
 ('c8300000-0000-4000-8000-000000000002','role-assign-target@example.test');
INSERT INTO public.memberships(id,tenant_id,user_id,status) VALUES
 ('d8300000-0000-4000-8000-000000000001','a8300000-0000-4000-8000-000000000001','c8300000-0000-4000-8000-000000000001','active'),
 ('d8300000-0000-4000-8000-000000000002','a8300000-0000-4000-8000-000000000001','c8300000-0000-4000-8000-000000000002','active');
INSERT INTO public.growta_permissions(code,category,description) VALUES
 ('role.manage','Administration','Manage roles'),
 ('membership.read','Identity','Read memberships'),
 ('membership.manage','Identity','Manage memberships')
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.tenant_roles(id,tenant_id,code,name) VALUES
 ('e8300000-0000-4000-8000-000000000001','a8300000-0000-4000-8000-000000000001','ROLE_ADMIN','Role Admin'),
 ('e8300000-0000-4000-8000-000000000002','a8300000-0000-4000-8000-000000000001','READ_ONLY','Read Only'),
 ('e8300000-0000-4000-8000-000000000003','a8300000-0000-4000-8000-000000000001','HIGH_PRIVILEGE','High Privilege'),
 ('e8300000-0000-4000-8000-000000000004','a8300000-0000-4000-8000-000000000002','OTHER_TENANT_ROLE','Other Tenant Role');
INSERT INTO public.tenant_role_permissions(tenant_id,role_id,permission_code) VALUES
 ('a8300000-0000-4000-8000-000000000001','e8300000-0000-4000-8000-000000000001','role.manage'),
 ('a8300000-0000-4000-8000-000000000001','e8300000-0000-4000-8000-000000000001','membership.read'),
 ('a8300000-0000-4000-8000-000000000001','e8300000-0000-4000-8000-000000000002','membership.read'),
 ('a8300000-0000-4000-8000-000000000001','e8300000-0000-4000-8000-000000000003','membership.manage');
INSERT INTO public.membership_roles(tenant_id,membership_id,role_id)
VALUES ('a8300000-0000-4000-8000-000000000001','d8300000-0000-4000-8000-000000000001','e8300000-0000-4000-8000-000000000001');

SET LOCAL ROLE service_role;
SELECT public.set_tenant_membership_roles(
 'a8300000-0000-4000-8000-000000000001',
 'c8300000-0000-4000-8000-000000000001',
 'role-assign-success',
 'd8300000-0000-4000-8000-000000000002',
 ARRAY['e8300000-0000-4000-8000-000000000002'::uuid]
);
SELECT is(
 (SELECT count(*)::int FROM public.membership_roles
  WHERE tenant_id='a8300000-0000-4000-8000-000000000001'
    AND membership_id='d8300000-0000-4000-8000-000000000002'
    AND role_id='e8300000-0000-4000-8000-000000000002'),
 1,'tenant administrator can assign a role within their permission set'
);
SELECT is(
 (SELECT count(*)::int FROM public.growta_audit_events
  WHERE tenant_id='a8300000-0000-4000-8000-000000000001'
    AND request_id='role-assign-success' AND action='membership.roles_changed'),
 1,'membership role assignment is audited atomically'
);
SELECT throws_ok(
 $$ SELECT public.set_tenant_membership_roles(
  'a8300000-0000-4000-8000-000000000001',
  'c8300000-0000-4000-8000-000000000001',
  'role-assign-escalation',
  'd8300000-0000-4000-8000-000000000002',
  ARRAY['e8300000-0000-4000-8000-000000000003'::uuid]
 ) $$,
 '42501','Cannot grant permissions not held by the acting administrator',
 'administrator cannot grant a higher-privilege role'
);
SELECT is(
 (SELECT count(*)::int FROM public.membership_roles
  WHERE tenant_id='a8300000-0000-4000-8000-000000000001'
    AND membership_id='d8300000-0000-4000-8000-000000000002'
    AND role_id='e8300000-0000-4000-8000-000000000002'),
 1,'rejected escalation leaves the previous role assignment unchanged'
);
SELECT throws_ok(
 $$ SELECT public.set_tenant_membership_roles(
  'a8300000-0000-4000-8000-000000000001',
  'c8300000-0000-4000-8000-000000000001',
  'role-assign-cross-tenant',
  'd8300000-0000-4000-8000-000000000002',
  ARRAY['e8300000-0000-4000-8000-000000000004'::uuid]
 ) $$,
 'P0002','One or more roles are missing or inactive in this tenant',
 'cannot assign a role from another tenant'
);
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
