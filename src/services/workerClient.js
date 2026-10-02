// =========================================================================
// WEB WORKER CLIENT BRIDGE
// Manages thread communication, request pooling, and fallback execution
// =========================================================================

import { optimizeTourBeatRoute, calculateCheckInJourneyKm } from '../utils/geo.js';
import { calculateAssistantScore } from './kpiService.js';

class WorkerClientService {
  constructor() {
    this.worker = null;
    this.pendingRequests = new Map();
    this.reqCounter = 0;
    this.isWorkerSupported = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

    if (this.isWorkerSupported) {
      try {
        this.worker = new Worker(new URL('../workers/geoKpiWorker.js', import.meta.url), { type: 'module' });

        this.worker.onmessage = (event) => {
          const { reqId, success, result, error } = event.data;
          if (this.pendingRequests.has(reqId)) {
            const { resolve, reject } = this.pendingRequests.get(reqId);
            this.pendingRequests.delete(reqId);
            if (success) {
              resolve(result);
            } else {
              reject(new Error(error));
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('Geo/KPI Worker error event; falling back to main thread:', err);
        };
      } catch (e) {
        console.warn('Worker initialization failed; using main thread computation fallback:', e);
        this.worker = null;
      }
    }
  }

  /**
   * Internal dispatcher sending requests to worker or invoking sync fallback
   */
  _dispatch(type, payload, fallbackFn) {
    if (this.worker) {
      const reqId = `req_${++this.reqCounter}_${Date.now()}`;
      return new Promise((resolve, reject) => {
        this.pendingRequests.set(reqId, { resolve, reject });
        this.worker.postMessage({ reqId, type, payload });
      });
    }

    // Synchronous main-thread fallback
    try {
      const res = fallbackFn();
      return Promise.resolve(res);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Optimizes TSP tour beat route on worker thread
   */
  optimizeRoute(stops, options = {}) {
    return this._dispatch('OPTIMIZE_ROUTE', { stops, options }, () => {
      return optimizeTourBeatRoute(stops, options);
    });
  }

  /**
   * Calculates actual road distance across verified check-in stops on worker thread
   */
  calculateJourney(checkInLogs, hqCoords) {
    return this._dispatch('CALCULATE_JOURNEY_KM', { checkInLogs, hqCoords }, () => {
      return calculateCheckInJourneyKm(checkInLogs, hqCoords);
    });
  }

  /**
   * Calculates 100-point MGO performance scorecard on worker thread
   */
  calculateScore(assistantName, data) {
    return this._dispatch('CALCULATE_KPI', { assistantName, data }, () => {
      return calculateAssistantScore(assistantName, data);
    });
  }
}

export const workerClient = new WorkerClientService();
