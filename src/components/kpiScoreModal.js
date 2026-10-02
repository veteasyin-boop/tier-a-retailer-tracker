// ========================================================
// MGO (ASSISTANT) 100-POINT KPI SCORECARD MODAL
// Detailed SaaS Performance Breakdown across all 6 Core SOP Pillars & Sub-Parameters
// ========================================================

import { escapeHtml } from '../utils/geo.js';
import { openAgronomyQuizModal } from './quizModal.js';
import { openEodClosingModal } from './eodModal.js';
import { openWeeklyReviewModal } from './weeklyReviewModal.js';
import { openMgoSuccessModal } from './mgoSuccessModal.js';
import { storage } from '../services/storage.js';

export function openKpiScoreModal(kpiData) {
  const existing = document.getElementById('kpiScoreModal');
  if (existing) existing.remove();

  const { assistant, totalScore, grade, breakdown, counts, tips } = kpiData;
  const audit = storage.getAssistantAqfsAudit(assistant);
  const leads = storage.getFarmerLeads().filter(l => l.assistant === assistant);

  // Funnel counts
  const awarenessCount = leads.filter(l => l.funnel_stage === 'Awareness').length;
  const interestCount = leads.filter(l => l.funnel_stage === 'Interest').length;
  const trialCount = leads.filter(l => l.funnel_stage === 'Trial').length;
  const adoptionCount = leads.filter(l => l.funnel_stage === 'Adoption').length;
  const repeatCount = leads.filter(l => l.funnel_stage === 'Repeat Demand').length;

  const modalHtml = `
    <div class="modal-backdrop open" id="kpiScoreModal">
      <div class="modal-box modal-content" style="max-width: 720px; animation: popIn 0.25s ease-out;">
        
        <!-- Header -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🏆</span>
              <h2 style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; margin: 0;">
                MGO Performance Scorecard
              </h2>
            </div>
            <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">
              ${escapeHtml(assistant)} · <strong>100-Point SOP Weighted Model</strong>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn btn-secondary btn-sm" id="btnScorecardGuide" style="font-size: 12px; font-weight: 600;">
              📖 SOP Guide
            </button>
            <button type="button" class="btn btn-secondary btn-icon" id="btnCloseKpiModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
          </div>
        </div>

        <!-- Hero Score Banner -->
        <div style="background: ${grade.bg}; border: 1.5px solid ${grade.color}; border-radius: var(--radius-md); padding: 18px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">${grade.icon}</span>
              <span style="font-weight: 800; font-size: 19px; color: ${grade.color};">${grade.label}</span>
            </div>
            <div style="font-size: 12.5px; color: var(--ink-secondary); margin-top: 4px; max-width: 400px; line-height: 1.45;">
              ${grade.desc}
            </div>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 38px; font-weight: 800; font-family: var(--font-heading); color: ${grade.color}; line-height: 1;">
              ${totalScore}<span style="font-size: 18px; font-weight: 600; color: var(--muted);">/100</span>
            </div>
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-top: 4px;">
              Weekly Weighted KPI
            </div>
          </div>
        </div>

        <!-- Farmer Progression Pipeline Funnel (KPI 3 Core) -->
        <div style="background: var(--surface-alt); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted);">
              Farmer Adoption Pipeline (SOP Progression Funnel)
            </span>
            <span style="font-size: 11.5px; font-weight: 700; color: var(--primary);">
              ${leads.length} Tracked Farmers
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; text-align: center; font-size: 11px;">
            <div style="background: var(--surface); padding: 6px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="color: var(--muted);">Awareness</div>
              <div style="font-size: 16px; font-weight: 800; color: #64748b;">${awarenessCount}</div>
            </div>
            <div style="background: var(--surface); padding: 6px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="color: var(--muted);">Interest</div>
              <div style="font-size: 16px; font-weight: 800; color: #0284c7;">${interestCount}</div>
            </div>
            <div style="background: var(--surface); padding: 6px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="color: var(--muted);">Trial</div>
              <div style="font-size: 16px; font-weight: 800; color: #7c3aed;">${trialCount}</div>
            </div>
            <div style="background: var(--surface); padding: 6px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="color: var(--muted);">Adoption</div>
              <div style="font-size: 16px; font-weight: 800; color: #16a34a;">${adoptionCount}</div>
            </div>
            <div style="background: var(--surface); padding: 6px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
              <div style="color: var(--muted);">Repeat</div>
              <div style="font-size: 16px; font-weight: 800; color: #ea580c;">${repeatCount}</div>
            </div>
          </div>
        </div>

        <!-- 6 Core Pillars & Sub-Parameters Accordion Breakdown -->
        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 800; margin: 0;">
              Evaluation Across 6 SOP Pillars
            </h4>
            <span style="font-size: 11.5px; color: var(--muted); font-weight: 600;">
              Click pillar to inspect sub-parameters
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${renderPillarAccordion('🎓 1. Education & Technical Knowledge', breakdown.p1_techKnowledge, '#0284c7')}
            ${renderPillarAccordion('🔍 2. Product & Competitor Knowledge', breakdown.p2_competitorIntel, '#7c3aed')}
            ${renderPillarAccordion('🌾 3. Farmer Engagement & Market Dev', breakdown.p3_farmerEngagement, '#16a34a')}
            ${renderPillarAccordion('📋 4. Planning, Field & Sales Support', breakdown.p4_planningSales, '#ea580c')}
            ${renderPillarAccordion('🛡️ 5. AQFS Activity Quality & Standards', breakdown.p5_aqfsQuality, '#0d9488', audit)}
            ${renderPillarAccordion('🏬 6. Dealer Feedback & Market Intel', breakdown.p6_dealerFeedback, '#d97706')}
          </div>
        </div>

        <!-- Supervisor AQFS Coaching Note (if audited) -->
        ${audit && audit.coaching_notes ? `
          <div style="background: #f0fdfa; border: 1px solid #0d9488; border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 20px; font-size: 12.5px;">
            <div style="font-weight: 700; color: #0f766e; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <span>🛡️</span> Supervisor AQFS Audit Feedback & Coaching
            </div>
            <div style="color: var(--ink-secondary); line-height: 1.5;">
              "${escapeHtml(audit.coaching_notes)}"
            </div>
          </div>
        ` : ''}

        <!-- Quick Activity Tally -->
        <div style="background: var(--surface-alt); border-radius: var(--radius-md); padding: 14px 16px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 10px;">
            Field Operations Ledger (Week-to-Date)
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; text-align: center;">
            <div style="background: var(--surface); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: var(--primary);">${counts.retailerCheckIns}</div>
              <div style="font-size: 11px; color: var(--muted);">Counter Visits</div>
            </div>
            <div style="background: var(--surface); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #16a34a;">${counts.farmerMeetings}</div>
              <div style="font-size: 11px; color: var(--muted);">Farmer Meetings</div>
            </div>
            <div style="background: var(--surface); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #7c3aed;">${counts.demoPlots}</div>
              <div style="font-size: 11px; color: var(--muted);">Demo / Trial Plots</div>
            </div>
            <div style="background: var(--surface); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #ea580c;">${counts.farmerLeads}</div>
              <div style="font-size: 11px; color: var(--muted);">Farmer Leads</div>
            </div>
            <div style="background: var(--surface); padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="font-size: 18px; font-weight: 800; color: #0284c7;">${counts.competitorEntries}</div>
              <div style="font-size: 11px; color: var(--muted);">Competitor Intel</div>
            </div>
          </div>
        </div>

        <!-- Tips to Boost Score -->
        ${tips && tips.length > 0 ? `
          <div style="background: rgba(2, 132, 199, 0.08); border-left: 4px solid var(--accent); padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 20px;">
            <div style="font-weight: 700; font-size: 13px; color: var(--accent); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>💡</span> High-Impact Opportunities to Gain Points
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--ink-secondary); line-height: 1.6;">
              ${tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Quick Action Buttons -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
          <button class="btn btn-secondary btn-sm" id="btnLaunchAgriQuiz" style="flex: 1; padding: 9px 12px; font-weight: 700; color: var(--accent); border-color: rgba(2, 132, 199, 0.4);">
            🎓 ${counts.quizCompleted ? 'Agri-Quiz (Passed)' : 'Take Agri-Quiz (+5 pts)'}
          </button>
          <button class="btn btn-secondary btn-sm" id="btnLaunchEodClose" style="flex: 1; padding: 9px 12px; font-weight: 700; color: var(--primary); border-color: rgba(34, 197, 94, 0.4);">
            ⏱️ ${counts.eodSubmitted ? 'EOD Logged' : 'Submit EOD (+5 pts)'}
          </button>
          <button class="btn btn-secondary btn-sm" id="btnLaunchWeeklyRev" style="flex: 1; padding: 9px 12px; font-weight: 700; color: #ea580c; border-color: rgba(234, 88, 12, 0.4);">
            📅 Weekly Review
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('kpiScoreModal');
  const closeBtn = document.getElementById('btnCloseKpiModal');

  const close = () => modalEl.remove();

  closeBtn?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  document.getElementById('btnScorecardGuide')?.addEventListener('click', () => {
    openMgoSuccessModal();
  });

  document.getElementById('btnLaunchAgriQuiz')?.addEventListener('click', () => {
    close();
    openAgronomyQuizModal(assistant);
  });

  document.getElementById('btnLaunchEodClose')?.addEventListener('click', () => {
    close();
    openEodClosingModal(assistant);
  });

  document.getElementById('btnLaunchWeeklyRev')?.addEventListener('click', () => {
    close();
    openWeeklyReviewModal(assistant);
  });
}

