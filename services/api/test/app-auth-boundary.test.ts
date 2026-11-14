import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { SupabaseClients } from "../src/platform/supabase.js";

const tenantId = "a1000000-0000-4000-8000-000000000001";
const userId = "c1000000-0000-4000-8000-000000000001";
const membershipId = "d1000000-0000-4000-8000-000000000001";
const roleId = "e1000000-0000-4000-8000-000000000001";
const user = { id: userId } as User;

const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 4000,
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "test-anon-key",
  supabaseServiceRoleKey: "test-service-role-key",
  corsOrigins: ["http://localhost:3000"]
};

type QueryResult = { data: any; error: null; count?: number | null };

type MockOptions = {
  tokenValid?: boolean;
  tenantActive?: boolean;
  membershipStatus?: string | null;
  permissions?: string[];
};

function makeSupabase(options: MockOptions = {}) {
  const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];
  const {
    tokenValid = true,
    tenantActive = true,
    membershipStatus = "active",
    permissions = ["organization.read"]
  } = options;

  const admin = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const call = { table, filters };
      calls.push(call);
      const builder: any = {
        select() { return builder; },
        eq(column: string, value: unknown) { filters[column] = value; return builder; },
        neq(column: string, value: unknown) { filters[`not:${column}`] = value; return builder; },
        in(column: string, value: unknown) { filters[column] = value; return builder; },
        order() { return builder; },
        range() { return builder; },
        limit() { return builder; },
        is(column: string, value: unknown) { filters[column] = value; return builder; },
        or(expression: string) { filters.or = expression; return builder; },
        maybeSingle: async (): Promise<QueryResult> => {
          if (table === "tenants") return { data: { id: tenantId, is_active: tenantActive }, error: null };
          if (table === "memberships") return {
            data: membershipStatus ? { id: membershipId, status: membershipStatus } : null,
            error: null
          };
          if (table === "membership_org_assignments") return { data: null, error: null };
          return { data: null, error: null };
        },
        then(resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
          let data: any[] = [];
          if (table === "membership_roles") data = [{ role_id: roleId }];
          if (table === "tenant_roles") data = [{ id: roleId, code: "CUSTOM_READER" }];
          if (table === "tenant_role_permissions") data = permissions.map((permission_code) => ({
            role_id: roleId,
            permission_code
          }));
          return Promise.resolve({ data, error: null, count: table === "org_unit_types" ? 0 : null })
            .then(resolve, reject);
        }
      };
      return builder;
    },
    rpc: async () => ({ data: [], error: null })
  };

  const supabase = {
    auth: {
      auth: {
        getUser: async () => tokenValid
          ? { data: { user }, error: null }
          : { data: { user: null }, error: new Error("Invalid token") }
      }
    },
    admin
  } as unknown as SupabaseClients;

  return { supabase, calls };
}

async function withApp(
  options: MockOptions,
  run: (app: Awaited<ReturnType<typeof buildApp>>, calls: ReturnType<typeof makeSupabase>["calls"]) => Promise<void>
) {
  const { supabase, calls } = makeSupabase(options);
  const app = await buildApp({ config, supabase });
  try {
    await run(app, calls);
  } finally {
    await app.close();
  }
}

const authHeaders = {
  authorization: "Bearer valid-test-token",
  "x-tenant-id": tenantId
};

test("rejects requests without a bearer token", async () => {
  await withApp({}, async (app, calls) => {
    const response = await app.inject({ method: "GET", url: "/api/v1/tenants/me" });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, "UNAUTHORIZED");
    assert.equal(calls.length, 0);
  });
});

test("rejects invalid or expired bearer tokens", async () => {
  await withApp({ tokenValid: false }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tenants/me",
      headers: { authorization: "Bearer invalid-token", "x-tenant-id": tenantId }
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, "INVALID_TOKEN");
    assert.equal(calls.length, 0);
  });
});

test("rejects missing and malformed tenant selectors", async (t) => {
  await withApp({}, async (app) => {
    await t.test("missing tenant selector", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tenants/me",
        headers: { authorization: "Bearer valid-test-token" }
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, "INVALID_TENANT_ID");
    });

    await t.test("malformed tenant selector", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tenants/me",
        headers: { authorization: "Bearer valid-test-token", "x-tenant-id": "not-a-uuid" }
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, "INVALID_TENANT_ID");
    });
  });
});

test("rejects inactive tenants and suspended memberships", async (t) => {
  await t.test("inactive tenant", async () => {
    await withApp({ tenantActive: false }, async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/v1/tenants/me", headers: authHeaders });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().error.code, "TENANT_INACTIVE");
    });
  });

  await t.test("suspended membership", async () => {
    await withApp({ membershipStatus: "suspended" }, async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/v1/tenants/me", headers: authHeaders });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().error.code, "TENANT_ACCESS_DENIED");
    });
  });
});

test("denies an authenticated tenant member without the required permission", async () => {
  await withApp({ permissions: [] }, async (app) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organization/unit-types",
      headers: authHeaders
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "PERMISSION_DENIED");
  });
});

test("scopes organization reads to the selected tenant", async () => {
  await withApp({}, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organization/unit-types",
      headers: authHeaders
    });
    assert.equal(response.statusCode, 200);

    const organizationQuery = calls.find((call) => call.table === "org_unit_types");
    assert.ok(organizationQuery, "organization query should execute");
    assert.equal(organizationQuery.filters.tenant_id, tenantId);
  });
});
