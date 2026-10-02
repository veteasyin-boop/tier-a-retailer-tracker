import { storage } from '../services/storage.js';
import { detectBrowserLocation } from '../utils/geo.js';
import { showToast } from './toast.js';

export function openFillDynamicFormModal(form, repInfo, onSubmitted) {
  const existing = document.getElementById('fillDynamicFormModal');
  if (existing) existing.remove();

  let capturedGps = null;

  const modalHtml = `
    <div class="modal-backdrop open" id="fillDynamicFormModal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div class="modal-box modal-content" style="max-width: 620px; width: 95%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; padding: 0; border-radius: var(--radius-md);">
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1.5px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: var(--surface);">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">📝</span>
              <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; margin: 0;">
                ${escapeHtml(form.title)}
              </h3>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
              Category: <strong style="color: var(--primary);">${escapeHtml(form.category || 'Field Survey')}</strong> · Submitting as: <strong>${escapeHtml(repInfo.name)}</strong>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseFillModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 18px 20px; overflow-y: auto; flex: 1;">
          ${form.description ? `
            <div style="background: var(--surface-alt); padding: 10px 14px; border-radius: var(--radius-xs); border: 1px solid var(--line); margin-bottom: 16px; font-size: 12.5px; color: var(--ink-secondary); line-height: 1.4;">
              📌 <strong>Objective:</strong> ${escapeHtml(form.description)}
            </div>
          ` : ''}

          <!-- GPS Verification Banner -->
          <div id="fillGpsBanner" style="background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(2, 132, 199, 0.3); padding: 10px 14px; border-radius: var(--radius-xs); margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🛰️</span>
              <span style="font-size: 12px; color: var(--muted);" id="fillGpsStatusText">Detecting current satellite GPS coordinates…</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnAcquireFormGps" style="padding: 3px 8px; font-size: 11px;">
              📍 Refresh GPS
            </button>
          </div>

          <!-- Dynamic Form Inputs -->
          <form id="dynamicSurveyForm" style="display: flex; flex-direction: column; gap: 14px;">
            ${form.fields.map(f => {
              let inputHtml = '';
              if (f.type === 'text') {
                inputHtml = `<input type="text" name="${f.id}" ${f.required ? 'required' : ''} placeholder="${escapeHtml(f.placeholder || 'Enter response...')}" style="padding: 9px 12px; font-size: 13.5px;">`;
              } else if (f.type === 'number') {
                inputHtml = `<input type="number" step="any" name="${f.id}" ${f.required ? 'required' : ''} placeholder="${escapeHtml(f.placeholder || 'Enter numeric value...')}" style="padding: 9px 12px; font-size: 13.5px;">`;
              } else if (f.type === 'select') {
                inputHtml = `
                  <select name="${f.id}" ${f.required ? 'required' : ''} style="padding: 9px 12px; font-size: 13.5px;">
                    <option value="">Select option…</option>
                    ${(f.options || []).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
                  </select>
                `;
              } else if (f.type === 'toggle') {
                inputHtml = `
                  <select name="${f.id}" ${f.required ? 'required' : ''} style="padding: 9px 12px; font-size: 13.5px;">
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                `;
              } else if (f.type === 'date') {
                inputHtml = `<input type="date" name="${f.id}" ${f.required ? 'required' : ''} style="padding: 8px 12px; font-size: 13px;">`;
              }

              return `
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700; font-size: 13px;">
                    ${escapeHtml(f.label)} ${f.required ? '<span style="color: var(--danger);">*</span>' : '<span style="font-weight: 400; color: var(--muted);">(Optional)</span>'}
                  </label>
                  ${inputHtml}
                </div>
              `;
            }).join('')}
          </form>
        </div>

        <!-- Footer -->
        <div style="padding: 12px 20px; border-top: 1.5px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: var(--surface);">
          <button type="button" class="btn btn-secondary btn-sm" id="btnCloseFillModalBottom">Cancel</button>
          <button type="button" class="btn btn-primary" id="btnSubmitDynamicForm" style="padding: 9px 22px; font-weight: 800;">
            🚀 Submit Survey Response
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('fillDynamicFormModal');
  const close = () => modalEl?.remove();

  document.getElementById('btnCloseFillModal')?.addEventListener('click', close);
  document.getElementById('btnCloseFillModalBottom')?.addEventListener('click', close);

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  // Acquire GPS coordinates
  async function refreshGps() {
    const statusText = document.getElementById('fillGpsStatusText');
    if (statusText) statusText.textContent = 'Acquiring satellite GPS lock…';
    try {
      const loc = await detectBrowserLocation({ timeout: 5000 });
      if (loc.success) {
        capturedGps = { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy };
        if (statusText) {
          statusText.innerHTML = `<strong>GPS Locked:</strong> ${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}° (±${loc.accuracy || 15}m)`;
        }
      } else {
        capturedGps = null;
        if (statusText) statusText.textContent = 'GPS permission unavailable. Station default will apply.';
      }
    } catch (e) {
      if (statusText) statusText.textContent = 'GPS lock pending.';
    }
  }

  refreshGps();
  document.getElementById('btnAcquireFormGps')?.addEventListener('click', refreshGps);

  // Submit Handler
  document.getElementById('btnSubmitDynamicForm')?.addEventListener('click', () => {
    const formEl = document.getElementById('dynamicSurveyForm');
    if (!formEl.reportValidity()) return;

    const answers = {};
    form.fields.forEach(f => {
      const input = formEl.elements[f.id];
      if (input) {
        answers[f.id] = input.value;
      }
    });

    storage.saveFormSubmission(form.id, answers, repInfo.name, capturedGps);
    showToast(`Survey "${form.title}" submitted successfully! +5 SOP Points`, '🎉');
    close();
    if (typeof onSubmitted === 'function') onSubmitted();
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
