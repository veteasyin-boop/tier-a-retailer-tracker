import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { downloadInventoryImportTemplate, parseInventoryExcelFile } from '../utils/excel.js';

export function openAdminInventoryModal(initialData = null, onSaved = null) {
  const existing = document.getElementById('adminInventoryModal');
  if (existing) existing.remove();

  const assistants = storage.getAssistants();

  const modal = document.createElement('div');
  modal.id = 'adminInventoryModal';
  modal.className = 'modal-backdrop open';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;
    opacity: 1 !important; pointer-events: auto !important;
    animation: fadeIn 0.15s ease-out;
  `;

  modal.innerHTML = `
    <div class="card" style="width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto; background: var(--surface-card); box-shadow: var(--shadow-xl); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 0;">
      <!-- Modal Header -->
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(16, 185, 129, 0.08));">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">📦</span>
          <div>
            <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; margin: 0; color: var(--ink);">
              ${initialData ? 'Edit Stock Quota Allocation' : 'Issue Stock Quota & Inventory Allocation'}
            </h3>
            <p style="font-size: 12px; color: var(--muted); margin: 2px 0 0 0;">
              Allocate exact physical quantities (kg, packets, bags, liters) to field assistants.
            </p>
          </div>
        </div>
        <button type="button" id="btnCloseInvModal" style="background: none; border: none; font-size: 22px; cursor: pointer; color: var(--muted); line-height: 1;">&times;</button>
      </div>

      <!-- Modal Body -->
      <form id="adminInventoryForm" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <!-- Bulk Excel Shortcut Banner -->
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px dashed rgba(16, 185, 129, 0.45); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #166534;">📊 Bulk Inventory Upload Available</div>
            <div style="font-size: 11px; color: var(--muted);">Upload complete product allocations for all 8 reps via spreadsheet</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btnModalDownloadTemplate" style="font-size: 11px; padding: 4px 8px; color: #7c3aed; border-color: rgba(124, 58, 237, 0.3);">
              📑 Template
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnModalUploadBulk" style="font-size: 11px; padding: 4px 8px; color: #16a34a; border-color: rgba(22, 163, 74, 0.4);">
              📥 Upload Excel
            </button>
            <input type="file" id="modalFileInputInv" accept=".xlsx,.xls,.csv" style="display: none;">
          </div>
        </div>

        <!-- Product Presets Quick Picker -->
        <div>
          <label style="font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
            Quick Presets / Agro Portfolio:
          </label>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm inv-preset-btn" data-name="Shaktiman Hybrid Maize 3355" data-crop="Maize" data-cat="Hybrid Seeds" data-unit="packets" data-price="650" style="font-size: 11px; padding: 4px 8px;">🌽 Shaktiman 3355</button>
            <button type="button" class="btn btn-secondary btn-sm inv-preset-btn" data-name="Snowball 16 Cauliflower Seed" data-crop="Cauliflower" data-cat="Vegetable Seeds" data-unit="kg" data-price="4800" style="font-size: 11px; padding: 4px 8px;">🥦 Snowball 16 (kg)</button>
            <button type="button" class="btn btn-secondary btn-sm inv-preset-btn" data-name="Abhinav F1 Tomato Seeds" data-crop="Tomato" data-cat="Vegetable Seeds" data-unit="packets" data-price="950" style="font-size: 11px; padding: 4px 8px;">🍅 Abhinav Tomato</button>
            <button type="button" class="btn btn-secondary btn-sm inv-preset-btn" data-name="Biozyme Crop Energizer (Liquid)" data-crop="General" data-cat="Bio-stimulants" data-unit="liters" data-price="850" style="font-size: 11px; padding: 4px 8px;">🧪 Biozyme Liquid (L)</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Product / Variety Name *</label>
            <input type="text" id="invProductName" required placeholder="e.g. Shaktiman Hybrid Maize 3355" value="${escapeHtml(initialData?.productName || '')}" style="width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
          </div>
          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Target Crop *</label>
            <input type="text" id="invCrop" required placeholder="e.g. Maize, Cauliflower, Paddy" value="${escapeHtml(initialData?.crop || 'Maize')}" style="width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Category *</label>
            <select id="invCategory" style="width: 100%; padding: 8px 10px; font-size: 13px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
              <option value="Hybrid Seeds" ${(initialData?.category==='Hybrid Seeds')?'selected':''}>Hybrid Seeds</option>
              <option value="Vegetable Seeds" ${(initialData?.category==='Vegetable Seeds')?'selected':''}>Vegetable Seeds</option>
              <option value="Crop Protection" ${(initialData?.category==='Crop Protection')?'selected':''}>Crop Protection</option>
              <option value="Bio-stimulants" ${(initialData?.category==='Bio-stimulants')?'selected':''}>Bio-stimulants</option>
              <option value="Trial Samples" ${(initialData?.category==='Trial Samples')?'selected':''}>Trial Samples</option>
            </select>
          </div>

          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Unit of Measure *</label>
            <select id="invUnit" required style="width: 100%; padding: 8px 10px; font-size: 13px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-weight: 700; color: #0284c7;">
              <option value="packets" ${(initialData?.unit==='packets')?'selected':''}>📦 Packets (pkts)</option>
              <option value="kg" ${(initialData?.unit==='kg')?'selected':''}>⚖️ Kilograms (kg)</option>
              <option value="bags" ${(initialData?.unit==='bags')?'selected':''}>🌾 Bags</option>
              <option value="liters" ${(initialData?.unit==='liters')?'selected':''}>🧪 Liters (L)</option>
              <option value="grams" ${(initialData?.unit==='grams')?'selected':''}>🌱 Grams (g)</option>
              <option value="boxes" ${(initialData?.unit==='boxes')?'selected':''}>📦 Master Boxes</option>
            </select>
          </div>

          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Batch / Lot No</label>
            <input type="text" id="invBatchNo" placeholder="LOT-BIH-2026" value="${escapeHtml(initialData?.batchNo || 'LOT-BIH-2026')}" style="width: 100%; padding: 8px 10px; font-size: 13px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--surface-alt); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
          <div>
            <label class="form-label" style="font-weight: 800; font-size: 13px; color: var(--primary);">
              Exact Quota Quantity * (<span id="unitDisplayLabel">${initialData?.unit || 'packets'}</span>)
            </label>
            <input type="number" id="invQuantity" required min="1" step="any" placeholder="e.g. 500" value="${initialData?.allocatedQty || ''}" style="width: 100%; padding: 8px 12px; font-size: 15px; font-weight: 800; border: 1.5px solid var(--primary); border-radius: var(--radius-sm); background: #fff;">
          </div>
          <div>
            <label class="form-label" style="font-weight: 800; font-size: 13px; color: var(--ink);">
              Landing Price / Unit (₹)
            </label>
            <input type="number" id="invUnitPrice" min="0" step="any" placeholder="e.g. 650" value="${initialData?.unitPrice || ''}" style="width: 100%; padding: 8px 12px; font-size: 15px; font-weight: 700; border: 1px solid var(--line); border-radius: var(--radius-sm); background: #fff;">
          </div>
        </div>

        <div>
          <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Assign / Allocate To *</label>
          <select id="invTargetRep" required style="width: 100%; padding: 9px 12px; font-size: 13.5px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-weight: 600;">
            <option value="ALL_ACTIVE">🌐 Allocate Equal Quota to ALL Active Assistants (${assistants.length} reps)</option>
            ${assistants.map(a => `
              <option value="${escapeHtml(a.name)}" ${(initialData?.targetRep === a.name) ? 'selected' : ''}>
                👤 ${escapeHtml(a.name)} — ${escapeHtml(a.hq)} HQ (${escapeHtml(a.district)})
              </option>
            `).join('')}
          </select>
          <p style="font-size: 11.5px; color: var(--muted); margin: 3px 0 0 0;">
            Assign to a specific assistant or mass-deploy standard seed quotas to all territory reps simultaneously.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Campaign / Season</label>
            <select id="invSeason" style="width: 100%; padding: 8px 10px; font-size: 13px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
              <option value="Rabi 2026">Rabi 2026</option>
              <option value="Kharif 2026">Kharif 2026</option>
              <option value="Zaid 2026">Zaid / Summer 2026</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Dispatch Date</label>
            <input type="date" id="invDate" value="${initialData?.allocatedDate || new Date().toISOString().slice(0, 10)}" style="width: 100%; padding: 8px 10px; font-size: 13px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
          </div>
        </div>

        <div>
          <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Manager Dispatch Notes & Liquidation Strategy</label>
          <textarea id="invNotes" rows="2" placeholder="e.g. Focus on Rosera belt Tier-A counters. Advise 20 pkts reserved for farmer trial plots..." style="width: 100%; padding: 8px 12px; font-size: 12.5px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-family: inherit;">${escapeHtml(initialData?.notes || '')}</textarea>
        </div>

        <!-- Submit Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; padding-top: 12px; border-top: 1px solid var(--line);">
          <button type="button" class="btn btn-secondary" id="btnCancelInvModal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btnSaveInventoryAllocation" style="font-weight: 800; background: #0284c7; border-color: #0369a1;">
            💾 Save & Issue Quota
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => modal.remove();
  document.getElementById('btnCloseInvModal')?.addEventListener('click', closeModal);
  document.getElementById('btnCancelInvModal')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Dynamic unit label update
  const unitSelect = document.getElementById('invUnit');
  const unitLabel = document.getElementById('unitDisplayLabel');
  unitSelect?.addEventListener('change', () => {
    if (unitLabel) unitLabel.textContent = unitSelect.value;
  });

  // Modal Bulk Excel Shortcut Handlers
  document.getElementById('btnModalDownloadTemplate')?.addEventListener('click', () => {
    downloadInventoryImportTemplate();
  });

  const modalFileInput = document.getElementById('modalFileInputInv');
  document.getElementById('btnModalUploadBulk')?.addEventListener('click', () => {
    modalFileInput?.click();
  });

  modalFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showToast('Parsing Excel spreadsheet…', '⏳');
      const { validRows, errors, totalRows } = await parseInventoryExcelFile(file);

      if (validRows.length === 0) {
        alert(
          `No valid stock quota rows found in "${file.name}".\n\n` +
          (errors.length ? 'Errors:\n' + errors.slice(0, 5).join('\n') : 'Please ensure Product Name and Quantity columns exist.')
        );
        modalFileInput.value = '';
        return;
      }

      if (confirm(`Import ${validRows.length} stock allocations from "${file.name}"?`)) {
        for (const item of validRows) {
          if (item.targetRep === 'ALL_ACTIVE') {
            assistants.forEach(a => {
              storage.saveInventoryAllocation({ ...item, targetRep: a.name });
              storage.sendAssistantNotification(a.name, {
                title: `New Stock Quota: ${item.allocatedQty} ${item.unit} of ${item.productName}`,
                message: `Management has issued ${item.allocatedQty} ${item.unit} of ${item.productName}.`,
                type: 'stock'
              });
            });
          } else {
            storage.saveInventoryAllocation(item);
            storage.sendAssistantNotification(item.targetRep, {
              title: `Stock Allocated: ${item.allocatedQty} ${item.unit} of ${item.productName}`,
              message: `Management has issued ${item.allocatedQty} ${item.unit} of ${item.productName}.`,
              type: 'stock'
            });
          }
        }
        showToast(`Imported ${validRows.length} stock quotas!`, '🎉');
        closeModal();
        if (onSaved) onSaved();
      }
    } catch(err) {
      alert('Error parsing file: ' + err.message);
    } finally {
      modalFileInput.value = '';
    }
  });

  // Preset button listeners
  modal.querySelectorAll('.inv-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('invProductName').value = btn.getAttribute('data-name');
      document.getElementById('invCrop').value = btn.getAttribute('data-crop');
      document.getElementById('invCategory').value = btn.getAttribute('data-cat');
      document.getElementById('invUnit').value = btn.getAttribute('data-unit');
      document.getElementById('invUnitPrice').value = btn.getAttribute('data-price');
      if (unitLabel) unitLabel.textContent = btn.getAttribute('data-unit');
      showToast(`Selected ${btn.getAttribute('data-name')}`, '✨');
    });
  });

  // Form submit
  document.getElementById('adminInventoryForm')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const productName = (document.getElementById('invProductName')?.value || '').trim();
    const crop = (document.getElementById('invCrop')?.value || '').trim();
    const category = document.getElementById('invCategory')?.value;
    const unit = document.getElementById('invUnit')?.value;
    const batchNo = (document.getElementById('invBatchNo')?.value || '').trim();
    const allocatedQty = parseFloat(document.getElementById('invQuantity')?.value);
    const unitPrice = parseFloat(document.getElementById('invUnitPrice')?.value) || 0;
    const targetRep = document.getElementById('invTargetRep')?.value;
    const season = document.getElementById('invSeason')?.value;
    const allocatedDate = document.getElementById('invDate')?.value || new Date().toISOString().slice(0, 10);
    const notes = (document.getElementById('invNotes')?.value || '').trim();

    if (!productName || !allocatedQty || isNaN(allocatedQty) || allocatedQty <= 0) {
      alert('Please enter a valid product name and positive quantity.');
      return;
    }

    if (targetRep === 'ALL_ACTIVE') {
      // Allocate equal quota to every active assistant
      assistants.forEach(a => {
        storage.saveInventoryAllocation({
          productName,
          crop,
          category,
          unit,
          batchNo,
          allocatedQty,
          unitPrice,
          targetRep: a.name,
          season,
          allocatedDate,
          notes
        });

        storage.sendAssistantNotification(a.name, {
          title: `New Stock Quota: ${allocatedQty} ${unit} of ${productName}`,
          message: `Management has issued ${allocatedQty} ${unit} of ${productName} for ${season}. Check your Stock Ledger to record sales & samples.`,
          type: 'stock'
        });
      });
      showToast(`Allocated ${allocatedQty} ${unit} of ${productName} to ALL ${assistants.length} assistants!`, '📦');
    } else {
      storage.saveInventoryAllocation({
        id: initialData?.id,
        productName,
        crop,
        category,
        unit,
        batchNo,
        allocatedQty,
        unitPrice,
        targetRep,
        season,
        allocatedDate,
        notes
      });

      storage.sendAssistantNotification(targetRep, {
        title: `Stock Allocated: ${allocatedQty} ${unit} of ${productName}`,
        message: `Management has issued ${allocatedQty} ${unit} of ${productName}. Check your Stock Ledger to log liquidation.`,
        type: 'stock'
      });
      showToast(`Issued ${allocatedQty} ${unit} of ${productName} to ${targetRep}!`, '📦');
    }

    closeModal();
    if (onSaved) onSaved();
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
