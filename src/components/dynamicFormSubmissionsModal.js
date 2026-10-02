import { storage } from '../services/storage.js';
import { exportFormSubmissionsToExcel } from '../utils/excel.js';
import { showToast } from './toast.js';

export function openFormSubmissionsModal(formId) {
  const existing = document.getElementById('formSubmissionsModal');
  if (existing) existing.remove();

  const forms = storage.getDynamicForms();
  const form = forms.find(f => f.id === formId);
  if (!form) return;

  const submissions = storage.getFormSubmissions(formId);
  const assistants = storage.getAssistants();

  const targetBadge = form.targetType === 'all'
    ? '<span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; font-weight: 700;">🌐 All 8 Assistants</span>'
    : form.targetType === 'district'
      ? `<span class="badge" style="background: rgba(124, 58, 237, 0.12); color: #7c3aed; font-weight: 700;">🗺️ ${escapeHtml(form.targetValue)} District Hubs</span>`
      : `<span class="badge" style="background: rgba(234, 88, 12, 0.12); color: #ea580c; font-weight: 700;">👤 ${escapeHtml(form.targetValue)}</span>`;

  const modalHtml = `
    <div class="modal-backdrop open" id="formSubmissionsModal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div class="modal-box modal-content" style="max-width: 900px; width: 95%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; padding: 0; border-radius: var(--radius-md);">
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1.5px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: var(--surface);">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">📋</span>
              <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; margin: 0;">
                Submissions Registry: ${escapeHtml(form.title)}
              </h3>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 3px; display: flex; align-items: center; gap: 8px;">
              <span>Category: <strong>${escapeHtml(form.category || 'Survey')}</strong></span>
              <span>•</span>
              <span>Scope: ${targetBadge}</span>
              <span>•</span>
              <span>Submissions: <strong>${submissions.length} Received</strong></span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseSubmissionsModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <!-- Action Bar -->
        <div style="padding: 10px 20px; background: var(--surface-alt); border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 12.5px; color: var(--muted);">
            ${form.description ? escapeHtml(form.description) : 'Custom field responses captured across Bihar territory hubs.'}
          </div>

          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-primary btn-sm" id="btnExportFormExcel" style="font-weight: 700;">
              📥 Export Excel (.xlsx)
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnPrintFormDossier" style="font-weight: 700;">
              🖨️ Print / Save PDF
            </button>
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 16px 20px; overflow-y: auto; flex: 1;">
          ${submissions.length === 0 ? `
            <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
              <div style="font-size: 40px; margin-bottom: 8px;">⏳</div>
              <h4 style="font-weight: 700; font-size: 16px; color: var(--ink); margin-bottom: 4px;">No Submissions Received Yet</h4>
              <p style="font-size: 13px; max-width: 420px; margin: 0 auto 16px;">
                Assigned field representatives have not yet completed this survey.
              </p>
              <button type="button" class="btn btn-secondary btn-sm" id="btnRemindFormReps" style="color: var(--primary); font-weight: 700;">
                🔔 Dispatch Push Reminder to Target Reps
              </button>
            </div>
          ` : `
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Field Assistant</th>
                    <th>Station & District</th>
                    <th>GPS Verification</th>
                    ${form.fields.map(f => `<th>${escapeHtml(f.label)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${submissions.map(s => {
                    const coordsStr = s.coords ? `${s.coords.lat.toFixed(4)}, ${s.coords.lng.toFixed(4)}` : 'Pending GPS';
                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 700; font-size: 12.5px;">${new Date(s.submittedAt).toLocaleDateString()}</div>
                          <div style="font-size: 11px; color: var(--muted);">${new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td>
                          <strong style="color: var(--ink);">${escapeHtml(s.assistant)}</strong>
                        </td>
                        <td>
                          <div>${escapeHtml(s.hq || '')}</div>
                          <div style="font-size: 11px; color: var(--muted);">${escapeHtml(s.district || '')}</div>
                        </td>
                        <td>
                          <span class="badge badge-visited" style="font-size: 10px; padding: 2px 6px;">
                            📍 ${coordsStr}
                          </span>
                        </td>
                        ${form.fields.map(f => {
                          const val = s.answers ? s.answers[f.id] : '—';
                          return `<td><span style="font-size: 12.5px; font-weight: 600;">${escapeHtml(val !== undefined && val !== null && val !== '' ? val : '—')}</span></td>`;
                        }).join('')}
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Footer -->
        <div style="padding: 12px 20px; border-top: 1.5px solid var(--line); display: flex; align-items: center; justify-content: flex-end; background: var(--surface);">
          <button type="button" class="btn btn-secondary btn-sm" id="btnCloseSubmissionsModalBottom">Close Submissions</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('formSubmissionsModal');
  const close = () => modalEl?.remove();

  document.getElementById('btnCloseSubmissionsModal')?.addEventListener('click', close);
  document.getElementById('btnCloseSubmissionsModalBottom')?.addEventListener('click', close);

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  // Export Excel
  document.getElementById('btnExportFormExcel')?.addEventListener('click', () => {
    exportFormSubmissionsToExcel(form, submissions);
  });

  // Print Dossier
  document.getElementById('btnPrintFormDossier')?.addEventListener('click', () => {
    window.print();
  });

  // Send Reminder
  document.getElementById('btnRemindFormReps')?.addEventListener('click', () => {
    if (form.targetType === 'all') {
      storage.broadcastNotification({
        title: `Reminder: Submit ${form.title}`,
        message: `Please complete your assigned field survey before the due date.`,
        type: 'form'
      });
    } else if (form.targetType === 'individual') {
      storage.sendAssistantNotification(form.targetValue, {
        title: `Reminder: ${form.title}`,
        message: `Management reminder: Please fill out your assigned field survey.`,
        type: 'form'
      });
    } else if (form.targetType === 'district') {
      const targetAssts = assistants.filter(a => a.district === form.targetValue);
      targetAssts.forEach(a => {
        storage.sendAssistantNotification(a.name, {
          title: `District Survey Due: ${form.title}`,
          message: `Please submit your response for this survey.`,
          type: 'form'
        });
      });
    }
    showToast('Reminders dispatched to target reps!', '🔔');
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
