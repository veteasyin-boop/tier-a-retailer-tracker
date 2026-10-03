/**
 * GROWTA ENTERPRISE RBAC & AUTHORIZATION MODULE
 * Authority: GROWTA-MASTER-PRD-001 (Section 18, 19)
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  STATE_HEAD: 'STATE_HEAD',
  TERRITORY_MANAGER: 'TERRITORY_MANAGER',
  FIELD_OFFICER: 'FIELD_OFFICER'
});

export const PERMISSIONS = Object.freeze({
  // Retailer Directory
  RETAILER_READ: 'retailer.read',
  RETAILER_CREATE: 'retailer.create',
  RETAILER_UPDATE: 'retailer.update',
  RETAILER_REASSIGN: 'retailer.reassign',
  RETAILER_EXPORT: 'retailer.export',

  // Field Visits & GPS
  VISIT_CHECKIN: 'visit.checkin',
  VISIT_REVIEW: 'visit.review',

  // Orders & Commercial
  ORDER_CREATE: 'order.create',
  ORDER_APPROVE: 'order.approve',

  // Attendance & Muster
  ATTENDANCE_PUNCH: 'attendance.punch',
  ATTENDANCE_REGULARIZE: 'attendance.regularize',
  ATTENDANCE_APPROVE: 'attendance.approve',

  // Travel Allowance & DA
  TADA_CLAIM: 'tada.claim',
  TADA_APPROVE: 'tada.approve',

  // Leave Management
  LEAVE_APPLY: 'leave.apply',
  LEAVE_APPROVE: 'leave.approve',

  // Inventory & Depot
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ISSUE: 'inventory.issue',
  INVENTORY_RECONCILE: 'inventory.reconcile',

  // Configuration & AI
  KPI_CONFIGURE: 'kpi.configure',
  SOP_MANAGE: 'sop.manage',
  AI_QUERY: 'ai.query'
});

// Role to Permission Matrix
const ROLE_PERMISSIONS_MAP = {
  [ROLES.FIELD_OFFICER]: new Set([
    PERMISSIONS.RETAILER_READ,
    PERMISSIONS.VISIT_CHECKIN,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ATTENDANCE_PUNCH,
    PERMISSIONS.ATTENDANCE_REGULARIZE,
    PERMISSIONS.TADA_CLAIM,
    PERMISSIONS.LEAVE_APPLY,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.AI_QUERY
  ]),
  [ROLES.TERRITORY_MANAGER]: new Set([
    PERMISSIONS.RETAILER_READ,
    PERMISSIONS.RETAILER_CREATE,
    PERMISSIONS.RETAILER_UPDATE,
    PERMISSIONS.VISIT_CHECKIN,
    PERMISSIONS.VISIT_REVIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_APPROVE,
    PERMISSIONS.ATTENDANCE_PUNCH,
    PERMISSIONS.ATTENDANCE_REGULARIZE,
    PERMISSIONS.ATTENDANCE_APPROVE,
    PERMISSIONS.TADA_CLAIM,
    PERMISSIONS.TADA_APPROVE,
    PERMISSIONS.LEAVE_APPLY,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_ISSUE,
    PERMISSIONS.AI_QUERY
  ]),
  [ROLES.STATE_HEAD]: new Set(Object.values(PERMISSIONS)),
  [ROLES.SUPER_ADMIN]: new Set(Object.values(PERMISSIONS))
};

/**
 * Validates if a role has the required permission
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const permissions = ROLE_PERMISSIONS_MAP[role];
  if (!permissions) return false;
  return permissions.has(permission);
}

/**
 * Validates if a user has access to a specific territory/HQ
 */
export function canAccessTerritory(user, targetHq) {
  if (!user) return false;
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.STATE_HEAD) return true;
  return user.hq === targetHq || (user.assignedHqs && user.assignedHqs.includes(targetHq));
}

/**
 * Tenant Context Wrapper for scoping all operations
 */
export class TenantContext {
  constructor(tenantId = 'a0000000-0000-0000-0000-000000000001', user = null) {
    this.tenantId = tenantId;
    this.user = user || {
      id: 'usr_guest',
      fullName: 'Field Assistant',
      role: ROLES.FIELD_OFFICER,
      hq: 'Bihta'
    };
  }

  can(permission) {
    return hasPermission(this.user.role, permission);
  }

  isAuthorizedForHq(hq) {
    return canAccessTerritory(this.user, hq);
  }
}
