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
  selectedTenantId?: string;
  permissions?: string[];
  scopeUnitIds?: string[];
  auditRows?: Array<Record<string, unknown>>;
  availableTenants?: Array<Record<string, unknown>>;
};

function makeSupabase(options: MockOptions = {}) {
  const calls: Array<{
    table: string;
    filters: Record<string, unknown>;
    orderings: Array<{ column: string; ascending: boolean }>;
    limit?: number;
  }> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const {
    tokenValid = true,
    tenantActive = true,
    membershipStatus = "active",
    selectedTenantId = tenantId,
    permissions = ["organization.read"],
    scopeUnitIds = [],
    auditRows = [],
    availableTenants = []
  } = options;

  const admin = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const call = { table, filters, orderings: [] as Array<{ column: string; ascending: boolean }>, limit: undefined as number | undefined };
      calls.push(call);
      const builder: any = {
        select() { return builder; },
        eq(column: string, value: unknown) { filters[column] = value; return builder; },
        neq(column: string, value: unknown) { filters[`not:${column}`] = value; return builder; },
        in(column: string, value: unknown) { filters[column] = value; return builder; },
        order(column: string, options?: { ascending?: boolean }) {
          call.orderings.push({ column, ascending: options?.ascending ?? true });
          return builder;
        },
        range() { return builder; },
        limit(value: number) { call.limit = value; return builder; },
        is(column: string, value: unknown) { filters[column] = value; return builder; },
        or(expression: string) { filters.or = expression; return builder; },
        maybeSingle: async (): Promise<QueryResult> => {
          if (table === "tenants") return { data: { id: selectedTenantId, is_active: tenantActive }, error: null };
          if (table === "memberships") return {
            data: membershipStatus ? { id: membershipId, status: membershipStatus } : null,
            error: null
          };
          if (table === "membership_org_assignments") return { data: null, error: null };
          return { data: null, error: null };
        },
        then(resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
          let data: any[] = [];
          if (table === "memberships") data = availableTenants;
          if (table === "membership_roles") data = [{ role_id: roleId }];
          if (table === "tenant_roles") data = [{ id: roleId, code: "CUSTOM_READER" }];
          if (table === "tenant_role_permissions") data = permissions.map((permission_code) => ({
            role_id: roleId,
            permission_code
          }));
          if (table === "growta_audit_events") data = auditRows;
          return Promise.resolve({ data, error: null, count: table === "org_unit_types" ? 0 : null })
            .then(resolve, reject);
        }
      };
      return builder;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return { data: scopeUnitIds.map((org_unit_id) => ({ org_unit_id })), error: null };
    }
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

  return { supabase, calls, rpcCalls };
}

async function withApp(
  options: MockOptions,
  run: (app: Awaited<ReturnType<typeof buildApp>>, calls: ReturnType<typeof makeSupabase>["calls"], rpcCalls: ReturnType<typeof makeSupabase>["rpcCalls"]) => Promise<void>
) {
  const { supabase, calls, rpcCalls } = makeSupabase(options);
  const app = await buildApp({ config, supabase });
  try {
    await run(app, calls, rpcCalls);
  } finally {
    await app.close();
  }
}

const authHeaders = {
  authorization: "Bearer valid-test-token",
  "x-tenant-id": tenantId
};

test("keeps the health route public when query parameters are present", async () => {
  await withApp({}, async (app, calls) => {
    const response = await app.inject({ method: "GET", url: "/health?probe=1" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.status, "ok");
    assert.equal(calls.length, 0);
  });
});

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

test("tenant discovery requires a valid bearer token but no tenant selector", async (t) => {
  await t.test("missing bearer token", async () => {
    await withApp({}, async (app, calls) => {
      const response = await app.inject({ method: "GET", url: "/api/v1/tenants" });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, "UNAUTHORIZED");
      assert.equal(calls.length, 0);
    });
  });

  await t.test("invalid bearer token", async () => {
    await withApp({ tokenValid: false }, async (app, calls) => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tenants",
        headers: { authorization: "Bearer invalid-token" }
      });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, "INVALID_TOKEN");
      assert.equal(calls.length, 0);
    });
  });
});

