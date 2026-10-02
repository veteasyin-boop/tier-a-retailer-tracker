// ========================================================
// AQFS ACTIVITY QUALITY & FIELD STANDARDS AUDIT STUDIO
// Manager / Supervisor Field Audit Interface (KPI 5 - 15 Points)
// "Quality of execution is as important as quantity of activities."
// ========================================================

import { escapeHtml } from '../utils/geo.js';
import { storage } from '../services/storage.js';
import { showToast } from './toast.js';

export function openAqfsAuditModal(assistantName) {
  const existing = document.getElementById('aqfsAuditModal');
  if (existing) existing.remove();

  const allAssistants = storage.getAssistants();
  const asstObj = allAssistants.find(a => a.name === assistantName) || allAssistants[0];

  // Retrieve current activity evidence
  const allLogs = storage.getCheckInLogs().filter(l => l.rep === assistantName);
  const repMeetings = storage.getFarmerMeetings().filter(m => m.assistant === assistantName);
  const repDemos = storage.getDemoPlots().filter(d => d.assistant === assistantName);
  const repIntel = storage.getCompetitorIntel().filter(c => c.assistant === assistantName);
  const repLeads = storage.getFarmerLeads().filter(f => f.assistant === assistantName);

  // Existing audit if any
  const existingAudit = storage.getAssistantAqfsAudit(assistantName);
  const scores = existingAudit?.scores || {
    compliance: 3.5,
    quality: 3.5,
    documentation: 2.5,
    followup: 2.0,
    accuracy: 2.0
  };

  // Verifiable stats
  const accurateGpsCount = allLogs.filter(l => l.accuracy && l.accuracy <= 50).length;
  const verifiedProxCount = allLogs.filter(l => l.distKm !== null && l.distKm <= 0.15).length;
  const proxPct = allLogs.length ? Math.round((verifiedProxCount / allLogs.length) * 100) : 0;

  const currentTotal = Math.min(15, (scores.compliance + scores.quality + scores.documentation + scores.followup + scores.accuracy));

  const modalHtml = `
    <div class="modal-backdrop open" id="aqfsAuditModal">
      <div class="modal-box modal-content" style="max-width: 680px; animation: popIn 0.25s ease-out;">
        
        <!-- Header -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🛡️</span>
              <h2 style="font-family: var(--font-heading); font-size: 19px; font-weight: 800; margin: 0;">
                AQFS Field Quality Audit Studio
              </h2>
            </div>
            <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px;">
              Auditing <strong>${escapeHtml(assistantName)}</strong> · HQ: <strong>${escapeHtml(asstObj.hq)}</strong> (${escapeHtml(asstObj.district)})
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseAuditModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <!-- Management Principle Alert -->
        <div style="background: rgba(13, 148, 136, 0.08); border-left: 4px solid #0d9488; padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 18px; font-size: 12.5px; color: var(--ink-secondary); line-height: 1.5;">
          <strong>Core Management Principle:</strong> Quality of execution is as important as quantity of activities. An activity is not evaluated solely on completion, but on protocol adherence, technical accuracy, documentation, and business outcome.
        </div>

        <!-- Activity Evidence Summary Strip -->
        <div style="background: var(--surface-alt); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 8px;">
            Verified Field Evidence Ledger
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(115px, 1fr)); gap: 8px; text-align: center; font-size: 12px;">
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-weight: 800; color: #0284c7; font-size: 16px;">${allLogs.length}</div>
              <div style="color: var(--muted); font-size: 11px;">Counter Visits (${proxPct}% &lt;150m)</div>
            </div>
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-weight: 800; color: #16a34a; font-size: 16px;">${repMeetings.length}</div>
              <div style="color: var(--muted); font-size: 11px;">Farmer Meetings</div>
            </div>
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-weight: 800; color: #7c3aed; font-size: 16px;">${repDemos.length}</div>
              <div style="color: var(--muted); font-size: 11px;">Active Demo Plots</div>
            </div>
            <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="font-weight: 800; color: #ea580c; font-size: 16px;">${repLeads.length}</div>
              <div style="color: var(--muted); font-size: 11px;">Farmer Leads Logged</div>
            </div>
          </div>
        </div>

        <!-- 5 Sub-Parameters Grading Form -->
        <form id="aqfsAuditForm" style="display: flex; flex-direction: column; gap: 16px;">

          <!-- Score Tally Banner -->
          <div style="background: #f0fdfa; border: 1.5px solid #0d9488; border-radius: var(--radius-md); padding: 12px 18px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #0f766e;">Total Audited AQFS Score</div>
              <div style="font-size: 11.5px; color: var(--muted);">Directly updates KPI Pillar 5 in the 100-point framework</div>
            </div>
            <div style="font-size: 26px; font-weight: 800; font-family: var(--font-heading); color: #0d9488;">
              <span id="auditLiveTotal">${currentTotal.toFixed(1)}</span> <span style="font-size: 16px; color: var(--muted);">/ 15.0</span>
            </div>
          </div>

          <!-- Parameter 1: Compliance with Activity Standards (4 pts) -->
          <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div>
                <strong style="font-size: 13.5px;">1. Compliance with Activity Standards</strong>
                <div style="font-size: 11.5px; color: var(--muted);">Protocol followed for demos, farmer meetings & GPS check-in proximity</div>
              </div>
              <div style="font-weight: 800; color: #0d9488; font-size: 14px;">
                <span id="val_compliance">${scores.compliance}</span> / 4.0
              </div>
            </div>
            <input type="range" id="slider_compliance" min="0" max="4.0" step="0.5" value="${scores.compliance}" style="width: 100%; accent-color: #0d9488;">
          </div>

          <!-- Parameter 2: Quality of Execution (4 pts) -->
          <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div>
                <strong style="font-size: 13.5px;">2. Quality of Execution</strong>
                <div style="font-size: 11.5px; color: var(--muted);">Depth of farmer engagement, agronomy diagnosis accuracy, clear objectives</div>
              </div>
              <div style="font-weight: 800; color: #0d9488; font-size: 14px;">
                <span id="val_quality">${scores.quality}</span> / 4.0
              </div>
            </div>
            <input type="range" id="slider_quality" min="0" max="4.0" step="0.5" value="${scores.quality}" style="width: 100%; accent-color: #0d9488;">
          </div>

          <!-- Parameter 3: Documentation & Reporting (3 pts) -->
          <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div>
                <strong style="font-size: 13.5px;">3. Documentation & Reporting</strong>
                <div style="font-size: 11.5px; color: var(--muted);">Completeness of records, attendee lists, trial plot observations, timely EOD report</div>
              </div>
              <div style="font-weight: 800; color: #0d9488; font-size: 14px;">
                <span id="val_documentation">${scores.documentation}</span> / 3.0
              </div>
            </div>
            <input type="range" id="slider_documentation" min="0" max="3.0" step="0.5" value="${scores.documentation}" style="width: 100%; accent-color: #0d9488;">
          </div>

          <!-- Parameter 4: Follow-up Discipline (2 pts) -->
          <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div>
                <strong style="font-size: 13.5px;">4. Follow-up Discipline</strong>
                <div style="font-size: 11.5px; color: var(--muted);">Timely farmer lead follow-ups, trial plot monitoring across key crop stages</div>
              </div>
              <div style="font-weight: 800; color: #0d9488; font-size: 14px;">
                <span id="val_followup">${scores.followup}</span> / 2.0
              </div>
            </div>
            <input type="range" id="slider_followup" min="0" max="2.0" step="0.5" value="${scores.followup}" style="width: 100%; accent-color: #0d9488;">
          </div>

          <!-- Parameter 5: Accuracy & Transparency (2 pts) -->
          <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div>
                <strong style="font-size: 13.5px;">5. Accuracy & Transparency</strong>
                <div style="font-size: 11.5px; color: var(--muted);">Honesty in reporting, avoidance of unverified competitor claims, high GPS accuracy</div>
              </div>
              <div style="font-weight: 800; color: #0d9488; font-size: 14px;">
                <span id="val_accuracy">${scores.accuracy}</span> / 2.0
              </div>
            </div>
            <input type="range" id="slider_accuracy" min="0" max="2.0" step="0.5" value="${scores.accuracy}" style="width: 100%; accent-color: #0d9488;">
          </div>

          <!-- Manager Coaching & Directives -->
          <div class="form-group">
            <label class="form-label">Supervisor Coaching Remarks & Action Directives</label>
            <textarea id="auditCoachingNotes" rows="3" placeholder="Provide constructive feedback on field quality, farmer meeting presentation, or documentation..." style="padding: 10px 12px; font-size: 13px;">${escapeHtml(existingAudit?.coaching_notes || '')}</textarea>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; border-top: 1px solid var(--line); padding-top: 16px;">
            <button type="button" class="btn btn-secondary" id="btnCancelAudit">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btnSaveAudit" style="font-weight: 700; padding: 10px 24px; background: #0d9488; border-color: #0f766e;">
              🛡️ Save & Publish AQFS Audit Score
            </button>
          </div>

        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('aqfsAuditModal');
  const closeBtn = document.getElementById('btnCloseAuditModal');
  const cancelBtn = document.getElementById('btnCancelAudit');
  const form = document.getElementById('aqfsAuditForm');

  const close = () => modalEl.remove();

  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  // Sliders dynamic recalculation
  const sliders = ['compliance', 'quality', 'documentation', 'followup', 'accuracy'];
  const updateAuditTotal = () => {
    let tot = 0;
    sliders.forEach(key => {
      const val = parseFloat(document.getElementById(`slider_${key}`).value) || 0;
      document.getElementById(`val_${key}`).textContent = val.toFixed(1);
      tot += val;
    });
    document.getElementById('auditLiveTotal').textContent = Math.min(15, tot).toFixed(1);
  };

  sliders.forEach(key => {
    document.getElementById(`slider_${key}`)?.addEventListener('input', updateAuditTotal);
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const currentScores = {
      compliance: parseFloat(document.getElementById('slider_compliance').value) || 0,
      quality: parseFloat(document.getElementById('slider_quality').value) || 0,
      documentation: parseFloat(document.getElementById('slider_documentation').value) || 0,
      followup: parseFloat(document.getElementById('slider_followup').value) || 0,
      accuracy: parseFloat(document.getElementById('slider_accuracy').value) || 0
    };

    const totalAuditScore = Math.min(15, Object.values(currentScores).reduce((a, b) => a + b, 0));
    const now = new Date();
    const weekCode = `${now.getFullYear()}-W${Math.ceil((now.getDate() + 6 - now.getDay()) / 7)}`;

    const auditData = {
      id: existingAudit?.id || `audit_${Date.now()}`,
      assistant: assistantName,
      auditor: 'Regional Sales Manager',
      week_code: weekCode,
      scores: currentScores,
      total_aqfs_score: totalAuditScore,
      coaching_notes: document.getElementById('auditCoachingNotes').value.trim(),
      updated_at: new Date().toISOString()
    };

    storage.saveAqfsAudit(auditData);
    showToast(`AQFS Audit published for ${assistantName} (${totalAuditScore}/15 pts)!`, '🛡️');
    close();
  });
}
