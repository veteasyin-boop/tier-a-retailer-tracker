import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { BIHAR_BLOCKS } from '../utils/geo.js';

export function openAssistantEditModal(assistant) {
  let modalEl = document.getElementById('assistantModal');
  if (!modalEl) {
    createAssistantModalDOM();
    modalEl = document.getElementById('assistantModal');
  }

  document.getElementById('asstOldName').value = assistant.name;
  document.getElementById('asstName').value = assistant.name;
  document.getElementById('asstHq').value = assistant.hq;
  document.getElementById('asstDistrict').value = assistant.district;
  document.getElementById('asstTarget').value = assistant.target;
  document.getElementById('asstPassword').value = assistant.password || 'rep123';
  document.getElementById('asstBlocks').value = (assistant.blocks || []).join(', ');
  document.getElementById('asstModalTitle').textContent = `Edit Assistant: ${assistant.name}`;

  const deleteBtn = document.getElementById('asstDeleteBtn');
  if (deleteBtn) {
    deleteBtn.style.display = 'inline-flex';
    deleteBtn.onclick = () => handleDeleteAssistant(assistant.name);
  }

  renderBlockChips(assistant.district, assistant.blocks || []);
  modalEl.classList.add('open');
}

export function openAddAssistantModal() {
  let modalEl = document.getElementById('assistantModal');
  if (!modalEl) {
    createAssistantModalDOM();
    modalEl = document.getElementById('assistantModal');
  }

  document.getElementById('asstOldName').value = '';
  document.getElementById('asstName').value = '';
  document.getElementById('asstHq').value = '';
  document.getElementById('asstDistrict').value = 'Patna';
  document.getElementById('asstTarget').value = '80';
  document.getElementById('asstPassword').value = 'rep123';
  document.getElementById('asstBlocks').value = '';
  document.getElementById('asstModalTitle').textContent = 'Add New Field Assistant & Territory';

  const deleteBtn = document.getElementById('asstDeleteBtn');
  if (deleteBtn) deleteBtn.style.display = 'none';

  renderBlockChips('Patna', []);
  modalEl.classList.add('open');
}

export function closeAssistantModal() {
  const modalEl = document.getElementById('assistantModal');
  if (modalEl) modalEl.classList.remove('open');
}

async function handleDeleteAssistant(name) {
  const assignedRows = storage.rows.filter(r => r.assistant === name);
  const assistants = storage.getAssistants().filter(a => a.name !== name);

  if (assignedRows.length > 0) {
    if (assistants.length === 0) {
      alert(`Cannot delete the only field assistant with ${assignedRows.length} assigned retailers.`);
      return;
    }

    const target = prompt(`Assistant "${name}" has ${assignedRows.length} assigned retailers.\nEnter the name of the assistant to transfer these retailers to:\n(Options: ${assistants.map(a => a.name).join(', ')})`);
    if (!target) return;

    const matched = assistants.find(a => a.name.toLowerCase() === target.trim().toLowerCase());
    if (!matched) {
      alert(`Assistant "${target}" not found. Deletion cancelled.`);
      return;
    }

    if (confirm(`Confirm: Delete "${name}" and transfer all ${assignedRows.length} retailers to "${matched.name}"?`)) {
      try {
        await storage.deleteAssistant(name, matched.name);
        closeAssistantModal();
        showToast(`Deleted "${name}" and transferred dealers to "${matched.name}"`, '🗑️');
      } catch(err) {
        showToast(err.message, '❌');
      }
    }
  } else {
    if (confirm(`Confirm: Delete assistant "${name}"?`)) {
      try {
        await storage.deleteAssistant(name);
        closeAssistantModal();
        showToast(`Deleted assistant "${name}"`, '🗑️');
      } catch(err) {
        showToast(err.message, '❌');
      }
    }
  }
}

