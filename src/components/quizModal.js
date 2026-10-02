// ========================================================
// WEEKLY AGRONOMY & PRODUCT KNOWLEDGE QUIZ MODAL
// Awards up to 5 points to Pillar 1 (Education & Technical)
// ========================================================

import { AGRONOMY_QUIZ_QUESTIONS } from '../services/kpiService.js';
import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils/geo.js';

export function openAgronomyQuizModal(assistantName) {
  const existing = document.getElementById('agronomyQuizModal');
  if (existing) existing.remove();

  const savedQuiz = storage.getQuizState(assistantName);
  const alreadyDone = Boolean(savedQuiz && savedQuiz.completedAt);

  const quizQuestions = storage.getQuizQuestions();
  let currentAnswers = savedQuiz ? (savedQuiz.answers || {}) : {};

  const modalHtml = `
    <div class="modal-backdrop open" id="agronomyQuizModal">
      <div class="modal-box modal-content" style="max-width: 600px; animation: popIn 0.25s ease-out;">
        
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">🎓</span>
              <h2 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">
                Weekly Agronomy Knowledge Check
              </h2>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
              Pillar 1: Technical Knowledge & Field Advisory (+5 KPI Points)
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseQuizModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        ${alreadyDone ? `
          <div style="background: var(--success-subtle); border: 1px solid var(--success); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">✅</span>
            <div style="font-size: 13px; color: #166534; font-weight: 600;">
              You have completed this week's technical knowledge assessment! (+5 points awarded to Pillar 1).
            </div>
          </div>
        ` : `
          <div style="background: rgba(2, 132, 199, 0.08); border-left: 4px solid var(--accent); padding: 10px 14px; border-radius: var(--radius-xs); margin-bottom: 16px; font-size: 12.5px; color: var(--ink-secondary);">
            Answer ${quizQuestions.length} quick crop agronomy and field standard questions to confirm your technical knowledge points for this week.
          </div>
        `}

        <form id="quizForm" style="display: flex; flex-direction: column; gap: 18px;">
          ${quizQuestions.map((q, idx) => `
            <div style="background: var(--surface-alt); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 16px;">
              <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; line-height: 1.4; color: var(--ink);">
                ${idx + 1}. ${escapeHtml(q.question)}
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${q.options.map((opt, optIdx) => {
                  const isChecked = currentAnswers[q.id] === optIdx;
                  const isCorrect = q.correctIndex === optIdx;
                  let optStyle = 'background: var(--surface); border: 1px solid var(--line);';
                  if (alreadyDone) {
                    if (isCorrect) optStyle = 'background: #dcfce7; border: 1.5px solid #16a34a; font-weight: 600; color: #14532d;';
                    else if (isChecked && !isCorrect) optStyle = 'background: #fee2e2; border: 1px solid #dc2626; color: #991b1b;';
                  }

                  return `
                    <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s ease; ${optStyle}">
                      <input type="radio" name="question_${q.id}" value="${optIdx}" ${isChecked ? 'checked' : ''} ${alreadyDone ? 'disabled' : ''} style="margin-top: 3px;" required>
                      <span style="font-size: 13px; line-height: 1.4;">${escapeHtml(opt)}</span>
                    </label>
                  `;
                }).join('')}
              </div>
              ${alreadyDone ? `
                <div style="margin-top: 10px; font-size: 12px; color: var(--muted); background: var(--surface); padding: 8px 12px; border-radius: var(--radius-xs);">
                  💡 <strong>Agronomic Insight:</strong> ${escapeHtml(q.explanation)}
                </div>
              ` : ''}
            </div>
          `).join('')}

          ${!alreadyDone ? `
            <button type="submit" class="btn btn-primary" style="padding: 12px; font-weight: 700; width: 100%; font-size: 14px; margin-top: 6px;">
              Submit Knowledge Assessment (+5 pts)
            </button>
          ` : `
            <button type="button" class="btn btn-secondary" id="btnQuizCloseBottom" style="padding: 10px; font-weight: 600; width: 100%;">
              Close
            </button>
          `}
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('agronomyQuizModal');
  const close = () => modalEl.remove();

  document.getElementById('btnCloseQuizModal')?.addEventListener('click', close);
  document.getElementById('btnQuizCloseBottom')?.addEventListener('click', close);
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  const form = document.getElementById('quizForm');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const answers = {};
    let correctCount = 0;

    quizQuestions.forEach(q => {
      const selected = form.querySelector(`input[name="question_${q.id}"]:checked`);
      if (selected) {
        const val = parseInt(selected.value, 10);
        answers[q.id] = val;
        if (val === q.correctIndex) correctCount++;
      }
    });

    storage.saveQuizState(assistantName, {
      answers,
      score: correctCount,
      total: quizQuestions.length
    });

    showToast(`Quiz completed! ${correctCount}/${quizQuestions.length} correct. +5 KPI Points Awarded!`, '🎓');
    close();
  });
}
