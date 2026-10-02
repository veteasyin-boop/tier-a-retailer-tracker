import { storage } from '../services/storage.js';
import { auth } from '../services/auth.js';
import { showToast } from './toast.js';

export function openRetailerModal(existingDoc = null, defaultAssistant = '') {
  let modalBackdrop = document.getElementById('retailerModal');
  if (!modalBackdrop) {
    createModalDOM();
    modalBackdrop = document.getElementById('retailerModal');
  }

  const titleEl = document.getElementById('modalTitle');
  const idInput = document.getElementById('formDocId');
  const form = document.getElementById('retailerForm');
  const sel = document.getElementById('formAssistant');

  form.reset();

  const assistants = storage.getAssistants();
  sel.innerHTML = `<option value="">Select Field Rep…</option>` + 
    assistants.map(a => `<option value="${a.name}">${a.name} (${a.district})</option>`).join('');

  const assignedRep = auth.getAssignedRep();

  if (existingDoc && existingDoc.id) {
    titleEl.textContent = `Edit Retailer: ${existingDoc.retailer}`;
    idInput.value = existingDoc.id;
    document.getElementById('formRetailer').value = existingDoc.retailer || '';
    sel.value = existingDoc.assistant || '';
    document.getElementById('formHq').value = existingDoc.hq || '';
    document.getElementById('formDistrict').value = existingDoc.district || '';
    document.getElementById('formBlock').value = existingDoc.block || '';
    document.getElementById('formMobile').value = existingDoc.mobile || '';
    document.getElementById('formStatus').value = existingDoc.status || 'Pending';
    document.getElementById('formPotentialFor').value = existingDoc.potentialFor || '';
    document.getElementById('formPotentialSell').value = existingDoc.potentialSell || '';
    document.getElementById('formNotes').value = existingDoc.notes || '';
  } else {
    titleEl.textContent = 'Add New Retailer';
    idInput.value = '';
    if (existingDoc && existingDoc.block) {
      document.getElementById('formBlock').value = existingDoc.block;
      document.getElementById('formDistrict').value = existingDoc.district || 'Patna';
      document.getElementById('formHq').value = existingDoc.hq || existingDoc.block;
    }
    const initialRep = defaultAssistant || (auth.isAdmin ? '' : assignedRep);
    if (initialRep) {
      sel.value = initialRep;
      autoFillHq();
    }
  }

  // Strict Silo: If not Admin, lock assistant selector to assigned rep
  if (!auth.isAdmin) {
    if (assignedRep) {
      sel.value = assignedRep;
      sel.disabled = true;
      autoFillHq();
    }
  } else {
    sel.disabled = false;
  }

  modalBackdrop.classList.add('open');
}

export function closeRetailerModal() {
  const modalBackdrop = document.getElementById('retailerModal');
  if (modalBackdrop) {
    modalBackdrop.classList.remove('open');
  }
}

export function autoFillHq() {
  const aName = document.getElementById('formAssistant')?.value;
  const a = storage.getAssistants().find(item => item.name === aName);
  if (a) {
    const hqInput = document.getElementById('formHq');
    const distInput = document.getElementById('formDistrict');
    if (hqInput) hqInput.value = a.hq;
    if (distInput && !distInput.value) distInput.value = a.district;
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('formDocId').value || ('r_' + Date.now());
  const retailer = document.getElementById('formRetailer').value.trim();
  const assistant = auth.isAdmin 
    ? document.getElementById('formAssistant').value 
    : auth.getAssignedRep();
  const hq = document.getElementById('formHq').value.trim();
  const district = document.getElementById('formDistrict').value.trim();
  const block = document.getElementById('formBlock').value.trim();
  const mobile = document.getElementById('formMobile').value.trim();
  const status = document.getElementById('formStatus').value;
  const potentialFor = document.getElementById('formPotentialFor').value;
  const potentialSell = document.getElementById('formPotentialSell').value;
  const notes = document.getElementById('formNotes').value.trim();

  const doc = {
    id,
    retailer,
    assistant,
    hq,
    district,
    block,
    mobile,
    status,
    potentialFor,
    potentialSell,
    notes
  };

  try {
    await storage.saveRow(doc);
    closeRetailerModal();
    showToast(`Saved retailer details for "${retailer}"`, '✅');
  } catch(err) {
    showToast(err.message, '❌');
  }
}

function createModalDOM() {
  const modalBackdrop = document.createElement('div');
  modalBackdrop.id = 'retailerModal';
  modalBackdrop.className = 'modal-backdrop';

  modalBackdrop.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 class="modal-title" id="modalTitle">Add New Retailer</h3>
        <button type="button" class="btn btn-secondary btn-icon" id="modalCloseBtn">✕</button>
      </div>
      <form id="retailerForm">
        <input type="hidden" id="formDocId">
        <div class="modal-form-grid-2" style="margin-bottom: 14px;">
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Retailer Name / Firm Name *</label>
            <input type="text" id="formRetailer" required placeholder="e.g. Kisan Seva Kendra">
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Assistant *</label>
            <select id="formAssistant" required></select>
          </div>
          <div class="form-group">
            <label class="form-label">Base Station (HQ)</label>
            <input type="text" id="formHq" placeholder="e.g. Bihta">
          </div>
          <div class="form-group">
            <label class="form-label">District *</label>
            <input type="text" id="formDistrict" required placeholder="e.g. Patna">
          </div>
          <div class="form-group">
            <label class="form-label">Block Name *</label>
            <input type="text" id="formBlock" required placeholder="e.g. Bihta">
          </div>
          <div class="form-group">
            <label class="form-label">Mobile Number</label>
            <input type="tel" id="formMobile" placeholder="10-digit mobile" maxlength="12">
          </div>
          <div class="form-group">
            <label class="form-label">Visit Status</label>
            <select id="formStatus">
              <option value="Pending">Pending Contact</option>
              <option value="Called">Call Completed</option>
              <option value="Visited">Shop Visited</option>
              <option value="Closed">Order Booked</option>
              <option value="Followup">Follow-up Required</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Potential Category</label>
            <select id="formPotentialFor">
              <option value="">Select Category…</option>
              <option value="Veg">Vegetables (Veg)</option>
              <option value="CP">Crop Protection (CP)</option>
              <option value="Field">Field Crops</option>
              <option value="Multi">Multi-Category</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Potential Value (₹)</label>
            <select id="formPotentialSell">
              <option value="">Select Bracket…</option>
              <option value="5000-10000">₹5,000 - ₹10,000</option>
              <option value="10000-15000">₹10,000 - ₹15,000</option>
              <option value="15000-20000">₹15,000 - ₹20,000</option>
              <option value=">20000">> ₹20,000</option>
            </select>
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Field Notes / Stock Inquiry</label>
            <textarea id="formNotes" rows="2" placeholder="e.g. Inquired about hybrid cauliflower and insecticide stock. Follow up after harvest."></textarea>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
          <button type="button" class="btn btn-secondary" id="modalCancelBtn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modalSaveBtn">Save Record ✓</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modalBackdrop);

  document.getElementById('modalCloseBtn')?.addEventListener('click', closeRetailerModal);
  document.getElementById('modalCancelBtn')?.addEventListener('click', closeRetailerModal);
  document.getElementById('formAssistant')?.addEventListener('change', autoFillHq);
  document.getElementById('retailerForm')?.addEventListener('submit', handleFormSubmit);

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeRetailerModal();
  });
}
