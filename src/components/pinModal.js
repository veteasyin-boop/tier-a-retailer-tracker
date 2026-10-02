import { auth } from '../services/auth.js';
import { showToast } from './toast.js';

let pinModalResolve = null;

export function promptManagerPin(actionTitle = 'Manager Access Required', actionDesc = 'Enter your 4-digit Manager PIN to continue.') {
  return new Promise((resolve) => {
    pinModalResolve = resolve;
    let modalEl = document.getElementById('pinModal');
    if (!modalEl) {
      createPinModalDOM();
      modalEl = document.getElementById('pinModal');
    }

    document.getElementById('pinModalTitle').textContent = actionTitle;
    document.getElementById('pinModalDesc').textContent = actionDesc;
    const pinInput = document.getElementById('managerPinInput');
    pinInput.value = '';
    document.getElementById('pinErrorMsg').textContent = '';

    modalEl.classList.add('open');
    setTimeout(() => pinInput.focus(), 100);
  });
}

function closePinModal(success = false) {
  const modalEl = document.getElementById('pinModal');
  if (modalEl) modalEl.classList.remove('open');
  if (pinModalResolve) {
    pinModalResolve(success);
    pinModalResolve = null;
  }
}

function createPinModalDOM() {
  const backdrop = document.createElement('div');
  backdrop.id = 'pinModal';
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal-box" style="max-width: 400px; text-align: center;">
      <div style="font-size: 32px; margin-bottom: 8px;">🔐</div>
      <h3 class="modal-title" id="pinModalTitle" style="margin-bottom: 6px;">Manager Access Required</h3>
      <p id="pinModalDesc" style="color: var(--muted); font-size: 13px; margin-bottom: 18px;">
        Enter your 4-digit Manager PIN to continue.
      </p>

      <form id="pinForm">
        <div style="margin-bottom: 14px;">
          <input type="password" id="managerPinInput" maxlength="8" placeholder="Enter PIN (Default: 2026)" 
                 style="font-size: 20px; letter-spacing: 6px; text-align: center; width: 100%; font-weight: 700;">
          <div id="pinErrorMsg" style="color: var(--danger); font-size: 12px; margin-top: 6px; font-weight: 600; min-height: 18px;"></div>
        </div>

        <div style="display: flex; gap: 8px; justify-content: center;">
          <button type="button" class="btn btn-secondary" id="pinCancelBtn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="pinSubmitBtn">Authorize ✓</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  document.getElementById('pinCancelBtn')?.addEventListener('click', () => closePinModal(false));

  document.getElementById('pinForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('managerPinInput')?.value.trim();
    if (auth.verifyManagerPin(pin)) {
      closePinModal(true);
    } else {
      document.getElementById('pinErrorMsg').textContent = 'Incorrect PIN. Try default (2026).';
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePinModal(false);
  });
}
