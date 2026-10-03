/**
 * GROWTA NEURONCORE SALES & INVENTORY ANALYST
 * Authority: GROWTA-MASTER-PRD-001 (Sections 51 & 52 — Modules 32 & 33)
 * Parent: Varyanta Global Industries
 * 
 * Strict separation of observable facts from inferred recommendations.
 */

import { storage } from '../../src/services/storage.js';
import { inventoryLedger } from '../inventory/inventoryLedger.js';
import { skuMaster } from '../catalog/skuMaster.js';

class SalesInventoryAnalyst {
  /**
   * Module 32: AI Sales Analyst
   * Analyzes retailer coverage, movement, anomalies, and territory concentration
   */
  generateSalesAnalysis(options = {}) {
    const rows = storage.rows || [];
    const checkIns = storage.getCheckInLogs();
    const targetHq = options.hq || null;

    let targetRows = rows;
    if (targetHq) {
      targetRows = rows.filter(r => (r.hq || '').toLowerCase() === targetHq.toLowerCase());
    }

    const totalDealers = targetRows.length;
    const contacted = targetRows.filter(r => (r.status && r.status !== 'Pending') || r.mobile || r.potentialFor);
    const uncontacted = targetRows.filter(r => !r.status || r.status === 'Pending');
    const highPotential = targetRows.filter(r => r.potentialSell === '>20000' || r.potentialSell === '15000-20000');

    // Detect Anomalies (Facts)
    const anomalies = [];
    const unvisitedHighPot = highPotential.filter(r => !r.verifiedVisit && (!r.status || r.status === 'Pending'));
    if (unvisitedHighPot.length > 0) {
      anomalies.push({
        type: 'UNVISITED_HIGH_POTENTIAL',
        severity: 'HIGH',
        fact: `${unvisitedHighPot.length} Tier-A dealers with >₹15,000 potential have never received a verified field visit.`,
        sampleEntities: unvisitedHighPot.slice(0, 3).map(r => `${r.retailer} (${r.block || r.hq})`)
      });
    }

    // Category distribution
    const categoryBreakdown = {};
    targetRows.forEach(r => {
      const cat = r.potentialFor || 'Unclassified';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    // Inferences & Recommendations (L1 Recommend level)
    const recommendations = [];
    if (unvisitedHighPot.length > 0) {
      recommendations.push(`Priority Re-Route: Inject ${unvisitedHighPot.slice(0, 3).map(r => r.retailer).join(', ')} into tomorrow's Smart Beat journey plan.`);
    }
    if (uncontacted.length > totalDealers * 0.4) {
      recommendations.push(`Territory Coverage Deficit: Allocate secondary field support to accelerate dealer onboarding before the seasonal sowing peak.`);
    }

    return {
      scope: targetHq ? `Headquarters: ${targetHq}` : 'Statewide (Bihar Central Grid)',
      facts: {
        totalAccounts: totalDealers,
        contactedCount: contacted.length,
        uncontactedCount: uncontacted.length,
        coverageRatePct: totalDealers ? Math.round((contacted.length / totalDealers) * 100) : 0,
        highPotentialAccountsCount: highPotential.length,
        totalGpsCheckInsRecorded: checkIns.length,
        categoryBreakdown
      },
      anomalies,
      recommendations,
      suggestedQuestions: [
        'Which specific high-potential counters in Danapur are pending visit?',
        'What is the dealer conversion rate in Begusarai vs Bihta?',
        'Are introductory starter packs driving repeat orders?'
      ]
    };
  }

  /**
   * Module 33: AI Inventory Analyst
   * Audits stock coverage, stock-out risk, aging lots, and territory imbalances
   */
  generateInventoryAnalysis() {
    const balances = inventoryLedger.getDepotStockBalances();
    const riskAnalysis = inventoryLedger.getLiquidationRiskAnalysis();
    const skus = skuMaster.getAllSkus();

    // Observable Facts
    const totalStockValue = balances.reduce((sum, b) => sum + b.stock_value, 0);
    const criticalLots = riskAnalysis.filter(r => r.riskLevel === 'CRITICAL');
    const warningLots = riskAnalysis.filter(r => r.riskLevel === 'WARNING');
    const healthyLots = riskAnalysis.filter(r => r.riskLevel === 'NORMAL');

    // Territory Imbalance Check (Facts)
    const imbalances = [];
    const highStockSeeds = balances.filter(b => b.category === 'Certified Seeds' && b.current_stock > 300);
    if (highStockSeeds.length > 0) {
      imbalances.push({
        fact: `${highStockSeeds.length} hybrid seed lines have >300 units centralized in Mother Depot with low field drawer allocation.`,
        skus: highStockSeeds.map(s => s.product_name)
      });
    }

    // Inferences & Recommendations (L1 Recommend level)
    const recommendations = [];
    if (criticalLots.length > 0) {
      recommendations.push(`Immediate Liquidation Campaign: Deploy 5-8% dealer booking incentive on ${criticalLots.map(c => c.product_name).join(', ')} to avoid post-season returns.`);
    }
    if (imbalances.length > 0) {
      recommendations.push(`Inter-Depot Redistribution: Transfer 150 units of hybrid maize from Patna Mother Depot to Danapur and Bihta field transit hubs.`);
    }

    return {
      facts: {
        depotName: 'Patna Central Mother Depot',
        totalCatalogSkusCount: skus.length,
        totalStockValuationInr: totalStockValue,
        activeStockHoldingUnits: balances.reduce((sum, b) => sum + b.current_stock, 0),
        criticalRiskLotsCount: criticalLots.length,
        warningRiskLotsCount: warningLots.length,
        healthyLotsCount: healthyLots.length
      },
      imbalances,
      recommendations,
      suggestedQuestions: [
        'Which depot SKUs expire within the next 90 days?',
        'What is our total capital tied up in slow-moving agrochemicals?',
        'How many units of certified maize seeds remain unallocated?'
      ]
    };
  }
}

export const salesInventoryAnalyst = new SalesInventoryAnalyst();
