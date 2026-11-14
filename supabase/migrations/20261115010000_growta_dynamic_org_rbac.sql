-- Growta One Phase 2: tenant-configurable organization structures and
-- membership placement, reporting, and additional data scopes.
-- Additive only. Existing organizations, territories, memberships, and role
-- assignments remain intact; no legacy rows are auto-mapped.

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_unit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_unit_types_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_org_unit_types_tenant_id_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.org_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_type_id UUID NOT NULL,
  parent_id UUID,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_units_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_org_units_tenant_id_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_org_units_type FOREIGN KEY (tenant_id, unit_type_id)
    REFERENCES public.org_unit_types (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_org_units_parent FOREIGN KEY (tenant_id, parent_id)
    REFERENCES public.org_units (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT ck_org_units_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE IF NOT EXISTS public.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_designations_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_designations_tenant_id_id UNIQUE (tenant_id, id)
);

-- One primary organizational placement per membership. Designation is
-- descriptive metadata and does not grant permissions.
CREATE TABLE IF NOT EXISTS public.membership_org_assignments (
  tenant_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  designation_id UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, membership_id),
  CONSTRAINT fk_moa_membership FOREIGN KEY (tenant_id, membership_id)
    REFERENCES public.memberships (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_moa_org_unit FOREIGN KEY (tenant_id, org_unit_id)
    REFERENCES public.org_units (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_moa_designation FOREIGN KEY (tenant_id, designation_id)
    REFERENCES public.designations (tenant_id, id) ON DELETE RESTRICT
);

-- Additional scopes are distinct from primary organizational placement.
-- include_descendants is enforced by the backend's scope resolver.
CREATE TABLE IF NOT EXISTS public.membership_org_unit_scopes (
  tenant_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  org_unit_id UUID NOT NULL,
  include_descendants BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, membership_id, org_unit_id),
  CONSTRAINT fk_mous_membership FOREIGN KEY (tenant_id, membership_id)
    REFERENCES public.memberships (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mous_org_unit FOREIGN KEY (tenant_id, org_unit_id)
    REFERENCES public.org_units (tenant_id, id) ON DELETE CASCADE
);

-- Primary reporting is acyclic and permits one active manager per subordinate.
-- Dotted-line relationships do not imply inherited authorization.
CREATE TABLE IF NOT EXISTS public.membership_reporting_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  reports_to_membership_id UUID NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'primary'
    CHECK (relationship_type IN ('primary', 'dotted')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ck_reporting_not_self CHECK (membership_id <> reports_to_membership_id),
  CONSTRAINT ck_reporting_dates CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT fk_mrr_member FOREIGN KEY (tenant_id, membership_id)
    REFERENCES public.memberships (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_mrr_manager FOREIGN KEY (tenant_id, reports_to_membership_id)
    REFERENCES public.memberships (tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mrr_active_primary_manager
  ON public.membership_reporting_relationships (tenant_id, membership_id)
  WHERE relationship_type = 'primary' AND ends_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_units_parent
  ON public.org_units (tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_org_units_type
  ON public.org_units (tenant_id, unit_type_id, is_active);
CREATE INDEX IF NOT EXISTS idx_moa_org_unit
  ON public.membership_org_assignments (tenant_id, org_unit_id);
CREATE INDEX IF NOT EXISTS idx_mous_org_unit
  ON public.membership_org_unit_scopes (tenant_id, org_unit_id);
CREATE INDEX IF NOT EXISTS idx_mrr_manager
  ON public.membership_reporting_relationships (tenant_id, reports_to_membership_id)
  WHERE ends_at IS NULL;

-- Permission definitions are available for tenant role configuration but are
-- not automatically granted to any role.
INSERT INTO public.growta_permissions (code, category, description) VALUES
  ('organization.read', 'Organization', 'View tenant organizational structure'),
  ('organization.manage', 'Organization', 'Create and manage organizational unit types and units'),
  ('designation.manage', 'Organization', 'Create and manage tenant designations'),
  ('membership.read', 'Identity', 'View tenant member directory and assignments'),
  ('membership.manage', 'Identity', 'Invite, activate, suspend, and manage tenant memberships'),
  ('reporting.manage', 'Identity', 'Manage primary and dotted-line reporting relationships'),
  ('scope.assign', 'Authorization', 'Assign additional organizational data scopes'),
  ('role.manage', 'Authorization', 'Manage tenant roles and permission assignments'),
  ('audit.read', 'Security', 'Read tenant audit records')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS org_units_set_updated_at ON public.org_units;
CREATE TRIGGER org_units_set_updated_at
  BEFORE UPDATE ON public.org_units
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Serialize hierarchy mutations per tenant so concurrent parent edits cannot
-- create a cycle that each transaction would otherwise miss.
CREATE OR REPLACE FUNCTION private.prevent_org_unit_cycle()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $function$
DECLARE v_cycle BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text, 0));
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;

  WITH RECURSIVE ancestors(id, parent_id) AS (
    SELECT u.id, u.parent_id FROM public.org_units AS u
    WHERE u.tenant_id = NEW.tenant_id AND u.id = NEW.parent_id
    UNION ALL
    SELECT p.id, p.parent_id FROM public.org_units AS p
    JOIN ancestors AS a ON p.id = a.parent_id
    WHERE p.tenant_id = NEW.tenant_id
  )
  SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO v_cycle;

  IF v_cycle THEN
    RAISE EXCEPTION 'Organizational unit hierarchy cannot contain a cycle'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS org_units_prevent_cycle ON public.org_units;
CREATE TRIGGER org_units_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_id, tenant_id ON public.org_units
  FOR EACH ROW EXECUTE FUNCTION private.prevent_org_unit_cycle();

CREATE OR REPLACE FUNCTION private.prevent_reporting_cycle()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $function$
DECLARE v_cycle BOOLEAN;
BEGIN
  IF NEW.relationship_type <> 'primary' OR NEW.ends_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text, 0));

  WITH RECURSIVE manager_chain(membership_id) AS (
    SELECT NEW.reports_to_membership_id
    UNION
    SELECT r.reports_to_membership_id
    FROM public.membership_reporting_relationships AS r
    JOIN manager_chain AS c ON r.membership_id = c.membership_id
    WHERE r.tenant_id = NEW.tenant_id
      AND r.relationship_type = 'primary'
      AND r.ends_at IS NULL
      AND r.id IS DISTINCT FROM NEW.id
  )
  SELECT EXISTS (SELECT 1 FROM manager_chain WHERE membership_id = NEW.membership_id)
  INTO v_cycle;

  IF v_cycle THEN
    RAISE EXCEPTION 'Primary reporting relationships cannot contain a cycle'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS membership_reporting_prevent_cycle
  ON public.membership_reporting_relationships;
CREATE TRIGGER membership_reporting_prevent_cycle
  BEFORE INSERT OR UPDATE OF tenant_id, membership_id, reports_to_membership_id,
    relationship_type, ends_at
  ON public.membership_reporting_relationships
  FOR EACH ROW EXECUTE FUNCTION private.prevent_reporting_cycle();

ALTER TABLE public.org_unit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_org_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_org_unit_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_reporting_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_unit_types_select_member ON public.org_unit_types;
CREATE POLICY org_unit_types_select_member ON public.org_unit_types
  FOR SELECT TO authenticated USING (private.has_tenant_membership(tenant_id));
DROP POLICY IF EXISTS org_units_select_member ON public.org_units;
CREATE POLICY org_units_select_member ON public.org_units
  FOR SELECT TO authenticated USING (private.has_tenant_membership(tenant_id));
DROP POLICY IF EXISTS designations_select_member ON public.designations;
CREATE POLICY designations_select_member ON public.designations
  FOR SELECT TO authenticated USING (private.has_tenant_membership(tenant_id));

DROP POLICY IF EXISTS membership_org_assignments_select_self_or_admin
  ON public.membership_org_assignments;
CREATE POLICY membership_org_assignments_select_self_or_admin
  ON public.membership_org_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships AS m
      WHERE m.tenant_id = membership_org_assignments.tenant_id
        AND m.id = membership_org_assignments.membership_id
        AND m.user_id = (SELECT auth.uid()))
    OR private.has_tenant_permission(tenant_id, 'membership.read')
  );

