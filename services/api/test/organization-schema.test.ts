import test from "node:test";
import assert from "node:assert/strict";
import {
  organizationListQuerySchema,
  organizationMetadataListQuerySchema
} from "../src/modules/organization/organization.schemas.js";

test("organization metadata list query applies bounded defaults", () => {
  const parsed = organizationMetadataListQuerySchema.parse({});
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.includeInactive, "false");
});

test("organization metadata list query rejects excessive pagination", () => {
  assert.equal(organizationMetadataListQuerySchema.safeParse({ limit: "101" }).success, false);
  assert.equal(organizationMetadataListQuerySchema.safeParse({ offset: "10001" }).success, false);
});

test("unit types and designations reject unsupported org-tree filters", () => {
  assert.equal(organizationMetadataListQuerySchema.safeParse({
    parentId: "a2000000-0000-4000-8000-000000000001"
  }).success, false);
  assert.equal(organizationMetadataListQuerySchema.safeParse({
    rootsOnly: "true"
  }).success, false);
});

test("organizational unit list accepts valid tree filters", () => {
  assert.equal(organizationListQuerySchema.safeParse({
    parentId: "a2000000-0000-4000-8000-000000000001"
  }).success, true);
  assert.equal(organizationListQuerySchema.safeParse({ rootsOnly: "true" }).success, true);
});

test("organizational unit list rejects ambiguous parent filters", () => {
  assert.equal(organizationListQuerySchema.safeParse({
    parentId: "a2000000-0000-4000-8000-000000000001",
    rootsOnly: "true"
  }).success, false);
});
