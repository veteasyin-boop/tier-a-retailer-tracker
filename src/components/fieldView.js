import { ASSISTANTS, STATUS_OPTIONS, POTENTIAL_FOR, POTENTIAL_SELL } from '../data/assistants.js';
import { storage } from '../services/storage.js';
import { idbStorage } from '../services/idbStorage.js';
import { auth } from '../services/auth.js';
import { openRetailerModal } from './modal.js';
import { showToast } from './toast.js';
import { BIHAR_BLOCKS, detectBrowserLocation, findClosestBlocks, calculateDistanceKm } from '../utils/geo.js';
import { supabaseService } from '../services/supabase.js';
import { calculateAssistantScore, FARMER_LEAD_STAGES } from '../services/kpiService.js';
import { openKpiScoreModal } from './kpiScoreModal.js';
import { openFarmerMeetingModal } from './farmerMeetingModal.js';
import { openDemoPlotModal } from './demoPlotModal.js';
import { openCompetitorIntelModal } from './competitorModal.js';
import { openAgronomyQuizModal } from './quizModal.js';
import { openEodClosingModal } from './eodModal.js';
import { openFarmerLeadModal } from './farmerLeadsModal.js';
import { openWeeklyReviewModal } from './weeklyReviewModal.js';
import { openMgoSuccessModal } from './mgoSuccessModal.js';
import { openAssignedFormsListModal } from './assignedFormsListModal.js';
import { openFillDynamicFormModal } from './fillDynamicFormModal.js';
import { openRepStockUpdateModal } from './repStockUpdateModal.js';
import { openRepStockLedgerModal } from './repStockLedgerModal.js';
import { openSmartTourBeatModal } from './smartTourBeatModal.js';
import { openAttendanceModal } from './attendanceModal.js';
import { openLeaveModal } from './leaveModal.js';

let currentDetectedBlock = null;
let currentSearch = '';
let currentScope = 'all'; // 'all' | 'block' | 'district'
let activeSubTab = 'nearby'; // 'nearby' | 'tour' | 'leads' | 'farmers' | 'competitor'
let leadStageFilter = 'all';
let showFullDailyRhythm = false;
let nearbyPage = 1;
const nearbyPageSize = 10;
let isRefreshing = false;
let userCoords = null;

function safeLower(str) {
  return String(str || '').trim().toLowerCase();
}

function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTourStorageKey(repName) {
  return `tat_tour_${safeLower(repName)}_${getTodayDateStr()}`;
}

function getTodayTourIds(repName) {
  try {
    const raw = localStorage.getItem(getTourStorageKey(repName));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    console.error('Tour read error:', e);
  }
  return new Set();
}

function saveTodayTourIds(repName, set) {
  try {
    localStorage.setItem(getTourStorageKey(repName), JSON.stringify([...set]));
    if (supabaseService.isReady) {
      supabaseService.saveTodayTour(repName, getTodayDateStr(), set).catch(e => console.warn('Supabase tour save warning:', e));
    }
  } catch (e) {
    console.error('Tour save error:', e);
  }
}

let isAutoDetectingLocation = false;
let speedTelemetryWatchId = null;
let lastTelemetryPos = null;

function checkAndRecordSpeedTelemetry(repName, lat, lng, rawSpeedMs) {
  if (!repName) return;
  const speedConfig = storage.getSpeedPolicyConfig();
  if (speedConfig.enabled === false) return;

  let speedKmH = null;
  if (typeof rawSpeedMs === 'number' && !isNaN(rawSpeedMs) && rawSpeedMs > 0) {
    speedKmH = Math.round(rawSpeedMs * 3.6);
  } else if (lastTelemetryPos && lastTelemetryPos.timestamp) {
    const elapsedHours = (Date.now() - lastTelemetryPos.timestamp) / 3600000;
    if (elapsedHours > (5 / 3600) && elapsedHours < 0.5) {
      const dist = calculateDistanceKm(lastTelemetryPos.lat, lastTelemetryPos.lng, lat, lng);
      const computedSpeed = dist / elapsedHours;
      if (computedSpeed >= 15 && computedSpeed <= 220) {
        speedKmH = Math.round(computedSpeed);
      }
    }
  }

  lastTelemetryPos = { lat, lng, timestamp: Date.now() };

  if (speedKmH && speedKmH >= 30) {
    const mode = storage.getAssistantVehicleMode(repName);
    const closest = findClosestBlocks(lat, lng);
    const locationName = closest[0] ? `${closest[0].block} (${closest[0].district})` : 'Bihar Highway Transit';

    // Strictly records ONLY when threshold is breached!
    const breach = storage.recordSpeedBreachIfViolated({
      assistantName: repName,
      speedKmH,
      vehicleMode: mode,
      latitude: lat,
      longitude: lng,
      locationName
    });

    if (breach) {
      showToast(`🚨 High-Speed Violation Logged: ${speedKmH} km/h (Limit: ${breach.thresholdKmH} km/h). Auto-captured for Admin safety audit!`, '⚠️');
    }
  }
}

function startSpeedTelemetryWatcher(repName) {
  if (!navigator.geolocation || !repName) return;
  if (speedTelemetryWatchId !== null) return;

  try {
    speedTelemetryWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        checkAndRecordSpeedTelemetry(repName, pos.coords.latitude, pos.coords.longitude, pos.coords.speed);
      },
      (err) => {
        // Silently tolerate if GPS unavailable
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
  } catch (e) {
    console.warn('Geolocation watch error:', e);
  }
}

async function autoDetectUserLocation(container, repInfo) {
  if (isAutoDetectingLocation) return;
  isAutoDetectingLocation = true;

  try {
    const loc = await detectBrowserLocation({ timeout: 6000 });
    if (loc.success) {
      userCoords = { lat: loc.lat, lng: loc.lng, isRealGps: true, accuracy: loc.accuracy };
      const closest = findClosestBlocks(loc.lat, loc.lng);
      currentDetectedBlock = closest[0] || BIHAR_BLOCKS[0];
      const distKm = calculateDistanceKm(loc.lat, loc.lng, currentDetectedBlock.lat, currentDetectedBlock.lng);
      checkAndRecordSpeedTelemetry(repInfo.name, loc.lat, loc.lng, loc.speed);
      showToast(`📍 Live GPS acquired: Lat ${loc.lat.toFixed(4)}°, Lng ${loc.lng.toFixed(4)}° (${distKm} km from ${currentDetectedBlock.block})`, '📍');
      renderNearbyRetailersView(container, storage.rows, repInfo);
    }
  } catch (err) {
    console.warn('Auto-location detection skipped:', err);
  } finally {
    isAutoDetectingLocation = false;
  }
}

export function renderFieldView(container, allRows) {
  const currentRep = auth.getAssignedRep();

  // If rep is not authenticated and not admin, show Rep Login screen
  if (!currentRep && !auth.isAdmin) {
    renderRepLoginScreen(container);
    return;
  }

  const allAssistants = storage.getAssistants();
  const currentRepInfo = allAssistants.find(a => a.name === currentRep) || allAssistants[0];

  // Initialize currentDetectedBlock to rep's HQ station as fallback
  if (!currentDetectedBlock) {
    const hqBlock = BIHAR_BLOCKS.find(b => safeLower(b.block) === safeLower(currentRepInfo?.hq)) || BIHAR_BLOCKS[0];
    currentDetectedBlock = hqBlock;
  }

  if (!userCoords) {
    const hqBlock = BIHAR_BLOCKS.find(b => safeLower(b.block) === safeLower(currentRepInfo?.hq)) || BIHAR_BLOCKS[0];
    userCoords = { lat: hqBlock.lat, lng: hqBlock.lng, isRealGps: false };
    // Automatically trigger live device GPS detection in background
    autoDetectUserLocation(container, currentRepInfo);
  }

  renderNearbyRetailersView(container, allRows, currentRepInfo);
}

