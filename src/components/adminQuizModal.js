// ========================================================
// ADMIN AGRONOMY QUIZ & QUESTION BANK MANAGEMENT STUDIO
// Allows Manager to supervise curriculum, add questions,
// and trigger new quiz cycles across all 8 territories.
// ========================================================

import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils/geo.js';

export function openAdminQuizModal(onUpdated) {
  const existing = document.getElementById('adminQuizModal');
  if (existing) existing.remove();

  let questions = [...storage.getQuizQuestions()];
  let showAddForm = false;

  function render() {
    const existingModal = document.getElementById('adminQuizModal');
    if (existingModal) existingModal.remove();

    const quizStates = storage.getAllQuizStates();
    const completedCount = quizStates.filter(s => s.isCompleted).length;

    const modalHtml = `
      <div class="modal-backdrop open" id="adminQuizModal">
        <div class="modal-box modal-content" style="max-width: 720px; animation: popIn 0.25s ease-out;">
          
          <!-- Header -->
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 18px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px;">🎓</span>
                <h2 style="font-family: var(--font-heading); font-size: 19px; font-weight: 800; margin: 0;">
                  Agronomy Quiz & Curriculum Studio
                </h2>
              </div>
              <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px;">
                Manage technical question bank, track field knowledge compliance, and cycle weekly assessments.
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-icon" id="btnCloseAdminQuizModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
          </div>

          <!-- Stats Strip -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 18px;">
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: var(--primary);">${questions.length}</div>
              <div style="font-size: 11px; color: var(--muted); font-weight: 600;">ACTIVE QUESTIONS</div>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #0284c7;">${completedCount}/${quizStates.length}</div>
              <div style="font-size: 11px; color: var(--muted); font-weight: 600;">REPS COMPLETED</div>
            </div>
            <div style="background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #16a34a;">+5 pts</div>
              <div style="font-size: 11px; color: var(--muted); font-weight: 600;">PILLAR 1 WEIGHT</div>
            </div>
          </div>

          <!-- Actions Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
            <button type="button" class="btn btn-primary btn-sm" id="btnToggleAddQuestion" style="font-weight: 700;">
              ${showAddForm ? '✕ Close Form' : '+ Add New Question'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnResetQuizCycle" style="color: var(--danger); border-color: rgba(220, 38, 38, 0.4); font-weight: 600;">
              🔄 Launch New Quiz Week (Reset Completion)
            </button>
          </div>

          <!-- Add Question Form (Collapsible) -->
          ${showAddForm ? `
            <div style="background: var(--surface-alt); border: 1.5px solid var(--primary); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; color: var(--primary);">
                Create New Agronomy Question
              </div>
              <form id="newQuestionForm" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Question Text *</label>
                  <input type="text" id="newQText" required placeholder="e.g. Which weed species is most prevalent in direct-seeded rice in Bhojpur?" style="padding: 9px 12px;">
                </div>

                <div class="modal-form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Option A *</label>
                    <input type="text" id="newQOpt0" required placeholder="Option A text" style="padding: 8px 10px;">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Option B *</label>
                    <input type="text" id="newQOpt1" required placeholder="Option B text" style="padding: 8px 10px;">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Option C *</label>
                    <input type="text" id="newQOpt2" required placeholder="Option C text" style="padding: 8px 10px;">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Option D *</label>
                    <input type="text" id="newQOpt3" required placeholder="Option D text" style="padding: 8px 10px;">
                  </div>
                </div>

                <div class="modal-form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Correct Option *</label>
                    <select id="newQCorrect" required style="padding: 8px 10px; font-weight: 700;">
                      <option value="0">Option A is Correct</option>
                      <option value="1">Option B is Correct</option>
                      <option value="2">Option C is Correct</option>
                      <option value="3">Option D is Correct</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Agronomic Explanation / Key Takeaway *</label>
                    <input type="text" id="newQExplanation" required placeholder="e.g. Echinochloa colona competes heavily during first 30 days..." style="padding: 8px 10px;">
                  </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
                  <button type="button" class="btn btn-secondary btn-sm" id="btnCancelAddQ">Cancel</button>
                  <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700;">Save Question to Bank</button>
                </div>
              </form>
            </div>
          ` : ''}

          <!-- Existing Question Bank List -->
          <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 10px; color: var(--ink);">
            Current Question Bank (${questions.length} Active Questions)
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
            ${questions.map((q, idx) => `
              <div style="background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 14px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                  <div style="font-weight: 700; font-size: 13px; color: var(--ink); line-height: 1.4;">
                    ${idx + 1}. ${escapeHtml(q.question)}
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm btn-delete-question" data-idx="${idx}" style="color: var(--danger); border-color: rgba(220, 38, 38, 0.3); padding: 3px 8px; font-size: 11px; flex-shrink: 0;" title="Delete this question">
                    🗑️ Remove
                  </button>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px; margin: 10px 0;">
                  ${q.options.map((opt, oIdx) => `
                    <div style="font-size: 12px; padding: 6px 10px; border-radius: var(--radius-xs); border: 1px solid ${oIdx === q.correctIndex ? 'rgba(22, 163, 74, 0.5)' : 'var(--line)'}; background: ${oIdx === q.correctIndex ? '#dcfce7' : 'var(--surface-alt)'}; color: ${oIdx === q.correctIndex ? '#14532d' : 'var(--ink)'}; font-weight: ${oIdx === q.correctIndex ? '700' : '400'};">
                      ${String.fromCharCode(65 + oIdx)}. ${escapeHtml(opt)} ${oIdx === q.correctIndex ? '✓ (Correct)' : ''}
                    </div>
                  `).join('')}
                </div>

                <div style="font-size: 11.5px; color: var(--muted); background: var(--surface-alt); padding: 6px 10px; border-radius: var(--radius-xs);">
                  💡 <strong>Explanation:</strong> ${escapeHtml(q.explanation || 'No explanation provided.')}
                </div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 18px; border-top: 1px solid var(--line); padding-top: 14px; display: flex; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="btnCloseAdminQuizModalBottom">Close Studio</button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Event Listeners
    const modalEl = document.getElementById('adminQuizModal');
    const close = () => {
      modalEl?.remove();
      if (onUpdated) onUpdated();
    };

    document.getElementById('btnCloseAdminQuizModal')?.addEventListener('click', close);
    document.getElementById('btnCloseAdminQuizModalBottom')?.addEventListener('click', close);
    modalEl?.addEventListener('click', (e) => {
      if (e.target === modalEl) close();
    });

    document.getElementById('btnToggleAddQuestion')?.addEventListener('click', () => {
      showAddForm = !showAddForm;
      render();
    });

    document.getElementById('btnCancelAddQ')?.addEventListener('click', () => {
      showAddForm = false;
      render();
    });

    // Delete question handler
    modalEl?.querySelectorAll('.btn-delete-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (questions.length <= 1) {
          showToast('At least 1 active question must remain in the Question Bank.', '⚠️');
          return;
        }
        if (confirm(`Are you sure you want to remove Question ${idx + 1}?`)) {
          questions.splice(idx, 1);
          storage.saveQuizQuestions(questions);
          showToast('Question removed from active curriculum', '🗑️');
          render();
        }
      });
    });

    // Reset quiz cycle across all assistants
    document.getElementById('btnResetQuizCycle')?.addEventListener('click', () => {
      if (confirm('Launch new quiz cycle? This will reset all field representatives\' quiz completion status for the current week, enabling them to retake the knowledge check.')) {
        storage.resetAllQuizStates();
        showToast('New Quiz Cycle Launched! Field reps can now retake this week\'s assessment.', '🔄');
        render();
      }
    });

    // Add question form submit
    document.getElementById('newQuestionForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const qText = document.getElementById('newQText').value.trim();
      const opt0 = document.getElementById('newQOpt0').value.trim();
      const opt1 = document.getElementById('newQOpt1').value.trim();
      const opt2 = document.getElementById('newQOpt2').value.trim();
      const opt3 = document.getElementById('newQOpt3').value.trim();
      const correctIdx = parseInt(document.getElementById('newQCorrect').value, 10);
      const explanation = document.getElementById('newQExplanation').value.trim();

      const newQ = {
        id: `q_${Date.now()}`,
        question: qText,
        options: [opt0, opt1, opt2, opt3],
        correctIndex: correctIdx,
        explanation: explanation
      };

      questions.push(newQ);
      storage.saveQuizQuestions(questions);
      showToast('New question successfully added to the active question bank!', '✅');
      showAddForm = false;
      render();
    });
  }

  render();
}
