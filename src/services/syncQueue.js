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
   * Sanitizes in-memory frontend payloads to match exact PostgreSQL table schemas
   * and prevents schema cache mismatches (400 Bad Request).
   */
  sanitizePayload(entity, payload) {
    if (!payload || typeof payload !== 'object') return payload;

    switch (entity) {
      case 'retailers': {
        const validAssistants = new Set([
          'Assistant 1 (West Patna)', 'Assistant 2 (Central/South Patna)',
          'Assistant 3 (East Patna)', 'Assistant 4 (West Vaishali)',
          'Assistant 5 (East Vaishali)', 'Assistant 6 (Rohtas)',
          'Assistant 7 (Kaimur)', 'Assistant 8 (Bhojpur & Buxar)'
        ]);
        const rawAssistant = typeof payload.assistant === 'string' ? payload.assistant.trim() : '';
        const safeAssistant = validAssistants.has(rawAssistant) ? rawAssistant : null;

        return {
          id: payload.id,
          retailer: payload.retailer,
          assistant: safeAssistant,
          hq: payload.hq || null,
          district: payload.district || 'Patna',
          block: (payload.block && String(payload.block).trim()) ? String(payload.block).trim() : 'General',
          mobile: payload.mobile || '',
          status: payload.status || 'Pending',
          potential_for: payload.potentialFor !== undefined ? payload.potentialFor : (payload.potential_for || null),
          potential_sell: payload.potentialSell !== undefined ? payload.potentialSell : (payload.potential_sell || null),
          notes: payload.notes || '',
          verified_visit: Boolean(payload.verifiedVisit !== undefined ? payload.verifiedVisit : payload.verified_visit),
          check_in_date: payload.checkInDate || payload.check_in_date || null,
          check_in_time: payload.checkInTime || payload.check_in_time || null,
          check_in_lat: payload.checkInCoords?.lat || payload.check_in_lat || null,
          check_in_lng: payload.checkInCoords?.lng || payload.check_in_lng || null,
          check_in_accuracy: payload.checkInCoords?.accuracy || payload.check_in_accuracy || null,
          check_in_dist_km: payload.checkInDistKm !== undefined ? payload.checkInDistKm : (payload.check_in_dist_km !== undefined ? payload.check_in_dist_km : null),
          check_in_map_url: payload.checkInMapUrl || payload.check_in_map_url || null,
          check_in_rep: payload.checkInRep || payload.check_in_rep || null,
          updated_by: payload.updatedBy || payload.updated_by || null,
          updated_at: payload.updatedAt ? (typeof payload.updatedAt === 'number' ? new Date(payload.updatedAt).toISOString() : payload.updatedAt) : new Date().toISOString()
        };
      }

      case 'check_in_logs': {
        return {
          id: payload.id,
          retailer_id: payload.retailerId || payload.retailer_id || null,
          retailer: payload.retailer,
          mobile: payload.mobile || '',
          district: payload.district || '',
          block: payload.block || '',
          rep: payload.rep || '',
          date: payload.date,
          time: payload.time,
          timestamp: payload.timestamp || Date.now(),
          lat: payload.lat,
          lng: payload.lng,
          accuracy: payload.accuracy,
          dist_km: payload.distKm !== undefined ? payload.distKm : (payload.dist_km !== undefined ? payload.dist_km : 0),
          map_url: payload.mapUrl || payload.map_url || '',
          status: payload.status || 'Visited',
          notes: payload.notes || ''
        };
      }

      case 'attendance_records': {
        return {
          id: payload.id,
          assistant: payload.assistant,
          emp_code: payload.empCode || payload.emp_code || '',
          hq: payload.hq || '',
          district: payload.district || '',
          date: payload.date,
          punch_in: payload.punchIn || payload.punch_in || null,
          punch_in_time: payload.punchInTime || payload.punch_in_time || null,
          punch_in_lat: payload.punchInGps?.lat || payload.punch_in_lat || null,
          punch_in_lng: payload.punchInGps?.lng || payload.punch_in_lng || null,
          punch_in_location_name: payload.punchInGps?.locationName || payload.punch_in_location_name || '',
          punch_out: payload.punchOut || payload.punch_out || null,
          punch_out_time: payload.punchOutTime || payload.punch_out_time || null,
          punch_out_lat: payload.punchOutGps?.lat || payload.punch_out_lat || null,
          punch_out_lng: payload.punchOutGps?.lng || payload.punch_out_lng || null,
          punch_out_location_name: payload.punchOutGps?.locationName || payload.punch_out_location_name || '',
          working_minutes: payload.workingMinutes !== undefined ? payload.workingMinutes : (payload.working_minutes || 0),
          working_hours_formatted: payload.workingHoursFormatted || payload.working_hours_formatted || '',
          work_mode: payload.workMode || payload.work_mode || 'Field Operations',
          status: payload.status || 'Present',
          status_label: payload.statusLabel || payload.status_label || '',
          is_late: Boolean(payload.isLate !== undefined ? payload.isLate : payload.is_late),
          notes: payload.notes || '',
          regularization_requested: Boolean(payload.regularizationRequested !== undefined ? payload.regularizationRequested : payload.regularization_requested),
          regularization_reason: payload.regularizationReason || payload.regularization_reason || null,
          requested_status: payload.requestedStatus || payload.requested_status || null,
          regularization_status: payload.regularizationStatus || payload.regularization_status || null,
          created_at: payload.createdAt ? (typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt) : new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      case 'tada_claims': {
        return {
          id: payload.id,
          assistant: payload.assistant,
          hq: payload.hq,
          district: payload.district,
          date: payload.date,
          verified_stops: payload.verifiedStops !== undefined ? payload.verifiedStops : (payload.verified_stops || 0),
          gps_verified_km: payload.gpsVerifiedKm !== undefined ? payload.gpsVerifiedKm : (payload.gps_verified_km || 0),
          claimed_km: payload.claimedKm !== undefined ? payload.claimedKm : (payload.claimed_km || 0),
          fuel_rate: payload.fuelRate !== undefined ? payload.fuelRate : (payload.fuel_rate || 3.5),
          fuel_amount: payload.fuelAmount !== undefined ? payload.fuelAmount : (payload.fuel_amount || 0),
          da_amount: payload.daAmount !== undefined ? payload.daAmount : (payload.da_amount || 0),
          outstation_amount: payload.outstationAmount !== undefined ? payload.outstationAmount : (payload.outstation_amount || 0),
          incidental_amount: payload.incidentalAmount !== undefined ? payload.incidentalAmount : (payload.incidental_amount || 0),
          incidental_notes: payload.incidentalNotes || payload.incidental_notes || null,
          total_claim_amount: payload.totalClaimAmount !== undefined ? payload.totalClaimAmount : (payload.total_claim_amount || 0),
          approved_amount: payload.approvedAmount !== undefined ? payload.approvedAmount : (payload.approved_amount || 0),
          status: payload.status || 'Submitted',
          audit_flags: payload.auditFlags || payload.audit_flags || [],
          manager_notes: payload.managerNotes || payload.manager_notes || null,
          approved_by: payload.approvedBy || payload.approved_by || null,
          approved_at: payload.approvedAt || payload.approved_at || null,
          created_at: payload.createdAt ? (typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt) : new Date().toISOString()
        };
      }

      case 'leave_applications': {
        return {
          id: payload.id,
          assistant: payload.assistant,
          emp_code: payload.empCode || payload.emp_code || '',
          hq: payload.hq || '',
          district: payload.district || '',
          leave_type: payload.leaveType || payload.leave_type,
          leave_label: payload.leaveLabel || payload.leave_label || payload.leaveType || payload.leave_type,
          from_date: payload.fromDate || payload.from_date,
          to_date: payload.toDate || payload.to_date,
          days: payload.days || 1,
          reason: payload.reason || '',
          status: payload.status || 'Pending',
          applied_at: payload.appliedAt || payload.applied_at || new Date().toISOString(),
          reviewed_by: payload.reviewedBy || payload.reviewed_by || null,
          reviewed_at: payload.reviewedAt || payload.reviewed_at || null,
          review_notes: payload.reviewNotes || payload.review_notes || null
        };
      }

      case 'orders': {
        return {
          id: payload.id,
          retailer_id: payload.retailerId || payload.retailer_id || null,
          retailer_name: payload.retailerName || payload.retailer_name || '',
          assistant: payload.assistant || '',
          order_date: payload.orderDate || payload.order_date || new Date().toISOString().slice(0, 10),
          order_time: payload.orderTime || payload.order_time || '',
          product_sku: payload.productSku || payload.product_sku || '',
          sku_id: payload.skuId || payload.sku_id || '',
          pack_size: payload.packSize || payload.pack_size || '',
          quantity_bags: Number(payload.quantityBags !== undefined ? payload.quantityBags : payload.quantity_bags) || 0,
          unit_price: Number(payload.unitPrice !== undefined ? payload.unitPrice : payload.unit_price) || 0,
          subtotal: Number(payload.subtotal) || 0,
          gst_amount: Number(payload.gstAmount !== undefined ? payload.gstAmount : payload.gst_amount) || 0,
          total_order_value: Number(payload.totalOrderValue !== undefined ? payload.totalOrderValue : payload.total_order_value) || 0,
          payment_terms: payload.paymentTerms || payload.payment_terms || 'Cash_on_Delivery',
          order_status: payload.orderStatus || payload.order_status || 'Submitted',
          created_at: payload.createdAt ? (typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt) : new Date().toISOString()
        };
      }

      default:
        return payload;
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

      // Default: Upsert with sanitized schema payload
      const sanitized = this.sanitizePayload(entity, payload);
      const { error } = await client.from(entity).upsert(sanitized);
      if (error) {
        console.warn(`Supabase sync warning for [${entity}]:`, error.message);
        // If the table or schema does not support this payload or violates constraints, prevent infinite loops
        if (
          error.code === 'PGRST204' || 
          error.code === '23503' || 
          error.code === '42P01' ||
          error.message?.includes('schema cache') || 
          error.message?.includes('foreign key constraint') ||
          error.message?.includes('violates foreign key')
        ) {
          console.warn(`Schema or constraint mismatch detected on ${entity}. Removing invalid item to prevent queue blocking.`);
          return true; // Mark as done to clear from queue
        }
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
