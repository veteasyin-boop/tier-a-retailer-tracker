// =========================================================================
// GEO TELEMETRY & 100-POINT KPI COMPUTATION WEB WORKER
// Offloads heavy TSP route optimization & corporate SOP scoring
// from the main browser thread to guarantee buttery 60fps mobile scrolling
// =========================================================================

import { calculateDistanceKm, optimizeTourBeatRoute, calculateCheckInJourneyKm } from '../utils/geo.js';
import { calculateAssistantScore } from '../services/kpiService.js';

self.onmessage = function (event) {
  const { reqId, type, payload } = event.data;

  try {
    let result = null;

    switch (type) {
      case 'OPTIMIZE_ROUTE': {
        const { stops, options } = payload;
        result = optimizeTourBeatRoute(stops, options);
        break;
      }

      case 'CALCULATE_JOURNEY_KM': {
        const { checkInLogs, hqCoords } = payload;
        result = calculateCheckInJourneyKm(checkInLogs, hqCoords);
        break;
      }

      case 'CALCULATE_KPI': {
        const { assistantName, data } = payload;
        result = calculateAssistantScore(assistantName, data);
        break;
      }

      default:
        throw new Error(`Unknown worker message type: "${type}"`);
    }

    self.postMessage({
      reqId,
      success: true,
      result
    });
  } catch (error) {
    self.postMessage({
      reqId,
      success: false,
      error: error.message || String(error)
    });
  }
};
