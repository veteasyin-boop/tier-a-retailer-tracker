// ========================================================
// DEMONSTRATION & TRIAL PLOT LIFECYCLE MODAL
// SOP Pillar 3: Demonstrations, Trial Plots & Adoption (25 pts)
// ========================================================

import { storage } from '../services/storage.js';
import { idbStorage } from '../services/idbStorage.js';
import { showToast } from './toast.js';
import { CROP_PORTFOLIO, DEMO_STAGES } from '../services/kpiService.js';
import { escapeHtml, detectBrowserLocation } from '../utils/geo.js';

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function openDemoPlotModal(assistantInfo, existingPlot = null, onSaved) {
  const existing = document.getElementById('demoPlotModal');
  if (existing) existing.remove();

  const assistantName = typeof assistantInfo === 'string' ? assistantInfo : (assistantInfo?.name || storage.getAssistants()[0]?.name || 'Field Representative');
  const assistantDistrict = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.district || 'Patna') : 'Patna';
  const assistantHq = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.hq || '') : '';
  const blocks = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.blocks || []) : [];

  const isEdit = Boolean(existingPlot);

  const modalHtml = `
    <div class="modal-backdrop open" id="demoPlotModal">
      <div class="modal-box modal-content" style="max-width: 620px; animation: popIn 0.25s ease-out;">
        
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🌱</span>
              <h2 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">
                ${isEdit ? 'Update Demo Plot Stage' : 'Register New Demo / Trial Plot'}
              </h2>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
              ${assistantName} · <strong>Pillar 3: Demonstrations & Trial Monitoring</strong>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseDemoModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <form id="demoForm" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Host Farmer Name</label>
              <input type="text" id="demoFarmerName" class="form-control" placeholder="e.g. Dharmendra Pandey" value="${existingPlot ? escapeHtml(existingPlot.farmer_name) : ''}" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Farmer Mobile</label>
              <input type="tel" id="demoFarmerMobile" class="form-control" placeholder="10-digit mobile" value="${existingPlot ? escapeHtml(existingPlot.farmer_mobile || '') : ''}" style="width: 100%; padding: 8px 10px; font-size: 13px;">
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Village</label>
              <input type="text" id="demoVillage" class="form-control" placeholder="Village name" value="${existingPlot ? escapeHtml(existingPlot.village) : ''}" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Block</label>
              <select id="demoBlock" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px;">
                ${blocks.length > 0 ? blocks.map(b => `<option value="${b}" ${existingPlot?.block === b ? 'selected' : ''}>${b}</option>`).join('') : `<option value="${assistantHq || 'Local'}">${assistantHq || 'Local'}</option>`}
              </select>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Crop</label>
              <select id="demoCrop" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px;">
                ${CROP_PORTFOLIO.map(c => `<option value="${c}" ${existingPlot?.crop === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Our Hybrid / Product Tested</label>
              <input type="text" id="demoHybrid" class="form-control" placeholder="e.g. Hy-Maize Gold 910" value="${existingPlot ? escapeHtml(existingPlot.hybrid_tested) : ''}" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Competitor Check Variety</label>
              <input type="text" id="demoCompetitorCheck" class="form-control" placeholder="e.g. DKC 9108 / Pioneer 3355" value="${existingPlot ? escapeHtml(existingPlot.competitor_check || '') : ''}" style="width: 100%; padding: 8px 10px; font-size: 13px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Current Growth Stage</label>
              <select id="demoStage" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px; font-weight: 700; color: var(--primary);">
                ${DEMO_STAGES.map(s => `<option value="${s}" ${existingPlot?.current_stage === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Sowing Date</label>
              <input type="date" id="demoSowingDate" class="form-control" value="${existingPlot?.sowing_date || getTodayDateStr()}" style="width: 100%; padding: 8px 10px; font-size: 13px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Yield Result (Kg/Acre) - If Harvested</label>
              <input type="number" id="demoYield" class="form-control" placeholder="e.g. 3850" value="${existingPlot?.yield_result_kg_acre || ''}" style="width: 100%; padding: 8px 10px; font-size: 13px;">
            </div>
          </div>

          <div>
            <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">
              Agronomic Observations & Comparative Performance
            </label>
            <textarea id="demoObservations" class="form-control" rows="3" placeholder="Note down vigor, cob placement, stay-green, grain luster, disease tolerance compared to the competitor plot..." style="width: 100%; padding: 8px 10px; font-size: 13px;">${existingPlot ? escapeHtml(existingPlot.observations || '') : ''}</textarea>
          </div>

          <!-- High-Res Photo Attachment stored in IndexedDB (bypasses localStorage 5MB limit) -->
          <div style="background: var(--surface-bg); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px dashed var(--line);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <label class="form-label" style="font-size: 12px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>📸</span>
                <span>Demo Plot Field Photo</span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; font-size: 10px;">IndexedDB Powered</span>
              </label>
              <span id="lblDemoPhotoStatus" style="font-size: 11px; color: var(--muted);">Optional (PNG / JPG)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="file" id="iptDemoPhoto" accept="image/*" class="form-control" style="font-size: 12px; flex: 1; padding: 5px;">
              <div id="pnlDemoPhotoThumb" style="display: none; width: 44px; height: 44px; border-radius: 6px; overflow: hidden; border: 1.5px solid #10b981; flex-shrink: 0;">
                <img id="imgDemoPhotoThumb" src="" alt="Plot Thumb" style="width: 100%; height: 100%; object-fit: cover;">
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin-top: 8px;">
            <button type="button" class="btn btn-secondary" id="btnCancelDemo" style="padding: 10px 18px;">Cancel</button>
            <button type="submit" class="btn btn-primary" style="padding: 10px 22px; font-weight: 700;">
              ${isEdit ? 'Update Demo Plot (+3.5 pts)' : 'Save Demo Plot (+3.5 pts)'}
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('demoPlotModal');
  const close = () => modalEl.remove();

  document.getElementById('btnCloseDemoModal')?.addEventListener('click', close);
  document.getElementById('btnCancelDemo')?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  const form = document.getElementById('demoForm');
  const submitBtn = form?.querySelector('button[type="submit"]');

  // Handle photo file selection and thumbnail preview
  let pickedPhotoDataUrl = null;
  let pickedPhotoName = null;

  // Load existing photo from IndexedDB if in edit mode
  if (existingPlot?.id) {
    idbStorage.getMedia(`photo_${existingPlot.id}`).then(media => {
      if (media && media.dataUrl) {
        pickedPhotoDataUrl = media.dataUrl;
        const thumbPnl = document.getElementById('pnlDemoPhotoThumb');
        const thumbImg = document.getElementById('imgDemoPhotoThumb');
        const statusLbl = document.getElementById('lblDemoPhotoStatus');
        if (thumbPnl && thumbImg) {
          thumbImg.src = media.dataUrl;
          thumbPnl.style.display = 'block';
        }
        if (statusLbl) statusLbl.textContent = 'Existing photo in IndexedDB';
      }
    }).catch(e => console.warn('Idb existing photo check:', e));
  }

  const fileInput = document.getElementById('iptDemoPhoto');
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    pickedPhotoName = file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
      pickedPhotoDataUrl = evt.target.result;
      const thumbPnl = document.getElementById('pnlDemoPhotoThumb');
      const thumbImg = document.getElementById('imgDemoPhotoThumb');
      const statusLbl = document.getElementById('lblDemoPhotoStatus');
      if (thumbPnl && thumbImg) {
        thumbImg.src = pickedPhotoDataUrl;
        thumbPnl.style.display = 'block';
      }
      if (statusLbl) {
        const kb = Math.round(file.size / 1024);
        statusLbl.textContent = `Attached: ${file.name} (${kb} KB)`;
        statusLbl.style.color = '#10b981';
      }
    };
    reader.readAsDataURL(file);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳</span> Saving Demo Plot…`;
    }

    const farmerName = document.getElementById('demoFarmerName').value.trim();
    const farmerMobile = document.getElementById('demoFarmerMobile').value.trim();
    const village = document.getElementById('demoVillage').value.trim();
    const block = document.getElementById('demoBlock').value;
    const crop = document.getElementById('demoCrop').value;
    const hybridTested = document.getElementById('demoHybrid').value.trim();
    const competitorCheck = document.getElementById('demoCompetitorCheck').value.trim();
    const currentStage = document.getElementById('demoStage').value;
    const sowingDate = document.getElementById('demoSowingDate').value;
    const yieldKg = parseFloat(document.getElementById('demoYield').value) || null;
    const observations = document.getElementById('demoObservations').value.trim();

    // Fast GPS acquisition (max 1.5s timeout) to never block user
    let coords = null;
    try {
      const loc = await Promise.race([
        detectBrowserLocation({ timeout: 1500, enableHighAccuracy: false }),
        new Promise(resolve => setTimeout(() => resolve({ success: false }), 1500))
      ]);
      if (loc && loc.success) {
        coords = loc;
      }
    } catch (err) {
      console.warn('GPS not acquired for demo plot:', err);
    }

    const plotRecord = {
      id: existingPlot ? existingPlot.id : `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      assistant: assistantName,
      farmer_name: farmerName,
      farmer_mobile: farmerMobile,
      village,
      block,
      district: assistantDistrict,
      crop,
      hybrid_tested: hybridTested,
      competitor_check: competitorCheck,
      sowing_date: sowingDate,
      current_stage: currentStage,
      yield_result_kg_acre: yieldKg,
      observations,
      lat: coords?.lat || existingPlot?.lat || null,
      lng: coords?.lng || existingPlot?.lng || null,
      photo_data_url: pickedPhotoDataUrl,
      photo_name: pickedPhotoName
    };

    try {
      storage.saveDemoPlot(plotRecord);
      showToast(`🌱 Demo Plot "${hybridTested}" in ${village} saved (+3.5 pts)`, 'success');
      close();
      if (typeof onSaved === 'function') {
        onSaved(plotRecord);
      }
    } catch (err) {
      console.error('Error saving demo plot:', err);
      showToast('Error saving demo plot: ' + err.message, 'danger');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = isEdit ? 'Update Demo Plot (+3.5 pts)' : 'Save Demo Plot (+3.5 pts)';
      }
    }
  });
}
