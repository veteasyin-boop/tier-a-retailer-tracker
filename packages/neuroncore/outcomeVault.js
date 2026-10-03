/**
 * GROWTA NEURONCORE OUTCOME VAULT
 * Authority: GROWTA-MASTER-PRD-001 (Section 56 — Module 37)
 * Parent: Varyanta Global Industries
 * 
 * Immutable store for AI recommendations, human decisions, and measurable outcomes.
 */

const OUTCOME_VAULT_KEY = 'growta_outcome_vault_v1';

export const DECISION_STATES = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  MODIFIED: 'MODIFIED'
});

class OutcomeVault {
  constructor() {
    this.records = [];
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(OUTCOME_VAULT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.records = parsed;
      }
    } catch (e) {
      console.warn('Outcome vault read note:', e);
      this.records = [];
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(OUTCOME_VAULT_KEY, JSON.stringify(this.records.slice(0, 1000)));
    } catch (e) {
      console.warn('Outcome vault save note:', e);
    }
  }

  /**
   * Records a new AI Recommendation
   */
  recordRecommendation({
    moduleSource,
    targetEntity,
    entityId,
    recommendationText,
    actionProposed,
    confidence = 0.85
  }) {
    const record = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      moduleSource,
      targetEntity,
      entityId: String(entityId),
      recommendationText,
      actionProposed,
      confidence,
      decision: DECISION_STATES.PENDING,
      decidedBy: null,
      decidedAt: null,
      outcomeObserved: null,
      roiImpactInr: 0,
      createdAt: new Date().toISOString()
    };

    this.records.unshift(record);
    this.saveToStorage();
    return record;
  }

  /**
   * Records a human operator's decision on the recommendation
   */
  recordDecision(recommendationId, { decision, decidedBy, modifiedAction = null }) {
    const item = this.records.find(r => r.id === recommendationId);
    if (!item) throw new Error(`Recommendation ${recommendationId} not found in Outcome Vault.`);

    item.decision = decision;
    item.decidedBy = decidedBy || 'Manager';
    item.decidedAt = new Date().toISOString();
    if (modifiedAction) item.actionProposed = modifiedAction;

    this.saveToStorage();
    return item;
  }

  /**
   * Logs post-execution outcome and measurable business impact
   */
  recordOutcome(recommendationId, { outcomeText, roiImpactInr = 0 }) {
    const item = this.records.find(r => r.id === recommendationId);
    if (!item) throw new Error(`Recommendation ${recommendationId} not found in Outcome Vault.`);

    item.outcomeObserved = outcomeText;
    item.roiImpactInr = Number(roiImpactInr) || 0;

    this.saveToStorage();
    return item;
  }

  /**
   * Aggregates evaluation metrics across all recommendations
   */
  getEvaluationMetrics() {
    const total = this.records.length;
    if (total === 0) {
      return {
        totalRecommendations: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        acceptanceRatePct: 0,
        totalRoiImpactInr: 0
      };
    }

    const accepted = this.records.filter(r => r.decision === DECISION_STATES.ACCEPTED || r.decision === DECISION_STATES.MODIFIED).length;
    const rejected = this.records.filter(r => r.decision === DECISION_STATES.REJECTED).length;
    const pending = this.records.filter(r => r.decision === DECISION_STATES.PENDING).length;
    const totalRoi = this.records.reduce((sum, r) => sum + (r.roiImpactInr || 0), 0);

    return {
      totalRecommendations: total,
      acceptedCount: accepted,
      rejectedCount: rejected,
      pendingCount: pending,
      acceptanceRatePct: Math.round((accepted / total) * 100),
      totalRoiImpactInr: totalRoi
    };
  }

  getAllRecords() {
    return [...this.records];
  }
}

export const outcomeVault = new OutcomeVault();