test("tenant discovery returns only active memberships and active tenants for the authenticated user", async () => {
  const availableTenants = [{
    tenant_id: tenantId,
    tenants: { id: tenantId, name: "Growta Demo", slug: "growta-demo", is_active: true }
  }];

  await withApp({ availableTenants }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tenants",
      headers: { authorization: "Bearer valid-test-token" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, [{
      id: tenantId,
      name: "Growta Demo",
      slug: "growta-demo"
    }]);

    const membershipQuery = calls.find((call) => call.table === "memberships");
    assert.ok(membershipQuery, "membership discovery query should execute");
    assert.equal(membershipQuery.filters.user_id, userId);
    assert.equal(membershipQuery.filters.status, "active");
    assert.equal(membershipQuery.filters["tenants.is_active"], true);
    assert.equal(membershipQuery.limit, 100);
    assert.equal(membershipQuery.filters.tenant_id, undefined, "discovery must not trust a client-selected tenant");
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


test("denies an authenticated user who has no membership in the selected tenant", async () => {
  const otherTenantId = "a2000000-0000-4000-8000-000000000002";

  await withApp({ selectedTenantId: otherTenantId, membershipStatus: null }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tenants/me",
      headers: {
        authorization: "Bearer valid-test-token",
        "x-tenant-id": otherTenantId
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "TENANT_ACCESS_DENIED");

    const membershipQuery = calls.find((call) => call.table === "memberships");
    assert.ok(membershipQuery, "membership lookup should execute");
    assert.equal(membershipQuery.filters.tenant_id, otherTenantId);
    assert.equal(membershipQuery.filters.user_id, userId);
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


test("organizational unit reads are limited to explicitly assigned scope IDs", async () => {
  const allowedUnitId = "f1000000-0000-4000-8000-000000000001";
  const otherUnitId = "f1000000-0000-4000-8000-000000000002";
  await withApp({ scopeUnitIds: [allowedUnitId] }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organization/units",
      headers: authHeaders
    });
    assert.equal(response.statusCode, 200);
    const query = calls.find((call) => call.table === "org_units");
    assert.ok(query, "organizational unit query should execute");
    assert.equal(query.filters.tenant_id, tenantId);
    assert.deepEqual(query.filters.id, [allowedUnitId]);
    assert.notEqual(query.filters.id, otherUnitId);
  });
});

test("organizational unit reads fail closed when the member has no explicit scope", async () => {
  await withApp({ scopeUnitIds: [] }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organization/units",
      headers: authHeaders
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, []);
    assert.equal(calls.some((call) => call.table === "org_units"), false);
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


test("applies tenant predicates to every tenant-scoped identity and RBAC query", async () => {
  await withApp({}, async (app, calls, rpcCalls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tenants/me",
      headers: authHeaders
    });
    assert.equal(response.statusCode, 200);

    const tenantLookup = calls.find((call) => call.table === "tenants");
    assert.ok(tenantLookup, "selected tenant lookup should execute");
    assert.equal(tenantLookup.filters.id, tenantId, "tenant lookup must use the selected tenant ID");

    const tenantScopedTables = [
      "memberships",
      "membership_roles",
      "tenant_roles",
      "tenant_role_permissions",
      "membership_org_assignments"
    ];

    for (const table of tenantScopedTables) {
      const query = calls.find((call) => call.table === table);
      assert.ok(query, `expected ${table} query to execute`);
      assert.equal(query.filters.tenant_id, tenantId, `${table} must be tenant-filtered`);
    }

    assert.deepEqual(rpcCalls, [{
      name: "resolve_membership_org_unit_scope",
      args: { p_tenant_id: tenantId, p_membership_id: membershipId }
    }]);
  });
});


test("audit event listing is tenant-filtered and returns a bounded keyset page", async () => {
  const firstEvent = {
    id: "f1000000-0000-4000-8000-000000000001",
    created_at: "2026-11-15T10:00:00.000Z",
    actor_user_id: userId,
    request_id: "req-1",
    action: "membership.role.assigned",
    entity_type: "membership",
    entity_id: membershipId,
    before_data: null,
    after_data: { role: "reader" },
    metadata: {}
  };
  const secondEvent = {
    ...firstEvent,
    id: "f1000000-0000-4000-8000-000000000002",
    created_at: "2026-11-15T09:00:00.000Z"
  };

  await withApp({ permissions: ["audit.read"], auditRows: [firstEvent, secondEvent] }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/audit-events?limit=1&entityType=membership",
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.deepEqual(body.data, [firstEvent]);
    assert.equal(typeof body.meta.nextCursor, "string");

    const query = calls.find((call) => call.table === "growta_audit_events");
    assert.ok(query, "audit query should execute");
    assert.equal(query.filters.tenant_id, tenantId);
    assert.equal(query.filters.entity_type, "membership");
    assert.equal(query.limit, 2);
    assert.deepEqual(query.orderings, [
      { column: "created_at", ascending: false },
      { column: "id", ascending: false }
    ]);
  });
});

test("audit event listing applies the composite keyset cursor to the tenant query", async () => {
  const cursor = Buffer.from(JSON.stringify({
    createdAt: "2026-11-15T10:00:00.000Z",
    id: "f1000000-0000-4000-8000-000000000001"
  }), "utf8").toString("base64url");

  await withApp({ permissions: ["audit.read"] }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/audit-events?limit=10&cursor=${encodeURIComponent(cursor)}`,
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.length, 0);
    assert.equal(response.json().meta.nextCursor, null);

    const query = calls.find((call) => call.table === "growta_audit_events");
    assert.ok(query, "audit query should execute");
    assert.equal(query.filters.tenant_id, tenantId);
    assert.equal(
      query.filters.or,
      "created_at.lt.2026-11-15T10:00:00.000Z,and(created_at.eq.2026-11-15T10:00:00.000Z,id.lt.f1000000-0000-4000-8000-000000000001)"
    );
  });
});

test("audit event listing rejects malformed cursors before querying audit data", async () => {
  await withApp({ permissions: ["audit.read"] }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/audit-events?cursor=not-a-valid-cursor",
      headers: authHeaders
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "INVALID_CURSOR");
    assert.equal(calls.some((call) => call.table === "growta_audit_events"), false);
  });
});

test("applies tenant and explicit scope predicates to organization collection endpoints", async () => {
  const allowedUnitId = "f1000000-0000-4000-8000-000000000001";
  await withApp({ scopeUnitIds: [allowedUnitId] }, async (app, calls) => {
    const endpoints = [
      { url: "/api/v1/organization/unit-types", table: "org_unit_types" },
      { url: "/api/v1/organization/units", table: "org_units" },
      { url: "/api/v1/organization/designations", table: "designations" }
    ];

    for (const endpoint of endpoints) {
      const response = await app.inject({
        method: "GET",
        url: endpoint.url,
        headers: authHeaders
      });
      assert.equal(response.statusCode, 200, endpoint.url);
      const query = calls.find((call) => call.table === endpoint.table);
      assert.ok(query, `expected ${endpoint.table} query to execute`);
      assert.equal(query.filters.tenant_id, tenantId, `${endpoint.table} must be tenant-filtered`);
      if (endpoint.table === "org_units") {
        assert.deepEqual(query.filters.id, [allowedUnitId], "org units must be limited to explicit scope");
      }
    }
  });
});


test("authentication hook protects every extracted route plugin", async () => {
  await withApp({}, async (app, calls) => {
    const paths = [
      "/api/v1/tenants",
      "/api/v1/tenants/me",
      "/api/v1/organization/unit-types",
      "/api/v1/organization/units",
      "/api/v1/organization/designations",
      "/api/v1/audit-events"
    ];

    for (const url of paths) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 401, `${url} must require authentication`);
      assert.equal(response.json().error.code, "UNAUTHORIZED", url);
    }
    assert.equal(calls.length, 0, "unauthenticated requests must not query tenant data");
  });
});

test("audit route denies members without audit.read", async () => {
  await withApp({ permissions: ["organization.read"] }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/audit-events",
      headers: authHeaders
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "PERMISSION_DENIED");
    assert.equal(calls.some((call) => call.table === "growta_audit_events"), false);
  });
});


test("accepts the case-insensitive HTTP Bearer authentication scheme", async () => {
  await withApp({}, async (app) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tenants/me",
      headers: {
        authorization: "bearer valid-test-token",
        "x-tenant-id": tenantId
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.tenantId, tenantId);
  });
});


test("organization metadata routes reject tree filters instead of silently ignoring them", async () => {
  await withApp({}, async (app, calls) => {
    for (const url of [
      "/api/v1/organization/unit-types?rootsOnly=true",
      "/api/v1/organization/designations?parentId=a2000000-0000-4000-8000-000000000001"
    ]) {
      const response = await app.inject({ method: "GET", url, headers: authHeaders });
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "INVALID_QUERY", url);
    }

    assert.equal(calls.some((call) => (
      call.table === "org_unit_types" || call.table === "designations"
    )), false, "invalid filters must be rejected before database queries");
  });
});

test("organizational unit route applies the rootsOnly filter", async () => {
  await withApp({ scopeUnitIds: ["f1000000-0000-4000-8000-000000000001"] }, async (app, calls) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organization/units?rootsOnly=true",
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    const query = calls.find((call) => call.table === "org_units");
    assert.ok(query);
    assert.equal(query.filters.parent_id, null);
  });
});