DROP POLICY IF EXISTS membership_org_unit_scopes_select_self_or_admin
  ON public.membership_org_unit_scopes;
CREATE POLICY membership_org_unit_scopes_select_self_or_admin
  ON public.membership_org_unit_scopes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships AS m
      WHERE m.tenant_id = membership_org_unit_scopes.tenant_id
        AND m.id = membership_org_unit_scopes.membership_id
        AND m.user_id = (SELECT auth.uid()))
    OR private.has_tenant_permission(tenant_id, 'scope.assign')
  );

DROP POLICY IF EXISTS membership_reporting_select_participant_or_admin
  ON public.membership_reporting_relationships;
CREATE POLICY membership_reporting_select_participant_or_admin
  ON public.membership_reporting_relationships FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships AS m
      WHERE m.tenant_id = membership_reporting_relationships.tenant_id
        AND m.id IN (membership_reporting_relationships.membership_id,
                     membership_reporting_relationships.reports_to_membership_id)
        AND m.user_id = (SELECT auth.uid()))
    OR private.has_tenant_permission(tenant_id, 'membership.read')
  );

REVOKE ALL ON TABLE public.org_unit_types, public.org_units, public.designations,
  public.membership_org_assignments, public.membership_org_unit_scopes,
  public.membership_reporting_relationships FROM anon, authenticated;
GRANT SELECT ON TABLE public.org_unit_types, public.org_units, public.designations,
  public.membership_org_assignments, public.membership_org_unit_scopes,
  public.membership_reporting_relationships TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.org_unit_types, public.org_units,
  public.designations, public.membership_org_assignments,
  public.membership_org_unit_scopes, public.membership_reporting_relationships
  TO service_role;

REVOKE ALL ON FUNCTION private.prevent_org_unit_cycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_reporting_cycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC, anon, authenticated;

COMMIT;
