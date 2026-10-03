/**
 * GROWTA VISIT INTEGRITY & EVIDENCE ENGINE
 * Authority: GROWTA-MASTER-PRD-001 (Section 24, 25, 26 — Modules 5, 6, 7)
 */

import { calculateDistanceKm, BIHAR_BLOCKS } from '../utils/geo.js';

export const VISIT_STATES = Object.freeze({
  ON_SITE: 'ON_SITE',                   // < 150m from retailer coordinates
  NEAR_SITE: 'NEAR_SITE',               // 150m - 500m
  REMOTE: 'REMOTE',                     // > 500m
  PHONE_VISIT: 'PHONE_VISIT',           // Telephonic verification
  GPS_UNAVAILABLE: 'GPS_UNAVAILABLE',   // No device GPS fix
  REVIEW_REQUIRED: 'REVIEW_REQUIRED'    // High variance / anomaly
});

export const INTEGRITY_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  FLAGGED: 'FLAGGED',
  MANUAL_REVIEW: 'MANUAL_REVIEW'
});

/**
 * Calculates visit integrity score and categorical visit state
 */
export function evaluateVisitIntegrity({ retailer, coords, isPhoneVisit = false }) {
  if (isPhoneVisit) {
    return {
      visitState: VISIT_STATES.PHONE_VISIT,
      integrity_status: INTEGRITY_STATUS.VERIFIED,
      integrity_score: 75,
      review_reason: 'Telephonic outreach logged with dealer',
      distanceKm: 0
    };
  }

  if (!coords || !coords.lat || !coords.lng) {
    return {
      visitState: VISIT_STATES.GPS_UNAVAILABLE,
      integrity_status: INTEGRITY_STATUS.MANUAL_REVIEW,
      integrity_score: 25,
      review_reason: 'Device GPS coordinates were not provided',
      distanceKm: null
    };
  }

  // Determine target coordinates (counter coords if available, else block centroid)
  let targetLat = retailer.lat;
  let targetLng = retailer.lng;

  if (!targetLat || !targetLng) {
    const blockMeta = BIHAR_BLOCKS.find(b => b.block.toLowerCase() === (retailer.block || '').toLowerCase());
    if (blockMeta) {
      targetLat = blockMeta.lat;
      targetLng = blockMeta.lng;
    }
  }

  let distanceKm = 0;
  if (targetLat && targetLng) {
    distanceKm = calculateDistanceKm(coords.lat, coords.lng, targetLat, targetLng);
  }

  const accuracy = Number(coords.accuracy) || 15;

  // On-Site check (< 150m)
  if (distanceKm <= 0.15) {
    const score = Math.max(85, Math.min(100, Math.round(100 - accuracy * 0.4)));
    return {
      visitState: VISIT_STATES.ON_SITE,
      integrity_status: INTEGRITY_STATUS.VERIFIED,
      integrity_score: score,
      review_reason: 'Storefront perimeter verified within 150m tolerance',
      distanceKm
    };
  }

  // Near-Site check (150m - 500m)
  if (distanceKm <= 0.50) {
    const score = Math.max(70, Math.min(84, Math.round(85 - (distanceKm - 0.15) * 40)));
    return {
      visitState: VISIT_STATES.NEAR_SITE,
      integrity_status: INTEGRITY_STATUS.VERIFIED,
      integrity_score: score,
      review_reason: 'Proximity verified within 500m counter market zone',
      distanceKm
    };
  }

  // Remote check (> 500m)
  const score = Math.max(20, Math.min(55, Math.round(60 - distanceKm * 2)));
  return {
    visitState: VISIT_STATES.REMOTE,
    integrity_status: INTEGRITY_STATUS.MANUAL_REVIEW,
    integrity_score: score,
    review_reason: `Check-in recorded ${distanceKm.toFixed(2)} km from counter geocenter`,
    distanceKm
  };
}

/**
 * Watermarks a captured photo with tamper-evident audit overlay on HTML5 Canvas
 */
export async function createWatermarkedEvidence(photoDataUrl, {
  retailerName,
  block,
  district,
  repName,
  lat,
  lng,
  accuracy,
  visitState
}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        // Draw original photo
        ctx.drawImage(img, 0, 0);

        // Watermark Banner Configuration
        const bannerHeight = Math.max(80, Math.round(img.height * 0.14));
        const yStart = img.height - bannerHeight;

        // Semi-transparent gradient banner background
        const grad = ctx.createLinearGradient(0, yStart, 0, img.height);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, yStart, img.width, bannerHeight);

        // Top accent line
        ctx.fillStyle = '#16a34a'; // Growta emerald accent
        ctx.fillRect(0, yStart, img.width, Math.max(3, Math.round(bannerHeight * 0.04)));

        // Stamp Text
        const baseFontSize = Math.max(14, Math.round(bannerHeight * 0.22));
        ctx.font = `bold ${baseFontSize}px sans-serif`;
        ctx.fillStyle = '#ffffff';

        const now = new Date();
        const timeStampStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
          ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST';

        // Line 1: Retailer & Location
        ctx.fillText(`🏪 ${retailerName || 'Dealer Storefront'} (${block || ''}, ${district || ''})`, 16, yStart + baseFontSize + 8);

        // Line 2: GPS Coordinates & Accuracy
        ctx.font = `${Math.round(baseFontSize * 0.88)}px monospace`;
        ctx.fillStyle = '#38bdf8'; // Sky blue
        const gpsStr = (lat && lng) ? `📍 ${lat.toFixed(5)}°, ${lng.toFixed(5)}° (±${accuracy || 15}m) · ${visitState}` : '📍 GPS: UNAVAILABLE';
        ctx.fillText(gpsStr, 16, yStart + (baseFontSize * 2) + 12);

        // Line 3: Officer & Timestamp
        ctx.font = `${Math.round(baseFontSize * 0.82)}px sans-serif`;
        ctx.fillStyle = '#d1d5db'; // Light gray
        ctx.fillText(`🛡️ Verified by: ${repName || 'Field Officer'} · ${timeStampStr} · Growta OS`, 16, yStart + (baseFontSize * 3) + 16);

        // Export high-efficiency JPEG
        const resultUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(resultUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = photoDataUrl;
  });
}