function renderRepLoginScreen(container) {
  const assistants = storage.getAssistants();
  container.innerHTML = `
    <div class="card" style="text-align: center; padding: 36px 24px; max-width: 540px; margin: 30px auto; box-shadow: var(--shadow-lg);">
      <div style="font-size: 46px; margin-bottom: 10px; animation: pulse-dot 2s infinite ease-in-out;">🌾</div>
      <h2 style="font-family: var(--font-heading); font-size: 22px; font-weight: 700; margin-bottom: 6px;">
        Field Representative / MGO Login
      </h2>
      <p style="color: var(--muted); font-size: 13.5px; line-height: 1.5; margin-bottom: 22px;">
        Select your assigned field station and enter your password to access field activities, farmer meetings, and demo plots.
      </p>

      <form id="repLoginForm" style="text-align: left; display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Select Field Assistant / Station *</label>
          <select id="repLoginSelect" required style="padding: 10px 12px; font-size: 14px;">
            <option value="">Choose your station…</option>
            ${assistants.map(a => `
              <option value="${escapeHtml(a.name)}">
                ${escapeHtml(a.name)} — ${escapeHtml(a.hq)} HQ (${escapeHtml(a.district)})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Station Password *</label>
          <input type="password" id="repLoginPassword" required value="rep123" placeholder="Enter assigned password (e.g. rep123)" style="padding: 10px 12px; font-size: 14px;">
          <span style="font-size: 11.5px; color: var(--muted); margin-top: 4px;">
            🔒 Default Password: <code>rep123</code> (Pre-filled for convenience)
          </span>
        </div>

        <div id="repLoginError" style="color: var(--danger); font-size: 12.5px; font-weight: 600; min-height: 18px;"></div>

        <button type="submit" class="btn btn-primary" id="btnRepLoginSubmit" style="padding: 12px; font-size: 15px; border-radius: var(--radius-sm); margin-top: 4px; font-weight: 700;">
          Log In to Field Station →
        </button>
      </form>
    </div>
  `;

  document.getElementById('repLoginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const repName = document.getElementById('repLoginSelect').value;
    const password = document.getElementById('repLoginPassword').value;
    const res = auth.loginRep(repName, password, storage.getAssistants());

    if (res.success) {
      showToast(`Welcome, ${repName}! Station unlocked.`, '🌾');
      window.dispatchEvent(new CustomEvent('tracker:roleChanged'));
      renderFieldView(container, storage.rows);
    } else {
      const errEl = document.getElementById('repLoginError');
      if (errEl) errEl.textContent = res.error;
    }
  });
}

function renderRefreshLanding(container, repInfo) {
  container.innerHTML = `
    <!-- Rep Station Identity Banner -->
    <div class="card" style="margin-bottom: 16px; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: var(--surface-alt); border-left: 4px solid var(--primary);">
      <div>
        <div style="font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Active Field Representative</div>
        <div style="font-weight: 700; font-size: 15px;">👤 ${escapeHtml(repInfo.name)}</div>
        <div style="font-size: 12px; color: var(--muted);">Base HQ: <strong>${escapeHtml(repInfo.hq)}</strong> · District: <strong>${escapeHtml(repInfo.district)}</strong></div>
      </div>
      <button class="btn btn-secondary btn-sm" id="btnRepLogoutLanding" style="color: var(--danger); font-weight: 600;">
        🚪 Logout Station
      </button>
    </div>

    <div class="card" style="text-align: center; padding: 44px 20px; max-width: 600px; margin: 20px auto; box-shadow: var(--shadow-lg);">
      <div style="font-size: 48px; margin-bottom: 12px; animation: pulse-dot 2s infinite ease-in-out;">📍</div>
      <h2 style="font-family: var(--font-heading); font-size: 24px; font-weight: 700; margin-bottom: 8px;">
        Locate Nearby Retailers
      </h2>
      <p style="color: var(--muted); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
        Tap <strong>Refresh</strong> below to detect your current field location. The system will map your GPS coordinates to your Bihar block and list your station's Tier-A counters.
      </p>

      <button class="btn btn-primary" id="btnBigRefresh" style="padding: 14px 32px; font-size: 16px; border-radius: var(--radius-pill); box-shadow: var(--shadow-glow);">
        <span style="font-size: 18px;">🔄</span> Refresh & Locate Nearby Retailers
      </button>

      <div style="margin-top: 20px; font-size: 12px; color: var(--muted);">
        🔒 Station Siloed • Live GPS Geofenced Verification
      </div>
    </div>
  `;

  document.getElementById('btnBigRefresh')?.addEventListener('click', () => handleRefreshAction(container));
  document.getElementById('btnRepLogoutLanding')?.addEventListener('click', () => {
    auth.logoutRep();
    currentDetectedBlock = null;
    userCoords = null;
    nearbyPage = 1;
    currentSearch = '';
    activeSubTab = 'nearby';
    window.dispatchEvent(new CustomEvent('tracker:roleChanged'));
    showToast('Logged out from representative station.', '🔒');
    renderFieldView(container, storage.rows);
  });
}

async function handleRefreshAction(container) {
  if (isRefreshing) return;
  isRefreshing = true;

  const btn = document.getElementById('btnBigRefresh') || document.getElementById('btnTopRefresh');
  if (btn) {
    btn.innerHTML = `<span style="display:inline-block; animation:spin 1s infinite linear;">🔄</span> Locating nearby block…`;
    btn.disabled = true;
  }

  showToast('Detecting current GPS coordinates…', '📡');

  try {
    const loc = await detectBrowserLocation({ timeout: 7000 });
    if (loc.success) {
      userCoords = { lat: loc.lat, lng: loc.lng, isRealGps: true, accuracy: loc.accuracy };
      const closest = findClosestBlocks(loc.lat, loc.lng);
      currentDetectedBlock = closest[0] || BIHAR_BLOCKS[0];
      const distKm = calculateDistanceKm(loc.lat, loc.lng, currentDetectedBlock.lat, currentDetectedBlock.lng);
      const assignedRep = auth.getAssignedRep();
      if (assignedRep) {
        checkAndRecordSpeedTelemetry(assignedRep, loc.lat, loc.lng, loc.speed);
      }
      showToast(`📍 Live GPS: ${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}° (${distKm} km from ${currentDetectedBlock.block})`, '📍');
    } else {
      // Default to rep's HQ station
      const assignedRep = auth.getAssignedRep();
      const allAssistants = storage.getAssistants();
      const repInfo = allAssistants.find(a => a.name === assignedRep) || allAssistants[0];
      const defaultBlock = BIHAR_BLOCKS.find(b => b.block === repInfo.hq) || BIHAR_BLOCKS[0];

      userCoords = { lat: defaultBlock.lat, lng: defaultBlock.lng, isRealGps: false };
      currentDetectedBlock = {
        ...defaultBlock,
        distanceKm: 0.5
      };
      showToast(`GPS unavailable: ${loc.error || 'Permission denied'}. Showing ${currentDetectedBlock.block} Station HQ`, '⚠️');
    }
  } catch (err) {
    console.error('Refresh location error:', err);
    const defaultBlock = BIHAR_BLOCKS[0];
    userCoords = { lat: defaultBlock.lat, lng: defaultBlock.lng, isRealGps: false };
    currentDetectedBlock = { ...defaultBlock, distanceKm: 0.5 };
    showToast(`Defaulted to ${currentDetectedBlock.block} Block`, '📍');
  } finally {
    isRefreshing = false;
    nearbyPage = 1;
    if (btn) btn.disabled = false;
    renderFieldView(container, storage.rows);
  }
}

function renderNearbyRetailersView(container, allRows, repInfo) {
  const currentRep = auth.getAssignedRep();
  const rows = (allRows && allRows.length > 0) ? allRows : storage.rows;

  // STRICT STATION DATA SILO:
  // Rep can ONLY see retailers assigned to their own station! No data leakage.
  const myStationRows = auth.isAdmin ? rows : rows.filter(r => r.assistant === currentRep);

  const dBlock = safeLower(currentDetectedBlock?.block);
  const dDistrict = safeLower(currentDetectedBlock?.district);

  // 1. Calculate proximity distance for all station retailers
  const withDistance = myStationRows.map(r => {
    const rBlock = safeLower(r.block);
    const blockMeta = BIHAR_BLOCKS.find(b => safeLower(b.block) === rBlock);
    let dist = 1.0;
    if (userCoords && blockMeta) {
      dist = calculateDistanceKm(userCoords.lat, userCoords.lng, blockMeta.lat, blockMeta.lng);
    }
    const isExactBlock = Boolean(dBlock && rBlock === dBlock);
    const isSameDistrict = Boolean(dDistrict && safeLower(r.district) === dDistrict);
    return {
      ...r,
      calculatedDistKm: dist,
      isExactBlock,
      isSameDistrict
    };
  });

  const inBlockCount = withDistance.filter(r => r.isExactBlock).length;
  const inDistrictCount = withDistance.filter(r => r.isSameDistrict).length;
  const totalMyRetailers = withDistance.length;

  // 2. Proximity Scope Filtering
  let relevantRows = withDistance;
  if (currentScope === 'block' && inBlockCount > 0) {
    relevantRows = withDistance.filter(r => r.isExactBlock);
  } else if (currentScope === 'district' && inDistrictCount > 0) {
    relevantRows = withDistance.filter(r => r.isSameDistrict);
  }

  // 3. Sort: Exact block first, then same district, then by distance
  relevantRows.sort((a, b) => {
    if (a.isExactBlock && !b.isExactBlock) return -1;
    if (!a.isExactBlock && b.isExactBlock) return 1;
    if (a.isSameDistrict && !b.isSameDistrict) return -1;
    if (!a.isSameDistrict && b.isSameDistrict) return 1;
    return (a.calculatedDistKm || 0) - (b.calculatedDistKm || 0);
  });

  // Tour Plan IDs for today
  const tourIds = getTodayTourIds(currentRep);
  const todayTourRows = withDistance.filter(r => tourIds.has(r.id));
  const todayVerifiedCount = todayTourRows.filter(r => r.verifiedVisit && r.checkInDate === getTodayDateStr()).length;
  const tourCompletionPct = todayTourRows.length ? Math.round((todayVerifiedCount / todayTourRows.length) * 100) : 0;

  // Real-time MGO 100-Point KPI Model Evaluation
  const todayStr = getTodayDateStr();
  const allCheckIns = storage.getCheckInLogs();
  const allMeetings = storage.getFarmerMeetings();
  const allDemos = storage.getDemoPlots();
  const allIntel = storage.getCompetitorIntel();
  const repMeetings = allMeetings.filter(m => m.assistant === repInfo.name);
  const repDemos = allDemos.filter(d => d.assistant === repInfo.name);
  const repIntel = allIntel.filter(c => c.assistant === repInfo.name);
  const quizState = storage.getQuizState(repInfo.name);
  const eodReport = storage.getEodReport(repInfo.name, todayStr);
  const tourPlan = { retailer_ids: [...tourIds] };

  const allLeads = storage.getFarmerLeads();
  const repLeads = allLeads.filter(l => l.assistant === repInfo.name);
  const aqfsAudit = storage.getAssistantAqfsAudit(repInfo.name);
  const repNotifs = storage.getAssistantNotifications(repInfo.name);
  const unreadNotifs = repNotifs.filter(n => !n.read);
  const assignedForms = storage.getFormsForAssistant(repInfo.name);
  const pendingForms = assignedForms.filter(f => !f.userSubmitted);
  const repStockSummary = storage.getAssistantInventoryLedger(repInfo.name);
  const pendingSpeedWarnings = storage.getRepPendingSpeedWarnings(repInfo.name);
  const todayAtt = storage.getTodayAttendance(repInfo.name);

  // Initialize background live speed monitoring for current active field rep
  startSpeedTelemetryWatcher(repInfo.name);

  const kpiData = calculateAssistantScore(repInfo.name, {
    checkInLogs: allCheckIns,
    tourPlan,
    farmerMeetings: allMeetings,
    demoPlots: allDemos,
    competitorIntel: allIntel,
    farmerLeads: allLeads,
    retailerRows: allRows,
    quizCompleted: Boolean(quizState && quizState.completedAt),
    eodSubmitted: Boolean(eodReport && eodReport.submittedAt),
    aqfsAudit
  });

  // 10-Step Daily Operating Rhythm (Section 9 of SOP)
  const dailySteps = [
    { num: 1, title: 'Review Planned PJP', done: todayTourRows.length > 0, detail: `${todayTourRows.length} Stops in Plan`, tab: 'tour', btn: 'PJP' },
    { num: 2, title: 'Visit Dealers / Counters', done: todayVerifiedCount > 0, detail: `${todayVerifiedCount} Verified Visits`, tab: 'nearby', btn: 'Counters' },
    { num: 3, title: 'Productive Farmer Interactions', done: repMeetings.length > 0, detail: `${repMeetings.length} Meetings Logged`, action: 'meeting', btn: '+ Log Meeting' },
    { num: 4, title: 'Generate & Follow Up Leads', done: repLeads.length > 0, detail: `${repLeads.length} Leads Active`, action: 'lead', btn: '+ Add Lead' },
    { num: 5, title: 'Conduct Demos / Trial Plots', done: repDemos.length > 0, detail: `${repDemos.length} Plots Tracked`, action: 'demo', btn: '+ Add Demo' },
    { num: 6, title: 'Capture Market Observations', done: myStationRows.some(r => r.notes && r.notes.length > 5), detail: 'Counter Notes', tab: 'nearby', btn: 'Observations' },
    { num: 7, title: 'Record Competitor Info & Pricing', done: repIntel.length > 0, detail: `${repIntel.length} Intel Entries`, action: 'intel', btn: '+ Add Intel' },
    { num: 8, title: 'Update Activity Records', done: allCheckIns.filter(l => l.rep === repInfo.name).length > 0, detail: `${allCheckIns.filter(l => l.rep === repInfo.name).length} Checked In`, tab: 'nearby', btn: 'Records' },
    { num: 9, title: 'Identify Pending Follow-ups', done: repLeads.some(l => l.follow_up_date), detail: 'Pipeline Follow-ups', tab: 'leads', btn: 'Follow-ups' },
    { num: 10, title: 'Submit Daily EOD Closing Report', done: Boolean(eodReport && eodReport.submittedAt), detail: eodReport ? 'Submitted' : 'Pending (Cutoff 8:30 PM)', action: 'eod', btn: 'Submit EOD' }
  ];
  const completedDisciplines = dailySteps.filter(s => s.done).length;
  const rhythmPct = Math.round((completedDisciplines / 10) * 100);

  // 4. Apply search query for retailer tabs
  const q = safeLower(currentSearch);
  let filteredNearby = (activeSubTab === 'tour') ? todayTourRows : relevantRows;
  if (q) {
    filteredNearby = filteredNearby.filter(r => 
      safeLower(r.retailer).includes(q) ||
      safeLower(r.block).includes(q) ||
      safeLower(r.mobile).includes(q) ||
      safeLower(r.notes).includes(q)
    );
  }

  const totalDisplay = filteredNearby.length;
  const totalPages = Math.ceil(totalDisplay / nearbyPageSize) || 1;
  if (nearbyPage < 1) nearbyPage = 1;
  if (nearbyPage > totalPages) nearbyPage = totalPages;

  const startIdx = (nearbyPage - 1) * nearbyPageSize;
  const pageRows = filteredNearby.slice(startIdx, startIdx + nearbyPageSize);

  const repTotalBooked = myStationRows.reduce((sum, r) => sum + (Number(r.total_orders_value) || 0), 0);
  const repInitials = (repInfo.name || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'MO';
  const nowObj = new Date();
  const timeStr = nowObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const timeParts = timeStr.split(' ');
  const timeBase = timeParts[0];
  const ampm = timeParts[1] || '';
  const dateLongStr = nowObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const isPunchedIn = Boolean(todayAtt?.punchIn && !todayAtt?.punchOut);
  const isPunchedOut = Boolean(todayAtt?.punchOut);

  container.innerHTML = `
    <!-- Top Utility & Quick Action Strip -->
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; padding: 4px 2px;">
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; font-weight: 800; font-size: 11px; padding: 4px 10px;">
          🌾 Bihar Agronomy Grid
        </span>
        <span style="font-size: 12px; color: var(--muted); font-weight: 600;">
          Station: <strong style="color: var(--ink);">${escapeHtml(repInfo.hq)}</strong> (${escapeHtml(repInfo.district)})
        </span>
      </div>

      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnRepNotifications" style="position: relative; font-size: 11.5px; font-weight: 700; padding: 5px 10px;">
          🔔 Notices ${unreadNotifs.length > 0 ? `<span class="badge" style="background: #ef4444; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 50%; margin-left: 4px;">${unreadNotifs.length}</span>` : ''}
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnHeaderLeave" style="font-size: 11.5px; font-weight: 700; color: #059669; padding: 5px 10px;">
          🏖️ Leave
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnHeaderStockLedger" style="font-size: 11.5px; font-weight: 700; color: #16a34a; padding: 5px 10px;">
          📦 Stock (${repStockSummary.totalBalanceUnits})
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnHeaderWeekly" style="font-size: 11.5px; font-weight: 700; padding: 5px 10px;">
          📅 Weekly
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnHeaderSuccess" style="font-size: 11.5px; font-weight: 700; padding: 5px 10px;">
          🌱 SOP Guide
        </button>
        <button class="btn btn-secondary btn-sm" id="btnRepSwitchLogout" style="color: var(--danger); font-weight: 700; font-size: 11.5px; border-color: rgba(244, 63, 94, 0.3); padding: 5px 10px;">
          🚪 Logout
        </button>
      </div>
    </div>

    <!-- TRUEIN-INSPIRED LUXURY WORKFORCE CONSOLE -->
    <div class="truein-hero-console">
      <div class="truein-profile-header">
        <div class="truein-user-profile">
          <div class="truein-avatar-circle">
            ${escapeHtml(repInitials)}
            <div class="truein-avatar-badge ${isPunchedIn ? '' : 'inactive'}"></div>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; color: #fff; letter-spacing: -0.02em;">
                ${escapeHtml(repInfo.name)}
              </span>
              <span class="badge" style="background: ${isPunchedOut ? 'rgba(148, 163, 184, 0.25)' : isPunchedIn ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}; color: ${isPunchedOut ? '#94a3b8' : isPunchedIn ? '#34d399' : '#fca5a5'}; font-size: 10.5px; font-weight: 800; border: 1px solid currentColor;">
                ${isPunchedOut ? '🏁 SHIFT ENDED' : isPunchedIn ? '🟢 ON DUTY' : '🔴 OFF DUTY'}
              </span>
            </div>
            <div style="font-size: 12px; color: #94a3b8; font-weight: 500; margin-top: 3px;">
              📍 HQ: <strong style="color: #f1f5f9;">${escapeHtml(repInfo.hq)}</strong> · District: <strong style="color: #f1f5f9;">${escapeHtml(repInfo.district)}</strong> · <strong style="color: #38bdf8;">${totalMyRetailers} Assigned Counters</strong>
            </div>
          </div>
        </div>

        <div class="truein-clock-card">
          <div class="truein-digital-time">
            ${escapeHtml(timeBase)}
            <span class="truein-digital-sec">${escapeHtml(ampm)}</span>
          </div>
          <div class="truein-digital-date">
            📅 ${escapeHtml(dateLongStr)}
          </div>
          <div style="font-size: 11px; color: #38bdf8; font-weight: 600; margin-top: 2px;">
            ${userCoords?.isRealGps ? '🟢 GPS Lock ±' + (userCoords.accuracy || 20) + 'm' : '⚠️ Station Coordinates'}
          </div>
        </div>
      </div>

      <!-- Center Interactive Truein Tactile Punch Button & Shift Summary -->
      <div class="truein-punch-center">
        <div class="truein-shift-status">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; font-weight: 700;">Shift Protocol (SOP)</span>
            <span style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">09:30 AM – 06:30 PM</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="background: rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
              <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Punch In</div>
              <div style="font-size: 14px; font-weight: 800; color: ${todayAtt?.punchIn ? '#34d399' : '#f87171'}; margin-top: 2px;">
                ${todayAtt?.punchIn ? todayAtt.punchIn : 'Pending'}
              </div>
            </div>
            <div style="background: rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
              <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Punch Out</div>
              <div style="font-size: 14px; font-weight: 800; color: ${todayAtt?.punchOut ? '#38bdf8' : '#94a3b8'}; margin-top: 2px;">
                ${todayAtt?.punchOut ? todayAtt.punchOut : '--:--'}
              </div>
            </div>
          </div>
          <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11.5px; color: #cbd5e1;">Live Tracking:</span>
            <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px; font-weight: 800;">
              Geofenced Anti-Spoofing GPS
            </span>
          </div>
        </div>

        <div>
          <button type="button" class="truein-punch-btn ${isPunchedIn ? 'punch-out' : 'punch-in'}" id="btnTrueinHeroPunch" title="Click to record official attendance punch">
            <span class="truein-punch-icon">${isPunchedOut ? '✅' : isPunchedIn ? '🏁' : '👉'}</span>
            <span class="truein-punch-label">${isPunchedOut ? 'SHIFT DONE' : isPunchedIn ? 'PUNCH OUT' : 'PUNCH IN'}</span>
            <span class="truein-punch-sub">${isPunchedOut ? 'Muster Recorded' : isPunchedIn ? 'Tap to Close Shift' : 'Tap to Mark Duty'}</span>
          </button>
        </div>
      </div>

      <!-- Quick Metrics Bar inside Hero Console -->
      <div class="truein-metrics-pills">
        <div class="truein-metric-tile" id="btnHeroKpiPill" style="cursor: pointer;" title="View 100-Point KPI Scorecard">
          <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">100-Pt KPI</div>
          <div style="font-size: 14.5px; font-weight: 800; color: ${kpiData.grade.color}; margin-top: 2px;">
            ${kpiData.grade.icon} ${kpiData.totalScore}/100
          </div>
          <div style="font-size: 9.5px; color: #cbd5e1; font-weight: 600;">${kpiData.grade.label}</div>
        </div>

        <div class="truein-metric-tile" id="btnHeroPjpPill" style="cursor: pointer;" title="Today's PJP Journey Stops">
          <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">PJP Verified</div>
          <div style="font-size: 14.5px; font-weight: 800; color: #34d399; margin-top: 2px;">
            ${todayVerifiedCount}/${todayTourRows.length || totalMyRetailers}
          </div>
          <div style="font-size: 9.5px; color: #cbd5e1; font-weight: 600;">Stops Done</div>
        </div>

        <div class="truein-metric-tile" id="btnHeroOrderPill" style="cursor: pointer;" title="Total Dealer Sales Booked">
          <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Orders Booked</div>
          <div style="font-size: 14.5px; font-weight: 800; color: #38bdf8; margin-top: 2px;">
            ₹${repTotalBooked > 0 ? (repTotalBooked >= 1000 ? (repTotalBooked / 1000).toFixed(1) + 'k' : repTotalBooked) : '0'}
          </div>
          <div style="font-size: 9.5px; color: #cbd5e1; font-weight: 600;">Pipeline Value</div>
        </div>

        <div class="truein-metric-tile" id="btnHeroLeadsPill" style="cursor: pointer;" title="Farmer Demand Generation Leads">
          <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Farmer Leads</div>
          <div style="font-size: 14.5px; font-weight: 800; color: #fbbf24; margin-top: 2px;">
            ${repLeads.length}
          </div>
          <div style="font-size: 9.5px; color: #cbd5e1; font-weight: 600;">Prospects</div>
        </div>

        <div class="truein-metric-tile" id="btnHeroFollowupsPill" style="cursor: pointer;" title="Pending Follow-ups Due">
          <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Follow-ups</div>
          <div style="font-size: 14.5px; font-weight: 800; color: #f87171; margin-top: 2px;">
            ${storage.getUpcomingFollowUps(repInfo.name).length}
          </div>
          <div style="font-size: 9.5px; color: #cbd5e1; font-weight: 600;">Callbacks</div>
        </div>

        <div class="truein-metric-tile" id="btnHeroStockPill" style="cursor: pointer;" title="Physical Stock Allocated">
          <div style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Stock Hand</div>
          <div style="font-size: 14.5px; font-weight: 800; color: #a78bfa; margin-top: 2px;">
            ${repStockSummary.totalBalanceUnits}
          </div>
          <div style="font-size: 9.5px; color: #cbd5e1; font-weight: 600;">Units Balance</div>
        </div>
      </div>
    </div>

    <!-- TRUEIN-INSPIRED 6-PILLAR ACTION BENTO GRID -->
    <div class="truein-bento-grid">
      <!-- Card 1: Smart Beat TSP -->
      <div class="truein-bento-card" id="bentoSmartBeat">
        <span class="truein-bento-badge" style="background: rgba(16, 185, 129, 0.15); color: #059669;">
          ${todayTourRows.length} Stops
        </span>
        <div class="truein-bento-icon-wrapper" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff;">
          🗺️
        </div>
        <div>
          <div class="truein-bento-title">Smart Beat (TSP)</div>
          <div class="truein-bento-sub">GPS Route & Optimizer</div>
        </div>
      </div>

      <!-- Card 2: Station Retailers -->
      <div class="truein-bento-card" id="bentoCounters">
        <span class="truein-bento-badge" style="background: rgba(2, 132, 199, 0.15); color: #0284c7;">
          ${totalMyRetailers} Counters
        </span>
        <div class="truein-bento-icon-wrapper" style="background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); color: #fff;">
          🏬
        </div>
        <div>
          <div class="truein-bento-title">Counter Directory</div>
          <div class="truein-bento-sub">Station Retailers & Audits</div>
        </div>
      </div>

      <!-- Card 3: Due Follow-ups -->
      <div class="truein-bento-card" id="bentoFollowUps">
        <span class="truein-bento-badge" style="background: ${storage.getUpcomingFollowUps(repInfo.name).length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)'}; color: ${storage.getUpcomingFollowUps(repInfo.name).length > 0 ? '#dc2626' : '#64748b'};">
          ${storage.getUpcomingFollowUps(repInfo.name).length} Due
        </span>
        <div class="truein-bento-icon-wrapper" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff;">
          📅
        </div>
        <div>
          <div class="truein-bento-title">Due Follow-ups</div>
          <div class="truein-bento-sub">Pipeline & Promises</div>
        </div>
      </div>

      <!-- Card 4: Farmer CRM -->
      <div class="truein-bento-card" id="bentoFarmerCrm">
        <span class="truein-bento-badge" style="background: rgba(139, 92, 246, 0.15); color: #7c3aed;">
          ${repLeads.length} Leads
        </span>
        <div class="truein-bento-icon-wrapper" style="background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%); color: #fff;">
          🌾
        </div>
        <div>
          <div class="truein-bento-title">Farmer CRM</div>
          <div class="truein-bento-sub">Demand Generation & Crops</div>
        </div>
      </div>

      <!-- Card 5: Field Outreach -->
      <div class="truein-bento-card" id="bentoMeetingsDemo">
        <span class="truein-bento-badge" style="background: rgba(236, 72, 153, 0.15); color: #db2777;">
          ${repMeetings.length + repDemos.length} Held
        </span>
        <div class="truein-bento-icon-wrapper" style="background: linear-gradient(135deg, #f472b6 0%, #db2777 100%); color: #fff;">
          👥
        </div>
        <div>
          <div class="truein-bento-title">Meetings & Demos</div>
          <div class="truein-bento-sub">Field Trials & Gatherings</div>
        </div>
      </div>

      <!-- Card 6: TA/DA Mileage -->
      <div class="truein-bento-card" id="bentoTadaClaim">
        <span class="truein-bento-badge" style="background: rgba(16, 185, 129, 0.15); color: #047857;">
          ₹ Claims
        </span>
        <div class="truein-bento-icon-wrapper" style="background: linear-gradient(135deg, #34d399 0%, #059669 100%); color: #fff;">
          💰
        </div>
        <div>
          <div class="truein-bento-title">TA/DA Mileage</div>
          <div class="truein-bento-sub">GPS Km & Fuel Allowance</div>
        </div>
      </div>
    </div>

    <!-- REAL-TIME FLEET SPEED VIOLATION WARNING NOTICE BANNER -->
    ${pendingSpeedWarnings.length > 0 ? `
      <div class="card" style="padding: 16px 20px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(185, 28, 28, 0.08) 100%); border: 1.5px solid #ef4444; border-radius: var(--radius-md); box-shadow: 0 4px 16px rgba(239, 68, 68, 0.18);">
        <div style="display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
          <div style="font-size: 32px; line-height: 1;">🚨</div>
          <div style="flex: 1; min-width: 260px;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <div style="font-weight: 900; font-size: 15px; color: #b91c1c; display: flex; align-items: center; gap: 8px;">
                <span>FORMAL SAFETY WARNING NOTICE: SPEED BREACH DETECTED</span>
                <span class="badge" style="background: #dc2626; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 7px;">Action Required</span>
              </div>
              <div style="font-size: 11.5px; color: #991b1b; font-weight: 700;">
                Management Fleet Telemetry Governance
              </div>
            </div>
            <div style="font-size: 12.5px; color: var(--ink); margin-top: 4px; line-height: 1.5;">
              You have received official warning notice(s) from management regarding vehicle speed policy breaches. Please review the incident details and acknowledge below.
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
              ${pendingSpeedWarnings.map(w => `
                <div style="padding: 12px 14px; background: var(--surface-card); border-radius: var(--radius-sm); border: 1px solid rgba(239, 68, 68, 0.35); box-shadow: var(--shadow-sm);">
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                    <div style="font-size: 13.5px; font-weight: 800; color: #dc2626;">
                      ${escapeHtml(w.warningNotice?.subject || 'Formal Speed Violation Notice')}
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; font-size: 11px; font-weight: 800;">
                        ${w.vehicleMode === 'Car' ? '🚗' : '🏍️'} ${w.speedKmH} km/h (Limit: ${w.thresholdKmH} km/h)
                      </span>
                      <span class="badge" style="background: rgba(185, 28, 28, 0.15); color: #991b1b; font-size: 11px; font-weight: 800;">
                        +${w.excessKmH} km/h Excess
                      </span>
                    </div>
                  </div>
                  <div style="font-size: 12.5px; color: var(--ink); margin-top: 6px; line-height: 1.5; white-space: pre-line; background: var(--surface-bg); padding: 8px 10px; border-radius: 4px; border-left: 3px solid #dc2626;">
                    ${escapeHtml(w.warningNotice?.message || `You were clocked at ${w.speedKmH} km/h in ${w.locationName || 'Bihar route'} exceeding your ${w.vehicleMode} threshold of ${w.thresholdKmH} km/h.`)}
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                    <div style="font-size: 11px; color: var(--muted);">
                      📍 <strong>${escapeHtml(w.locationName || 'Transit')}</strong> · 🕒 ${new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${new Date(w.timestamp).toLocaleDateString()} · Issued by: <strong>${escapeHtml(w.warningNotice?.adminName || 'Safety Admin')}</strong>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm btn-ack-speed-warning" data-breach-id="${w.id}" style="background: #047857; border-color: #065f46; font-size: 12px; font-weight: 800; padding: 6px 14px; box-shadow: 0 2px 6px rgba(4, 120, 87, 0.25);">
                      ✓ I Acknowledge & Comply
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- REAL-TIME MANAGER NOTIFICATION & QUIZ BANNER -->
    ${(!quizState?.completedAt || unreadNotifs.length > 0) ? `
      <div class="card" style="padding: 12px 18px; margin-bottom: 14px; background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(2, 132, 199, 0.08)); border: 1.5px solid rgba(124, 58, 237, 0.35); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px; animation: pulse-dot 2s infinite ease-in-out;">🔔</span>
          <div>
            <strong style="color: #7c3aed; font-size: 13.5px; font-family: var(--font-heading);">
              ${unreadNotifs.length > 0 ? escapeHtml(unreadNotifs[0].title) : 'Weekly Agronomy Assessment:'}
            </strong>
            <span style="font-size: 13px; color: var(--ink); margin-left: 6px;">
              ${unreadNotifs.length > 0 ? escapeHtml(unreadNotifs[0].message) : 'Knowledge quiz is due for this cycle. Complete now to claim your 10 Tech SOP points!'}
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="btn btn-primary btn-sm" id="btnBannerTakeQuiz" style="background: #7c3aed; border-color: #6d28d9; font-weight: 700; white-space: nowrap;">
            🎓 ${quizState?.completedAt ? 'Retest Assessment' : 'Take Quiz (10 Pts) →'}
          </button>
          ${unreadNotifs.length > 0 ? `
            <button type="button" class="btn btn-secondary btn-sm" id="btnDismissNotifs" style="font-size: 11px; padding: 4px 8px;">
              Dismiss ✓
            </button>
          ` : ''}
        </div>
      </div>
    ` : ''}

    <!-- REAL-TIME ASSIGNED SURVEY & CUSTOM AUDIT BANNER -->
    ${pendingForms.length > 0 ? `
      <div class="card" style="padding: 12px 18px; margin-bottom: 14px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.1), rgba(16, 185, 129, 0.08)); border: 1.5px solid rgba(2, 132, 199, 0.35); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px; animation: pulse-dot 2s infinite ease-in-out;">📋</span>
          <div>
            <strong style="color: #0284c7; font-size: 13.5px; font-family: var(--font-heading);">
              Targeted Field Survey Assigned:
            </strong>
            <span style="font-size: 13px; color: var(--ink); margin-left: 6px;">
              "${escapeHtml(pendingForms[0].title)}" is due for your station (${pendingForms.length} pending survey${pendingForms.length === 1 ? '' : 's'}).
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="btn btn-primary btn-sm" id="btnBannerFillForm" data-form-id="${escapeHtml(pendingForms[0].id)}" style="background: #0284c7; border-color: #0369a1; font-weight: 700; white-space: nowrap;">
            📝 Complete Survey Now →
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btnBannerViewAllForms" style="font-size: 11px; padding: 4px 8px; font-weight: 600;">
            View All (${assignedForms.length})
          </button>
        </div>
      </div>
    ` : ''}

    <!-- QUICK ACTIVITY ACTION BAR (ALWAYS VISIBLE & ACCESSIBLE) -->
    <div class="card" style="padding: 14px 18px; margin-bottom: 14px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(14, 165, 233, 0.06) 100%); border: 1px solid rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 22px;">⚡</span>
        <div>
          <strong style="font-family: var(--font-heading); font-size: 14.5px; font-weight: 800; color: var(--ink); letter-spacing: -0.01em;">
            Quick Log Activity:
          </strong>
          <span style="font-size: 12px; color: var(--muted); margin-left: 6px;">
            Demand generation, meetings & trials
          </span>
        </div>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="btn btn-primary btn-sm" id="btnQuickSmartBeat" style="font-weight: 800; background: linear-gradient(135deg, #059669 0%, #047857 100%); border-color: #065f46; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);">
          🗺️ Smart Beat (TSP)
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickTadaClaim" style="font-weight: 800; color: #d97706; border-color: rgba(245, 158, 11, 0.5); background: rgba(245, 158, 11, 0.08);">
          💰 TA/DA Mileage Claim
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="btnQuickAttendancePunch" style="font-weight: 800; background: ${todayAtt?.punchOut ? 'linear-gradient(135deg, #475569 0%, #334155 100%)' : todayAtt?.punchIn ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)'}; border-color: #1e3a8a; box-shadow: 0 2px 8px rgba(29, 78, 216, 0.3);">
          🕒 हाजिरी ${todayAtt?.punchOut ? '🏁 Shift Done' : todayAtt?.punchIn ? `🟢 Punched In (${todayAtt.punchIn})` : 'Punch'}
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickLeaveApply" style="font-weight: 700; color: #059669; border-color: rgba(5, 150, 105, 0.4);">
          🏖️ Apply Leave
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickTakeQuiz" style="font-weight: 700; color: #7c3aed; border-color: rgba(124, 58, 237, 0.4);">
          🎓 Agronomy Quiz ${quizState?.completedAt ? `(${quizState.score}/${quizState.total})` : '(🔴 Due)'}
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickAssignedForms" style="font-weight: 700; color: #0284c7; border-color: rgba(2, 132, 199, 0.4);">
          📝 Assigned Surveys ${pendingForms.length > 0 ? `(🔴 ${pendingForms.length} Due)` : `(${assignedForms.length})`}
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickStockLedger" style="font-weight: 700; color: #16a34a; border-color: rgba(22, 163, 74, 0.4);">
          📦 Stock Ledger (${repStockSummary.totalBalanceUnits} In Hand)
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickSubmitEod" style="font-weight: 700; color: #ea580c; border-color: rgba(234, 88, 12, 0.4);">
          ⏱️ Daily EOD ${eodReport?.submittedAt ? '(✅)' : '(⚠️)'}
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="btnQuickLogFarmerMeeting" style="font-weight: 700;">
          🌾 + Log Meeting
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickAddDemoPlot" style="font-weight: 700; color: var(--primary); border-color: rgba(16, 185, 129, 0.4);">
          🌱 + Demo Plot
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickAddFarmerLead" style="font-weight: 700; color: var(--accent); border-color: rgba(14, 165, 233, 0.4);">
          💡 + Demand Lead
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnQuickAddCompetitor" style="font-weight: 700; color: #8b5cf6; border-color: rgba(139, 92, 246, 0.4);">
          🔍 + Intel
        </button>
      </div>
    </div>

    <!-- 10-STEP DAILY OPERATING RHYTHM (SOP Section 9) -->
    <div class="card" style="padding: 14px 18px; margin-bottom: 16px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">☀️</span>
          <div>
            <strong style="font-size: 14px; font-family: var(--font-heading); font-weight: 800; color: var(--ink);">
              Daily Operating Rhythm (10 Disciplines)
            </strong>
            <span style="font-size: 11.5px; color: var(--muted); margin-left: 6px;">
              SOP Section 9 · Daily Field Standard
            </span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="badge" style="background: ${completedDisciplines >= 8 ? 'var(--primary-subtle)' : completedDisciplines >= 5 ? 'var(--accent-subtle)' : 'var(--warn-subtle)'}; color: ${completedDisciplines >= 8 ? 'var(--primary)' : completedDisciplines >= 5 ? 'var(--accent)' : 'var(--warn)'}; font-weight: 800; font-size: 11.5px;">
            ${completedDisciplines}/10 Disciplines (${rhythmPct}%)
          </span>
          <button type="button" class="btn btn-secondary btn-sm" id="btnToggleDailyRhythm" style="font-size: 11px; padding: 4px 10px;">
            ${showFullDailyRhythm ? '▲ Collapse' : '▼ Inspect All 10 Steps'}
          </button>
        </div>
      </div>

      <!-- Rhythm Progress Bar -->
      <div style="height: 6px; background: var(--surface-alt); border-radius: var(--radius-pill); overflow: hidden; margin-bottom: 12px;">
        <div style="height: 100%; width: ${rhythmPct}%; background: ${rhythmPct >= 80 ? 'linear-gradient(90deg, #10b981, #059669)' : rhythmPct >= 50 ? 'linear-gradient(90deg, #0ea5e9, #0284c7)' : 'linear-gradient(90deg, #f59e0b, #d97706)'}; transition: width 0.4s ease; border-radius: var(--radius-pill);"></div>
      </div>

      <!-- Quick Action Chips (Always Visible) -->
      <div class="rhythm-chips-grid">
        <button type="button" class="rhythm-chip" id="btnCyclePlan">
          <span class="rhythm-chip-icon">📋</span>
          <span class="rhythm-chip-body">
            <span class="rhythm-chip-label">PJP Stops</span>
            <span class="rhythm-chip-val">${todayTourRows.length} Stops</span>
          </span>
        </button>
        <button type="button" class="rhythm-chip" id="btnCycleLeads">
          <span class="rhythm-chip-icon">🌾</span>
          <span class="rhythm-chip-body">
            <span class="rhythm-chip-label">Farmer Leads</span>
            <span class="rhythm-chip-val">${repLeads.length} Logged</span>
          </span>
        </button>
        <button type="button" class="rhythm-chip" id="btnCycleFarmer">
          <span class="rhythm-chip-icon">👥</span>
          <span class="rhythm-chip-body">
            <span class="rhythm-chip-label">Meetings/Demo</span>
            <span class="rhythm-chip-val">${repMeetings.length + repDemos.length} Held</span>
          </span>
        </button>
        <button type="button" class="rhythm-chip" id="btnCycleRetailer">
          <span class="rhythm-chip-icon">🏬</span>
          <span class="rhythm-chip-body">
            <span class="rhythm-chip-label">Counters</span>
            <span class="rhythm-chip-val">${todayVerifiedCount}/${todayTourRows.length || totalMyRetailers}</span>
          </span>
        </button>
        <button type="button" class="rhythm-chip ${eodReport ? 'rhythm-chip-done' : 'rhythm-chip-primary'}" id="btnCycleEod">
          <span class="rhythm-chip-icon">⏱️</span>
          <span class="rhythm-chip-body">
            <span class="rhythm-chip-label">EOD Report</span>
            <span class="rhythm-chip-val">${eodReport ? '✓ Done' : 'Submit (+5)'}</span>
          </span>
        </button>
      </div>

      <!-- Full 10 Steps Interactive Checklist (Collapsible) -->
      ${showFullDailyRhythm ? `
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--line); display: flex; flex-direction: column; gap: 8px;">
          ${dailySteps.map(s => `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; padding: 7px 12px; background: ${s.done ? 'var(--primary-subtle)' : 'var(--surface-alt)'}; border-radius: var(--radius-sm); border: 1px solid ${s.done ? 'rgba(16, 185, 129, 0.3)' : 'var(--line)'};">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">${s.done ? '✅' : '⏳'}</span>
                <span style="font-weight: 700; color: var(--ink);">Step ${s.num}: ${escapeHtml(s.title)}</span>
                <span style="color: var(--muted); font-size: 11px;">(${escapeHtml(s.detail)})</span>
              </div>
              <div>
                ${s.action === 'eod' ? `
                  <button type="button" class="btn btn-secondary btn-sm btn-rhythm-eod" style="padding: 3px 9px; font-size: 11px;">
                    ${s.done ? 'View EOD' : 'Submit EOD ➔'}
                  </button>
                ` : s.action === 'meeting' ? `
                  <button type="button" class="btn btn-primary btn-sm btn-rhythm-meeting" style="padding: 3px 9px; font-size: 11px;">
                    ${escapeHtml(s.btn)} ➔
                  </button>
                ` : s.action === 'lead' ? `
                  <button type="button" class="btn btn-secondary btn-sm btn-rhythm-lead" style="padding: 3px 9px; font-size: 11px; color: var(--accent); border-color: rgba(14, 165, 233, 0.4); font-weight: 700;">
                    ${escapeHtml(s.btn)} ➔
                  </button>
                ` : s.action === 'demo' ? `
                  <button type="button" class="btn btn-secondary btn-sm btn-rhythm-demo" style="padding: 3px 9px; font-size: 11px; color: var(--primary); border-color: rgba(16, 185, 129, 0.4); font-weight: 700;">
                    ${escapeHtml(s.btn)} ➔
                  </button>
                ` : s.action === 'intel' ? `
                  <button type="button" class="btn btn-secondary btn-sm btn-rhythm-intel" style="padding: 3px 9px; font-size: 11px; color: #8b5cf6; border-color: rgba(139, 92, 246, 0.4); font-weight: 700;">
                    ${escapeHtml(s.btn)} ➔
                  </button>
                ` : `
                  <button type="button" class="btn btn-secondary btn-sm btn-rhythm-jump" data-tab="${escapeHtml(s.tab)}" style="padding: 3px 9px; font-size: 11px;">
                    Open ${escapeHtml(s.btn)} ➔
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Sub-Navigation Tabs across all SOP Pillars -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 6px;">
      <button type="button" class="btn ${activeSubTab === 'nearby' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btnSubTabNearby" style="padding: 9px 16px; font-weight: 700; white-space: nowrap; border-radius: var(--radius-pill);">
        📍 Station Retailers (${totalMyRetailers})
      </button>
      <button type="button" class="btn ${activeSubTab === 'tour' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btnSubTabTour" style="padding: 9px 16px; font-weight: 700; white-space: nowrap; border-radius: var(--radius-pill);">
        📋 Today's Tour (${todayTourRows.length})
      </button>
      <button type="button" class="btn ${activeSubTab === 'followups' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btnSubTabFollowups" style="padding: 9px 16px; font-weight: 700; white-space: nowrap; border-radius: var(--radius-pill); position: relative;">
        📅 Due Follow-ups (${storage.getUpcomingFollowUps(repInfo.name).length})
        ${storage.getUpcomingFollowUps(repInfo.name).some(f => f.status === 'overdue' || f.status === 'today') ? `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--danger); margin-left: 4px;"></span>` : ''}
      </button>
      <button type="button" class="btn ${activeSubTab === 'leads' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btnSubTabLeads" style="padding: 9px 16px; font-weight: 700; white-space: nowrap; border-radius: var(--radius-pill);">
        🌾 Farmer Leads CRM (${repLeads.length})
      </button>
      <button type="button" class="btn ${activeSubTab === 'farmers' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btnSubTabFarmers" style="padding: 9px 16px; font-weight: 700; white-space: nowrap; border-radius: var(--radius-pill);">
        👥 Meetings & Demos (${repMeetings.length + repDemos.length})
      </button>
      <button type="button" class="btn ${activeSubTab === 'competitor' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="btnSubTabCompetitor" style="padding: 9px 16px; font-weight: 700; white-space: nowrap; border-radius: var(--radius-pill);">
        🔍 Competitor Intel (${repIntel.length})
      </button>
    </div>

    <!-- Subtab Body Content -->
    ${activeSubTab === 'followups' ? renderFollowUpsSubTabHtml(repInfo, storage.getUpcomingFollowUps(repInfo.name)) :
      activeSubTab === 'leads' ? renderFarmerLeadsSubTabHtml(repInfo, repLeads, myStationRows, leadStageFilter) :
      activeSubTab === 'farmers' ? renderFarmersSubTabHtml(repInfo, repMeetings, repDemos) : 
      activeSubTab === 'competitor' ? renderCompetitorSubTabHtml(repInfo, repIntel) : `
      ${activeSubTab === 'tour' ? `
        <!-- Tour Plan Summary KPI Card -->
        <div class="card" style="padding: 16px 20px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(21, 128, 61, 0.06)); border-color: rgba(2, 132, 199, 0.3);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">📅</span>
                <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700;">
                  Today's Field Journey Plan (PJP)
                </h3>
                <span class="badge badge-visited">${getTodayDateStr()}</span>
              </div>
              <p style="color: var(--muted); font-size: 12.5px; margin-top: 4px;">
                Professional Field Protocol: In-person visits and order bookings require Live GPS Check-In at the counter.
              </p>
            </div>

            <div style="display: flex; gap: 14px; text-align: center;">
              <div style="background: var(--surface); padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
                <div style="font-size: 18px; font-weight: 800; color: var(--accent);">${todayTourRows.length}</div>
                <div style="font-size: 11px; color: var(--muted); font-weight: 600;">Planned Stops</div>
              </div>
              <div style="background: var(--surface); padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
                <div style="font-size: 18px; font-weight: 800; color: var(--success);">${todayVerifiedCount}</div>
                <div style="font-size: 11px; color: var(--muted); font-weight: 600;">Live Verified</div>
              </div>
              <div style="background: var(--surface); padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
                <div style="font-size: 18px; font-weight: 800; color: var(--primary);">${tourCompletionPct}%</div>
                <div style="font-size: 11px; color: var(--muted); font-weight: 600;">Tour Done</div>
              </div>
            </div>
          </div>
        </div>
      ` : `
        <!-- Location Banner & GPS Detection -->
        <div class="card" style="padding: 16px 20px; background: linear-gradient(135deg, rgba(21, 128, 61, 0.08), rgba(2, 132, 199, 0.06)); border-color: rgba(34, 197, 94, 0.3);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: var(--radius-sm); background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: var(--shadow-glow);">
                📍
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <h2 style="font-family: var(--font-heading); font-size: 19px; font-weight: 700;">
                    ${userCoords?.isRealGps ? `GPS Located: ${escapeHtml(currentDetectedBlock?.block || repInfo.hq)} Area` : `${escapeHtml(currentDetectedBlock?.block || repInfo.hq)} Block (Station HQ)`}
                  </h2>
                  <span class="badge badge-visited">${escapeHtml(currentDetectedBlock?.district || repInfo.district)} District</span>
                  ${userCoords?.isRealGps 
                    ? `<span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700;">🟢 Live GPS Active (±${userCoords.accuracy || 20}m)</span>` 
                    : `<span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 700;">⚠️ Tap Refresh for Live GPS</span>`
                  }
                </div>
                <div style="color: var(--muted); font-size: 12.5px; margin-top: 2px;">
                  ${userCoords?.isRealGps 
                    ? `Live Device Location: ${userCoords.lat.toFixed(4)}°, ${userCoords.lng.toFixed(4)}° • Real-time distance calculated for all counters` 
                    : `Station HQ Default: ${repInfo.hq} (${repInfo.district}) • Tap "Refresh Location" or "Set GPS" to acquire device coordinates`}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-primary" id="btnTopRefresh">
                <span>🔄</span> Refresh Location
              </button>
              <button class="btn btn-secondary btn-sm" id="btnCustomCoords" title="Manually input GPS coordinates if browser location is unavailable">
                ⚙️ Set GPS
              </button>
              <select id="quickBlockSelect" style="padding: 7px 10px; font-size: 12.5px; font-weight: 600;">
                <option value="">Switch Block…</option>
                ${BIHAR_BLOCKS.map(b => `
                  <option value="${escapeHtml(b.block)}" ${safeLower(b.block) === dBlock ? 'selected' : ''}>
                    ${escapeHtml(b.block)} (${escapeHtml(b.district)})
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Scope Filter Pills -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--line);">
            <button type="button" class="filter-pill ${currentScope === 'all' ? 'active' : ''}" id="pillScopeAll" style="font-size: 12px; padding: 4px 12px;">
              🌐 All Station Counters (${totalMyRetailers})
            </button>
            <button type="button" class="filter-pill ${currentScope === 'block' ? 'active' : ''}" id="pillScopeBlock" style="font-size: 12px; padding: 4px 12px;">
              📍 In ${escapeHtml(currentDetectedBlock?.block || repInfo.hq)} Block (${inBlockCount})
            </button>
            <button type="button" class="filter-pill ${currentScope === 'district' ? 'active' : ''}" id="pillScopeDistrict" style="font-size: 12px; padding: 4px 12px;">
              🗺️ In ${escapeHtml(currentDetectedBlock?.district || repInfo.district)} District (${inDistrictCount})
            </button>
          </div>
        </div>
      `}

      <!-- Search Box with Clear Button & Add Action -->
      <div style="display: flex; gap: 8px; margin-top: 14px; align-items: center;">
        <div style="position: relative; flex: 1;">
          <input type="text" id="nearbySearchInput" 
                 placeholder="🔍 Search dealer, block, phone, notes..." 
                 value="${escapeHtml(currentSearch)}" 
                 style="width: 100%; font-size: 13.5px; padding: 9px 34px 9px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
          ${currentSearch ? `
            <button type="button" id="btnClearNearbySearch" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 15px; color: var(--muted); cursor: pointer; padding: 4px;" title="Clear search">✕</button>
          ` : ''}
        </div>
        
        <button class="btn btn-secondary btn-sm" id="btnNearbyAddDealer" style="padding: 9px 14px; font-weight: 700; white-space: nowrap;">
          + Add
        </button>
      </div>

      <!-- Retailers List Container -->
      <div id="nearbyRetailersList"></div>

      <!-- Pagination Controls -->
      ${totalDisplay > 0 ? `
        <div class="pagination card" style="margin-top: 14px; padding: 12px 16px;">
          <span style="font-weight: 600; color: var(--muted);">
            Showing ${startIdx + 1}–${Math.min(startIdx + nearbyPageSize, totalDisplay)} of ${totalDisplay} dealers
          </span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="btnNearbyPrev" ${nearbyPage <= 1 ? 'disabled' : ''}>
              ← Previous
            </button>
            <span style="font-size: 13px; font-weight: 700; padding: 0 4px;">
              Page ${nearbyPage} of ${totalPages}
            </span>
            <button class="btn btn-secondary btn-sm" id="btnNearbyNext" ${nearbyPage >= totalPages ? 'disabled' : ''}>
              Next →
            </button>
          </div>
        </div>
      ` : ''}
    `}
  `;

  // Bind KPI Scorecard & Header Actions
  document.getElementById('btnRepKpiScorecard')?.addEventListener('click', () => {
    openKpiScoreModal(kpiData);
  });

  document.getElementById('btnHeaderWeekly')?.addEventListener('click', () => {
    openWeeklyReviewModal(repInfo.name);
  });

  document.getElementById('btnHeaderSuccess')?.addEventListener('click', () => {
    openMgoSuccessModal();
  });

  document.getElementById('btnRepSwitchLogout')?.addEventListener('click', () => {
    auth.logoutRep();
    currentDetectedBlock = null;
    userCoords = null;
    nearbyPage = 1;
    currentSearch = '';
    activeSubTab = 'nearby';
    window.dispatchEvent(new CustomEvent('tracker:roleChanged'));
    showToast('Logged out from representative station.', '🔒');
    renderFieldView(container, storage.rows);
  });

  document.getElementById('btnToggleDailyRhythm')?.addEventListener('click', () => {
    showFullDailyRhythm = !showFullDailyRhythm;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  // Bind Notice and Quiz Banner Handlers
  document.getElementById('btnRepNotifications')?.addEventListener('click', () => {
    const notifs = storage.getAssistantNotifications(repInfo.name);
    if (notifs.length === 0) {
      showToast('No notices from management.', 'ℹ️');
      return;
    }
    const msgs = notifs.map((n, i) => `${i + 1}. [${n.title}]: ${n.message}`).join('\n\n');
    alert(`📢 Notices from Management:\n\n${msgs}`);
    storage.markAllNotificationsRead(repInfo.name);
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnBannerTakeQuiz')?.addEventListener('click', () => {
    storage.markAllNotificationsRead(repInfo.name);
    openAgronomyQuizModal(repInfo.name);
  });

  document.getElementById('btnBannerFillForm')?.addEventListener('click', (e) => {
    const formId = e.currentTarget.getAttribute('data-form-id');
    const form = assignedForms.find(f => f.id === formId) || pendingForms[0];
    if (form) {
      openFillDynamicFormModal(form, repInfo.name, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    }
  });

  document.getElementById('btnBannerViewAllForms')?.addEventListener('click', () => {
    openAssignedFormsListModal(repInfo.name, () => renderNearbyRetailersView(container, storage.rows, repInfo));
  });

  document.getElementById('btnDismissNotifs')?.addEventListener('click', () => {
    storage.markAllNotificationsRead(repInfo.name);
    showToast('Notices dismissed.', '✓');
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  // Bind Speed Violation Warning Acknowledgment Handlers
  container.querySelectorAll('.btn-ack-speed-warning').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const breachId = e.currentTarget.getAttribute('data-breach-id');
      if (breachId) {
        storage.acknowledgeSpeedWarning(breachId);
        showToast('Speed safety warning acknowledged. Safe driving commitment recorded.', '✅');
        renderNearbyRetailersView(container, storage.rows, repInfo);
      }
    });
  });

  // Bind Always-Accessible Quick Activity Action Bar buttons
  document.getElementById('btnQuickTakeQuiz')?.addEventListener('click', () => {
    storage.markAllNotificationsRead(repInfo.name);
    openAgronomyQuizModal(repInfo.name);
  });

  document.getElementById('btnQuickAssignedForms')?.addEventListener('click', () => {
    openAssignedFormsListModal(repInfo.name, () => renderNearbyRetailersView(container, storage.rows, repInfo));
  });

  // Bind Smart Tour Beat & TA/DA Claim modal actions
  const handleOpenSmartBeat = () => {
    openSmartTourBeatModal({ assistant: repInfo.name, initialTab: 'beat' });
  };
  const handleOpenTadaClaim = () => {
    openSmartTourBeatModal({ assistant: repInfo.name, initialTab: 'tada' });
  };
  document.getElementById('btnHeaderSmartBeat')?.addEventListener('click', handleOpenSmartBeat);
  document.getElementById('btnQuickSmartBeat')?.addEventListener('click', handleOpenSmartBeat);
  document.getElementById('btnHeaderTadaClaim')?.addEventListener('click', handleOpenTadaClaim);
  document.getElementById('btnQuickTadaClaim')?.addEventListener('click', handleOpenTadaClaim);

  // Attendance / Muster Roll modal
  const handleOpenAttendance = () => openAttendanceModal({ assistant: repInfo.name });
  document.getElementById('btnHeaderAttendance')?.addEventListener('click', handleOpenAttendance);
  document.getElementById('btnQuickAttendancePunch')?.addEventListener('click', handleOpenAttendance);
  document.getElementById('btnTrueinHeroPunch')?.addEventListener('click', handleOpenAttendance);

  // Hero console metric tiles
  document.getElementById('btnHeroKpiPill')?.addEventListener('click', () => {
    document.getElementById('btnRepKpiScorecard')?.click();
  });
  document.getElementById('btnHeroPjpPill')?.addEventListener('click', () => {
    activeSubTab = 'tour';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });
  document.getElementById('btnHeroOrderPill')?.addEventListener('click', () => {
    activeSubTab = 'nearby';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });
  document.getElementById('btnHeroLeadsPill')?.addEventListener('click', () => {
    activeSubTab = 'leads';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });
  document.getElementById('btnHeroFollowupsPill')?.addEventListener('click', () => {
    activeSubTab = 'followups';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  // Truein 6-Pillar Bento Grid Cards
  document.getElementById('bentoSmartBeat')?.addEventListener('click', handleOpenSmartBeat);
  document.getElementById('bentoCounters')?.addEventListener('click', () => {
    activeSubTab = 'nearby';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });
  document.getElementById('bentoFollowUps')?.addEventListener('click', () => {
    activeSubTab = 'followups';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });
  document.getElementById('bentoFarmerCrm')?.addEventListener('click', () => {
    activeSubTab = 'leads';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });
  document.getElementById('bentoMeetingsDemo')?.addEventListener('click', () => {
    activeSubTab = 'farmers';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });
  document.getElementById('bentoTadaClaim')?.addEventListener('click', handleOpenTadaClaim);

  // Leave Management modal
  const handleOpenLeave = () => openLeaveModal({ assistant: repInfo.name });
  document.getElementById('btnHeaderLeave')?.addEventListener('click', handleOpenLeave);
  document.getElementById('btnQuickLeaveApply')?.addEventListener('click', handleOpenLeave);

  const handleOpenRepLedger = () => {
    openRepStockLedgerModal(repInfo.name, () => renderNearbyRetailersView(container, storage.rows, repInfo));
  };
  document.getElementById('btnHeaderStockLedger')?.addEventListener('click', handleOpenRepLedger);
  document.getElementById('btnQuickStockLedger')?.addEventListener('click', handleOpenRepLedger);

  document.getElementById('btnQuickSubmitEod')?.addEventListener('click', () => {
    openEodClosingModal(repInfo.name);
  });

  document.getElementById('btnQuickLogFarmerMeeting')?.addEventListener('click', () => {
    openFarmerMeetingModal(repInfo, () => renderNearbyRetailersView(container, storage.rows, repInfo));
  });

  document.getElementById('btnQuickAddDemoPlot')?.addEventListener('click', () => {
    openDemoPlotModal(repInfo, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
  });

  document.getElementById('btnQuickAddFarmerLead')?.addEventListener('click', () => {
    openFarmerLeadModal(repInfo.name, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
  });

  document.getElementById('btnQuickAddCompetitor')?.addEventListener('click', () => {
    openCompetitorIntelModal(repInfo, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
  });

  // Daily rhythm quick chips
  document.getElementById('btnCyclePlan')?.addEventListener('click', () => {
    activeSubTab = 'tour';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnCycleLeads')?.addEventListener('click', () => {
    activeSubTab = 'leads';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnCycleFarmer')?.addEventListener('click', () => {
    activeSubTab = 'farmers';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnCycleRetailer')?.addEventListener('click', () => {
    activeSubTab = 'nearby';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnCycleEod')?.addEventListener('click', () => {
    openEodClosingModal(repInfo.name);
  });

  // Daily rhythm direct action handlers
  container.querySelectorAll('.btn-rhythm-meeting').forEach(btn => {
    btn.addEventListener('click', () => {
      openFarmerMeetingModal(repInfo, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    });
  });

  container.querySelectorAll('.btn-rhythm-lead').forEach(btn => {
    btn.addEventListener('click', () => {
      openFarmerLeadModal(repInfo.name, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    });
  });

  container.querySelectorAll('.btn-rhythm-demo').forEach(btn => {
    btn.addEventListener('click', () => {
      openDemoPlotModal(repInfo, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    });
  });

  container.querySelectorAll('.btn-rhythm-intel').forEach(btn => {
    btn.addEventListener('click', () => {
      openCompetitorIntelModal(repInfo, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    });
  });

  // Daily rhythm collapsible items jump buttons
  container.querySelectorAll('.btn-rhythm-jump').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        activeSubTab = tab;
        nearbyPage = 1;
        renderNearbyRetailersView(container, storage.rows, repInfo);
      }
    });
  });

  container.querySelectorAll('.btn-rhythm-eod').forEach(btn => {
    btn.addEventListener('click', () => {
      openEodClosingModal(repInfo.name);
    });
  });

  // Bind subtabs
  document.getElementById('btnSubTabNearby')?.addEventListener('click', () => {
    activeSubTab = 'nearby';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnSubTabTour')?.addEventListener('click', () => {
    activeSubTab = 'tour';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnSubTabFollowups')?.addEventListener('click', () => {
    activeSubTab = 'followups';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnSubTabLeads')?.addEventListener('click', () => {
    activeSubTab = 'leads';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnSubTabFarmers')?.addEventListener('click', () => {
    activeSubTab = 'farmers';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnSubTabCompetitor')?.addEventListener('click', () => {
    activeSubTab = 'competitor';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  // Bind Follow-up action buttons if on followups tab
  if (activeSubTab === 'followups') {
    container.querySelectorAll('.btn-open-followup-sheet').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) {
          openCounterBottomSheet(id, currentRep, repInfo, container);
        }
      });
    });
  }

  // Bind Farmer Leads actions if on leads tab
  if (activeSubTab === 'leads') {
    document.getElementById('btnRegisterFarmerLead')?.addEventListener('click', () => {
      openFarmerLeadModal(repInfo.name, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    });

    container.querySelectorAll('.filter-pill[data-stage]').forEach(btn => {
      btn.addEventListener('click', () => {
        leadStageFilter = btn.getAttribute('data-stage');
        renderNearbyRetailersView(container, storage.rows, repInfo);
      });
    });

    container.querySelectorAll('.btn-advance-lead').forEach(btn => {
      btn.addEventListener('click', () => {
        const leadId = btn.getAttribute('data-id');
        const nextStage = btn.getAttribute('data-next');
        if (leadId && nextStage) {
          storage.advanceFarmerLeadStage(leadId, nextStage);
          showToast(`Advanced farmer lead to "${nextStage}" stage!`, '🌾');
          renderNearbyRetailersView(container, storage.rows, repInfo);
        }
      });
    });

    container.querySelectorAll('.btn-edit-lead').forEach(btn => {
      btn.addEventListener('click', () => {
        const leadId = btn.getAttribute('data-id');
        const lead = repLeads.find(l => l.id === leadId);
        if (lead) {
          openFarmerLeadModal(repInfo.name, lead, () => renderNearbyRetailersView(container, storage.rows, repInfo));
        }
      });
    });
  }

  // Bind Farmer & Demo actions if on farmers tab
  if (activeSubTab === 'farmers') {
    document.getElementById('btnLogFarmerMeeting')?.addEventListener('click', () => {
      openFarmerMeetingModal(repInfo, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    });

    document.getElementById('btnAddDemoPlot')?.addEventListener('click', () => {
      openDemoPlotModal(repInfo, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    });

    container.querySelectorAll('.btn-update-demo').forEach(btn => {
      btn.addEventListener('click', () => {
        const plotId = btn.getAttribute('data-id');
        const plot = repDemos.find(d => d.id === plotId);
        if (plot) {
          openDemoPlotModal(repInfo, plot, () => renderNearbyRetailersView(container, storage.rows, repInfo));
        }
      });
    });
  }

  // Bind Competitor action if on competitor tab
  if (activeSubTab === 'competitor') {
    document.getElementById('btnLogCompetitorIntel')?.addEventListener('click', () => {
      openCompetitorIntelModal(repInfo, null, () => renderNearbyRetailersView(container, storage.rows, repInfo));
    });
  }


  document.getElementById('btnTopRefresh')?.addEventListener('click', () => handleRefreshAction(container));

  document.getElementById('btnCustomCoords')?.addEventListener('click', () => {
    const currentLat = (userCoords && userCoords.isRealGps) ? userCoords.lat : 25.564;
    const currentLng = (userCoords && userCoords.isRealGps) ? userCoords.lng : 84.868;
    const input = prompt(
      'Enter your current GPS coordinates (Latitude, Longitude):\n• Example: 25.5941, 85.1376 (Patna)\n• Example: 24.7914, 85.0002 (Gaya, ~100km away)',
      `${userCoords?.lat ? userCoords.lat.toFixed(4) : currentLat}, ${userCoords?.lng ? userCoords.lng.toFixed(4) : currentLng}`
    );
    if (input) {
      const parts = input.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const [lat, lng] = parts;
        userCoords = { lat, lng, isRealGps: true, accuracy: 15 };
        const closest = findClosestBlocks(lat, lng);
        currentDetectedBlock = closest[0] || BIHAR_BLOCKS[0];
        const distKm = calculateDistanceKm(lat, lng, currentDetectedBlock.lat, currentDetectedBlock.lng);
        showToast(`📍 Set GPS location: ${lat.toFixed(4)}°, ${lng.toFixed(4)}° (${distKm} km to ${currentDetectedBlock.block})`, '📍');
        renderNearbyRetailersView(container, storage.rows, repInfo);
      } else {
        alert('Invalid coordinates format. Please enter as "latitude, longitude" (e.g. 24.7914, 85.0002).');
      }
    }
  });

  document.getElementById('quickBlockSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      const match = BIHAR_BLOCKS.find(b => safeLower(b.block) === safeLower(val));
      if (match) {
        currentDetectedBlock = match;
        userCoords = { lat: match.lat, lng: match.lng, isRealGps: false };
        nearbyPage = 1;
        showToast(`Switched to ${match.block} Block`, '📍');
        renderNearbyRetailersView(container, storage.rows, repInfo);
      }
    }
  });

  document.getElementById('pillScopeAll')?.addEventListener('click', () => {
    currentScope = 'all';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('pillScopeBlock')?.addEventListener('click', () => {
    currentScope = 'block';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('pillScopeDistrict')?.addEventListener('click', () => {
    currentScope = 'district';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  const searchInput = document.getElementById('nearbySearchInput');
  searchInput?.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnClearNearbySearch')?.addEventListener('click', () => {
    currentSearch = '';
    nearbyPage = 1;
    renderNearbyRetailersView(container, storage.rows, repInfo);
  });

  document.getElementById('btnNearbyAddDealer')?.addEventListener('click', () => {
    openRetailerModal({
      block: currentDetectedBlock?.block || repInfo.hq,
      district: currentDetectedBlock?.district || repInfo.district,
      hq: repInfo.hq,
      assistant: repInfo.name
    });
  });

  document.getElementById('btnNearbyPrev')?.addEventListener('click', () => {
    if (nearbyPage > 1) {
      nearbyPage--;
      renderNearbyRetailersView(container, storage.rows, repInfo);
    }
  });

  document.getElementById('btnNearbyNext')?.addEventListener('click', () => {
    if (nearbyPage < totalPages) {
      nearbyPage++;
      renderNearbyRetailersView(container, storage.rows, repInfo);
    }
  });

  renderCardsList(pageRows, currentRep, repInfo, container);
}

function renderCardsList(rows, currentRep, repInfo, mainContainer) {
  const container = document.getElementById('nearbyRetailersList');
  if (!container) return;

  if (rows.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 44px 20px; color: var(--muted);">
        <div style="font-size: 36px; margin-bottom: 8px;">🌾</div>
        <p style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">
          ${activeSubTab === 'tour' ? "No stops planned in today's tour yet" : "No station retailers found matching criteria"}
        </p>
        <p style="font-size: 13px;">
          ${activeSubTab === 'tour' 
            ? "Switch to 'Station Retailers' tab and click '+ Add to Tour' to build your journey plan." 
            : "Try clearing search keywords or tap Refresh to detect another location."}
        </p>
      </div>`;
    return;
  }

  const tourIds = getTodayTourIds(currentRep);
  const todayStr = getTodayDateStr();

  container.innerHTML = rows.map((r, idx) => {
    const cleanPhone = (r.mobile || '').replace(/\D/g, '');
    const waText = encodeURIComponent(`Namaste ${r.retailer}, this is regarding your seed and crop protection inventory in ${r.block || ''}.`);
    const waUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${waText}` : '#';
    const telUrl = cleanPhone ? `tel:${cleanPhone}` : '#';
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((r.retailer || '') + ' ' + (r.block || '') + ' ' + (r.district || '') + ' Bihar')}`;
    
    let distDisplay = '';
    if (userCoords && userCoords.isRealGps) {
      if (r.calculatedDistKm < 0.2) {
        distDisplay = '< 200m away (At Counter)';
      } else {
        distDisplay = `${r.calculatedDistKm} km away`;
      }
    } else {
      distDisplay = r.radius ? `~${r.radius} (HQ est.)` : `In ${r.block || 'Territory'}`;
    }

    const inTour = tourIds.has(r.id);
    const isLiveVerified = Boolean(r.verifiedVisit && r.checkInDate === todayStr);

    const retailerInitials = (r.retailer || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'RT';
    const avatarGradients = [
      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)'
    ];
    const gradIndex = Math.abs(retailerInitials.charCodeAt(0) + (retailerInitials.charCodeAt(1) || 0)) % avatarGradients.length;
    const avatarGrad = avatarGradients[gradIndex];

    return `
      <div class="truein-counter-card mobile-counter-card status-${safeLower(r.status || 'pending')}" id="card_${r.id}">
        <!-- Top Row with Dealer Avatar & Details -->
        <div style="display: flex; align-items: flex-start; gap: 14px;">
          <!-- Truein Dealer Initials Avatar -->
          <div class="truein-dealer-avatar" style="background: ${avatarGrad};">
            ${escapeHtml(retailerInitials)}
          </div>

          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                ${activeSubTab === 'tour' ? `<span class="badge" style="background: var(--ink); color: #fff; font-weight: 800; font-size: 10px;">Stop #${idx + 1}</span>` : ''}
                <span class="badge ${r.isExactBlock ? 'badge-visited' : 'badge-called'}" style="font-size: 10px; font-weight: 700;">
                  📍 ${distDisplay}
                </span>
                <span class="badge badge-${safeLower(r.status || 'pending')}" style="font-size: 10px; font-weight: 700;">
                  ${escapeHtml(r.status || 'Pending')}
                </span>
              </div>

              <!-- Quick Action Circles -->
              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                ${cleanPhone ? `
                  <a href="${telUrl}" class="action-circle-btn btn-call" title="Call ${escapeHtml(r.retailer)}">📞</a>
                  <a href="${waUrl}" target="_blank" rel="noopener" class="action-circle-btn btn-wa" title="WhatsApp Message">💬</a>
                ` : ''}
                <a href="${mapUrl}" target="_blank" rel="noopener" class="action-circle-btn btn-directions" title="Navigate on Google Maps">🧭</a>
                <button type="button" class="action-circle-btn btn-star ${inTour ? 'in-tour' : ''} btn-toggle-tour" data-id="${r.id}" title="${inTour ? 'In Today\'s Tour' : 'Add to Tour'}">
                  ${inTour ? '★' : '☆'}
                </button>
              </div>
            </div>

            <div class="retailer-name" style="font-size: 16px; font-weight: 800; color: var(--ink); letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(r.retailer)}
            </div>

            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-top: 3px;">
              <span>📍 ${escapeHtml(r.block || 'N/A')}, ${escapeHtml(r.district || 'Bihar')}</span>
              <span class="badge" style="background: rgba(0,0,0,0.04); font-size: 10.5px; border: 1px solid var(--line);">
                🕒 Last Visit: <strong>${escapeHtml(r.last_visit_date || r.checkInDate || 'Never')}</strong>
              </span>
              ${r.follow_up_date ? `
                <span class="badge ${r.follow_up_date < todayStr ? 'badge-danger' : r.follow_up_date === todayStr ? 'badge-visited' : 'badge-called'}" style="font-size: 10.5px; font-weight: 700;">
                  📅 Follow-up: ${escapeHtml(r.follow_up_date)}
                </span>
              ` : ''}
              ${r.total_orders_value ? `
                <span class="badge" style="background: rgba(34,197,94,0.12); color: var(--success); font-weight: 700; font-size: 10.5px;">
                  📦 ₹${Number(r.total_orders_value).toLocaleString('en-IN')} Booked
                </span>
              ` : ''}
              ${r.potentialFor ? `<span class="badge" style="background: var(--surface-alt); color: var(--primary); font-size: 10.5px; padding: 2px 7px; border: 1px solid var(--line);">🌱 ${escapeHtml(r.potentialFor)}</span>` : ''}
              ${r.potentialSell ? `<span class="badge" style="background: var(--surface-alt); color: var(--ink); font-size: 10.5px; padding: 2px 7px; border: 1px solid var(--line);">💰 ₹${escapeHtml(r.potentialSell)}</span>` : ''}
            </div>

            ${r.notes ? `
              <div style="font-size: 12px; color: var(--ink-secondary); margin-top: 6px; padding: 7px 12px; background: var(--surface-alt); border-radius: var(--radius-sm); border-left: 3px solid var(--primary); font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 95%;">
                💬 "${escapeHtml(r.notes)}"
              </div>
            ` : ''}
          </div>
        </div>

        <!-- GPS Verification Status Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; padding: 8px 12px; border-radius: var(--radius-sm); background: ${isLiveVerified ? 'var(--primary-subtle)' : 'var(--surface-alt)'}; font-size: 12px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${isLiveVerified ? `
              <span style="color: var(--primary); font-weight: 800;">✅ GPS Verified Counter</span>
              <span style="color: var(--muted); font-size: 11.5px;">at ${escapeHtml(r.checkInTime || '')} (${r.checkInDistKm !== undefined ? r.checkInDistKm + 'km' : 'Live'})</span>
            ` : `
              <span style="color: var(--warn); font-weight: 700;">⚠️ Check-In Pending</span>
              <span style="color: var(--muted); font-size: 11.5px;">In-person GPS verification required</span>
            `}
          </div>
          ${isLiveVerified && r.checkInMapUrl ? `
            <a href="${r.checkInMapUrl}" target="_blank" rel="noopener" style="font-size: 11.5px; color: var(--accent); font-weight: 700; text-decoration: none;">View Map ↗</a>
          ` : ''}
        </div>

        <!-- Card Action Strip -->
        <div class="card-bottom-actions">
          <button type="button" class="btn btn-sm ${isLiveVerified ? 'btn-secondary' : 'btn-primary'} btn-live-checkin btn-card-checkin" data-id="${r.id}">
            ${isLiveVerified ? '🔄 Re-Check In' : '📍 Live GPS Check-In'}
          </button>
          <button type="button" class="btn btn-sm btn-card-details btn-open-sheet" data-id="${r.id}">
            ✏️ Log Details →
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 1. Tour Plan Toggle Button Handlers
  container.querySelectorAll('.btn-toggle-tour').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const set = getTodayTourIds(currentRep);
      if (set.has(id)) {
        set.delete(id);
        showToast('Removed retailer from today\'s tour plan', '📋');
      } else {
        set.add(id);
        showToast('Added retailer to today\'s tour plan', '📅');
      }
      saveTodayTourIds(currentRep, set);
      updateTourNavBadge();
      renderNearbyRetailersView(mainContainer, storage.rows, repInfo);
    });
  });

  // 2. Live GPS Check-In Button Handlers
  container.querySelectorAll('.btn-live-checkin').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      await executeLiveCheckIn(id, btn, currentRep, repInfo, mainContainer);
    });
  });

  // 3. Open Bottom Sheet Handlers
  container.querySelectorAll('.btn-open-sheet').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openCounterBottomSheet(id, currentRep, repInfo, mainContainer);
    });
  });
}

