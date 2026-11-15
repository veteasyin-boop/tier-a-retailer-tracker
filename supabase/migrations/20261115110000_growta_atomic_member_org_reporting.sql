-- Atomic tenant member placement and reporting update.
-- Reuses the tenant-scoped tables, permissions, audit store, and reporting-cycle trigger.
BEGIN;

CREATE OR REPLACE FUNCTION public.set_tenant_member_org_and_reporting(
 p_tenant_id UUID,
 p_actor_user_id UUID,
 p_request_id TEXT,
 p_membership_id UUID,
 p_org_unit_id UUID,
 p_designation_id UUID,
 p_manager_membership_id UUID,
 p_relationship_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
 v_membership public.memberships%ROWTYPE;
 v_before_assignment JSONB;
 v_after_assignment JSONB;
 v_before_reporting JSONB;
 v_after_reporting JSONB;
 v_reporting_id UUID;
BEGIN
 IF p_tenant_id IS NULL OR p_actor_user_id IS NULL OR p_membership_id IS NULL
   OR p_org_unit_id IS NULL OR p_request_id IS NULL
   OR length(p_request_id) NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'Invalid membership organization assignment' USING ERRCODE='22023';
 END IF;

 IF NOT EXISTS (
  SELECT 1
  FROM public.memberships actor_m
  JOIN public.tenants t ON t.id=actor_m.tenant_id AND t.is_active IS TRUE
  JOIN public.membership_roles mr ON mr.tenant_id=actor_m.tenant_id AND mr.membership_id=actor_m.id
  JOIN public.tenant_roles tr ON tr.tenant_id=mr.tenant_id AND tr.id=mr.role_id AND tr.is_active IS TRUE
   AND tr.code <> 'SUPER_ADMIN'
  JOIN public.tenant_role_permissions rp ON rp.tenant_id=tr.tenant_id AND rp.role_id=tr.id
  WHERE actor_m.tenant_id=p_tenant_id AND actor_m.user_id=p_actor_user_id
    AND actor_m.status='active' AND rp.permission_code='membership.manage'
 ) THEN
  RAISE EXCEPTION 'Membership management permission is required' USING ERRCODE='42501';
 END IF;

 IF p_manager_membership_id IS NOT NULL THEN
  IF p_relationship_type NOT IN ('primary','dotted') THEN
   RAISE EXCEPTION 'Invalid reporting relationship type' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
   SELECT 1
   FROM public.memberships actor_m
   JOIN public.membership_roles mr ON mr.tenant_id=actor_m.tenant_id AND mr.membership_id=actor_m.id
   JOIN public.tenant_roles tr ON tr.tenant_id=mr.tenant_id AND tr.id=mr.role_id AND tr.is_active IS TRUE
   JOIN public.tenant_role_permissions rp ON rp.tenant_id=tr.tenant_id AND rp.role_id=tr.id
   WHERE actor_m.tenant_id=p_tenant_id AND actor_m.user_id=p_actor_user_id
     AND actor_m.status='active' AND rp.permission_code='reporting.manage'
  ) THEN
   RAISE EXCEPTION 'Reporting management permission is required' USING ERRCODE='42501';
  END IF;
 END IF;

 SELECT * INTO v_membership
 FROM public.memberships
 WHERE tenant_id=p_tenant_id AND id=p_membership_id
 FOR UPDATE;
 IF NOT FOUND OR v_membership.status NOT IN ('active','invited') THEN
  RAISE EXCEPTION 'Membership not found or inactive' USING ERRCODE='P0002';
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM public.org_units
  WHERE tenant_id=p_tenant_id AND id=p_org_unit_id AND is_active IS TRUE
 ) THEN
  RAISE EXCEPTION 'Organization unit not found or inactive' USING ERRCODE='P0002';
 END IF;
 IF p_designation_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.designations
  WHERE tenant_id=p_tenant_id AND id=p_designation_id AND is_active IS TRUE
 ) THEN
  RAISE EXCEPTION 'Designation not found or inactive' USING ERRCODE='P0002';
 END IF;

 IF p_manager_membership_id IS NOT NULL THEN
  IF p_membership_id=p_manager_membership_id OR v_membership.status <> 'active'
    OR NOT EXISTS (
     SELECT 1 FROM public.memberships
     WHERE tenant_id=p_tenant_id AND id=p_manager_membership_id AND status='active'
    ) THEN
   RAISE EXCEPTION 'Invalid reporting relationship' USING ERRCODE='22023';
  END IF;
  -- Serialize reporting changes per tenant. The existing trigger performs
  -- recursive cycle detection under this same transaction-scoped lock.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));
 END IF;

 SELECT to_jsonb(a) INTO v_before_assignment
 FROM public.membership_org_assignments a
 WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id
 FOR UPDATE;

 IF p_manager_membership_id IS NOT NULL AND p_relationship_type='primary' THEN
  SELECT to_jsonb(r) INTO v_before_reporting
  FROM public.membership_reporting_relationships r
  WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id
    AND relationship_type='primary' AND ends_at IS NULL
  FOR UPDATE;
 END IF;

 INSERT INTO public.membership_org_assignments(
  tenant_id,membership_id,org_unit_id,designation_id,assigned_by
 ) VALUES (
  p_tenant_id,p_membership_id,p_org_unit_id,p_designation_id,p_actor_user_id
 )
 ON CONFLICT(tenant_id,membership_id) DO UPDATE
 SET org_unit_id=EXCLUDED.org_unit_id,
     designation_id=EXCLUDED.designation_id,
     assigned_at=now(),
     assigned_by=EXCLUDED.assigned_by;

 SELECT to_jsonb(a) INTO v_after_assignment
 FROM public.membership_org_assignments a
 WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id;

 IF p_manager_membership_id IS NOT NULL THEN
  IF p_relationship_type='primary' THEN
   UPDATE public.membership_reporting_relationships
   SET ends_at=GREATEST(clock_timestamp(), starts_at + interval '1 microsecond')
   WHERE tenant_id=p_tenant_id AND membership_id=p_membership_id
     AND relationship_type='primary' AND ends_at IS NULL;
  END IF;

  INSERT INTO public.membership_reporting_relationships(
   tenant_id,membership_id,reports_to_membership_id,relationship_type,created_by
  ) VALUES (
   p_tenant_id,p_membership_id,p_manager_membership_id,p_relationship_type,p_actor_user_id
  ) RETURNING id INTO v_reporting_id;

  SELECT to_jsonb(r) INTO v_after_reporting
  FROM public.membership_reporting_relationships r WHERE id=v_reporting_id;
 END IF;

 INSERT INTO public.growta_audit_events(
  tenant_id,actor_user_id,request_id,action,entity_type,entity_id,
  before_data,after_data,metadata
 ) VALUES (
  p_tenant_id,p_actor_user_id,p_request_id,
  CASE WHEN p_manager_membership_id IS NULL
   THEN 'membership.organization_assigned'
   ELSE 'membership.organization_and_reporting_assigned' END,
  'membership',p_membership_id::TEXT,
  jsonb_build_object('assignment',v_before_assignment,'reporting',v_before_reporting),
  jsonb_build_object('assignment',v_after_assignment,'reporting',v_after_reporting),
  jsonb_build_object('relationship_type',p_relationship_type)
 );

 RETURN jsonb_build_object(
  'assignment',v_after_assignment,
  'reporting',v_after_reporting
 );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_tenant_member_org_and_reporting(
 UUID,UUID,TEXT,UUID,UUID,UUID,UUID,TEXT
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_member_org_and_reporting(
 UUID,UUID,TEXT,UUID,UUID,UUID,UUID,TEXT
) TO service_role;

COMMIT;
