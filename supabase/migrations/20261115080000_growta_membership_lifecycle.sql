-- Tenant-safe membership activation and suspension with atomic audit.
BEGIN;
CREATE OR REPLACE FUNCTION public.update_tenant_membership_status(
 p_tenant_id UUID,p_actor_user_id UUID,p_request_id TEXT,p_membership_id UUID,p_status TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_membership public.memberships%ROWTYPE; v_before JSONB; v_after JSONB;
BEGIN
 IF p_tenant_id IS NULL OR p_actor_user_id IS NULL OR p_membership_id IS NULL
  OR p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 1 AND 200
  OR p_status IS NULL OR p_status NOT IN ('active','suspended') THEN
  RAISE EXCEPTION 'Invalid membership status update' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships actor_m
  JOIN public.tenants t ON t.id=actor_m.tenant_id AND t.is_active
  JOIN public.membership_roles mr ON mr.tenant_id=actor_m.tenant_id AND mr.membership_id=actor_m.id
  JOIN public.tenant_roles tr ON tr.tenant_id=mr.tenant_id AND tr.id=mr.role_id AND tr.is_active
   AND tr.code <> 'SUPER_ADMIN'
  JOIN public.tenant_role_permissions trp ON trp.tenant_id=tr.tenant_id AND trp.role_id=tr.id
   AND trp.permission_code='membership.manage'
  WHERE actor_m.tenant_id=p_tenant_id AND actor_m.user_id=p_actor_user_id AND actor_m.status='active'
 ) THEN RAISE EXCEPTION 'Membership management permission is required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_membership FROM public.memberships
 WHERE tenant_id=p_tenant_id AND id=p_membership_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found' USING ERRCODE='P0002'; END IF;
 IF v_membership.user_id=p_actor_user_id AND p_status='suspended' THEN
  RAISE EXCEPTION 'Self-suspension is not allowed' USING ERRCODE='55000';
 END IF;
 SELECT jsonb_build_object('id',id,'tenant_id',tenant_id,'user_id',user_id,'status',status,
  'invited_by',invited_by,'invited_at',invited_at,'accepted_at',accepted_at)
 INTO v_before FROM public.memberships WHERE tenant_id=p_tenant_id AND id=p_membership_id;
 IF v_membership.status <> p_status THEN
  UPDATE public.memberships SET status=p_status,
   accepted_at=CASE WHEN p_status='active' THEN COALESCE(accepted_at,now()) ELSE accepted_at END
  WHERE tenant_id=p_tenant_id AND id=p_membership_id;
  SELECT jsonb_build_object('id',id,'tenant_id',tenant_id,'user_id',user_id,'status',status,
   'invited_by',invited_by,'invited_at',invited_at,'accepted_at',accepted_at)
  INTO v_after FROM public.memberships WHERE tenant_id=p_tenant_id AND id=p_membership_id;
  INSERT INTO public.growta_audit_events(tenant_id,actor_user_id,request_id,action,entity_type,entity_id,before_data,after_data,metadata)
  VALUES(p_tenant_id,p_actor_user_id,p_request_id,
   CASE WHEN p_status='active' THEN 'membership.activated' ELSE 'membership.suspended' END,
   'membership',p_membership_id::TEXT,v_before,v_after,'{}'::jsonb);
 ELSE
  v_after:=v_before;
 END IF;
 RETURN v_after;
END; $function$;
REVOKE ALL ON FUNCTION public.update_tenant_membership_status(UUID,UUID,TEXT,UUID,TEXT)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_membership_status(UUID,UUID,TEXT,UUID,TEXT) TO service_role;
COMMIT;
