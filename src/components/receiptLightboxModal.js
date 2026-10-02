import { escapeHtml } from '../utils/geo.js';

/**
 * Opens an ultra-crisp modal lightbox to view an attached receipt / bill
 * @param {Object} bill - { id, name, category, amount, notes, dataUrl, uploadedAt }
 */
export function openReceiptLightboxModal(bill) {
  if (!bill) return;
  const existing = document.getElementById('receiptLightboxModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.id = 'receiptLightboxModal';
  modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 10005; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px);';

  const isPdf = (bill.dataUrl && bill.dataUrl.startsWith('data:application/pdf')) || (bill.name && bill.name.toLowerCase().endsWith('.pdf'));

  modal.innerHTML = `
    <div class="modal-box" style="width: 95%; max-width: 640px; max-height: 92vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.2); overflow: hidden; animation: modal-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
      
      <!-- Lightbox Header -->
      <div style="padding: 14px 20px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center; font-size: 20px;">
            🧾
          </div>
          <div>
            <div style="font-weight: 800; font-size: 15px; font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
              <span>${escapeHtml(bill.name || 'Expense Receipt')}</span>
              <span class="badge" style="background: rgba(16, 185, 129, 0.25); color: #34d399; font-size: 11px; padding: 2px 7px;">
                ${escapeHtml(bill.category || 'Receipt')}
              </span>
            </div>
            <div style="font-size: 11.5px; opacity: 0.85; margin-top: 1px;">
              Amount: <strong style="color: #6ee7b7; font-size: 13px;">₹${Number(bill.amount || 0).toLocaleString()}</strong>
              ${bill.uploadedAt ? ` · Uploaded: ${new Date(bill.uploadedAt).toLocaleString('en-IN')}` : ''}
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-sm" id="btnCloseLightbox" style="background: rgba(255, 255, 255, 0.15); border: none; color: #fff; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ✕
        </button>
      </div>

      <!-- Preview Image / Document Viewport -->
      <div style="flex: 1; overflow: auto; padding: 18px; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 340px;">
        ${isPdf ? `
          <div style="text-align: center; padding: 30px;">
            <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
            <div style="font-weight: 700; color: #1e293b; font-size: 15px;">PDF Document Attached</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px; margin-bottom: 16px;">${escapeHtml(bill.name)}</div>
            <a href="${bill.dataUrl}" download="${escapeHtml(bill.name || 'receipt.pdf')}" class="btn btn-primary" style="font-weight: 700;">
              📥 Download PDF Receipt
            </a>
          </div>
        ` : bill.dataUrl ? `
          <div style="width: 100%; display: flex; justify-content: center; background: #fff; border-radius: 8px; padding: 10px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <img src="${bill.dataUrl}" alt="${escapeHtml(bill.name || 'Receipt')}" style="max-width: 100%; max-height: 480px; object-fit: contain; border-radius: 4px;" />
          </div>
        ` : `
          <div style="color: #64748b; font-size: 13px; text-align: center; padding: 40px;">
            No visual preview available for this receipt.
          </div>
        `}

        ${bill.notes ? `
          <div style="width: 100%; margin-top: 14px; padding: 10px 14px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px;">
            <span style="font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10.5px;">Receipt Notes / Description:</span>
            <div style="color: #1e293b; margin-top: 2px;">${escapeHtml(bill.notes)}</div>
          </div>
        ` : ''}
      </div>

      <!-- Footer Bar -->
      <div style="padding: 12px 20px; background: #fff; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 11px; color: #64748b;">
          Audit ID: <strong>${escapeHtml(bill.id || 'N/A')}</strong>
        </span>

        <div style="display: flex; gap: 8px;">
          ${bill.dataUrl ? `
            <a href="${bill.dataUrl}" download="${escapeHtml(bill.name || 'expense_receipt.png')}" class="btn btn-secondary btn-sm" style="font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
              <span>💾</span>
              <span>Download</span>
            </a>
          ` : ''}
          <button type="button" class="btn btn-primary btn-sm" id="btnCloseLightboxBtn" style="font-size: 11.5px; font-weight: 700;">
            Close Viewer
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#btnCloseLightbox')?.addEventListener('click', close);
  modal.querySelector('#btnCloseLightboxBtn')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}
