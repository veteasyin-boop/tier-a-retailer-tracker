// ========================================================
// MGO FARMER LEAD & MARKET DEVELOPMENT CRM MODAL
// Captures farmer profile, funnel stage, follow-up & dealer liquidation
// Funnel: Awareness → Interest → Trial → Adoption → Repeat Demand
// ========================================================

import { escapeHtml } from '../utils/geo.js';
import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { CROP_PORTFOLIO, FARMER_LEAD_STAGES } from '../services/kpiService.js';

export function openFarmerLeadModal(assistantName, existingLead = null, onSaved = null) {
  const existing = document.getElementById('farmerLeadModal');
  if (existing) existing.remove();

  const isEdit = Boolean(existingLead && existingLead.id);
  const title = isEdit ? 'Edit Farmer Lead' : 'Register New Farmer Lead';

  // Get assistant info and station retailers for counter liquidation linkage
  const allAssistants = storage.getAssistants();
  const asstObj = allAssistants.find(a => a.name === assistantName) || allAssistants[0];
  const stationRetailers = storage.rows.filter(r => r.assistant === assistantName);

  const defaultCrop = existingLead?.crop || CROP_PORTFOLIO[0];
  const defaultStage = existingLead?.funnel_stage || 'Interest';
  const defaultCategory = existingLead?.farmer_category || 'Progressive';

  const modalHtml = `
    <div class="modal-backdrop open" id="farmerLeadModal">
      <div class="modal-box modal-content" style="max-width: 620px; animation: popIn 0.25s ease-out;">
        
        <!-- Header -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🌾</span>
              <h2 style="font-family: var(--font-heading); font-size: 19px; font-weight: 800; margin: 0;">
                ${escapeHtml(title)}
              </h2>
            </div>
            <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px;">
              MGO Farmer Pipeline · <strong>Awareness → Interest → Trial → Adoption → Repeat Demand</strong>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseLeadModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <form id="farmerLeadForm" style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Assistant & Territory Info -->
          <div style="background: var(--surface-alt); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 12px; flex-wrap: wrap; gap: 6px;">
            <div>MGO: <strong>${escapeHtml(assistantName)}</strong></div>
            <div>HQ: <strong>${escapeHtml(asstObj.hq)}</strong> (${escapeHtml(asstObj.district)})</div>
          </div>

          <!-- Farmer Name & Mobile -->
          <div class="modal-form-grid-2">
            <div class="form-group">
              <label class="form-label">Farmer Name *</label>
              <input type="text" id="leadFarmerName" required placeholder="e.g. Rameshwar Singh" value="${escapeHtml(existingLead?.farmer_name || '')}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
            <div class="form-group">
              <label class="form-label">Mobile Number *</label>
              <input type="tel" id="leadFarmerMobile" required pattern="[0-9]{10}" placeholder="10-digit mobile" value="${escapeHtml(existingLead?.mobile || '')}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
          </div>

          <!-- Village & Block -->
          <div class="modal-form-grid-2">
            <div class="form-group">
              <label class="form-label">Village / Tola *</label>
              <input type="text" id="leadVillage" required placeholder="e.g. Sikaria" value="${escapeHtml(existingLead?.village || '')}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
            <div class="form-group">
              <label class="form-label">Block *</label>
              <input type="text" id="leadBlock" required placeholder="e.g. Bihta" value="${escapeHtml(existingLead?.block || asstObj.hq)}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
          </div>

          <!-- Crop & Acreage -->
          <div class="modal-form-grid-12-08">
            <div class="form-group">
              <label class="form-label">Target Crop *</label>
              <select id="leadCrop" required style="padding: 9px 12px; font-size: 13.5px;">
                ${CROP_PORTFOLIO.map(c => `
                  <option value="${escapeHtml(c)}" ${c === defaultCrop ? 'selected' : ''}>${escapeHtml(c)}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Total Acreage *</label>
              <input type="number" id="leadAcreage" step="0.5" min="0.5" required placeholder="e.g. 4.0" value="${existingLead?.acreage || 3.0}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
          </div>

          <!-- Farmer Category & Target Product -->
          <div class="modal-form-grid-2">
            <div class="form-group">
              <label class="form-label">Farmer Category *</label>
              <select id="leadCategory" required style="padding: 9px 12px; font-size: 13.5px;">
                <option value="Progressive" ${defaultCategory === 'Progressive' ? 'selected' : ''}>🌟 Progressive Farmer (Early Adopter)</option>
                <option value="Influential" ${defaultCategory === 'Influential' ? 'selected' : ''}>👑 Influential (Mukhiya / Key Opinion Leader)</option>
                <option value="Commercial" ${defaultCategory === 'Commercial' ? 'selected' : ''}>🚜 Commercial / Large Scale</option>
                <option value="Smallholder" ${defaultCategory === 'Smallholder' ? 'selected' : ''}>🌾 Smallholder Farmer</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Product / Hybrid Pitch *</label>
              <input type="text" id="leadProduct" required placeholder="e.g. Hy-Maize Gold 910" value="${escapeHtml(existingLead?.product_interest || 'Hy-Maize Gold 910')}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
          </div>

          <!-- Funnel Stage & Estimated Demand -->
          <div class="modal-form-grid-2">
            <div class="form-group">
              <label class="form-label">Current Funnel Stage *</label>
              <select id="leadStage" required style="padding: 9px 12px; font-size: 13.5px; font-weight: 700;">
                ${FARMER_LEAD_STAGES.map(s => `
                  <option value="${escapeHtml(s)}" ${s === defaultStage ? 'selected' : ''}>
                    ${s === 'Awareness' ? '📣' : s === 'Interest' ? '💡' : s === 'Trial' ? '🌱' : s === 'Adoption' ? '⭐' : '🔁'} ${escapeHtml(s)}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Estimated Demand (Bags/Pkt)</label>
              <input type="number" id="leadDemandBags" min="1" placeholder="e.g. 5" value="${existingLead?.demand_volume_bags || 4}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
          </div>

          <!-- Dealer Liquidation Linkage (KPI 4 Sales Support) -->
          <div class="form-group">
            <label class="form-label" style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
              <span>Assigned Dealer Counter (For Liquidation) *</span>
              <span style="font-size: 11px; color: var(--accent); font-weight: 600;">Demand Liquidation Link</span>
            </label>
            <select id="leadAssignedDealer" style="padding: 9px 12px; font-size: 13.5px; width: 100%; max-width: 100%;">
              <option value="">Choose local dealer counter…</option>
              ${stationRetailers.map(r => `
                <option value="${escapeHtml(r.id)}|${escapeHtml(r.retailer)}" ${(existingLead?.assigned_dealer_id === r.id || (!existingLead && stationRetailers[0]?.id === r.id)) ? 'selected' : ''}>
                  ${escapeHtml(r.retailer)} (${escapeHtml(r.block)})
                </option>
              `).join('')}
            </select>
            <span style="font-size: 11px; color: var(--muted); margin-top: 3px;">
              Linking farmer demand to a retailer counter directly helps convert inquiries into dealer orders.
            </span>
          </div>

          <!-- Follow-Up Date & Notes -->
          <div class="modal-form-grid-1-2">
            <div class="form-group">
              <label class="form-label">Next Follow-Up Date *</label>
              <input type="date" id="leadFollowUpDate" required value="${existingLead?.follow_up_date || getFutureDateStr(3)}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
            <div class="form-group">
              <label class="form-label">Follow-Up Action / Farmer Notes</label>
              <input type="text" id="leadNotes" placeholder="e.g. Bring sample cob & arrange dealer pickup" value="${escapeHtml(existingLead?.follow_up_notes || '')}" style="padding: 9px 12px; font-size: 13.5px;">
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; border-top: 1px solid var(--line); padding-top: 16px;">
            <button type="button" class="btn btn-secondary" id="btnCancelLead">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btnSaveLead" style="font-weight: 700; padding: 10px 22px;">
              💾 ${isEdit ? 'Update Farmer Lead' : 'Save & Link Farmer Lead'}
            </button>
          </div>

        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('farmerLeadModal');
  const closeBtn = document.getElementById('btnCloseLeadModal');
  const cancelBtn = document.getElementById('btnCancelLead');
  const form = document.getElementById('farmerLeadForm');

  const close = () => modalEl.remove();

  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const dealerVal = document.getElementById('leadAssignedDealer').value || '';
    const [dealerId, dealerName] = dealerVal ? dealerVal.split('|') : ['', ''];

    const leadData = {
      id: existingLead?.id || `fl_${Date.now()}`,
      assistant: assistantName,
      farmer_name: document.getElementById('leadFarmerName').value.trim(),
      mobile: document.getElementById('leadFarmerMobile').value.trim(),
      village: document.getElementById('leadVillage').value.trim(),
      block: document.getElementById('leadBlock').value.trim(),
      district: asstObj.district,
      crop: document.getElementById('leadCrop').value,
      acreage: parseFloat(document.getElementById('leadAcreage').value) || 1.0,
      farmer_category: document.getElementById('leadCategory').value,
      product_interest: document.getElementById('leadProduct').value.trim(),
      funnel_stage: document.getElementById('leadStage').value,
      assigned_dealer_id: dealerId || null,
      assigned_dealer_name: dealerName || null,
      demand_volume_bags: parseInt(document.getElementById('leadDemandBags').value) || 2,
      follow_up_date: document.getElementById('leadFollowUpDate').value,
      follow_up_notes: document.getElementById('leadNotes').value.trim(),
      created_at: existingLead?.created_at || new Date().toISOString()
    };

    try {
      storage.saveFarmerLead(leadData);
      showToast(`🌾 Farmer lead for ${leadData.farmer_name} logged at "${leadData.funnel_stage}" stage!`, 'success');
      close();
      if (typeof onSaved === 'function') {
        onSaved(leadData);
      }
    } catch (err) {
      console.error('Error saving farmer lead:', err);
      showToast('Error saving lead: ' + err.message, 'danger');
    }
  });
}

function getFutureDateStr(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
