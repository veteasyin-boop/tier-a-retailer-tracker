// ========================================================
// COMPETITOR INTELLIGENCE & PRICING MODAL
// SOP Pillar 2: Product & Competitor Knowledge (15 pts)
// ========================================================

import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { CROP_PORTFOLIO } from '../services/kpiService.js';
import { escapeHtml } from '../utils/geo.js';

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function openCompetitorIntelModal(assistantInfo, defaultRetailer = null, onSaved) {
  const existing = document.getElementById('competitorIntelModal');
  if (existing) existing.remove();

  const assistantName = typeof assistantInfo === 'string' ? assistantInfo : (assistantInfo?.name || storage.getAssistants()[0]?.name || 'Field Representative');
  const assistantDistrict = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.district || 'Patna') : 'Patna';
  const assistantHq = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.hq || '') : '';
  const blocks = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.blocks || []) : [];

  const myRetailers = storage.rows.filter(r => r.assistant === assistantName);

  const modalHtml = `
    <div class="modal-backdrop open" id="competitorIntelModal">
      <div class="modal-box modal-content" style="max-width: 620px; animation: popIn 0.25s ease-out;">
        
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🔍</span>
              <h2 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">
                Log Competitor Intelligence
              </h2>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
              ${assistantName} · <strong>Pillar 2: Market & Competitor Intelligence (15 pts)</strong>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseCompetitorModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <form id="competitorForm" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">
              Source Retailer Counter (Tier A Dealer)
            </label>
            <select id="intelRetailerSelect" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px;">
              <option value="">-- General Market Observation (Not counter specific) --</option>
              ${myRetailers.map(r => `
                <option value="${r.id}" ${defaultRetailer?.id === r.id ? 'selected' : ''}>
                  ${escapeHtml(r.retailer)} (${escapeHtml(r.block)} · ${escapeHtml(r.district)})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Crop</label>
              <select id="intelCrop" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px;">
                ${CROP_PORTFOLIO.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Competitor Company / Brand</label>
              <input type="text" id="intelBrand" class="form-control" placeholder="e.g. Pioneer / Bayer / Syngenta" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Competitor Product / Variety</label>
              <input type="text" id="intelProduct" class="form-control" placeholder="e.g. Pioneer 3355 / Dekalb 9108" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Farmer Demand Sentiment</label>
              <select id="intelSentiment" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px; font-weight: 600;">
                <option value="High Demand">🔥 High Demand (Market Leader)</option>
                <option value="Neutral" selected>⚖️ Neutral / Stable Demand</option>
                <option value="Declining">📉 Declining / Farmer Complaints</option>
              </select>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Market Retail Price (₹ / bag)</label>
              <input type="number" id="intelRetailPrice" class="form-control" placeholder="e.g. 2400" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Dealer Landing Price (₹ / bag)</label>
              <input type="number" id="intelDealerPrice" class="form-control" placeholder="e.g. 2150" style="width: 100%; padding: 8px 10px; font-size: 13px;">
            </div>
          </div>

          <div>
            <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">
              Promotional Schemes & Retailer Incentive
            </label>
            <input type="text" id="intelScheme" class="form-control" placeholder="e.g. Buy 10 bags get 1 free, or Rs 50/bag early cash discount" style="width: 100%; padding: 8px 10px; font-size: 13px;">
          </div>

          <div style="display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin-top: 8px;">
            <button type="button" class="btn btn-secondary" id="btnCancelCompetitor" style="padding: 10px 18px;">Cancel</button>
            <button type="submit" class="btn btn-primary" style="padding: 10px 22px; font-weight: 700;">
              Save Intelligence (+4 pts)
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('competitorIntelModal');
  const close = () => modalEl.remove();

  document.getElementById('btnCloseCompetitorModal')?.addEventListener('click', close);
  document.getElementById('btnCancelCompetitor')?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  const form = document.getElementById('competitorForm');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const retailerId = document.getElementById('intelRetailerSelect').value;
    const retailerObj = myRetailers.find(r => r.id === retailerId);
    const crop = document.getElementById('intelCrop').value;
    const brand = document.getElementById('intelBrand').value.trim();
    const product = document.getElementById('intelProduct').value.trim();
    const sentiment = document.getElementById('intelSentiment').value;
    const retailPrice = parseFloat(document.getElementById('intelRetailPrice').value) || null;
    const dealerPrice = parseFloat(document.getElementById('intelDealerPrice').value) || null;
    const scheme = document.getElementById('intelScheme').value.trim();

    const entry = {
      id: `ci_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      assistant: assistantName,
      retailer_id: retailerId || null,
      retailer_name: retailerObj ? retailerObj.retailer : '',
      district: retailerObj ? retailerObj.district : assistantDistrict,
      block: retailerObj ? retailerObj.block : (blocks[0] || assistantHq),
      crop,
      competitor_brand: brand,
      product_name: product,
      retail_price: retailPrice,
      dealer_price: dealerPrice,
      promotional_scheme: scheme,
      farmer_sentiment: sentiment,
      date: getTodayDateStr(),
      created_at: new Date().toISOString()
    };

    storage.saveCompetitorIntel(entry);
    showToast(`Competitor Intel saved: ${brand} (${product}) at ₹${retailPrice}!`, '🔍');
    close();
    if (typeof onSaved === 'function') onSaved(entry);
  });
}
