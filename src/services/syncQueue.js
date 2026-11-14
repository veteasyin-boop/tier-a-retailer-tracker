import { idbStorage } from './idbStorage.js';
import { auth } from './auth.js';

const SYNC_INTERVAL_MS = 20000;
const PERMANENT_DATABASE_CODES = new Set(['PGRST204', '23503', '42P01']);

export function getQueueDisposition(item, identity) {
  if (!item?.actorUserId || !item?.tenantId || !item?.operationId) {
    return {
      status: 'identity_required',
      error: {
        code: 'LEGACY_IDENTITY_UNBOUND',
        message: 'This operation predates verified user and tenant binding. It was preserved and must be reconciled manually.'
      }
    };
  }

  if (!identity?.userId || !identity?.tenantId) {
    return {
      status: 'paused_signed_out',
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sign in with the original account and tenant before this operation can be considered for synchronization.'
      }
    };
  }

  if (item.actorUserId !== identity.userId || item.tenantId !== identity.tenantId) {
    return {
      status: 'identity_mismatch',
      error: {
        code: 'QUEUE_IDENTITY_MISMATCH',
        message: 'This operation belongs to a different user or tenant. It will not be rebound automatically.'
      }
    };
  }

  return {
    status: 'awaiting_api_migration',
    error: {
      code: 'API_WRITE_PATH_NOT_AVAILABLE',
      message: 'The tenant-scoped, idempotent write API is not enabled yet. The operation remains stored locally.'
    }
  };
}

export function classifySyncError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  const permanent = PERMANENT_DATABASE_CODES.has(code)
    || message.includes('schema cache')
    || message.includes('foreign key constraint')
    || message.includes('violates foreign key');

  return permanent
    ? { retryable: false, status: 'needs_attention', code: code || 'SCHEMA_OR_CONSTRAINT_ERROR' }
    : { retryable: true, status: 'retry', code: code || 'SYNC_TEMPORARY_ERROR' };
}

class SyncQueueService {
  constructor() {
    this.isProcessing = false;
    this.intervalId = null;
    this.lastSyncTime = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
      window.addEventListener('offline', () => {
        this.notifyStatus();
      });
      window.addEventListener('tracker:authStateChanged', () => {
        this.processQueue();
      });
    }
  }

  start() {
    if (this.intervalId) return;
    this.processQueue();
    this.intervalId = setInterval(() => this.processQueue(), SYNC_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async enqueue(entity, action, payload) {
    if (typeof entity !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(entity)) {
      throw new Error('Invalid queue entity.');
    }
    if (!['upsert', 'delete', 'update'].includes(action)) {
      throw new Error('Invalid queue action.');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Queue payload must be an object.');
    }

    const identity = auth.getSyncIdentity();
    const operationId = crypto.randomUUID();
    const item = await idbStorage.enqueueSyncItem({
      operationId,
      payloadVersion: 1,
      actorUserId: identity?.userId || null,
      tenantId: identity?.tenantId || null,
      entity,
      action,
      payload,
      status: identity ? 'awaiting_api_migration' : 'identity_required'
    });

    await this.notifyStatus();
    return item;
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const items = await idbStorage.getAllSyncItems();
      const identity = auth.getSyncIdentity();
      for (const item of items) {
        if (['needs_attention', 'failed_permanently'].includes(item.status)) continue;
        const disposition = getQueueDisposition(item, identity);
        if (item.status !== disposition.status
          || item.error?.code !== disposition.error.code
          || item.error?.message !== disposition.error.message) {
          await idbStorage.updateSyncItem({
            ...item,
            status: disposition.status,
            error: disposition.error,
            nextRetry: null
          });
        }
      }
    } catch (error) {
      console.error('Unable to inspect offline queue:', error);
    } finally {
      this.isProcessing = false;
      await this.notifyStatus();
    }
  }

  async notifyStatus() {
    const items = await idbStorage.getAllSyncItems();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const statusCounts = items.reduce((counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      return counts;
    }, {});
    const blockedCount = items.filter((item) => item.status !== 'pending' && item.status !== 'synced').length;

    const status = {
      isOnline,
      isSyncing: this.isProcessing,
      pendingCount: items.length,
      blockedCount,
      statusCounts,
      lastSyncTime: this.lastSyncTime,
      syncEnabled: false
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tracker:syncStatus', { detail: status }));
    }
    return status;
  }

  async flushNow() {
    await this.processQueue();
    return {
      success: false,
      code: 'API_WRITE_PATH_NOT_AVAILABLE',
      message: 'Offline operations are preserved. Tenant synchronization will be enabled after transactional API mutations are implemented.'
    };
  }
}

export const syncQueue = new SyncQueueService();
