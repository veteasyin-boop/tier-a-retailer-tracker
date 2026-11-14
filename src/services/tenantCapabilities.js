/**
 * UI capability mapping for the tenant-aware shell.
 *
 * Capability keys are stable application concepts. Permission codes are the
 * authorization vocabulary. Tenant roles remain tenant-defined and are never
 * inferred from role names, email addresses, or Auth metadata.
 */
export const TENANT_UI_CAPABILITIES = Object.freeze({
  'field.retailers.read': ['retailer.read'],
  'field.visits.checkin': ['visit.checkin'],
  'field.orders.create': ['order.create'],
  'field.attendance.punch': ['attendance.punch'],
  'field.attendance.regularize': ['attendance.regularize'],
  'field.tada.claim': ['tada.claim'],
  'field.leave.apply': ['leave.apply'],
  'field.inventory.read': ['inventory.read'],
  'field.ai.query': ['ai.query'],

  'admin.retailers.read': ['retailer.read'],
  'admin.retailers.create': ['retailer.create'],
  'admin.retailers.update': ['retailer.update'],
  'admin.retailers.reassign': ['retailer.reassign'],
  'admin.retailers.export': ['retailer.export'],
  'admin.visits.review': ['visit.review'],
  'admin.orders.approve': ['order.approve'],
  'admin.attendance.approve': ['attendance.approve'],
  'admin.tada.approve': ['tada.approve'],
  'admin.leave.approve': ['leave.approve'],
  'admin.inventory.issue': ['inventory.issue'],
  'admin.inventory.reconcile': ['inventory.reconcile'],
  'admin.kpi.configure': ['kpi.configure'],
  'admin.sop.manage': ['sop.manage'],

  'tenant.organization.read': ['organization.read'],
  'tenant.organization.manage': ['organization.manage'],
  'tenant.designation.manage': ['designation.manage'],
  'tenant.membership.read': ['membership.read'],
  'tenant.membership.manage': ['membership.manage'],
  'tenant.reporting.manage': ['reporting.manage'],
  'tenant.scope.assign': ['scope.assign'],
  'tenant.role.manage': ['role.manage'],
  'tenant.audit.read': ['audit.read']
});

export function hasTenantCapability(tenantContext, capability) {
  const required = TENANT_UI_CAPABILITIES[capability];
  if (!required || !tenantContext || !Array.isArray(tenantContext.permissions)) return false;
  const granted = new Set(tenantContext.permissions);
  return required.every((permission) => granted.has(permission));
}
