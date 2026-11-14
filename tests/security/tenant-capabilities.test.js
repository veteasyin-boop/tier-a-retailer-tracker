import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTenantCapability } from '../../src/services/tenantCapabilities.js';

test('capability requires an explicit permission in the server tenant context', () => {
  const context = { permissions: ['retailer.read', 'visit.checkin'] };
  assert.equal(hasTenantCapability(context, 'field.retailers.read'), true);
  assert.equal(hasTenantCapability(context, 'admin.retailers.reassign'), false);
});

test('unknown capability and missing context fail closed', () => {
  assert.equal(hasTenantCapability(null, 'admin.retailers.read'), false);
  assert.equal(hasTenantCapability({ permissions: [] }, 'not.a.real.capability'), false);
});

test('tenant-defined role labels do not grant permissions', () => {
  const context = { roleCodes: ['TENANT_OWNER'], permissions: [] };
  assert.equal(hasTenantCapability(context, 'admin.retailers.export'), false);
});
