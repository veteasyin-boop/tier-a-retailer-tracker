import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { detectBrowserLocation } from '../utils/geo.js';

export function openRepStockUpdateModal(assistantName, preselectedAllocId = null, onSaved = null) {
  const existing = document.getElementById('repStockUpdateModal');
  if (existing) existing.remove();

  const asstSummary = storage.getAssistantInventoryLedger(assistantName);
  const allocations = asstSummary.allocations || [];

  if (allocations.length === 0) {
    alert(`No active inventory quotas are currently assigned to ${assistantName}. Management must first allocate stock.`);
    return;
  }

  // Get rep's assigned counters
  const myRetailers = storage.rows.filter(r => r.assistant === assistantName);
  const myFarmerLeads = storage.getFarmerLeads().filter(l => l.assistant === assistantName);

  let currentGps = null;

  const modal = document.createElement('div');
  modal.id = 'repStockUpdateModal';
  modal.className = 'modal-backdrop open';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;
    opacity: 1 !important; pointer-events: auto !important;
    animation: fadeIn 0.15s ease-out;
  `;

  modal.innerHTML = `
    <div class="card" style="width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; background: var(--surface-card); box-shadow: var(--shadow-xl); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 0;">
      <!-- Modal Header -->
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, rgba(22, 163, 74, 0.1), rgba(2, 132, 199, 0.08));">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">📝</span>
          <div>
            <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; margin: 0; color: var(--ink);">
              Log Field Stock Movement & Liquidation
            </h3>
            <p style="font-size: 12px; color: var(--muted); margin: 2px 0 0 0;">
              Record dealer counter sales, farmer trial sample distributions, or stock returns.
            </p>
          </div>
        </div>
        <button type="button" id="btnCloseStockUpdateModal" style="background: none; border: none; font-size: 22px; cursor: pointer; color: var(--muted); line-height: 1;">&times;</button>
      </div>

      <!-- Live GPS Banner -->
      <div style="padding: 10px 20px; background: rgba(2, 132, 199, 0.08); border-bottom: 1px solid rgba(2, 132, 199, 0.2); display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>🛰️</span>
          <span id="stockGpsStatusText" style="color: var(--muted);">Acquiring live satellite coordinates…</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnRefreshStockGps" style="padding: 3px 8px; font-size: 11px;">
          🔄 Retry GPS
        </button>
      </div>

      <!-- Modal Body -->
      <form id="repStockUpdateForm" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <!-- Product Allocation Selection -->
        <div>
          <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Select Allocated Stock Item *</label>
          <select id="selStockAllocation" required style="width: 100%; padding: 10px 12px; font-size: 13.5px; border: 1.5px solid var(--primary); border-radius: var(--radius-sm); font-weight: 700;">
            ${allocations.map(a => `
              <option value="${escapeHtml(a.id)}" ${(preselectedAllocId === a.id) ? 'selected' : ''} data-balance="${a.balanceQty}" data-unit="${escapeHtml(a.unit)}" data-price="${a.unitPrice}">
                ${escapeHtml(a.productName)} — In-Hand Balance: ${a.balanceQty} ${escapeHtml(a.unit)} (Allocated: ${a.allocatedQty} ${escapeHtml(a.unit)})
              </option>
            `).join('')}
          </select>
        </div>

        <!-- In-Hand Balance Strip -->
        <div id="selectedStockBalanceCard" style="padding: 10px 14px; background: var(--surface-alt); border-radius: var(--radius-sm); border: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between;">
          <div>
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 700;">Current In-Hand Stock:</span>
            <div style="font-size: 18px; font-weight: 800; color: var(--primary);" id="dispBalanceVal">
              ${allocations[0]?.balanceQty || 0} ${allocations[0]?.unit || 'packets'}
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 700;">Batch / Rate:</span>
            <div style="font-size: 13px; font-weight: 600; color: var(--ink);" id="dispBatchVal">
              ${escapeHtml(allocations[0]?.batchNo || 'LOT-2026')} · ₹${allocations[0]?.unitPrice || 0}/unit
            </div>
          </div>
        </div>

        <!-- Movement Type -->
        <div>
          <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Movement / Action Type *</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); cursor: pointer; background: rgba(22, 163, 74, 0.05);">
              <input type="radio" name="movementType" value="liquidation" checked>
              <div>
                <strong style="font-size: 12.5px; color: #16a34a; display: block;">🛒 Counter Liquidation</strong>
                <span style="font-size: 11px; color: var(--muted);">Sold/delivered to Tier-A dealer</span>
              </div>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); cursor: pointer; background: rgba(2, 132, 199, 0.05);">
              <input type="radio" name="movementType" value="demo_sample">
              <div>
                <strong style="font-size: 12.5px; color: #0284c7; display: block;">🌱 Trial / Demo Sample</strong>
                <span style="font-size: 11px; color: var(--muted);">Free farmer sample for trials</span>
              </div>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); cursor: pointer;">
              <input type="radio" name="movementType" value="dealer_transfer">
              <div>
                <strong style="font-size: 12.5px; color: #7c3aed; display: block;">🔄 Counter Transfer</strong>
                <span style="font-size: 11px; color: var(--muted);">Stock rebalancing</span>
              </div>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); cursor: pointer;">
              <input type="radio" name="movementType" value="damage_return">
              <div>
                <strong style="font-size: 12.5px; color: #ea580c; display: block;">⚠️ Return / Damage</strong>
                <span style="font-size: 11px; color: var(--muted);">Damaged in transit / returned</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Quantity & Price -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="form-label" style="font-weight: 800; font-size: 13px;">
              Quantity Moved * (<span id="moveUnitLabel">${allocations[0]?.unit || 'packets'}</span>)
            </label>
            <input type="number" id="moveQuantity" required min="0.01" step="any" placeholder="e.g. 50" style="width: 100%; padding: 9px 12px; font-size: 15px; font-weight: 800; border: 1.5px solid var(--line); border-radius: var(--radius-sm);">
            <span id="moveQtyWarning" style="color: var(--danger); font-size: 11px; display: none; margin-top: 2px;">Cannot exceed in-hand balance!</span>
          </div>

          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Realized Price / Unit (₹)</label>
            <input type="number" id="moveRealizedPrice" step="any" placeholder="₹ per unit" value="${allocations[0]?.unitPrice || ''}" style="width: 100%; padding: 9px 12px; font-size: 14px; font-weight: 700; border: 1px solid var(--line); border-radius: var(--radius-sm);">
          </div>
        </div>

        <!-- Destination / Recipient -->
        <div id="recipientSection">
          <label class="form-label" style="font-weight: 700; font-size: 12.5px;" id="recipientLabel">
            Recipient Tier-A Dealer Counter *
          </label>
          <div style="display: flex; gap: 8px; margin-bottom: 6px;">
            <select id="selQuickDealer" style="width: 100%; padding: 8px 10px; font-size: 12.5px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
              <option value="">Choose from your assigned Tier-A counters…</option>
              ${myRetailers.map(r => `
                <option value="${escapeHtml(r.retailer)}">${escapeHtml(r.retailer)} (${escapeHtml(r.block)})</option>
              `).join('')}
            </select>
          </div>
          <input type="text" id="txtRecipientName" required placeholder="Or enter dealer / counter name" style="width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
        </div>

        <!-- Reference / Memo No & Date -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Invoice / Cash Receipt / Memo #</label>
            <input type="text" id="moveInvoiceNo" placeholder="e.g. INV-2026-441" style="width: 100%; padding: 8px 10px; font-size: 12.5px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
          </div>
          <div>
            <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Transaction Date</label>
            <input type="date" id="moveDate" value="${new Date().toISOString().slice(0, 10)}" style="width: 100%; padding: 8px 10px; font-size: 12.5px; border: 1px solid var(--line); border-radius: var(--radius-sm);">
          </div>
        </div>

        <div>
          <label class="form-label" style="font-weight: 700; font-size: 12.5px;">Field Liquidation Notes</label>
          <textarea id="moveNotes" rows="2" placeholder="e.g. Counter paid 50% advance; remaining due next Monday. Farmer responded favorably to trial seed." style="width: 100%; padding: 8px 12px; font-size: 12.5px; border: 1px solid var(--line); border-radius: var(--radius-sm); font-family: inherit;"></textarea>
        </div>

        <!-- Submit Button -->
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--line);">
          <button type="button" class="btn btn-secondary" id="btnCancelStockModal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btnSaveStockMovement" style="font-weight: 800; background: #16a34a; border-color: #15803d;">
            💾 Submit Stock Movement
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => modal.remove();
  document.getElementById('btnCloseStockUpdateModal')?.addEventListener('click', closeModal);
  document.getElementById('btnCancelStockModal')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // GPS detection
  const acquireGps = async () => {
    const statusText = document.getElementById('stockGpsStatusText');
    if (statusText) statusText.textContent = '🛰️ Acquiring live GPS position…';
    try {
      const loc = await detectBrowserLocation({ timeout: 6000 });
      if (loc.success) {
        currentGps = { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, isRealGps: true };
        if (statusText) statusText.innerHTML = `<span style="color: #16a34a; font-weight: 700;">🟢 GPS Verified: ${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}° (±${loc.accuracy}m)</span>`;
      } else {
        if (statusText) statusText.textContent = '⚠️ GPS unavailable (Manual verification)';
      }
    } catch (e) {
      if (statusText) statusText.textContent = '⚠️ GPS error (Manual entry)';
    }
  };
  acquireGps();
  document.getElementById('btnRefreshStockGps')?.addEventListener('click', acquireGps);

  // Update allocation card upon dropdown change
  const allocSelect = document.getElementById('selStockAllocation');
  const updateAllocDetails = () => {
    const selectedOption = allocSelect.options[allocSelect.selectedIndex];
    if (!selectedOption) return;
    const allocId = selectedOption.value;
    const alloc = allocations.find(a => a.id === allocId);
    if (!alloc) return;

    document.getElementById('dispBalanceVal').textContent = `${alloc.balanceQty} ${alloc.unit}`;
    document.getElementById('dispBatchVal').textContent = `${alloc.batchNo || 'LOT-2026'} · ₹${alloc.unitPrice}/unit`;
    document.getElementById('moveUnitLabel').textContent = alloc.unit;
    document.getElementById('moveRealizedPrice').value = alloc.unitPrice || '';
  };
  allocSelect?.addEventListener('change', updateAllocDetails);

  // Quick dealer pick listener
  document.getElementById('selQuickDealer')?.addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('txtRecipientName').value = e.target.value;
    }
  });

  // Radio button type switch (Dealer vs Farmer vs Other)
  modal.querySelectorAll('input[name="movementType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const type = radio.value;
      const label = document.getElementById('recipientLabel');
      const quickSelect = document.getElementById('selQuickDealer');

      if (type === 'demo_sample') {
        if (label) label.textContent = 'Recipient Progressive Farmer / Trial Plot *';
        if (quickSelect) {
          quickSelect.innerHTML = `<option value="">Choose from your farmer leads…</option>` +
            myFarmerLeads.map(l => `<option value="${escapeHtml(l.farmer_name)}">${escapeHtml(l.farmer_name)} (${escapeHtml(l.village)}) - ${escapeHtml(l.crop)}</option>`).join('');
        }
      } else {
        if (label) label.textContent = 'Recipient Tier-A Dealer Counter *';
        if (quickSelect) {
          quickSelect.innerHTML = `<option value="">Choose from your assigned Tier-A counters…</option>` +
            myRetailers.map(r => `<option value="${escapeHtml(r.retailer)}">${escapeHtml(r.retailer)} (${escapeHtml(r.block)})</option>`).join('');
        }
      }
    });
  });

  // Form submit
  document.getElementById('repStockUpdateForm')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const allocId = allocSelect.value;
    const alloc = allocations.find(a => a.id === allocId);
    if (!alloc) return;

    const movementType = modal.querySelector('input[name="movementType"]:checked')?.value || 'liquidation';
    const quantity = parseFloat(document.getElementById('moveQuantity')?.value);
    const realizedPricePerUnit = parseFloat(document.getElementById('moveRealizedPrice')?.value) || 0;
    const recipientName = (document.getElementById('txtRecipientName')?.value || '').trim();
    const invoiceOrRefNo = (document.getElementById('moveInvoiceNo')?.value || '').trim();
    const date = document.getElementById('moveDate')?.value || new Date().toISOString().slice(0, 10);
    const notes = (document.getElementById('moveNotes')?.value || '').trim();

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }

    if (quantity > alloc.balanceQty) {
      alert(`⚠️ Quantity (${quantity} ${alloc.unit}) cannot exceed your current in-hand balance of ${alloc.balanceQty} ${alloc.unit}!`);
      return;
    }

    if (!recipientName) {
      alert('Please specify the recipient dealer counter or farmer.');
      return;
    }

    storage.recordInventoryMovement({
      allocationId: allocId,
      assistant: assistantName,
      movementType,
      quantity,
      unit: alloc.unit,
      realizedPricePerUnit,
      recipientName,
      recipientType: movementType === 'demo_sample' ? 'farmer' : 'dealer',
      invoiceOrRefNo,
      date,
      notes,
      gps: currentGps
    });

    showToast(`Logged movement: ${quantity} ${alloc.unit} of ${alloc.productName}! Remaining balance: ${alloc.balanceQty - quantity} ${alloc.unit}`, '📦');
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