function renderPillarAccordion(title, pillarData, color, auditObj = null) {
  const { score, max, subParameters, isAudited } = pillarData;
  const pct = Math.round((score / max) * 100);

  return `
    <details style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden;">
      <summary style="padding: 10px 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 13.5px; font-weight: 700; color: var(--ink);">${escapeHtml(title)}</span>
          ${isAudited ? '<span class="badge" style="background: #f0fdfa; color: #0d9488; font-size: 10px; font-weight: 800; padding: 2px 6px;">Audited</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 14px; font-weight: 800; font-family: var(--font-heading); color: ${color};">
            ${score} <span style="font-weight: 500; font-size: 11px; color: var(--muted);">/ ${max} pts</span>
          </span>
          <span style="font-size: 12px; color: var(--muted);">▼</span>
        </div>
      </summary>

      <!-- Progress bar -->
      <div style="height: 4px; background: var(--surface-alt); width: 100%;">
        <div style="height: 100%; width: ${pct}%; background: ${color}; transition: width 0.3s ease;"></div>
      </div>

      <!-- Sub-parameters breakdown list -->
      <div style="padding: 10px 14px 12px; background: var(--surface-alt); border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px;">
        ${(subParameters || []).map(sp => `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
            <span style="color: var(--ink-secondary);">${escapeHtml(sp.name)}</span>
            <span style="font-weight: 700; font-family: var(--font-heading); color: ${color};">
              ${sp.score} <span style="color: var(--muted); font-size: 10.5px;">/ ${sp.max}</span>
            </span>
          </div>
        `).join('')}
      </div>
    </details>
  `;
}
