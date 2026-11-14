import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  resolveTenantContext,
  TenantContextError
} from "../src/modules/identity/tenant-context.js";

type Result = { data: unknown; error: null };

function fakeAdmin(responses: Record<string, unknown>, rpcData: unknown = []): SupabaseClient {
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { filters[column] = value; return builder; },
        neq(column: string, value: unknown) { filters[`not:${column}`] = value; return builder; },
        in(column: string, value: unknown) { filters[column] = value; return builder; },
        async maybeSingle() {
          const value = responses[table];
          return { data: value ?? null, error: null } satisfies Result;
        },
        then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: responses[table] ?? [], error: null } satisfies Result).then(resolve, reject);
        }
      };
      return builder;
    },
    rpc() {
      return Promise.resolve({ data: rpcData, error: null });
    }
  };
  return client as unknown as SupabaseClient;
}

const tenantId = "a1000000-0000-4000-8000-000000000001";
const user = { id: "c1000000-0000-4000-8000-000000000001" } as User;

test("rejects an inactive tenant before resolving membership", async () => {
  const admin = fakeAdmin({ tenants: { id: tenantId, is_active: false } });
  await assert.rejects(
    resolveTenantContext(admin, user, tenantId),
    (error: unknown) => error instanceof TenantContextError && error.code === "TENANT_INACTIVE"
  );
});

test("rejects suspended memberships", async () => {
  const admin = fakeAdmin({
    tenants: { id: tenantId, is_active: true },
    memberships: { id: "d1000000-0000-4000-8000-000000000001", status: "suspended" }
  });
  await assert.rejects(
    resolveTenantContext(admin, user, tenantId),
    (error: unknown) => error instanceof TenantContextError && error.code === "TENANT_ACCESS_DENIED"
  );
});

test("does not resolve roles or scopes when no active membership exists", async () => {
  const admin = fakeAdmin({
    tenants: { id: tenantId, is_active: true },
    memberships: null
  });
  await assert.rejects(
    resolveTenantContext(admin, user, tenantId),
    (error: unknown) => error instanceof TenantContextError && error.statusCode === 403
  );
});

test("excludes inactive and platform-only roles from effective permissions", async () => {
  const admin = fakeAdmin({
    tenants: { id: tenantId, is_active: true },
    memberships: { id: "d1000000-0000-4000-8000-000000000001", status: "active" },
    membership_roles: [
      { role_id: "e1000000-0000-4000-8000-000000000001" },
      { role_id: "e1000000-0000-4000-8000-000000000002" }
    ],
    tenant_roles: [
      { id: "e1000000-0000-4000-8000-000000000001", code: "CUSTOM_READER" }
    ],
    tenant_role_permissions: [
      { role_id: "e1000000-0000-4000-8000-000000000001", permission_code: "organization.read" },
      { role_id: "e1000000-0000-4000-8000-000000000002", permission_code: "role.manage" }
    ],
    membership_org_assignments: null
  }, []);

  const context = await resolveTenantContext(admin, user, tenantId);
  assert.deepEqual(context.roleCodes, ["CUSTOM_READER"]);
  assert.deepEqual(context.permissions, ["organization.read"]);
  assert.deepEqual(context.scopedOrgUnitIds, []);
});
