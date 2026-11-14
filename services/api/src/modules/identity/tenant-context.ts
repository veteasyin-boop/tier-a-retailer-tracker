import type { SupabaseClient, User } from "@supabase/supabase-js";

export class TenantContextError extends Error {
  constructor(
    public readonly statusCode: 400 | 401 | 403 | 500,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "TenantContextError";
  }
}

export type TenantContext = {
  tenantId: string;
  userId: string;
  membershipId: string;
  roleCodes: string[];
  permissions: string[];
  primaryOrgUnit: { id: string; code: string; name: string; parentId: string | null } | null;
  designation: { id: string; code: string; name: string } | null;
  scopedOrgUnitIds: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseTenantId(value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new TenantContextError(400, "INVALID_TENANT_ID", "X-Tenant-ID must be a valid UUID");
  }
  return value;
}

export async function resolveTenantContext(
  admin: SupabaseClient,
  user: User,
  tenantId: string
): Promise<TenantContext> {
  const tenantResult = await admin
    .from("tenants")
    .select("id,is_active")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantResult.error) {
    throw new TenantContextError(500, "TENANT_LOOKUP_FAILED", "Unable to resolve tenant");
  }
  if (!tenantResult.data || tenantResult.data.is_active !== true) {
    throw new TenantContextError(403, "TENANT_INACTIVE", "Tenant is inactive or unavailable");
  }

  const membershipResult = await admin
    .from("memberships")
    .select("id,status")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipResult.error) {
    throw new TenantContextError(500, "TENANT_LOOKUP_FAILED", "Unable to resolve tenant membership");
  }
  if (!membershipResult.data || membershipResult.data.status !== "active") {
    throw new TenantContextError(403, "TENANT_ACCESS_DENIED", "No active membership exists for this tenant");
  }

  const membershipId = membershipResult.data.id as string;
  const rolesResult = await admin
    .from("membership_roles")
    .select("role_id")
    .eq("tenant_id", tenantId)
    .eq("membership_id", membershipId);

  if (rolesResult.error) {
    throw new TenantContextError(500, "ROLE_LOOKUP_FAILED", "Unable to resolve tenant roles");
  }

  const roleIds = [...new Set((rolesResult.data ?? []).map((row) => row.role_id as string))];
  let roleCodes: string[] = [];
  let permissions: string[] = [];

  if (roleIds.length > 0) {
    const [rolesResult2, permissionResult] = await Promise.all([
      admin.from("tenant_roles").select("id,code").eq("tenant_id", tenantId).eq("is_active", true).neq("code", "SUPER_ADMIN").in("id", roleIds),
      admin.from("tenant_role_permissions").select("permission_code,role_id").eq("tenant_id", tenantId).in("role_id", roleIds)
    ]);
    if (rolesResult2.error || permissionResult.error) {
      throw new TenantContextError(500, "AUTHORIZATION_LOOKUP_FAILED", "Unable to resolve tenant permissions");
    }
    const activeRoleIds = new Set((rolesResult2.data ?? []).map((row) => row.id as string));
    roleCodes = (rolesResult2.data ?? []).map((row) => row.code as string);
    permissions = [...new Set((permissionResult.data ?? [])
      .filter((row) => activeRoleIds.has(row.role_id as string))
      .map((row) => row.permission_code as string))];
  }

  const [placementResult, scopesResult] = await Promise.all([
    admin.from("membership_org_assignments")
      .select("org_unit_id,designation_id,org_units(id,code,name,parent_id),designations(id,code,name)")
      .eq("tenant_id", tenantId).eq("membership_id", membershipId).maybeSingle(),
    admin.rpc("resolve_membership_org_unit_scope", {
      p_tenant_id: tenantId,
      p_membership_id: membershipId
    })
  ]);

  if (placementResult.error || scopesResult.error) {
    throw new TenantContextError(500, "ORG_CONTEXT_LOOKUP_FAILED", "Unable to resolve organizational context");
  }

  const placement = placementResult.data as {
    org_units?: { id: string; code: string; name: string; parent_id: string | null } | null;
    designations?: { id: string; code: string; name: string } | null;
  } | null;

  const scopeRows = (scopesResult.data ?? []) as { org_unit_id: string }[];
  const scopedOrgUnitIds: string[] = [...new Set(scopeRows.map((row) => row.org_unit_id))].sort();

  return {
    tenantId,
    userId: user.id,
    membershipId,
    roleCodes,
    permissions,
    primaryOrgUnit: placement?.org_units ? {
      id: placement.org_units.id,
      code: placement.org_units.code,
      name: placement.org_units.name,
      parentId: placement.org_units.parent_id
    } : null,
    designation: placement?.designations ?? null,
    scopedOrgUnitIds
  };
}