async function executeLiveCheckIn(retailerId, btn, currentRep, repInfo, mainContainer) {
  const retailer = storage.rows.find(row => row.id === retailerId);
  if (!retailer) return;

  if (btn) {
    btn.textContent = '📍 Verifying GPS…';
    btn.disabled = true;
  }

  try {
    const loc = await detectBrowserLocation({ enableHighAccuracy: true, timeout: 8000 });
    let lat = null;
    let lng = null;
    let accuracy = null;
    let dist = 0.5;

    const rBlock = safeLower(retailer.block);
    const blockMeta = BIHAR_BLOCKS.find(b => safeLower(b.block) === rBlock);

    if (loc.success) {
      lat = loc.lat;
      lng = loc.lng;
      accuracy = loc.accuracy || 15;
      userCoords = { lat, lng, isRealGps: true, accuracy };
      if (blockMeta) {
        dist = calculateDistanceKm(lat, lng, blockMeta.lat, blockMeta.lng);
      }
    } else if (userCoords && userCoords.isRealGps) {
      lat = userCoords.lat;
      lng = userCoords.lng;
      accuracy = userCoords.accuracy || 30;
      if (blockMeta) {
        dist = calculateDistanceKm(lat, lng, blockMeta.lat, blockMeta.lng);
      }
    } else {
      // ANTI-FRAUD HARDENING: Do not allow centroid spoofing!
      showToast(`Physical Check-In Denied: Real-time GPS lock is required (${loc.error || 'No GPS fix'}). Please enable GPS location services.`, '❌');
      return null;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const todayStr = getTodayDateStr();
    const mapUrl = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

    const updated = {
      ...retailer,
      verifiedVisit: true,
      checkInDate: todayStr,
      checkInTime: timeStr,
      checkInTimestamp: Date.now(),
      checkInCoords: { lat, lng, accuracy },
      checkInDistKm: dist,
      checkInRep: currentRep,
      checkInMapUrl: mapUrl,
      last_visit_date: todayStr,
      last_visit_time: timeStr
    };

    await storage.saveRow(updated);

    // Record entry in central check-in audit log for Admin Reports
    storage.saveCheckInLog({
      id: 'chk_' + retailer.id + '_' + Date.now(),
      retailerId: retailer.id,
      retailer: retailer.retailer,
      mobile: retailer.mobile || '',
      block: retailer.block,
      district: retailer.district,
      rep: currentRep,
      date: todayStr,
      time: timeStr,
      timestamp: Date.now(),
      lat,
      lng,
      accuracy,
      distKm: dist,
      mapUrl,
      status: retailer.status || 'Visited',
      notes: retailer.notes || '',
      shop_photo_data_url: currentShopPhotoDataUrl || null
    });

    showToast(`✅ Live GPS Verified for "${retailer.retailer}" (${lat.toFixed(4)}°, ${lng.toFixed(4)}° · ±${accuracy}m)!`, '📍');
    if (mainContainer) {
      renderNearbyRetailersView(mainContainer, storage.rows, repInfo);
    }
    return updated;
  } catch (err) {
    console.error('Check-in error:', err);
    showToast('Check-in failed: ' + err.message, '❌');
    return null;
  } finally {
    if (btn) {
      btn.textContent = '📍 Live GPS Check-In';
      btn.disabled = false;
    }
  }
}

// ========================================================
// NATIVE MOBILE BOTTOM SHEET DRAWER CONTROLLER
// ========================================================
let activeSheetRetailerId = null;
let sheetInitialized = false;
let currentShopPhotoDataUrl = null;

function initCounterBottomSheet(mainContainer, repInfo, currentRep) {
  if (sheetInitialized) return;
  sheetInitialized = true;

  const sheet = document.getElementById('counterBottomSheet');
  const closeBtn = document.getElementById('btnCloseSheet');
  const saveBtn = document.getElementById('btnSaveSheet');

  closeBtn?.addEventListener('click', closeCounterBottomSheet);
  sheet?.addEventListener('click', (e) => {
    if (e.target === sheet) closeCounterBottomSheet();
  });

  // Photo Capture & Preview Handlers
  const photoInput = document.getElementById('sheetShopPhotoInput');
  const snapBtn = document.getElementById('btnSnapShopPhoto');
  const previewWrapper = document.getElementById('sheetPhotoPreviewWrapper');
  const previewImg = document.getElementById('sheetShopPhotoPreview');
  const removeBtn = document.getElementById('btnRemoveShopPhoto');

  snapBtn?.addEventListener('click', () => photoInput?.click());

  photoInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentShopPhotoDataUrl = ev.target.result;
      if (previewImg) previewImg.src = currentShopPhotoDataUrl;
      if (previewWrapper) previewWrapper.style.display = 'inline-flex';
      showToast('Storefront proof photo captured!', '📸');
    };
    reader.readAsDataURL(file);
  });

  removeBtn?.addEventListener('click', () => {
    currentShopPhotoDataUrl = null;
    if (photoInput) photoInput.value = '';
    if (previewWrapper) previewWrapper.style.display = 'none';
    if (previewImg) previewImg.src = '';
  });

  // Order Value Auto-Calculation
  const qtyInput = document.getElementById('sheetOrderQty');
  const rateInput = document.getElementById('sheetOrderRate');
  const totalDisplay = document.getElementById('sheetOrderTotalValue');
  const updateOrderTotal = () => {
    const q = Number(qtyInput?.value) || 0;
    const r = Number(rateInput?.value) || 0;
    const total = q * r;
    if (totalDisplay) totalDisplay.textContent = `₹${total.toLocaleString('en-IN')}`;
  };
  qtyInput?.addEventListener('input', updateOrderTotal);
  rateInput?.addEventListener('input', updateOrderTotal);

  // Note preset buttons
  document.querySelectorAll('#sheetNotePresets .touch-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = chip.getAttribute('data-preset');
      const notesEl = document.getElementById('sheetNotesInput');
      if (notesEl && preset) {
        notesEl.value = notesEl.value ? `${notesEl.value.trim()} • ${preset}` : preset;
        showToast(`Added: "${preset}"`, '📝');
      }
    });
  });

  // Save handler with Physical Visit Protection & Commercial Pipeline
  saveBtn?.addEventListener('click', async () => {
    if (!activeSheetRetailerId) return;
    const r = storage.rows.find(row => row.id === activeSheetRetailerId);
    if (!r) return;

    const selectedStatusChip = document.querySelector('#sheetStatusChips .touch-chip.selected');
    const status = selectedStatusChip ? selectedStatusChip.getAttribute('data-val') : (r.status || 'Pending');

    const selectedCategoryChip = document.querySelector('#sheetCategoryChips .touch-chip.selected');
    const potentialFor = selectedCategoryChip ? selectedCategoryChip.getAttribute('data-val') : (r.potentialFor || '');

    const selectedSellChip = document.querySelector('#sheetSellChips .touch-chip.selected');
    const potentialSell = selectedSellChip ? selectedSellChip.getAttribute('data-val') : (r.potentialSell || '');

    const mobile = (document.getElementById('sheetMobileInput')?.value || '').trim();
    const notes = (document.getElementById('sheetNotesInput')?.value || '').trim();

    // Guard: If marking as Visited or Closed, rep MUST have verified live GPS today
    const todayStr = getTodayDateStr();
    const isVerifiedToday = Boolean(r.verifiedVisit && r.checkInDate === todayStr);

    if ((status === 'Visited' || status === 'Closed') && !isVerifiedToday) {
      alert(
        `🔒 Physical Visit Verification Required!\n\n` +
        `Professional Field Protocol:\n` +
        `You cannot record an in-person visit or booked order for "${r.retailer}" without physical presence.\n\n` +
        `Please tap "📍 Check In Now" at the top of this sheet to capture your live GPS location.`
      );
      return;
    }

    saveBtn.textContent = 'Saving…';
    saveBtn.disabled = true;

    try {
      // 1. Process Sales Order Booking (if entered)
      const orderSku = document.getElementById('sheetOrderSku')?.value || '';
      const orderQty = Number(document.getElementById('sheetOrderQty')?.value) || 0;
      const orderRate = Number(document.getElementById('sheetOrderRate')?.value) || 0;
      const orderPayment = document.getElementById('sheetOrderPayment')?.value || 'Cash_on_Delivery';
      const totalOrderVal = orderQty * orderRate;

      if (orderSku && orderQty > 0) {
        storage.saveOrder({
          retailer_id: r.id,
          retailer_name: r.retailer,
          assistant: currentRep,
          order_date: todayStr,
          order_time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          product_sku: orderSku,
          quantity_bags: orderQty,
          unit_price: orderRate,
          total_order_value: totalOrderVal,
          payment_terms: orderPayment
        });
        showToast(`Booked order: ${orderQty} bags of ${orderSku} (₹${totalOrderVal})`, '📦');
      }

      // 2. Process Channel Stock & Liquidation Audit (if entered)
      const stockCo = document.getElementById('sheetStockCompany')?.value;
      const stockComp = document.getElementById('sheetStockCompetitor')?.value;
      const stockOfftake = document.getElementById('sheetStockOfftake')?.value;
      if ((stockCo && stockCo !== '') || (stockComp && stockComp !== '')) {
        storage.saveDealerStock({
          retailer_id: r.id,
          retailer_name: r.retailer,
          assistant: currentRep,
          audit_date: todayStr,
          company_stock_bags: Number(stockCo) || 0,
          competitor_stock_bags: Number(stockComp) || 0,
          weekly_offtake_pace: stockOfftake || 'Moderate'
        });
      }

      // 3. Process Scheduled Follow-Up Date
      const followUpDate = document.getElementById('sheetFollowUpDate')?.value || '';
      const followUpReason = document.getElementById('sheetFollowUpReason')?.value || '';

      // 4. Save Storefront Photo to IndexedDB
      if (currentShopPhotoDataUrl) {
        await idbStorage.saveMedia(r.id, 'shop_photo', currentShopPhotoDataUrl, {
          retailer: r.retailer,
          date: todayStr
        });
      }

      const updated = {
        ...r,
        mobile,
        status,
        potentialFor,
        potentialSell,
        notes,
        visitVerified: isVerifiedToday,
        last_visit_date: isVerifiedToday ? todayStr : (r.last_visit_date || null),
        follow_up_date: followUpDate || r.follow_up_date || null,
        follow_up_notes: followUpReason || r.follow_up_notes || '',
        total_orders_value: totalOrderVal > 0 ? ((Number(r.total_orders_value) || 0) + totalOrderVal) : (r.total_orders_value || 0)
      };

      await storage.saveRow(updated);
      showToast(`Updated "${r.retailer}"`, '✅');
      closeCounterBottomSheet();
      if (mainContainer) {
        renderNearbyRetailersView(mainContainer, storage.rows, repInfo);
      }
    } catch (err) {
      showToast(err.message, '❌');
    } finally {
      saveBtn.textContent = '💾 Save Counter Details';
      saveBtn.disabled = false;
    }
  });
}

