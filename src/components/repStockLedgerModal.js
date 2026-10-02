import { storage } from '../services/storage.js';
import { openRepStockUpdateModal } from './repStockUpdateModal.js';

export function openRepStockLedgerModal(assistantName, onRefresh = null) {
  const existing = document.getElementById('repStockLedgerModal');
  if (existing) existing.remove();

  const asstLedger = storage.getAssistantInventoryLedger(assistantName);
  const allocations = asstLedger.allocations || [];
  const movements = asstLedger.movements || [];

  const modal = document.createElement('div');
  modal.id = 'repStockLedgerModal';
  modal.className = 'modal-backdrop open';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;
    opacity: 1 !important; pointer-events: auto !important;
    animation: fadeIn 0.15s ease-out;
  `;

  modal.innerHTML = `
    <div class="card" style="width: 100%; max-width: 820px; max-height: 90vh; overflow-y: auto; background: var(--surface-card); box-shadow: var(--shadow-xl); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 0;">
      <!-- Header -->
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(22, 163, 74, 0.08));">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 26px;">📦</span>
          <div>
            <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 800; margin: 0; color: var(--ink);">
              My Physical Stock & Field Liquidation Ledger
            </h3>
            <p style="font-size: 12px; color: var(--muted); margin: 2px 0 0 0;">
              Assigned Representative: <strong style="color: var(--ink);">${escapeHtml(assistantName)}</strong>
            </p>
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="btn btn-primary btn-sm" id="btnLedgerLogMovement" style="font-weight: 700; background: #16a34a; border-color: #15803d;">
            ➕ Log Stock Sale / Sample
          </button>
          <button type="button" id="btnCloseRepLedgerModal" style="background: none; border: none; font-size: 22px; cursor: pointer; color: var(--muted); line-height: 1;">&times;</button>
        </div>
      </div>

      <!-- Quick Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; padding: 16px 20px; background: var(--surface-alt); border-bottom: 1px solid var(--line);">
        <div class="kpi-card" style="padding: 10px 12px;">
          <span class="kpi-label">Active Quota Items</span>
          <div class="kpi-value" style="font-size: 20px; color: var(--accent);">${allocations.length}</div>
          <span class="kpi-sub">Products Assigned</span>
        </div>
        <div class="kpi-card" style="padding: 10px 12px;">
          <span class="kpi-label">Liquidated Units</span>
          <div class="kpi-value" style="font-size: 20px; color: #16a34a;">${asstLedger.totalLiquidatedUnits}</div>
          <span class="kpi-sub">Sold to Dealers</span>
        </div>
        <div class="kpi-card" style="padding: 10px 12px;">
          <span class="kpi-label">Trial Samples</span>
          <div class="kpi-value" style="font-size: 20px; color: #7c3aed;">${asstLedger.totalSampleUnits}</div>
          <span class="kpi-sub">To Progressive Farmers</span>
        </div>
        <div class="kpi-card" style="padding: 10px 12px;">
          <span class="kpi-label">In-Hand Balance</span>
          <div class="kpi-value" style="font-size: 20px; color: var(--primary);">${asstLedger.totalBalanceUnits}</div>
          <span class="kpi-sub">Remaining Stock</span>
        </div>
        <div class="kpi-card" style="padding: 10px 12px;">
          <span class="kpi-label">Realized Value</span>
          <div class="kpi-value" style="font-size: 20px; color: var(--ink);">₹${(asstLedger.totalRealizedRevenue / 1000).toFixed(1)}k</div>
          <span class="kpi-sub">Counter Realization</span>
        </div>
      </div>

      <!-- Allocated Products Cards -->
      <div style="padding: 20px;">
        <h4 style="font-size: 14px; font-weight: 800; font-family: var(--font-heading); margin: 0 0 12px 0; color: var(--ink);">
          Assigned Stock Quotas & In-Hand Balance
        </h4>

        ${allocations.length === 0 ? `
          <div style="text-align: center; padding: 30px; color: var(--muted); border: 1px dashed var(--line); border-radius: var(--radius-sm);">
            No inventory quotas currently assigned to your station.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${allocations.map(a => {
              const pct = a.liquidationPct || 0;
              let barColor = '#16a34a';
              if (pct < 30) barColor = '#0284c7';
              else if (pct >= 85) barColor = '#16a34a';

              return `
                <div class="card" style="padding: 14px 16px; border-left: 4px solid ${barColor}; background: var(--surface);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong style="font-size: 15px; color: var(--ink); font-family: var(--font-heading);">
                          ${escapeHtml(a.productName)}
                        </strong>
                        <span class="badge" style="background: var(--surface-alt); font-size: 11px;">
                          🌾 ${escapeHtml(a.crop)}
                        </span>
                        <span class="badge" style="background: rgba(2, 132, 199, 0.1); color: var(--accent); font-size: 11px;">
                          ${escapeHtml(a.category)}
                        </span>
                        <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 11px;">
                          Lot: ${escapeHtml(a.batchNo || 'N/A')}
                        </span>
                      </div>

                      <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                        Allocated: <strong>${a.allocatedQty} ${escapeHtml(a.unit)}</strong> @ ₹${a.unitPrice}/unit · Dispatched: ${escapeHtml(a.allocatedDate)}
                        ${a.notes ? ` · Note: <em>"${escapeHtml(a.notes)}"</em>` : ''}
                      </div>

                      <!-- Progress bar -->
                      <div style="margin-top: 8px; max-width: 380px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                          <span>Liquidation Progress: <strong>${pct}%</strong></span>
                          <span>In-Hand Balance: <strong style="color: ${a.balanceQty === 0 ? 'var(--danger)' : '#16a34a'};">${a.balanceQty} ${escapeHtml(a.unit)}</strong></span>
                        </div>
                        <div style="height: 6px; width: 100%; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                          <div style="height: 100%; width: ${Math.min(pct, 100)}%; background: ${barColor};"></div>
                        </div>
                      </div>
                    </div>

                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                      <div style="font-size: 16px; font-weight: 800; color: #16a34a;">
                        ${a.liquidatedQty} <span style="font-size: 11px; font-weight: 500; color: var(--muted);">${escapeHtml(a.unit)} sold</span>
                      </div>
                      <div style="font-size: 11.5px; color: var(--muted);">
                        ${a.sampleQty} ${escapeHtml(a.unit)} demo samples
                      </div>
                      <button type="button" class="btn btn-secondary btn-sm btn-item-log-movement" data-alloc-id="${escapeHtml(a.id)}" style="font-size: 11.5px; padding: 4px 10px; font-weight: 700; color: var(--primary);">
                        ➕ Log Action
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}

        <!-- Movement Logs Table -->
        <h4 style="font-size: 14px; font-weight: 800; font-family: var(--font-heading); margin: 20px 0 10px 0; color: var(--ink);">
          Recent Liquidation & Sample Records (${movements.length})
        </h4>

        ${movements.length === 0 ? `
          <div style="text-align: center; padding: 20px; color: var(--muted); font-size: 12.5px;">
            No stock movements logged yet.
          </div>
        ` : `
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Qty / Unit</th>
                  <th>Recipient / Counter</th>
                  <th>Rate & Total</th>
                  <th>Ref #</th>
                </tr>
              </thead>
              <tbody>
                ${movements.map(m => `
                  <tr>
                    <td>
                      <div style="font-weight: 600; font-size: 12.5px;">${escapeHtml(m.date)}</div>
                      ${m.gps ? `<div style="font-size: 10px; color: #16a34a;">🛰️ GPS Verified</div>` : ''}
                    </td>
                    <td>
                      <span class="badge" style="font-weight: 700; background: ${m.movementType === 'liquidation' ? '#dcfce7; color: #166534;' : m.movementType === 'demo_sample' ? '#ede9fe; color: #6d28d9;' : '#fef3c7; color: #92400e;'}">
                        ${m.movementType === 'liquidation' ? '🛒 Sold' : m.movementType === 'demo_sample' ? '🌱 Sample' : escapeHtml(m.movementType)}
                      </span>
                    </td>
                    <td>
                      <strong>${m.quantity}</strong> <span style="font-size: 11px; color: var(--muted);">${escapeHtml(m.unit)}</span>
                    </td>
                    <td>
                      <div style="font-weight: 600; font-size: 12.5px;">${escapeHtml(m.recipientName)}</div>
                      ${m.notes ? `<div style="font-size: 11px; color: var(--muted);">${escapeHtml(m.notes)}</div>` : ''}
                    </td>
                    <td>
                      <div style="font-weight: 700; color: var(--ink);">₹${((m.quantity || 0) * (m.realizedPricePerUnit || 0)).toLocaleString()}</div>
                      <div style="font-size: 10.5px; color: var(--muted);">@ ₹${m.realizedPricePerUnit}/unit</div>
                    </td>
                    <td style="font-size: 11px; color: var(--muted);">
                      ${escapeHtml(m.invoiceOrRefNo || '—')}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  document.getElementById('btnCloseRepLedgerModal')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const handleOpenMovementModal = (allocId = null) => {
    closeModal();
    openRepStockUpdateModal(assistantName, allocId, () => {
      if (onRefresh) onRefresh();
    });
  };

  document.getElementById('btnLedgerLogMovement')?.addEventListener('click', () => handleOpenMovementModal());
  modal.querySelectorAll('.btn-item-log-movement').forEach(btn => {
    btn.addEventListener('click', () => {
      const allocId = btn.getAttribute('data-alloc-id');
      handleOpenMovementModal(allocId);
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
