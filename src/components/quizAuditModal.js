import { storage } from '../services/storage.js';
import { showToast } from './toast.js';

export function openRepQuizAuditModal(assistantName) {
  const existing = document.getElementById('repQuizAuditModal');
  if (existing) existing.remove();

  const quizState = storage.getQuizState(assistantName);
  const questions = storage.getQuizQuestions();
  const assistants = storage.getAssistants();
  const asstObj = assistants.find(a => a.name === assistantName) || { name: assistantName };

  const isCompleted = Boolean(quizState && quizState.completedAt);
  const score = quizState ? quizState.score : 0;
  const total = quizState ? quizState.total : questions.length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const completedDate = quizState?.completedAt ? new Date(quizState.completedAt).toLocaleString() : 'Not completed';

  let contentHtml = '';

  if (!isCompleted) {
    contentHtml = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 12px;">⏳</div>
        <h4 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Assessment Incomplete</h4>
        <p style="color: var(--muted); font-size: 13.5px; max-width: 440px; margin: 0 auto 20px;">
          <strong>${escapeHtml(assistantName)}</strong> has not yet submitted their weekly agronomy assessment.
        </p>
        <button type="button" class="btn btn-primary" id="btnAuditModalSendReminder" style="padding: 10px 20px; font-weight: 700;">
          🔔 Send Push Reminder to Rep
        </button>
      </div>
    `;
  } else {
    contentHtml = `
      <!-- Assessment Score Banner -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; background: var(--surface-alt); padding: 14px 18px; border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 18px;">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Assessment Outcome</div>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px;">
            <span style="font-size: 26px; font-weight: 800; font-family: var(--font-heading); color: ${pct >= 80 ? '#16a34a' : '#d97706'};">
              ${score} / ${total}
            </span>
            <span style="font-size: 14px; font-weight: 700; color: var(--muted);">(${pct}%)</span>
            <span class="badge" style="background: ${pct >= 80 ? '#dcfce7' : '#fef3c7'}; color: ${pct >= 80 ? '#166534' : '#b45309'}; font-weight: 700; font-size: 11.5px; margin-left: 6px;">
              ${pct >= 80 ? '⭐ Master Agronomist (10/10 SOP Pts)' : '⚠️ Refresher Required (5/10 SOP Pts)'}
            </span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
            Submitted on: <strong>${escapeHtml(completedDate)}</strong>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-sm" id="btnAuditRetestRep" style="font-size: 12px; color: #ea580c; border-color: rgba(234, 88, 12, 0.4); font-weight: 700;">
          🔄 Require Re-test
        </button>
      </div>

      <!-- Itemized Questions & Rep Choices -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${questions.map((q, idx) => {
          const repChoice = quizState.answers ? quizState.answers[q.id] : undefined;
          const isCorrect = repChoice === q.correctIndex;

          return `
            <div style="background: var(--surface); border: 1px solid ${isCorrect ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}; border-left: 5px solid ${isCorrect ? '#16a34a' : '#dc2626'}; border-radius: var(--radius-sm); padding: 14px 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 800; font-size: 13px; color: var(--muted);">Q${idx + 1}</span>
                  <span class="badge" style="font-size: 11px; background: rgba(2, 132, 199, 0.1); color: #0284c7; font-weight: 700;">
                    ${escapeHtml(q.category || 'Agronomy')}
                  </span>
                </div>
                <div>
                  ${isCorrect ? `
                    <span class="badge" style="background: #dcfce7; color: #166534; font-weight: 800; font-size: 11px;">
                      ✓ Correct Choice
                    </span>
                  ` : `
                    <span class="badge" style="background: #fee2e2; color: #dc2626; font-weight: 800; font-size: 11px;">
                      ✗ Incorrect Choice
                    </span>
                  `}
                </div>
              </div>

              <div style="font-weight: 700; font-size: 14px; color: var(--ink); margin-bottom: 12px; line-height: 1.4;">
                ${escapeHtml(q.question)}
              </div>

              <!-- Options -->
              <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;">
                ${q.options.map((opt, optIdx) => {
                  const wasChosen = repChoice === optIdx;
                  const isAnswer = q.correctIndex === optIdx;

                  let optBg = 'var(--surface-alt)';
                  let optBorder = 'var(--line)';
                  let optColor = 'var(--ink)';
                  let optBadge = '';

                  if (wasChosen && isAnswer) {
                    optBg = 'rgba(34, 197, 94, 0.12)';
                    optBorder = '#16a34a';
                    optColor = '#166534';
                    optBadge = '<span class="badge" style="background: #16a34a; color: #ffffff; font-weight: 800; font-size: 10px; margin-left: auto;">✓ Rep Choice (Correct)</span>';
                  } else if (wasChosen && !isAnswer) {
                    optBg = 'rgba(239, 68, 68, 0.12)';
                    optBorder = '#dc2626';
                    optColor = '#991b1b';
                    optBadge = '<span class="badge" style="background: #dc2626; color: #ffffff; font-weight: 800; font-size: 10px; margin-left: auto;">✗ Rep Choice (Wrong)</span>';
                  } else if (isAnswer) {
                    optBg = 'rgba(34, 197, 94, 0.08)';
                    optBorder = '#16a34a';
                    optColor = '#166534';
                    optBadge = '<span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #166534; font-weight: 700; font-size: 10px; margin-left: auto;">Correct Key</span>';
                  }

                  return `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: var(--radius-xs); border: 1px solid ${optBorder}; background: ${optBg}; color: ${optColor}; font-size: 12.5px; font-weight: ${wasChosen || isAnswer ? '700' : '500'};">
                      <span style="font-weight: 800; width: 18px;">${String.fromCharCode(65 + optIdx)}.</span>
                      <span>${escapeHtml(opt)}</span>
                      ${optBadge}
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Agronomic Explanation -->
              ${q.explanation ? `
                <div style="background: var(--surface-alt); padding: 8px 12px; border-radius: var(--radius-xs); font-size: 12px; color: var(--muted); border-left: 3px solid var(--primary); line-height: 1.4;">
                  <strong style="color: var(--ink);">💡 Agronomic Rationale:</strong> ${escapeHtml(q.explanation)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  const modalHtml = `
    <div class="modal-backdrop open" id="repQuizAuditModal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div class="modal-box modal-content" style="max-width: 680px; width: 95%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; padding: 0; border-radius: var(--radius-md);">
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1.5px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: var(--surface);">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">🔍</span>
              <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; margin: 0;">
                Agronomy Assessment Audit: ${escapeHtml(assistantName)}
              </h3>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
              Station HQ: <strong>${escapeHtml(asstObj.hq || '')}</strong> (${escapeHtml(asstObj.district || '')}) · SOP Pillar 1 Technical Verification
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseAuditModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 18px 20px; overflow-y: auto; flex: 1;">
          ${contentHtml}
        </div>

        <!-- Footer -->
        <div style="padding: 12px 20px; border-top: 1.5px solid var(--line); display: flex; align-items: center; justify-content: flex-end; background: var(--surface);">
          <button type="button" class="btn btn-secondary btn-sm" id="btnCloseAuditModalBottom">Close Audit</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('repQuizAuditModal');
  const close = () => modalEl?.remove();

  document.getElementById('btnCloseAuditModal')?.addEventListener('click', close);
  document.getElementById('btnCloseAuditModalBottom')?.addEventListener('click', close);

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  // Action: Send reminder
  document.getElementById('btnAuditModalSendReminder')?.addEventListener('click', () => {
    storage.sendAssistantNotification(assistantName, {
      title: 'Agronomy Assessment Due',
      message: 'Management reminder: Please complete your Weekly Agronomy Assessment today to earn your 10 Tech SOP points.',
      type: 'quiz'
    });
    showToast(`Reminder sent to ${assistantName}!`, '🔔');
    close();
  });

  // Action: Require re-test
  document.getElementById('btnAuditRetestRep')?.addEventListener('click', () => {
    if (confirm(`Reset ${assistantName}'s quiz so they can take the assessment again?`)) {
      const key = `tat_quiz_${String(assistantName).toLowerCase().trim()}`;
      localStorage.removeItem(key);
      storage.sendAssistantNotification(assistantName, {
        title: 'Agronomy Re-test Required',
        message: 'Your weekly agronomy quiz has been reset by management. Please re-take the assessment.',
        type: 'quiz'
      });
      showToast(`Quiz reset for ${assistantName}. Notification sent.`, '🔄');
      close();
      window.dispatchEvent(new CustomEvent('tracker:quizUpdated'));
    }
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
