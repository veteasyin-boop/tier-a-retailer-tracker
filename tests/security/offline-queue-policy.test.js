import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySyncError, getQueueDisposition } from '../../src/services/syncQueue.js';

const boundItem = {
  operationId: 'b1000000-0000-4000-8000-000000000001',
  actorUserId: 'c1000000-0000-4000-8000-000000000001',
  tenantId: 'a1000000-0000-4000-8000-000000000001'
};
const matchingIdentity = {
  userId: boundItem.actorUserId,
  tenantId: boundItem.tenantId
};

test('legacy queue records without verified identity are quarantined', () => {
  const result = getQueueDisposition({ ...boundItem, operationId: undefined }, matchingIdentity);
  assert.equal(result.status, 'identity_required');
  assert.equal(result.error.code, 'LEGACY_IDENTITY_UNBOUND');
});

test('bound queue records pause when signed out', () => {
  const result = getQueueDisposition(boundItem, null);
  assert.equal(result.status, 'paused_signed_out');
});

test('account or tenant switch never rebinds an offline operation', () => {
  const result = getQueueDisposition(boundItem, {
    userId: 'd1000000-0000-4000-8000-000000000001',
    tenantId: boundItem.tenantId
  });
  assert.equal(result.status, 'identity_mismatch');
  assert.equal(result.error.code, 'QUEUE_IDENTITY_MISMATCH');
});

test('matching identity remains held until transactional tenant write API exists', () => {
  const result = getQueueDisposition(boundItem, matchingIdentity);
  assert.equal(result.status, 'awaiting_api_migration');
  assert.equal(result.error.code, 'API_WRITE_PATH_NOT_AVAILABLE');
});

test('schema and foreign-key errors require operator attention and are not success', () => {
  for (const code of ['PGRST204', '23503', '42P01']) {
    const result = classifySyncError({ code, message: 'database rejected the operation' });
    assert.equal(result.retryable, false);
    assert.equal(result.status, 'needs_attention');
  }
});

test('transient errors remain retryable', () => {
  const result = classifySyncError({ code: 'ECONNRESET', message: 'connection reset' });
  assert.equal(result.retryable, true);
  assert.equal(result.status, 'retry');
});
