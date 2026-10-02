// ========================================================
// MGO WEEKLY OPERATING REVIEW & COMMITMENTS WORKSPACE
// Section 10 of SOP: Weekly Review of Activities, Adoption & Priorities
// ========================================================

import { escapeHtml } from '../utils/geo.js';
import { storage } from '../services/storage.js';
import { auth } from '../services/auth.js';
import { showToast } from './toast.js';

export function openWeeklyReviewModal(assistantName) {
  const existing = document.getElementById('weeklyReviewModal');
  if (existing) existing.remove();

  const now = new Date();
  const weekCode = `${now.getFullYear()}-W${Math.ceil((now.getDate() + 6 - now.getDay()) / 7)}`;

  const allAssistants = storage.getAssistants();
  const asstObj = allAssistants.find(a => a.name === assistantName) || allAssistants[0];

  // Aggregated week data
  const logs = storage.getCheckInLogs().filter(l => l.rep === assistantName);
  const meetings = storage.getFarmerMeetings().filter(m => m.assistant === assistantName);
  const demos = storage.getDemoPlots().filter(d => d.assistant === assistantName);
  const intel = storage.getCompetitorIntel().filter(c => c.assistant === assistantName);
  const leads = storage.getFarmerLeads().filter(f => f.assistant === assistantName);
  const retailers = storage.rows.filter(r => r.assistant === assistantName);

  const totalAttendees = meetings.reduce((acc, m) => acc + (parseInt(m.attendees_count || m.attendeesCount || 0) || 0), 0);
  const closedCount = retailers.filter(r => r.status === 'Closed').length;
  const adoptionLeadsCount = leads.filter(l => l.funnel_stage === 'Adoption' || l.funnel_stage === 'Repeat Demand').length;

  const existingReview = storage.getAssistantWeeklyReview(assistantName, weekCode);
  const isManager = auth.isAdmin;

  const modalHtml = `
    <div class="modal-backdrop open" id="weeklyReviewModal">
      <div class="modal-box modal-content" style="max-width: 680px; animation: popIn 0.25s ease-out;">
        
        <!-- Header -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">📅</span>
              <h2 style="font-family: var(--font-heading); font-size: 19px; font-weight: 800; margin: 0;">
                MGO Weekly Operating Review
              </h2>
              <span class="badge badge-visited">${weekCode}</span>
            </div>
            <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px;">
              MGO: <strong>${escapeHtml(assistantName)}</strong> · HQ: <strong>${escapeHtml(asstObj.hq)}</strong> (${escapeHtml(asstObj.district)})
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseWeeklyModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <!-- Weekly Performance Summary Grid -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 8px;">
            Week-to-Date Execution Summary (Auto-Aggregated)
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; text-align: center;">
            <div style="background: var(--surface); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #0284c7;">${logs.length}</div>
              <div style="font-size: 11px; color: var(--muted);">Counter Visits</div>
            </div>
            <div style="background: var(--surface); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #16a34a;">${meetings.length}</div>
              <div style="font-size: 11px; color: var(--muted);">Farmer Meetings (${totalAttendees} Farmers)</div>
            </div>
            <div style="background: var(--surface); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #7c3aed;">${demos.length}</div>
              <div style="font-size: 11px; color: var(--muted);">Demo / Trial Plots</div>
            </div>
            <div style="background: var(--surface); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #ea580c;">${leads.length}</div>
              <div style="font-size: 11px; color: var(--muted);">Farmer Leads (${adoptionLeadsCount} Adopted)</div>
            </div>
            <div style="background: var(--surface); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #d97706;">${intel.length}</div>
              <div style="font-size: 11px; color: var(--muted);">Competitor Intel</div>
            </div>
            <div style="background: var(--surface); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #22c55e;">${closedCount}</div>
              <div style="font-size: 11px; color: var(--muted);">Dealers Closed</div>
            </div>
          </div>
        </div>

        <form id="weeklyReviewForm" style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Key Challenges Encountered -->
          <div class="form-group">
            <label class="form-label">1. Key Challenges & Competitor Pressure Observed *</label>
            <textarea id="reviewChallenges" rows="3" required placeholder="Detail specific territory challenges (e.g. competitor credit schemes, weather/pest attacks, dealer payment delays)..." style="padding: 10px 12px; font-size: 13px;">${escapeHtml(existingReview?.key_challenges || '')}</textarea>
          </div>

          <!-- Product Adoption & Farmer Highlights -->
          <div class="form-group">
            <label class="form-label">2. Product Adoption Highlights & Farmer Response</label>
            <textarea id="reviewHighlights" rows="2" placeholder="Highlight key farmer successes, trial plot responses, or new village clusters entered..." style="padding: 10px 12px; font-size: 13px;">${escapeHtml(existingReview?.product_highlights || '')}</textarea>
          </div>

          <!-- Next Week's Priorities & Commitments -->
          <div class="form-group">
            <label class="form-label">3. Next Week's Core Priorities & Activity Commitments *</label>
            <textarea id="reviewPriorities" rows="3" required placeholder="Specify next week's focus (e.g. 5 farmer meetings in Bihta cluster, 4 harvest yield cuts, 15 counter follow-ups)..." style="padding: 10px 12px; font-size: 13px;">${escapeHtml(existingReview?.next_week_priorities || '')}</textarea>
          </div>

          ${isManager ? `
            <!-- Manager Sign-off & Coaching Directive (Admin Mode) -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: var(--radius-sm); padding: 12px 14px;">
              <label class="form-label" style="color: #0f172a; font-weight: 700;">👑 Manager Review & Supervisory Guidance</label>
              <textarea id="reviewManagerRemarks" rows="2" placeholder="Supervisor feedback, approval notes, or joint-field working plans..." style="padding: 8px 12px; font-size: 13px;">${escapeHtml(existingReview?.manager_remarks || '')}</textarea>
            </div>
          ` : (existingReview?.manager_remarks ? `
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 12.5px;">
              <strong style="color: #166534;">👑 Manager Feedback:</strong>
              <div style="margin-top: 4px; color: var(--ink);">${escapeHtml(existingReview.manager_remarks)}</div>
            </div>
          ` : '')}

          <!-- Action Buttons -->
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; border-top: 1px solid var(--line); padding-top: 16px;">
            <button type="button" class="btn btn-secondary" id="btnCancelWeekly">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btnSaveWeekly" style="font-weight: 700; padding: 10px 24px;">
              💾 ${isManager ? 'Approve & Save Manager Review' : 'Submit Weekly Operating Review'}
            </button>
          </div>

        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('weeklyReviewModal');
  const closeBtn = document.getElementById('btnCloseWeeklyModal');
  const cancelBtn = document.getElementById('btnCancelWeekly');
  const form = document.getElementById('weeklyReviewForm');

  const close = () => modalEl.remove();

  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const reviewData = {
      id: existingReview?.id || `rev_${assistantName}_${weekCode}`,
      assistant: assistantName,
      week_code: weekCode,
      planned_visits: logs.length,
      completed_visits: logs.length,
      farmer_meetings_count: meetings.length,
      new_farmer_leads: leads.length,
      demos_active: demos.length,
      competitor_updates: intel.length,
      key_challenges: document.getElementById('reviewChallenges').value.trim(),
      product_highlights: document.getElementById('reviewHighlights').value.trim(),
      next_week_priorities: document.getElementById('reviewPriorities').value.trim(),
      status: isManager ? 'Approved' : 'Submitted',
      manager_remarks: document.getElementById('reviewManagerRemarks')?.value.trim() || existingReview?.manager_remarks || '',
      submitted_at: existingReview?.submitted_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    storage.saveWeeklyReview(reviewData);
    showToast(`Weekly Review for ${weekCode} saved successfully!`, '📅');
    close();
  });
}
