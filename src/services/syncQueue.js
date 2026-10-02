// =========================================================================
// OPTIMISTIC SYNC QUEUE WITH EXPONENTIAL BACKOFF
// Ensures zero data loss during field disconnected operations in rural Bihar
// Automatically syncs to Supabase PostgreSQL when internet connectivity resumes
// =========================================================================

import { idbStorage } from './idbStorage.js';
import { supabaseService } from './supabase.js';

const SYNC_INTERVAL_MS = 20000; // 20s routine poll
const MAX_BACKOFF_MS = 60000;   // 60s max retry cap
const BASE_BACKOFF_MS = 1500;   // 1.5s base backoff
const MAX_ATTEMPTS = 10;        // Max retry attempts before manual intervention

class SyncQueueService {
  constructor() {
    this.isProcessing = false;
    this.intervalId = null;
    this.lastSyncTime = null;
    this.listeners = new Set();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('📡 Network online detected: initiating immediate sync flush…');
        this.processQueue();
      });

      window.addEventListener('offline', () => {
        console.log('📴 Network offline detected: sync operations will queue in IndexedDB.');
        this.notifyStatus();
      });
    }
  }

  /**
   * Initializes queue processing timer
   */
  start() {
    if (this.intervalId) return;
    this.processQueue();
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Stops queue timer
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Optimistically enqueues a mutation to be synchronized with Supabase
   * @param {string} entity - Supabase table name
   * @param {string} action - 'upsert' | 'delete' | 'update'
   * @param {Object} payload - Data payload
   */
  async enqueue(entity, action, payload) {
    const item = await idbStorage.enqueueSyncItem({
      entity,
      action,
      payload
    });

    this.notifyStatus();

    // Trigger immediate sync attempt if currently online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => this.processQueue(), 50);
    }

    return item;
  }

  /**
   * Processes all ready pending items in the queue with exponential backoff
   */
  async processQueue() {
    if (this.isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notifyStatus();
      return;
    }
    if (!supabaseService.isReady || !supabaseService.client) {
      await supabaseService.init();
      if (!supabaseService.isReady || !supabaseService.client) {
        this.notifyStatus();
        return;
      }
    }

    this.isProcessing = true;
    this.notifyStatus();

    try {
      const pendingItems = await idbStorage.getPendingSyncItems();
      if (pendingItems.length === 0) {
        this.isProcessing = false;
        this.notifyStatus();
        return;
      }

      console.log(`🔄 Sync Queue: Processing ${pendingItems.length} pending mutations…`);

      for (const item of pendingItems) {
        const success = await this.syncSingleItem(item);
        if (success) {
          await idbStorage.removeSyncItem(item.id);
          this.lastSyncTime = new Date().toISOString();
        } else {
          // Calculate exponential backoff with jitter: delay = min(base * 2^attempts + jitter, max)
          const attempts = (item.attempts || 0) + 1;
          const jitter = Math.floor(Math.random() * 800);
          const backoffDelay = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts) + jitter, MAX_BACKOFF_MS);

          const updated = {
            ...item,
            attempts,
            status: attempts >= MAX_ATTEMPTS ? 'failed_permanently' : 'failed',
            lastAttempt: new Date().toISOString(),
            nextRetry: Date.now() + backoffDelay
          };
          await idbStorage.updateSyncItem(updated);
        }
      }
    } catch (err) {
      console.error('Error during sync queue execution:', err);
    } finally {
      this.isProcessing = false;
      this.notifyStatus();
    }
  }

  /**
   * Dispatches a single item to Supabase PostgreSQL table
   */
  async syncSingleItem(item) {
    const { entity, action, payload } = item;
    const client = supabaseService.client;
    if (!client) return false;

    try {
      if (action === 'delete') {
        const { error } = await client.from(entity).delete().eq('id', payload.id);
        if (error) throw error;
        return true;
      }

      // Default: Upsert
      const { error } = await client.from(entity).upsert(payload);
      if (error) {
        console.warn(`Supabase sync warning for [${entity}]:`, error.message);
        // If error is duplicate or foreign key constraint, we inspect; otherwise retry
        return false;
      }
      return true;
    } catch (e) {
      console.warn(`Sync failed for item [${entity}:${item.id}]:`, e.message || e);
      return false;
    }
  }

  /**
   * Notifies subscribers and window of current sync queue state
   */
  async notifyStatus() {
    const pendingCount = await idbStorage.getSyncQueueCount();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    const status = {
      isOnline,
      isSyncing: this.isProcessing,
      pendingCount,
      lastSyncTime: this.lastSyncTime
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tracker:syncStatus', { detail: status }));
    }
  }

  /**
   * Manually trigger an immediate sync
   */
  async flushNow() {
    return this.processQueue();
  }
}

export const syncQueue = new SyncQueueService();
