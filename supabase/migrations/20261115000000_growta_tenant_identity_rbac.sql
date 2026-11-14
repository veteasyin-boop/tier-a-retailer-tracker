-- Growta One Phase 1: additive tenant identity and RBAC foundation.
-- Apply to a development database first. This migration does not modify or delete
-- existing tenant, user, role, permission, attendance, or field-operation rows.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL
     OR to_regclass('public.organizations') IS NULL
     OR to_regclass('public.territories') IS NULL
     OR to_regclass('public.roles') IS NULL
     OR to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION
      'Growta Phase 1 requires existing Supabase Auth and public tenants/organizations/territories/roles/permissions/role_permissions tables';
  END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Composite keys let the new tables enforce tenant consistency in every FK.
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_tenant_id_id
  ON public.organizations (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_territories_tenant_id_id
  ON public.territories (tenant_id, id);

CREATE TABLE IF NOT EXISTS public.auth_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'suspended')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_memberships_tenant_user UNIQUE (tenant_id, user_id),
  CONSTRAINT uq_memberships_tenant_id_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.growta_permissions (
  code TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_roles_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_tenant_roles_tenant_id_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.tenant_role_permissions (
  tenant_id UUID NOT NULL,
  role_id UUID NOT NULL,
  permission_code TEXT NOT NULL REFERENCES public.growta_permissions(code) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role_id, permission_code),
  CONSTRAINT fk_trp_tenant_role
    FOREIGN KEY (tenant_id, role_id)
    REFERENCES public.tenant_roles (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.membership_roles (
  tenant_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  role_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, membership_id, role_id),
  CONSTRAINT fk_mr_membership
    FOREIGN KEY (tenant_id, membership_id)
    REFERENCES public.memberships (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_role
    FOREIGN KEY (tenant_id, role_id)
    REFERENCES public.tenant_roles (tenant_id, id) ON DELETE CASCADE
);

-- Scope rows are intentionally limited to entities already present in the
-- approved domain model. SELF scope is implicit in membership ownership.
CREATE TABLE IF NOT EXISTS public.tenant_scope_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  organization_id UUID,
  territory_id UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ck_scope_assignment_exactly_one_target
    CHECK ((organization_id IS NOT NULL)::integer + (territory_id IS NOT NULL)::integer = 1),
  CONSTRAINT fk_tsa_membership
    FOREIGN KEY (tenant_id, membership_id)
    REFERENCES public.memberships (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_tsa_organization
    FOREIGN KEY (tenant_id, organization_id)
    REFERENCES public.organizations (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_tsa_territory
    FOREIGN KEY (tenant_id, territory_id)
    REFERENCES public.territories (tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tsa_membership_organization
  ON public.tenant_scope_assignments (tenant_id, membership_id, organization_id)
  WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tsa_membership_territory
  ON public.tenant_scope_assignments (tenant_id, membership_id, territory_id)
  WHERE territory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_user_status
  ON public.memberships (user_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_status
  ON public.memberships (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_roles_tenant_active
  ON public.tenant_roles (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_trp_permission
  ON public.tenant_role_permissions (permission_code, tenant_id);
CREATE INDEX IF NOT EXISTS idx_membership_roles_role
  ON public.membership_roles (tenant_id, role_id);
CREATE INDEX IF NOT EXISTS idx_tsa_membership
  ON public.tenant_scope_assignments (tenant_id, membership_id);

-- Copy existing global permission and role definitions into tenant-owned
-- catalogues. Existing source catalogues and their rows remain unchanged.
INSERT INTO public.growta_permissions (code, category, description)
SELECT p.id, p.category, p.description
FROM public.permissions AS p
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.tenant_roles (tenant_id, code, name, description, is_system)
SELECT t.id, r.id, r.name, r.description, true
FROM public.tenants AS t
CROSS JOIN public.roles AS r
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.tenant_role_permissions (tenant_id, role_id, permission_code)
SELECT tr.tenant_id, tr.id, gp.code
FROM public.tenant_roles AS tr
JOIN public.role_permissions AS rp ON rp.role_id = tr.code
JOIN public.growta_permissions AS gp ON gp.code = rp.permission_id
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER auth_profiles_set_updated_at
  BEFORE UPDATE ON public.auth_profiles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE FUNCTION private.has_tenant_membership(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    JOIN public.tenants AS t
      ON t.id = m.tenant_id
     AND t.is_active IS TRUE
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION private.has_tenant_permission(
  p_tenant_id UUID,
  p_permission_code TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    JOIN public.tenants AS t
      ON t.id = m.tenant_id
     AND t.is_active IS TRUE
    JOIN public.membership_roles AS mr
      ON mr.tenant_id = m.tenant_id
     AND mr.membership_id = m.id
    JOIN public.tenant_roles AS tr
      ON tr.tenant_id = mr.tenant_id
     AND tr.id = mr.role_id
     AND tr.is_active = true
    JOIN public.tenant_role_permissions AS trp
      ON trp.tenant_id = tr.tenant_id
     AND trp.role_id = tr.id
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND trp.permission_code = p_permission_code
  );
$function$;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_tenant_membership(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_tenant_permission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_tenant_membership(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_tenant_permission(UUID, TEXT) TO authenticated, service_role;

ALTER TABLE public.auth_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growta_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_scope_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_profiles_select_self ON public.auth_profiles;
CREATE POLICY auth_profiles_select_self ON public.auth_profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS auth_profiles_update_self ON public.auth_profiles;
CREATE POLICY auth_profiles_update_self ON public.auth_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS memberships_select_self ON public.memberships;
CREATE POLICY memberships_select_self ON public.memberships
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS growta_permissions_select_authenticated ON public.growta_permissions;
CREATE POLICY growta_permissions_select_authenticated ON public.growta_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS tenant_roles_select_member ON public.tenant_roles;
CREATE POLICY tenant_roles_select_member ON public.tenant_roles
  FOR SELECT TO authenticated
  USING (private.has_tenant_membership(tenant_id));

DROP POLICY IF EXISTS tenant_role_permissions_select_member ON public.tenant_role_permissions;
CREATE POLICY tenant_role_permissions_select_member ON public.tenant_role_permissions
  FOR SELECT TO authenticated
  USING (private.has_tenant_membership(tenant_id));

DROP POLICY IF EXISTS membership_roles_select_self ON public.membership_roles;
CREATE POLICY membership_roles_select_self ON public.membership_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.tenant_id = membership_roles.tenant_id
        AND m.id = membership_roles.membership_id
        AND m.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS tenant_scope_assignments_select_self ON public.tenant_scope_assignments;
CREATE POLICY tenant_scope_assignments_select_self ON public.tenant_scope_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships AS m
      WHERE m.tenant_id = tenant_scope_assignments.tenant_id
        AND m.id = tenant_scope_assignments.membership_id
        AND m.user_id = (SELECT auth.uid())
    )
  );

-- Explicit grants: browser clients can read their own identity context and
-- catalogue data, but cannot create memberships or grant themselves roles/scopes.
REVOKE ALL ON TABLE
  public.auth_profiles,
  public.memberships,
  public.growta_permissions,
  public.tenant_roles,
  public.tenant_role_permissions,
  public.membership_roles,
  public.tenant_scope_assignments
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.auth_profiles,
  public.memberships,
  public.growta_permissions,
  public.tenant_roles,
  public.tenant_role_permissions,
  public.membership_roles,
  public.tenant_scope_assignments
TO authenticated;

GRANT UPDATE (full_name, avatar_url)
  ON public.auth_profiles TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.auth_profiles,
  public.memberships,
  public.growta_permissions,
  public.tenant_roles,
  public.tenant_role_permissions,
  public.membership_roles,
  public.tenant_scope_assignments
TO service_role;

COMMIT;