function renderBlockChips(district, selectedBlocks = []) {
  const container = document.getElementById('asstBlockChipsContainer');
  if (!container) return;

  const currentInputVal = document.getElementById('asstBlocks')?.value || '';
  const activeBlocksSet = new Set(
    currentInputVal.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );
  selectedBlocks.forEach(b => activeBlocksSet.add(b.toLowerCase()));

  // Filter blocks in BIHAR_BLOCKS by district (or all if district doesn't match)
  const dNorm = (district || '').trim().toLowerCase();
  let relevantBlocks = BIHAR_BLOCKS.filter(b => b.district.toLowerCase() === dNorm);
  if (relevantBlocks.length === 0) {
    relevantBlocks = BIHAR_BLOCKS;
  }

  // Deduplicate block names
  const uniqueBlockNames = [...new Set(relevantBlocks.map(b => b.block))].sort();

  container.innerHTML = uniqueBlockNames.map(b => {
    const isSelected = activeBlocksSet.has(b.toLowerCase());
    return `
      <button type="button" class="block-chip ${isSelected ? 'selected' : ''}" data-block="${escapeHtml(b)}"
        style="
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 9px; font-size: 11.5px; border-radius: 9999px;
          border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--line)'};
          background: ${isSelected ? 'var(--primary-subtle)' : 'var(--surface-alt)'};
          color: ${isSelected ? 'var(--primary)' : 'var(--ink)'};
          cursor: pointer; transition: all 0.15s ease;
          font-weight: ${isSelected ? '600' : '400'};
        ">
        <span>${isSelected ? '✓' : '+'}</span>
        <span>${escapeHtml(b)}</span>
      </button>
    `;
  }).join('');

  // Add click listener to toggle block into input
  container.querySelectorAll('.block-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const blockName = btn.getAttribute('data-block');
      const input = document.getElementById('asstBlocks');
      let blocks = input.value.split(',').map(s => s.trim()).filter(Boolean);

      const existsIdx = blocks.findIndex(b => b.toLowerCase() === blockName.toLowerCase());
      if (existsIdx >= 0) {
        blocks.splice(existsIdx, 1);
      } else {
        blocks.push(blockName);
      }

      input.value = blocks.join(', ');
      renderBlockChips(document.getElementById('asstDistrict')?.value, blocks);
    });
  });
}

export function openReassignTerritoryModal() {
  let modalEl = document.getElementById('reassignModal');
  if (!modalEl) {
    createReassignModalDOM();
    modalEl = document.getElementById('reassignModal');
  }

  const assistants = storage.getAssistants();
  const sourceBlockSel = document.getElementById('reassignSourceBlock');
  const targetAssocSel = document.getElementById('reassignTargetAssistant');
  const sourceRepSel = document.getElementById('reassignSourceRep');
  const targetRepSel = document.getElementById('reassignTargetRep');

  // Populate unique blocks from database
  const blocks = [...new Set(storage.rows.map(r => r.block).filter(Boolean))].sort();
  sourceBlockSel.innerHTML = blocks.map(b => {
    const count = storage.rows.filter(r => (r.block || '').toLowerCase() === b.toLowerCase()).length;
    return `<option value="${escapeHtml(b)}">${escapeHtml(b)} (${count} dealers)</option>`;
  }).join('');

  // Populate target assistants for block transfer
  targetAssocSel.innerHTML = assistants.map(a => `
    <option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} [HQ: ${escapeHtml(a.hq)}]</option>
  `).join('');

  // Populate for Rep Handover
  const repOptions = assistants.map(a => {
    const count = storage.rows.filter(r => r.assistant === a.name).length;
    return `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${count} dealers, HQ: ${escapeHtml(a.hq)})</option>`;
  }).join('');

  sourceRepSel.innerHTML = repOptions;
  targetRepSel.innerHTML = repOptions;
  if (assistants.length > 1) {
    targetRepSel.selectedIndex = 1;
  }

  modalEl.classList.add('open');
}

export function closeReassignModal() {
  const modalEl = document.getElementById('reassignModal');
  if (modalEl) modalEl.classList.remove('open');
}

