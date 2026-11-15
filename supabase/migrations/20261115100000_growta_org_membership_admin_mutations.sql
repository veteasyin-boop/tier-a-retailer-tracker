-- Transactional tenant organization and membership administration.
BEGIN;

CREATE OR REPLACE FUNCTION public.manage_tenant_org_record(
 p_tenant_id UUID,p_actor_user_id UUID,p_request_id TEXT,p_entity TEXT,p_action TEXT,
 p_record_id UUID,p_code TEXT,p_name TEXT,p_description TEXT,p_sort_order INTEGER,
 p_unit_type_id UUID,p_parent_id UUID,p_is_active BOOLEAN
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_before JSONB; v_after JSONB; v_id UUID; v_action TEXT;
BEGIN
 IF p_tenant_id IS NULL OR p_actor_user_id IS NULL OR p_request_id IS NULL
    OR length(p_request_id) NOT BETWEEN 1 AND 200
    OR p_entity NOT IN ('unit_type','unit','designation')
    OR p_action NOT IN ('create','update') THEN
  RAISE EXCEPTION 'Invalid organization mutation' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m
  JOIN public.membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
  JOIN public.tenant_roles r ON r.tenant_id=mr.tenant_id AND r.id=mr.role_id AND r.is_active
  JOIN public.tenant_role_permissions rp ON rp.tenant_id=r.tenant_id AND rp.role_id=r.id
  WHERE m.tenant_id=p_tenant_id AND m.user_id=p_actor_user_id AND m.status='active'
   AND ((p_entity='designation' AND rp.permission_code='designation.manage')
     OR (p_entity IN ('unit_type','unit') AND rp.permission_code='organization.manage'))
 ) THEN RAISE EXCEPTION 'Organization management permission is required' USING ERRCODE='42501'; END IF;
 IF p_code IS NULL OR p_code !~ '^[A-Z0-9][A-Z0-9_-]{1,49}$'
   OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 120
   OR (p_description IS NOT NULL AND length(p_description)>500)
   OR p_is_active IS NULL THEN
  RAISE EXCEPTION 'Invalid organization fields' USING ERRCODE='22023';
 END IF;
 IF p_entity='unit_type' THEN
  IF p_action='create' THEN
   INSERT INTO public.org_unit_types(tenant_id,code,name,description,sort_order,is_active)
   VALUES(p_tenant_id,p_code,btrim(p_name),NULLIF(btrim(p_description),''),COALESCE(p_sort_order,0),p_is_active)
   RETURNING id INTO v_id;
  ELSE
   SELECT to_jsonb(x) INTO v_before FROM public.org_unit_types x WHERE tenant_id=p_tenant_id AND id=p_record_id FOR UPDATE;
   IF v_before IS NULL THEN RAISE EXCEPTION 'Unit type not found' USING ERRCODE='P0002'; END IF;
   UPDATE public.org_unit_types SET code=p_code,name=btrim(p_name),description=NULLIF(btrim(p_description),''),sort_order=COALESCE(p_sort_order,0),is_active=p_is_active
   WHERE tenant_id=p_tenant_id AND id=p_record_id RETURNING id INTO v_id;
  END IF;
  SELECT to_jsonb(x) INTO v_after FROM public.org_unit_types x WHERE tenant_id=p_tenant_id AND id=v_id;
 ELSIF p_entity='unit' THEN
  IF p_unit_type_id IS NULL THEN RAISE EXCEPTION 'Unit type is required' USING ERRCODE='22023'; END IF;
  IF p_action='create' THEN
   INSERT INTO public.org_units(tenant_id,unit_type_id,parent_id,code,name,description,is_active)
   VALUES(p_tenant_id,p_unit_type_id,p_parent_id,p_code,btrim(p_name),NULLIF(btrim(p_description),''),p_is_active)
   RETURNING id INTO v_id;
  ELSE
   SELECT to_jsonb(x) INTO v_before FROM public.org_units x WHERE tenant_id=p_tenant_id AND id=p_record_id FOR UPDATE;
   IF v_before IS NULL THEN RAISE EXCEPTION 'Organization unit not found' USING ERRCODE='P0002'; END IF;
   UPDATE public.org_units SET unit_type_id=p_unit_type_id,parent_id=p_parent_id,code=p_code,name=btrim(p_name),description=NULLIF(btrim(p_description),''),is_active=p_is_active
   WHERE tenant_id=p_tenant_id AND id=p_record_id RETURNING id INTO v_id;
  END IF;
  SELECT to_jsonb(x) INTO v_after FROM public.org_units x WHERE tenant_id=p_tenant_id AND id=v_id;
 ELSE
  IF p_action='create' THEN
   INSERT INTO public.designations(tenant_id,code,name,description,is_active)
   VALUES(p_tenant_id,p_code,btrim(p_name),NULLIF(btrim(p_description),''),p_is_active)
   RETURNING id INTO v_id;
  ELSE
   SELECT to_jsonb(x) INTO v_before FROM public.designations x WHERE tenant_id=p_tenant_id AND id=p_record_id FOR UPDATE;
   IF v_before IS NULL THEN RAISE EXCEPTION 'Designation not found' USING ERRCODE='P0002'; END IF;
   UPDATE public.designations SET code=p_code,name=btrim(p_name),description=NULLIF(btrim(p_description),''),is_active=p_is_active
   WHERE tenant_id=p_tenant_id AND id=p_record_id RETURNING id INTO v_id;
  END IF;
  SELECT to_jsonb(x) INTO v_after FROM public.designations x WHERE tenant_id=p_tenant_id AND id=v_id;
 END IF;
 v_action:=p_entity||'.'||p_action||'d';
 INSERT INTO public.growta_audit_events(tenant_id,actor_user_id,request_id,action,entity_type,entity_id,before_data,after_data,metadata)
 VALUES(p_tenant_id,p_actor_user_id,p_request_id,v_action,p_entity,v_id::TEXT,v_before,v_after,'{}'::jsonb);
 RETURN v_after;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_tenant_member_org_assignment(
 p_tenant_id UUID,p_actor_user_id UUID,p_request_id TEXT,p_membership_id UUID,
 p_org_unit_id UUID,p_designation_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_before JSONB; v_after JSONB;
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m JOIN public.membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
  JOIN public.tenant_roles r ON r.tenant_id=mr.tenant_id AND r.id=mr.role_id AND r.is_active
  JOIN public.tenant_role_permissions rp ON rp.tenant_id=r.tenant_id AND rp.role_id=r.id
  WHERE m.tenant_id=p_tenant_id AND m.user_id=p_actor_user_id AND m.status='active' AND rp.permission_code='membership.manage'
 ) THEN RAISE EXCEPTION 'Membership management permission is required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE tenant_id=p_tenant_id AND id=p_membership_id AND status IN ('active','invited')) THEN
  RAISE EXCEPTION 'Membership not found' USING ERRCODE='P0002'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.org_units WHERE tenant_id=p_tenant_id AND id=p_org_unit_id AND is_active) THEN
  RAISE EXCEPTION 'Organization unit not found or inactive' USING ERRCODE='P0002'; END IF;
 IF p_designation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.designations WHERE tenant_id=p_tenant_id AND id=p_designation_id AND is_active) THEN
  RAISE EXCEPTION 'Designation not found or inactive' USING ERRCODE='P0002'; END IF;
 SELECT to_jsonb(a) INTO v_before FROM public.membership_org_assignments a WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id FOR UPDATE;
 INSERT INTO public.membership_org_assignments(tenant_id,membership_id,org_unit_id,designation_id,assigned_by)
 VALUES(p_tenant_id,p_membership_id,p_org_unit_id,p_designation_id,p_actor_user_id)
 ON CONFLICT(tenant_id,membership_id) DO UPDATE SET org_unit_id=EXCLUDED.org_unit_id,designation_id=EXCLUDED.designation_id,assigned_at=now(),assigned_by=EXCLUDED.assigned_by;
 SELECT to_jsonb(a) INTO v_after FROM public.membership_org_assignments a WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id;
 INSERT INTO public.growta_audit_events(tenant_id,actor_user_id,request_id,action,entity_type,entity_id,before_data,after_data,metadata)
 VALUES(p_tenant_id,p_actor_user_id,p_request_id,'membership.organization_assigned','membership',p_membership_id::TEXT,v_before,v_after,'{}'::jsonb);
 RETURN v_after;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_tenant_reporting_relationship(
 p_tenant_id UUID,p_actor_user_id UUID,p_request_id TEXT,p_membership_id UUID,
 p_manager_membership_id UUID,p_relationship_type TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_before JSONB; v_after JSONB; v_id UUID;
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m JOIN public.membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
  JOIN public.tenant_roles r ON r.tenant_id=mr.tenant_id AND r.id=mr.role_id AND r.is_active
  JOIN public.tenant_role_permissions rp ON rp.tenant_id=r.tenant_id AND rp.role_id=r.id
  WHERE m.tenant_id=p_tenant_id AND m.user_id=p_actor_user_id AND m.status='active' AND rp.permission_code='reporting.manage'
 ) THEN RAISE EXCEPTION 'Reporting management permission is required' USING ERRCODE='42501'; END IF;
 IF p_relationship_type NOT IN ('primary','dotted') OR p_membership_id=p_manager_membership_id
   OR NOT EXISTS(SELECT 1 FROM public.memberships WHERE tenant_id=p_tenant_id AND id=p_membership_id AND status='active')
   OR NOT EXISTS(SELECT 1 FROM public.memberships WHERE tenant_id=p_tenant_id AND id=p_manager_membership_id AND status='active') THEN
  RAISE EXCEPTION 'Invalid reporting relationship' USING ERRCODE='22023';
 END IF;
 IF p_relationship_type='primary' THEN
  SELECT to_jsonb(x) INTO v_before FROM public.membership_reporting_relationships x
   WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id AND relationship_type='primary' AND ends_at IS NULL FOR UPDATE;
  UPDATE public.membership_reporting_relationships SET ends_at=now()
   WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id AND relationship_type='primary' AND ends_at IS NULL;
 END IF;
 INSERT INTO public.membership_reporting_relationships(tenant_id,membership_id,reports_to_membership_id,relationship_type,created_by)
 VALUES(p_tenant_id,p_membership_id,p_manager_membership_id,p_relationship_type,p_actor_user_id)
 RETURNING id INTO v_id;
 SELECT to_jsonb(x) INTO v_after FROM public.membership_reporting_relationships x WHERE id=v_id;
 INSERT INTO public.growta_audit_events(tenant_id,actor_user_id,request_id,action,entity_type,entity_id,before_data,after_data,metadata)
 VALUES(p_tenant_id,p_actor_user_id,p_request_id,'membership.reporting_changed','membership',p_membership_id::TEXT,v_before,v_after,jsonb_build_object('relationship_type',p_relationship_type));
 RETURN v_after;
END; $function$;

REVOKE ALL ON FUNCTION public.manage_tenant_org_record(UUID,UUID,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID,BOOLEAN) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_tenant_member_org_assignment(UUID,UUID,TEXT,UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_tenant_reporting_relationship(UUID,UUID,TEXT,UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_tenant_org_record(UUID,UUID,TEXT,TEXT,TEXT,UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_tenant_member_org_assignment(UUID,UUID,TEXT,UUID,UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_tenant_reporting_relationship(UUID,UUID,TEXT,UUID,UUID,TEXT) TO service_role;

COMMIT;