-- Tenant-safe membership role assignment with privilege containment and audit.
BEGIN;

CREATE OR REPLACE FUNCTION public.set_tenant_membership_roles(
 p_tenant_id UUID,
 p_actor_user_id UUID,
 p_request_id TEXT,
 p_membership_id UUID,
 p_role_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
 v_target public.memberships%ROWTYPE;
 v_before JSONB;
 v_after JSONB;
 v_requested UUID[];
 v_count INTEGER;
BEGIN
 IF p_tenant_id IS NULL OR p_actor_user_id IS NULL OR p_membership_id IS NULL
   OR p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'Invalid membership role assignment context' USING ERRCODE='22023';
 END IF;

 SELECT COALESCE(array_agg(DISTINCT role_id ORDER BY role_id), ARRAY[]::UUID[])
 INTO v_requested
 FROM unnest(COALESCE(p_role_ids, ARRAY[]::UUID[])) AS requested(role_id);

 IF cardinality(v_requested) > 20 THEN
  RAISE EXCEPTION 'Too many roles requested' USING ERRCODE='22023';
 END IF;

 IF NOT EXISTS (
  SELECT 1
  FROM public.memberships actor_m
  JOIN public.tenants t ON t.id=actor_m.tenant_id AND t.is_active IS TRUE
  JOIN public.membership_roles mr ON mr.tenant_id=actor_m.tenant_id AND mr.membership_id=actor_m.id
  JOIN public.tenant_roles ar ON ar.tenant_id=mr.tenant_id AND ar.id=mr.role_id
    AND ar.is_active IS TRUE AND ar.code <> 'SUPER_ADMIN'
  JOIN public.tenant_role_permissions arp ON arp.tenant_id=ar.tenant_id
    AND arp.role_id=ar.id AND arp.permission_code='role.manage'
  WHERE actor_m.tenant_id=p_tenant_id AND actor_m.user_id=p_actor_user_id
    AND actor_m.status='active'
 ) THEN
  RAISE EXCEPTION 'Role management permission is required' USING ERRCODE='42501';
 END IF;

 SELECT * INTO v_target
 FROM public.memberships
 WHERE tenant_id=p_tenant_id AND id=p_membership_id
 FOR UPDATE;
 IF NOT FOUND OR v_target.status NOT IN ('active','invited') THEN
  RAISE EXCEPTION 'Membership not found or inactive' USING ERRCODE='P0002';
 END IF;
 IF v_target.user_id=p_actor_user_id THEN
  RAISE EXCEPTION 'Administrators cannot change their own role assignments' USING ERRCODE='55000';
 END IF;

 SELECT count(*) INTO v_count
 FROM public.tenant_roles
 WHERE tenant_id=p_tenant_id AND id=ANY(v_requested) AND is_active IS TRUE;
 IF v_count <> cardinality(v_requested) THEN
  RAISE EXCEPTION 'One or more roles are missing or inactive in this tenant' USING ERRCODE='P0002';
 END IF;

 -- An administrator may only grant permissions they currently possess.
 -- This prevents a lower-privilege role manager from escalating another user.
 IF EXISTS (
  SELECT 1
  FROM public.tenant_role_permissions requested
  WHERE requested.tenant_id=p_tenant_id AND requested.role_id=ANY(v_requested)
    AND NOT EXISTS (
     SELECT 1
     FROM public.memberships actor_m
     JOIN public.membership_roles actor_mr ON actor_mr.tenant_id=actor_m.tenant_id AND actor_mr.membership_id=actor_m.id
     JOIN public.tenant_roles actor_r ON actor_r.tenant_id=actor_mr.tenant_id AND actor_r.id=actor_mr.role_id AND actor_r.is_active IS TRUE
     JOIN public.tenant_role_permissions actor_rp ON actor_rp.tenant_id=actor_r.tenant_id AND actor_rp.role_id=actor_r.id
     WHERE actor_m.tenant_id=p_tenant_id AND actor_m.user_id=p_actor_user_id
       AND actor_m.status='active' AND actor_r.code <> 'SUPER_ADMIN'
       AND actor_rp.permission_code=requested.permission_code
    )
 ) THEN
  RAISE EXCEPTION 'Cannot grant permissions not held by the acting administrator' USING ERRCODE='42501';
 END IF;

 SELECT COALESCE(jsonb_agg(jsonb_build_object('roleId',tr.id,'code',tr.code,'name',tr.name)
   ORDER BY tr.code),'[]'::jsonb)
 INTO v_before
 FROM public.membership_roles mr
 JOIN public.tenant_roles tr ON tr.tenant_id=mr.tenant_id AND tr.id=mr.role_id
 WHERE mr.tenant_id=p_tenant_id AND mr.membership_id=p_membership_id;

 DELETE FROM public.membership_roles
 WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id;

 INSERT INTO public.membership_roles(tenant_id,membership_id,role_id,assigned_by)
 SELECT p_tenant_id,p_membership_id,role_id,p_actor_user_id
 FROM unnest(v_requested) AS requested(role_id);

 SELECT COALESCE(jsonb_agg(jsonb_build_object('roleId',tr.id,'code',tr.code,'name',tr.name)
   ORDER BY tr.code),'[]'::jsonb)
 INTO v_after
 FROM public.membership_roles mr
 JOIN public.tenant_roles tr ON tr.tenant_id=mr.tenant_id AND tr.id=mr.role_id
 WHERE mr.tenant_id=p_tenant_id AND mr.membership_id=p_membership_id;

 INSERT INTO public.growta_audit_events(
  tenant_id,actor_user_id,request_id,action,entity_type,entity_id,
  before_data,after_data,metadata
 ) VALUES (
  p_tenant_id,p_actor_user_id,p_request_id,'membership.roles_changed',
  'membership',p_membership_id::TEXT,
  jsonb_build_object('roles',v_before),
  jsonb_build_object('roles',v_after),
  jsonb_build_object('role_count',cardinality(v_requested))
 );

 RETURN jsonb_build_object('membershipId',p_membership_id,'roles',v_after);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_tenant_membership_roles(UUID,UUID,TEXT,UUID,UUID[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_membership_roles(UUID,UUID,TEXT,UUID,UUID[])
 TO service_role;

COMMIT;
