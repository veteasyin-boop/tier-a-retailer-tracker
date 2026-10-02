// =========================================================================
// INDEXEDDB ENGINE FOR HIGH-RESOLUTION MEDIA & OFFLINE RESILIENCE
// Overcomes localStorage ~5MB quota limit by using browser IndexedDB (GBs)
// =========================================================================

const DB_NAME = 'tier_a_idb_v1';
const DB_VERSION = 1;

const STORES = {
  MEDIA: 'media_store',
  SYNC_QUEUE: 'sync_queue'
};

class IdbStorageService {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initializes or returns open IndexedDB instance
   */
  async getDb() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not supported in current environment; falling back to in-memory/mock');
        return resolve(null);
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Media Store: Holds large base64/blobs for demo plot photos & TA/DA receipt scans
        if (!db.objectStoreNames.contains(STORES.MEDIA)) {
          const mediaStore = db.createObjectStore(STORES.MEDIA, { keyPath: 'id' });
          mediaStore.createIndex('entity', 'entity', { unique: false });
          mediaStore.createIndex('entityId', 'entityId', { unique: false });
          mediaStore.createIndex('category', 'category', { unique: false });
          mediaStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 2. Sync Queue: Stores pending Supabase mutations for offline -> online sync
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('entity', 'entity', { unique: false });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
          syncStore.createIndex('nextRetry', 'nextRetry', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  // =========================================================================
  // 📸 MEDIA STORE METHODS (Receipts, Plot Photos, Field Attachments)
  // =========================================================================

  /**
   * Saves a media item (receipt bill, field demo plot photo, voucher) to IndexedDB
   * @param {Object} mediaItem { id, entity, entityId, category, name, mimeType, dataUrl, sizeBytes, createdAt }
   */
  async saveMedia(mediaItem) {
    const db = await this.getDb();
    if (!db) return mediaItem;

    const item = {
      id: mediaItem.id || `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity: mediaItem.entity || 'general', // 'tada_bill' | 'demo_plot' | 'farmer_meeting' | 'attendance'
      entityId: mediaItem.entityId || null,
      category: mediaItem.category || 'Receipt',
      name: mediaItem.name || 'attachment.jpg',
      mimeType: mediaItem.mimeType || 'image/jpeg',
      dataUrl: mediaItem.dataUrl,
      sizeBytes: mediaItem.sizeBytes || (mediaItem.dataUrl ? mediaItem.dataUrl.length : 0),
      createdAt: mediaItem.createdAt || new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MEDIA, 'readwrite');
      const store = tx.objectStore(STORES.MEDIA);
      const req = store.put(item);

      req.onsuccess = () => resolve(item);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieves a single media item by ID
   */
  async getMedia(id) {
    const db = await this.getDb();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MEDIA, 'readonly');
      const store = tx.objectStore(STORES.MEDIA);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieves all media associated with a given entity and entityId
   */
  async getMediaForEntity(entity, entityId) {
    const db = await this.getDb();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MEDIA, 'readonly');
      const store = tx.objectStore(STORES.MEDIA);
      const index = store.index('entityId');
      const req = index.getAll(entityId);

      req.onsuccess = () => {
        const results = req.result || [];
        resolve(entity ? results.filter(r => r.entity === entity) : results);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Deletes a media item by ID
   */
  async deleteMedia(id) {
    const db = await this.getDb();
    if (!db) return false;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MEDIA, 'readwrite');
      const store = tx.objectStore(STORES.MEDIA);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // =========================================================================
  // 🔄 SYNC QUEUE METHODS (Offline-First Mutations with Retry)
  // =========================================================================

  /**
   * Enqueues an action to be synchronized to Supabase
   * @param {Object} item { id, entity, action, payload }
   */
  async enqueueSyncItem(item) {
    const db = await this.getDb();
    const syncItem = {
      id: item.id || `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity: item.entity, // 'check_in_logs' | 'demo_plots' | 'farmer_meetings' | 'farmer_leads' | 'tada_claims' | 'attendance_records'
      action: item.action || 'upsert', // 'upsert' | 'delete' | 'update'
      payload: item.payload,
      status: 'pending', // 'pending' | 'processing' | 'failed' | 'synced'
      attempts: 0,
      nextRetry: Date.now(),
      createdAt: item.createdAt || new Date().toISOString(),
      lastAttempt: null,
      error: null
    };

    if (!db) return syncItem;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.put(syncItem);

      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('tracker:syncQueueChanged', { detail: { action: 'enqueued', item: syncItem } }));
        resolve(syncItem);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Gets all pending sync items ready for processing
   */
  async getPendingSyncItems() {
    const db = await this.getDb();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.getAll();

      req.onsuccess = () => {
        const now = Date.now();
        const all = req.result || [];
        const pending = all
          .filter(i => (i.status === 'pending' || i.status === 'failed') && (i.nextRetry <= now))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        resolve(pending);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Updates an existing sync item (e.g. after attempt or success)
   */
  async updateSyncItem(item) {
    const db = await this.getDb();
    if (!db) return item;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.put(item);

      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('tracker:syncQueueChanged', { detail: { action: 'updated', item } }));
        resolve(item);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Removes a sync item once successfully uploaded to Supabase
   */
  async removeSyncItem(id) {
    const db = await this.getDb();
    if (!db) return true;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.delete(id);

      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('tracker:syncQueueChanged', { detail: { action: 'removed', id } }));
        resolve(true);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Returns current count of pending sync items
   */
  async getSyncQueueCount() {
    const db = await this.getDb();
    if (!db) return 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.count();

      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  }
}

export const idbStorage = new IdbStorageService();
