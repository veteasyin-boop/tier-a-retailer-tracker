import { storage } from '../services/storage.js';
import { showToast } from './toast.js';

export function openFormBuilderModal(onCreated) {
  const existing = document.getElementById('formBuilderModal');
  if (existing) existing.remove();

  const assistants = storage.getAssistants();
  const districts = Array.from(new Set(assistants.map(a => a.district)));

  let formFields = [
    { id: 'f_field_1', label: 'Farmer / Counter Name', type: 'text', required: true, options: [] },
    { id: 'f_field_2', label: 'Field Observation / Finding', type: 'text', required: true, options: [] }
  ];

  const modalHtml = `
    <div class="modal-backdrop open" id="formBuilderModal" style="display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div class="modal-box modal-content" style="max-width: 680px; width: 95%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; padding: 0; border-radius: var(--radius-md);">
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1.5px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: var(--surface);">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">📝</span>
              <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; margin: 0;">
                Dynamic Field Survey & Inspection Form Studio
              </h3>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
              Create custom field inspection forms and target them to all reps, specific districts, or individual assistants.
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-icon" id="btnCloseBuilderModal" style="border-radius: 50%; width: 34px; height: 34px;">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 18px 20px; overflow-y: auto; flex: 1;">
          <form id="customFormBuilderForm" style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Form Details -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
              <div class="form-group">
                <label class="form-label">Form / Survey Title *</label>
                <input type="text" id="fbTitle" required placeholder="e.g. Rabi Maize Stem Borer Inspection" style="padding: 8px 10px; font-size: 13px;">
              </div>

              <div class="form-group">
                <label class="form-label">Category *</label>
                <select id="fbCategory" style="padding: 8px 10px; font-size: 13px;">
                  <option value="Crop Health & Surveillance">🌾 Crop Health & Surveillance</option>
                  <option value="Market & Price Intelligence">📊 Market & Price Intelligence</option>
                  <option value="Retailer Inventory Audit">🏬 Retailer Inventory Audit</option>
                  <option value="Farmer Trial Feedback">🌱 Farmer Trial Feedback</option>
                  <option value="Competitor Scheme Audit">🛡️ Competitor Scheme Audit</option>
                  <option value="General Field Inspection">📋 General Field Inspection</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Objective / Instructions for Reps</label>
              <textarea id="fbDescription" rows="2" placeholder="Explain the purpose of this field survey and what reps must record..." style="padding: 8px 10px; font-size: 12.5px;"></textarea>
            </div>

            <!-- Target Audience Selector -->
            <div style="background: var(--surface-alt); padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <label class="form-label" style="margin-bottom: 6px; font-weight: 800; color: var(--ink);">🎯 Target Audience Dispatch Logic:</label>
              
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
                <div>
                  <label style="font-size: 11.5px; color: var(--muted); font-weight: 600;">Assignment Scope</label>
                  <select id="fbTargetType" style="padding: 7px 10px; font-size: 12.5px; margin-top: 3px;">
                    <option value="all">🌐 Broadcast to All 8 Assistants</option>
                    <option value="district">🗺️ By Territory / District</option>
                    <option value="individual">👤 Individual Assistant Only</option>
                  </select>
                </div>

                <div id="fbTargetValueContainer" style="display: none;">
                  <label style="font-size: 11.5px; color: var(--muted); font-weight: 600;" id="fbTargetValueLabel">Select Target</label>
                  <select id="fbTargetValue" style="padding: 7px 10px; font-size: 12.5px; margin-top: 3px;"></select>
                </div>

                <div>
                  <label style="font-size: 11.5px; color: var(--muted); font-weight: 600;">Submission Deadline</label>
                  <input type="date" id="fbDeadline" style="padding: 6px 10px; font-size: 12.5px; margin-top: 3px;">
                </div>
              </div>
            </div>

            <!-- Dynamic Fields Builder Section -->
            <div style="margin-top: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <label class="form-label" style="font-weight: 800; font-size: 13.5px; margin: 0;">
                  📋 Form Questions & Input Fields (${formFields.length})
                </label>
                <button type="button" class="btn btn-secondary btn-sm" id="btnAddFieldBtn" style="font-weight: 700; color: var(--primary); border-color: rgba(16, 185, 129, 0.4);">
                  ➕ Add Question Field
                </button>
              </div>

              <div id="fieldsListContainer" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div style="padding: 12px 20px; border-top: 1.5px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: var(--surface);">
          <button type="button" class="btn btn-secondary btn-sm" id="btnCloseBuilderModalBottom">Cancel</button>
          <button type="button" class="btn btn-primary" id="btnSaveAndDispatchForm" style="padding: 9px 20px; font-weight: 800;">
            🚀 Save & Dispatch Survey to Field
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('formBuilderModal');
  const close = () => modalEl?.remove();

  document.getElementById('btnCloseBuilderModal')?.addEventListener('click', close);
  document.getElementById('btnCloseBuilderModalBottom')?.addEventListener('click', close);

  // Target type toggle
  const targetTypeSelect = document.getElementById('fbTargetType');
  const targetValContainer = document.getElementById('fbTargetValueContainer');
  const targetValSelect = document.getElementById('fbTargetValue');
  const targetValLabel = document.getElementById('fbTargetValueLabel');

  targetTypeSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'all') {
      targetValContainer.style.display = 'none';
    } else if (val === 'district') {
      targetValContainer.style.display = 'block';
      targetValLabel.textContent = 'Select Target District';
      targetValSelect.innerHTML = districts.map(d => `<option value="${d}">${d} District Hubs</option>`).join('');
    } else if (val === 'individual') {
      targetValContainer.style.display = 'block';
      targetValLabel.textContent = 'Select Individual Rep';
      targetValSelect.innerHTML = assistants.map(a => `<option value="${a.name}">${a.name} (${a.hq})</option>`).join('');
    }
  });

  // Render fields builder UI
  function renderFieldsList() {
    const container = document.getElementById('fieldsListContainer');
    if (!container) return;

    container.innerHTML = formFields.map((f, idx) => `
      <div style="background: var(--surface); padding: 12px 14px; border-radius: var(--radius-xs); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-weight: 800; font-size: 12px; color: var(--muted);">Field ${idx + 1}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" class="field-req-cb" data-idx="${idx}" ${f.required ? 'checked' : ''}> Required
            </label>
            ${formFields.length > 1 ? `
              <button type="button" class="btn btn-icon btn-del-field" data-idx="${idx}" style="color: var(--danger); font-size: 12px; padding: 2px 6px;" title="Delete Field">✕</button>
            ` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 10px;">
          <input type="text" class="field-label-input" data-idx="${idx}" placeholder="Enter question or field label..." value="${escapeHtml(f.label)}" style="padding: 6px 10px; font-size: 12.5px;">
          <select class="field-type-select" data-idx="${idx}" style="padding: 6px 10px; font-size: 12px;">
            <option value="text" ${f.type === 'text' ? 'selected' : ''}>Text Input</option>
            <option value="number" ${f.type === 'number' ? 'selected' : ''}>Numeric Value</option>
            <option value="select" ${f.type === 'select' ? 'selected' : ''}>Dropdown Select</option>
            <option value="toggle" ${f.type === 'toggle' ? 'selected' : ''}>Yes / No Toggle</option>
            <option value="date" ${f.type === 'date' ? 'selected' : ''}>Date Picker</option>
          </select>
        </div>

        ${f.type === 'select' ? `
          <div style="margin-top: 4px;">
            <input type="text" class="field-options-input" data-idx="${idx}" placeholder="Enter dropdown options separated by commas (e.g. Low, Medium, Severe)" value="${escapeHtml((f.options || []).join(', '))}" style="padding: 5px 8px; font-size: 12px; background: var(--surface-alt);">
            <span style="font-size: 10.5px; color: var(--muted);">Comma-separated options</span>
          </div>
        ` : ''}
      </div>
    `).join('');

    // Field change handlers
    container.querySelectorAll('.field-label-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(input.getAttribute('data-idx'), 10);
        formFields[i].label = e.target.value;
      });
    });

    container.querySelectorAll('.field-type-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const i = parseInt(sel.getAttribute('data-idx'), 10);
        formFields[i].type = e.target.value;
        if (e.target.value === 'select' && (!formFields[i].options || formFields[i].options.length === 0)) {
          formFields[i].options = ['Option 1', 'Option 2'];
        }
        renderFieldsList();
      });
    });

    container.querySelectorAll('.field-options-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(input.getAttribute('data-idx'), 10);
        formFields[i].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
      });
    });

    container.querySelectorAll('.field-req-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const i = parseInt(cb.getAttribute('data-idx'), 10);
        formFields[i].required = e.target.checked;
      });
    });

    container.querySelectorAll('.btn-del-field').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-idx'), 10);
        formFields.splice(i, 1);
        renderFieldsList();
      });
    });
  }

  renderFieldsList();

  // Add field button
  document.getElementById('btnAddFieldBtn')?.addEventListener('click', () => {
    formFields.push({
      id: `f_field_${Date.now()}`,
      label: `Question ${formFields.length + 1}`,
      type: 'text',
      required: true,
      options: []
    });
    renderFieldsList();
  });

  // Save & Dispatch
  document.getElementById('btnSaveAndDispatchForm')?.addEventListener('click', () => {
    const title = document.getElementById('fbTitle')?.value.trim();
    if (!title) {
      alert('Please enter a Form Title.');
      return;
    }

    const category = document.getElementById('fbCategory')?.value;
    const description = document.getElementById('fbDescription')?.value.trim();
    const targetType = document.getElementById('fbTargetType')?.value;
    const targetValue = (targetType === 'all') ? '' : document.getElementById('fbTargetValue')?.value;
    const deadline = document.getElementById('fbDeadline')?.value || '';

    // Validate fields
    const validFields = formFields.map((f, i) => ({
      id: f.id || `f_${i}`,
      label: f.label.trim() || `Question ${i + 1}`,
      type: f.type,
      required: Boolean(f.required),
      options: f.type === 'select' ? (f.options && f.options.length ? f.options : ['Yes', 'No']) : []
    }));

    const newForm = {
      id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title,
      category,
      description,
      targetType,
      targetValue,
      deadline,
      fields: validFields
    };

    storage.saveDynamicForm(newForm);
    showToast(`Form "${title}" created & dispatched to field!`, '🚀');
    close();
    if (typeof onCreated === 'function') onCreated();
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
