/**
 * Explicit Vercel route for the platform-admin session check.
 * Delegate to the shared Fastify serverless adapter so auth and authorization
 * remain centralized in services/api/src/app.ts and platform-admin.routes.ts.
 */
export { default } from "../../../../services/api/api/[...path].js";
