import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import type { SupabaseClients } from "./platform/supabase.js";
import { parseTenantId, resolveTenantContext, TenantContextError } from "./modules/identity/tenant-context.js";
import { organizationRoutes } from "./modules/organization/organization.routes.js";
import { organizationAdminRoutes } from "./modules/organization/organization-admin.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { tenantRoutes } from "./modules/identity/tenant.routes.js";
import { membershipRoutes } from "./modules/memberships/membership.routes.js";
import { membershipAdminRoutes } from "./modules/memberships/membership-admin.routes.js";
import { roleRoutes } from "./modules/roles/role.routes.js";
import { roleUpdateRoutes } from "./modules/roles/role-update.routes.js";
import { platformAdminRoutes } from "./modules/platform-admin/platform-admin.routes.js";

type Dependencies = { config: AppConfig; supabase: SupabaseClients };

export async function buildApp({ config, supabase }: Dependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.nodeEnv !== "test", trustProxy: false, bodyLimit: 1024 * 1024, genReqId: () => randomUUID() });
  app.decorateRequest("authUser", null);
  app.decorateRequest("tenantContext", null);
  await app.register(cors, { origin: config.corsOrigins, credentials: false });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "Request failed");
    const candidateStatus = typeof error === "object" && error !== null && "statusCode" in error
      ? (error as { statusCode?: unknown }).statusCode : undefined;
    const statusCode = typeof candidateStatus === "number" && candidateStatus >= 400 && candidateStatus < 600 ? candidateStatus : 500;
    const errorMessage = error instanceof Error ? error.message : "Request failed";
    const errorCode = typeof error === "object" && error !== null && "code" in error
      && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code
      : statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
    return reply.code(statusCode).send({
      success: false, error: { code: errorCode, message: statusCode === 500 ? "An unexpected error occurred" : errorMessage, details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });
  });
  app.get("/health", async () => ({ success: true, data: { status: "ok" }, meta: { timestamp: new Date().toISOString(), version: "v1" } }));
  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.url === "/health") return;
    const bearerMatch = request.headers.authorization?.trim().match(/^Bearer\s+(\S+)$/i);
    if (!bearerMatch) return reply.code(401).send({
      success: false, error: { code: "UNAUTHORIZED", message: "A valid Bearer token is required", details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });
    const token = bearerMatch[1];
    if (!token || token.length > 8192) return reply.code(401).send({
      success: false, error: { code: "UNAUTHORIZED", message: "Bearer token is invalid", details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });
    const { data, error } = await supabase.auth.auth.getUser(token);
    if (error || !data.user) return reply.code(401).send({
      success: false, error: { code: "INVALID_TOKEN", message: "Authentication token is invalid or expired", details: [] },
      meta: { requestId: request.id, timestamp: new Date().toISOString() }
    });
    request.authUser = data.user;
    if (request.routeOptions.url === "/api/v1/tenants" || request.routeOptions.url.startsWith("/api/v1/platform/admin/")) return;
    try {
      request.tenantContext = await resolveTenantContext(supabase.admin, data.user, parseTenantId(request.headers["x-tenant-id"]));
    } catch (error) {
      if (error instanceof TenantContextError) return reply.code(error.statusCode).send({
        success: false, error: { code: error.code, message: error.message, details: [] },
        meta: { requestId: request.id, timestamp: new Date().toISOString() }
      });
      throw error;
    }
  });
  await app.register(organizationRoutes, { prefix: "/api/v1/organization", supabase });
  await app.register(organizationAdminRoutes, { prefix: "/api/v1/organization", supabase });
  await app.register(auditRoutes, { prefix: "/api/v1", supabase });
  await app.register(tenantRoutes, { prefix: "/api/v1", supabase });
  await app.register(membershipRoutes, { prefix: "/api/v1", supabase });
  await app.register(membershipAdminRoutes, { prefix: "/api/v1", supabase });
  await app.register(roleRoutes, { prefix: "/api/v1", supabase });
  await app.register(roleUpdateRoutes, { prefix: "/api/v1", supabase });
  await app.register(platformAdminRoutes, { prefix: "/api/v1", supabase });
  return app;
}
