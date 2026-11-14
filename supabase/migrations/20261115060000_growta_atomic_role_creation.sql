-- Atomic tenant role creation with permission assignment and audit event.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_tenant_role_with_permissions(
  p_tenant_id UUID,
  p_actor_user_id UUID,
  p_request_id TEXT,
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_permission_codes TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role_id UUID;
  v_permissions TEXT[];
  v_before JSONB := NULL;
  v_after JSONB;
BEGIN
  IF p_tenant_id IS NULL OR p_actor_user_id IS NULL
     OR p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid role creation context' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.membership_roles mr
      ON mr.tenant_id = m.tenant_id AND mr.membership_id = m.id
    JOIN public.tenant_roles tr
      ON tr.tenant_id = mr.tenant_id AND tr.id = mr.role_id
      AND tr.is_active = true AND tr.code <> 'SUPER_ADMIN'
    JOIN public.tenant_role_permissions trp
      ON trp.tenant_id = tr.tenant_id AND trp.role_id = tr.id
      AND trp.permission_code = 'role.manage'
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id = p_actor_user_id
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Role management permission is required' USING ERRCODE = '42501';
  END IF;

  IF p_code IS NULL OR p_code !~ '^[A-Z][A-Z0-9_]{1,49}$'
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 100
     OR (p_description IS NOT NULL AND length(p_description) > 500) THEN
    RAISE EXCEPTION 'Invalid role fields' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT code ORDER BY code), ARRAY[]::TEXT[])
    INTO v_permissions
  FROM unnest(COALESCE(p_permission_codes, ARRAY[]::TEXT[])) AS code;

  IF cardinality(v_permissions) > 200 THEN
    RAISE EXCEPTION 'Too many permissions requested' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_permissions) requested(code)
    LEFT JOIN public.growta_permissions gp ON gp.code = requested.code
    WHERE gp.code IS NULL
  ) THEN
    RAISE EXCEPTION 'Unknown permission code' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tenant_roles (tenant_id, code, name, description, is_system, is_active)
  VALUES (p_tenant_id, p_code, btrim(p_name), NULLIF(btrim(p_description), ''), false, true)
  RETURNING id INTO v_role_id;

  INSERT INTO public.tenant_role_permissions (tenant_id, role_id, permission_code)
  SELECT p_tenant_id, v_role_id, permission_code
  FROM unnest(v_permissions) AS permission_code;

  SELECT jsonb_build_object(
    'id', tr.id, 'tenant_id', tr.tenant_id, 'code', tr.code,
    'name', tr.name, 'description', tr.description,
    'is_system', tr.is_system, 'is_active', tr.is_active,
    'permissions', to_jsonb(v_permissions)
  )
  INTO v_after
  FROM public.tenant_roles tr
  WHERE tr.id = v_role_id AND tr.tenant_id = p_tenant_id;

  INSERT INTO public.growta_audit_events (
    tenant_id, actor_user_id, request_id, action, entity_type, entity_id,
    before_data, after_data, metadata
  ) VALUES (
    p_tenant_id, p_actor_user_id, p_request_id, 'role.created', 'tenant_role',
    v_role_id::TEXT, v_before, v_after, jsonb_build_object('permission_count', cardinality(v_permissions))
  );

  RETURN v_after;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_tenant_role_with_permissions(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_role_with_permissions(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT[])
  TO service_role;

COMMIT;
