/**
 * GROWTA ENTERPRISE WORKFLOW ENGINE
 * Authority: GROWTA-MASTER-PRD-001 (Section 57 — Module 38)
 * Parent: Varyanta Global Industries
 * 
 * Versioned workflow execution with trigger, condition, action, approval, and escalation.
 */

import { auditLogger, AUDIT_ACTIONS } from '../audit/auditLogger.js';

export const WORKFLOW_STATUS = Object.freeze({
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  AUTO_EXECUTED: 'AUTO_EXECUTED',
  ESCALATED: 'ESCALATED'
});

export const STANDARD_WORKFLOWS = [
  {
    id: 'WF_BULK_ORDER_APPROVAL_v1',
    name: 'High-Value Order Commercial Approval',
    version: '1.0.0',
    trigger: 'ORDER_SUBMITTED',
    condition: (payload) => (payload.total_order_value || 0) >= 20000 || (payload.discount_pct || 0) >= 5,
    requiredRole: 'TERRITORY_MANAGER',
    autoEscalateHours: 24,
    description: 'Requires managerial approval for dealer orders exceeding ₹20,000 or custom discounts.'
  },
  {
    id: 'WF_LEAVE_APPROVAL_v1',
    name: 'Statutory Leave Review & Balance Deduction',
    version: '1.0.0',
    trigger: 'LEAVE_APPLIED',
    condition: (payload) => (payload.days || 1) >= 1,
    requiredRole: 'TERRITORY_MANAGER',
    autoEscalateHours: 48,
    description: 'Mandatory supervisory authorization before leave balance deduction.'
  },
  {
    id: 'WF_SPEED_BREACH_GOVERNANCE_v1',
    name: 'Fleet Safety Speed Warning Dispatcher',
    version: '1.0.0',
    trigger: 'SPEED_THRESHOLD_BREACHED',
    condition: (payload) => (payload.excessKmH || 0) > 0,
    requiredRole: 'SUPER_ADMIN',
    autoEscalateHours: 12,
    description: 'Issues formal notice to representative and alerts State Operations Manager.'
  }
];

class WorkflowEngine {
  constructor() {
    this.definitions = new Map();
    this.instances = [];
    this.initStandardWorkflows();
  }

  initStandardWorkflows() {
    STANDARD_WORKFLOWS.forEach(wf => {
      this.definitions.set(wf.id, wf);
    });
  }

  /**
   * Evaluates event and creates workflow instance if condition is met
   */
  evaluateTrigger(triggerType, payload = {}) {
    const matched = [];

    for (const [id, def] of this.definitions.entries()) {
      if (def.trigger === triggerType) {
        let conditionMet = false;
        try {
          conditionMet = def.condition(payload);
        } catch (e) {
          conditionMet = false;
        }

        if (conditionMet) {
          const instance = {
            id: `wfi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            workflowId: def.id,
            workflowName: def.name,
            version: def.version,
            payload,
            status: WORKFLOW_STATUS.PENDING_APPROVAL,
            requiredRole: def.requiredRole,
            initiatedAt: new Date().toISOString(),
            completedAt: null,
            approvedBy: null,
            rejectionReason: null
          };

          this.instances.unshift(instance);
          matched.push(instance);

          auditLogger.log({
            action: 'WORKFLOW_TRIGGERED',
            entityType: 'workflow_instance',
            entityId: instance.id,
            user: { fullName: 'Workflow Engine', role: 'SYSTEM' },
            diff: { workflowId: def.id, trigger: triggerType }
          });
        }
      }
    }

    return matched;
  }

  /**
   * Approves active workflow step
   */
  approveInstance(instanceId, approver = { name: 'Manager', role: 'TERRITORY_MANAGER' }) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (!instance) throw new Error(`Workflow instance ${instanceId} not found.`);

    instance.status = WORKFLOW_STATUS.APPROVED;
    instance.approvedBy = approver.name;
    instance.completedAt = new Date().toISOString();

    auditLogger.log({
      action: 'WORKFLOW_APPROVED',
      entityType: 'workflow_instance',
      entityId: instance.id,
      user: { fullName: approver.name, role: approver.role },
      diff: { status: WORKFLOW_STATUS.APPROVED }
    });

    return instance;
  }

  /**
   * Rejects active workflow step
   */
  rejectInstance(instanceId, reason, rejector = { name: 'Manager', role: 'TERRITORY_MANAGER' }) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (!instance) throw new Error(`Workflow instance ${instanceId} not found.`);

    instance.status = WORKFLOW_STATUS.REJECTED;
    instance.approvedBy = rejector.name;
    instance.rejectionReason = reason || 'Declined by managerial review';
    instance.completedAt = new Date().toISOString();

    auditLogger.log({
      action: 'WORKFLOW_REJECTED',
      entityType: 'workflow_instance',
      entityId: instance.id,
      user: { fullName: rejector.name, role: rejector.role },
      diff: { status: WORKFLOW_STATUS.REJECTED, reason }
    });

    return instance;
  }

  getActiveInstances() {
    return this.instances.filter(i => i.status === WORKFLOW_STATUS.PENDING_APPROVAL);
  }

  getAllInstances() {
    return [...this.instances];
  }

  getRegisteredDefinitions() {
    return Array.from(this.definitions.values());
  }
}

export const workflowEngine = new WorkflowEngine();
