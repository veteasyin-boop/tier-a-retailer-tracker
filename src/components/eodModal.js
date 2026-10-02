// ========================================================
// DAILY EOD (END-OF-DAY) CLOSING REPORT MODAL
// SOP Daily Operating Cycle - Awards +5 AQFS Quality Points
// ========================================================

import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils/geo.js';

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function openEodClosingModal(assistantName) {
  const existing = document.getElementById('eodClosingModal');
  if (existing) existing.remove();

  const todayStr = getTodayDateStr();
  const existingReport = storage.getEodReport(assistantName, todayStr);
  const isAlreadySubmitted = Boolean(existingReport && existingReport.submittedAt);

  // Get today's activity stats
  const checkIns = storage.getCheckInLogs().filter(l => l.rep === assistantName && l.date === todayStr);
  const meetings = storage.getFarmerMeetings().filter(m => m.assistant === assistantName && m.date === todayStr);
  const competitor = storage.getCompetitorIntel().filter(c => c.assistant === assistantName && c.date === todayStr);

  const modalHtml = `
    <div class="modal-backdrop open" id="eodClosingModal">
      <div class="modal-box modal-content" style="max-width: 580px; animation: popIn 0.25s ease-out;">
        
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">⏱️</span>
              <h2 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">
                Daily Operating Cycle: EOD Closing
              </h2>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
              ${escapeHtml(assistantName)} · Date: <strong>${todayStr}</strong> (Cutoff: 8:30 PM)
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseEodModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        ${isAlreadySubmitted ? `
          <div style="background: var(--success-subtle); border: 1px solid var(--success); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">✅</span>
            <div style="font-size: 13px; color: #166534; font-weight: 600;">
              Today's Daily Closing Report is officially submitted! (+5 AQFS Quality Points secured).
            </div>
          </div>
        ` : `
          <div style="background: rgba(21, 128, 61, 0.08); border-left: 4px solid var(--primary); padding: 12px 14px; border-radius: var(--radius-xs); margin-bottom: 16px; font-size: 12.5px; color: var(--ink-secondary);">
            Submit your end-of-day summary to maintain execution discipline and earn <strong>+5 AQFS Points</strong>.
          </div>
        `}

        <!-- Today's Activity Summary Box -->
        <div style="background: var(--surface-alt); border-radius: var(--radius-md); padding: 14px; margin-bottom: 18px; border: 1px solid var(--line);">
          <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 8px;">
            Today's Verified Execution Summary
          </div>
          <div class="modal-form-grid-3" style="text-align: center;">
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 16px; font-weight: 800; color: var(--primary);">${checkIns.length}</div>
              <div style="font-size: 11px; color: var(--muted);">Retailer Visits</div>
            </div>
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 16px; font-weight: 800; color: #16a34a;">${meetings.length}</div>
              <div style="font-size: 11px; color: var(--muted);">Farmer Meetings</div>
            </div>
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 16px; font-weight: 800; color: #0284c7;">${competitor.length}</div>
              <div style="font-size: 11px; color: var(--muted);">Competitor Logs</div>
            </div>
          </div>
        </div>

        <form id="eodForm" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label class="form-label" style="font-size: 12.5px; font-weight: 600; display: block; margin-bottom: 4px;">
              Key Market Highlights & Farmer Demand Today
            </label>
            <textarea id="eodHighlights" class="form-control" rows="3" placeholder="e.g., High farmer interest in hybrid corn; requested trial near Bihta canal area..." style="font-size: 13px; width: 100%; border-radius: var(--radius-sm); padding: 8px 10px;" ${isAlreadySubmitted ? 'readonly' : ''} required>${existingReport ? escapeHtml(existingReport.highlights || '') : ''}</textarea>
          </div>

          <div>
            <label class="form-label" style="font-size: 12.5px; font-weight: 600; display: block; margin-bottom: 4px;">
              Tomorrow's Priority Focus
            </label>
            <input type="text" id="eodTomorrowPlan" class="form-control" placeholder="e.g., Focus on Hajipur vegetable belt & dealer stock check" value="${existingReport ? escapeHtml(existingReport.tomorrowPlan || '') : ''}" style="font-size: 13px; width: 100%; border-radius: var(--radius-sm); padding: 8px 10px;" ${isAlreadySubmitted ? 'readonly' : ''} required>
          </div>

          ${!isAlreadySubmitted ? `
            <button type="submit" class="btn btn-primary" style="padding: 12px; font-weight: 700; width: 100%; font-size: 14px; margin-top: 8px;">
              Submit EOD Closing Report (+5 AQFS pts)
            </button>
          ` : `
            <button type="button" class="btn btn-secondary" id="btnEodCloseBottom" style="padding: 10px; font-weight: 600; width: 100%;">
              Close
            </button>
          `}
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('eodClosingModal');
  const close = () => modalEl.remove();

  document.getElementById('btnCloseEodModal')?.addEventListener('click', close);
  document.getElementById('btnEodCloseBottom')?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  const form = document.getElementById('eodForm');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const highlights = document.getElementById('eodHighlights').value.trim();
    const tomorrowPlan = document.getElementById('eodTomorrowPlan').value.trim();

    storage.saveEodReport(assistantName, todayStr, {
      highlights,
      tomorrowPlan,
      retailerVisitsCount: checkIns.length,
      farmerMeetingsCount: meetings.length,
      competitorLogsCount: competitor.length
    });

    showToast('Daily EOD Closing Report submitted! +5 AQFS Quality Points secured.', '⏱️');
    close();
  });
}
