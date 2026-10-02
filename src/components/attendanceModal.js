import { storage } from '../services/storage.js';
import { auth } from '../services/auth.js';
import { showToast } from './toast.js';
import { BIHAR_BLOCKS, detectBrowserLocation, escapeHtml } from '../utils/geo.js';

let activeAttendanceTab = 'punch'; // 'punch' | 'calendar' | 'regularize'
let timerInterval = null;

export function openAttendanceModal(options = {}) {
  const existing = document.getElementById('attendanceModal');
  if (existing) existing.remove();

  if (timerInterval) clearInterval(timerInterval);

  activeAttendanceTab = options.initialTab || 'punch';
  const assignedRep = options.assistant || auth.getAssignedRep();
  const allAssistants = storage.getAssistants();
  let repInfo = allAssistants.find(a => a.name === assignedRep) || allAssistants[0];

  const now = new Date();
  let selectedMonth = now.getMonth() + 1; // 1-12
  let selectedYear = now.getFullYear();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.id = 'attendanceModal';
  modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 9999;';

  modal.innerHTML = `
    <div class="modal-box" style="width: 95%; max-width: 860px; max-height: 92vh; display: flex; flex-direction: column; background: var(--surface-card); border-radius: var(--radius-lg); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); border: 1px solid var(--line); overflow: hidden; animation: modal-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
      
      <!-- Modal Header -->
      <div style="padding: 14px 20px; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 60%, #2563eb 100%); color: #fff; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
            🇮🇳
          </div>
          <div>
            <div style="font-weight: 800; font-size: 16px; font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
              <span>हाजिरी व ऑनलाइन अटेंडेंस हब</span>
              <span class="badge" style="background: rgba(255, 255, 255, 0.22); color: #fff; font-size: 11px; font-weight: 700;">
                Muster Roll System
              </span>
            </div>
            <div id="lblModalRepSub" style="font-size: 11.5px; opacity: 0.9; margin-top: 1px;">
              ${escapeHtml(repInfo.name)} · HQ: <strong>${escapeHtml(repInfo.hq)}</strong> · District: <strong>${escapeHtml(repInfo.district)}</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <!-- Rep Switcher Dropdown -->
          <div style="display: flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, 0.12); padding: 3px 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.2);">
            <span style="font-size: 11px; opacity: 0.9;">Rep:</span>
            <select id="selModalRepSwitch" style="background: transparent; color: #fff; border: none; font-size: 12px; font-weight: 700; cursor: pointer; outline: none;">
              ${allAssistants.map(a => `<option value="${escapeHtml(a.name)}" ${a.name === repInfo.name ? 'selected' : ''} style="color: #0f172a; background: #fff;">${escapeHtml(a.name)} (${escapeHtml(a.district)})</option>`).join('')}
            </select>
          </div>

          <button type="button" class="btn btn-secondary btn-sm" id="btnCloseAttendanceModal" style="background: rgba(255, 255, 255, 0.15); border: none; color: #fff; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ✕
          </button>
        </div>
      </div>

      <!-- Tab Switcher Navigation -->
      <div style="display: flex; border-bottom: 1px solid var(--line); background: var(--surface-bg);">
        <button type="button" class="tab-btn ${activeAttendanceTab === 'punch' ? 'active' : ''}" id="btnTabAttPunch" style="flex: 1; padding: 13px 14px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; border-bottom: 3px solid ${activeAttendanceTab === 'punch' ? '#2563eb' : 'transparent'}; color: ${activeAttendanceTab === 'punch' ? '#2563eb' : 'var(--muted)'};">
          <span>🕒</span>
          <span>Today's Punch (आज की हाजिरी)</span>
        </button>

        <button type="button" class="tab-btn ${activeAttendanceTab === 'calendar' ? 'active' : ''}" id="btnTabAttCalendar" style="flex: 1; padding: 13px 14px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; border-bottom: 3px solid ${activeAttendanceTab === 'calendar' ? '#2563eb' : 'transparent'}; color: ${activeAttendanceTab === 'calendar' ? '#2563eb' : 'var(--muted)'};">
          <span>📅</span>
          <span>Monthly Muster (मासिक मस्टर)</span>
        </button>

        <button type="button" class="tab-btn ${activeAttendanceTab === 'regularize' ? 'active' : ''}" id="btnTabAttRegularize" style="flex: 1; padding: 13px 14px; font-weight: 700; font-size: 13px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; border-bottom: 3px solid ${activeAttendanceTab === 'regularize' ? '#2563eb' : 'transparent'}; color: ${activeAttendanceTab === 'regularize' ? '#2563eb' : 'var(--muted)'};">
          <span>📝</span>
          <span>Regularization (पंच सुधार)</span>
        </button>
      </div>

      <!-- Tab Dynamic Content Container -->
      <div id="attendanceModalViewport" style="flex: 1; overflow-y: auto; padding: 18px 20px; background: var(--surface-bg);">
        <!-- Rendered by renderActiveAttendanceTab() -->
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => {
    if (timerInterval) clearInterval(timerInterval);
    modal.remove();
  };
  modal.querySelector('#btnCloseAttendanceModal')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Tab Switching
  modal.querySelector('#btnTabAttPunch')?.addEventListener('click', () => {
    activeAttendanceTab = 'punch';
    updateTabsUI(modal);
    renderActiveAttendanceTab(modal, repInfo, selectedMonth, selectedYear);
  });

  modal.querySelector('#btnTabAttCalendar')?.addEventListener('click', () => {
    activeAttendanceTab = 'calendar';
    updateTabsUI(modal);
    renderActiveAttendanceTab(modal, repInfo, selectedMonth, selectedYear);
  });

  modal.querySelector('#btnTabAttRegularize')?.addEventListener('click', () => {
    activeAttendanceTab = 'regularize';
    updateTabsUI(modal);
    renderActiveAttendanceTab(modal, repInfo, selectedMonth, selectedYear);
  });

  // Modal Rep Switch Handler
  modal.querySelector('#selModalRepSwitch')?.addEventListener('change', (e) => {
    const selectedName = e.target.value;
    const found = allAssistants.find(a => a.name === selectedName);
    if (found) {
      repInfo = found;
      const subEl = modal.querySelector('#lblModalRepSub');
      if (subEl) subEl.innerHTML = `${escapeHtml(repInfo.name)} · HQ: <strong>${escapeHtml(repInfo.hq)}</strong> · District: <strong>${escapeHtml(repInfo.district)}</strong>`;
      renderActiveAttendanceTab(modal, repInfo, selectedMonth, selectedYear);
    }
  });

  renderActiveAttendanceTab(modal, repInfo, selectedMonth, selectedYear);
}

function updateTabsUI(modal) {
  const tabs = [
    { id: 'btnTabAttPunch', key: 'punch' },
    { id: 'btnTabAttCalendar', key: 'calendar' },
    { id: 'btnTabAttRegularize', key: 'regularize' }
  ];

  tabs.forEach(t => {
    const el = modal.querySelector('#' + t.id);
    if (el) {
      if (activeAttendanceTab === t.key) {
        el.style.borderBottom = '3px solid #2563eb';
        el.style.color = '#2563eb';
      } else {
        el.style.borderBottom = '3px solid transparent';
        el.style.color = 'var(--muted)';
      }
    }
  });
}

function renderActiveAttendanceTab(modal, repInfo, selectedMonth, selectedYear) {
  const viewport = modal.querySelector('#attendanceModalViewport');
  if (!viewport) return;

  if (activeAttendanceTab === 'punch') {
    renderTodayPunchTab(viewport, modal, repInfo);
  } else if (activeAttendanceTab === 'calendar') {
    renderMonthlyMusterTab(viewport, modal, repInfo, selectedMonth, selectedYear);
  } else {
    renderRegularizationTab(viewport, modal, repInfo);
  }
}

// =========================================================================
// TAB 1: 🕒 TODAY'S PUNCH (आज की हाजिरी)
// =========================================================================

function renderTodayPunchTab(viewport, modal, repInfo) {
  if (timerInterval) clearInterval(timerInterval);

  const today = storage.getTodayAttendance(repInfo.name);
  const settings = storage.getAttendanceSettings();
  const empMeta = storage.getEmployeeMetadata(repInfo.name);

  const isPunchedIn = Boolean(today && today.punchInTime);
  const isPunchedOut = Boolean(today && today.punchOutTime);

  viewport.innerHTML = `
    <!-- Top Live Indian Standard Time (IST) Strip -->
    <div class="card" style="padding: 16px 20px; background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%); border: 1.5px solid rgba(37, 99, 235, 0.3); border-radius: var(--radius-md); margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #2563eb; letter-spacing: 0.05em;">
          🇮🇳 Indian Standard Time (IST) Clock
        </div>
        <div id="lblLiveIstClock" style="font-size: 24px; font-weight: 900; color: var(--ink); font-family: monospace; margin-top: 2px;">
          --:--:-- --
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
          Official Shift: <strong>${settings.shiftStartTime} – ${settings.shiftEndTime}</strong> (Grace: ${settings.gracePeriodMinutes} mins)
        </div>
      </div>

      <div style="text-align: right;">
        <span class="badge" style="background: ${isPunchedOut ? 'rgba(100, 116, 139, 0.15)' : isPunchedIn ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isPunchedOut ? '#475569' : isPunchedIn ? '#16a34a' : '#dc2626'}; font-size: 12.5px; font-weight: 800; padding: 6px 12px;">
          ${isPunchedOut ? '🏁 Shift Completed' : isPunchedIn ? '🟢 Shift Active (Punched In)' : '🔴 Not Punched In Today'}
        </span>
        <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">
          Employee ID: <strong>${escapeHtml(empMeta.empCode)}</strong>
        </div>
      </div>
    </div>

    <!-- Punch Action Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px;">
      
      <!-- Left: In-Punch & Out-Punch Actions Card -->
      <div class="card" style="padding: 16px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: var(--ink); margin-bottom: 12px;">
          ⚡ Daily Punch Terminal (हाजिरी दर्ज करें)
        </div>

        <!-- Work Mode Selector -->
        <div style="margin-bottom: 12px;">
          <label style="font-size: 11.5px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 4px;">
            Duty Mode / Location *
          </label>
          <select id="selWorkMode" class="form-control" style="font-size: 12.5px; font-weight: 600;" ${isPunchedIn ? 'disabled' : ''}>
            <option value="Field Operations" ${(today?.workMode === 'Field Operations' || !today) ? 'selected' : ''}>🌾 Field Operations (ऑन-फील्ड काउंटर विज़िट)</option>
            <option value="HQ Station Office" ${today?.workMode === 'HQ Station Office' ? 'selected' : ''}>🏢 HQ Station Office (${escapeHtml(repInfo.hq)})</option>
            <option value="Tour / Outstation" ${today?.workMode === 'Tour / Outstation' ? 'selected' : ''}>🚗 Tour / Outstation (इंटर-डिस्ट्रिक्ट टूर)</option>
            <option value="Work From Home" ${today?.workMode === 'Work From Home' ? 'selected' : ''}>🏠 Remote / WFH (रिमोट रिपोर्टिंग)</option>
          </select>
        </div>

        <!-- Notes / Field Agenda -->
        <div style="margin-bottom: 14px;">
          <label style="font-size: 11.5px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 4px;">
            Day Plan / Location Remarks
          </label>
          <input type="text" id="iptPunchNotes" class="form-control" placeholder="e.g. Covering 5 dealer counters in Bihta bazar" value="${escapeHtml(today?.notes || '')}" style="font-size: 12px;" />
        </div>

        <!-- Punch Buttons -->
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-primary" id="btnActionPunchIn" ${isPunchedIn ? 'disabled' : ''} style="flex: 1; padding: 12px; font-weight: 800; font-size: 13.5px; background: ${isPunchedIn ? 'var(--line)' : '#16a34a'}; border-color: ${isPunchedIn ? 'var(--line)' : '#15803d'}; box-shadow: ${isPunchedIn ? 'none' : '0 4px 14px rgba(22, 163, 74, 0.35)'}; cursor: ${isPunchedIn ? 'not-allowed' : 'pointer'};">
            🟢 Punch-In (पंच-इन)
          </button>

          <button type="button" class="btn btn-secondary" id="btnActionPunchOut" ${(!isPunchedIn || isPunchedOut) ? 'disabled' : ''} style="flex: 1; padding: 12px; font-weight: 800; font-size: 13.5px; color: ${(!isPunchedIn || isPunchedOut) ? 'var(--muted)' : '#dc2626'}; border-color: ${(!isPunchedIn || isPunchedOut) ? 'var(--line)' : 'rgba(239, 68, 68, 0.4)'}; cursor: ${(!isPunchedIn || isPunchedOut) ? 'not-allowed' : 'pointer'};">
            🔴 Punch-Out (पंच-आउट)
          </button>
        </div>

        <!-- Reset / Re-Punch testing option -->
        ${(isPunchedIn || isPunchedOut) ? `
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line); display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 11px; color: var(--muted);">Testing or re-stamping shift?</span>
            <button type="button" class="btn btn-secondary btn-sm" id="btnActionResetPunch" style="font-size: 11px; padding: 3px 9px; color: #d97706; border-color: rgba(217, 119, 6, 0.4); background: rgba(217, 119, 6, 0.08); font-weight: 700;">
              🔄 Reset Today's Punch
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Right: Live GPS & Verification Status -->
      <div class="card" style="padding: 16px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: var(--primary); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <span>📍 GPS Geofence & Punch Audit</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btnDetectGpsPunch" style="font-size: 11px; padding: 2px 7px;">
            🔄 Refresh GPS
          </button>
        </div>

        <div id="pnlPunchGpsStatus" style="padding: 10px 12px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 10px; font-size: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: var(--muted); font-weight: 600;">Nearest Station:</span>
            <strong style="color: var(--ink);">${escapeHtml(repInfo.hq)} Station HQ</strong>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: var(--muted); font-weight: 600;">District Hub:</span>
            <strong style="color: var(--ink);">${escapeHtml(repInfo.district)}</strong>
          </div>
          <div id="lblGpsPunchCoords" style="font-size: 11px; color: #0284c7; font-weight: 600;">
            GPS: Ready for auto-detection
          </div>
        </div>

        <!-- Today's Stamped Times -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div style="padding: 8px 10px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line);">
            <div style="font-size: 10.5px; color: var(--muted); font-weight: 700;">Punch In Time</div>
            <div style="font-size: 14px; font-weight: 900; color: #16a34a; margin-top: 1px;">
              ${today?.punchIn || '—'}
            </div>
            ${today?.isLate ? '<span class="badge" style="background:#fee2e2; color:#dc2626; font-size:9.5px; font-weight:700;">Late Mark</span>' : ''}
          </div>

          <div style="padding: 8px 10px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line);">
            <div style="font-size: 10.5px; color: var(--muted); font-weight: 700;">Punch Out Time</div>
            <div style="font-size: 14px; font-weight: 900; color: var(--ink); margin-top: 1px;">
              ${today?.punchOut || '—'}
            </div>
          </div>
        </div>

        <div style="margin-top: 10px; padding: 8px 10px; background: var(--surface-bg); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
          <span style="color: var(--muted); font-weight: 600;">Logged Shift Duration:</span>
          <strong style="color: #2563eb; font-size: 14px;">${today?.workingHoursFormatted || '0h 00m'}</strong>
        </div>
      </div>
    </div>
  `;

  // Start live clock
  const updateClock = () => {
    const clockEl = modal.querySelector('#lblLiveIstClock');
    if (!clockEl) return;
    const n = new Date();
    const hrs = n.getHours();
    const m = n.getMinutes();
    const s = n.getSeconds();
    const am = hrs >= 12 ? 'PM' : 'AM';
    const h = hrs % 12 || 12;
    clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${am} IST`;
  };
  updateClock();
  timerInterval = setInterval(updateClock, 1000);

  // GPS Detection trigger
  let detectedPunchGps = null;
  const doDetectGps = async () => {
    const coordsEl = modal.querySelector('#lblGpsPunchCoords');
    if (coordsEl) coordsEl.textContent = 'Detecting live GPS…';
    try {
      const loc = await detectBrowserLocation({ timeout: 5000 });
      if (loc.success) {
        detectedPunchGps = { lat: loc.lat, lng: loc.lng, locationName: `${repInfo.hq} Field Sector` };
        if (coordsEl) coordsEl.textContent = `📍 Live: ${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}° (±${Math.round(loc.accuracy)}m)`;
      } else {
        const defaultBlockObj = BIHAR_BLOCKS.find(b => b.block.toLowerCase() === (repInfo.hq || '').toLowerCase()) || BIHAR_BLOCKS[0];
        detectedPunchGps = { lat: defaultBlockObj.lat, lng: defaultBlockObj.lng, locationName: `${repInfo.hq} Station HQ` };
        if (coordsEl) coordsEl.textContent = `📍 Station HQ: ${defaultBlockObj.lat.toFixed(4)}°, ${defaultBlockObj.lng.toFixed(4)}°`;
      }
    } catch (e) {
      if (coordsEl) coordsEl.textContent = 'GPS permission unavailable; stamped Station HQ';
    }
  };
  doDetectGps();

  modal.querySelector('#btnDetectGpsPunch')?.addEventListener('click', doDetectGps);

  // Punch-In action
  modal.querySelector('#btnActionPunchIn')?.addEventListener('click', () => {
    try {
      const mode = modal.querySelector('#selWorkMode')?.value || 'Field Operations';
      const notes = modal.querySelector('#iptPunchNotes')?.value || '';

      const rec = storage.recordPunchIn(repInfo.name, {
        gps: detectedPunchGps,
        workMode: mode,
        notes
      });

      showToast(`✅ Punch-In recorded at ${rec.punchIn}!`, '🕒');
      renderTodayPunchTab(viewport, modal, repInfo);
    } catch (err) {
      console.error('Punch-In failed:', err);
      showToast(`❌ Punch-In failed: ${err.message}`, '❌');
    }
  });

  // Punch-Out action
  modal.querySelector('#btnActionPunchOut')?.addEventListener('click', () => {
    try {
      const notes = modal.querySelector('#iptPunchNotes')?.value || '';
      const rec = storage.recordPunchOut(repInfo.name, {
        gps: detectedPunchGps,
        notes
      });
      showToast(`🏁 Punch-Out recorded at ${rec.punchOut} (${rec.workingHoursFormatted})!`, '✅');
      renderTodayPunchTab(viewport, modal, repInfo);
    } catch (err) {
      console.error('Punch-Out failed:', err);
      showToast(`❌ Punch-Out failed: ${err.message}`, '❌');
    }
  });

  // Reset Today's Punch action
  modal.querySelector('#btnActionResetPunch')?.addEventListener('click', () => {
    storage.resetTodayPunch(repInfo.name);
    showToast(`🔄 Today's punch cleared for ${repInfo.name}. Ready to punch-in fresh!`, 'ℹ️');
    renderTodayPunchTab(viewport, modal, repInfo);
  });
}

