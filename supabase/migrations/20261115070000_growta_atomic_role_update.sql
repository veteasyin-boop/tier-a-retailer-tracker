-- Atomic role updates, permission replacement, deactivation and audit.
BEGIN;
CREATE OR REPLACE FUNCTION public.update_tenant_role_with_permissions(
 p_tenant_id UUID,p_actor_user_id UUID,p_request_id TEXT,p_role_id UUID,
 p_name TEXT,p_description TEXT,p_is_active BOOLEAN,p_permission_codes TEXT[]
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_role public.tenant_roles%ROWTYPE; v_before JSONB; v_after JSONB; v_permissions TEXT[];
BEGIN
 IF p_tenant_id IS NULL OR p_actor_user_id IS NULL OR p_role_id IS NULL OR p_request_id IS NULL
    OR length(p_request_id) NOT BETWEEN 1 AND 200 OR p_is_active IS NULL THEN
  RAISE EXCEPTION 'Invalid role update context' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m
  JOIN public.membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
  JOIN public.tenant_roles ar ON ar.tenant_id=mr.tenant_id AND ar.id=mr.role_id
   AND ar.is_active AND ar.code <> 'SUPER_ADMIN'
  JOIN public.tenant_role_permissions trp ON trp.tenant_id=ar.tenant_id
   AND trp.role_id=ar.id AND trp.permission_code='role.manage'
  WHERE m.tenant_id=p_tenant_id AND m.user_id=p_actor_user_id AND m.status='active'
 ) THEN RAISE EXCEPTION 'Role management permission is required' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 100
    OR (p_description IS NOT NULL AND length(p_description)>500) THEN
  RAISE EXCEPTION 'Invalid role fields' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_role FROM public.tenant_roles
 WHERE tenant_id=p_tenant_id AND id=p_role_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Role not found' USING ERRCODE='P0002'; END IF;
 IF v_role.is_system THEN RAISE EXCEPTION 'System roles cannot be modified' USING ERRCODE='55000'; END IF;
 IF v_role.is_active AND NOT p_is_active AND EXISTS (
  SELECT 1 FROM public.membership_roles mr
  JOIN public.memberships m ON m.tenant_id=mr.tenant_id AND m.id=mr.membership_id
  WHERE mr.tenant_id=p_tenant_id AND mr.role_id=p_role_id AND m.status='active'
 ) THEN RAISE EXCEPTION 'Role is assigned to active members; reassign them before deactivation' USING ERRCODE='23514'; END IF;
 SELECT COALESCE(array_agg(DISTINCT x.permission_code ORDER BY x.permission_code),ARRAY[]::TEXT[])
 INTO v_permissions FROM unnest(COALESCE(p_permission_codes,ARRAY[]::TEXT[])) x(permission_code);
 IF cardinality(v_permissions)>200 THEN RAISE EXCEPTION 'Too many permissions requested' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(v_permissions) x(code)
  LEFT JOIN public.growta_permissions gp ON gp.code=x.code WHERE gp.code IS NULL)
 THEN RAISE EXCEPTION 'Unknown permission code' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',v_role.id,'tenant_id',v_role.tenant_id,'code',v_role.code,
  'name',v_role.name,'description',v_role.description,'is_system',v_role.is_system,
  'is_active',v_role.is_active,'permissions',COALESCE((SELECT jsonb_agg(p.permission_code ORDER BY p.permission_code)
   FROM public.tenant_role_permissions p WHERE p.tenant_id=p_tenant_id AND p.role_id=p_role_id),'[]'::jsonb))
 INTO v_before;
 UPDATE public.tenant_roles SET name=btrim(p_name),description=NULLIF(btrim(p_description),''),
  is_active=p_is_active WHERE tenant_id=p_tenant_id AND id=p_role_id;
 DELETE FROM public.tenant_role_permissions WHERE tenant_id=p_tenant_id AND role_id=p_role_id;
 INSERT INTO public.tenant_role_permissions(tenant_id,role_id,permission_code)
 SELECT p_tenant_id,p_role_id,x.permission_code FROM unnest(v_permissions) x(permission_code);
 SELECT jsonb_build_object('id',tr.id,'tenant_id',tr.tenant_id,'code',tr.code,'name',tr.name,
  'description',tr.description,'is_system',tr.is_system,'is_active',tr.is_active,
  'permissions',to_jsonb(v_permissions)) INTO v_after
 FROM public.tenant_roles tr WHERE tr.tenant_id=p_tenant_id AND tr.id=p_role_id;
 INSERT INTO public.growta_audit_events(tenant_id,actor_user_id,request_id,action,entity_type,entity_id,
  before_data,after_data,metadata)
 VALUES(p_tenant_id,p_actor_user_id,p_request_id,
  CASE WHEN v_role.is_active AND NOT p_is_active THEN 'role.deactivated'
       WHEN NOT v_role.is_active AND p_is_active THEN 'role.activated' ELSE 'role.updated' END,
  'tenant_role',p_role_id::TEXT,v_before,v_after,jsonb_build_object('permission_count',cardinality(v_permissions)));
 RETURN v_after;
END; $function$;
REVOKE ALL ON FUNCTION public.update_tenant_role_with_permissions(UUID,UUID,TEXT,UUID,TEXT,TEXT,BOOLEAN,TEXT[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_role_with_permissions(UUID,UUID,TEXT,UUID,TEXT,TEXT,BOOLEAN,TEXT[])
 TO service_role;
COMMIT;