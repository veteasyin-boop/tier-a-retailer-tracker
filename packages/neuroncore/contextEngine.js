/**
 * GROWTA NEURONCORE CONTEXT ENGINE
 * Authority: GROWTA-MASTER-PRD-001 (Section 48 — Module 29)
 * Parent: Varyanta Global Industries
 * 
 * Aggregates multi-dimensional operational context without inventing facts.
 */

import { storage } from '../../src/services/storage.js';
import { skuMaster } from '../catalog/skuMaster.js';
import { inventoryLedger } from '../inventory/inventoryLedger.js';

export const BIHAR_CROP_SEASONS = Object.freeze({
  KHARIF: { name: 'Kharif (Monsoon)', months: [6, 7, 8, 9, 10], primaryCrops: ['Paddy', 'Maize', 'Soybean', 'Arhar'] },
  RABI: { name: 'Rabi (Winter)', months: [10, 11, 12, 1, 2, 3], primaryCrops: ['Wheat', 'Maize', 'Mustard', 'Gram', 'Lentil', 'Potato'] },
  ZAID: { name: 'Zaid (Summer)', months: [3, 4, 5, 6], primaryCrops: ['Vegetables', 'Moong', 'Fodder', 'Melons'] }
});

class ContextEngine {
  /**
   * Identifies current active crop season in Bihar
   */
  getCurrentCropSeason(date = new Date()) {
    const month = date.getMonth() + 1; // 1-12
    for (const [key, season] of Object.entries(BIHAR_CROP_SEASONS)) {
      if (season.months.includes(month)) {
        return { key, ...season };
      }
    }
    return { key: 'RABI', ...BIHAR_CROP_SEASONS.RABI };
  }

  /**
   * Assembles comprehensive contextual dossier for a specific retailer
   */
  getRetailerContext(retailerId) {
    const rows = storage.rows || [];
    const retailer = rows.find(r => String(r.id) === String(retailerId) || r.retailer === retailerId);
    if (!retailer) return null;

    const checkIns = storage.getCheckInLogs().filter(l => l.retailer === retailer.retailer || l.retailerId === retailer.id);
    const leads = storage.getFarmerLeads().filter(l => l.retailer === retailer.retailer);
    const demos = storage.getDemoPlots().filter(d => (d.block || '').toLowerCase() === (retailer.block || '').toLowerCase());
    const intel = storage.getCompetitorIntel().filter(i => (i.block || '').toLowerCase() === (retailer.block || '').toLowerCase());

    const lastVisit = checkIns.length > 0 ? checkIns[checkIns.length - 1] : null;
    const season = this.getCurrentCropSeason();

    return {
      retailer: {
        id: retailer.id,
        name: retailer.retailer,
        hq: retailer.hq,
        block: retailer.block,
        district: retailer.district,
        mobile: retailer.mobile,
        category: retailer.potentialFor || 'Multi-Crop',
        potentialSell: retailer.potentialSell || '5000-10000',
        status: retailer.status || 'Pending',
        assignedOfficer: retailer.assistant,
        coordinates: { lat: retailer.lat, lng: retailer.lng }
      },
      season,
      history: {
        totalVisits: checkIns.length,
        lastVisitDate: lastVisit ? lastVisit.date : 'Never Visited',
        lastVisitTime: lastVisit ? lastVisit.time : null,
        lastVisitCategory: lastVisit?.visitState || (lastVisit?.distKm <= 0.2 ? 'ON_SITE' : 'REMOTE'),
        farmerDemandLeadsCount: leads.length,
        nearbyDemosCount: demos.length,
        competitorActivityAlerts: intel.slice(0, 3).map(i => `${i.competitor || 'Brand'} (${i.product})`)
      },
      suggestedAgenda: this.generateVisitAgenda(retailer, lastVisit, season)
    };
  }

  /**
   * Generates deterministic, fact-grounded visit agenda (PRD Module 34)
   */
  generateVisitAgenda(retailer, lastVisit, season) {
    const agenda = [];

    // Step 1: Verification
    if (!retailer.verifiedVisit) {
      agenda.push('Verify physical storefront GPS location and collect proprietor contact.');
    } else {
      agenda.push('Audit current counter stock levels and shelf visibility.');
    }

    // Step 2: Seasonal Demand
    agenda.push(`Pitch seasonal ${season.name} portfolio: focus on ${season.primaryCrops.slice(0, 3).join(', ')}.`);

    // Step 3: Orders & Credit
    if (retailer.potentialSell === '>20000' || retailer.potentialSell === '15000-20000') {
      agenda.push('Secure bulk pre-season booking order for certified hybrid seeds.');
    } else {
      agenda.push('Inquire on counter liquidation of introductory agrochemical starter packs.');
    }

    return agenda;
  }

  /**
   * Builds high-level territory briefing for a field officer
   */
  getTerritoryBriefing(officerName) {
    const rows = storage.rows || [];
    const assignedDealers = rows.filter(r => r.assistant === officerName);
    const logs = storage.getCheckInLogs().filter(l => l.rep === officerName);
    const pendingDealers = assignedDealers.filter(r => !r.status || r.status === 'Pending');
    const season = this.getCurrentCropSeason();

    return {
      officer: officerName,
      season: season.name,
      totalAssignedDealers: assignedDealers.length,
      contactedDealersCount: assignedDealers.length - pendingDealers.length,
      unvisitedDealersCount: pendingDealers.length,
      coverageRatePct: assignedDealers.length ? Math.round(((assignedDealers.length - pendingDealers.length) / assignedDealers.length) * 100) : 0,
      totalGpsVisitsLogged: logs.length
    };
  }
}

export const contextEngine = new ContextEngine();
