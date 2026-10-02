import { storage } from '../services/storage.js';
import { openFillDynamicFormModal } from './fillDynamicFormModal.js';

export function openAssignedFormsListModal(repInfo, onUpdated) {
  const existing = document.getElementById('assignedFormsListModal');
  if (existing) existing.remove();

  const myForms = storage.getFormsForAssistant(repInfo.name);

  const modalHtml = `
    <div class="modal-backdrop open" id="assignedFormsListModal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div class="modal-box modal-content" style="max-width: 680px; width: 95%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; padding: 0; border-radius: var(--radius-md);">
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1.5px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: var(--surface);">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">📝</span>
              <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; margin: 0;">
                Assigned Field Surveys & Inspection Forms
              </h3>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
              Station: <strong>${escapeHtml(repInfo.name)}</strong> · ${myForms.length} Active Forms in Territory
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseAssignedListModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 18px 20px; overflow-y: auto; flex: 1;">
          ${myForms.length === 0 ? `
            <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
              <div style="font-size: 40px; margin-bottom: 8px;">✨</div>
              <h4 style="font-weight: 700; font-size: 16px; color: var(--ink);">All Surveys Complete</h4>
              <p style="font-size: 13px; margin-top: 4px;">No custom field surveys or audits currently assigned to your station.</p>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${myForms.map(f => {
                const subs = storage.getFormSubmissions(f.id).filter(s => s.assistant === repInfo.name);
                const hasSubmitted = subs.length > 0;
                const lastSub = subs[0];

                return `
                  <div class="card" style="padding: 14px 16px; margin: 0; background: var(--surface); border-left: 4px solid ${hasSubmitted ? '#16a34a' : '#7c3aed'};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                          <strong style="font-size: 15px; color: var(--ink); font-family: var(--font-heading);">${escapeHtml(f.title)}</strong>
                          <span class="badge" style="background: rgba(124, 58, 237, 0.1); color: #7c3aed; font-weight: 700; font-size: 11px;">
                            ${escapeHtml(f.category || 'Survey')}
                          </span>
                        </div>
                        <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                          ${f.description ? escapeHtml(f.description) : 'Custom field survey assigned by management.'}
                        </div>
                        <div style="font-size: 11.5px; color: var(--muted); margin-top: 6px;">
                          Deadline: <strong>${f.deadline || 'None'}</strong> · Questions: <strong>${f.fields.length} Fields</strong>
                        </div>
                      </div>

                      <div>
                        ${hasSubmitted ? `
                          <div style="text-align: right;">
                            <span class="badge" style="background: #dcfce7; color: #166534; font-weight: 700; font-size: 11px;">
                              ✓ Submitted (${new Date(lastSub.submittedAt).toLocaleDateString()})
                            </span>
                            <div style="margin-top: 6px;">
                              <button type="button" class="btn btn-secondary btn-sm btn-re-fill-form" data-id="${f.id}" style="font-size: 11.5px; padding: 3px 8px;">
                                + Submit Another
                              </button>
                            </div>
                          </div>
                        ` : `
                          <button type="button" class="btn btn-primary btn-sm btn-fill-assigned-form" data-id="${f.id}" style="font-weight: 700; font-size: 12px; background: #7c3aed; border-color: #6d28d9; white-space: nowrap;">
                            Fill Form Now →
                          </button>
                        `}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Footer -->
        <div style="padding: 12px 20px; border-top: 1.5px solid var(--line); display: flex; align-items: center; justify-content: flex-end; background: var(--surface);">
          <button type="button" class="btn btn-secondary btn-sm" id="btnCloseAssignedListModalBottom">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('assignedFormsListModal');
  const close = () => modalEl?.remove();

  document.getElementById('btnCloseAssignedListModal')?.addEventListener('click', close);
  document.getElementById('btnCloseAssignedListModalBottom')?.addEventListener('click', close);

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  // Fill form button handlers
  modalEl.querySelectorAll('.btn-fill-assigned-form, .btn-re-fill-form').forEach(btn => {
    btn.addEventListener('click', () => {
      const formId = btn.getAttribute('data-id');
      const form = myForms.find(f => f.id === formId);
      if (form) {
        close();
        openFillDynamicFormModal(form, repInfo, onUpdated);
      }
    });
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