function createAssistantModalDOM() {
  const backdrop = document.createElement('div');
  backdrop.id = 'assistantModal';
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal-box" style="max-width: 540px;">
      <div class="modal-header">
        <h3 class="modal-title" id="asstModalTitle">Edit Field Assistant</h3>
        <button type="button" class="btn btn-secondary btn-icon" id="asstCloseBtn">✕</button>
      </div>

      <form id="assistantForm">
        <input type="hidden" id="asstOldName">
        <div style="display: flex; flex-direction: column; gap: 13px;">
          <div class="form-group">
            <label class="form-label">Assistant / Rep Name *</label>
            <input type="text" id="asstName" required placeholder="e.g. Ramesh Kumar (West Patna)">
            <span style="font-size: 11px; color: var(--muted);">Renaming will automatically update all existing assigned retailer records.</span>
          </div>

          <div class="modal-form-grid-2">
            <div class="form-group">
              <label class="form-label">Base Station (HQ) *</label>
              <input type="text" id="asstHq" required placeholder="e.g. Bihta">
            </div>
            <div class="form-group">
              <label class="form-label">District *</label>
              <input type="text" id="asstDistrict" required placeholder="e.g. Patna">
            </div>
          </div>

          <div class="modal-form-grid-2">
            <div class="form-group">
              <label class="form-label">Assigned Target (Dealers)</label>
              <input type="number" id="asstTarget" min="1" max="1000" required placeholder="e.g. 116">
            </div>
            <div class="form-group">
              <label class="form-label">Station Login Password *</label>
              <input type="text" id="asstPassword" required placeholder="e.g. rep123">
            </div>
          </div>
          <span style="font-size: 11px; color: var(--muted); margin-top: -6px; margin-bottom: 8px; display: block;">
            Field Rep will use this password to log in to their station on their device.
          </span>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <label class="form-label">Assigned Territory Blocks</label>
              <span style="font-size: 11px; color: var(--muted);">Click chips below to toggle</span>
            </div>
            <input type="text" id="asstBlocks" placeholder="e.g. Bihta, Maner, Bikram, Naubatpur, Danapur">
            
            <!-- Quick Clickable Block Chips -->
            <div style="margin-top: 8px;">
              <div style="font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 6px;">
                Quick Select Available Blocks in District:
              </div>
              <div id="asstBlockChipsContainer" style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 120px; overflow-y: auto; padding: 4px 0;"></div>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--line);">
          <button type="button" class="btn btn-secondary" id="asstDeleteBtn" style="color: var(--danger); display: none;">
            🗑️ Delete Assistant
          </button>
          <div style="display: flex; gap: 8px; margin-left: auto;">
            <button type="button" class="btn btn-secondary" id="asstCancelBtn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="asstSaveBtn">Save Changes ✓</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  document.getElementById('asstCloseBtn')?.addEventListener('click', closeAssistantModal);
  document.getElementById('asstCancelBtn')?.addEventListener('click', closeAssistantModal);

  document.getElementById('asstDistrict')?.addEventListener('input', (e) => {
    const d = e.target.value;
    const currentBlocks = (document.getElementById('asstBlocks')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    renderBlockChips(d, currentBlocks);
  });

  document.getElementById('asstBlocks')?.addEventListener('input', (e) => {
    const d = document.getElementById('asstDistrict')?.value || '';
    const currentBlocks = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    renderBlockChips(d, currentBlocks);
  });

  document.getElementById('assistantForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldName = document.getElementById('asstOldName').value;
    const name = document.getElementById('asstName').value.trim();
    const hq = document.getElementById('asstHq').value.trim();
    const district = document.getElementById('asstDistrict').value.trim();
    const target = parseInt(document.getElementById('asstTarget').value, 10) || 50;
    const password = (document.getElementById('asstPassword')?.value || '').trim() || 'rep123';
    const blocksRaw = document.getElementById('asstBlocks').value;
    const blocks = blocksRaw.split(',').map(b => b.trim()).filter(Boolean);

    try {
      if (oldName) {
        await storage.saveAssistant({ name, hq, district, target, blocks, password }, oldName);
        showToast(`Updated assistant "${name}" and territory configuration`, '✅');
      } else {
        await storage.addAssistant({ name, hq, district, target, blocks, password });
        showToast(`Added new assistant "${name}" with login password`, '🎉');
      }
      closeAssistantModal();
    } catch(err) {
      showToast(err.message, '❌');
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeAssistantModal();
  });
}

function createReassignModalDOM() {
  const backdrop = document.createElement('div');
  backdrop.id = 'reassignModal';
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal-box" style="max-width: 480px;">
      <div class="modal-header">
        <h3 class="modal-title">Territory Reassignment System</h3>
        <button type="button" class="btn btn-secondary btn-icon" id="reassignCloseBtn">✕</button>
      </div>

      <!-- Mode Tabs -->
      <div style="display: flex; gap: 4px; background: var(--surface-alt); padding: 4px; border-radius: var(--radius-sm); margin-bottom: 16px;">
        <button type="button" id="tabReassignBlock" class="btn btn-sm btn-primary" style="flex: 1; font-size: 12px;">
          📍 By Territory Block
        </button>
        <button type="button" id="tabReassignRep" class="btn btn-sm btn-secondary" style="flex: 1; font-size: 12px;">
          👤 Rep Full Handover
        </button>
      </div>

      <!-- Panel 1: Block Reassignment -->
      <form id="reassignBlockForm">
        <p style="color: var(--muted); font-size: 12.5px; margin-bottom: 14px;">
          Transfer all retailers in a specific block to a different Field Assistant in one operation.
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Select Territory Block to Reassign</label>
            <select id="reassignSourceBlock" required></select>
          </div>

          <div style="text-align: center; font-size: 16px; color: var(--primary);">
            ↓ transfer all dealers to ↓
          </div>

          <div class="form-group">
            <label class="form-label">New Assigned Assistant</label>
            <select id="reassignTargetAssistant" required></select>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" id="reassignCancelBtn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="reassignSubmitBtn">Confirm Block Reassignment ✓</button>
        </div>
      </form>

      <!-- Panel 2: Rep Handover -->
      <form id="reassignRepForm" style="display: none;">
        <p style="color: var(--muted); font-size: 12.5px; margin-bottom: 14px;">
          Transfer all territories, target quota, and retailer records from one Assistant to another (e.g. employee handover/replacement).
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group">
            <label class="form-label">From Assistant (Current Owner)</label>
            <select id="reassignSourceRep" required></select>
          </div>

          <div style="text-align: center; font-size: 16px; color: var(--primary);">
            ↓ handover all dealers & territories to ↓
          </div>

          <div class="form-group">
            <label class="form-label">To Assistant (New Assignee)</label>
            <select id="reassignTargetRep" required></select>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" id="reassignRepCancelBtn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="reassignRepSubmitBtn">Confirm Complete Handover ✓</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  // Tab switching
  const tabBlock = document.getElementById('tabReassignBlock');
  const tabRep = document.getElementById('tabReassignRep');
  const formBlock = document.getElementById('reassignBlockForm');
  const formRep = document.getElementById('reassignRepForm');

  tabBlock?.addEventListener('click', () => {
    tabBlock.className = 'btn btn-sm btn-primary';
    tabRep.className = 'btn btn-sm btn-secondary';
    formBlock.style.display = 'block';
    formRep.style.display = 'none';
  });

  tabRep?.addEventListener('click', () => {
    tabRep.className = 'btn btn-sm btn-primary';
    tabBlock.className = 'btn btn-sm btn-secondary';
    formBlock.style.display = 'none';
    formRep.style.display = 'block';
  });

  document.getElementById('reassignCloseBtn')?.addEventListener('click', closeReassignModal);
  document.getElementById('reassignCancelBtn')?.addEventListener('click', closeReassignModal);
  document.getElementById('reassignRepCancelBtn')?.addEventListener('click', closeReassignModal);

  // Submit Block Reassignment
  formBlock?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const block = document.getElementById('reassignSourceBlock').value;
    const targetAssoc = document.getElementById('reassignTargetAssistant').value;

    try {
      const count = await storage.reassignBlockRetailers(block, targetAssoc);
      closeReassignModal();
      showToast(`Successfully reassigned ${count} retailers in ${block} to ${targetAssoc}!`, '🎉');
    } catch(err) {
      showToast(err.message, '❌');
    }
  });

  // Submit Rep Handover
  formRep?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sourceRep = document.getElementById('reassignSourceRep').value;
    const targetRep = document.getElementById('reassignTargetRep').value;

    if (sourceRep === targetRep) {
      alert('Source and target assistants must be different.');
      return;
    }

    if (confirm(`Confirm full handover: Transfer ALL retailers and territories from "${sourceRep}" to "${targetRep}"?`)) {
      try {
        const count = await storage.transferAllRetailers(sourceRep, targetRep);
        closeReassignModal();
        showToast(`Transferred all ${count} retailers from ${sourceRep} to ${targetRep}!`, '🎉');
      } catch(err) {
        showToast(err.message, '❌');
      }
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeReassignModal();
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