// =========================================================================
// TAB 2: 📅 MONTHLY MUSTER (मासिक मस्टर)
// =========================================================================

function renderMonthlyMusterTab(viewport, modal, repInfo, selectedMonth, selectedYear) {
  const muster = storage.getMusterRollMonthData(selectedYear, selectedMonth);
  const myRow = muster.rows.find(r => r.assistant === repInfo.name) || muster.rows[0];

  viewport.innerHTML = `
    <!-- Month Navigation Strip -->
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">📅</span>
        <div style="font-weight: 800; font-size: 15px; color: var(--ink); font-family: var(--font-heading);">
          ${muster.monthName} ${selectedYear} Muster Roll Register
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 8px;">
        <select id="selMusterMonth" class="form-control" style="font-size: 12px; font-weight: 700; width: 140px; padding: 5px 8px;">
          ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
            <option value="${m}" ${m === selectedMonth ? 'selected' : ''}>
              ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${selectedYear}
            </option>
          `).join('')}
        </select>
      </div>
    </div>

    <!-- Monthly Summary Metric Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 16px;">
      <div class="card" style="padding: 10px 12px; background: var(--surface-card); border-left: 3px solid #16a34a; border-radius: var(--radius-sm);">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Present (P)</div>
        <div style="font-size: 18px; font-weight: 900; color: #16a34a; margin-top: 2px;">
          ${myRow.presentCount} <span style="font-size: 11px;">Days</span>
        </div>
      </div>

      <div class="card" style="padding: 10px 12px; background: var(--surface-card); border-left: 3px solid #0284c7; border-radius: var(--radius-sm);">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--muted);">On Duty (OD)</div>
        <div style="font-size: 18px; font-weight: 900; color: #0284c7; margin-top: 2px;">
          ${myRow.onDutyCount} <span style="font-size: 11px;">Days</span>
        </div>
      </div>

      <div class="card" style="padding: 10px 12px; background: var(--surface-card); border-left: 3px solid #64748b; border-radius: var(--radius-sm);">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Weekly Offs</div>
        <div style="font-size: 18px; font-weight: 900; color: #64748b; margin-top: 2px;">
          ${myRow.weeklyOffCount} <span style="font-size: 11px;">Days</span>
        </div>
      </div>

      <div class="card" style="padding: 10px 12px; background: var(--surface-card); border-left: 3px solid #7c3aed; border-radius: var(--radius-sm);">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Paid Leave</div>
        <div style="font-size: 18px; font-weight: 900; color: #7c3aed; margin-top: 2px;">
          ${myRow.leaveCount} <span style="font-size: 11px;">Days</span>
        </div>
      </div>

      <div class="card" style="padding: 10px 12px; background: var(--surface-card); border-left: 3px solid #10b981; border-radius: var(--radius-sm); background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(2, 132, 199, 0.05) 100%);">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #047857;">Payable Days</div>
        <div style="font-size: 20px; font-weight: 900; color: #047857; margin-top: 2px;">
          ${myRow.payableDays} <span style="font-size: 11px;">/ ${muster.daysInMonth}</span>
        </div>
      </div>

      <div class="card" style="padding: 10px 12px; background: var(--surface-card); border-left: 3px solid #f59e0b; border-radius: var(--radius-sm);">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Monthly Wage</div>
        <div style="font-size: 18px; font-weight: 900; color: var(--ink); margin-top: 2px;">
          ₹${myRow.grossWage.toLocaleString('en-IN')}
        </div>
      </div>
    </div>

    <!-- Daily Breakdown Table -->
    <div class="card" style="padding: 0; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden;">
      <div style="padding: 10px 16px; background: var(--surface-bg); border-bottom: 1px solid var(--line); font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: space-between;">
        <span>📜 Daily Attendance Records (${muster.monthName} 1–${muster.daysInMonth})</span>
        <span style="font-size: 11px; color: var(--muted); font-weight: 600;">Daily Rate: ₹${myRow.dailyWage} / day</span>
      </div>

      <div style="max-height: 380px; overflow-y: auto;">
        <table class="table" style="width: 100%; font-size: 12px; margin: 0;">
          <thead>
            <tr style="background: var(--surface-bg); border-bottom: 1px solid var(--line);">
              <th style="padding: 6px 10px; width: 60px;">Date</th>
              <th style="padding: 6px 10px; width: 50px;">Day</th>
              <th style="padding: 6px 10px; width: 80px;">Status</th>
              <th style="padding: 6px 10px;">Punch In</th>
              <th style="padding: 6px 10px;">Punch Out</th>
              <th style="padding: 6px 10px;">Hours</th>
              <th style="padding: 6px 10px;">Description / Field Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${myRow.dailyAttendance.map(d => {
              const bg = d.code === 'P' ? 'rgba(16, 185, 129, 0.15)' : d.code === 'OD' ? 'rgba(2, 132, 199, 0.15)' : d.code === 'WO' ? 'rgba(100, 116, 139, 0.12)' : d.code === 'HD' ? 'rgba(245, 158, 11, 0.15)' : d.code === 'PL' ? 'rgba(124, 58, 237, 0.15)' : d.code === 'H' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.12)';
              const color = d.code === 'P' ? '#16a34a' : d.code === 'OD' ? '#0284c7' : d.code === 'WO' ? '#64748b' : d.code === 'HD' ? '#d97706' : d.code === 'PL' ? '#7c3aed' : d.code === 'H' ? '#047857' : '#dc2626';

              return `
                <tr style="border-bottom: 1px solid var(--line); ${d.isSunday ? 'background: rgba(100, 116, 139, 0.03);' : ''}">
                  <td style="padding: 6px 10px; font-weight: 700;">${d.dayNum}</td>
                  <td style="padding: 6px 10px; color: ${d.isSunday ? '#dc2626' : 'var(--muted)'}; font-weight: 600;">${d.dayName}</td>
                  <td style="padding: 6px 10px;">
                    <span class="badge" style="background: ${bg}; color: ${color}; font-weight: 800; font-size: 10.5px;">
                      ${d.code}
                    </span>
                  </td>
                  <td style="padding: 6px 10px; font-weight: 600;">${d.timeIn || '—'}</td>
                  <td style="padding: 6px 10px; font-weight: 600;">${d.timeOut || '—'}</td>
                  <td style="padding: 6px 10px;">${d.hours || '—'}</td>
                  <td style="padding: 6px 10px; color: var(--muted); font-size: 11px;">${escapeHtml(d.label)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Month change
  modal.querySelector('#selMusterMonth')?.addEventListener('change', (e) => {
    const newMonth = parseInt(e.target.value, 10);
    renderMonthlyMusterTab(viewport, modal, repInfo, newMonth, selectedYear);
  });
}

// =========================================================================
// TAB 3: 📝 REGULARIZATION & LEAVE APPLICATION (पंच सुधार व छुट्टी)
// =========================================================================

function renderRegularizationTab(viewport, modal, repInfo) {
  const records = storage.getAttendanceRecords({ assistant: repInfo.name });
  const pendingRequests = records.filter(r => r.regularizationRequested);

  viewport.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
      
      <!-- Left: Submit Request Form -->
      <div class="card" style="padding: 16px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
        <div style="font-weight: 800; font-size: 13.5px; color: var(--ink); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <span>📝 Apply for Punch Regularization / Leave</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label style="font-size: 11.5px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">
              Date for Regularization *
            </label>
            <input type="date" id="iptRegDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" style="font-size: 12px; font-weight: 700;" />
          </div>

          <div>
            <label style="font-size: 11.5px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">
              Requested Attendance Status *
            </label>
            <select id="selRegStatus" class="form-control" style="font-size: 12px; font-weight: 700;">
              <option value="P">P — Present (Full Day)</option>
              <option value="OD">OD — On Duty (Official Outstation Tour)</option>
              <option value="HD">HD — Half Day (Partial Visit)</option>
              <option value="PL">PL — Paid Leave (Casual / Sick Leave)</option>
            </select>
          </div>

          <div>
            <label style="font-size: 11.5px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">
              Reason / Justification *
            </label>
            <textarea id="txaRegReason" class="form-control" rows="3" placeholder="e.g. Field cellular network failure in remote rural block; conducted 5 dealer visits" style="font-size: 12px;"></textarea>
          </div>

          <button type="button" class="btn btn-primary" id="btnSubmitRegularize" style="font-weight: 800; font-size: 13px; padding: 10px; margin-top: 4px; background: #2563eb; border-color: #1d4ed8;">
            📤 Submit Regularization to Manager →
          </button>
        </div>
      </div>

      <!-- Right: Pending & Past Requests -->
      <div class="card" style="padding: 16px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
        <div style="font-weight: 800; font-size: 13.5px; color: var(--ink); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <span>📜 My Attendance Requests</span>
          <span class="badge" style="background: rgba(37, 99, 235, 0.12); color: #2563eb; font-size: 11px;">
            ${pendingRequests.length} Pending
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
          ${pendingRequests.length === 0 ? `
            <div style="text-align: center; padding: 24px 10px; color: var(--muted); font-size: 12px;">
              No pending regularization requests. Your attendance record is up to date!
            </div>
          ` : pendingRequests.map(r => `
            <div style="padding: 10px 12px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <strong style="color: var(--ink); font-size: 12.5px;">${r.date}</strong>
                <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-size: 10px; font-weight: 800;">
                  ⏳ Pending Review
                </span>
              </div>
              <div style="font-size: 11.5px; color: var(--muted);">
                Requested: <strong>${r.requestedStatus || 'P'}</strong> · "${escapeHtml(r.regularizationReason)}"
              </div>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;

  modal.querySelector('#btnSubmitRegularize')?.addEventListener('click', () => {
    const date = modal.querySelector('#iptRegDate')?.value;
    const status = modal.querySelector('#selRegStatus')?.value || 'P';
    const reason = modal.querySelector('#txaRegReason')?.value?.trim();

    if (!reason) {
      return alert('Please enter a justification reason for your attendance regularization.');
    }

    storage.submitAttendanceRegularization(repInfo.name, date, reason, status);
    showToast('Attendance regularization request submitted to Manager!', '📤');
    renderRegularizationTab(viewport, modal, repInfo);
  });
}
