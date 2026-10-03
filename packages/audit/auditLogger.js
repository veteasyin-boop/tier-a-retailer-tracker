/**
 * GROWTA ENTERPRISE IMMUTABLE AUDIT LOGGER
 * Authority: GROWTA-MASTER-PRD-001 (Section 59, Milestone 10)
 */

import { supabaseService } from '../../src/services/supabase.js';

export const AUDIT_ACTIONS = Object.freeze({
  LOGIN: 'AUTH_LOGIN',
  LOGOUT: 'AUTH_LOGOUT',
  PUNCH_IN: 'ATTENDANCE_PUNCH_IN',
  PUNCH_OUT: 'ATTENDANCE_PUNCH_OUT',
  REGULARIZATION_REQUEST: 'ATTENDANCE_REGULARIZATION_REQUEST',
  REGULARIZATION_APPROVE: 'ATTENDANCE_REGULARIZATION_APPROVE',
  REGULARIZATION_REJECT: 'ATTENDANCE_REGULARIZATION_REJECT',
  CHECK_IN: 'VISIT_GPS_CHECKIN',
  ORDER_BOOK: 'COMMERCIAL_ORDER_BOOKED',
  TADA_CLAIM_SUBMIT: 'TADA_CLAIM_SUBMITTED',
  TADA_CLAIM_APPROVE: 'TADA_CLAIM_APPROVED',
  TADA_CLAIM_REJECT: 'TADA_CLAIM_REJECTED',
  LEAVE_APPLY: 'LEAVE_APPLIED',
  LEAVE_APPROVE: 'LEAVE_APPROVED',
  LEAVE_REJECT: 'LEAVE_REJECTED',
  RETAILER_CREATE: 'RETAILER_CREATED',
  RETAILER_UPDATE: 'RETAILER_UPDATED',
  RETAILER_REASSIGN: 'RETAILER_TERRITORY_REASSIGNED',
  STOCK_ISSUE: 'INVENTORY_STOCK_ISSUED',
  STOCK_RECONCILE: 'INVENTORY_WEEKLY_RECONCILED'
});

const AUDIT_STORAGE_KEY = 'tat_audit_logs_v1';

class AuditLogger {
  constructor() {
    this.buffer = [];
    this.loadLocalBuffer();
  }

  loadLocalBuffer() {
    try {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.buffer = parsed;
      }
    } catch (e) {
      console.warn('Audit log read note:', e);
      this.buffer = [];
    }
  }

  saveLocalBuffer() {
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this.buffer.slice(0, 2000)));
    } catch (e) {
      console.warn('Audit log write note:', e);
    }
  }

  computeDiff(oldData, newData) {
    if (!oldData || !newData) return null;
    const diff = {};
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    for (const key of allKeys) {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        diff[key] = {
          from: oldData[key] !== undefined ? oldData[key] : null,
          to: newData[key] !== undefined ? newData[key] : null
        };
      }
    }
    return Object.keys(diff).length > 0 ? diff : null;
  }

  async log({
    tenantId = 'a0000000-0000-0000-0000-000000000001',
    user = null,
    action,
    entityType,
    entityId,
    oldData = null,
    newData = null,
    diff = null
  }) {
    if (!action || !entityType || !entityId) {
      console.warn('Audit log missing mandatory fields:', { action, entityType, entityId });
      return;
    }

    const computedDiff = this.computeDiff(oldData, newData) || diff;

    const record = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      user_id: user?.id || null,
      user_name: user?.name || user?.fullName || 'Manager / System',
      user_role: user?.role || 'SYSTEM',
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      old_data: oldData,
      new_data: newData,
      diff: computedDiff,
      created_at: new Date().toISOString()
    };

    // Store in local buffer
    this.buffer.unshift(record);
    this.saveLocalBuffer();

    // Broadcast local event
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tracker:auditLogged', { detail: { record } }));
    }

    // Send to Supabase if connected
    if (supabaseService.isReady && supabaseService.client) {
      try {
        await supabaseService.client.from('audit_logs').insert(record);
      } catch (err) {
        console.warn('Supabase audit logging note:', err.message);
      }
    }

    return record;
  }

  getLogs(filter = {}) {
    let list = [...this.buffer];
    if (filter.entityType) list = list.filter(l => l.entity_type === filter.entityType);
    if (filter.action) list = list.filter(l => l.action === filter.action);
    if (filter.entityId) list = list.filter(l => l.entity_id === String(filter.entityId));
    return list;
  }
}

export const auditLogger = new AuditLogger();
