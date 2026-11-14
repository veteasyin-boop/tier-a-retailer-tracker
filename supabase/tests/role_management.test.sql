-- Atomic role creation and update, tenant authorization and audit coverage.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO public, extensions;
SELECT plan(8);
INSERT INTO public.tenants (id,name,slug,tier,is_active)
VALUES ('a6000000-0000-4000-8000-000000000001','Role RPC Tenant','role-rpc-test','Test',true);
INSERT INTO auth.users (id,email) VALUES
 ('c6000000-0000-4000-8000-000000000001','role-rpc-admin@example.test');
INSERT INTO public.memberships (id,tenant_id,user_id,status) VALUES
 ('d6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001',
  'c6000000-0000-4000-8000-000000000001','active');
INSERT INTO public.growta_permissions(code,category,description) VALUES
 ('role.manage','Administration','Manage tenant roles'),
 ('test.role.permission','Test','Permission for RPC test')
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.tenant_roles(id,tenant_id,code,name)
VALUES ('e6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','TENANT_ADMIN','Tenant Admin');
INSERT INTO public.tenant_role_permissions(tenant_id,role_id,permission_code) VALUES
 ('a6000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','role.manage');
INSERT INTO public.membership_roles(tenant_id,membership_id,role_id) VALUES
 ('a6000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001');
SET LOCAL ROLE service_role;
SELECT public.create_tenant_role_with_permissions(
 'a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',
 'role-rpc-test-request','FIELD_EXECUTIVE','Field Executive','Field team role',
 ARRAY['test.role.permission','test.role.permission']);
SELECT is((SELECT count(*)::int FROM public.tenant_roles
 WHERE tenant_id='a6000000-0000-4000-8000-000000000001' AND code='FIELD_EXECUTIVE'),1,
 'RPC creates one tenant-local role');
SELECT is((SELECT count(*)::int FROM public.tenant_role_permissions
 WHERE tenant_id='a6000000-0000-4000-8000-000000000001'
 AND role_id=(SELECT id FROM public.tenant_roles WHERE tenant_id='a6000000-0000-4000-8000-000000000001' AND code='FIELD_EXECUTIVE')
 AND permission_code='test.role.permission'),1,'RPC de-duplicates and assigns requested permissions');
SELECT is((SELECT count(*)::int FROM public.growta_audit_events
 WHERE tenant_id='a6000000-0000-4000-8000-000000000001'
 AND action='role.created' AND request_id='role-rpc-test-request'),1,
 'role creation and audit event commit together');
SELECT throws_ok(
 $$ SELECT public.create_tenant_role_with_permissions(
 'a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',
 'role-rpc-invalid-permission','INVALID_ROLE','Invalid Role',NULL,ARRAY['not.a.real.permission']) $$,
 '22023','Unknown permission code','RPC rejects unknown permission codes');
SELECT public.update_tenant_role_with_permissions(
 'a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',
 'role-rpc-update-request',(SELECT id FROM public.tenant_roles
 WHERE tenant_id='a6000000-0000-4000-8000-000000000001' AND code='FIELD_EXECUTIVE'),
 'Field Sales Executive','Updated role description',true,ARRAY[]::TEXT[]);
SELECT is((SELECT name FROM public.tenant_roles
 WHERE tenant_id='a6000000-0000-4000-8000-000000000001' AND code='FIELD_EXECUTIVE'),
 'Field Sales Executive','RPC updates role metadata and replaces its permission set');
SELECT is((SELECT count(*)::int FROM public.growta_audit_events
 WHERE tenant_id='a6000000-0000-4000-8000-000000000001'
 AND action='role.updated' AND request_id='role-rpc-update-request'),1,
 'role update is audited in the same transaction');
INSERT INTO public.membership_roles(tenant_id,membership_id,role_id)
SELECT 'a6000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',id
FROM public.tenant_roles WHERE tenant_id='a6000000-0000-4000-8000-000000000001' AND code='FIELD_EXECUTIVE';
SELECT throws_ok(
 $$ SELECT public.update_tenant_role_with_permissions(
 'a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',
 'role-rpc-deactivate-request',(SELECT id FROM public.tenant_roles
 WHERE tenant_id='a6000000-0000-4000-8000-000000000001' AND code='FIELD_EXECUTIVE'),
 'Field Sales Executive','Updated role description',false,ARRAY[]::TEXT[]) $$,
 '23514','Role is assigned to active members; reassign them before deactivation',
 'RPC prevents deactivation while active members still depend on the role');
RESET ROLE;
SELECT ok(NOT has_function_privilege('authenticated',
 'public.create_tenant_role_with_permissions(uuid,uuid,text,text,text,text,text[])','EXECUTE'),
 'browser authenticated role cannot call privileged role creation RPC');
SELECT ok(NOT has_function_privilege('authenticated',
 'public.update_tenant_role_with_permissions(uuid,uuid,text,uuid,text,text,boolean,text[])','EXECUTE'),
 'browser authenticated role cannot call privileged role update RPC');
SELECT * FROM finish();
ROLLBACK;
