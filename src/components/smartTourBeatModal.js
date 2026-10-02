import { storage } from '../services/storage.js';
import { auth } from '../services/auth.js';
import { showToast } from './toast.js';
import { BIHAR_BLOCKS, calculateDistanceKm, detectBrowserLocation, escapeHtml, optimizeTourBeatRoute } from '../utils/geo.js';
import { openReceiptLightboxModal } from './receiptLightboxModal.js';

let activeBeatModalTab = 'beat'; // 'beat' | 'tada'
let currentBeatResult = null;
let selectedDealerIds = new Set();
let detectedLiveGps = null;
let isLocating = false;
let claimVehicleMode = null; // 'Bike' | 'Car'
let claimAttachedBills = []; // [{ id, name, category, amount, notes, dataUrl, uploadedAt }]

export function openSmartTourBeatModal(options = {}) {
  const existing = document.getElementById('smartTourBeatModal');
  if (existing) existing.remove();

  claimVehicleMode = null;
  claimAttachedBills = [];

  activeBeatModalTab = options.initialTab || 'beat';
  const assignedRep = options.assistant || auth.getAssignedRep();
  const allAssistants = storage.getAssistants();
  const repInfo = allAssistants.find(a => a.name === assignedRep) || allAssistants[0];

  // Load rep's dealers
  const repDealers = storage.rows.filter(r => r.assistant === repInfo.name);

  // Default block
  const defaultBlock = options.block || (repDealers[0]?.block || repInfo.hq || 'Bihta');

  // Today's date string
  const todayStr = new Date().toISOString().split('T')[0];
  let selectedDate = options.date || todayStr;

  // Initial selected dealers (from today's existing beat or top 5 in block)
  const existingBeat = storage.getTourBeatPlan(repInfo.name, selectedDate);
  selectedDealerIds.clear();
  if (existingBeat && existingBeat.stops && existingBeat.stops.length > 0) {
    existingBeat.stops.forEach(s => selectedDealerIds.add(s.id));
  } else {
    // Select first 5 in default block
    const blockDealers = repDealers.filter(r => (r.block || '').toLowerCase() === defaultBlock.toLowerCase());
    blockDealers.slice(0, 5).forEach(d => selectedDealerIds.add(d.id));
  }

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.id = 'smartTourBeatModal';
  modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 9999;';

  modal.innerHTML = `
    <div class="modal-box" style="width: 95%; max-width: 920px; max-height: 92vh; display: flex; flex-direction: column; background: var(--surface-card); border-radius: var(--radius-lg); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid var(--line); overflow: hidden; animation: modal-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
      
      <!-- Modal Header -->
      <div style="padding: 16px 22px; background: linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%); color: #fff; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(255, 255, 255, 0.18); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
            🗺️
          </div>
          <div>
            <div style="font-weight: 800; font-size: 17px; font-family: var(--font-heading); letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px;">
              <span>Smart Tour Beat & TA/DA Hub</span>
              <span class="badge" style="background: rgba(255, 255, 255, 0.2); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px;">
                Bihar AgTech AI
              </span>
            </div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
              ${escapeHtml(repInfo.name)} · Station HQ: <strong>${escapeHtml(repInfo.hq)}</strong> · District: <strong>${escapeHtml(repInfo.district)}</strong>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-sm" id="btnCloseBeatModal" style="background: rgba(255, 255, 255, 0.15); border: none; color: #fff; font-size: 14px; width: 34px; height: 34px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ✕
        </button>
      </div>

      <!-- Tab Switcher Navigation -->
      <div style="display: flex; border-bottom: 1px solid var(--line); background: var(--surface-bg);">
        <button type="button" class="tab-btn ${activeBeatModalTab === 'beat' ? 'active' : ''}" id="btnTabBeatOptimizer" style="flex: 1; padding: 13px 18px; font-weight: 700; font-size: 13.5px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; border-bottom: 3px solid ${activeBeatModalTab === 'beat' ? 'var(--primary)' : 'transparent'}; color: ${activeBeatModalTab === 'beat' ? 'var(--primary)' : 'var(--muted)'};">
          <span>🗺️</span>
          <span>GPS Beat & Route Optimizer (TSP)</span>
        </button>
        <button type="button" class="tab-btn ${activeBeatModalTab === 'tada' ? 'active' : ''}" id="btnTabTadaClaims" style="flex: 1; padding: 13px 18px; font-weight: 700; font-size: 13.5px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; border-bottom: 3px solid ${activeBeatModalTab === 'tada' ? 'var(--primary)' : 'transparent'}; color: ${activeBeatModalTab === 'tada' ? 'var(--primary)' : 'var(--muted)'};">
          <span>💰</span>
          <span>Verified TA/DA Mileage Claim Dossier</span>
        </button>
      </div>

      <!-- Tab Dynamic Content Container -->
      <div id="beatModalViewport" style="flex: 1; overflow-y: auto; padding: 20px; background: var(--surface-bg);">
        <!-- Rendered by renderActiveTab() -->
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Render content
  renderActiveTab(modal, repInfo, repDealers, defaultBlock, selectedDate);

  // Close handlers
  modal.querySelector('#btnCloseBeatModal')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Tab switchers
  modal.querySelector('#btnTabBeatOptimizer')?.addEventListener('click', () => {
    activeBeatModalTab = 'beat';
    updateTabsUI(modal);
    renderActiveTab(modal, repInfo, repDealers, defaultBlock, selectedDate);
  });

  modal.querySelector('#btnTabTadaClaims')?.addEventListener('click', () => {
    activeBeatModalTab = 'tada';
    updateTabsUI(modal);
    renderActiveTab(modal, repInfo, repDealers, defaultBlock, selectedDate);
  });
}

function updateTabsUI(modal) {
  const btnBeat = modal.querySelector('#btnTabBeatOptimizer');
  const btnTada = modal.querySelector('#btnTabTadaClaims');
  if (btnBeat && btnTada) {
    if (activeBeatModalTab === 'beat') {
      btnBeat.style.borderBottom = '3px solid var(--primary)';
      btnBeat.style.color = 'var(--primary)';
      btnTada.style.borderBottom = '3px solid transparent';
      btnTada.style.color = 'var(--muted)';
    } else {
      btnTada.style.borderBottom = '3px solid var(--primary)';
      btnTada.style.color = 'var(--primary)';
      btnBeat.style.borderBottom = '3px solid transparent';
      btnBeat.style.color = 'var(--muted)';
    }
  }
}

function renderActiveTab(modal, repInfo, repDealers, currentBlock, selectedDate) {
  const viewport = modal.querySelector('#beatModalViewport');
  if (!viewport) return;

  if (activeBeatModalTab === 'beat') {
    renderBeatOptimizerTab(viewport, modal, repInfo, repDealers, currentBlock, selectedDate);
  } else {
    renderTadaClaimTab(viewport, modal, repInfo, repDealers, selectedDate);
  }
}

// ========================================================
// TAB 1: 🗺️ SMART TOUR BEAT & ROUTE OPTIMIZER
// ========================================================

function renderBeatOptimizerTab(viewport, modal, repInfo, repDealers, currentBlock, selectedDate) {
  // Unique blocks in territory
  const blocksInTerritory = [...new Set(repDealers.map(r => r.block).filter(Boolean))].sort();
  if (!blocksInTerritory.includes(repInfo.hq) && repInfo.hq) {
    blocksInTerritory.unshift(repInfo.hq);
  }

  // Dealers in selected block
  const dealersInBlock = repDealers.filter(r => (r.block || '').toLowerCase() === currentBlock.toLowerCase());

  // Check-in status lookup for today
  const todayStr = new Date().toISOString().split('T')[0];
  const allLogs = storage.getCheckInLogs();
  const todayLogs = allLogs.filter(l => l.rep === repInfo.name && (l.date === todayStr || l.checkInDate === todayStr));
  const checkedInRetailerIds = new Set(todayLogs.map(l => l.retailerId));

  // Determine origin HQ coords
  const hqBlockObj = BIHAR_BLOCKS.find(b => b.block.toLowerCase() === (repInfo.hq || '').toLowerCase()) || BIHAR_BLOCKS[0];
  const hqCoords = { lat: hqBlockObj.lat, lng: hqBlockObj.lng, name: `${repInfo.hq} Station HQ` };

  // Current origin
  const currentOrigin = detectedLiveGps || hqCoords;

  viewport.innerHTML = `
    <!-- Top Step Controls -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 16px;">
      
      <!-- Block & Date Selection Card -->
      <div class="card" style="padding: 14px 16px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 0.05em; margin-bottom: 8px;">
          1. Select Beat Block & Territory
        </div>
        
        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
          <div style="flex: 1;">
            <label style="font-size: 11px; color: var(--muted); font-weight: 600; display: block; margin-bottom: 3px;">Target Block</label>
            <select id="selBeatBlock" class="form-control" style="font-size: 13px; font-weight: 700; padding: 6px 10px;">
              ${blocksInTerritory.map(b => `
                <option value="${escapeHtml(b)}" ${b.toLowerCase() === currentBlock.toLowerCase() ? 'selected' : ''}>
                  ${escapeHtml(b)} (${repDealers.filter(r => (r.block || '').toLowerCase() === b.toLowerCase()).length} Dealers)
                </option>
              `).join('')}
            </select>
          </div>

          <div style="width: 135px;">
            <label style="font-size: 11px; color: var(--muted); font-weight: 600; display: block; margin-bottom: 3px;">Beat Date</label>
            <input type="date" id="iptBeatDate" class="form-control" value="${selectedDate}" style="font-size: 12px; font-weight: 600; padding: 6px 8px;" />
          </div>
        </div>

        <div style="font-size: 11.5px; color: var(--muted); display: flex; align-items: center; justify-content: space-between;">
          <span>Available Counters in ${escapeHtml(currentBlock)}: <strong>${dealersInBlock.length}</strong></span>
          <span style="color: var(--primary); font-weight: 700;">${selectedDealerIds.size} Selected</span>
        </div>
      </div>

      <!-- Departure Origin & GPS Card -->
      <div class="card" style="padding: 14px 16px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 0.05em; margin-bottom: 8px;">
          2. Journey Departure Point
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
          <div>
            <div style="font-weight: 700; font-size: 13px; color: var(--ink);">
              ${detectedLiveGps ? '📍 Live Detected GPS Position' : `🏢 ${escapeHtml(repInfo.hq)} Base HQ Station`}
            </div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 1px;">
              Coordinates: ${currentOrigin.lat.toFixed(4)}°, ${currentOrigin.lng.toFixed(4)}°
            </div>
          </div>

          <button type="button" class="btn btn-secondary btn-sm" id="btnDetectLiveBeatGps" style="font-size: 11px; font-weight: 700; padding: 5px 10px; white-space: nowrap;" ${isLocating ? 'disabled' : ''}>
            ${isLocating ? '⏳ Acquiring GPS…' : '📍 Detect Live GPS'}
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 14px; font-size: 11.5px; color: var(--ink); margin-top: 6px; border-top: 1px dashed var(--line); padding-top: 6px;">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" id="chkReturnToHq" checked />
            <span style="font-weight: 600;">Round Trip (Return to Station HQ)</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Dealer Selection List (Multi-Select) -->
    <div class="card" style="padding: 14px 16px; margin-bottom: 16px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <div style="font-size: 13px; font-weight: 800; color: var(--ink); display: flex; align-items: center; gap: 6px;">
          <span>🎯 Select Target Counters to Visit Today</span>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #16a34a; font-size: 11px;">
            ${selectedDealerIds.size} / ${dealersInBlock.length} Selected
          </span>
        </div>

        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnSelectAllDealers" style="font-size: 11px; padding: 3px 8px;">
            Select All in Block
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btnClearSelectedDealers" style="font-size: 11px; padding: 3px 8px;">
            Clear Selection
          </button>
        </div>
      </div>

      <!-- Dealer Checkbox Grid -->
      <div style="max-height: 200px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; padding-right: 4px;">
        ${dealersInBlock.length === 0 ? `
          <div style="grid-column: 1 / -1; padding: 18px; text-align: center; color: var(--muted); font-size: 12.5px;">
            No retailers registered under ${escapeHtml(currentBlock)} block for this station.
          </div>
        ` : dealersInBlock.map(d => {
          const isChecked = selectedDealerIds.has(d.id);
          const isCheckedIn = checkedInRetailerIds.has(d.id);
          return `
            <label class="card" style="margin: 0; padding: 8px 10px; display: flex; align-items: flex-start; gap: 8px; cursor: pointer; background: ${isChecked ? 'rgba(16, 185, 129, 0.06)' : 'var(--surface-bg)'}; border: 1px solid ${isChecked ? 'var(--primary)' : 'var(--line)'}; border-radius: var(--radius-sm); transition: all 0.15s ease;">
              <input type="checkbox" class="chk-dealer-select" data-id="${escapeHtml(d.id)}" ${isChecked ? 'checked' : ''} style="margin-top: 3px;" />
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; font-size: 12px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(d.retailer)}
                </div>
                <div style="font-size: 10.5px; color: var(--muted); display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
                  <span>${escapeHtml(d.potentialFor || 'Hybrid Seeds')}</span>
                  ${isCheckedIn ? `<span style="color: #16a34a; font-weight: 800;">✓ Checked-In</span>` : ''}
                </div>
              </div>
            </label>
          `;
        }).join('')}
      </div>

      <!-- Optimization Trigger Bar -->
      <div style="margin-top: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-top: 1px solid var(--line); padding-top: 12px;">
        <div style="font-size: 12px; color: var(--muted);">
          Algorithm uses <strong>Nearest-Neighbor Traveling Salesperson (TSP)</strong> sequence with rural road curvature.
        </div>

        <button type="button" class="btn btn-primary" id="btnCalculateTspRoute" style="font-weight: 800; font-size: 13.5px; padding: 9px 20px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);" ${selectedDealerIds.size === 0 ? 'disabled' : ''}>
          ⚡ Optimize Beat Sequence (${selectedDealerIds.size} Stops) →
        </button>
      </div>
    </div>

    <!-- Output Section: Optimized Roadmap & Google Maps Navigation -->
    <div id="beatOptimizationResultViewport">
      ${renderOptimizedRouteContent(currentBeatResult, checkedInRetailerIds, repInfo, selectedDate)}
    </div>
  `;

  // Attach event handlers
  modal.querySelector('#selBeatBlock')?.addEventListener('change', (e) => {
    const newBlock = e.target.value;
    // Auto-select first 5 in new block
    const blockDealers = repDealers.filter(r => (r.block || '').toLowerCase() === newBlock.toLowerCase());
    selectedDealerIds.clear();
    blockDealers.slice(0, 5).forEach(d => selectedDealerIds.add(d.id));
    currentBeatResult = null;
    renderActiveTab(modal, repInfo, repDealers, newBlock, selectedDate);
  });

  modal.querySelector('#iptBeatDate')?.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderActiveTab(modal, repInfo, repDealers, currentBlock, selectedDate);
  });

  modal.querySelector('#btnDetectLiveBeatGps')?.addEventListener('click', async () => {
    isLocating = true;
    renderActiveTab(modal, repInfo, repDealers, currentBlock, selectedDate);
    const loc = await detectBrowserLocation();
    isLocating = false;
    if (loc.success) {
      detectedLiveGps = { lat: loc.lat, lng: loc.lng, name: 'Live GPS Location' };
      showToast(`📍 Live Location Detected: ${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}°`, '📍');
    } else {
      showToast(`GPS Error: ${loc.error}. Using Station HQ.`, '⚠️');
    }
    renderActiveTab(modal, repInfo, repDealers, currentBlock, selectedDate);
  });

  modal.querySelector('#btnSelectAllDealers')?.addEventListener('click', () => {
    dealersInBlock.forEach(d => selectedDealerIds.add(d.id));
    renderActiveTab(modal, repInfo, repDealers, currentBlock, selectedDate);
  });

  modal.querySelector('#btnClearSelectedDealers')?.addEventListener('click', () => {
    selectedDealerIds.clear();
    currentBeatResult = null;
    renderActiveTab(modal, repInfo, repDealers, currentBlock, selectedDate);
  });

  modal.querySelectorAll('.chk-dealer-select').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedDealerIds.add(id);
      else selectedDealerIds.delete(id);
      currentBeatResult = null;
      renderActiveTab(modal, repInfo, repDealers, currentBlock, selectedDate);
    });
  });

  modal.querySelector('#btnCalculateTspRoute')?.addEventListener('click', () => {
    const selectedDealers = repDealers.filter(r => selectedDealerIds.has(r.id));
    if (selectedDealers.length === 0) return showToast('Please select at least 1 counter.', '⚠️');

    const returnToHq = modal.querySelector('#chkReturnToHq')?.checked !== false;
    currentBeatResult = optimizeTourBeatRoute(currentOrigin, selectedDealers, { returnToHq });

    showToast(`⚡ Route Optimized! ${currentBeatResult.totalDistanceKm} km across ${currentBeatResult.orderedStops.length} stops.`, '✅');
    renderActiveTab(modal, repInfo, repDealers, currentBlock, selectedDate);
  });

  attachBeatResultActions(modal, repInfo, currentBlock, selectedDate);
}

function renderOptimizedRouteContent(beatResult, checkedInRetailerIds, repInfo, selectedDate) {
  if (!beatResult) {
    return `
      <div class="card" style="padding: 24px; text-align: center; background: var(--surface-card); border: 1.5px dashed var(--line); border-radius: var(--radius-md);">
        <div style="font-size: 32px; margin-bottom: 8px;">🗺️</div>
        <div style="font-size: 14px; font-weight: 700; color: var(--ink);">No Route Sequence Calculated Yet</div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
          Choose your target counters above and click "⚡ Optimize Beat Sequence" to compute the shortest GPS navigation path.
        </div>
      </div>
    `;
  }

  const hoursDriving = Math.floor(beatResult.totalDrivingMinutes / 60);
  const minsDriving = beatResult.totalDrivingMinutes % 60;
  const hoursShift = Math.floor(beatResult.totalShiftMinutes / 60);
  const minsShift = beatResult.totalShiftMinutes % 60;

  return `
    <div class="card" style="padding: 16px 20px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(2, 132, 199, 0.06) 100%); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); margin-bottom: 16px;">
      
      <!-- Telemetry Metric Badges -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 16px;">
        <div style="background: var(--surface-card); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Total Distance</div>
          <div style="font-size: 18px; font-weight: 900; color: var(--primary); margin-top: 2px;">
            ${beatResult.totalDistanceKm} <span style="font-size: 12px; font-weight: 600;">km</span>
          </div>
        </div>

        <div style="background: var(--surface-card); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Est. Driving Time</div>
          <div style="font-size: 18px; font-weight: 900; color: #0284c7; margin-top: 2px;">
            ${hoursDriving > 0 ? `${hoursDriving}h ` : ''}${minsDriving}m
          </div>
        </div>

        <div style="background: var(--surface-card); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Target Counters</div>
          <div style="font-size: 18px; font-weight: 900; color: var(--ink); margin-top: 2px;">
            ${beatResult.orderedStops.length} <span style="font-size: 12px; font-weight: 600;">Stops</span>
          </div>
        </div>

        <div style="background: var(--surface-card); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Total Shift Duration</div>
          <div style="font-size: 18px; font-weight: 900; color: #7c3aed; margin-top: 2px;">
            ${hoursShift > 0 ? `${hoursShift}h ` : ''}${minsShift}m
          </div>
        </div>
      </div>

      <!-- Action Navigation Buttons -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
        <div style="font-size: 12px; color: var(--ink); font-weight: 600;">
          📍 Sequence calculated from <strong>${escapeHtml(beatResult.startCoords.name || 'Station HQ')}</strong>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <a href="${escapeHtml(beatResult.googleMapsUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" id="btnLaunchGoogleMaps" style="background: #0284c7; border-color: #0369a1; font-weight: 800; font-size: 12.5px; padding: 7px 14px; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
            <span>🗺️</span>
            <span>Launch Multi-Stop in Google Maps Navigation →</span>
          </a>

          <button type="button" class="btn btn-primary" id="btnSaveOfficialBeat" style="font-weight: 800; font-size: 12.5px; padding: 7px 14px; display: flex; align-items: center; gap: 6px;">
            <span>💾</span>
            <span>Save as Today's Official Tour Beat</span>
          </button>
        </div>
      </div>

      <!-- Step-by-Step Stop Roadmap -->
      <div style="background: var(--surface-card); border-radius: var(--radius-md); border: 1px solid var(--line); padding: 14px 18px;">
        <div style="font-weight: 800; font-size: 13.5px; color: var(--ink); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <span>Sequential Visit Roadmap</span>
          <span style="font-size: 11px; color: var(--muted); font-weight: 600;">Click dealer to open individual map</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          
          <!-- Origin Node -->
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: #fff; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);">
              HQ
            </div>
            <div style="flex: 1; padding-top: 3px;">
              <div style="font-weight: 700; font-size: 12.5px; color: var(--ink);">
                Start Departure: ${escapeHtml(beatResult.startCoords.name || 'Station HQ')}
              </div>
              <div style="font-size: 11px; color: var(--muted);">
                GPS: ${beatResult.startCoords.lat.toFixed(4)}°, ${beatResult.startCoords.lng.toFixed(4)}°
              </div>
            </div>
          </div>

          <!-- Sequenced Stops -->
          ${beatResult.orderedStops.map((stop, idx) => {
            const isCheckedIn = checkedInRetailerIds.has(stop.id);
            return `
              <div style="display: flex; align-items: flex-start; gap: 12px; padding-left: 14px; border-left: 2px dashed ${isCheckedIn ? '#10b981' : 'var(--line)'}; margin-left: 13px;">
                <div style="width: 26px; height: 26px; border-radius: 50%; background: ${isCheckedIn ? '#10b981' : '#f1f5f9'}; color: ${isCheckedIn ? '#fff' : 'var(--ink)'}; border: 1.5px solid ${isCheckedIn ? '#10b981' : 'var(--line)'}; font-weight: 800; font-size: 11.5px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${stop.sequenceOrder}
                </div>
                <div style="flex: 1; padding: 4px 8px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <div style="font-weight: 700; font-size: 12px; color: var(--ink);">
                      ${escapeHtml(stop.retailer)}
                    </div>
                    <div style="font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 8px; margin-top: 1px;">
                      <span>${escapeHtml(stop.block)}, ${escapeHtml(stop.district)}</span>
                      <span>·</span>
                      <strong style="color: var(--primary);">${stop.legDistanceKm} km</strong> from previous stop (${stop.legDriveMinutes}m ride)
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 8px;">
                    ${isCheckedIn ? `
                      <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #16a34a; font-size: 10.5px; font-weight: 700;">
                        ✓ Checked-In
                      </span>
                    ` : `
                      <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 10.5px; font-weight: 700;">
                        ⏳ Check-In Pending
                      </span>
                    `}
                    <a href="https://www.google.com/maps?q=${stop.lat},${stop.lng}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 10.5px; padding: 3px 6px;">
                      📍 Pin
                    </a>
                  </div>
                </div>
              </div>
            `;
          }).join('')}

          <!-- Return Leg Node -->
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #64748b; color: #fff; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              🏁
            </div>
            <div style="flex: 1; padding-top: 3px;">
              <div style="font-weight: 700; font-size: 12.5px; color: var(--ink);">
                Return to Station HQ (${escapeHtml(beatResult.startCoords.name || 'HQ')})
              </div>
              <div style="font-size: 11px; color: var(--muted);">
                Shift Completed · Ready to submit Daily TA/DA Claim
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

function attachBeatResultActions(modal, repInfo, currentBlock, selectedDate) {
  modal.querySelector('#btnSaveOfficialBeat')?.addEventListener('click', () => {
    if (!currentBeatResult) return;

    const plan = {
      id: `beat_${safeLower(repInfo.name).replace(/\s+/g, '_')}_${selectedDate}`,
      assistant: repInfo.name,
      date: selectedDate,
      block: currentBlock,
      district: repInfo.district,
      originName: currentBeatResult.startCoords.name || 'Station HQ',
      originCoords: { lat: currentBeatResult.startCoords.lat, lng: currentBeatResult.startCoords.lng },
      totalKm: currentBeatResult.totalDistanceKm,
      totalDrivingMinutes: currentBeatResult.totalDrivingMinutes,
      totalVisitMinutes: currentBeatResult.totalVisitMinutes,
      totalShiftMinutes: currentBeatResult.totalShiftMinutes,
      status: 'In Progress',
      googleMapsUrl: currentBeatResult.googleMapsUrl,
      stops: currentBeatResult.orderedStops.map(s => ({
        id: s.id,
        retailer: s.retailer,
        block: s.block,
        district: s.district,
        lat: s.lat,
        lng: s.lng,
        isCompleted: false,
        checkInTime: null,
        sequence: s.sequenceOrder
      })),
      createdAt: new Date().toISOString()
    };

    storage.saveTourBeatPlan(plan);

    // Also persist IDs in tat_tour_${rep}_${date} so fieldView marks them in PJP
    const tourKey = `tat_tour_${safeLower(repInfo.name)}_${selectedDate}`;
    try {
      localStorage.setItem(tourKey, JSON.stringify(currentBeatResult.orderedStops.map(s => s.id)));
    } catch(e) {
      console.warn(e);
    }

    showToast(`✅ Official Tour Beat saved with ${currentBeatResult.orderedStops.length} stops!`, '🗺️');
  });
}

// ========================================================
// TAB 2: 💰 VERIFIED TA/DA MILEAGE CLAIM DOSSIER
// ========================================================

function renderTadaClaimTab(viewport, modal, repInfo, repDealers, selectedDate) {
  const policy = storage.getTadaPolicyConfig();
  const defaultMode = storage.getAssistantVehicleMode(repInfo.name);
  if (!claimVehicleMode) claimVehicleMode = defaultMode;

  const existingClaims = storage.getTadaClaims({ assistant: repInfo.name });
  const existingTodayClaim = existingClaims.find(c => c.date === selectedDate);

  if (existingTodayClaim) {
    if (claimAttachedBills.length === 0 && existingTodayClaim.attachedBills && existingTodayClaim.attachedBills.length > 0) {
      claimAttachedBills = [...existingTodayClaim.attachedBills];
    }
    if (!claimVehicleMode && existingTodayClaim.vehicleMode) {
      claimVehicleMode = existingTodayClaim.vehicleMode;
    }
  }

  const tadaPreview = storage.calculateTadaPreview(repInfo.name, selectedDate, claimVehicleMode);
  const activeFuelRate = claimVehicleMode === 'Car' ? policy.carFuelRatePerKm : policy.bikeFuelRatePerKm;

  // Calculate sum of attached bills
  const attachedBillsTotal = claimAttachedBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  viewport.innerHTML = `
    <!-- TA/DA Header Info Card -->
    <div class="card" style="padding: 16px 20px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); margin-bottom: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 26px;">💰</span>
          <div>
            <div style="font-weight: 800; font-size: 15px; color: var(--ink); font-family: var(--font-heading);">
              Daily Travel & Daily Allowance (TA/DA) Claim Dossier
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 1px;">
              Governed by GPS road curvature telemetry · Motorbike: <strong>₹${policy.bikeFuelRatePerKm}/km</strong> · Car: <strong>₹${policy.carFuelRatePerKm}/km</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 12px; font-weight: 700; color: var(--ink);">Claim Date:</label>
          <input type="date" id="iptTadaClaimDate" class="form-control" value="${selectedDate}" style="font-size: 12.5px; font-weight: 700; width: 140px; padding: 6px 8px;" />
        </div>
      </div>
    </div>

    <!-- Telemetry Breakdown Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 14px; margin-bottom: 16px;">
      
      <!-- GPS Verified Journey Telemetry -->
      <div class="card" style="padding: 14px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
        <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 0.05em; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
          <span>📍 GPS Verified Road Telemetry</span>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #16a34a; font-size: 10.5px;">
            ${tadaPreview.dayLogs.length} Checked-In Counters
          </span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 12px;">
          <div>
            <div style="font-size: 11px; color: var(--muted); font-weight: 600;">Verified Road Curvature Distance</div>
            <div style="font-size: 20px; font-weight: 900; color: var(--primary); margin-top: 2px;">
              ${tadaPreview.gpsVerifiedKm} <span style="font-size: 12px; font-weight: 600;">km</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--muted); font-weight: 600;">Base Station HQ</div>
            <div style="font-size: 13px; font-weight: 700; color: var(--ink); margin-top: 2px;">
              ${escapeHtml(tadaPreview.hq)}
            </div>
          </div>
        </div>

        <!-- Telemetry Audit Flags -->
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;">
          ${tadaPreview.auditFlags.map(flag => `
            <div style="font-size: 11px; font-weight: 600; padding: 5px 8px; background: var(--surface-bg); border-radius: var(--radius-sm); border-left: 3px solid #10b981; color: var(--ink);">
              ${escapeHtml(flag)}
            </div>
          `).join('')}
        </div>

        <!-- Leg-by-leg trail snippet -->
        <div style="max-height: 140px; overflow-y: auto; font-size: 11px; color: var(--muted); display: flex; flex-direction: column; gap: 4px; padding-right: 4px;">
          ${tadaPreview.journeyLegs.length === 0 ? `
            <div style="text-align: center; padding: 12px; color: var(--muted);">
              No GPS check-in logs recorded on this date yet. Check in at dealer counters to generate telemetry trail.
            </div>
          ` : tadaPreview.journeyLegs.map((leg, i) => `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--line); padding-bottom: 3px;">
              <span>${i + 1}. ${escapeHtml(leg.from)} → ${escapeHtml(leg.to)}</span>
              <strong style="color: var(--ink);">${leg.roadKm} km</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Expense Claim Calculation Form -->
      <div class="card" style="padding: 14px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
        <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: #d97706; letter-spacing: 0.05em; margin-bottom: 10px;">
          📝 Allowance Breakdown & Claim Computation
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          
          <!-- Vehicle Mode Selector -->
          <div style="padding: 10px 12px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line);">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--ink); margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>🚗 Vehicle Mode For This Journey</span>
              <span class="badge" style="font-size: 10px; background: rgba(2, 132, 199, 0.12); color: #0284c7;">
                Assigned Default: ${defaultMode}
              </span>
            </div>
            
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-sm btn-mode-toggle ${claimVehicleMode === 'Bike' ? 'btn-primary' : 'btn-secondary'}" data-mode="Bike" style="flex: 1; font-weight: 700; font-size: 11.5px; padding: 6px 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <span>🏍️ Motorbike</span>
                <span class="badge" style="background: rgba(255, 255, 255, 0.25); color: inherit; font-size: 10px;">₹${policy.bikeFuelRatePerKm}/km</span>
              </button>

              <button type="button" class="btn btn-sm btn-mode-toggle ${claimVehicleMode === 'Car' ? 'btn-primary' : 'btn-secondary'}" data-mode="Car" style="flex: 1; font-weight: 700; font-size: 11.5px; padding: 6px 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <span>🚗 Car / Utility</span>
                <span class="badge" style="background: rgba(255, 255, 255, 0.25); color: inherit; font-size: 10px;">₹${policy.carFuelRatePerKm}/km</span>
              </button>
            </div>
          </div>

          <!-- Claimed Distance (Auto-filled from GPS) -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div>
              <div style="font-weight: 700; font-size: 12.5px; color: var(--ink);">
                1. Fuel Claim (${claimVehicleMode})
              </div>
              <div style="font-size: 11px; color: var(--muted);" id="lblFuelRateNotice">
                Rate: ₹${activeFuelRate} / km (Verified: ${tadaPreview.gpsVerifiedKm} km)
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <input type="number" id="iptClaimedKm" class="form-control" value="${tadaPreview.claimedKm}" step="0.1" min="0" style="width: 80px; font-size: 12px; font-weight: 700; text-align: right; padding: 4px 6px;" />
              <span style="font-size: 12px; color: var(--muted);">km =</span>
              <strong id="lblFuelAmount" style="font-size: 13.5px; color: var(--primary); min-width: 65px; text-align: right;">
                ₹${tadaPreview.fuelAmount}
              </strong>
            </div>
          </div>

          <!-- Mileage Inflation Warning Pill -->
          <div id="pnlMileageInflationWarning" style="display: none; padding: 6px 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); font-size: 11px; color: #dc2626; font-weight: 600;">
            ⚠️ Claimed distance exceeds verified GPS telemetry by >15%. Manager will audit and adjust.
          </div>

          <!-- Daily Food Allowance (DA) -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px dashed var(--line); padding-top: 8px;">
            <div>
              <div style="font-weight: 700; font-size: 12.5px; color: var(--ink);">
                2. Daily Food Allowance (DA)
              </div>
              <div style="font-size: 11px; color: var(--muted);">
                ${tadaPreview.verifiedStops >= policy.minVisitsForFullDa ? `Full Day (≥${policy.minVisitsForFullDa} visits): ₹${policy.daFullDayAmount}` : tadaPreview.verifiedStops >= 1 ? `Partial Day (1-3 visits): ₹${policy.daHalfDayAmount}` : '0 visits: ₹0'}
              </div>
            </div>
            <strong style="font-size: 13.5px; color: var(--ink); min-width: 65px; text-align: right;">
              ₹${tadaPreview.daAmount}
            </strong>
          </div>

          <!-- Outstation Allowance -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px dashed var(--line); padding-top: 8px;">
            <div>
              <div style="font-weight: 700; font-size: 12.5px; color: var(--ink);">
                3. Outstation / Night Stay
              </div>
              <div style="font-size: 11px; color: var(--muted);">
                Standard inter-district night halt: ₹${policy.outstationNightAllowance}
              </div>
            </div>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="checkbox" id="chkOutstationClaim" ${tadaPreview.outstationAmount > 0 ? 'checked' : ''} />
              <strong id="lblOutstationAmount" style="font-size: 13.5px; color: var(--ink);">
                ₹${tadaPreview.outstationAmount}
              </strong>
            </label>
          </div>

          <!-- Incidental Expenses -->
          <div style="border-top: 1px dashed var(--line); padding-top: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <div style="font-weight: 700; font-size: 12.5px; color: var(--ink);">
                4. Meeting Tea / Refreshments / Toll
              </div>
              <div style="display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 12px; color: var(--muted);">₹</span>
                <input type="number" id="iptIncidentalAmount" class="form-control" value="0" min="0" max="1000" style="width: 75px; font-size: 12px; font-weight: 700; text-align: right; padding: 4px 6px;" />
              </div>
            </div>
            <input type="text" id="iptIncidentalNotes" class="form-control" placeholder="Description (e.g. farmer meeting tea at Bihta)" style="font-size: 11.5px; padding: 5px 8px;" />
          </div>

          <!-- Total Payout Banner -->
          <div style="margin-top: 8px; padding: 10px 14px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(2, 132, 199, 0.08) 100%); border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Total Claim Payout</div>
              <div style="font-size: 11px; color: var(--muted);">Direct bank transfer upon review</div>
            </div>
            <div id="lblGrandTotalClaim" style="font-size: 22px; font-weight: 900; color: #047857;">
              ₹${tadaPreview.totalAmount}
            </div>
          </div>

          <!-- Submit Button -->
          <button type="button" class="btn btn-primary" id="btnSubmitTadaClaim" style="font-weight: 800; font-size: 13.5px; padding: 10px; margin-top: 4px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
            📤 Submit TA/DA Claim to Manager →
          </button>
        </div>
      </div>
    </div>

    <!-- SECTION: 📎 UPLOAD BILLS & RECEIPTS SYSTEM -->
    <div class="card" style="padding: 16px 20px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md); margin-bottom: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">📎</span>
          <div>
            <div style="font-weight: 800; font-size: 13.5px; color: var(--ink); font-family: var(--font-heading);">
              Attached Expense Bills & Proof of Journey
            </div>
            <div style="font-size: 11.5px; color: var(--muted);">
              Upload fuel receipts, hotel lodging bills, toll slips, or meeting tea vouchers (${claimAttachedBills.length} attached · ₹${attachedBillsTotal})
            </div>
          </div>
        </div>

        <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #16a34a; font-weight: 700; font-size: 11.5px;">
          ${claimAttachedBills.length} Bill${claimAttachedBills.length === 1 ? '' : 's'} Uploaded
        </span>
      </div>

      <!-- Bill Upload Input Strip -->
      <div style="padding: 12px 14px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px dashed var(--line); margin-bottom: 14px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 10px;">
          
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">
              Expense Category *
            </label>
            <select id="selBillCategory" class="form-control" style="font-size: 12px; font-weight: 600; padding: 5px 8px;">
              <option value="Fuel Refill">⛽ Fuel Refill (Petrol / Diesel)</option>
              <option value="Hotel/Night Stay">🏨 Hotel / Night Stay Lodging</option>
              <option value="Highway Toll">🛣️ Highway Toll Tax Voucher</option>
              <option value="Refreshments">☕ Meeting Tea & Refreshments</option>
              <option value="Other">📦 Other Incidental Transit</option>
            </select>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">
              Bill Amount (₹) *
            </label>
            <input type="number" id="iptBillAmount" class="form-control" placeholder="e.g. 500" min="1" max="10000" style="font-size: 12px; font-weight: 700; padding: 5px 8px;" />
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">
              Vendor / Notes
            </label>
            <input type="text" id="iptBillNotes" class="form-control" placeholder="e.g. HP Petrol Pump Bihta" style="font-size: 12px; padding: 5px 8px;" />
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="file" id="iptBillFilePicker" accept="image/*,application/pdf" style="display: none;" />
            <button type="button" class="btn btn-secondary btn-sm" id="btnTriggerFilePicker" style="font-size: 11.5px; font-weight: 700; padding: 5px 12px;">
              📸 Choose Photo / File
            </button>
            <span id="lblSelectedFileName" style="font-size: 11.5px; color: var(--muted); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              No file selected (or auto-generates voucher)
            </span>
          </div>

          <button type="button" class="btn btn-primary btn-sm" id="btnAddBillAttachment" style="font-size: 12px; font-weight: 800; padding: 6px 14px; background: #047857; border-color: #065f46;">
            ➕ Attach Receipt to Claim
          </button>
        </div>
      </div>

      <!-- Attached Bills Thumbnail Strip / Gallery -->
      <div id="containerAttachedBills" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
        ${claimAttachedBills.length === 0 ? `
          <div style="grid-column: 1 / -1; text-align: center; padding: 18px; color: var(--muted); font-size: 12px; border-radius: var(--radius-sm); background: var(--surface-bg);">
            No expense bills or receipts attached yet. Select an expense category, enter amount, choose photo and click "Attach Receipt".
          </div>
        ` : claimAttachedBills.map((b, idx) => {
          const isPdf = (b.dataUrl && b.dataUrl.startsWith('data:application/pdf')) || (b.name && b.name.toLowerCase().endsWith('.pdf'));
          return `
            <div class="card" style="padding: 10px; background: var(--surface-bg); border: 1px solid var(--line); border-radius: var(--radius-sm); position: relative; display: flex; flex-direction: column; gap: 6px;">
              
              <!-- Thumbnail Viewport with Lightbox Trigger -->
              <div class="bill-thumb-trigger" data-idx="${idx}" style="height: 100px; border-radius: 6px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid var(--line); position: relative;" title="Click to view full receipt in lightbox">
                ${isPdf ? `
                  <div style="text-align: center; color: #dc2626;">
                    <div style="font-size: 32px;">📄</div>
                    <div style="font-size: 10px; font-weight: 700;">PDF Document</div>
                  </div>
                ` : b.dataUrl ? `
                  <img src="${b.dataUrl}" alt="${escapeHtml(b.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
                ` : `
                  <div style="font-size: 28px;">🧾</div>
                `}
                <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.65); color: #fff; font-size: 9.5px; font-weight: 700; padding: 1px 5px; border-radius: 4px;">
                  🔍 Click to View
                </div>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; font-size: 10px; font-weight: 700;">
                  ${escapeHtml(b.category)}
                </span>
                <strong style="color: #047857; font-size: 12.5px;">₹${Number(b.amount || 0).toLocaleString()}</strong>
              </div>

              <div style="font-size: 11px; color: var(--ink); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(b.notes || b.name)}">
                ${escapeHtml(b.notes || b.name)}
              </div>

              <button type="button" class="btn btn-secondary btn-sm btn-remove-bill" data-idx="${idx}" style="font-size: 10.5px; padding: 2px 6px; color: #dc2626; border-color: rgba(239, 68, 68, 0.3); align-self: flex-end;">
                ✕ Remove
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Past Claims & Payment History -->
    <div class="card" style="padding: 14px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
      <div style="font-weight: 800; font-size: 13.5px; color: var(--ink); margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
        <span>📜 My Past TA/DA Claims History</span>
        <span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; font-size: 11px;">
          ${existingClaims.length} Claims Filed
        </span>
      </div>

      <div style="overflow-x: auto;">
        <table class="table" style="width: 100%; font-size: 12px; margin: 0;">
          <thead>
            <tr style="background: var(--surface-bg);">
              <th style="padding: 8px 10px;">Claim Date</th>
              <th style="padding: 8px 10px;">Vehicle</th>
              <th style="padding: 8px 10px;">Stops</th>
              <th style="padding: 8px 10px;">GPS Distance</th>
              <th style="padding: 8px 10px;">Fuel (₹)</th>
              <th style="padding: 8px 10px;">DA (₹)</th>
              <th style="padding: 8px 10px;">Bills Attached</th>
              <th style="padding: 8px 10px;">Total Claim</th>
              <th style="padding: 8px 10px;">Approved</th>
              <th style="padding: 8px 10px;">Status</th>
              <th style="padding: 8px 10px;">Manager Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${existingClaims.length === 0 ? `
              <tr>
                <td colspan="11" style="text-align: center; padding: 16px; color: var(--muted);">No claims filed yet.</td>
              </tr>
            ` : existingClaims.map(c => {
              const statusColor = c.status === 'Approved' ? '#16a34a' : c.status === 'Adjusted' ? '#d97706' : '#0284c7';
              const billsCount = c.attachedBills ? c.attachedBills.length : 0;
              return `
                <tr>
                  <td style="padding: 8px 10px; font-weight: 700;">${escapeHtml(c.date)}</td>
                  <td style="padding: 8px 10px;">
                    <span class="badge" style="font-size: 10.5px; font-weight: 700; background: ${c.vehicleMode === 'Car' ? 'rgba(2, 132, 199, 0.12); color: #0284c7;' : 'rgba(16, 185, 129, 0.12); color: #16a34a;'}">
                      ${c.vehicleMode === 'Car' ? '🚗 Car' : '🏍️ Bike'}
                    </span>
                  </td>
                  <td style="padding: 8px 10px;">${c.verifiedStops || 0}</td>
                  <td style="padding: 8px 10px;">${c.gpsVerifiedKm} km</td>
                  <td style="padding: 8px 10px;">₹${c.fuelAmount}</td>
                  <td style="padding: 8px 10px;">₹${c.daAmount}</td>
                  <td style="padding: 8px 10px;">
                    ${billsCount > 0 ? `
                      <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #16a34a; font-weight: 700; font-size: 10.5px;">
                        📎 ${billsCount} bill${billsCount > 1 ? 's' : ''}
                      </span>
                    ` : `
                      <span style="color: var(--muted); font-size: 11px;">None</span>
                    `}
                  </td>
                  <td style="padding: 8px 10px; font-weight: 700;">₹${c.totalClaimAmount}</td>
                  <td style="padding: 8px 10px; font-weight: 800; color: ${statusColor};">
                    ${c.approvedAmount !== undefined ? `₹${c.approvedAmount}` : '—'}
                  </td>
                  <td style="padding: 8px 10px;">
                    <span class="badge" style="background: ${statusColor}18; color: ${statusColor}; font-weight: 700;">
                      ${escapeHtml(c.status)}
                    </span>
                  </td>
                  <td style="padding: 8px 10px; font-size: 11px; color: var(--muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${escapeHtml(c.managerNotes || '—')}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach live math calculation
  const iptClaimedKm = modal.querySelector('#iptClaimedKm');
  const chkOutstation = modal.querySelector('#chkOutstationClaim');
  const iptIncidental = modal.querySelector('#iptIncidentalAmount');
  const iptIncidentalNotes = modal.querySelector('#iptIncidentalNotes');
  const lblFuelAmount = modal.querySelector('#lblFuelAmount');
  const lblOutstationAmount = modal.querySelector('#lblOutstationAmount');
  const lblGrandTotal = modal.querySelector('#lblGrandTotalClaim');
  const pnlWarning = modal.querySelector('#pnlMileageInflationWarning');
  const lblFuelNotice = modal.querySelector('#lblFuelRateNotice');

  function recalculateTotal() {
    const km = Number(iptClaimedKm?.value || 0);
    const currentRate = claimVehicleMode === 'Car' ? policy.carFuelRatePerKm : policy.bikeFuelRatePerKm;
    const fuel = Math.round(km * currentRate * 10) / 10;
    const isOut = chkOutstation?.checked;
    const outstation = isOut ? (policy.outstationNightAllowance || 800) : 0;
    const inc = Number(iptIncidental?.value || 0);
    const grand = Math.round((fuel + tadaPreview.daAmount + outstation + inc) * 10) / 10;

    if (lblFuelAmount) lblFuelAmount.textContent = `₹${fuel}`;
    if (lblOutstationAmount) lblOutstationAmount.textContent = `₹${outstation}`;
    if (lblGrandTotal) lblGrandTotal.textContent = `₹${grand}`;
    if (lblFuelNotice) lblFuelNotice.textContent = `Rate: ₹${currentRate} / km (Verified: ${tadaPreview.gpsVerifiedKm} km)`;

    if (pnlWarning) {
      if (tadaPreview.gpsVerifiedKm > 0 && km > tadaPreview.gpsVerifiedKm * 1.15) {
        pnlWarning.style.display = 'block';
      } else {
        pnlWarning.style.display = 'none';
      }
    }
  }

  iptClaimedKm?.addEventListener('input', recalculateTotal);
  chkOutstation?.addEventListener('change', recalculateTotal);
  iptIncidental?.addEventListener('input', recalculateTotal);

  // Vehicle Mode Toggle Buttons
  modal.querySelectorAll('.btn-mode-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      if (mode && (mode === 'Bike' || mode === 'Car')) {
        claimVehicleMode = mode;
        modal.querySelectorAll('.btn-mode-toggle').forEach(b => {
          if (b.getAttribute('data-mode') === mode) {
            b.classList.remove('btn-secondary');
            b.classList.add('btn-primary');
          } else {
            b.classList.remove('btn-primary');
            b.classList.add('btn-secondary');
          }
        });
        recalculateTotal();
      }
    });
  });

  // Date picker handler
  modal.querySelector('#iptTadaClaimDate')?.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    claimAttachedBills = [];
    renderActiveTab(modal, repInfo, repDealers, repInfo.hq, selectedDate);
  });

  // Bill File Picker trigger
  const filePicker = modal.querySelector('#iptBillFilePicker');
  const lblFileName = modal.querySelector('#lblSelectedFileName');
  let chosenBillFile = null;

  modal.querySelector('#btnTriggerFilePicker')?.addEventListener('click', () => {
    filePicker?.click();
  });

  filePicker?.addEventListener('change', (e) => {
    chosenBillFile = e.target.files[0] || null;
    if (chosenBillFile && lblFileName) {
      lblFileName.textContent = `📎 ${chosenBillFile.name} (${Math.round(chosenBillFile.size / 1024)} KB)`;
      lblFileName.style.color = 'var(--primary)';
      lblFileName.style.fontWeight = '700';
    } else if (lblFileName) {
      lblFileName.textContent = 'No file selected (auto-generates voucher)';
      lblFileName.style.color = 'var(--muted)';
      lblFileName.style.fontWeight = 'normal';
    }
  });

  // Helper to generate voucher SVG if photo not taken
  function makeVoucherSvg(vendor, category, amount, dateStr) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500" fill="none">
      <rect width="400" height="500" rx="8" fill="#FFFDF8"/>
      <rect x="15" y="15" width="370" height="470" rx="6" stroke="#D1D5DB" stroke-width="2" stroke-dasharray="4 4" fill="none"/>
      <text x="200" y="55" font-family="sans-serif" font-weight="900" font-size="18" fill="#1E293B" text-anchor="middle">${escapeHtml(vendor || 'FIELD EXPENSE').toUpperCase()}</text>
      <text x="200" y="75" font-family="sans-serif" font-size="12" fill="#64748B" text-anchor="middle">Official Expense Voucher</text>
      <line x1="30" y1="95" x2="370" y2="95" stroke="#CBD5E1" stroke-width="1.5"/>
      <text x="40" y="125" font-family="sans-serif" font-size="12" fill="#475569">Category: <strong>${escapeHtml(category)}</strong></text>
      <text x="360" y="125" font-family="sans-serif" font-size="12" fill="#475569" text-anchor="end">Date: <strong>${dateStr}</strong></text>
      <rect x="35" y="155" width="330" height="180" rx="4" fill="#F8FAFC" stroke="#E2E8F0"/>
      <text x="50" y="195" font-family="sans-serif" font-size="13" font-weight="700" fill="#334155">Description</text>
      <text x="345" y="195" font-family="sans-serif" font-size="13" font-weight="700" fill="#334155" text-anchor="end">Amount (₹)</text>
      <line x1="50" y1="210" x2="350" y2="210" stroke="#CBD5E1"/>
      <text x="50" y="245" font-family="sans-serif" font-size="12" fill="#475569">${escapeHtml(category)} Charges</text>
      <text x="345" y="245" font-family="sans-serif" font-size="12" font-weight="700" fill="#1E293B" text-anchor="end">₹${amount}.00</text>
      <line x1="50" y1="280" x2="350" y2="280" stroke="#CBD5E1"/>
      <text x="50" y="310" font-family="sans-serif" font-size="14" font-weight="800" fill="#0F172A">TOTAL AMOUNT</text>
      <text x="345" y="310" font-family="sans-serif" font-size="16" font-weight="900" fill="#047857" text-anchor="end">₹${amount}.00</text>
      <g transform="translate(135, 365) rotate(-6)">
        <rect width="130" height="42" rx="4" stroke="#DC2626" stroke-width="2" fill="none"/>
        <text x="65" y="27" font-family="sans-serif" font-size="14" font-weight="900" fill="#DC2626" text-anchor="middle">PAID ON-SITE</text>
      </g>
      <text x="200" y="455" font-family="sans-serif" font-size="11" fill="#94A3B8" text-anchor="middle">Logged by ${escapeHtml(repInfo.name)} for TA/DA claim audit</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // Add Bill Attachment
  modal.querySelector('#btnAddBillAttachment')?.addEventListener('click', () => {
    const cat = modal.querySelector('#selBillCategory')?.value || 'Other';
    const amt = parseFloat(modal.querySelector('#iptBillAmount')?.value) || 0;
    const notes = modal.querySelector('#iptBillNotes')?.value || '';

    if (amt <= 0) {
      return alert('Please enter a valid bill amount greater than ₹0.');
    }

    const processAttachment = (dataUrl, fileName) => {
      const newBill = {
        id: 'bill_' + Date.now(),
        name: fileName,
        category: cat,
        amount: amt,
        notes: notes || `${cat} expense`,
        dataUrl: dataUrl,
        uploadedAt: new Date().toISOString()
      };

      claimAttachedBills.push(newBill);

      // Auto-populate incidental amount if it's refreshments or toll
      if (cat === 'Refreshments' || cat === 'Highway Toll' || cat === 'Other') {
        const curInc = Number(iptIncidental?.value || 0);
        if (iptIncidental) iptIncidental.value = curInc + amt;
        if (iptIncidentalNotes && !iptIncidentalNotes.value) iptIncidentalNotes.value = notes || `${cat} expense`;
        recalculateTotal();
      }

      // Auto-check outstation if it's hotel stay
      if (cat === 'Hotel/Night Stay' && chkOutstation) {
        chkOutstation.checked = true;
        recalculateTotal();
      }

      showToast(`📎 Attached ₹${amt} ${cat} bill!`, '🧾');

      // Reset form
      if (modal.querySelector('#iptBillAmount')) modal.querySelector('#iptBillAmount').value = '';
      if (modal.querySelector('#iptBillNotes')) modal.querySelector('#iptBillNotes').value = '';
      if (filePicker) filePicker.value = '';
      chosenBillFile = null;
      if (lblFileName) {
        lblFileName.textContent = 'No file selected (auto-generates voucher)';
        lblFileName.style.color = 'var(--muted)';
        lblFileName.style.fontWeight = 'normal';
      }

      // Re-render tab to show updated bills
      renderActiveTab(modal, repInfo, repDealers, repInfo.hq, selectedDate);
    };

    if (chosenBillFile) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        processAttachment(ev.target.result, chosenBillFile.name);
      };
      reader.onerror = () => {
        showToast('Error reading file. Creating digital voucher instead.', '⚠️');
        processAttachment(makeVoucherSvg(notes, cat, amt, selectedDate), `${cat}_voucher.svg`);
      };
      reader.readAsDataURL(chosenBillFile);
    } else {
      processAttachment(makeVoucherSvg(notes, cat, amt, selectedDate), `${cat}_voucher.svg`);
    }
  });

  // Lightbox click on bill thumbnail
  modal.querySelectorAll('.bill-thumb-trigger').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      if (claimAttachedBills[idx]) {
        openReceiptLightboxModal(claimAttachedBills[idx]);
      }
    });
  });

  // Remove bill button
  modal.querySelectorAll('.btn-remove-bill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!isNaN(idx) && claimAttachedBills[idx]) {
        const removed = claimAttachedBills.splice(idx, 1)[0];
        showToast(`Removed ${removed.category} receipt`, '🗑️');
        renderActiveTab(modal, repInfo, repDealers, repInfo.hq, selectedDate);
      }
    });
  });

  // Submit Claim Handler
  modal.querySelector('#btnSubmitTadaClaim')?.addEventListener('click', () => {
    const km = Number(iptClaimedKm?.value || tadaPreview.gpsVerifiedKm);
    const activeRate = claimVehicleMode === 'Car' ? policy.carFuelRatePerKm : policy.bikeFuelRatePerKm;
    const fuel = Math.round(km * activeRate * 10) / 10;
    const isOut = chkOutstation?.checked;
    const outstation = isOut ? (policy.outstationNightAllowance || 800) : 0;
    const inc = Number(iptIncidental?.value || 0);
    const incNotes = iptIncidentalNotes?.value || '';
    const grand = Math.round((fuel + tadaPreview.daAmount + outstation + inc) * 10) / 10;

    const auditFlags = [...tadaPreview.auditFlags];
    if (tadaPreview.gpsVerifiedKm > 0 && km > tadaPreview.gpsVerifiedKm * 1.15) {
      auditFlags.push(`⚠️ Mileage Inflation (${km} km claimed vs ${tadaPreview.gpsVerifiedKm} km GPS road)`);
    } else {
      auditFlags.push('🟢 Telemetry Approved');
    }

    auditFlags.push(`🚗 Transit Mode: ${claimVehicleMode} (₹${activeRate}/km)`);
    if (claimAttachedBills.length > 0) {
      auditFlags.push(`📎 ${claimAttachedBills.length} Bills Attached (Total ₹${attachedBillsTotal})`);
    }

    const claim = {
      id: `tada_${safeLower(repInfo.name).replace(/\s+/g, '_')}_${selectedDate}`,
      assistant: repInfo.name,
      hq: repInfo.hq,
      district: repInfo.district,
      date: selectedDate,
      vehicleMode: claimVehicleMode,
      verifiedStops: tadaPreview.verifiedStops,
      gpsVerifiedKm: tadaPreview.gpsVerifiedKm,
      claimedKm: km,
      fuelRate: activeRate,
      fuelAmount: fuel,
      daAmount: tadaPreview.daAmount,
      outstationAmount: outstation,
      incidentalAmount: inc,
      incidentalNotes: incNotes,
      totalClaimAmount: grand,
      approvedAmount: grand,
      status: 'Pending Approval',
      auditFlags,
      attachedBills: [...claimAttachedBills],
      managerNotes: '',
      approvedBy: '',
      approvedAt: null,
      createdAt: new Date().toISOString()
    };

    storage.saveTadaClaim(claim);
    showToast(`✅ TA/DA Claim of ₹${grand} (${claimVehicleMode} mode) submitted with ${claimAttachedBills.length} receipts!`, '📤');
    renderActiveTab(modal, repInfo, repDealers, repInfo.hq, selectedDate);
  });
}

function safeLower(str) {
  return String(str || '').toLowerCase().trim();
}

