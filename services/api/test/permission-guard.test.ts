import test from "node:test";
import assert from "node:assert/strict";
import { requirePermission, PermissionDeniedError } from "../src/modules/authorization/require-permission.js";
import type { TenantContext } from "../src/modules/identity/tenant-context.js";

const context: TenantContext = {
  tenantId: "tenant-1",
  userId: "user-1",
  membershipId: "membership-1",
  roleCodes: ["TENANT_OWNER"],
  permissions: ["audit.read", "organization.read"],
  primaryOrgUnit: null,
  designation: null,
  scopedOrgUnitIds: []
};

test("allows only explicitly granted tenant permissions", () => {
  assert.equal(requirePermission(context, "audit.read"), context);
});

test("denies permissions absent from tenant role grants", () => {
  assert.throws(() => requirePermission(context, "role.manage"), PermissionDeniedError);
});

test("denies missing tenant context", () => {
  assert.throws(() => requirePermission(null, "audit.read"), /Tenant context is required/);
});
