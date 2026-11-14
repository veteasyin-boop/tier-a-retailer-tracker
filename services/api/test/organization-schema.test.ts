import test from "node:test";
import assert from "node:assert/strict";
import { organizationListQuerySchema } from "../src/modules/organization/organization.schemas.js";

test("organization list query applies bounded defaults", () => {
  const parsed = organizationListQuerySchema.parse({});
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.includeInactive, "false");
});

test("organization list query rejects excessive pagination", () => {
  assert.equal(organizationListQuerySchema.safeParse({ limit: "101" }).success, false);
  assert.equal(organizationListQuerySchema.safeParse({ offset: "10001" }).success, false);
});

test("organization list query rejects ambiguous parent filters", () => {
  assert.equal(organizationListQuerySchema.safeParse({
    parentId: "a2000000-0000-4000-8000-000000000001",
    rootsOnly: "true"
  }).success, false);
});
