import type { FastifyPluginAsync } from "fastify";
import type { SupabaseClients } from "../../platform/supabase.js";
import { requirePermission } from "../authorization/require-permission.js";
import { membershipListQuerySchema } from "./membership.schemas.js";

type RouteOptions = { supabase: SupabaseClients };

type MembershipRow = {
  id: string;
  user_id: string;
  status: "invited" | "active" | "suspended";
  created_at: string;
  updated_at: string;
};

type ProfileRow = { user_id: string; full_name: string | null; avatar_url: string | null };
type RoleRow = {
  membership_id: string;
  role_id: string;
  tenant_roles: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
};
type AssignmentRow = {
  membership_id: string;
  org_unit_id: string;
  designation_id: string | null;
  org_units: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
  designations: { id: string; code: string; name: string } | { id: string; code: string; name: string }[] | null;
};
type ReportingRow = { membership_id: string; reports_to_membership_id: string; relationship_type: "primary" | "dotted" };

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export const membershipRoutes: FastifyPluginAsync<RouteOptions> = async (app, { supabase }) => {
  app.get("/memberships", {
    preHandler: async (request) => { requirePermission(request.tenantContext, "membership.read"); }
  }, async (request, reply) => {
    const parsed = membershipListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: { code: "INVALID_QUERY", message: "Membership query parameters are invalid", details: parsed.error.issues },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const context = request.tenantContext;
    if (!context) {
      return reply.code(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Tenant context is required", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    let query = supabase.admin.from("memberships")
      .select("id,user_id,status,created_at,updated_at", { count: "exact" })
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (parsed.data.status) query = query.eq("status", parsed.data.status);

    const { data, count, error } = await query;
    if (error) {
      request.log.error({ err: error, tenantId: context.tenantId }, "Membership directory query failed");
      return reply.code(500).send({
        success: false,
        error: { code: "MEMBERSHIP_QUERY_FAILED", message: "Unable to retrieve tenant memberships", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const memberships = (data ?? []) as MembershipRow[];
    const membershipIds = memberships.map((row) => row.id);
    const userIds = [...new Set(memberships.map((row) => row.user_id))];
    if (membershipIds.length === 0) {
      return {
        success: true,
        data: [],
        meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1", limit: parsed.data.limit, offset: parsed.data.offset, total: count ?? 0 }
      };
    }

    const [profilesResult, rolesResult, assignmentsResult, reportingResult] = await Promise.all([
      supabase.admin.from("auth_profiles").select("user_id,full_name,avatar_url").in("user_id", userIds),
      supabase.admin.from("membership_roles").select("membership_id,role_id,tenant_roles(id,code,name)")
        .eq("tenant_id", context.tenantId).in("membership_id", membershipIds),
      supabase.admin.from("membership_org_assignments")
        .select("membership_id,org_unit_id,designation_id,org_units(id,code,name),designations(id,code,name)")
        .eq("tenant_id", context.tenantId).in("membership_id", membershipIds),
      supabase.admin.from("membership_reporting_relationships")
        .select("membership_id,reports_to_membership_id,relationship_type")
        .eq("tenant_id", context.tenantId).is("ends_at", null).in("membership_id", membershipIds)
    ]);

    const relatedError = profilesResult.error || rolesResult.error || assignmentsResult.error || reportingResult.error;
    if (relatedError) {
      request.log.error({ err: relatedError, tenantId: context.tenantId }, "Membership directory enrichment failed");
      return reply.code(500).send({
        success: false,
        error: { code: "MEMBERSHIP_QUERY_FAILED", message: "Unable to retrieve membership details", details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
    }

    const profiles = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.user_id, row]));
    const rolesByMembership = new Map<string, { id: string; code: string; name: string }[]>();
    for (const row of (rolesResult.data ?? []) as unknown as RoleRow[]) {
      const role = one(row.tenant_roles);
      if (!role) continue;
      const existing = rolesByMembership.get(row.membership_id) ?? [];
      existing.push(role);
      rolesByMembership.set(row.membership_id, existing);
    }

    const assignmentByMembership = new Map<string, AssignmentRow>();
    for (const row of (assignmentsResult.data ?? []) as unknown as AssignmentRow[]) {
      assignmentByMembership.set(row.membership_id, row);
    }
    const reportingByMembership = new Map<string, ReportingRow[]>();
    for (const row of (reportingResult.data ?? []) as ReportingRow[]) {
      const existing = reportingByMembership.get(row.membership_id) ?? [];
      existing.push(row);
      reportingByMembership.set(row.membership_id, existing);
    }

    const result = memberships.map((membership) => {
      const profile = profiles.get(membership.user_id);
      const assignment = assignmentByMembership.get(membership.id);
      return {
        id: membership.id,
        userId: membership.user_id,
        status: membership.status,
        createdAt: membership.created_at,
        updatedAt: membership.updated_at,
        profile: profile ? { fullName: profile.full_name, avatarUrl: profile.avatar_url } : null,
        roles: rolesByMembership.get(membership.id) ?? [],
        organization: assignment ? {
          unit: one(assignment.org_units),
          designation: one(assignment.designations)
        } : null,
        reporting: reportingByMembership.get(membership.id) ?? []
      };
    });

    return {
      success: true,
      data: result,
      meta: { requestId: request.id, timestamp: new Date().toISOString(), version: "v1", limit: parsed.data.limit, offset: parsed.data.offset, total: count ?? 0 }
    };
  });
};