export function openCounterBottomSheet(retailerId, currentRep, repInfo, mainContainer) {
  initCounterBottomSheet(mainContainer, repInfo, currentRep);
  activeSheetRetailerId = retailerId;
  currentShopPhotoDataUrl = null;

  const sheet = document.getElementById('counterBottomSheet');
  if (!sheet) return;

  const r = storage.rows.find(row => row.id === retailerId);
  if (!r) return;

  const todayStr = getTodayDateStr();
  const isLiveVerified = Boolean(r.verifiedVisit && r.checkInDate === todayStr);

  // Set Title & Subtitle
  const nameEl = document.getElementById('sheetRetailerName');
  const subEl = document.getElementById('sheetRetailerSub');
  if (nameEl) nameEl.textContent = r.retailer;
  if (subEl) subEl.textContent = `${r.block || 'N/A'}, ${r.district || 'Bihar'} · Rep: ${r.assistant || currentRep}`;

  // Reset Photo Upload & Check IndexedDB for existing photo
  const previewWrapper = document.getElementById('sheetPhotoPreviewWrapper');
  const previewImg = document.getElementById('sheetShopPhotoPreview');
  const photoInput = document.getElementById('sheetShopPhotoInput');
  if (photoInput) photoInput.value = '';
  if (previewWrapper) previewWrapper.style.display = 'none';
  if (previewImg) previewImg.src = '';

  idbStorage.getMedia(r.id).then(media => {
    if (media && media.dataUrl) {
      if (previewImg) previewImg.src = media.dataUrl;
      if (previewWrapper) previewWrapper.style.display = 'inline-flex';
    }
  }).catch(() => {});

  // Reset & Populate Order Inputs
  const skuSelect = document.getElementById('sheetOrderSku');
  const qtyInput = document.getElementById('sheetOrderQty');
  const rateInput = document.getElementById('sheetOrderRate');
  const totalDisplay = document.getElementById('sheetOrderTotalValue');
  if (skuSelect) skuSelect.value = '';
  if (qtyInput) qtyInput.value = '';
  if (rateInput) rateInput.value = '';
  if (totalDisplay) totalDisplay.textContent = '₹0';

  // Reset Stock Inputs
  const stockCo = document.getElementById('sheetStockCompany');
  const stockComp = document.getElementById('sheetStockCompetitor');
  const stockOfftake = document.getElementById('sheetStockOfftake');
  if (stockCo) stockCo.value = '';
  if (stockComp) stockComp.value = '';
  if (stockOfftake) stockOfftake.value = 'Moderate';

  // Populate Follow-up Date & Objective
  const followUpDateInput = document.getElementById('sheetFollowUpDate');
  const followUpReasonInput = document.getElementById('sheetFollowUpReason');
  if (followUpDateInput) followUpDateInput.value = r.follow_up_date || '';
  if (followUpReasonInput) followUpReasonInput.value = r.follow_up_notes || '';

  // Populate GPS Status Banner
  const gpsBanner = document.getElementById('sheetGpsBanner');
  if (gpsBanner) {
    if (isLiveVerified) {
      gpsBanner.innerHTML = `
        <div style="background: var(--primary-subtle); color: var(--primary); font-weight: 700; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(34,197,94,0.3); display: flex; align-items: center; justify-content: space-between;">
          <span>✅ Live GPS Verified today (${escapeHtml(r.checkInTime || '')})</span>
          ${r.checkInMapUrl ? `<a href="${r.checkInMapUrl}" target="_blank" rel="noopener" style="color: var(--accent); font-size: 11.5px; text-decoration: underline;">View Map ↗</a>` : ''}
        </div>
      `;
    } else {
      gpsBanner.innerHTML = `
        <div style="background: var(--warn-subtle); color: var(--warn); font-weight: 600; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid rgba(217,119,6,0.3); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <span>⚠️ Physical Visit Check-In Pending</span>
          <button type="button" class="btn btn-sm btn-primary" id="btnSheetCheckIn" style="font-size: 11px; padding: 4px 10px;">📍 Check In Now</button>
        </div>
      `;
      // In-sheet live checkin button
      document.getElementById('btnSheetCheckIn')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnSheetCheckIn');
        const updated = await executeLiveCheckIn(retailerId, btn, currentRep, repInfo, mainContainer);
        if (updated) {
          openCounterBottomSheet(retailerId, currentRep, repInfo, mainContainer);
        }
      });
    }
  }

  // Populate Status Chips
  const statusContainer = document.getElementById('sheetStatusChips');
  if (statusContainer) {
    statusContainer.innerHTML = STATUS_OPTIONS.map(s => `
      <button type="button" class="touch-chip ${(r.status || 'Pending') === s.id ? 'selected' : ''}" data-val="${s.id}">
        <span>${s.icon}</span> ${s.label}
      </button>
    `).join('');

    statusContainer.querySelectorAll('.touch-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        statusContainer.querySelectorAll('.touch-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
  }

  // Populate Category Chips
  const catContainer = document.getElementById('sheetCategoryChips');
  if (catContainer) {
    catContainer.innerHTML = POTENTIAL_FOR.map(o => `
      <button type="button" class="touch-chip ${(r.potentialFor || '') === o ? 'selected' : ''}" data-val="${o}">
        ${o}
      </button>
    `).join('');

    catContainer.querySelectorAll('.touch-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const wasSelected = chip.classList.contains('selected');
        catContainer.querySelectorAll('.touch-chip').forEach(c => c.classList.remove('selected'));
        if (!wasSelected) chip.classList.add('selected');
      });
    });
  }

  // Populate Sales Bracket Chips
  const sellContainer = document.getElementById('sheetSellChips');
  if (sellContainer) {
    sellContainer.innerHTML = POTENTIAL_SELL.map(o => `
      <button type="button" class="touch-chip ${(r.potentialSell || '') === o ? 'selected' : ''}" data-val="${o}">
        ₹${o}
      </button>
    `).join('');

    sellContainer.querySelectorAll('.touch-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const wasSelected = chip.classList.contains('selected');
        sellContainer.querySelectorAll('.touch-chip').forEach(c => c.classList.remove('selected'));
        if (!wasSelected) chip.classList.add('selected');
      });
    });
  }

  // Mobile number & Dialing Links
  const cleanPhone = (r.mobile || '').replace(/\D/g, '');
  const mobInput = document.getElementById('sheetMobileInput');
  const callLink = document.getElementById('sheetCallLink');
  const waLink = document.getElementById('sheetWaLink');

  if (mobInput) mobInput.value = r.mobile || '';
  if (callLink) callLink.href = cleanPhone ? `tel:${cleanPhone}` : '#';
  if (waLink) {
    const waText = encodeURIComponent(`Namaste ${r.retailer}, this is regarding your seed & agrochemical requirements in ${r.block || ''}.`);
    waLink.href = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${waText}` : '#';
  }

  // Notes
  const notesInput = document.getElementById('sheetNotesInput');
  if (notesInput) notesInput.value = r.notes || '';

  // Open Sheet
  sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeCounterBottomSheet() {
  const sheet = document.getElementById('counterBottomSheet');
  if (sheet) sheet.classList.remove('open');
  document.body.style.overflow = '';
  activeSheetRetailerId = null;
}

export function updateTourNavBadge() {
  const rep = auth.getAssignedRep();
  const badge = document.getElementById('bNavTourBadge');
  if (!badge) return;
  const count = rep ? getTodayTourIds(rep).size : 0;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

export function switchFieldSubTab(tab) {
  activeSubTab = tab;
  nearbyPage = 1;
  const container = document.getElementById('mainViewContainer');
  if (container) {
    renderFieldView(container, storage.rows);
  }
}

function renderFarmerLeadsSubTabHtml(repInfo, repLeads, myStationRows, leadStageFilter) {
  const today = getTodayDateStr();
  
  // Funnel counts
  const awarenessCount = repLeads.filter(l => l.funnel_stage === 'Awareness').length;
  const interestCount = repLeads.filter(l => l.funnel_stage === 'Interest').length;
  const trialCount = repLeads.filter(l => l.funnel_stage === 'Trial').length;
  const adoptionCount = repLeads.filter(l => l.funnel_stage === 'Adoption').length;
  const repeatCount = repLeads.filter(l => l.funnel_stage === 'Repeat Demand').length;
  const overdueCount = repLeads.filter(l => l.follow_up_date && l.follow_up_date < today).length;

  let displayLeads = repLeads;
  if (leadStageFilter === 'overdue') {
    displayLeads = repLeads.filter(l => l.follow_up_date && l.follow_up_date < today);
  } else if (leadStageFilter && leadStageFilter !== 'all') {
    displayLeads = repLeads.filter(l => l.funnel_stage === leadStageFilter);
  }

  // Next stage mapping
  const nextStageMap = {
    'Awareness': 'Interest',
    'Interest': 'Trial',
    'Trial': 'Adoption',
    'Adoption': 'Repeat Demand'
  };

  return `
    <div style="margin-top: 10px;">
      <!-- Hero Banner -->
      <div class="card" style="padding: 16px 20px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(234, 88, 12, 0.08), rgba(22, 163, 74, 0.06)); border-color: rgba(234, 88, 12, 0.3);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">🌾</span>
              <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; margin: 0;">
                Farmer Leads & Market Development CRM
              </h3>
              <span class="badge" style="background: #ffedd5; color: #ea580c; font-weight: 700;">SOP Pillar 3 (25 pts)</span>
            </div>
            <p style="color: var(--muted); font-size: 12.5px; margin-top: 4px; margin-bottom: 0;">
              Drive the progression: <strong>Awareness ➔ Interest ➔ Trial ➔ Adoption ➔ Repeat Demand ➔ Market Growth</strong>. Link demand to dealer counters!
            </p>
          </div>

          <button type="button" class="btn btn-primary btn-sm" id="btnRegisterFarmerLead" style="font-weight: 700; background: #ea580c; border-color: #c2410c;">
            🌾 + Register Farmer Lead (+5 pts)
          </button>
        </div>

        <!-- Funnel Metric Chips -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--line); text-align: center;">
          <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
            <div style="color: var(--muted); font-size: 11px;">📣 Awareness</div>
            <div style="font-size: 17px; font-weight: 800; color: #64748b;">${awarenessCount}</div>
          </div>
          <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
            <div style="color: var(--muted); font-size: 11px;">💡 Interest</div>
            <div style="font-size: 17px; font-weight: 800; color: #0284c7;">${interestCount}</div>
          </div>
          <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
            <div style="color: var(--muted); font-size: 11px;">🌱 Trial</div>
            <div style="font-size: 17px; font-weight: 800; color: #7c3aed;">${trialCount}</div>
          </div>
          <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
            <div style="color: var(--muted); font-size: 11px;">⭐ Adoption</div>
            <div style="font-size: 17px; font-weight: 800; color: #16a34a;">${adoptionCount}</div>
          </div>
          <div style="background: var(--surface); padding: 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
            <div style="color: var(--muted); font-size: 11px;">🔁 Repeat</div>
            <div style="font-size: 17px; font-weight: 800; color: #ea580c;">${repeatCount}</div>
          </div>
        </div>
      </div>

      <!-- Stage Filter Pills -->
      <div style="display: flex; gap: 6px; margin-bottom: 14px; overflow-x: auto; padding-bottom: 4px;">
        <button type="button" class="filter-pill ${leadStageFilter === 'all' ? 'active' : ''}" data-stage="all" style="font-size: 12px; padding: 4px 12px;">
          All Leads (${repLeads.length})
        </button>
        <button type="button" class="filter-pill ${leadStageFilter === 'Awareness' ? 'active' : ''}" data-stage="Awareness" style="font-size: 12px; padding: 4px 12px;">
          📣 Awareness (${awarenessCount})
        </button>
        <button type="button" class="filter-pill ${leadStageFilter === 'Interest' ? 'active' : ''}" data-stage="Interest" style="font-size: 12px; padding: 4px 12px;">
          💡 Interest (${interestCount})
        </button>
        <button type="button" class="filter-pill ${leadStageFilter === 'Trial' ? 'active' : ''}" data-stage="Trial" style="font-size: 12px; padding: 4px 12px;">
          🌱 Trial (${trialCount})
        </button>
        <button type="button" class="filter-pill ${leadStageFilter === 'Adoption' ? 'active' : ''}" data-stage="Adoption" style="font-size: 12px; padding: 4px 12px;">
          ⭐ Adoption (${adoptionCount})
        </button>
        <button type="button" class="filter-pill ${leadStageFilter === 'Repeat Demand' ? 'active' : ''}" data-stage="Repeat Demand" style="font-size: 12px; padding: 4px 12px;">
          🔁 Repeat Demand (${repeatCount})
        </button>
        ${overdueCount > 0 ? `
          <button type="button" class="filter-pill ${leadStageFilter === 'overdue' ? 'active' : ''}" data-stage="overdue" style="font-size: 12px; padding: 4px 12px; background: #fee2e2; color: #dc2626; border-color: #fca5a5;">
            ⚠️ Overdue (${overdueCount})
          </button>
        ` : ''}
      </div>

      <!-- Leads Cards List -->
      ${displayLeads.length === 0 ? `
        <div class="card" style="text-align: center; padding: 36px 20px; color: var(--muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🌾</div>
          <div style="font-weight: 700; font-size: 15px; color: var(--ink);">No farmer leads in this stage</div>
          <p style="font-size: 12.5px; margin-top: 4px;">Click "+ Register Farmer Lead" to add farmers and advance them through your territory pipeline.</p>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${displayLeads.map(l => {
            const isOverdue = l.follow_up_date && l.follow_up_date < today;
            const isDueToday = l.follow_up_date && l.follow_up_date === today;
            const nextStage = nextStageMap[l.funnel_stage];

            let stageBadgeBg = '#f1f5f9', stageBadgeColor = '#475569';
            if (l.funnel_stage === 'Awareness') { stageBadgeBg = '#f1f5f9'; stageBadgeColor = '#475569'; }
            else if (l.funnel_stage === 'Interest') { stageBadgeBg = '#e0f2fe'; stageBadgeColor = '#0284c7'; }
            else if (l.funnel_stage === 'Trial') { stageBadgeBg = '#ede9fe'; stageBadgeColor = '#7c3aed'; }
            else if (l.funnel_stage === 'Adoption') { stageBadgeBg = '#dcfce7'; stageBadgeColor = '#16a34a'; }
            else if (l.funnel_stage === 'Repeat Demand') { stageBadgeBg = '#ffedd5'; stageBadgeColor = '#ea580c'; }

            return `
              <div class="card" style="padding: 14px 16px; border-left: 4px solid ${stageBadgeColor}; background: var(--surface);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <strong style="font-size: 15px; color: var(--ink); font-family: var(--font-heading);">
                        ${escapeHtml(l.farmer_name)}
                      </strong>
                      <span class="badge" style="background: ${stageBadgeBg}; color: ${stageBadgeColor}; font-weight: 800;">
                        ${l.funnel_stage === 'Awareness' ? '📣' : l.funnel_stage === 'Interest' ? '💡' : l.funnel_stage === 'Trial' ? '🌱' : l.funnel_stage === 'Adoption' ? '⭐' : '🔁'} ${escapeHtml(l.funnel_stage)}
                      </span>
                      <span class="badge" style="background: var(--surface-alt); font-size: 11px;">
                        ${escapeHtml(l.farmer_category || 'Progressive')}
                      </span>
                      <span class="badge" style="background: rgba(2, 132, 199, 0.1); color: var(--accent); font-size: 11px;">
                        🌾 ${escapeHtml(l.crop)} (${l.acreage || 1} Ac)
                      </span>
                    </div>

                    <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                      📍 Village: <strong>${escapeHtml(l.village)}</strong>, Block: <strong>${escapeHtml(l.block)}</strong> · Target Product: <strong>${escapeHtml(l.product_interest)}</strong>
                    </div>

                    ${l.assigned_dealer_name ? `
                      <div style="font-size: 12px; color: var(--ink-secondary); margin-top: 4px;">
                        🏬 <strong>Liquidation Counter:</strong> ${escapeHtml(l.assigned_dealer_name)} (${l.demand_volume_bags || 2} Bags demand)
                      </div>
                    ` : ''}

                    ${l.follow_up_notes ? `
                      <div style="margin-top: 8px; font-size: 12px; color: var(--ink-secondary); background: var(--surface-alt); padding: 6px 10px; border-radius: var(--radius-xs);">
                        💬 <strong>Follow-up note:</strong> ${escapeHtml(l.follow_up_notes)}
                      </div>
                    ` : ''}
                  </div>

                  <!-- Actions & Follow-up status -->
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      ${isOverdue ? `
                        <span class="badge" style="background: #fee2e2; color: #dc2626; font-weight: 700;">
                          ⚠️ Overdue (${escapeHtml(l.follow_up_date)})
                        </span>
                      ` : isDueToday ? `
                        <span class="badge" style="background: #fef3c7; color: #d97706; font-weight: 700;">
                          📅 Due Today
                        </span>
                      ` : l.follow_up_date ? `
                        <span class="badge badge-visited" style="font-size: 11px;">
                          📅 ${escapeHtml(l.follow_up_date)}
                        </span>
                      ` : ''}
                    </div>

                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      ${l.mobile ? `
                        <a href="tel:${escapeHtml(l.mobile)}" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11.5px;" title="Call farmer">
                          📞 Call
                        </a>
                        <a href="https://wa.me/91${escapeHtml(l.mobile)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11.5px; color: #16a34a;" title="WhatsApp">
                          💬 WhatsApp
                        </a>
                      ` : ''}

                      ${nextStage ? `
                        <button type="button" class="btn btn-primary btn-sm btn-advance-lead" data-id="${escapeHtml(l.id)}" data-next="${escapeHtml(nextStage)}" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700;">
                          Advance to ${escapeHtml(nextStage)} ➔
                        </button>
                      ` : `
                        <span class="badge" style="background: #dcfce7; color: #166534; font-weight: 800;">
                          🔁 Repeat Buyer
                        </span>
                      `}

                      <button type="button" class="btn btn-secondary btn-sm btn-edit-lead" data-id="${escapeHtml(l.id)}" style="padding: 4px 8px; font-size: 11.5px;" title="Edit Lead">
                        ✏️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

function renderFarmersSubTabHtml(repInfo, repMeetings, repDemos) {
  const totalAttendees = repMeetings.reduce((acc, m) => acc + (m.attendees_count || 0), 0);

  return `
    <div style="margin-top: 10px;">
      <!-- Top Action Banner -->
      <div class="card" style="padding: 16px 20px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(22, 163, 74, 0.08), rgba(2, 132, 199, 0.06)); border-color: rgba(22, 163, 74, 0.3);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">🌾</span>
              <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; margin: 0;">
                Farmer Engagement & Demonstration Lifecycle
              </h3>
              <span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 800;">SOP Pillar 3 (25 pts)</span>
            </div>
            <p style="color: var(--muted); font-size: 12.5px; margin-top: 4px; margin-bottom: 0;">
              MGO Success Funnel: Awareness → Trial Plot → Farm Adoption → Repeat Demand at Tier A counters.
            </p>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="btnLogFarmerMeeting" style="font-weight: 700;">
              🌾 + Log Farmer Meeting
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnAddDemoPlot" style="font-weight: 700; border-color: rgba(22, 163, 74, 0.4); color: var(--primary);">
              🌱 + Add Demo Plot
            </button>
          </div>
        </div>

        <!-- Metric Tallies -->
        <div style="display: flex; gap: 12px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--line); flex-wrap: wrap; align-items: center;">
          <div style="font-size: 12.5px; color: var(--ink-secondary);">
            <strong>${repMeetings.length}</strong> Meetings Logged
          </div>
          <div style="color: var(--line-strong);">•</div>
          <div style="font-size: 12.5px; color: var(--ink-secondary);">
            <strong>${totalAttendees}</strong> Farmers Reached
          </div>
          <div style="color: var(--line-strong);">•</div>
          <div style="font-size: 12.5px; color: var(--ink-secondary);">
            <strong>${repDemos.length}</strong> Active Demo Plots
          </div>
        </div>
      </div>

      <!-- Demo Plots Lifecycle Grid -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h4 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 6px;">
            <span>🌱</span> Active Demonstrations & Trial Plots (${repDemos.length})
          </h4>
        </div>

        ${repDemos.length === 0 ? `
          <div class="card" style="text-align: center; padding: 32px 20px; color: var(--muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">🌱</div>
            <div style="font-weight: 700; font-size: 15px; color: var(--ink);">No demo plots registered yet</div>
            <p style="font-size: 12.5px; margin-top: 4px;">Click "+ Add Demo Plot" to register your first trial against a competitor check variety.</p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${repDemos.map(d => `
              <div class="card" style="padding: 14px 16px; border-left: 4px solid #16a34a; background: var(--surface);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 800; font-size: 15px; color: var(--ink); font-family: var(--font-heading);">
                        ${escapeHtml(d.hybrid_tested)}
                      </span>
                      ${d.competitor_check ? `
                        <span style="font-size: 12px; color: var(--muted);">vs Check: <strong>${escapeHtml(d.competitor_check)}</strong></span>
                      ` : ''}
                      <span class="badge" style="background: var(--primary-subtle); color: var(--primary); font-weight: 700;">
                        ${escapeHtml(d.current_stage || 'Sowing')}
                      </span>
                    </div>
                    <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                      Host Farmer: <strong>${escapeHtml(d.farmer_name)}</strong> ${d.farmer_mobile ? `(📞 ${escapeHtml(d.farmer_mobile)})` : ''} · Village: <strong>${escapeHtml(d.village)}</strong> (${escapeHtml(d.block)})
                    </div>
                  </div>

                  <button type="button" class="btn btn-secondary btn-sm btn-update-demo" data-id="${escapeHtml(d.id)}" style="font-weight: 700; font-size: 12px; color: var(--primary); border-color: rgba(22, 163, 74, 0.4);">
                    ✏️ Update Stage (+3.5 pts)
                  </button>
                </div>

                ${d.observations ? `
                  <div style="margin-top: 10px; font-size: 12.5px; color: var(--ink-secondary); background: var(--surface-alt); padding: 8px 12px; border-radius: var(--radius-xs);">
                    📝 <strong>Agronomic Observations:</strong> ${escapeHtml(d.observations)}
                  </div>
                ` : ''}

                ${d.yield_result_kg_acre ? `
                  <div style="margin-top: 8px; font-size: 12.5px; font-weight: 700; color: #15803d;">
                    ⚖️ Harvest Yield Cut: ${d.yield_result_kg_acre} kg / acre
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Farmer Meetings Ledger -->
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h4 style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 6px;">
            <span>🌾</span> Farmer Meetings & Field Days Logged (${repMeetings.length})
          </h4>
        </div>

        ${repMeetings.length === 0 ? `
          <div class="card" style="text-align: center; padding: 32px 20px; color: var(--muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">🌾</div>
            <div style="font-weight: 700; font-size: 15px; color: var(--ink);">No farmer meetings logged yet</div>
            <p style="font-size: 12.5px; margin-top: 4px;">Click "+ Log Farmer Meeting" after conducting village group meetings or field days.</p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${repMeetings.map(m => `
              <div class="card" style="padding: 14px 16px; border-left: 4px solid var(--accent); background: var(--surface);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700; font-size: 14.5px; color: var(--ink);">
                        ${escapeHtml(m.meeting_type || 'Group Meeting')} · ${escapeHtml(m.crop)}
                      </span>
                      <span class="badge" style="background: #e0f2fe; color: #0284c7; font-weight: 700;">
                        👥 ${m.attendees_count || 0} Attendees
                      </span>
                      <span class="badge badge-visited">${escapeHtml(m.date)}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                      Location: Village <strong>${escapeHtml(m.village)}</strong>, Block <strong>${escapeHtml(m.block)}</strong> (${escapeHtml(m.district)})
                    </div>
                  </div>
                </div>

                ${m.key_discussion ? `
                  <div style="margin-top: 10px; font-size: 12.5px; color: var(--ink-secondary); background: var(--surface-alt); padding: 8px 12px; border-radius: var(--radius-xs);">
                    💬 <strong>Key Discussion:</strong> ${escapeHtml(m.key_discussion)}
                  </div>
                ` : ''}

                ${m.lead_farmers && m.lead_farmers.length > 0 ? `
                  <div style="margin-top: 8px; font-size: 12px; color: var(--muted);">
                    Lead Farmer: <strong>${escapeHtml(m.lead_farmers[0].name)}</strong> ${m.lead_farmers[0].mobile ? `(📞 ${escapeHtml(m.lead_farmers[0].mobile)})` : ''}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderCompetitorSubTabHtml(repInfo, repIntel) {
  return `
    <div style="margin-top: 10px;">
      <!-- Top Action Banner -->
      <div class="card" style="padding: 16px 20px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(2, 132, 199, 0.06)); border-color: rgba(124, 58, 237, 0.3);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">🔍</span>
              <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; margin: 0;">
                Product & Competitor Market Intelligence
              </h3>
              <span class="badge" style="background: #ede9fe; color: #7c3aed; font-weight: 700;">SOP Pillar 2 (15 pts)</span>
            </div>
            <p style="color: var(--muted); font-size: 12.5px; margin-top: 4px; margin-bottom: 0;">
              Deliver factual, timely competitor pricing, distributor schemes, and farmer sentiment to management.
            </p>
          </div>

          <button type="button" class="btn btn-primary btn-sm" id="btnLogCompetitorIntel" style="font-weight: 700; background: #7c3aed; border-color: #6d28d9;">
            🔍 + Log Competitor Intel (+4 pts)
          </button>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--line); flex-wrap: wrap; align-items: center;">
          <div style="font-size: 12.5px; color: var(--ink-secondary);">
            <strong>${repIntel.length}</strong> Intelligence Entries Captured
          </div>
          <div style="color: var(--line-strong);">•</div>
          <div style="font-size: 12.5px; color: var(--ink-secondary);">
            Target: ≥ 2 Verified Price/Scheme Audits per week
          </div>
        </div>
      </div>

      <!-- Competitor Intel List -->
      ${repIntel.length === 0 ? `
        <div class="card" style="text-align: center; padding: 36px 20px; color: var(--muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 700; font-size: 15px; color: var(--ink);">No competitor intel logged yet</div>
          <p style="font-size: 12.5px; margin-top: 4px;">Capture competitor product prices, distributor schemes, and farmer feedback during your dealer visits.</p>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${repIntel.map(c => `
            <div class="card" style="padding: 14px 16px; border-left: 4px solid #7c3aed; background: var(--surface);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-weight: 800; font-size: 15px; color: var(--ink); font-family: var(--font-heading);">
                      ${escapeHtml(c.competitor_brand)}: ${escapeHtml(c.product_name)}
                    </span>
                    <span class="badge" style="background: var(--surface-alt); font-size: 11px;">
                      🌾 ${escapeHtml(c.crop)}
                    </span>
                    ${c.farmer_sentiment ? `
                      <span class="badge" style="background: ${c.farmer_sentiment === 'High Demand' ? '#fee2e2; color: #dc2626;' : '#f3f4f6; color: var(--ink);'} font-weight: 700;">
                        ${c.farmer_sentiment === 'High Demand' ? '🔥 High Demand' : escapeHtml(c.farmer_sentiment)}
                      </span>
                    ` : ''}
                    <span class="badge badge-visited">${escapeHtml(c.date)}</span>
                  </div>
                  <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                    Observed at: <strong>${escapeHtml(c.retailer_name || 'Market Observation')}</strong> · Block: <strong>${escapeHtml(c.block)}</strong> (${escapeHtml(c.district)})
                  </div>
                </div>

                <div style="text-align: right;">
                  <div style="font-size: 16px; font-weight: 800; font-family: var(--font-heading); color: #7c3aed;">
                    ₹${c.retail_price || 0}<span style="font-size: 11px; font-weight: 500; color: var(--muted);">/bag retail</span>
                  </div>
                  ${c.dealer_price ? `
                    <div style="font-size: 11.5px; color: var(--muted);">
                      Dealer Landing: ₹${c.dealer_price} (Margin: ₹${c.retail_price - c.dealer_price})
                    </div>
                  ` : ''}
                </div>
              </div>

              ${c.promotional_scheme ? `
                <div style="margin-top: 10px; font-size: 12.5px; color: var(--ink-secondary); background: var(--surface-alt); padding: 8px 12px; border-radius: var(--radius-xs);">
                  🎁 <strong>Promotional Scheme:</strong> ${escapeHtml(c.promotional_scheme)}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function renderFollowUpsSubTabHtml(repInfo, followUps) {
  if (!followUps || followUps.length === 0) {
    return `
      <div class="card" style="text-align: center; padding: 48px 20px;">
        <div style="font-size: 40px; margin-bottom: 12px;">📅</div>
        <h3 style="font-weight: 700; font-size: 17px; color: var(--ink);">No Scheduled Follow-Ups Due</h3>
        <p style="color: var(--muted); font-size: 13px; max-width: 440px; margin: 8px auto 0;">
          All scheduled counter visits and retailer commitments are up to date! Set follow-up dates in the Counter Details drawer after meeting dealers to build your future pipeline.
        </p>
      </div>
    `;
  }

  const overdue = followUps.filter(f => f.status === 'overdue');
  const today = followUps.filter(f => f.status === 'today');
  const upcoming = followUps.filter(f => f.status === 'upcoming');

  return `
    <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
      <div class="card" style="flex: 1; min-width: 140px; padding: 12px 16px; border-left: 4px solid var(--danger);">
        <div style="font-size: 22px; font-weight: 800; color: var(--danger);">${overdue.length}</div>
        <div style="font-size: 11px; color: var(--muted); font-weight: 700;">⚠️ Overdue Follow-ups</div>
      </div>
      <div class="card" style="flex: 1; min-width: 140px; padding: 12px 16px; border-left: 4px solid #f59e0b;">
        <div style="font-size: 22px; font-weight: 800; color: #d97706;">${today.length}</div>
        <div style="font-size: 11px; color: var(--muted); font-weight: 700;">📌 Due Today</div>
      </div>
      <div class="card" style="flex: 1; min-width: 140px; padding: 12px 16px; border-left: 4px solid var(--primary);">
        <div style="font-size: 22px; font-weight: 800; color: var(--primary);">${upcoming.length}</div>
        <div style="font-size: 11px; color: var(--muted); font-weight: 700;">🌱 Upcoming Scheduled</div>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${followUps.map(f => `
        <div class="card" style="padding: 14px 16px; border-left: 4px solid ${f.status === 'overdue' ? 'var(--danger)' : f.status === 'today' ? '#f59e0b' : 'var(--primary)'};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-weight: 800; font-size: 15.5px; color: var(--ink);">${escapeHtml(f.retailer)}</span>
                <span class="badge ${f.status === 'overdue' ? 'badge-danger' : f.status === 'today' ? 'badge-visited' : 'badge-called'}" style="font-weight: 800; font-size: 11px;">
                  ${f.status === 'overdue' ? '⚠️ OVERDUE (' + f.follow_up_date + ')' : f.status === 'today' ? '📌 DUE TODAY' : '📅 ' + f.follow_up_date}
                </span>
              </div>
              <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
                📍 ${escapeHtml(f.block)}, ${escapeHtml(f.district)} • Last Visited: <strong>${escapeHtml(f.last_visit_date)}</strong>
              </div>
              ${f.follow_up_notes ? `
                <div style="margin-top: 8px; font-size: 12.5px; background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border-left: 3px solid #7c3aed;">
                  🎯 <strong>Follow-up Commitment:</strong> <em>${escapeHtml(f.follow_up_notes)}</em>
                </div>
              ` : ''}
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              ${f.mobile ? `
                <a href="tel:${f.mobile.replace(/\D/g, '')}" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 6px 10px;">📞 Call</a>
                <a href="https://wa.me/91${f.mobile.replace(/\D/g, '')}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 6px 10px; color: #16a34a;">💬 WA</a>
              ` : ''}
              <button type="button" class="btn btn-primary btn-sm btn-open-followup-sheet" data-id="${f.retailerId}" style="font-size: 11.5px; padding: 6px 12px; font-weight: 700;">
                📝 Action Counter ➔
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


