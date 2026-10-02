// ========================================================
// FARMER ENGAGEMENT & FIELD MEETING MODAL
// SOP Pillar 3: Farmer Engagement & Market Development (25 pts)
// ========================================================

import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { CROP_PORTFOLIO } from '../services/kpiService.js';
import { detectBrowserLocation } from '../utils/geo.js';

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function openFarmerMeetingModal(assistantInfo, onSaved) {
  const existing = document.getElementById('farmerMeetingModal');
  if (existing) existing.remove();

  const assistantName = typeof assistantInfo === 'string' ? assistantInfo : (assistantInfo?.name || storage.getAssistants()[0]?.name || 'Field Representative');
  const assistantDistrict = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.district || 'Patna') : 'Patna';
  const assistantHq = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.hq || '') : '';
  const blocks = (typeof assistantInfo === 'object' && assistantInfo) ? (assistantInfo.blocks || []) : [];

  const modalHtml = `
    <div class="modal-backdrop open" id="farmerMeetingModal">
      <div class="modal-box modal-content" style="max-width: 620px; animation: popIn 0.25s ease-out;">
        
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🌾</span>
              <h2 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">
                Log Farmer Meeting / Field Day
              </h2>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
              ${assistantName} · <strong>Pillar 3: Farmer Engagement (25 pts)</strong>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseMeetingModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <form id="meetingForm" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Meeting Format</label>
              <select id="meetingType" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px;">
                <option value="Group Meeting">Small Group Meeting (8–15 farmers)</option>
                <option value="Field Day">Field Day at Demo Plot (15–30 farmers)</option>
                <option value="Mega Meeting">Mega Village Farmer Meeting (30+ farmers)</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Crop Focus</label>
              <select id="meetingCrop" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px;">
                ${CROP_PORTFOLIO.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Village Name</label>
              <input type="text" id="meetingVillage" class="form-control" placeholder="e.g. Sikaria" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Block</label>
              <select id="meetingBlock" class="form-control" style="width: 100%; padding: 8px 10px; font-size: 13px;">
                ${blocks.length > 0 ? blocks.map(b => `<option value="${b}">${b}</option>`).join('') : `<option value="${assistantHq || 'Local'}">${assistantHq || 'Local'}</option>`}
              </select>
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Total Farmer Attendees</label>
              <input type="number" id="meetingAttendees" class="form-control" min="1" value="12" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
            <div>
              <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">Date</label>
              <input type="date" id="meetingDate" class="form-control" value="${getTodayDateStr()}" style="width: 100%; padding: 8px 10px; font-size: 13px;" required>
            </div>
          </div>

          <!-- Key Lead Farmer Contact -->
          <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
            <div style="font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 8px;">
              Primary Lead Farmer Contact (Progression Tracking)
            </div>
            <div class="modal-form-grid-2">
              <input type="text" id="leadFarmerName" class="form-control" placeholder="Lead Farmer Name" style="font-size: 12.5px; padding: 7px 10px;">
              <input type="tel" id="leadFarmerMobile" class="form-control" placeholder="Mobile Number (10 digits)" style="font-size: 12.5px; padding: 7px 10px;">
            </div>
          </div>

          <div>
            <label class="form-label" style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">
              Key Discussion & Farmer Feedback
            </label>
            <textarea id="meetingDiscussion" class="form-control" rows="3" placeholder="Discussed product features, weed management, yield expectations. Farmers expressed interest in ordering through local dealer..." style="width: 100%; padding: 8px 10px; font-size: 13px;" required></textarea>
          </div>

          <div style="display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin-top: 8px;">
            <button type="button" class="btn btn-secondary" id="btnCancelMeeting" style="padding: 10px 18px;">Cancel</button>
            <button type="submit" class="btn btn-primary" style="padding: 10px 22px; font-weight: 700;">
              Save Farmer Meeting (+5 pts)
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('farmerMeetingModal');
  const close = () => modalEl.remove();

  document.getElementById('btnCloseMeetingModal')?.addEventListener('click', close);
  document.getElementById('btnCancelMeeting')?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  const form = document.getElementById('meetingForm');
  const submitBtn = form?.querySelector('button[type="submit"]');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳</span> Saving Farmer Meeting…`;
    }

    const meetingType = document.getElementById('meetingType').value;
    const crop = document.getElementById('meetingCrop').value;
    const village = document.getElementById('meetingVillage').value.trim();
    const block = document.getElementById('meetingBlock').value;
    const attendeesCount = parseInt(document.getElementById('meetingAttendees').value, 10) || 0;
    const date = document.getElementById('meetingDate').value;
    const leadName = document.getElementById('leadFarmerName').value.trim();
    const leadMobile = document.getElementById('leadFarmerMobile').value.trim();
    const discussion = document.getElementById('meetingDiscussion').value.trim();

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
      console.warn('GPS not acquired for meeting:', err);
    }

    const meetingRecord = {
      id: `fm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      assistant: assistantName,
      village,
      block,
      district: assistantDistrict,
      crop,
      meeting_type: meetingType,
      attendees_count: attendeesCount,
      lead_farmers: leadName ? [{ name: leadName, mobile: leadMobile, acre: 2 }] : [],
      key_discussion: discussion,
      date,
      lat: coords?.lat || null,
      lng: coords?.lng || null,
      created_at: new Date().toISOString()
    };

    try {
      storage.saveFarmerMeeting(meetingRecord);
      showToast(`🌾 Farmer Meeting saved! ${attendeesCount} farmers in ${village} (+5 KPI pts)`, 'success');
      close();
      if (typeof onSaved === 'function') {
        onSaved(meetingRecord);
      }
    } catch (err) {
      console.error('Error saving farmer meeting:', err);
      showToast('Error saving meeting: ' + err.message, 'danger');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Save Farmer Meeting (+5 pts)`;
      }
    }
  });
}
