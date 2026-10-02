import { STATUS_OPTIONS, POTENTIAL_FOR } from '../data/assistants.js';
import { storage } from '../services/storage.js';
import { auth } from '../services/auth.js';
import { openRetailerModal } from './modal.js';
import { showToast } from './toast.js';
import { exportToExcel, exportToCsv, exportCheckInAuditToExcel, exportCheckInAuditToCsv, parseExcelOrCsvFile, exportKpiReportToExcel } from '../utils/excel.js';
import { openAssistantEditModal, openAddAssistantModal, openReassignTerritoryModal } from './territoryModal.js';
import { openSupabaseModal } from './supabaseModal.js';
import { calculateAssistantScore } from '../services/kpiService.js';
import { openKpiScoreModal } from './kpiScoreModal.js';
import { openAqfsAuditModal } from './aqfsAuditModal.js';
import { openWeeklyReviewModal } from './weeklyReviewModal.js';
import { openFarmerLeadModal } from './farmerLeadsModal.js';
import { openFarmerMeetingModal } from './farmerMeetingModal.js';
import { openDemoPlotModal } from './demoPlotModal.js';
import { openMgoSuccessModal } from './mgoSuccessModal.js';
import { openAdminQuizModal } from './adminQuizModal.js';
import { openRepQuizAuditModal } from './quizAuditModal.js';
import { openFormBuilderModal } from './dynamicFormBuilderModal.js';
import { openFormSubmissionsModal } from './dynamicFormSubmissionsModal.js';
import { exportFormSubmissionsToExcel, exportInventoryToExcel, downloadInventoryImportTemplate, parseInventoryExcelFile, exportTadaClaimsToExcel, exportMusterRollToExcel, exportLeaveBalanceReportToExcel } from '../utils/excel.js';
import { openAdminInventoryModal } from './adminInventoryModal.js';
import { openSmartTourBeatModal } from './smartTourBeatModal.js';
import { openTadaPolicyModal } from './tadaPolicyModal.js';
import { openReceiptLightboxModal } from './receiptLightboxModal.js';
import { openAttendanceModal } from './attendanceModal.js';
import { openLeaveModal } from './leaveModal.js';
import { renderGeminiAiChatTab, initGeminiAiChat } from './geminiAiChat.js';
import { openSpeedAuditModal } from './speedAuditModal.js';

let currentAssistantScores = [];
let currentAdminTab = 'leaderboard'; // 'leaderboard' | 'fieldops' | 'eod' | 'quiz' | 'forms' | 'inventory' | 'gps' | 'dealers' | 'tada' | 'muster' | 'leave' | 'ai'
let currentFieldOpsSubTab = 'meetings'; // 'meetings' | 'demos' | 'leads' | 'intel'
let fieldOpsSearch = '';
let fieldOpsRepFilter = '';
let fieldOpsPage = 1;
const fieldOpsPageSize = 10;
let eodFilterDate = getTodayDateStr();

// TA/DA & Smart Beat Filter State
let tadaFilterRep = 'ALL';
let tadaFilterStatus = 'all';
let tadaFilterDate = '';
let tadaPage = 1;
const tadaPageSize = 10;

// Inventory & Stock Ledger Weekly Filter & Pagination State
let inventoryPeriodFilter = 'all'; // 'all' | 'this_week' | 'last_week' | 'month' | 'custom'
let inventoryCustomStartDate = '';
let inventoryCustomEndDate = '';
let inventoryFilterRep = '';
let inventoryFilterProduct = '';
let inventoryIncludePast = true;
let inventoryPage = 1;
let inventoryPageSize = 10;

// Dealer Master State
let adminPage = 1;
const adminPageSize = 25;
let adminSearch = '';
let adminAssistantFilter = '';
let adminStatusFilter = '';
let adminCategoryFilter = '';
let selectedRetailerIds = new Set();

// GPS Check-In State
let checkInFilterDate = 'all';
let checkInFilterRep = '';
let checkInFilterProximity = 'all';
let checkInSearch = '';
let checkInPage = 1;
const checkInPageSize = 10;

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayDateStr() {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function renderAdminView(container, allRows) {
  const assistants = storage.getAssistants();
  const totalCount = allRows.length;
  const contactedCount = allRows.filter(r => (r.status && r.status !== 'Pending') || r.mobile || r.potentialFor).length;
  const closedCount = allRows.filter(r => r.status === 'Closed').length;
  const overallPct = totalCount ? Math.round((contactedCount / totalCount) * 100) : 0;

  // Pipeline estimation
  let estMin = 0, estMax = 0;
  allRows.forEach(r => {
    if (r.potentialSell === '5000-10000') { estMin += 5000; estMax += 10000; }
    else if (r.potentialSell === '10000-15000') { estMin += 10000; estMax += 15000; }
    else if (r.potentialSell === '15000-20000') { estMin += 15000; estMax += 20000; }
    else if (r.potentialSell === '>20000') { estMin += 25000; estMax += 35000; }
  });

  // Demand categories
  const catVeg = allRows.filter(r => r.potentialFor === 'Veg').length;
  const catCP = allRows.filter(r => r.potentialFor === 'CP').length;
  const catField = allRows.filter(r => r.potentialFor === 'Field').length;
  const catMulti = allRows.filter(r => r.potentialFor === 'Multi').length;

  // Real-time data points
  const todayStr = getTodayDateStr();
  const allLogs = storage.getCheckInLogs();
  const allMeetings = storage.getFarmerMeetings();
  const allDemos = storage.getDemoPlots();
  const allIntel = storage.getCompetitorIntel();
  const allLeads = storage.getFarmerLeads();
  const allQuestions = storage.getQuizQuestions();
  const allDynamicForms = storage.getDynamicForms();
  const allFormSubmissions = storage.getFormSubmissions();
  const inventorySummary = storage.getInventoryLedgerSummary({
    period: inventoryPeriodFilter,
    startDate: inventoryCustomStartDate,
    endDate: inventoryCustomEndDate,
    assistant: inventoryFilterRep,
    product: inventoryFilterProduct,
    includePastAllocations: inventoryIncludePast
  });

  const assistantScores = assistants.map(a => {
    const quizState = storage.getQuizState(a.name);
    const eodReport = storage.getEodReport(a.name, todayStr);
    const aqfsAudit = storage.getAssistantAqfsAudit(a.name);
    const tourKey = `tat_tour_${String(a.name).toLowerCase().trim()}_${todayStr}`;
    let tourPlan = null;
    try {
      const raw = localStorage.getItem(tourKey);
      if (raw) tourPlan = { retailer_ids: JSON.parse(raw) };
    } catch(e) {}

    return calculateAssistantScore(a.name, {
      checkInLogs: allLogs,
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
  });

  assistantScores.sort((a, b) => b.totalScore - a.totalScore);
  currentAssistantScores = assistantScores;
  const avgScore = assistantScores.length ? Math.round(assistantScores.reduce((acc, s) => acc + s.totalScore, 0) / assistantScores.length) : 0;

  // Count field ops total
  const fieldOpsTotalCount = allMeetings.length + allDemos.length + allLeads.length + allIntel.length;

  // Count pending TA/DA claims
  const allTadaClaims = storage.getTadaClaims();
  const pendingTadaCount = allTadaClaims.filter(c => c.status === 'Pending Approval').length;

  container.innerHTML = `
    <!-- Manager Control Center Banner -->
    <div class="card" style="background: linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(34, 197, 94, 0.08)); border-color: rgba(2, 132, 199, 0.3); margin-bottom: 14px;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">👑</span>
            <strong style="font-family: var(--font-heading); font-size: 16px;">Manager Control Center (Admin Mode Active)</strong>
          </div>
          <div style="color: var(--muted); font-size: 12.5px; margin-top: 2px;">
            Full supervisory access to manage territories, inspect live field operations, assess agronomy quizzes, and audit check-ins.
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" id="btnAdminOpenAiTab" style="background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; font-weight: 700; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3); display: inline-flex; align-items: center; gap: 6px;">
            <span>✨</span> Ask AI Copilot
          </button>
          <button class="btn btn-secondary btn-sm" id="btnAdminSpeedAudit" style="color: #dc2626; border-color: rgba(220, 38, 38, 0.4); font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Fleet Speed Governance & Over-Speeding Warning Dispatcher">
            <span>🚨</span> Fleet Speed &amp; Warnings
          </button>
          <button class="btn btn-secondary btn-sm" id="btnAdminSupabaseSync" style="background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.4); color: var(--success); font-weight: 600;">☁️ Supabase Cloud</button>
          <button class="btn btn-secondary btn-sm" id="btnAdminSopGuide" style="color: var(--primary); font-weight: 600;">🌱 SOP Guide</button>
          <button class="btn btn-secondary btn-sm" id="btnAdminAddAssistant">+ Add Assistant</button>
          <button class="btn btn-secondary btn-sm" id="btnAdminReassignBlock">🔄 Reassign Territory</button>
          <button class="btn btn-secondary btn-sm" id="btnAdminChangePin">🔑 Change PIN</button>
          <button class="btn btn-secondary btn-sm" id="btnAdminLogout" style="color: var(--danger); font-weight: 600; border-color: rgba(220, 38, 38, 0.3);">🚪 Logout Admin</button>
          <button class="btn btn-primary btn-sm" id="btnAdminLock">🔒 Lock Admin</button>
        </div>
      </div>
    </div>

    <!-- Executive SaaS Tab Navigation -->
    <div class="admin-nav-tabs">
      <button class="admin-sub-tab-btn ${currentAdminTab === 'leaderboard' ? 'active' : ''}" data-tab="leaderboard">
        📊 Overview & Leaderboard
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'fieldops' ? 'active' : ''}" data-tab="fieldops">
        🌾 Field Operations Registry <span class="badge" style="margin-left: 4px; font-size: 10px; background: rgba(22, 163, 74, 0.15); color: #16a34a;">${fieldOpsTotalCount}</span>
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'eod' ? 'active' : ''}" data-tab="eod">
        ⏱️ Daily EOD Inbox
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'quiz' ? 'active' : ''}" data-tab="quiz">
        🎓 Agronomy Quiz Studio <span class="badge" style="margin-left: 4px; font-size: 10px; background: rgba(147, 51, 234, 0.15); color: #9333ea;">${allQuestions.length} Qs</span>
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'forms' ? 'active' : ''}" data-tab="forms">
        📝 Dynamic Forms Studio <span class="badge" style="margin-left: 4px; font-size: 10px; background: rgba(2, 132, 199, 0.15); color: #0284c7;">${allDynamicForms.length} Forms</span>
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'inventory' ? 'active' : ''}" data-tab="inventory">
        📦 Stock & Liquidation Ledger <span class="badge" style="margin-left: 4px; font-size: 10px; background: rgba(16, 185, 129, 0.15); color: #16a34a;">${inventorySummary.overallLiquidationPct}%</span>
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'gps' ? 'active' : ''}" data-tab="gps">
        📍 Live GPS Check-Ins <span class="badge" style="margin-left: 4px; font-size: 10px; background: rgba(2, 132, 199, 0.15); color: #0284c7;">${allLogs.length}</span>
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'tada' ? 'active' : ''}" data-tab="tada">
        🗺️ Smart Beats & TA/DA Claims <span class="badge" style="margin-left: 4px; font-size: 10px; background: rgba(245, 158, 11, 0.15); color: #d97706;">${pendingTadaCount} Pending</span>
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'muster' ? 'active' : ''}" data-tab="muster">
        📋 Indian Attendance &amp; Muster Roll
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'leave' ? 'active' : ''}" data-tab="leave">
        🏖️ Leave Management &amp; Calendar
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'ai' ? 'active' : ''}" data-tab="ai" style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(99, 102, 241, 0.12)); border-color: rgba(14, 165, 233, 0.45); font-weight: 800; color: #0284c7;">
        ✨ Gemini AI Copilot <span class="badge" style="margin-left: 4px; font-size: 10px; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff;">LIVE</span>
      </button>
      <button class="admin-sub-tab-btn ${currentAdminTab === 'dealers' ? 'active' : ''}" data-tab="dealers">
        🏬 Tier-A Dealers Master (${totalCount})
      </button>
    </div>

    <!-- Tab Dynamic Viewport -->
    <div id="adminTabContent">
      ${renderTabContent({
        assistants,
        totalCount,
        contactedCount,
        closedCount,
        overallPct,
        estMin,
        estMax,
        catVeg,
        catCP,
        catField,
        catMulti,
        assistantScores,
        avgScore,
        allLogs,
        allMeetings,
        allDemos,
        allIntel,
        allLeads,
        allQuestions,
        allDynamicForms,
        allFormSubmissions,
        inventorySummary,
        allRows
      })}
    </div>
  `;

  bindAdminEvents(container);
  if (currentAdminTab === 'dealers') renderTableRows();
  if (currentAdminTab === 'gps') renderCheckInAuditRows();
  if (currentAdminTab === 'ai') initGeminiAiChat(container);
}

function renderTabContent(data) {
  if (currentAdminTab === 'leaderboard') {
    return renderLeaderboardTab(data);
  } else if (currentAdminTab === 'fieldops') {
    return renderFieldOpsTab(data);
  } else if (currentAdminTab === 'eod') {
    return renderEodTab(data);
  } else if (currentAdminTab === 'quiz') {
    return renderQuizTab(data);
  } else if (currentAdminTab === 'forms') {
    return renderDynamicFormsTab(data);
  } else if (currentAdminTab === 'inventory') {
    return renderInventoryTab(data);
  } else if (currentAdminTab === 'gps') {
    return renderGpsTab(data);
  } else if (currentAdminTab === 'tada') {
    return renderTadaAuditTab(data);
  } else if (currentAdminTab === 'muster') {
    return renderAttendanceMusterRollTab(data);
  } else if (currentAdminTab === 'leave') {
    return renderLeaveManagementTab(data);
  } else if (currentAdminTab === 'ai') {
    return renderGeminiAiChatTab();
  } else if (currentAdminTab === 'dealers') {
    return renderDealersTab(data);
  }
  return '';
}

// =========================================================================
// TAB 1: OVERVIEW & LEADERBOARD
// =========================================================================
function renderLeaderboardTab(data) {
  const { assistants, totalCount, contactedCount, closedCount, overallPct, estMin, estMax, catVeg, catCP, catField, catMulti, assistantScores, avgScore, allRows } = data;

  return `
    <!-- Supervisory MGO Field Activity Action Strip -->
    <div class="card" style="padding: 12px 18px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(22, 163, 74, 0.08), rgba(2, 132, 199, 0.06)); border: 1.5px solid rgba(22, 163, 74, 0.35); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; box-shadow: var(--shadow-sm);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">⚡</span>
        <div>
          <strong style="font-family: var(--font-heading); font-size: 14px; color: var(--ink);">Supervisory Quick Action Strip:</strong>
          <span style="font-size: 12px; color: var(--muted); margin-left: 6px;">Directly log farmer meetings, demo trials, or demand leads</span>
        </div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-primary btn-sm" id="btnAdminLogMeeting" style="font-weight: 700; background: #16a34a; border-color: #15803d;">🌾 + Log Farmer Meeting</button>
        <button class="btn btn-secondary btn-sm" id="btnAdminAddDemo" style="font-weight: 700; color: #15803d; border-color: rgba(22,163,74,0.5);">🌱 + Register Demo Plot</button>
        <button class="btn btn-secondary btn-sm" id="btnAdminAddLead" style="font-weight: 700; color: #0284c7; border-color: rgba(2,132,199,0.5);">💡 + Add Farmer Lead</button>
      </div>
    </div>

    <!-- Executive KPI Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Tier-A Dealers</span>
        <div class="kpi-value">${totalCount}</div>
        <span class="kpi-sub">Across ${assistants.length} Field Assistants</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Field Outreach Rate</span>
        <div class="kpi-value" style="color: var(--primary);">${overallPct}%</div>
        <span class="kpi-sub">${contactedCount} of ${totalCount} dealers contacted/updated</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Orders Booked (Closed)</span>
        <div class="kpi-value" style="color: var(--success);">${closedCount}</div>
        <span class="kpi-sub">${contactedCount ? Math.round((closedCount / contactedCount) * 100) : 0}% conversion on outreach</span>
      </div>

      <div class="kpi-card">
        <span class="kpi-label">Est. Sales Pipeline</span>
        <div class="kpi-value" style="font-size: 24px; color: var(--accent);">₹${(estMin / 100000).toFixed(1)}L - ${(estMax / 100000).toFixed(1)}L</div>
        <span class="kpi-sub">Aggregated dealer counter potential</span>
      </div>
    </div>

    <!-- 🏆 MGO 100-POINT KPI LEADERBOARD & PERFORMANCE STANDARDS -->
    <div class="card" style="border-top: 4px solid var(--primary); background: var(--surface);">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">🏆</span>
            <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">
              MGO Performance Leaderboard (100-Point Model)
            </h3>
            <span class="badge" style="background: var(--primary-subtle); color: var(--primary); font-weight: 800;">
              Weekly Team Avg: ${avgScore}/100
            </span>
          </div>
          <p style="color: var(--muted); font-size: 12px; margin-top: 3px; margin-bottom: 0;">
            Evaluates all 8 Assistants across 6 Core SOP Pillars: Technical (10) · Competitor (15) · Farmer (25) · Planning (20) · AQFS (15) · Dealer (15).
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary btn-sm" id="btnExportKpiExcel" style="font-weight: 700;">
            📥 Export Weekly Master (.xlsx)
          </button>
        </div>
      </div>

      <!-- Performance Standards Rubric Strip -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; font-size: 11.5px;">
        <span class="badge" style="background: #dcfce7; color: #166534; font-weight: 700; padding: 4px 10px;">⭐ 90–100: Exceptional</span>
        <span class="badge" style="background: #e0f2fe; color: #0284c7; font-weight: 700; padding: 4px 10px;">🟢 80–89: Strong</span>
        <span class="badge" style="background: #dbeafe; color: #2563eb; font-weight: 700; padding: 4px 10px;">🔵 70–79: Meets Expectations</span>
        <span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 700; padding: 4px 10px;">🟠 60–69: Improvement Required</span>
        <span class="badge" style="background: #fee2e2; color: #dc2626; font-weight: 700; padding: 4px 10px;">🔴 &lt; 60: PIP Required</span>
      </div>

      <!-- Ranked Assistant Scorecards Grid -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${assistantScores.map((s, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
          const asstObj = assistants.find(a => a.name === s.assistant) || {};
          return `
            <div class="card" style="padding: 14px 16px; margin: 0; background: var(--surface-alt); border-left: 4px solid ${s.grade.color}; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
              <div style="display: flex; align-items: center; gap: 12px; min-width: 220px;">
                <div style="font-size: 20px; font-weight: 800; width: 32px; text-align: center; color: var(--ink);">
                  ${medal}
                </div>
                <div>
                  <div style="font-weight: 800; font-size: 14.5px; color: var(--ink); font-family: var(--font-heading);">
                    ${escapeHtml(s.assistant)}
                  </div>
                  <div style="font-size: 12px; color: var(--muted);">
                    HQ: <strong>${escapeHtml(asstObj.hq || '')}</strong> (${escapeHtml(asstObj.district || '')}) · 👥 ${s.counts.farmerMeetings} Meetings · 🌱 ${s.counts.demoPlots} Demos · 🌾 ${s.counts.farmerLeads} Leads · 🏬 ${s.counts.retailerCheckIns} Visits
                  </div>
                </div>
              </div>

              <!-- 6 Pillars Mini Breakdown -->
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 11px;">
                <div style="text-align: center; background: var(--surface); padding: 4px 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
                  <div style="color: var(--muted);">Tech</div>
                  <div style="font-weight: 800; color: #0284c7;">${s.breakdown.p1_techKnowledge.score}/10</div>
                </div>
                <div style="text-align: center; background: var(--surface); padding: 4px 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
                  <div style="color: var(--muted);">Intel</div>
                  <div style="font-weight: 800; color: #7c3aed;">${s.breakdown.p2_competitorIntel.score}/15</div>
                </div>
                <div style="text-align: center; background: var(--surface); padding: 4px 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
                  <div style="color: var(--muted);">Farmer</div>
                  <div style="font-weight: 800; color: #16a34a;">${s.breakdown.p3_farmerEngagement.score}/25</div>
                </div>
                <div style="text-align: center; background: var(--surface); padding: 4px 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
                  <div style="color: var(--muted);">Plan</div>
                  <div style="font-weight: 800; color: #ea580c;">${s.breakdown.p4_planningSales.score}/20</div>
                </div>
                <div style="text-align: center; background: var(--surface); padding: 4px 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
                  <div style="color: var(--muted);">AQFS</div>
                  <div style="font-weight: 800; color: #0d9488;">${s.breakdown.p5_aqfsQuality.score}/15</div>
                </div>
                <div style="text-align: center; background: var(--surface); padding: 4px 8px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
                  <div style="color: var(--muted);">Dealer</div>
                  <div style="font-weight: 800; color: #d97706;">${s.breakdown.p6_dealerFeedback.score}/15</div>
                </div>
              </div>

              <!-- Score & Action -->
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div style="text-align: right; margin-right: 6px;">
                  <div style="font-size: 22px; font-weight: 800; font-family: var(--font-heading); color: ${s.grade.color}; line-height: 1;">
                    ${s.totalScore}<span style="font-size: 13px; color: var(--muted);">/100</span>
                  </div>
                  <span class="badge" style="background: ${s.grade.bg}; color: ${s.grade.color}; font-weight: 700; font-size: 10px; margin-top: 3px; display: inline-block;">
                    ${s.grade.label}
                  </span>
                </div>

                <button type="button" class="btn btn-secondary btn-sm btn-audit-asst-aqfs" data-asst="${escapeHtml(s.assistant)}" style="font-weight: 700; font-size: 11.5px; color: #0d9488; border-color: rgba(13, 148, 136, 0.4); white-space: nowrap;" title="Audit Activity Quality & Field Standards">
                  🛡️ Audit AQFS
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-view-asst-weekly" data-asst="${escapeHtml(s.assistant)}" style="font-weight: 700; font-size: 11.5px; color: #ea580c; border-color: rgba(234, 88, 12, 0.4); white-space: nowrap;" title="Inspect Weekly Operating Review">
                  📅 Review
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-view-asst-kpi" data-asst="${escapeHtml(s.assistant)}" style="font-weight: 700; font-size: 11.5px; white-space: nowrap;">
                  📊 Scorecard
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- ASSISTANT & TERRITORY MANAGEMENT SECTION -->
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
        <div>
          <h3 style="font-family: var(--font-heading); font-size: 17px; font-weight: 700;">
            🗺️ Field Assistants & Territory Hubs (${assistants.length})
          </h3>
          <p style="color: var(--muted); font-size: 12px; margin-top: 2px;">
            Update assistant names, assign/reassign territory blocks, and modify dealer quotas.
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btnAdminAddAssistant2">+ Add Assistant</button>
          <button class="btn btn-primary btn-sm" id="btnAdminReassignBlock2">🔄 Reassign Territory Block</button>
        </div>
      </div>

      <div class="assistant-grid" style="margin-top: 0;">
        ${assistants.map(a => {
          const rows = allRows.filter(r => r.assistant === a.name);
          const done = rows.filter(r => (r.status && r.status !== 'Pending') || r.mobile || r.potentialFor).length;
          const pct = a.target ? Math.round((done / a.target) * 100) : 0;
          return `
            <div class="assistant-card" style="cursor: default;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div class="assistant-card-title">${escapeHtml(a.name)}</div>
                <button class="btn btn-secondary btn-sm btn-edit-asst" data-asst="${escapeHtml(a.name)}" style="padding: 3px 8px; font-size: 11px;">
                  ✏️ Edit
                </button>
              </div>
              <div class="assistant-card-hq">
                📍 HQ: <strong>${escapeHtml(a.hq)}</strong> · District: <strong>${escapeHtml(a.district)}</strong>
              </div>
              <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 8px;">
                Blocks: <strong>${escapeHtml((a.blocks || []).join(', ') || 'All District')}</strong>
              </div>
              <div style="font-size: 11.5px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; background: var(--surface-alt); padding: 4px 8px; border-radius: var(--radius-xs);">
                <span style="color: var(--muted); font-weight: 600;">🔑 Rep Password:</span>
                <code style="font-weight: 700; color: var(--primary);">${escapeHtml(a.password || 'rep123')}</code>
              </div>
              <div class="progress-container" style="height: 6px; margin-bottom: 6px;">
                <div class="progress-fill" style="width: ${Math.min(pct, 100)}%;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); font-weight: 600;">
                <span>${rows.length} assigned (${done} contacted)</span>
                <span style="color: var(--primary);">Target: ${a.target} (${pct}%)</span>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Analytics Split: Demand & Data Operations -->
    <div class="analytics-split">
      <div class="card">
        <h3 style="font-family: var(--font-heading); font-size: 17px; margin-bottom: 14px;">Market Demand Distribution</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; font-weight: 600;">
              <span>🥦 Vegetable Seeds (Veg)</span>
              <span>${catVeg} dealers (${totalCount ? Math.round((catVeg / totalCount) * 100) : 0}%)</span>
            </div>
            <div class="progress-container"><div class="progress-fill" style="width: ${totalCount ? (catVeg / totalCount) * 100 : 0}%; background: #16a34a;"></div></div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; font-weight: 600;">
              <span>🛡️ Crop Protection (CP)</span>
              <span>${catCP} dealers (${totalCount ? Math.round((catCP / totalCount) * 100) : 0}%)</span>
            </div>
            <div class="progress-container"><div class="progress-fill" style="width: ${totalCount ? (catCP / totalCount) * 100 : 0}%; background: #0284c7;"></div></div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; font-weight: 600;">
              <span>🌾 Field Crops (Paddy/Wheat/Maize)</span>
              <span>${catField} dealers (${totalCount ? Math.round((catField / totalCount) * 100) : 0}%)</span>
            </div>
            <div class="progress-container"><div class="progress-fill" style="width: ${totalCount ? (catField / totalCount) * 100 : 0}%; background: #d97706;"></div></div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px; font-weight: 600;">
              <span>📦 Multi-Category</span>
              <span>${catMulti} dealers (${totalCount ? Math.round((catMulti / totalCount) * 100) : 0}%)</span>
            </div>
            <div class="progress-container"><div class="progress-fill" style="width: ${totalCount ? (catMulti / totalCount) * 100 : 0}%; background: #9333ea;"></div></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-family: var(--font-heading); font-size: 17px; margin-bottom: 14px;">Manager Data Operations</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <input type="file" id="fileInputExcel" accept=".xlsx,.xls,.csv" style="display: none;">
          <button class="btn btn-secondary" id="btnTriggerImport" style="justify-content: flex-start;">
            📥 Import Spreadsheet (XLSX / CSV)
          </button>
          <button class="btn btn-secondary" id="btnExportXlsx" style="justify-content: flex-start;">
            📤 Export Complete Excel (.xlsx)
          </button>
          <button class="btn btn-secondary" id="btnExportCsv" style="justify-content: flex-start;">
            📄 Export CSV File
          </button>
          <button class="btn btn-secondary" id="btnResetDatabase" style="color: var(--danger); justify-content: flex-start;">
            🔄 Reset Database & Baseline Hubs
          </button>
        </div>
        <p id="importStatusMsg" style="font-size: 12px; color: var(--muted); margin-top: 10px;"></p>
      </div>
    </div>
  `;
}

// =========================================================================
// TAB 2: FIELD OPERATIONS REGISTRY
// =========================================================================
function renderFieldOpsTab(data) {
  const { assistants, allMeetings, allDemos, allIntel, allLeads } = data;
  const q = (fieldOpsSearch || '').toLowerCase().trim();

  let subTabTitle = '';
  let subTabAddBtnText = '';
  let subTabAddBtnId = '';
  let tableHeaderHtml = '';
  let tableRowsHtml = '';
  let totalFieldOps = 0;
  let totalFieldPages = 1;
  let fieldStart = 0;

  if (currentFieldOpsSubTab === 'meetings') {
    subTabTitle = 'Farmer Meetings & Field Days (Pillar 3)';
    subTabAddBtnText = '🌾 + Log Farmer Meeting';
    subTabAddBtnId = 'btnFieldOpsAddMeeting';
    tableHeaderHtml = `
      <tr>
        <th>Date</th>
        <th>Assistant / Rep</th>
        <th>Village & Block</th>
        <th>District</th>
        <th>Crop & Type</th>
        <th>Attendance</th>
        <th>Lead Farmers</th>
        <th>Key Discussion & Agronomic Advice</th>
        <th style="text-align: right;">Action</th>
      </tr>
    `;

    const filtered = allMeetings.filter(m => {
      if (fieldOpsRepFilter && m.assistant !== fieldOpsRepFilter) return false;
      if (q) {
        const match = (m.village || '').toLowerCase().includes(q) ||
          (m.block || '').toLowerCase().includes(q) ||
          (m.district || '').toLowerCase().includes(q) ||
          (m.crop || '').toLowerCase().includes(q) ||
          (m.assistant || '').toLowerCase().includes(q) ||
          (m.key_discussion || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    totalFieldOps = filtered.length;
    totalFieldPages = Math.ceil(totalFieldOps / fieldOpsPageSize) || 1;
    if (fieldOpsPage < 1) fieldOpsPage = 1;
    if (fieldOpsPage > totalFieldPages) fieldOpsPage = totalFieldPages;
    fieldStart = (fieldOpsPage - 1) * fieldOpsPageSize;
    const paged = filtered.slice(fieldStart, fieldStart + fieldOpsPageSize);

    if (totalFieldOps === 0) {
      tableRowsHtml = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--muted);">No farmer meetings matching filter.</td></tr>`;
    } else {
      tableRowsHtml = paged.map(m => `
        <tr>
          <td><strong style="font-size: 12.5px;">${escapeHtml(m.date || '')}</strong></td>
          <td><strong>${escapeHtml(m.assistant || '')}</strong></td>
          <td>${escapeHtml(m.village || '')} · <span style="color: var(--muted);">${escapeHtml(m.block || '')}</span></td>
          <td>${escapeHtml(m.district || '')}</td>
          <td>
            <span class="badge" style="background: rgba(22, 163, 74, 0.12); color: #16a34a; font-weight: 700;">${escapeHtml(m.crop || '')}</span>
            <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${escapeHtml(m.meeting_type || 'Group Meeting')}</div>
          </td>
          <td><span style="font-weight: 800; font-size: 14px; color: var(--primary);">${m.attendees_count || 0}</span> farmers</td>
          <td style="font-size: 12px;">
            ${(m.lead_farmers || []).map(f => `<div>${escapeHtml(f.name)} (${escapeHtml(f.acre || '')} ac)</div>`).join('') || '—'}
          </td>
          <td style="max-width: 250px; font-size: 12px; color: var(--ink-secondary);">
            ${escapeHtml(m.key_discussion || '—')}
          </td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm btn-delete-meeting" data-id="${m.id}" style="color: var(--danger); padding: 2px 8px; font-size: 11px;">✕ Delete</button>
          </td>
        </tr>
      `).join('');
    }
  } else if (currentFieldOpsSubTab === 'demos') {
    subTabTitle = 'Demo Plots & Trial Records (Pillar 3)';
    subTabAddBtnText = '🌱 + Register Demo Plot';
    subTabAddBtnId = 'btnFieldOpsAddDemo';
    tableHeaderHtml = `
      <tr>
        <th>Farmer & Contact</th>
        <th>Assistant / Rep</th>
        <th>Location</th>
        <th>Crop & Tested Hybrid</th>
        <th>Competitor Check</th>
        <th>Sowing Date</th>
        <th>Current Stage</th>
        <th>Field Observations</th>
        <th style="text-align: right;">Action</th>
      </tr>
    `;

    const filtered = allDemos.filter(d => {
      if (fieldOpsRepFilter && d.assistant !== fieldOpsRepFilter) return false;
      if (q) {
        const match = (d.farmer_name || '').toLowerCase().includes(q) ||
          (d.village || '').toLowerCase().includes(q) ||
          (d.crop || '').toLowerCase().includes(q) ||
          (d.hybrid_tested || '').toLowerCase().includes(q) ||
          (d.assistant || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    totalFieldOps = filtered.length;
    totalFieldPages = Math.ceil(totalFieldOps / fieldOpsPageSize) || 1;
    if (fieldOpsPage < 1) fieldOpsPage = 1;
    if (fieldOpsPage > totalFieldPages) fieldOpsPage = totalFieldPages;
    fieldStart = (fieldOpsPage - 1) * fieldOpsPageSize;
    const paged = filtered.slice(fieldStart, fieldStart + fieldOpsPageSize);

    if (totalFieldOps === 0) {
      tableRowsHtml = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--muted);">No demo plots registered yet.</td></tr>`;
    } else {
      tableRowsHtml = paged.map(d => `
        <tr>
          <td>
            <strong>${escapeHtml(d.farmer_name || '')}</strong>
            <div style="font-size: 11px; color: var(--muted);">${escapeHtml(d.farmer_mobile || '—')}</div>
          </td>
          <td><strong>${escapeHtml(d.assistant || '')}</strong></td>
          <td>${escapeHtml(d.village || '')}, ${escapeHtml(d.block || '')}</td>
          <td>
            <div style="font-weight: 700; color: #16a34a;">${escapeHtml(d.crop || '')}</div>
            <div style="font-size: 11.5px; font-weight: 600;">${escapeHtml(d.hybrid_tested || '')}</div>
          </td>
          <td><span class="badge" style="background: rgba(220, 38, 38, 0.1); color: #dc2626; font-size: 11px;">vs ${escapeHtml(d.competitor_check || 'Standard')}</span></td>
          <td style="font-size: 12px;">${escapeHtml(d.sowing_date || '—')}</td>
          <td>
            <span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; font-weight: 700; font-size: 11px;">
              ${escapeHtml(d.current_stage || 'Planted')}
            </span>
          </td>
          <td style="max-width: 250px; font-size: 12px; color: var(--ink-secondary);">
            ${escapeHtml(d.observations || '—')}
          </td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm btn-delete-demo" data-id="${d.id}" style="color: var(--danger); padding: 2px 8px; font-size: 11px;">✕ Delete</button>
          </td>
        </tr>
      `).join('');
    }
  } else if (currentFieldOpsSubTab === 'leads') {
    subTabTitle = 'Farmer Demand Leads & Dealer Liquidation Linkage (Pillar 4)';
    subTabAddBtnText = '💡 + Add Farmer Lead';
    subTabAddBtnId = 'btnFieldOpsAddLead';
    tableHeaderHtml = `
      <tr>
        <th>Farmer & Contact</th>
        <th>Assistant / Rep</th>
        <th>Village & District</th>
        <th>Crop & Acreage</th>
        <th>Target Retailer / Counter</th>
        <th>Funnel Stage</th>
        <th>Est Demand / Packets</th>
        <th style="text-align: right;">Action</th>
      </tr>
    `;

    const filtered = allLeads.filter(l => {
      if (fieldOpsRepFilter && l.assistant !== fieldOpsRepFilter) return false;
      if (q) {
        const match = (l.farmer_name || '').toLowerCase().includes(q) ||
          (l.village || '').toLowerCase().includes(q) ||
          (l.crop || '').toLowerCase().includes(q) ||
          (l.retailer_name || '').toLowerCase().includes(q) ||
          (l.assistant || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    totalFieldOps = filtered.length;
    totalFieldPages = Math.ceil(totalFieldOps / fieldOpsPageSize) || 1;
    if (fieldOpsPage < 1) fieldOpsPage = 1;
    if (fieldOpsPage > totalFieldPages) fieldOpsPage = totalFieldPages;
    fieldStart = (fieldOpsPage - 1) * fieldOpsPageSize;
    const paged = filtered.slice(fieldStart, fieldStart + fieldOpsPageSize);

    if (totalFieldOps === 0) {
      tableRowsHtml = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--muted);">No farmer demand leads recorded.</td></tr>`;
    } else {
      tableRowsHtml = paged.map(l => {
        const stageColors = {
          'Awareness': '#64748b',
          'Demo Converted': '#0284c7',
          'Pre-Booking': '#d97706',
          'Liquidation Complete': '#16a34a'
        };
        const stColor = stageColors[l.funnel_stage] || '#0284c7';
        return `
          <tr>
            <td>
              <strong>${escapeHtml(l.farmer_name || '')}</strong>
              <div style="font-size: 11px; color: var(--muted);">${escapeHtml(l.farmer_mobile || '—')}</div>
            </td>
            <td><strong>${escapeHtml(l.assistant || '')}</strong></td>
            <td>${escapeHtml(l.village || '')}, ${escapeHtml(l.district || '')}</td>
            <td>
              <strong>${escapeHtml(l.crop || '')}</strong>
              <div style="font-size: 11px; color: var(--muted);">${escapeHtml(l.acres || 1)} Acres</div>
            </td>
            <td>
              <strong>${escapeHtml(l.retailer_name || 'Direct / Village')}</strong>
              <div style="font-size: 11px; color: var(--muted);">${escapeHtml(l.retailer_id || '')}</div>
            </td>
            <td>
              <span class="badge" style="background: ${stColor}18; color: ${stColor}; font-weight: 700; font-size: 11px;">
                ${escapeHtml(l.funnel_stage || 'Awareness')}
              </span>
            </td>
            <td><strong>${escapeHtml(l.estimated_packets || 1)}</strong> pkts</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-sm btn-delete-lead" data-id="${l.id}" style="color: var(--danger); padding: 2px 8px; font-size: 11px;">✕ Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } else if (currentFieldOpsSubTab === 'intel') {
    subTabTitle = 'Competitor Intelligence & Pricing Monitor (Pillar 2)';
    subTabAddBtnText = '🛡️ + Add Intel Record';
    subTabAddBtnId = 'btnFieldOpsAddIntel';
    tableHeaderHtml = `
      <tr>
        <th>Date</th>
        <th>Assistant / Rep</th>
        <th>Retailer & Block</th>
        <th>Competitor Brand & Product</th>
        <th>Crop Category</th>
        <th>Retail vs Dealer Price</th>
        <th>Promotional Scheme</th>
        <th>Farmer Sentiment</th>
        <th style="text-align: right;">Action</th>
      </tr>
    `;

    const filtered = allIntel.filter(c => {
      if (fieldOpsRepFilter && c.assistant !== fieldOpsRepFilter) return false;
      if (q) {
        const match = (c.retailer_name || '').toLowerCase().includes(q) ||
          (c.competitor_brand || '').toLowerCase().includes(q) ||
          (c.product_name || '').toLowerCase().includes(q) ||
          (c.crop || '').toLowerCase().includes(q) ||
          (c.assistant || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    totalFieldOps = filtered.length;
    totalFieldPages = Math.ceil(totalFieldOps / fieldOpsPageSize) || 1;
    if (fieldOpsPage < 1) fieldOpsPage = 1;
    if (fieldOpsPage > totalFieldPages) fieldOpsPage = totalFieldPages;
    fieldStart = (fieldOpsPage - 1) * fieldOpsPageSize;
    const paged = filtered.slice(fieldStart, fieldStart + fieldOpsPageSize);

    if (totalFieldOps === 0) {
      tableRowsHtml = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--muted);">No competitor intel records logged.</td></tr>`;
    } else {
      tableRowsHtml = paged.map(c => `
        <tr>
          <td><strong style="font-size: 12px;">${escapeHtml(c.date || '')}</strong></td>
          <td><strong>${escapeHtml(c.assistant || '')}</strong></td>
          <td>
            <strong>${escapeHtml(c.retailer_name || '')}</strong>
            <div style="font-size: 11px; color: var(--muted);">${escapeHtml(c.block || '')}, ${escapeHtml(c.district || '')}</div>
          </td>
          <td>
            <div style="font-weight: 700; color: #7c3aed;">${escapeHtml(c.competitor_brand || '')}</div>
            <div style="font-size: 12px;">${escapeHtml(c.product_name || '')}</div>
          </td>
          <td>${escapeHtml(c.crop || 'All')}</td>
          <td>
            <div style="font-weight: 700; color: var(--ink);">₹${escapeHtml(c.retail_price || '—')} <span style="font-size: 10.5px; color: var(--muted);">(Retail)</span></div>
            <div style="font-size: 11px; color: var(--muted);">₹${escapeHtml(c.dealer_price || '—')} (Dealer)</div>
          </td>
          <td style="max-width: 220px; font-size: 11.5px; color: var(--ink-secondary);">
            ${escapeHtml(c.promotional_scheme || 'None')}
          </td>
          <td>
            <span class="badge" style="background: rgba(22, 163, 74, 0.12); color: #16a34a; font-weight: 700; font-size: 11px;">
              ${escapeHtml(c.farmer_sentiment || 'Moderate')}
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm btn-delete-intel" data-id="${c.id}" style="color: var(--danger); padding: 2px 8px; font-size: 11px;">✕ Delete</button>
          </td>
        </tr>
      `).join('');
    }
  }

  return `
    <div class="card">
      <!-- Sub-Tabs Navigation Strip -->
      <div class="field-sub-tabs">
        <button class="field-sub-tab-btn ${currentFieldOpsSubTab === 'meetings' ? 'active' : ''}" data-subtab="meetings">
          👥 Farmer Meetings (${allMeetings.length})
        </button>
        <button class="field-sub-tab-btn ${currentFieldOpsSubTab === 'demos' ? 'active' : ''}" data-subtab="demos">
          🌱 Demo Plots & Trials (${allDemos.length})
        </button>
        <button class="field-sub-tab-btn ${currentFieldOpsSubTab === 'leads' ? 'active' : ''}" data-subtab="leads">
          💡 Farmer Leads (${allLeads.length})
        </button>
        <button class="field-sub-tab-btn ${currentFieldOpsSubTab === 'intel' ? 'active' : ''}" data-subtab="intel">
          🛡️ Competitor Intel (${allIntel.length})
        </button>
      </div>

      <!-- Header & Search Controls -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
        <div>
          <h3 style="font-family: var(--font-heading); font-size: 17px; margin: 0;">${subTabTitle}</h3>
          <p style="color: var(--muted); font-size: 12px; margin-top: 2px; margin-bottom: 0;">Verified field logs uploaded by reps across 8 Bihar operating territories.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="${subTabAddBtnId}" style="font-weight: 700;">${subTabAddBtnText}</button>
      </div>

      <!-- Filters Toolbar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 14px;">
        <input type="text" id="fieldOpsSearchInput" placeholder="🔍 Search records..." value="${escapeHtml(fieldOpsSearch)}">
        <select id="fieldOpsRepFilterSelect">
          <option value="">All Field Assistants</option>
          ${assistants.map(a => `<option value="${escapeHtml(a.name)}" ${fieldOpsRepFilter === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
      </div>

      <!-- Table Wrapper -->
      <div class="table-wrapper">
        <table>
          <thead>${tableHeaderHtml}</thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </div>

      <!-- Field Ops Pagination -->
      ${totalFieldOps > 0 ? `
        <div class="pagination" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 14px; padding: 12px 6px; border-top: 1px solid var(--line);">
          <span style="font-size: 13px; font-weight: 600; color: var(--muted);">
            Showing <strong>${fieldStart + 1}–${Math.min(fieldStart + fieldOpsPageSize, totalFieldOps)}</strong> of <strong>${totalFieldOps}</strong> records
          </span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btnFieldOpsPrev" ${fieldOpsPage <= 1 ? 'disabled' : ''} style="padding: 4px 12px; font-size: 12px; font-weight: 700;">◀ Prev</button>
            <div style="font-size: 12.5px; font-weight: 700; color: var(--ink); padding: 0 8px; background: var(--surface-alt); border-radius: var(--radius-xs); border: 1px solid var(--line); line-height: 28px;">
              Page <span style="color: var(--primary);">${fieldOpsPage}</span> of ${totalFieldPages}
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnFieldOpsNext" ${fieldOpsPage >= totalFieldPages ? 'disabled' : ''} style="padding: 4px 12px; font-size: 12px; font-weight: 700;">Next ▶</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// =========================================================================
// TAB 3: DAILY OPERATING CYCLE (EOD) INBOX
// =========================================================================
function renderEodTab(data) {
  const { assistants, allLogs, allMeetings, allIntel } = data;
  const targetDate = eodFilterDate || getTodayDateStr();

  const reports = assistants.map(a => {
    const report = storage.getEodReport(a.name, targetDate);
    const dayVisits = allLogs.filter(l => l.rep === a.name && l.date === targetDate).length;
    const dayMeetings = allMeetings.filter(m => m.assistant === a.name && m.date === targetDate).length;
    const dayIntel = allIntel.filter(i => i.assistant === a.name && i.date === targetDate).length;
    return {
      assistant: a.name,
      hq: a.hq,
      district: a.district,
      report,
      dayVisits,
      dayMeetings,
      dayIntel
    };
  });

  const submittedCount = reports.filter(r => r.report && r.report.submittedAt).length;

  return `
    <div class="card">
      <!-- Date Bar & Controls -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">⏱️</span>
            <h3 style="font-family: var(--font-heading); font-size: 17px; margin: 0;">Daily Operating Cycle (EOD) Review Feed</h3>
            <span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; font-weight: 800;">
              ${submittedCount}/${assistants.length} Submitted for ${targetDate}
            </span>
          </div>
          <p style="color: var(--muted); font-size: 12.5px; margin-top: 3px; margin-bottom: 0;">
            Supervisory feed to review evening wrap-up summaries, key wins, bottlenecks, and award daily +5 habit points.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btnEodToday" style="${targetDate === getTodayDateStr() ? 'border-color: var(--primary); font-weight: 700;' : ''}">Today</button>
          <button class="btn btn-secondary btn-sm" id="btnEodYesterday" style="${targetDate === getYesterdayDateStr() ? 'border-color: var(--primary); font-weight: 700;' : ''}">Yesterday</button>
          <input type="date" id="eodDateInput" value="${targetDate}" style="padding: 5px 8px; font-size: 12px;">
        </div>
      </div>

      <!-- Feed Grid -->
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${reports.map(r => {
          const hasSubmitted = Boolean(r.report && r.report.submittedAt);
          const report = r.report || {};
          const isAck = Boolean(report.acknowledged);

          return `
            <div class="card" style="padding: 16px; margin: 0; background: var(--surface-alt); border-left: 4px solid ${hasSubmitted ? (isAck ? '#16a34a' : '#0284c7') : '#f59e0b'};">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="font-size: 15px; color: var(--ink); font-family: var(--font-heading);">${escapeHtml(r.assistant)}</strong>
                    <span class="badge" style="font-size: 11px;">📍 ${escapeHtml(r.hq)} (${escapeHtml(r.district)})</span>
                  </div>
                  <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                    ${hasSubmitted 
                      ? `Submitted on ${new Date(report.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                      : `<span style="color: #d97706; font-weight: 700;">⚠️ EOD Submission Pending</span>`}
                  </div>
                </div>

                <div style="display: flex; gap: 6px; align-items: center;">
                  <span class="badge" style="background: rgba(2, 132, 199, 0.1); color: #0284c7; font-weight: 700; font-size: 11px;">
                    🏬 ${r.dayVisits} Visits Logged
                  </span>
                  <span class="badge" style="background: rgba(22, 163, 74, 0.1); color: #16a34a; font-weight: 700; font-size: 11px;">
                    🌾 ${r.dayMeetings} Farmer Meetings
                  </span>
                  <span class="badge" style="background: rgba(124, 58, 237, 0.1); color: #7c3aed; font-weight: 700; font-size: 11px;">
                    🛡️ ${r.dayIntel} Intel Points
                  </span>
                </div>
              </div>

              ${hasSubmitted ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; background: var(--surface); padding: 12px; border-radius: var(--radius-xs); border: 1px solid var(--line);">
                  <div>
                    <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">🌟 Key Highlights & Market Feedback</div>
                    <div style="font-size: 12.5px; color: var(--ink); margin-top: 4px; line-height: 1.4;">
                      ${escapeHtml(report.highlights || 'No specific highlights noted for today.')}
                    </div>
                  </div>

                  <div>
                    <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">🚧 Field Bottlenecks / HQ Support Required</div>
                    <div style="font-size: 12.5px; color: ${report.bottlenecks ? '#dc2626' : 'var(--ink)'}; margin-top: 4px; line-height: 1.4;">
                      ${escapeHtml(report.bottlenecks || 'None reported. Operations running smoothly.')}
                    </div>
                  </div>
                </div>

                <!-- Manager Acknowledgement Box -->
                <div style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                  ${isAck ? `
                    <div style="display: flex; align-items: center; gap: 8px; color: #16a34a; font-weight: 700; font-size: 12.5px;">
                      <span>✅ Acknowledged by Manager:</span>
                      <span style="font-weight: 500; color: var(--ink); font-style: italic;">"${escapeHtml(report.managerFeedback || 'Approved')}"</span>
                    </div>
                  ` : `
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 260px;">
                      <input type="text" id="eodFeedback_${escapeHtml(r.assistant)}" placeholder="Add manager feedback note..." style="flex: 1; padding: 6px 10px; font-size: 12px;">
                      <button class="btn btn-primary btn-sm btn-ack-eod" data-asst="${escapeHtml(r.assistant)}" data-date="${targetDate}" style="font-weight: 700; white-space: nowrap;">
                        ✓ Acknowledge & Approve (+5 pts)
                      </button>
                    </div>
                  `}
                </div>
              ` : `
                <div style="margin-top: 6px; font-size: 12px; color: var(--muted); font-style: italic;">
                  Field rep has not submitted their EOD cycle for ${targetDate} yet. Daily deadline is 8:30 PM IST.
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// =========================================================================
// TAB 4: AGRONOMY QUIZ STUDIO & COMPLIANCE
// =========================================================================
function renderQuizTab(data) {
  const { assistants, allQuestions } = data;

  const quizCompliance = assistants.map(a => {
    const qState = storage.getQuizState(a.name);
    return {
      assistant: a.name,
      hq: a.hq,
      district: a.district,
      state: qState,
      completed: Boolean(qState && qState.completedAt),
      score: qState ? qState.score : 0,
      total: qState ? qState.total : (allQuestions.length || 5),
      pct: qState && qState.total ? Math.round((qState.score / qState.total) * 100) : 0,
      completedAt: qState ? qState.completedAt : null
    };
  });

  const completedRepsCount = quizCompliance.filter(c => c.completed).length;

  return `
    <div class="card">
      <!-- Banner & Manager Actions -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">🎓</span>
            <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">
              Agronomy Knowledge Studio & Weekly Rep Assessments
            </h3>
            <span class="badge" style="background: rgba(147, 51, 234, 0.12); color: #9333ea; font-weight: 800;">
              ${completedRepsCount}/${assistants.length} Reps Completed
            </span>
          </div>
          <p style="color: var(--muted); font-size: 12.5px; margin-top: 3px; margin-bottom: 0;">
            Evaluate field reps on hybrid agronomy, pest thresholds (Pillar 1), and manage the active curriculum question bank.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" id="btnAdminManageQuestions" style="font-weight: 700; background: #7c3aed; border-color: #6d28d9;">
            📚 Question Bank Studio (${allQuestions.length} Qs)
          </button>
          <button class="btn btn-secondary btn-sm" id="btnAdminResetQuizCycle" style="font-weight: 700; color: #ea580c; border-color: rgba(234, 88, 12, 0.4);">
            🔄 Launch New Weekly Cycle (Reset Reps)
          </button>
        </div>
      </div>

      <!-- Rep Assessment Compliance Table -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Field Assistant & Hub</th>
              <th>District</th>
              <th>Assessment Status</th>
              <th>Agronomy Score</th>
              <th>Completion Timestamp</th>
              <th>Pillar 1 Tech Rating</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${quizCompliance.map(c => `
              <tr>
                <td>
                  <strong style="color: var(--ink); font-size: 13.5px;">${escapeHtml(c.assistant)}</strong>
                  <div style="font-size: 11px; color: var(--muted);">HQ: ${escapeHtml(c.hq)}</div>
                </td>
                <td>${escapeHtml(c.district)}</td>
                <td>
                  ${c.completed 
                    ? `<span class="badge" style="background: rgba(22, 163, 74, 0.12); color: #16a34a; font-weight: 700;">✅ Completed</span>` 
                    : `<span class="badge" style="background: rgba(245, 158, 11, 0.12); color: #d97706; font-weight: 700;">⏳ Due / Incomplete</span>`}
                </td>
                <td>
                  ${c.completed ? `
                    <div style="font-weight: 800; font-size: 14px; color: ${c.pct >= 80 ? '#16a34a' : '#d97706'};">
                      ${c.score} / ${c.total} <span style="font-size: 11px; font-weight: 600;">(${c.pct}%)</span>
                    </div>
                  ` : `<span style="color: var(--muted); font-size: 12px;">—</span>`}
                </td>
                <td style="font-size: 12px; color: var(--muted);">
                  ${c.completedAt ? new Date(c.completedAt).toLocaleString() : 'Not attempted'}
                </td>
                <td>
                  ${c.completed ? (
                    c.pct >= 80 
                      ? `<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 700;">⭐ Master Agronomist</span>` 
                      : `<span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 700;">⚠️ Refresher Needed</span>`
                  ) : `<span style="color: var(--muted); font-size: 12px;">Pending</span>`}
                </td>
                <td style="text-align: right;">
                  ${c.completed ? `
                    <button class="btn btn-secondary btn-sm btn-audit-rep-quiz" data-asst="${escapeHtml(c.assistant)}" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: #16a34a; border-color: rgba(22, 163, 74, 0.4);">
                      🔍 Audit Rep Answers
                    </button>
                  ` : `
                    <button class="btn btn-secondary btn-sm btn-remind-quiz" data-asst="${escapeHtml(c.assistant)}" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: var(--primary);">
                      🔔 Send Reminder
                    </button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =========================================================================
// TAB 5: DYNAMIC FORM STUDIO & SURVEY DEPLOYMENT
// =========================================================================
function renderDynamicFormsTab(data) {
  const { assistants, allDynamicForms, allFormSubmissions } = data;
  const activeForms = allDynamicForms.filter(f => f.status === 'active');
  const geotaggedSubmissions = allFormSubmissions.filter(s => s.location && s.location.lat);

  return `
    <div class="card" style="border: 1px solid rgba(2, 132, 199, 0.35); box-shadow: var(--shadow-md);">
      <!-- Top Action Strip -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">📝</span>
            <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0;">
              Dynamic Survey Studio & Custom Agronomy Audits
            </h3>
            <span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; font-weight: 800;">
              ${allDynamicForms.length} Total Forms
            </span>
          </div>
          <p style="color: var(--muted); font-size: 12.5px; margin-top: 3px; margin-bottom: 0;">
            Build custom survey questionnaires, deploy individually or by territory hub, collect tamper-proof GPS coordinates, and export multi-sheet Excel & PDF dossiers.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" id="btnAdminCreateForm" style="font-weight: 800; background: #0284c7; border-color: #0369a1;">
            ➕ Build New Dynamic Form
          </button>
        </div>
      </div>

      <!-- Quick KPI Strip -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 16px;">
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Active Surveys</span>
          <div class="kpi-value" style="font-size: 22px; color: var(--primary);">${activeForms.length}</div>
          <span class="kpi-sub">Ready for field submission</span>
        </div>
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Total Submissions</span>
          <div class="kpi-value" style="font-size: 22px; color: var(--accent);">${allFormSubmissions.length}</div>
          <span class="kpi-sub">Collected from reps</span>
        </div>
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Live GPS Geotagged</span>
          <div class="kpi-value" style="font-size: 22px; color: #16a34a;">${geotaggedSubmissions.length}</div>
          <span class="kpi-sub">Verified physical location</span>
        </div>
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Assigned Reps</span>
          <div class="kpi-value" style="font-size: 22px; color: #7c3aed;">${assistants.length}</div>
          <span class="kpi-sub">Targetable territory agents</span>
        </div>
      </div>

      <!-- Forms Master Table -->
      ${allDynamicForms.length === 0 ? `
        <div class="card" style="text-align: center; padding: 40px 20px; color: var(--muted); border-style: dashed;">
          <div style="font-size: 38px; margin-bottom: 8px;">📝</div>
          <h4 style="color: var(--ink); margin-bottom: 4px;">No Dynamic Forms Created Yet</h4>
          <p style="font-size: 13px; max-width: 480px; margin: 0 auto 16px;">Create your first targeted survey to collect pest observations, mandi prices, dealer credit audits, or feedback directly from the field.</p>
          <button class="btn btn-primary btn-sm" id="btnAdminCreateFormEmpty" style="font-weight: 700;">➕ Build New Dynamic Form</button>
        </div>
      ` : `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Form Title & Category</th>
                <th>Target Deployment Scope</th>
                <th>Fields</th>
                <th>Deadline & Status</th>
                <th>Responses</th>
                <th style="text-align: right;">Executive Actions</th>
              </tr>
            </thead>
            <tbody>
              ${allDynamicForms.map(form => {
                const submissions = allFormSubmissions.filter(s => s.formId === form.id);
                let targetBadge = '';
                if (form.targetType === 'all') {
                  targetBadge = `<span class="badge" style="background: rgba(34, 197, 94, 0.12); color: #16a34a; font-weight: 700;">🌐 All Reps (${assistants.length} agents)</span>`;
                } else if (form.targetType === 'district') {
                  targetBadge = `<span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; font-weight: 700;">📍 District: ${escapeHtml(form.targetValue)}</span>`;
                } else {
                  targetBadge = `<span class="badge" style="background: rgba(147, 51, 234, 0.12); color: #9333ea; font-weight: 700;">👤 Rep: ${escapeHtml(form.targetValue)}</span>`;
                }

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 700; color: var(--ink); font-size: 13.5px; font-family: var(--font-heading);">
                        ${escapeHtml(form.title)}
                      </div>
                      <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 11.5px; color: var(--muted);">
                        <span class="badge" style="background: var(--surface-alt); font-size: 10.5px;">${escapeHtml(form.category || 'General')}</span>
                        <span>• ID: #${escapeHtml(form.id)}</span>
                      </div>
                    </td>
                    <td>
                      <div>${targetBadge}</div>
                      ${form.description ? `<div style="font-size: 11.5px; color: var(--muted); margin-top: 3px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(form.description)}</div>` : ''}
                    </td>
                    <td>
                      <span class="badge" style="font-weight: 700; background: var(--surface-alt);">
                        ${(form.fields || []).length} Question${(form.fields || []).length === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <div style="font-size: 12px; font-weight: 600; color: var(--ink);">
                        ${form.deadline ? `📅 ${escapeHtml(form.deadline)}` : 'No Deadline'}
                      </div>
                      <span class="badge" style="margin-top: 2px; font-size: 10px; background: ${form.status === 'active' ? 'rgba(34, 197, 94, 0.12); color: #16a34a;' : 'rgba(100, 116, 139, 0.12); color: #64748b;'} font-weight: 700;">
                        ${form.status === 'active' ? '● Active' : '○ Closed'}
                      </span>
                    </td>
                    <td>
                      <strong style="color: ${submissions.length > 0 ? '#16a34a' : 'var(--muted)'}; font-size: 14px;">
                        ${submissions.length}
                      </strong>
                      <span style="font-size: 11px; color: var(--muted);"> entry${submissions.length === 1 ? '' : 's'}</span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: flex; gap: 5px; justify-content: flex-end; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-sm btn-view-form-subs" data-id="${escapeHtml(form.id)}" style="padding: 3px 9px; font-size: 11px; font-weight: 700; background: #0284c7; border-color: #0369a1;" title="View individual responses and print dossier">
                          📋 Submissions (${submissions.length})
                        </button>
                        <button class="btn btn-secondary btn-sm btn-export-form-excel" data-id="${escapeHtml(form.id)}" style="padding: 3px 9px; font-size: 11px; font-weight: 700; color: #16a34a; border-color: rgba(22, 163, 74, 0.4);" title="Export all submissions to multi-sheet Excel spreadsheet">
                          📊 Excel
                        </button>
                        <button class="btn btn-secondary btn-sm btn-remind-form-reps" data-id="${escapeHtml(form.id)}" style="padding: 3px 8px; font-size: 11px; font-weight: 700; color: var(--primary);" title="Broadcast notice to target reps">
                          🔔 Remind
                        </button>
                        <button class="btn btn-secondary btn-sm btn-delete-dynamic-form" data-id="${escapeHtml(form.id)}" style="padding: 3px 7px; font-size: 11px; color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" title="Delete Form">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// =========================================================================
// TAB 6: PHYSICAL INVENTORY QUOTA & FIELD LIQUIDATION LEDGER
// =========================================================================
function renderInventoryTab(data) {
  const { assistants, inventorySummary } = data;
  const { allocMetrics, productSummaries, assistantSummaries, totalAllocatedVal, totalRealizedVal, overallLiquidationPct, totalAllocationsCount, totalMovementsCount } = inventorySummary;

  // Pagination calculation for Active Inventory Quotas
  const totalAllocCount = allocMetrics.length;
  const totalAllocPages = Math.ceil(totalAllocCount / inventoryPageSize) || 1;
  if (inventoryPage < 1) inventoryPage = 1;
  if (inventoryPage > totalAllocPages) inventoryPage = totalAllocPages;

  const invStart = (inventoryPage - 1) * inventoryPageSize;
  const paginatedAllocs = allocMetrics.slice(invStart, invStart + inventoryPageSize);

  return `
    <div class="card" style="border: 1px solid rgba(16, 185, 129, 0.35); box-shadow: var(--shadow-md);">
      <!-- Top Action Strip -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">📦</span>
            <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0; color: var(--ink);">
              Physical Inventory Quotas & Field Liquidation Ledger
            </h3>
            <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #16a34a; font-weight: 800;">
              ${overallLiquidationPct}% Overall Realization
            </span>
          </div>
          <p style="color: var(--muted); font-size: 12.5px; margin-top: 3px; margin-bottom: 0;">
            Allocate exact physical product quantities (kg, packets, bags, liters) across all field reps. Track dealer counter liquidations, farmer demo samples, in-hand balances, and export comprehensive multi-sheet Excel audits.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" id="btnAdminIssueStock" style="font-weight: 800; background: #16a34a; border-color: #15803d;">
            ➕ Issue New Stock Quota
          </button>
          <button class="btn btn-secondary btn-sm" id="btnAdminBulkUploadStock" style="font-weight: 700; color: #16a34a; border-color: rgba(22, 163, 74, 0.4);" title="Bulk upload stock quotas for all 8 assistants using Excel (.xlsx/.csv)">
            📥 Bulk Upload Excel
          </button>
          <input type="file" id="fileInputInventoryBulk" accept=".xlsx,.xls,.csv" style="display: none;">
          <button class="btn btn-secondary btn-sm" id="btnDownloadStockTemplate" style="font-weight: 700; color: #7c3aed; border-color: rgba(124, 58, 237, 0.4);" title="Download pre-filled Excel template with sample rows and assistant guide">
            📑 Download Excel Template
          </button>
          <button class="btn btn-secondary btn-sm" id="btnExportInventoryExcel" style="font-weight: 700; color: #0284c7; border-color: rgba(2, 132, 199, 0.4);" title="Export all sheets (Master Summary, Assistant Matrix, Movement Log, Low Stock)">
            📊 Export Multi-Sheet Excel
          </button>
          <button class="btn btn-secondary btn-sm" id="btnPrintStockDossier" style="font-weight: 600;">
            🖨️ Print Dossier
          </button>
        </div>
      </div>

      <!-- Comprehensive Weekly & Historical Stock Filter Toolbar -->
      <div class="card" style="padding: 14px 18px; margin-bottom: 18px; background: var(--surface-alt); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">📅</span>
            <div>
              <strong style="font-family: var(--font-heading); font-size: 14px; color: var(--ink);">
                Weekly Cycle & Historical Timeframe Controller
              </strong>
              <span class="badge badge-visited" style="margin-left: 8px; font-weight: 700;">
                ${inventorySummary.filterMeta?.periodLabel || 'All Time'}
              </span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Include Past Allocations Switch -->
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--ink); cursor: pointer; user-select: none;">
              <input type="checkbox" id="chkInvIncludePast" ${inventoryIncludePast ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px;">
              <span>Include Past Quotas (True In-Hand Balance)</span>
            </label>

            <button type="button" class="btn btn-secondary btn-sm" id="btnAdminReconcileWeek" style="font-weight: 700; color: #16a34a; border-color: rgba(22, 163, 74, 0.4); font-size: 11.5px; padding: 4px 10px;">
              ✅ Sign-Off Weekly Review
            </button>
          </div>
        </div>

        <!-- Filter Controls Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; align-items: flex-end;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 4px;">
              Operating Period
            </label>
            <select id="selInvPeriod" style="width: 100%; padding: 7px 10px; font-size: 12.5px; font-weight: 600;">
              <option value="all" ${inventoryPeriodFilter === 'all' ? 'selected' : ''}>📅 All Time (Full Season Cumulative)</option>
              <option value="this_week" ${inventoryPeriodFilter === 'this_week' ? 'selected' : ''}>⚡ Current Week (Active)</option>
              <option value="last_week" ${inventoryPeriodFilter === 'last_week' ? 'selected' : ''}>⏮️ Previous Week</option>
              <option value="month" ${inventoryPeriodFilter === 'month' ? 'selected' : ''}>📆 Past 30 Days (MTD)</option>
              <option value="custom" ${inventoryPeriodFilter === 'custom' ? 'selected' : ''}>🔍 Custom Date Range…</option>
            </select>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 4px;">
              Filter by Field Assistant
            </label>
            <select id="selInvRep" style="width: 100%; padding: 7px 10px; font-size: 12.5px;">
              <option value="">All Assistants (${assistants.length} Reps)</option>
              ${assistants.map(a => `<option value="${escapeHtml(a.name)}" ${inventoryFilterRep === a.name ? 'selected' : ''}>${escapeHtml(a.name)} (${escapeHtml(a.district)})</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 4px;">
              Filter by Product / Variety
            </label>
            <select id="selInvProduct" style="width: 100%; padding: 7px 10px; font-size: 12.5px;">
              <option value="">All Products</option>
              ${Array.from(new Set(storage.getInventoryAllocations().map(a => a.productName))).map(pName => `
                <option value="${escapeHtml(pName)}" ${inventoryFilterProduct === pName ? 'selected' : ''}>${escapeHtml(pName)}</option>
              `).join('')}
            </select>
          </div>

          ${inventoryPeriodFilter === 'custom' ? `
            <div>
              <label style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 4px;">
                From Date
              </label>
              <input type="date" id="inpInvStartDate" value="${inventoryCustomStartDate}" style="width: 100%; padding: 6px 8px; font-size: 12px;">
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 4px;">
                To Date
              </label>
              <input type="date" id="inpInvEndDate" value="${inventoryCustomEndDate}" style="width: 100%; padding: 6px 8px; font-size: 12px;">
            </div>
          ` : `
            <div>
              <button type="button" class="btn btn-secondary btn-sm" id="btnResetInvFilters" style="width: 100%; font-size: 12px; padding: 7px;">
                🔄 Reset Filters
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Portfolio Valuation KPI Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 20px;">
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Total Allocated Portfolio</span>
          <div class="kpi-value" style="font-size: 22px; color: var(--accent);">₹${(totalAllocatedVal / 100000).toFixed(2)}L</div>
          <span class="kpi-sub">${totalAllocationsCount} Quota Dispatches</span>
        </div>
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Counter Realized Revenue</span>
          <div class="kpi-value" style="font-size: 22px; color: #16a34a;">₹${(totalRealizedVal / 100000).toFixed(2)}L</div>
          <span class="kpi-sub">${totalMovementsCount} Field Movement Logs</span>
        </div>
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Overall Liquidation %</span>
          <div class="kpi-value" style="font-size: 22px; color: var(--primary);">${overallLiquidationPct}%</div>
          <span class="kpi-sub">Portfolio Velocity</span>
        </div>
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Portfolio SKUs</span>
          <div class="kpi-value" style="font-size: 22px; color: #7c3aed;">${productSummaries.length} Products</div>
          <span class="kpi-sub">Seeds & Bio-inputs</span>
        </div>
        <div class="kpi-card" style="padding: 12px 14px;">
          <span class="kpi-label">Active Field Assistants</span>
          <div class="kpi-value" style="font-size: 22px; color: var(--ink);">${assistants.length} Reps</div>
          <span class="kpi-sub">All Territory Hubs</span>
        </div>
      </div>

      <!-- SECTION 1: Master Product-Wise Rollup Table -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 800; margin: 0; color: var(--ink);">
            1. Master Product Rollup & Balance Aggregation
          </h4>
          <span style="font-size: 12px; color: var(--muted);">Aggregated across all field assistants</span>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product & Crop</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Allocated Quota</th>
                <th>Sold to Dealers</th>
                <th>Farmer Samples</th>
                <th>In-Hand Balance</th>
                <th>Liquidation %</th>
                <th style="text-align: right;">Realized Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${productSummaries.map(p => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: var(--ink); font-size: 13.5px;">${escapeHtml(p.productName)}</div>
                    <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">🌾 ${escapeHtml(p.crop)} · ₹${p.unitPrice}/unit</div>
                  </td>
                  <td>
                    <span class="badge" style="background: rgba(2, 132, 199, 0.1); color: var(--accent); font-weight: 600;">
                      ${escapeHtml(p.category)}
                    </span>
                  </td>
                  <td><strong style="color: var(--primary);">${escapeHtml(p.unit)}</strong></td>
                  <td><strong>${p.totalAllocated}</strong> ${escapeHtml(p.unit)}</td>
                  <td><strong style="color: #16a34a;">${p.totalLiquidated}</strong></td>
                  <td><span style="color: #7c3aed;">${p.totalSampleDistributed}</span></td>
                  <td>
                    <strong style="color: ${p.totalBalance === 0 ? 'var(--danger)' : '#0284c7'}; font-size: 13.5px;">
                      ${p.totalBalance}
                    </strong>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-weight: 800; font-size: 12.5px; color: ${p.liquidationPct >= 80 ? '#16a34a' : 'var(--ink)'};">${p.liquidationPct}%</span>
                      <div style="width: 50px; height: 5px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${Math.min(p.liquidationPct, 100)}%; height: 100%; background: ${p.liquidationPct >= 80 ? '#16a34a' : '#0284c7'};"></div>
                      </div>
                    </div>
                  </td>
                  <td style="text-align: right; font-weight: 800; color: var(--ink);">
                    ₹${p.totalRealizedValue.toLocaleString()}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 2: Assistant-Wise Breakdown Table -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 800; margin: 0; color: var(--ink);">
            2. Field Assistant Quota Matrix & Liquidation Velocity (${assistantSummaries.length} Reps)
          </h4>
          <span style="font-size: 12px; color: var(--muted);">Real-time tracking per assistant station</span>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Field Assistant & Hub</th>
                <th>District</th>
                <th>Assigned Items</th>
                <th>Total Quota Units</th>
                <th>Sold to Counters</th>
                <th>Farmer Samples</th>
                <th>In-Hand Balance</th>
                <th>Avg Liquidation</th>
                <th>Value Realized (₹)</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${assistantSummaries.map(asst => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: var(--ink); font-size: 13.5px;">${escapeHtml(asst.assistant)}</div>
                    <div style="font-size: 11.5px; color: var(--muted); margin-top: 1px;">Station: ${escapeHtml(asst.hq)}</div>
                  </td>
                  <td>
                    <span class="badge" style="background: var(--surface-alt); font-size: 11px;">${escapeHtml(asst.district)}</span>
                  </td>
                  <td>
                    <span class="badge" style="background: rgba(2, 132, 199, 0.1); color: var(--accent); font-weight: 700;">
                      ${asst.allocations.length} SKUs
                    </span>
                  </td>
                  <td><strong>${asst.totalAllocatedUnits}</strong></td>
                  <td><strong style="color: #16a34a;">${asst.totalLiquidatedUnits}</strong></td>
                  <td><span style="color: #7c3aed;">${asst.totalSampleUnits}</span></td>
                  <td>
                    <strong style="color: ${asst.totalBalanceUnits === 0 ? 'var(--danger)' : '#0284c7'};">
                      ${asst.totalBalanceUnits}
                    </strong>
                  </td>
                  <td>
                    <span class="badge" style="font-weight: 800; background: ${asst.avgLiquidationPct >= 50 ? 'rgba(34, 197, 94, 0.12); color: #16a34a;' : 'rgba(234, 88, 12, 0.12); color: #ea580c;'}">
                      ${asst.avgLiquidationPct}%
                    </span>
                  </td>
                  <td style="font-weight: 700; color: var(--ink);">
                    ₹${asst.totalRealizedRevenue.toLocaleString()}
                  </td>
                  <td style="text-align: right;">
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                      <button class="btn btn-secondary btn-sm btn-admin-issue-to-rep" data-asst="${escapeHtml(asst.assistant)}" style="padding: 3px 8px; font-size: 11px; font-weight: 700; color: #16a34a; border-color: rgba(22, 163, 74, 0.4);" title="Issue additional quota to this rep">
                        ➕ Quota
                      </button>
                      <button class="btn btn-secondary btn-sm btn-admin-remind-liquidation" data-asst="${escapeHtml(asst.assistant)}" style="padding: 3px 8px; font-size: 11px; font-weight: 700; color: var(--primary);" title="Send liquidation reminder push notification">
                        🔔 Remind
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 3: Detailed Allocations & Action Items -->
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <h4 style="font-family: var(--font-heading); font-size: 15px; font-weight: 800; margin: 0; color: var(--ink);">
            3. Active Inventory Quota Line Items (${totalAllocCount})
          </h4>
          <span style="font-size: 12px; color: var(--muted);">Click trash to delete allocation</span>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Product & Lot</th>
                <th>Target Representative</th>
                <th>Dispatched</th>
                <th>Allocated</th>
                <th>Sold</th>
                <th>Samples</th>
                <th>Balance</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${totalAllocCount === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 36px 20px; color: var(--muted);">
                    <div style="font-size: 28px; margin-bottom: 6px;">📦</div>
                    <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: var(--ink);">No Inventory Quota Allocations Matching Current Filters</div>
                    <div style="font-size: 12px; margin-bottom: 14px;">Issue physical stock quotas to field assistants to track dealer counter liquidation and farmer trial samples.</div>
                    <button type="button" class="btn btn-primary btn-sm" id="btnAdminIssueStock2" style="font-weight: 800; background: #16a34a; border-color: #15803d;">
                      ➕ Issue New Stock Quota
                    </button>
                  </td>
                </tr>
              ` : paginatedAllocs.map(a => `
                <tr>
                  <td>
                    <div style="font-weight: 700; font-size: 13px;">${escapeHtml(a.productName)}</div>
                    <div style="font-size: 11px; color: var(--muted);">Lot: ${escapeHtml(a.batchNo || 'N/A')} · ₹${a.unitPrice}/${escapeHtml(a.unit)}</div>
                  </td>
                  <td>
                    <strong style="color: var(--primary);">${escapeHtml(a.targetRep)}</strong>
                  </td>
                  <td style="font-size: 12px; color: var(--muted);">${escapeHtml(a.allocatedDate)}</td>
                  <td><strong>${a.allocatedQty}</strong> ${escapeHtml(a.unit)}</td>
                  <td><strong style="color: #16a34a;">${a.liquidatedQty}</strong></td>
                  <td><span style="color: #7c3aed;">${a.sampleQty}</span></td>
                  <td>
                    <strong style="color: ${a.balanceQty === 0 ? 'var(--danger)' : '#0284c7'}; font-size: 13px;">
                      ${a.balanceQty} ${escapeHtml(a.unit)}
                    </strong>
                  </td>
                  <td>
                    <span class="badge" style="font-weight: 700; font-size: 10.5px; background: ${a.balanceQty === 0 ? '#fee2e2; color: #dc2626;' : a.liquidationPct >= 80 ? '#dcfce7; color: #166534;' : '#e0f2fe; color: #0284c7;'}">
                      ${a.balanceQty === 0 ? '🔴 Depleted' : a.liquidationPct >= 80 ? '🟢 Liquidation High' : '🔵 Active'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm btn-delete-alloc" data-id="${escapeHtml(a.id)}" style="padding: 3px 6px; font-size: 11px; color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" title="Delete Quota">
                      🗑️
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Inventory Allocations Pagination Controls -->
        ${totalAllocCount > 0 ? `
          <div class="pagination" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 14px; padding: 12px 6px; border-top: 1px solid var(--line);">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span id="invPageInfo" style="font-size: 13px; font-weight: 600; color: var(--muted);">
                Showing <strong>${invStart + 1}–${Math.min(invStart + inventoryPageSize, totalAllocCount)}</strong> of <strong>${totalAllocCount}</strong> allocations
              </span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <label style="font-size: 12px; color: var(--muted); font-weight: 600;">Show:</label>
                <select id="selInvPageSize" style="padding: 4px 8px; font-size: 12px; font-weight: 600; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer;">
                  <option value="10" ${inventoryPageSize === 10 ? 'selected' : ''}>10 / page</option>
                  <option value="25" ${inventoryPageSize === 25 ? 'selected' : ''}>25 / page</option>
                  <option value="50" ${inventoryPageSize === 50 ? 'selected' : ''}>50 / page</option>
                  <option value="100" ${inventoryPageSize === 100 ? 'selected' : ''}>100 / page</option>
                </select>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btnInvFirstPage" ${inventoryPage <= 1 ? 'disabled' : ''} style="padding: 4px 10px; font-size: 11.5px; font-weight: 600;" title="First Page">
                ⏮️ First
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btnInvPrevPage" ${inventoryPage <= 1 ? 'disabled' : ''} style="padding: 4px 12px; font-size: 12px; font-weight: 700;">
                ◀ Prev
              </button>
              <div style="font-size: 12.5px; font-weight: 700; color: var(--ink); padding: 0 8px; background: var(--surface-alt); border-radius: var(--radius-xs); border: 1px solid var(--line); line-height: 28px;">
                Page <span style="color: var(--primary);">${inventoryPage}</span> of ${totalAllocPages}
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btnInvNextPage" ${inventoryPage >= totalAllocPages ? 'disabled' : ''} style="padding: 4px 12px; font-size: 12px; font-weight: 700;">
                Next ▶
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btnInvLastPage" ${inventoryPage >= totalAllocPages ? 'disabled' : ''} style="padding: 4px 10px; font-size: 11.5px; font-weight: 600;" title="Last Page">
                Last ⏭️
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// =========================================================================
// TAB 7: LIVE GPS CHECK-INS & JOURNEY AUDIT
// =========================================================================
function renderGpsTab(data) {
  const { assistants } = data;

  return `
    <div class="card" style="border: 1px solid rgba(2, 132, 199, 0.35); box-shadow: var(--shadow-md);">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">🛰️</span>
            <h3 style="font-family: var(--font-heading); font-size: 18px; font-weight: 700; margin: 0;">
              Field Rep Live GPS Check-Ins & Journey Audit
            </h3>
            <span class="badge badge-visited" id="checkInTotalBadge">0 Logs</span>
          </div>
          <p style="color: var(--muted); font-size: 12.5px; margin-top: 2px; margin-bottom: 0;">
            Tamper-proof real-time verification logs with exact GPS coordinates, distance to block HQ, and clickable Google Maps pins.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" id="btnExportCheckInExcel">📥 Export GPS Audit (.xlsx)</button>
          <button class="btn btn-secondary btn-sm" id="btnExportCheckInCsv">📄 Export CSV</button>
        </div>
      </div>

      <!-- Check-In Telemetry KPIs -->
      <div id="checkInKpiStrip" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 16px;"></div>

      <!-- Filters & Search Toolbar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-bottom: 14px;">
        <input type="text" id="checkInSearchInput" placeholder="🔍 Search dealer, rep, block..." value="${escapeHtml(checkInSearch)}" style="padding: 6px 10px; font-size: 12.5px;">
        <select id="checkInDateFilter" style="padding: 6px 10px; font-size: 12.5px;">
          <option value="all" ${checkInFilterDate==='all'?'selected':''}>All Dates</option>
          <option value="today" ${checkInFilterDate==='today'?'selected':''}>📅 Today</option>
          <option value="yesterday" ${checkInFilterDate==='yesterday'?'selected':''}>Yesterday</option>
          <option value="week" ${checkInFilterDate==='week'?'selected':''}>Past 7 Days</option>
        </select>
        <select id="checkInRepFilter" style="padding: 6px 10px; font-size: 12.5px;">
          <option value="">All Field Assistants</option>
          ${assistants.map(a => `<option value="${escapeHtml(a.name)}" ${checkInFilterRep===a.name?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
        <select id="checkInProxFilter" style="padding: 6px 10px; font-size: 12.5px;">
          <option value="all" ${checkInFilterProximity==='all'?'selected':''}>All Proximity</option>
          <option value="onsite" ${checkInFilterProximity==='onsite'?'selected':''}>🟢 On-Site (≤ 2.5 km)</option>
          <option value="vicinity" ${checkInFilterProximity==='vicinity'?'selected':''}>🟡 Vicinity (2.5 - 7 km)</option>
          <option value="offsite" ${checkInFilterProximity==='offsite'?'selected':''}>🚨 Flagged Off-Site (> 7 km)</option>
        </select>
      </div>

      <!-- Table Container -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Field Assistant & Station</th>
              <th>Retailer / Counter Visited</th>
              <th>Block & District</th>
              <th>Exact GPS Coordinates</th>
              <th>Distance from Block</th>
              <th>Status / Outcome</th>
              <th style="text-align: right;">Live Maps Pin</th>
            </tr>
          </thead>
          <tbody id="checkInTableBody"></tbody>
        </table>
      </div>

      <!-- Check-In Pagination -->
      <div class="pagination" style="margin-top: 10px;">
        <span id="checkInPageInfo" style="font-size: 12px; color: var(--muted); font-weight: 600;">Showing 1-10</span>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" id="btnCheckInPrev">Previous</button>
          <button class="btn btn-secondary btn-sm" id="btnCheckInNext">Next</button>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// TAB 6: TIER-A RETAILERS MASTER
// =========================================================================
function renderDealersTab(data) {
  const { assistants, totalCount } = data;

  return `
    <div class="card">
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px;">
        <div>
          <h3 style="font-family: var(--font-heading); font-size: 17px; margin: 0;">
            Retailer Directory Master (${totalCount} Counters)
          </h3>
          <span style="font-size: 12px; color: var(--muted);">Select retailers using checkboxes below to reassign reps in bulk.</span>
        </div>
        <button class="btn btn-primary btn-sm" id="btnAdminAddRetailer">+ Add New Retailer</button>
      </div>

      <!-- Bulk Actions Bar -->
      <div id="adminBulkBar" style="display: none; align-items: center; justify-content: space-between; gap: 12px; background: var(--surface-alt); padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--primary-subtle); margin-bottom: 14px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 700; color: var(--primary); font-size: 13px;" id="adminSelectedCount">0 selected</span>
          <button type="button" class="btn btn-secondary btn-sm" id="btnAdminClearSelection" style="padding: 2px 8px; font-size: 11px;">Clear Selection</button>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 12px; color: var(--muted); font-weight: 600;">Reassign selected to:</label>
          <select id="adminBulkTargetRep" style="padding: 4px 8px; font-size: 12px; min-width: 180px;">
            ${assistants.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-primary btn-sm" id="btnAdminApplyBulkReassign" style="padding: 4px 12px; font-size: 12px;">Apply Reassignment ✓</button>
        </div>
      </div>

      <!-- Filters & Search -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px;">
        <input type="text" id="adminSearchInput" placeholder="🔍 Search dealer, district, block, rep..." value="${escapeHtml(adminSearch)}">
        <select id="adminAssistantSelect">
          <option value="">All Field Assistants</option>
          ${assistants.map(a => `<option value="${escapeHtml(a.name)}" ${adminAssistantFilter===a.name?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
        <select id="adminStatusSelect">
          <option value="">All Statuses</option>
          ${STATUS_OPTIONS.map(s => `<option value="${s.id}" ${adminStatusFilter===s.id?'selected':''}>${s.icon} ${s.label}</option>`).join('')}
        </select>
        <select id="adminCategorySelect">
          <option value="">All Categories</option>
          ${POTENTIAL_FOR.map(c => `<option value="${c}" ${adminCategoryFilter===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width: 38px; text-align: center;">
                <input type="checkbox" id="adminSelectAllPage" title="Select all on this page">
              </th>
              <th>Retailer / Counter</th>
              <th>District & Block</th>
              <th>Assigned Rep</th>
              <th>Mobile</th>
              <th>Status</th>
              <th>Potential</th>
              <th>Field Notes</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="adminTableBody"></tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <span id="adminPageInfo">Showing 1-25</span>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" id="btnAdminPrevPage">Previous</button>
          <button class="btn btn-secondary btn-sm" id="btnAdminNextPage">Next</button>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// TAB 9: 🗺️ SMART TOUR BEATS & TA/DA MILEAGE CLAIMS AUDIT HUB
// =========================================================================
function renderTadaAuditTab(data) {
  const allClaims = storage.getTadaClaims();
  const liveAssistants = storage.getAssistants();

  // Aggregate Metrics
  const approvedClaims = allClaims.filter(c => c.status === 'Approved' || c.status === 'Adjusted');
  const pendingClaims = allClaims.filter(c => c.status === 'Pending Approval');
  const totalDisbursed = approvedClaims.reduce((sum, c) => sum + (c.approvedAmount !== undefined ? Number(c.approvedAmount) : (Number(c.totalClaimAmount) || 0)), 0);
  const totalVerifiedKm = allClaims.reduce((sum, c) => sum + Number(c.gpsVerifiedKm || 0), 0);
  const flaggedDiscrepancyCount = allClaims.filter(c => {
    const diff = (Number(c.claimedKm) || 0) - (Number(c.gpsVerifiedKm) || 0);
    return (c.gpsVerifiedKm > 0 && c.claimedKm > c.gpsVerifiedKm * 1.15) || diff > 10;
  }).length;

  // Filter application
  let filtered = [...allClaims];
  if (tadaFilterRep && tadaFilterRep !== 'ALL') {
    filtered = filtered.filter(c => c.assistant === tadaFilterRep);
  }
  if (tadaFilterStatus && tadaFilterStatus !== 'all') {
    filtered = filtered.filter(c => (c.status || '').toLowerCase() === tadaFilterStatus.toLowerCase());
  }
  if (tadaFilterDate) {
    filtered = filtered.filter(c => c.date === tadaFilterDate);
  }

  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / tadaPageSize) || 1;
  if (tadaPage < 1) tadaPage = 1;
  if (tadaPage > totalPages) tadaPage = totalPages;

  const startIdx = (tadaPage - 1) * tadaPageSize;
  const pageClaims = filtered.slice(startIdx, startIdx + tadaPageSize);

  const tadaPolicy = storage.getTadaPolicyConfig();

  return `
    <div style="margin-bottom: 24px;">
      <!-- Title & Header Strip -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
        <div>
          <h2 style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; color: var(--ink); margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🗺️ Smart Tour Beats & Verified TA/DA Mileage Claims</span>
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #16a34a; font-size: 11px;">
              GPS Anti-Fraud Verification
            </span>
          </h2>
          <div style="font-size: 12.5px; color: var(--muted); margin-top: 3px;">
            Supervisory audit panel: compare rep claimed distance against GPS curvature, audit fuel (Bike ₹${tadaPolicy.bikeFuelRatePerKm}/km, Car ₹${tadaPolicy.carFuelRatePerKm}/km), inspect attached bills, and approve payroll.
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnAdminOpenTadaPolicy" style="font-weight: 700; color: #7c3aed; border-color: rgba(124, 58, 237, 0.4);">
            ⚙️ TA/DA Policy & Rate Matrix
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btnAdminOpenBeatPlanner" style="font-weight: 700; color: #0284c7; border-color: rgba(2, 132, 199, 0.4);">
            🗺️ Tour Beat & TSP Planner
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btnApproveAllVerifiedTada" style="font-weight: 700; color: #16a34a; border-color: rgba(22, 163, 74, 0.4);">
            ⚡ 1-Click Approve Verified (${pendingClaims.length})
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btnExportTadaExcel" style="font-weight: 800; background: #047857; border-color: #065f46; box-shadow: 0 4px 12px rgba(4, 120, 87, 0.3);">
            📊 Export TA/DA Payroll Sheet (Excel) →
          </button>
        </div>
      </div>

      <!-- Executive KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 14px;">
        <div class="card" style="padding: 14px 18px; background: var(--surface-card); border-left: 4px solid #10b981; border-radius: var(--radius-md);">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Total Disbursed (Approved)</div>
          <div style="font-size: 24px; font-weight: 900; color: #10b981; margin-top: 2px;">
            ₹${Math.round(totalDisbursed).toLocaleString('en-IN')}
          </div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
            ${approvedClaims.length} verified claims settled
          </div>
        </div>

        <div class="card" style="padding: 14px 18px; background: var(--surface-card); border-left: 4px solid #0284c7; border-radius: var(--radius-md);">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted);">GPS Verified Road Mileage</div>
          <div style="font-size: 24px; font-weight: 900; color: #0284c7; margin-top: 2px;">
            ${Math.round(totalVerifiedKm * 10) / 10} <span style="font-size: 14px; font-weight: 600;">km</span>
          </div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
            Cumulative field assistant travel
          </div>
        </div>

        <div class="card" style="padding: 14px 18px; background: var(--surface-card); border-left: 4px solid #d97706; border-radius: var(--radius-md);">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Pending Manager Review</div>
          <div style="font-size: 24px; font-weight: 900; color: #d97706; margin-top: 2px;">
            ${pendingClaims.length} <span style="font-size: 14px; font-weight: 600;">Claims</span>
          </div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
            Awaiting sales supervisory sign-off
          </div>
        </div>

        <div class="card" style="padding: 14px 18px; background: var(--surface-card); border-left: 4px solid ${flaggedDiscrepancyCount > 0 ? '#ef4444' : '#10b981'}; border-radius: var(--radius-md);">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted);">Anti-Fraud Telemetry Flags</div>
          <div style="font-size: 24px; font-weight: 900; color: ${flaggedDiscrepancyCount > 0 ? '#ef4444' : '#10b981'}; margin-top: 2px;">
            ${flaggedDiscrepancyCount} <span style="font-size: 14px; font-weight: 600;">Flagged</span>
          </div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
            ${flaggedDiscrepancyCount > 0 ? 'Variance >15% against GPS road' : 'All claims conform to GPS'}
          </div>
        </div>
      </div>

      <!-- Policy Rates Indicator Strip -->
      <div style="padding: 10px 16px; background: rgba(124, 58, 237, 0.06); border: 1px dashed rgba(124, 58, 237, 0.3); border-radius: var(--radius-sm); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <span style="font-weight: 800; color: #7c3aed; display: flex; align-items: center; gap: 4px;">
            <span>⚙️</span>
            <span>Active Policy Matrix:</span>
          </span>
          <span style="color: var(--ink);">🏍️ Motorbike: <strong>₹${tadaPolicy.bikeFuelRatePerKm}/km</strong></span>
          <span style="color: var(--ink);">🚗 Car / Utility: <strong>₹${tadaPolicy.carFuelRatePerKm}/km</strong></span>
          <span style="color: var(--ink);">🍲 Full DA: <strong>₹${tadaPolicy.daFullDayAmount}</strong> (≥${tadaPolicy.minVisitsForFullDa} visits)</span>
          <span style="color: var(--ink);">🏨 Outstation Night Stay: <strong>₹${tadaPolicy.outstationNightAllowance}</strong></span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnAdminEditPolicyStrip" style="font-size: 11px; font-weight: 700; padding: 3px 10px; color: #7c3aed; border-color: rgba(124, 58, 237, 0.4);">
          Edit Rates & Defaults →
        </button>
      </div>

      <!-- Fleet Speed Telemetry Governance Action Strip -->
      ${(() => {
        const speedPolicy = storage.getSpeedPolicyConfig();
        const speedBreaches = storage.getSpeedBreachLogs();
        const pendingCount = speedBreaches.filter(b => !b.warningSent).length;
        return `
          <div style="padding: 12px 18px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.06) 100%); border: 1.5px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-sm); margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">🚨</span>
              <div>
                <div style="font-weight: 800; font-size: 13.5px; color: #dc2626; font-family: var(--font-heading);">
                  Fleet Speed Governance &amp; Telemetry Audits
                </div>
                <div style="font-size: 12px; color: var(--muted); margin-top: 1px;">
                  Thresholds: <strong>🏍️ 2-Wheeler: ${speedPolicy.bikeThresholdKmH} km/h</strong> · <strong>🚗 4-Wheeler: ${speedPolicy.carThresholdKmH} km/h</strong> · Auto-captured only on threshold breach.
                </div>
              </div>
            </div>
            <button type="button" class="btn btn-primary btn-sm btn-trigger-speed-audit" style="background: #dc2626; border-color: #b91c1c; font-weight: 800; font-size: 12px;">
              🚨 Inspect Speed Breaches &amp; Issue Warnings (${pendingCount} Pending) →
            </button>
          </div>
        `;
      })()}

      <!-- Filter Controls Toolbar -->
      <div class="card" style="padding: 14px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md); margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">Field Assistant</label>
            <select id="selTadaRepFilter" class="form-control" style="font-size: 12.5px; font-weight: 600; padding: 5px 10px; min-width: 190px;">
              <option value="ALL">All 8 Assistants (Full Team)</option>
              ${liveAssistants.map(a => `
                <option value="${escapeHtml(a.name)}" ${tadaFilterRep === a.name ? 'selected' : ''}>
                  ${escapeHtml(a.name)} (${escapeHtml(a.hq)})
                </option>
              `).join('')}
            </select>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">Claim Status</label>
            <select id="selTadaStatusFilter" class="form-control" style="font-size: 12.5px; font-weight: 600; padding: 5px 10px;">
              <option value="all" ${tadaFilterStatus === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="Pending Approval" ${tadaFilterStatus === 'Pending Approval' ? 'selected' : ''}>⏳ Pending Approval</option>
              <option value="Approved" ${tadaFilterStatus === 'Approved' ? 'selected' : ''}>✅ Approved</option>
              <option value="Adjusted" ${tadaFilterStatus === 'Adjusted' ? 'selected' : ''}>✏️ Adjusted (Audit Variance)</option>
              <option value="Rejected" ${tadaFilterStatus === 'Rejected' ? 'selected' : ''}>❌ Rejected</option>
            </select>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 3px;">Date Filter</label>
            <input type="date" id="iptTadaAdminDate" class="form-control" value="${tadaFilterDate}" style="font-size: 12px; padding: 5px 8px;" />
          </div>

          ${(tadaFilterRep !== 'ALL' || tadaFilterStatus !== 'all' || tadaFilterDate) ? `
            <button type="button" class="btn btn-secondary btn-sm" id="btnResetTadaFilters" style="margin-top: 18px; font-size: 11.5px; padding: 5px 10px;">
              Reset Filters
            </button>
          ` : ''}
        </div>

        <div style="font-size: 12px; color: var(--muted); font-weight: 600;">
          Showing ${startIdx + 1}–${Math.min(startIdx + tadaPageSize, totalFiltered)} of ${totalFiltered} Claims
        </div>
      </div>

      <!-- Claims Audit Table -->
      <div class="card" style="padding: 0; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden;">
        <div style="overflow-x: auto;">
          <table class="table" style="width: 100%; font-size: 12.5px; margin: 0;">
            <thead>
              <tr style="background: var(--surface-bg); border-bottom: 1.5px solid var(--line);">
                <th style="padding: 10px 14px;">Assistant & Territory</th>
                <th style="padding: 10px 14px;">Date</th>
                <th style="padding: 10px 14px;">Verified Stops & GPS Dist</th>
                <th style="padding: 10px 14px;">Claimed vs GPS Variance</th>
                <th style="padding: 10px 14px;">Vehicle & Fuel</th>
                <th style="padding: 10px 14px;">DA / Food</th>
                <th style="padding: 10px 14px;">Attached Bills</th>
                <th style="padding: 10px 14px;">Incidentals</th>
                <th style="padding: 10px 14px;">Total / Approved</th>
                <th style="padding: 10px 14px;">Status</th>
                <th style="padding: 10px 14px; text-align: right;">Supervisory Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pageClaims.length === 0 ? `
                <tr>
                  <td colspan="11" style="text-align: center; padding: 32px; color: var(--muted);">
                    No TA/DA mileage claims match the selected criteria.
                  </td>
                </tr>
              ` : pageClaims.map(c => {
                const diff = (Number(c.claimedKm) || 0) - (Number(c.gpsVerifiedKm) || 0);
                const hasVariance = (c.gpsVerifiedKm > 0 && c.claimedKm > c.gpsVerifiedKm * 1.15) || diff > 8;
                const statusColor = c.status === 'Approved' ? '#16a34a' : c.status === 'Adjusted' ? '#d97706' : c.status === 'Rejected' ? '#dc2626' : '#0284c7';
                const bills = c.attachedBills || [];
                const billsTotal = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

                return `
                  <tr style="border-bottom: 1px solid var(--line);">
                    <td style="padding: 10px 14px;">
                      <div style="font-weight: 800; color: var(--ink); font-size: 13px;">${escapeHtml(c.assistant)}</div>
                      <div style="font-size: 11px; color: var(--muted); margin-top: 1px;">
                        HQ: <strong>${escapeHtml(c.hq)}</strong> · District: ${escapeHtml(c.district)}
                      </div>
                    </td>

                    <td style="padding: 10px 14px; font-weight: 700; white-space: nowrap;">
                      ${escapeHtml(c.date)}
                    </td>

                    <td style="padding: 10px 14px;">
                      <div style="font-weight: 800; color: var(--primary); font-size: 13.5px;">
                        ${c.gpsVerifiedKm} <span style="font-size: 11px; font-weight: 600;">km</span>
                      </div>
                      <div style="font-size: 11px; color: var(--muted); margin-top: 1px;">
                        ${c.verifiedStops || 0} GPS Verified Counters
                      </div>
                    </td>

                    <td style="padding: 10px 14px;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-weight: 700; color: var(--ink);">${c.claimedKm} km</span>
                        ${hasVariance ? `
                          <span class="badge" style="background: rgba(239, 68, 68, 0.12); color: #dc2626; font-size: 10px; font-weight: 800;">
                            ⚠️ +${Math.round(diff)} km (+${Math.round((diff / (c.gpsVerifiedKm || 1)) * 100)}%)
                          </span>
                        ` : `
                          <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #16a34a; font-size: 10px; font-weight: 700;">
                            ✓ Match
                          </span>
                        `}
                      </div>
                      <div style="font-size: 10.5px; color: var(--muted); margin-top: 2px;">
                        ${c.auditFlags && c.auditFlags[0] ? escapeHtml(c.auditFlags[0]) : 'Telemetry logged'}
                      </div>
                    </td>

                    <td style="padding: 10px 14px;">
                      <div style="font-weight: 800; color: var(--ink); font-size: 13px;">₹${c.fuelAmount}</div>
                      <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                        <span class="badge" style="font-size: 10px; font-weight: 700; background: ${c.vehicleMode === 'Car' ? 'rgba(2, 132, 199, 0.12); color: #0284c7;' : 'rgba(16, 185, 129, 0.12); color: #16a34a;'}">
                          ${c.vehicleMode === 'Car' ? '🚗 Car' : '🏍️ Bike'}
                        </span>
                        <span style="font-size: 10.5px; color: var(--muted);">@ ₹${c.fuelRate || (c.vehicleMode === 'Car' ? tadaPolicy.carFuelRatePerKm : tadaPolicy.bikeFuelRatePerKm)}/km</span>
                      </div>
                    </td>

                    <td style="padding: 10px 14px;">
                      <div style="font-weight: 700; color: var(--ink);">₹${c.daAmount}</div>
                      ${c.outstationAmount > 0 ? `<div style="font-size: 10.5px; color: #7c3aed; font-weight: 700;">+₹${c.outstationAmount} Outstation</div>` : ''}
                    </td>

                    <td style="padding: 10px 14px;">
                      ${bills.length > 0 ? `
                        <button type="button" class="btn btn-secondary btn-sm btn-audit-adjust-tada" data-id="${escapeHtml(c.id)}" style="font-size: 11px; font-weight: 700; padding: 3px 8px; color: #16a34a; border-color: rgba(22, 163, 74, 0.4); display: flex; align-items: center; gap: 4px;" title="View attached receipts in audit modal">
                          <span>📎 ${bills.length} Bill${bills.length > 1 ? 's' : ''}</span>
                          <span style="color: var(--muted); font-weight: 600;">(₹${billsTotal})</span>
                        </button>
                      ` : `
                        <span style="font-size: 11px; color: var(--muted);">0 Bills</span>
                      `}
                    </td>

                    <td style="padding: 10px 14px;">
                      <div style="font-weight: 700; color: var(--ink);">₹${c.incidentalAmount || 0}</div>
                      ${c.incidentalNotes ? `<div style="font-size: 10.5px; color: var(--muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.incidentalNotes)}">${escapeHtml(c.incidentalNotes)}</div>` : ''}
                    </td>

                    <td style="padding: 10px 14px;">
                      <div style="font-size: 11px; color: var(--muted);">Claim: <strong>₹${c.totalClaimAmount}</strong></div>
                      <div style="font-size: 14px; font-weight: 900; color: ${statusColor}; margin-top: 1px;">
                        ${c.approvedAmount !== undefined ? `₹${c.approvedAmount}` : `₹${c.totalClaimAmount}`}
                      </div>
                    </td>

                    <td style="padding: 10px 14px;">
                      <span class="badge" style="background: ${statusColor}18; color: ${statusColor}; font-weight: 800; font-size: 11px;">
                        ${escapeHtml(c.status)}
                      </span>
                      ${c.approvedBy ? `<div style="font-size: 10px; color: var(--muted); margin-top: 2px;">by ${escapeHtml(c.approvedBy.split(' ')[0])}</div>` : ''}
                    </td>

                    <td style="padding: 10px 14px; text-align: right;">
                      <div style="display: inline-flex; align-items: center; gap: 6px;">
                        ${c.status === 'Pending Approval' ? `
                          <button type="button" class="btn btn-primary btn-sm btn-quick-approve-tada" data-id="${escapeHtml(c.id)}" style="font-size: 11px; padding: 4px 8px; font-weight: 700;">
                            ✓ Approve
                          </button>
                        ` : ''}
                        
                        <button type="button" class="btn btn-secondary btn-sm btn-audit-adjust-tada" data-id="${escapeHtml(c.id)}" style="font-size: 11px; padding: 4px 8px; font-weight: 700;" title="Inspect GPS check-ins & adjust payout">
                          ✏️ Audit
                        </button>

                        ${c.status === 'Pending Approval' ? `
                          <button type="button" class="btn btn-secondary btn-sm btn-reject-tada" data-id="${escapeHtml(c.id)}" style="font-size: 11px; padding: 4px 8px; color: #dc2626; border-color: rgba(239, 68, 68, 0.3);">
                            ✕ Reject
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div style="padding: 12px 18px; background: var(--surface-bg); border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 12px; color: var(--muted);">
            Page <strong>${tadaPage}</strong> of <strong>${totalPages}</strong> (${totalFiltered} total claims)
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btnTadaPrevPage" ${tadaPage <= 1 ? 'disabled' : ''} style="font-size: 11.5px; padding: 4px 10px;">
              ← Prev
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnTadaNextPage" ${tadaPage >= totalPages ? 'disabled' : ''} style="font-size: 11.5px; padding: 4px 10px;">
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}


function openTadaAuditAdjustModal(claimId, onComplete) {
  const existing = document.getElementById('tadaAuditAdjustModal');
  if (existing) existing.remove();

  const claim = storage.getTadaClaim(claimId);
  if (!claim) return showToast('Claim record not found.', '⚠️');

  // Find check-in logs for this assistant on this date
  const allLogs = storage.getCheckInLogs();
  const dayLogs = allLogs.filter(l => l.rep === claim.assistant && (l.date === claim.date || l.checkInDate === claim.date));

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.id = 'tadaAuditAdjustModal';
  modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 9999;';

  const diff = (Number(claim.claimedKm) || 0) - (Number(claim.gpsVerifiedKm) || 0);

  modal.innerHTML = `
    <div class="modal-box" style="width: 95%; max-width: 680px; max-height: 90vh; display: flex; flex-direction: column; background: var(--surface-card); border-radius: var(--radius-lg); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1px solid var(--line); overflow: hidden;">
      
      <!-- Header -->
      <div style="padding: 16px 20px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">🔍</span>
          <div>
            <div style="font-weight: 800; font-size: 16px; font-family: var(--font-heading);">
              Supervisory TA/DA Audit & Telemetry Inspection
            </div>
            <div style="font-size: 12px; opacity: 0.85; margin-top: 1px;">
              ${escapeHtml(claim.assistant)} · Claim Date: <strong>${escapeHtml(claim.date)}</strong> · HQ: <strong>${escapeHtml(claim.hq)}</strong>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-sm" id="btnCloseAuditModal" style="background: rgba(255, 255, 255, 0.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ✕
        </button>
      </div>

      <!-- Content -->
      <div style="flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; background: var(--surface-bg);">
        
        <!-- Distance Comparison Metric Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
          <div style="background: var(--surface-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
            <div style="font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase;">GPS Road Distance</div>
            <div style="font-size: 18px; font-weight: 900; color: #10b981; margin-top: 2px;">
              ${claim.gpsVerifiedKm} <span style="font-size: 11px;">km</span>
            </div>
          </div>

          <div style="background: var(--surface-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
            <div style="font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Rep Claimed Mileage</div>
            <div style="font-size: 18px; font-weight: 900; color: var(--ink); margin-top: 2px;">
              ${claim.claimedKm} <span style="font-size: 11px;">km</span>
            </div>
          </div>

          <div style="background: var(--surface-card); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--line); text-align: center;">
            <div style="font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Variance / Discrepancy</div>
            <div style="font-size: 18px; font-weight: 900; color: ${diff > 5 ? '#dc2626' : '#10b981'}; margin-top: 2px;">
              ${diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} <span style="font-size: 11px;">km</span>
            </div>
          </div>
        </div>

        <!-- Vehicle Mode & Telemetry GPS Check-in Trail -->
        <div style="background: var(--surface-card); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--line);">
          <div style="font-weight: 800; font-size: 12px; color: var(--ink); text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
            <span>📍 Verified Chronological Check-Ins (${dayLogs.length} Points)</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge" style="font-size: 11px; font-weight: 700; background: ${claim.vehicleMode === 'Car' ? 'rgba(2, 132, 199, 0.12); color: #0284c7;' : 'rgba(16, 185, 129, 0.12); color: #16a34a;'}">
                ${claim.vehicleMode === 'Car' ? '🚗 Car Mode' : '🏍️ Motorbike Mode'}
              </span>
              <span style="font-size: 11px; color: var(--primary); font-weight: 700;">Rate: ₹${claim.fuelRate || 4.50} / km</span>
            </div>
          </div>

          <div style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; font-size: 11.5px;">
            ${dayLogs.length === 0 ? `
              <div style="color: var(--muted); text-align: center; padding: 10px;">
                No GPS counter check-in records logged in database for this date.
              </div>
            ` : dayLogs.map((l, i) => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line);">
                <div>
                  <strong style="color: var(--ink);">${i + 1}. ${escapeHtml(l.retailer)}</strong>
                  <span style="color: var(--muted); margin-left: 6px;">(${escapeHtml(l.block || '')})</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: var(--muted); font-size: 10.5px;">${escapeHtml(l.time || '')}</span>
                  ${l.lat ? `
                    <a href="${escapeHtml(l.mapUrl || `https://www.google.com/maps?q=${l.lat},${l.lng}`)}" target="_blank" rel="noopener noreferrer" style="font-size: 10px; color: #0284c7; text-decoration: underline;">
                      Maps Pin
                    </a>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Attached Expense Receipts & Invoices Gallery -->
        <div style="background: var(--surface-card); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--line);">
          <div style="font-weight: 800; font-size: 12px; color: var(--ink); text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
            <span>📎 Attached Expense Proofs & Bills (${claim.attachedBills ? claim.attachedBills.length : 0} Items)</span>
            <span style="font-size: 11px; color: #047857; font-weight: 700;">
              Total Receipts: ₹${claim.attachedBills ? claim.attachedBills.reduce((s, b) => s + Number(b.amount || 0), 0).toLocaleString() : 0}
            </span>
          </div>

          ${!claim.attachedBills || claim.attachedBills.length === 0 ? `
            <div style="color: var(--muted); text-align: center; padding: 12px; font-size: 11.5px; background: var(--surface-bg); border-radius: var(--radius-sm);">
              No physical bill photos or vouchers were attached to this claim.
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
              ${claim.attachedBills.map((b, idx) => {
                const isPdf = (b.dataUrl && b.dataUrl.startsWith('data:application/pdf')) || (b.name && b.name.toLowerCase().endsWith('.pdf'));
                return `
                  <div style="padding: 8px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px;">
                    <div class="audit-receipt-trigger" data-idx="${idx}" style="height: 80px; border-radius: 4px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid var(--line); position: relative;" title="Click to view full receipt in lightbox">
                      ${isPdf ? `
                        <div style="text-align: center; color: #dc2626;">
                          <div style="font-size: 24px;">📄</div>
                          <div style="font-size: 9px; font-weight: 700;">PDF Document</div>
                        </div>
                      ` : b.dataUrl ? `
                        <img src="${b.dataUrl}" alt="${escapeHtml(b.name)}" style="width: 100%; height: 100%; object-fit: cover;" />
                      ` : `
                        <div style="font-size: 24px;">🧾</div>
                      `}
                      <div style="position: absolute; bottom: 3px; right: 3px; background: rgba(0,0,0,0.65); color: #fff; font-size: 8.5px; font-weight: 700; padding: 1px 4px; border-radius: 3px;">
                        🔍 View
                      </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #0284c7; font-size: 9.5px; font-weight: 700;">
                        ${escapeHtml(b.category)}
                      </span>
                      <strong style="color: #047857; font-size: 11.5px;">₹${Number(b.amount || 0).toLocaleString()}</strong>
                    </div>

                    <div style="font-size: 10.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(b.notes || b.name)}">
                      ${escapeHtml(b.notes || b.name)}
                    </div>

                    <button type="button" class="btn btn-secondary btn-sm audit-receipt-trigger" data-idx="${idx}" style="font-size: 10px; padding: 2px 4px; font-weight: 700;">
                      🔍 Inspect Receipt
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Manager Decision Form -->
        <div style="background: var(--surface-card); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 12px;">
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 4px;">
                Total Claimed Amount (₹)
              </label>
              <div style="font-size: 16px; font-weight: 800; color: var(--ink); padding: 6px 10px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1px solid var(--line);">
                ₹${claim.totalClaimAmount}
              </div>
            </div>

            <div>
              <label style="font-size: 11px; font-weight: 700; color: var(--primary); display: block; margin-bottom: 4px;">
                Final Approved Amount (₹)
              </label>
              <input type="number" id="iptAuditApprovedAmount" class="form-control" value="${claim.approvedAmount !== undefined ? claim.approvedAmount : claim.totalClaimAmount}" step="0.10" style="font-size: 16px; font-weight: 900; color: var(--primary);" />
            </div>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 4px;">
              Manager Audit Remarks / Settlement Justification
            </label>
            <textarea id="txaAuditManagerNotes" class="form-control" rows="2" placeholder="e.g. Mileage adjusted to GPS road telemetry (31.8 km × ₹${claim.fuelRate || 4.50} + DA ₹${claim.daAmount || 250}). Receipts verified. Approved." style="font-size: 12px;">${escapeHtml(claim.managerNotes || '')}</textarea>
          </div>

          <!-- Quick calculation shortcuts -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="btnShortcutGpsAmount" style="font-size: 11px; padding: 3px 8px;">
              Set to GPS Verified Total (₹${Math.round(((claim.gpsVerifiedKm * (claim.fuelRate || 4.50)) + (claim.daAmount || 0) + (claim.outstationAmount || 0) + (claim.incidentalAmount || 0)) * 10) / 10})
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnShortcutFullAmount" style="font-size: 11px; padding: 3px 8px;">
              Set to Claimed Total (₹${claim.totalClaimAmount})
            </button>
          </div>

        </div>

      </div>

      <!-- Action Buttons Footer -->
      <div style="padding: 12px 20px; background: var(--surface-card); border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnAuditRejectClaim" style="color: #dc2626; border-color: rgba(239, 68, 68, 0.4); font-weight: 700;">
          ✕ Reject Claim
        </button>

        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnAuditCancel">
            Cancel
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btnAuditSaveApproved" style="font-weight: 800; padding: 6px 16px;">
            ✓ Save & Approve Payout →
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  modal.querySelector('#btnCloseAuditModal')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#btnAuditCancel')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  const iptApproved = modal.querySelector('#iptAuditApprovedAmount');
  const txaNotes = modal.querySelector('#txaAuditManagerNotes');

  // Receipt Lightbox click handlers
  modal.querySelectorAll('.audit-receipt-trigger').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      if (claim.attachedBills && claim.attachedBills[idx]) {
        openReceiptLightboxModal(claim.attachedBills[idx]);
      }
    });
  });

  // Shortcuts
  modal.querySelector('#btnShortcutGpsAmount')?.addEventListener('click', () => {
    const verifiedTotal = Math.round(((claim.gpsVerifiedKm * (claim.fuelRate || 4.50)) + (claim.daAmount || 0) + (claim.outstationAmount || 0) + (claim.incidentalAmount || 0)) * 10) / 10;
    if (iptApproved) iptApproved.value = verifiedTotal;
    if (txaNotes) txaNotes.value = `Adjusted to GPS telemetry road distance of ${claim.gpsVerifiedKm} km. Approved.`;
  });

  modal.querySelector('#btnShortcutFullAmount')?.addEventListener('click', () => {
    if (iptApproved) iptApproved.value = claim.totalClaimAmount;
    if (txaNotes) txaNotes.value = 'Approved in full as claimed.';
  });

  // Save Approval Handler
  modal.querySelector('#btnAuditSaveApproved')?.addEventListener('click', () => {
    const finalAmount = Number(iptApproved?.value || claim.totalClaimAmount);
    const notes = txaNotes?.value || '';
    const isAdjusted = finalAmount !== claim.totalClaimAmount;

    storage.updateTadaClaimStatus(claim.id, {
      status: isAdjusted ? 'Adjusted' : 'Approved',
      approvedAmount: finalAmount,
      managerNotes: notes,
      approvedBy: 'State Sales Manager (Bihar HQ)',
      approvedAt: new Date().toISOString()
    });

    showToast(`Claim for ${claim.assistant} ${isAdjusted ? 'adjusted and approved' : 'approved'} for ₹${finalAmount}!`, '✅');
    modal.remove();
    if (onComplete) onComplete();
  });

  // Reject Handler
  modal.querySelector('#btnAuditRejectClaim')?.addEventListener('click', () => {
    const notes = txaNotes?.value || prompt('Enter rejection reason:') || 'Mileage discrepancy; rejected by manager.';
    storage.updateTadaClaimStatus(claim.id, {
      status: 'Rejected',
      approvedAmount: 0,
      managerNotes: notes,
      approvedBy: 'State Sales Manager (Bihar HQ)',
      approvedAt: new Date().toISOString()
    });

    showToast(`Claim rejected.`, 'ℹ️');
    modal.remove();
    if (onComplete) onComplete();
  });
}

// =========================================================================
// LEAVE MANAGEMENT TAB (Admin View)
// =========================================================================

let leaveAdminYear = new Date().getFullYear();
let leaveAdminMonth = new Date().getMonth() + 1;
let leaveAdminSubTab = 'pending'; // 'pending' | 'balance' | 'calendar' | 'history' | 'settings'
let leaveAdminRepFilter = 'ALL';
let leaveAdminStatusFilter = 'all';

function renderLeaveManagementTab(data) {
  const currentYear = leaveAdminYear;
  const allApplications = storage.getLeaveApplications({ year: currentYear });
  const allBalances = storage.getAllLeaveBalances ? storage.getAllLeaveBalances(currentYear) : [];
  const assistants = storage.getAssistants();

  const pending = allApplications.filter(a => a.status === 'Pending');
  const approved = allApplications.filter(a => a.status === 'Approved');
  const rejected = allApplications.filter(a => a.status === 'Rejected');

  const statusColors = { Pending: ['rgba(245,158,11,0.1)','#d97706'], Approved: ['rgba(22,163,74,0.1)','#16a34a'], Rejected: ['rgba(220,38,38,0.1)','#dc2626'], Cancelled: ['rgba(100,116,139,0.1)','#64748b'] };
  const typeColors = { PL: '#16a34a', CL: '#0284c7', SL: '#db2777', LWP: '#dc2626' };

  const subTabStyle = (t) => `padding:9px 18px; font-weight:700; font-size:12px; border:none; border-bottom:3px solid ${leaveAdminSubTab===t?'#1d4ed8':'transparent'}; background:transparent; cursor:pointer; color:${leaveAdminSubTab===t?'#1d4ed8':'var(--muted)'}; white-space:nowrap;`;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  let subContent = '';
  if (leaveAdminSubTab === 'pending') {
    const filtered = pending.filter(a => leaveAdminRepFilter === 'ALL' || a.assistant === leaveAdminRepFilter);
    subContent = filtered.length === 0
      ? `<div style="text-align:center; padding:40px; color:var(--muted);"><div style="font-size:36px; margin-bottom:8px;">✅</div><div style="font-weight:700;">No pending leave requests!</div></div>`
      : filtered.map(app => `
          <div class="card" style="padding:14px 18px; border-left:4px solid ${typeColors[app.leaveType] || '#94a3b8'}; margin-bottom:10px;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:10px;">
              <div style="flex:1; min-width:220px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:5px;">
                  <span style="font-weight:800; font-size:14px; color:var(--ink);">${escapeHtml(app.assistant)}</span>
                  <span style="font-size:11px; color:var(--muted);">${escapeHtml(app.empCode || '')}</span>
                  <span style="padding:2px 8px; border-radius:var(--radius-pill); font-size:10.5px; font-weight:700; background:${statusColors[app.status]?.[0]||'#f1f5f9'}; color:${statusColors[app.status]?.[1]||'#64748b'};">${escapeHtml(app.status)}</span>
                </div>
                <div style="font-size:13px; font-weight:700; color:${typeColors[app.leaveType]||'#64748b'}; margin-bottom:3px;">${escapeHtml(app.leaveLabel)} · <span style="color:var(--ink);">${app.days} day(s)${app.halfDay ? ' (Half Day)' : ''}</span></div>
                <div style="font-size:12.5px; color:var(--muted);">📅 ${escapeHtml(app.fromDate)} → ${escapeHtml(app.toDate)}</div>
                <div style="font-size:12px; color:var(--ink); margin-top:3px;">Reason: ${escapeHtml(app.reason)}</div>
                <div style="font-size:11px; color:var(--muted); margin-top:2px;">Applied: ${escapeHtml(new Date(app.appliedAt||0).toLocaleDateString('en-IN'))}</div>
              </div>
              <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                <button type="button" class="btn btn-primary btn-sm btn-approve-leave" data-id="${escapeHtml(app.id)}" style="font-weight:800; font-size:12px; background:#16a34a; border-color:#15803d; white-space:nowrap; min-width:100px;">✓ Approve</button>
                <button type="button" class="btn btn-secondary btn-sm btn-reject-leave" data-id="${escapeHtml(app.id)}" data-asst="${escapeHtml(app.assistant)}" style="font-weight:700; font-size:12px; color:#dc2626; border-color:rgba(220,38,38,0.3); white-space:nowrap; min-width:100px;">✕ Reject</button>
                <button type="button" class="btn btn-secondary btn-sm btn-open-leave-modal" data-asst="${escapeHtml(app.assistant)}" style="font-weight:700; font-size:11px; white-space:nowrap; min-width:100px;">👁 View Rep</button>
              </div>
            </div>
          </div>
        `).join('');

  } else if (leaveAdminSubTab === 'balance') {
    const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
    const dailyWage = settings.dailyBaseWage || 650;
    const totalEncashment = allBalances.reduce((s, b) => s + (b.balance?.PL?.encashmentValue || 0), 0);

    subContent = `
      <!-- Summary card -->
      <div class="card" style="padding:14px 18px; background:linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.04)); border:1px solid rgba(5,150,105,0.25); border-left:4px solid #059669; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Total Year-End PL Encashment Liability (${currentYear})</div>
          <div style="font-size:28px; font-weight:800; color:#059669; font-family:var(--font-heading);">₹${totalEncashment.toLocaleString('en-IN')}</div>
          <div style="font-size:12px; color:var(--muted);">Across ${allBalances.length} field representatives · @ ₹${dailyWage}/day</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnExportLeaveExcel" style="font-weight:700; color:#16a34a; border-color:rgba(22,163,74,0.4); white-space:nowrap;">
          📊 Export Leave Balance Report (Excel)
        </button>
      </div>

      <!-- Leave Balance Table -->
      <div class="card" style="padding:0; overflow:hidden;">
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
            <thead>
              <tr style="background:rgba(30,58,138,0.06); border-bottom:2px solid rgba(30,58,138,0.15);">
                <th style="padding:10px 14px; text-align:left; font-weight:800; color:var(--primary); min-width:80px;">Emp ID</th>
                <th style="padding:10px 14px; text-align:left; font-weight:800; color:var(--primary); min-width:170px;">Representative</th>
                <th style="padding:10px 14px; text-align:left; font-weight:800; color:var(--muted); min-width:100px;">HQ Station</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#16a34a;">PL Annual</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#16a34a;">PL C/F</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#16a34a;">PL Used</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#16a34a;">PL Balance</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#0284c7;">CL Annual</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#0284c7;">CL Used</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#0284c7;">CL Balance</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#db2777;">SL Annual</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#db2777;">SL Used</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#db2777;">SL Balance</th>
                <th style="padding:10px 14px; text-align:center; font-weight:800; color:#dc2626;">LWP Days</th>
                <th style="padding:10px 14px; text-align:right; font-weight:800; color:#059669;">PL Encashment (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${allBalances.map((rb, idx) => {
                const b = rb.balance;
                const rowBg = idx % 2 === 0 ? 'var(--surface-card)' : 'rgba(30,58,138,0.02)';
                return `<tr style="background:${rowBg}; border-bottom:1px solid var(--line);">
                  <td style="padding:8px 14px; font-weight:700; color:var(--primary); font-size:11px;">${escapeHtml(rb.empCode)}</td>
                  <td style="padding:8px 14px; font-weight:600;">${escapeHtml(rb.assistant)}</td>
                  <td style="padding:8px 14px; color:var(--muted); font-size:12px;">${escapeHtml(rb.hq)}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:700; color:#16a34a;">${b.PL.annual}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:700; color:#16a34a;">${b.PL.carryForward}</td>
                  <td style="padding:8px 10px; text-align:center; color:#dc2626;">${b.PL.used}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:800; color:#16a34a;">${b.PL.available}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:700; color:#0284c7;">${b.CL.annual}</td>
                  <td style="padding:8px 10px; text-align:center; color:#dc2626;">${b.CL.used}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:800; color:#0284c7;">${b.CL.available}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:700; color:#db2777;">${b.SL.annual}</td>
                  <td style="padding:8px 10px; text-align:center; color:#dc2626;">${b.SL.used}</td>
                  <td style="padding:8px 10px; text-align:center; font-weight:800; color:#db2777;">${b.SL.available}</td>
                  <td style="padding:8px 10px; text-align:center; color:#dc2626; font-weight:700;">${b.LWP.used}</td>
                  <td style="padding:8px 14px; text-align:right; font-weight:800; color:#059669; font-size:13px;">₹${(b.PL.encashmentValue || 0).toLocaleString('en-IN')}</td>
                </tr>`;
              }).join('')}
              <tr style="background:rgba(30,58,138,0.06); border-top:2px solid rgba(30,58,138,0.2);">
                <td colspan="6" style="padding:10px 14px; font-weight:800; font-size:13px; color:var(--primary);">TEAM TOTAL</td>
                <td style="padding:10px; text-align:center; font-weight:800; color:#16a34a;">${allBalances.reduce((s,r)=>s+(r.balance.PL.available||0),0)}</td>
                <td colspan="2"></td>
                <td style="padding:10px; text-align:center; font-weight:800; color:#0284c7;">${allBalances.reduce((s,r)=>s+(r.balance.CL.available||0),0)}</td>
                <td colspan="2"></td>
                <td style="padding:10px; text-align:center; font-weight:800; color:#db2777;">${allBalances.reduce((s,r)=>s+(r.balance.SL.available||0),0)}</td>
                <td></td>
                <td style="padding:10px 14px; text-align:right; font-weight:800; color:#059669; font-size:14px;">₹${totalEncashment.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

  } else if (leaveAdminSubTab === 'calendar') {
    const daysInMonth = new Date(leaveAdminYear, leaveAdminMonth, 0).getDate();
    const firstDay = new Date(leaveAdminYear, leaveAdminMonth - 1, 1).getDay();
    const calData = storage.getLeaveCalendarData ? storage.getLeaveCalendarData(leaveAdminYear, leaveAdminMonth) : {};
    const typeColors2 = { PL: ['#dcfce7','#16a34a'], CL: ['#e0f2fe','#0284c7'], SL: ['#fce7f3','#db2777'], LWP: ['#fee2e2','#dc2626'] };
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(`<div></div>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(leaveAdminYear, leaveAdminMonth - 1, d);
      const dateStr = dt.toISOString().split('T')[0];
      const isSun = dt.getDay() === 0;
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const onLeave = (calData[dateStr] || []).filter(l => l.status === 'Approved');
      cells.push(`
        <div style="min-height:80px; padding:4px 6px; border:1px solid var(--line); border-radius:6px; background:${isSun?'rgba(245,158,11,0.04)':'var(--surface-card)'}; ${isToday?'outline:2px solid #2563eb;':''}">
          <div style="font-size:12px; font-weight:800; color:${isSun?'#d97706':isToday?'#2563eb':'var(--ink)'}; margin-bottom:3px;">${d}</div>
          ${onLeave.length === 0 ? '' : onLeave.slice(0,4).map(l => {
            const [bg2, fg2] = typeColors2[l.leaveType] || ['#f1f5f9','#64748b'];
            return `<div style="font-size:9px; font-weight:700; padding:1px 4px; border-radius:3px; background:${bg2}; color:${fg2}; margin-bottom:1px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;" title="${escapeHtml(l.assistant)} — ${escapeHtml(l.leaveLabel)}">${escapeHtml(l.empCode?.slice(-3)||'?')} ${l.halfDay?'½':l.leaveType}</div>`;
          }).join('')}
          ${onLeave.length > 4 ? `<div style="font-size:9px; color:var(--muted);">+${onLeave.length-4}</div>` : ''}
        </div>
      `);
    }

    subContent = `
      <div class="card" style="padding:12px 18px; margin-bottom:14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          <button type="button" id="btnLeaveAdminCalPrev" class="btn btn-secondary btn-sm" style="font-weight:700;">← Prev</button>
          <div style="font-weight:800; font-size:16px; font-family:var(--font-heading); color:var(--ink);">${monthNames[leaveAdminMonth-1]} ${leaveAdminYear}</div>
          <button type="button" id="btnLeaveAdminCalNext" class="btn btn-secondary btn-sm" style="font-weight:700;">Next →</button>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; font-size:11px;">
          ${Object.entries(typeColors2).map(([t,[bg2,fg2]])=>`<span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${bg2};"></span><span style="color:var(--muted);">${t}</span></span>`).join('')}
        </div>
      </div>
      <div class="card" style="padding:14px; overflow:hidden;">
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:6px;">
          ${dayNames.map(d=>`<div style="text-align:center; font-size:11px; font-weight:700; color:${d==='Sun'?'#d97706':'var(--muted)'}; padding:4px 0;">${d}</div>`).join('')}
        </div>
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">
          ${cells.join('')}
        </div>
      </div>
    `;

  } else if (leaveAdminSubTab === 'settings') {
    const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
    const policy = settings.leavePolicy || { annualPL: 12, annualCL: 12, annualSL: 12, plMaxCarryForward: 15, plMaxEncashableYearEnd: 30 };
    const dailyWage = settings.dailyBaseWage || 650;
    const holidays = (settings.biharGazettedHolidays || []).sort((a, b) => a.date.localeCompare(b.date));

    subContent = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start;">

        <!-- LEFT: Leave Policy Config -->
        <div style="display:flex; flex-direction:column; gap:14px;">
          <div class="card" style="padding:18px 20px;">
            <div style="font-weight:800; font-size:14px; font-family:var(--font-heading); margin-bottom:14px; color:var(--ink); display:flex; align-items:center; gap:8px;">
              📋 Annual Leave Policy Configuration
            </div>
            <form id="frmLeavePolicy" style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group">
                  <label class="form-label" style="color:#16a34a; font-weight:700;">PL (Paid Leave) / Year</label>
                  <input type="number" id="cfgAnnualPL" min="0" max="30" value="${policy.annualPL}" style="padding:8px 10px; font-size:13px; font-weight:700; border:1px solid #86efac; border-radius:var(--radius-sm);">
                </div>
                <div class="form-group">
                  <label class="form-label" style="color:#0284c7; font-weight:700;">CL (Casual Leave) / Year</label>
                  <input type="number" id="cfgAnnualCL" min="0" max="30" value="${policy.annualCL}" style="padding:8px 10px; font-size:13px; font-weight:700; border:1px solid #7dd3fc; border-radius:var(--radius-sm);">
                </div>
                <div class="form-group">
                  <label class="form-label" style="color:#db2777; font-weight:700;">SL (Sick Leave) / Year</label>
                  <input type="number" id="cfgAnnualSL" min="0" max="30" value="${policy.annualSL}" style="padding:8px 10px; font-size:13px; font-weight:700; border:1px solid #f9a8d4; border-radius:var(--radius-sm);">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">Daily Base Wage (₹)</label>
                  <input type="number" id="cfgDailyWage" min="100" max="5000" value="${dailyWage}" style="padding:8px 10px; font-size:13px; font-weight:700; border:1px solid var(--line); border-radius:var(--radius-sm);">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">PL Max Carry-Forward</label>
                  <input type="number" id="cfgPLCarryFwd" min="0" max="30" value="${policy.plMaxCarryForward || 15}" style="padding:8px 10px; font-size:13px; font-weight:700; border:1px solid var(--line); border-radius:var(--radius-sm);">
                  <span style="font-size:10.5px; color:var(--muted);">Max PL days carried to next year</span>
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">PL Max Encashable / Year</label>
                  <input type="number" id="cfgPLEncash" min="0" max="60" value="${policy.plMaxEncashableYearEnd || 30}" style="padding:8px 10px; font-size:13px; font-weight:700; border:1px solid var(--line); border-radius:var(--radius-sm);">
                  <span style="font-size:10.5px; color:var(--muted);">Max PL days cashable at year-end</span>
                </div>
              </div>
              <button type="submit" class="btn btn-primary" style="padding:10px; font-weight:800; font-size:13px; background:linear-gradient(135deg,#1d4ed8,#1e40af); margin-top:4px;">
                💾 Save Leave Policy
              </button>
            </form>
          </div>

          <!-- Individual Balance Override -->
          <div class="card" style="padding:18px 20px;">
            <div style="font-weight:800; font-size:14px; font-family:var(--font-heading); margin-bottom:14px; color:var(--ink);">
              🧾 Manual Balance Adjustment (Opening Override)
            </div>
            <div style="font-size:12px; color:var(--muted); margin-bottom:12px; padding:8px 12px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:6px;">
              ⚠️ Use this to manually adjust opening PL balance for a specific rep (e.g., carry-forward correction, arrears). This does NOT affect CL/SL (they don't carry forward).
            </div>
            <form id="frmBalanceOverride" style="display:flex; flex-direction:column; gap:10px;">
              <select id="overrideRepSelect" style="padding:8px 10px; font-size:13px; font-weight:700; border:1px solid var(--line); border-radius:var(--radius-sm);">
                <option value="">Select representative…</option>
                ${assistants.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${escapeHtml(storage.getEmployeeMetadata(a.name).empCode)})</option>`).join('')}
              </select>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="form-group">
                  <label class="form-label" style="color:#16a34a; font-weight:700;">PL Carry-Forward Override</label>
                  <input type="number" id="overridePLCarry" min="0" max="30" value="0" placeholder="Days to add" style="padding:8px 10px; font-size:13px; border:1px solid #86efac; border-radius:var(--radius-sm);">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">Adjustment Reason</label>
                  <input type="text" id="overrideReason" placeholder="e.g. Year-end correction" style="padding:8px 10px; font-size:13px; border:1px solid var(--line); border-radius:var(--radius-sm);">
                </div>
              </div>
              <button type="submit" class="btn btn-secondary" style="padding:9px; font-weight:700; font-size:12px; color:#16a34a; border-color:rgba(22,163,74,0.4);">
                ✏️ Apply Balance Override
              </button>
            </form>
          </div>
        </div>

        <!-- RIGHT: Bihar Gazetted Holiday Manager -->
        <div class="card" style="padding:18px 20px;">
          <div style="font-weight:800; font-size:14px; font-family:var(--font-heading); margin-bottom:6px; color:var(--ink); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <span>🏛️ Bihar Gazetted Holidays Manager</span>
            <span style="font-size:11px; font-weight:500; color:var(--muted);">${holidays.length} holidays configured</span>
          </div>
          <div style="font-size:12px; color:var(--muted); margin-bottom:14px;">
            These dates are auto-marked as <strong>H (Holiday)</strong> on the Muster Roll and count as payable days.
          </div>

          <!-- Add new holiday -->
          <form id="frmAddHoliday" style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
            <input type="date" id="newHolidayDate" required style="padding:7px 10px; font-size:13px; font-weight:600; border:1px solid var(--line); border-radius:var(--radius-sm); flex:0 0 150px;">
            <input type="text" id="newHolidayName" required placeholder="Holiday name (e.g. Holi)" style="padding:7px 10px; font-size:13px; border:1px solid var(--line); border-radius:var(--radius-sm); flex:1; min-width:160px;">
            <button type="submit" class="btn btn-primary btn-sm" style="font-weight:800; white-space:nowrap; background:#1d4ed8;">+ Add Holiday</button>
          </form>

          <!-- Bulk preset buttons -->
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
            <button type="button" id="btnPreset2026Holidays" class="btn btn-secondary btn-sm" style="font-weight:700; font-size:11.5px; color:#7c3aed; border-color:rgba(124,58,237,0.35); white-space:nowrap;">
              📅 Preset 2026 Bihar Holidays
            </button>
            <button type="button" id="btnPreset2027Holidays" class="btn btn-secondary btn-sm" style="font-weight:700; font-size:11.5px; color:#0284c7; border-color:rgba(2,132,199,0.35); white-space:nowrap;">
              📅 Preset 2027 Bihar Holidays
            </button>
            <button type="button" id="btnClearAllHolidays" class="btn btn-secondary btn-sm" style="font-weight:700; font-size:11.5px; color:#dc2626; border-color:rgba(220,38,38,0.3); white-space:nowrap;">
              🗑️ Clear All Holidays
            </button>
          </div>

          <!-- Holiday List -->
          <div style="max-height:360px; overflow-y:auto; border:1px solid var(--line); border-radius:8px;">
            ${holidays.length === 0
              ? `<div style="padding:20px; text-align:center; color:var(--muted); font-size:13px;">No holidays configured yet. Add above or use a preset.</div>`
              : holidays.map(h => {
                  const dt = new Date(h.date + 'T00:00:00');
                  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
                  const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()];
                  return `<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid var(--line); gap:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div style="width:42px; text-align:center;">
                        <div style="font-size:16px; font-weight:800; color:#db2777;">${dt.getDate()}</div>
                        <div style="font-size:9px; color:var(--muted); font-weight:600;">${monthName} ${dayName}</div>
                      </div>
                      <div>
                        <div style="font-weight:700; font-size:13px; color:var(--ink);">${escapeHtml(h.name)}</div>
                        <div style="font-size:11px; color:var(--muted);">${escapeHtml(h.date)}</div>
                      </div>
                    </div>
                    <button type="button" class="btn-delete-holiday" data-date="${escapeHtml(h.date)}" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:14px; padding:4px 6px; border-radius:4px;" title="Remove holiday">✕</button>
                  </div>`;
                }).join('')
            }
          </div>
        </div>
      </div>
    `;

  } else { // history / all
    const filtered = allApplications
      .filter(a => leaveAdminRepFilter === 'ALL' || a.assistant === leaveAdminRepFilter)
      .filter(a => leaveAdminStatusFilter === 'all' || a.status === leaveAdminStatusFilter);

    subContent = `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; align-items:center;">
        <select id="leaveAdminRepFilter" style="padding:7px 10px; font-size:13px; font-weight:700; border-radius:var(--radius-sm); border:1px solid var(--line);">
          <option value="ALL" ${leaveAdminRepFilter==='ALL'?'selected':''}>All Representatives</option>
          ${assistants.map(a=>`<option value="${escapeHtml(a.name)}" ${leaveAdminRepFilter===a.name?'selected':''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
        <select id="leaveAdminStatusFilter" style="padding:7px 10px; font-size:13px; font-weight:700; border-radius:var(--radius-sm); border:1px solid var(--line);">
          <option value="all" ${leaveAdminStatusFilter==='all'?'selected':''}>All Statuses</option>
          <option value="Pending" ${leaveAdminStatusFilter==='Pending'?'selected':''}>Pending</option>
          <option value="Approved" ${leaveAdminStatusFilter==='Approved'?'selected':''}>Approved</option>
          <option value="Rejected" ${leaveAdminStatusFilter==='Rejected'?'selected':''}>Rejected</option>
          <option value="Cancelled" ${leaveAdminStatusFilter==='Cancelled'?'selected':''}>Cancelled</option>
        </select>
        <span style="font-size:12px; color:var(--muted);">${filtered.length} record(s)</span>
      </div>
      ${filtered.length === 0
        ? `<div style="text-align:center; padding:40px; color:var(--muted);">No leave applications match the selected filters.</div>`
        : filtered.map(app => `
            <div class="card" style="padding:12px 16px; margin-bottom:8px; border-left:4px solid ${typeColors[app.leaveType]||'#94a3b8'};">
              <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:4px;">
                <span style="font-weight:800; font-size:13px;">${escapeHtml(app.assistant)}</span>
                <span style="font-size:11px; color:var(--muted);">${escapeHtml(app.empCode||'')}</span>
                <span style="padding:2px 8px; border-radius:var(--radius-pill); font-size:10.5px; font-weight:700; background:${statusColors[app.status]?.[0]||'#f1f5f9'}; color:${statusColors[app.status]?.[1]||'#64748b'};">${escapeHtml(app.status)}</span>
                <span style="font-weight:700; font-size:12.5px; color:${typeColors[app.leaveType]};">${escapeHtml(app.leaveLabel)}</span>
              </div>
              <div style="font-size:12px; color:var(--muted);">📅 ${escapeHtml(app.fromDate)} → ${escapeHtml(app.toDate)} · ${app.days} day(s) · ${app.reason}</div>
              ${app.managerRemarks ? `<div style="font-size:11.5px; color:var(--primary); margin-top:2px;">Remarks: "${escapeHtml(app.managerRemarks)}"</div>` : ''}
            </div>
          `).join('')
      }
    `;
  }

  return `
    <!-- Header KPI Row -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px,1fr)); gap:12px; margin-bottom:18px;">
      ${[['Pending',pending.length,'#f59e0b','📝'],['Approved',approved.length,'#16a34a','✅'],['Rejected',rejected.length,'#dc2626','✕'],['Total Applications',allApplications.length,'#1d4ed8','📋']].map(([label,count,color,icon])=>`
        <div class="card" style="padding:14px 18px; border-left:4px solid ${color};">
          <div style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${label}</div>
          <div style="font-size:26px; font-weight:800; color:${color}; font-family:var(--font-heading); margin-top:2px;">${icon} ${count}</div>
          <div style="font-size:11px; color:var(--muted);">${currentYear} Calendar Year</div>
        </div>
      `).join('')}
    </div>

    <!-- Year Selector + Sub-tabs -->
    <div class="card" style="padding:0; margin-bottom:14px; overflow:hidden;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 14px; border-bottom:1px solid var(--line); background:var(--surface-bg); flex-wrap:wrap; gap:8px;">
        <div style="display:flex; overflow-x:auto; gap:0;">
          <button type="button" id="leaveAdminSubTab_pending" style="${subTabStyle('pending')}">📝 Pending Requests <span style="background:#ef4444;color:#fff;border-radius:10px;padding:1px 6px;font-size:9px;margin-left:4px;">${pending.length}</span></button>
          <button type="button" id="leaveAdminSubTab_balance" style="${subTabStyle('balance')}">📊 Leave Balances & Encashment</button>
          <button type="button" id="leaveAdminSubTab_calendar" style="${subTabStyle('calendar')}">🗓️ Team Leave Calendar</button>
          <button type="button" id="leaveAdminSubTab_history" style="${subTabStyle('history')}">📋 All Applications History</button>
          <button type="button" id="leaveAdminSubTab_settings" style="${subTabStyle('settings')}">⚙️ Policy &amp; Holiday Settings</button>

        </div>
        <select id="leaveAdminYearSelect" style="padding:6px 10px; font-size:12px; font-weight:700; border-radius:var(--radius-sm); border:1px solid var(--line);">
          ${[2024,2025,2026,2027].map(y=>`<option value="${y}" ${y===leaveAdminYear?'selected':''}>${y}</option>`).join('')}
        </select>
      </div>
      <div style="padding:16px 18px; background:var(--surface-bg);">
        ${subContent}
      </div>
    </div>
  `;
}

// =========================================================================
// INDIAN ATTENDANCE & MUSTER ROLL TAB (Form XVI / Form D)
// =========================================================================

let musterYear = new Date().getFullYear();
let musterMonth = new Date().getMonth() + 1; // 1-12

function renderAttendanceMusterRollTab(data) {
  const musterData = storage.getMusterRollMonthData(musterYear, musterMonth);
  if (!musterData) return '<div class="card" style="padding:24px;text-align:center;">Loading muster data…</div>';

  const { rows, settings, monthName, daysInMonth, totalPayableDays, totalGrossPayroll, totalPresents, totalAbsents, pendingRegularizations } = musterData;
  const avgAttendancePct = rows.length ? Math.round((totalPresents / (rows.length * daysInMonth)) * 100) : 0;
  const assistants = storage.getAssistants();

  // Status code badge colours
  const codeBg = { P:'#dcfce7', HD:'#fef3c7', OD:'#e0f2fe', WO:'#ede9fe', PL:'#fef9c3', H:'#fce7f3', A:'#fee2e2', '—':'#f1f5f9' };
  const codeFg = { P:'#16a34a', HD:'#d97706', OD:'#0284c7', WO:'#7c3aed', PL:'#ca8a04', H:'#db2777', A:'#dc2626', '—':'#94a3b8' };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `<option value="${m}" ${m === musterMonth ? 'selected' : ''}>${names[i]}</option>`;
  }).join('');

  const yearOptions = [2024, 2025, 2026, 2027].map(y =>
    `<option value="${y}" ${y === musterYear ? 'selected' : ''}>${y}</option>`
  ).join('');

  // Build day header cells (1 to 31)
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dayDate = new Date(musterYear, musterMonth - 1, d);
    const dayName = ['Su','Mo','Tu','We','Th','Fr','Sa'][dayDate.getDay()];
    const isSun = dayDate.getDay() === 0;
    return `<th style="min-width:36px; font-size: 10px; padding: 3px 2px; text-align: center; background: ${isSun ? '#fef3c7' : 'rgba(30, 58, 138, 0.06)'}; color: ${isSun ? '#d97706' : 'var(--muted)'}; font-weight: 700; border-right: 1px solid var(--line);">
      <div>${d}</div>
      <div style="font-size:9px;opacity:0.8;">${dayName}</div>
    </th>`;
  }).join('');

  // Build rep rows for the matrix
  const repRows = rows.map((row, idx) => {
    const dayCells = row.dailyAttendance.map(day => {
      const bg = codeBg[day.code] || '#f1f5f9';
      const fg = codeFg[day.code] || '#64748b';
      return `<td style="min-width: 36px; padding: 2px; text-align: center; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line);">
        <button type="button" class="btn-muster-cell" 
          data-asst="${escapeHtml(row.assistant)}" 
          data-date="${escapeHtml(day.dateStr)}"
          data-code="${escapeHtml(day.code)}"
          title="${escapeHtml(row.assistant)} · ${escapeHtml(day.dateStr)} · ${escapeHtml(day.label)}"
          style="width: 32px; height: 26px; border-radius: 4px; border: none; cursor: pointer; background: ${bg}; color: ${fg}; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: auto; ${day.regularizationRequested ? 'outline: 2px solid #f59e0b;' : ''}"
        >${escapeHtml(day.code === '—' ? '·' : day.code)}</button>
      </td>`;
    }).join('');

    const trBg = idx % 2 === 0 ? 'var(--surface-card)' : 'rgba(30, 58, 138, 0.02)';
    return `<tr style="background: ${trBg};">
      <td style="padding: 6px 10px; min-width: 70px; font-weight: 700; font-size: 11px; color: var(--primary); white-space: nowrap; position: sticky; left: 0; background: ${trBg}; z-index: 2; border-right: 2px solid rgba(30, 58, 138, 0.2);">
        ${escapeHtml(row.empCode)}
      </td>
      <td style="padding: 6px 10px; min-width: 160px; position: sticky; left: 70px; background: ${trBg}; z-index: 2; border-right: 1px solid var(--line);">
        <div style="font-weight: 700; font-size: 12px; color: var(--ink);">${escapeHtml(row.assistant)}</div>
        <div style="font-size: 10px; color: var(--muted);">${escapeHtml(row.designation || 'Field Representative (MGO)')}</div>
      </td>
      <td style="padding: 6px 10px; min-width: 120px; font-size: 11px; color: var(--muted); border-right: 1px solid var(--line); white-space: nowrap;">
        S/O ${escapeHtml(row.fatherName || 'Ram Kumar')}
      </td>
      <td style="padding: 6px 10px; min-width: 100px; font-size: 11px; color: var(--ink); font-weight: 600; border-right: 2px solid rgba(30, 58, 138, 0.2); white-space: nowrap;">
        ${escapeHtml(row.hq)}
      </td>
      ${dayCells}
      <td style="padding: 6px 10px; min-width: 36px; text-align: center; font-weight: 700; font-size: 12px; color: #16a34a; border-left: 2px solid rgba(30, 58, 138, 0.2);">${row.presentCount}</td>
      <td style="padding: 6px 10px; min-width: 36px; text-align: center; font-weight: 700; font-size: 12px; color: #d97706;">${row.halfDayCount}</td>
      <td style="padding: 6px 10px; min-width: 36px; text-align: center; font-weight: 700; font-size: 12px; color: #0284c7;">${row.onDutyCount}</td>
      <td style="padding: 6px 10px; min-width: 36px; text-align: center; font-weight: 700; font-size: 12px; color: #7c3aed;">${row.weeklyOffCount}</td>
      <td style="padding: 6px 10px; min-width: 36px; text-align: center; font-weight: 700; font-size: 12px; color: #dc2626;">${row.absentCount}</td>
      <td style="padding: 6px 10px; min-width: 70px; text-align: center; font-weight: 800; font-size: 13px; color: var(--primary); border-left: 2px solid rgba(30, 58, 138, 0.2);">${row.payableDays.toFixed(1)}</td>
      <td style="padding: 6px 10px; min-width: 90px; text-align: right; font-weight: 800; font-size: 13px; color: #16a34a; padding-right: 14px;">₹${row.grossWage.toLocaleString('en-IN')}</td>
    </tr>`;
  }).join('');

  // Pending regularization queue
  const pendingRegHtml = pendingRegularizations && pendingRegularizations.length > 0
    ? pendingRegularizations.slice(0, 10).map(r => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--line); gap:12px; flex-wrap:wrap;">
          <div>
            <span style="font-weight:700; font-size:13px;">${escapeHtml(r.assistant)}</span>
            <span style="font-size:12px; color:var(--muted); margin-left:8px;">${escapeHtml(r.date)}</span>
            <div style="font-size:12px; color:var(--ink); margin-top:2px;">Reason: ${escapeHtml(r.regularizationReason || 'Not specified')}</div>
            <div style="font-size:11px; color:var(--primary);">Requested Status: <strong>${escapeHtml(r.requestedStatus || 'P')}</strong></div>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-primary btn-sm btn-approve-regularization" data-asst="${escapeHtml(r.assistant)}" data-date="${escapeHtml(r.date)}" data-status="${escapeHtml(r.requestedStatus || 'P')}" style="font-size:11px; padding:4px 10px; font-weight:700; background:#16a34a; border-color:#15803d;">✓ Approve</button>
            <button type="button" class="btn btn-secondary btn-sm btn-reject-regularization" data-asst="${escapeHtml(r.assistant)}" data-date="${escapeHtml(r.date)}" style="font-size:11px; padding:4px 10px; font-weight:700; color:#dc2626; border-color:rgba(220,38,38,0.3);">✕ Reject</button>
          </div>
        </div>
      `).join('')
    : `<div style="padding:20px; text-align:center; color:var(--muted); font-size:13px;">✅ No pending regularization requests.</div>`;

  return `
    <!-- KPI Summary Cards -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:18px;">
      <div class="card" style="padding:14px 18px; background:linear-gradient(135deg,rgba(30,58,138,0.08),rgba(37,99,235,0.05)); border:1px solid rgba(30,58,138,0.2); border-left:4px solid #1d4ed8;">
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Headcount</div>
        <div style="font-size:28px;font-weight:800;color:#1d4ed8;font-family:var(--font-heading);margin-top:2px;">${rows.length}</div>
        <div style="font-size:11px;color:var(--muted);">Active Field Representatives</div>
      </div>
      <div class="card" style="padding:14px 18px; background:linear-gradient(135deg,rgba(22,163,74,0.08),rgba(22,163,74,0.04)); border:1px solid rgba(22,163,74,0.25); border-left:4px solid #16a34a;">
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Avg Attendance</div>
        <div style="font-size:28px;font-weight:800;color:#16a34a;font-family:var(--font-heading);margin-top:2px;">${avgAttendancePct}%</div>
        <div style="font-size:11px;color:var(--muted);">${monthName} ${musterYear}</div>
      </div>
      <div class="card" style="padding:14px 18px; background:linear-gradient(135deg,rgba(124,58,237,0.08),rgba(124,58,237,0.04)); border:1px solid rgba(124,58,237,0.25); border-left:4px solid #7c3aed;">
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Payable Days</div>
        <div style="font-size:28px;font-weight:800;color:#7c3aed;font-family:var(--font-heading);margin-top:2px;">${totalPayableDays.toFixed(1)}</div>
        <div style="font-size:11px;color:var(--muted);">P + OD + WO + PL + H + (HD×0.5)</div>
      </div>
      <div class="card" style="padding:14px 18px; background:linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.04)); border:1px solid rgba(5,150,105,0.25); border-left:4px solid #059669;">
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Gross Payroll Payout</div>
        <div style="font-size:22px;font-weight:800;color:#059669;font-family:var(--font-heading);margin-top:2px;">₹${totalGrossPayroll.toLocaleString('en-IN')}</div>
        <div style="font-size:11px;color:var(--muted);">@ ₹${settings.dailyBaseWage || 650}/day base wage</div>
      </div>
      <div class="card" style="padding:14px 18px; background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.04)); border:1px solid rgba(245,158,11,0.25); border-left:4px solid #f59e0b;">
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Pending Regularizations</div>
        <div style="font-size:28px;font-weight:800;color:#f59e0b;font-family:var(--font-heading);margin-top:2px;">${pendingRegularizations?.length || 0}</div>
        <div style="font-size:11px;color:var(--muted);">Punch correction requests</div>
      </div>
    </div>

    <!-- Action Toolbar -->
    <div class="card" style="padding:14px 18px; margin-bottom:16px; display:flex; align-items:center; flex-wrap:wrap; gap:10px; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <select id="selMusterMonth" style="padding:7px 10px; font-size:13px; font-weight:700; border-radius:var(--radius-sm); border:1px solid var(--line);">${monthOptions}</select>
        <select id="selMusterYear" style="padding:7px 10px; font-size:13px; font-weight:700; border-radius:var(--radius-sm); border:1px solid var(--line);">${yearOptions}</select>
        <button type="button" class="btn btn-primary btn-sm" id="btnMusterAutoGps" style="font-weight:800; font-size:12px; background:linear-gradient(135deg,#059669,#047857); border-color:#065f46; white-space:nowrap;">
          ⚡ Auto-Populate from GPS Check-ins
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnMusterMarkSundays" style="font-weight:700; font-size:12px; color:#7c3aed; border-color:rgba(124,58,237,0.4); white-space:nowrap;">
          📅 Mark Sundays as WO
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnMusterApplyHolidays" style="font-weight:700; font-size:12px; color:#db2777; border-color:rgba(219,39,119,0.4); white-space:nowrap;">
          🏛️ Apply Bihar Gazetted Holidays
        </button>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnMusterExportExcel" style="font-weight:700; font-size:12px; color:#16a34a; border-color:rgba(22,163,74,0.4); white-space:nowrap;">
          📊 Export Statutory Muster Roll (Excel)
        </button>
        <button type="button" class="btn btn-secondary btn-sm" id="btnMusterPrintFormD" style="font-weight:700; font-size:12px; white-space:nowrap;">
          🖨️ Print Form D
        </button>
      </div>
    </div>

    <!-- Legend Strip -->
    <div class="card" style="padding:10px 16px; margin-bottom:14px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:11px;">
      <strong style="font-size:11px; color:var(--muted); margin-right:4px;">Legend:</strong>
      ${Object.entries({P:'Present',HD:'Half Day',OD:'On Duty',WO:'Weekly Off',PL:'Paid Leave',H:'Holiday',A:'Absent'}).map(([code,label]) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;">
          <span style="display:inline-block;width:22px;height:18px;border-radius:3px;background:${codeBg[code]};color:${codeFg[code]};font-weight:800;font-size:10px;text-align:center;line-height:18px;">${code}</span>
          <span style="color:var(--muted);">${label}</span>
        </span>`).join('')}
      <span style="margin-left:auto; font-size:10.5px; color:#f59e0b; font-weight:700;">⭕ = Regularization Pending</span>
    </div>

    <!-- Statutory Muster Roll Matrix Table -->
    <div class="card" style="padding:0; overflow:hidden; margin-bottom:18px; box-shadow:var(--shadow-card);">
      <div style="padding:12px 18px; background:linear-gradient(135deg,#1e3a8a,#1d4ed8); color:#fff;">
        <div style="font-weight:800; font-size:15px; font-family:var(--font-heading);">
          📋 Statutory Muster Roll — Form XVI / Form D (मस्टर रोल)
        </div>
        <div style="font-size:12px; opacity:0.9; margin-top:2px;">
          Bihar AgTech Field Operations — ${monthName} ${musterYear} · Click any cell to override status
        </div>
      </div>
      <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:rgba(30,58,138,0.08); border-bottom:2px solid rgba(30,58,138,0.2);">
              <th style="padding:8px 10px; text-align:left; min-width:70px; font-size:11px; font-weight:800; color:var(--primary); position:sticky; left:0; background:rgba(240,245,255,1); z-index:3; border-right:2px solid rgba(30,58,138,0.2);">Emp ID</th>
              <th style="padding:8px 10px; text-align:left; min-width:160px; font-size:11px; font-weight:800; color:var(--primary); position:sticky; left:70px; background:rgba(240,245,255,1); z-index:3; border-right:1px solid var(--line);">Rep Name / Designation</th>
              <th style="padding:8px 10px; text-align:left; min-width:120px; font-size:11px; font-weight:800; color:var(--muted); border-right:1px solid var(--line);">Father's/Guardian's Name</th>
              <th style="padding:8px 10px; text-align:left; min-width:100px; font-size:11px; font-weight:800; color:var(--muted); border-right:2px solid rgba(30,58,138,0.2);">HQ Station</th>
              ${dayHeaders}
              <th style="padding:8px 6px; text-align:center; min-width:36px; font-size:11px; font-weight:800; color:#16a34a; border-left:2px solid rgba(30,58,138,0.2);" title="Present">P</th>
              <th style="padding:8px 6px; text-align:center; min-width:36px; font-size:11px; font-weight:800; color:#d97706;" title="Half Day">HD</th>
              <th style="padding:8px 6px; text-align:center; min-width:36px; font-size:11px; font-weight:800; color:#0284c7;" title="On Duty">OD</th>
              <th style="padding:8px 6px; text-align:center; min-width:36px; font-size:11px; font-weight:800; color:#7c3aed;" title="Weekly Off">WO</th>
              <th style="padding:8px 6px; text-align:center; min-width:36px; font-size:11px; font-weight:800; color:#dc2626;" title="Absent">A</th>
              <th style="padding:8px 10px; text-align:center; min-width:70px; font-size:11px; font-weight:800; color:var(--primary); border-left:2px solid rgba(30,58,138,0.2);">Payable Days</th>
              <th style="padding:8px 14px; text-align:right; min-width:90px; font-size:11px; font-weight:800; color:#059669;">Gross Wage (₹)</th>
            </tr>
          </thead>
          <tbody id="musterRollTbody">
            ${repRows}
          </tbody>
          <tfoot>
            <tr style="background:linear-gradient(135deg,rgba(30,58,138,0.08),rgba(37,99,235,0.05)); border-top:2px solid rgba(30,58,138,0.2);">
              <td colspan="4" style="padding:10px 14px; font-weight:800; font-size:13px; color:var(--primary); position:sticky; left:0; background:rgba(235,242,255,1); z-index:2;">
                TOTAL (${rows.length} Representatives)
              </td>
              ${Array.from({length: daysInMonth}, () => '<td></td>').join('')}
              <td style="padding:10px 6px; text-align:center; font-weight:800; font-size:12px; color:#16a34a; border-left:2px solid rgba(30,58,138,0.2);">${rows.reduce((s,r)=>s+r.presentCount,0)}</td>
              <td style="padding:10px 6px; text-align:center; font-weight:800; font-size:12px; color:#d97706;">${rows.reduce((s,r)=>s+r.halfDayCount,0)}</td>
              <td style="padding:10px 6px; text-align:center; font-weight:800; font-size:12px; color:#0284c7;">${rows.reduce((s,r)=>s+r.onDutyCount,0)}</td>
              <td style="padding:10px 6px; text-align:center; font-weight:800; font-size:12px; color:#7c3aed;">${rows.reduce((s,r)=>s+r.weeklyOffCount,0)}</td>
              <td style="padding:10px 6px; text-align:center; font-weight:800; font-size:12px; color:#dc2626;">${rows.reduce((s,r)=>s+r.absentCount,0)}</td>
              <td style="padding:10px 10px; text-align:center; font-weight:800; font-size:14px; color:var(--primary); border-left:2px solid rgba(30,58,138,0.2);">${totalPayableDays.toFixed(1)}</td>
              <td style="padding:10px 14px; text-align:right; font-weight:800; font-size:14px; color:#059669;">₹${totalGrossPayroll.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Regularization & Leave Approval Queue -->
    <div class="card" style="padding:0; overflow:hidden; margin-bottom:18px;">
      <div style="padding:12px 18px; background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.06)); border-bottom:1px solid rgba(245,158,11,0.3); display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:800; font-size:14px; font-family:var(--font-heading); color:#d97706;">
          📝 Punch Regularization Queue (पंच सुधार अनुरोध)
        </div>
        <span class="badge" style="background:rgba(245,158,11,0.2); color:#d97706; font-weight:700;">${pendingRegularizations?.length || 0} Pending</span>
      </div>
      <div id="musterRegularizationQueue">
        ${pendingRegHtml}
      </div>
    </div>

    <!-- Individual Rep Attendance Drill-Down buttons -->
    <div class="card" style="padding:14px 18px; margin-bottom:10px;">
      <div style="font-weight:700; font-size:13.5px; margin-bottom:12px; font-family:var(--font-heading); color:var(--ink);">
        👁️ Individual Representative Attendance Details
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${rows.map(r => `
          <button type="button" class="btn btn-secondary btn-sm btn-view-rep-attendance" data-asst="${escapeHtml(r.assistant)}" style="font-size:12px; font-weight:700;">
            ${escapeHtml(r.empCode)}: ${escapeHtml(r.assistant.split(' ').slice(0,2).join(' '))}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// =========================================================================
// EVENT BINDINGS
// =========================================================================
function bindAdminEvents(container) {
  // Tab Switchers
  container.querySelectorAll('.admin-sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        currentAdminTab = tab;
        renderAdminView(container, storage.rows);
      }
    });
  });

  // Field Ops Sub-Tabs
  container.querySelectorAll('.field-sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = btn.getAttribute('data-subtab');
      if (sub) {
        currentFieldOpsSubTab = sub;
        fieldOpsPage = 1;
        renderAdminView(container, storage.rows);
      }
    });
  });

  // Top Bar Actions
  document.getElementById('btnAdminOpenAiTab')?.addEventListener('click', () => {
    currentAdminTab = 'ai';
    renderAdminView(container, storage.rows);
  });
  document.getElementById('btnAdminSpeedAudit')?.addEventListener('click', () => {
    openSpeedAuditModal(() => renderAdminView(container, storage.rows));
  });
  container.querySelectorAll('.btn-trigger-speed-audit').forEach(btn => {
    btn.addEventListener('click', () => {
      openSpeedAuditModal(() => renderAdminView(container, storage.rows));
    });
  });
  document.getElementById('btnAdminSupabaseSync')?.addEventListener('click', () => openSupabaseModal());
  document.getElementById('btnAdminSopGuide')?.addEventListener('click', () => openMgoSuccessModal());
  document.getElementById('btnAdminAddAssistant')?.addEventListener('click', () => openAddAssistantModal());
  document.getElementById('btnAdminAddAssistant2')?.addEventListener('click', () => openAddAssistantModal());
  document.getElementById('btnAdminReassignBlock')?.addEventListener('click', () => openReassignTerritoryModal());
  document.getElementById('btnAdminReassignBlock2')?.addEventListener('click', () => openReassignTerritoryModal());

  // Edit assistant buttons
  container.querySelectorAll('.btn-edit-asst').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-asst');
      const asst = storage.getAssistants().find(a => a.name === name);
      if (asst) openAssistantEditModal(asst);
    });
  });

  // Logout / Lock Admin
  const performAdminLogout = () => {
    auth.logoutManager();
    showToast('Admin logged out successfully. Returned to Field Mode', '🔒');
    window.dispatchEvent(new CustomEvent('tracker:roleChanged'));
  };

  document.getElementById('btnAdminLogout')?.addEventListener('click', performAdminLogout);
  document.getElementById('btnAdminLock')?.addEventListener('click', performAdminLogout);

  // Change PIN
  document.getElementById('btnAdminChangePin')?.addEventListener('click', () => {
    const currentPin = prompt('Enter your current Manager PIN:');
    if (!auth.verifyManagerPin(currentPin)) {
      alert('Incorrect current PIN.');
      return;
    }
    const newPin = prompt('Enter new 4-digit Manager PIN:');
    if (newPin && newPin.trim().length >= 4) {
      auth.setManagerPin(newPin.trim());
      showToast('Manager PIN updated successfully!', '🔑');
    } else {
      alert('PIN must be at least 4 digits.');
    }
  });

  // Supervisory Actions on Leaderboard Tab
  document.getElementById('btnAdminLogMeeting')?.addEventListener('click', () => {
    const assistants = storage.getAssistants();
    openFarmerMeetingModal(assistants[0], () => renderAdminView(container, storage.rows));
  });

  document.getElementById('btnAdminAddDemo')?.addEventListener('click', () => {
    const assistants = storage.getAssistants();
    openDemoPlotModal(assistants[0], null, () => renderAdminView(container, storage.rows));
  });

  document.getElementById('btnAdminAddLead')?.addEventListener('click', () => {
    const assistants = storage.getAssistants();
    openFarmerLeadModal(assistants[0].name, null, () => renderAdminView(container, storage.rows));
  });

  // KPI Leaderboard Scorecard/Audit/Review Modals
  document.getElementById('btnExportKpiExcel')?.addEventListener('click', () => {
    exportKpiReportToExcel(currentAssistantScores, storage.getFarmerMeetings(), storage.getDemoPlots(), storage.getCompetitorIntel(), storage.getFarmerLeads());
  });

  container.querySelectorAll('.btn-audit-asst-aqfs').forEach(btn => {
    btn.addEventListener('click', () => {
      const asstName = btn.getAttribute('data-asst');
      if (asstName) openAqfsAuditModal(asstName);
    });
  });

  container.querySelectorAll('.btn-view-asst-weekly').forEach(btn => {
    btn.addEventListener('click', () => {
      const asstName = btn.getAttribute('data-asst');
      if (asstName) openWeeklyReviewModal(asstName);
    });
  });

  container.querySelectorAll('.btn-view-asst-kpi').forEach(btn => {
    btn.addEventListener('click', () => {
      const asstName = btn.getAttribute('data-asst');
      const scoreData = currentAssistantScores.find(s => s.assistant === asstName);
      if (scoreData) openKpiScoreModal(scoreData);
    });
  });

  // Data Operations (Excel/CSV Export & Import)
  document.getElementById('btnExportXlsx')?.addEventListener('click', () => exportToExcel(storage.rows));
  document.getElementById('btnExportCsv')?.addEventListener('click', () => exportToCsv(storage.rows));

  document.getElementById('btnResetDatabase')?.addEventListener('click', async () => {
    if (confirm("Reset will restore all 573 Tier-A dealers and initial 8 territory hubs. Any manual modifications will be cleared. Continue?")) {
      await storage.resetSeedData();
      showToast('Database reset to baseline', '🔄');
      adminPage = 1;
      selectedRetailerIds.clear();
      renderAdminView(container, storage.rows);
    }
  });

  const fileInput = document.getElementById('fileInputExcel');
  document.getElementById('btnTriggerImport')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusMsg = document.getElementById('importStatusMsg');
    if (statusMsg) statusMsg.textContent = 'Parsing and validating file...';

    try {
      const parsedRows = await parseExcelOrCsvFile(file);
      if (parsedRows.length === 0) throw new Error('No valid retailer records found in uploaded file.');

      for (const r of parsedRows) {
        await storage.saveRow(r);
      }
      if (statusMsg) statusMsg.textContent = `Import complete: ${parsedRows.length} retailers processed.`;
      showToast(`Imported ${parsedRows.length} retailers`, '🎉');
      renderAdminView(container, storage.rows);
    } catch(err) {
      console.error(err);
      if (statusMsg) statusMsg.textContent = 'Import error: ' + err.message;
      showToast('Import failed', '❌');
    }
  });

  // Field Ops Tab Listeners
  document.getElementById('btnFieldOpsAddMeeting')?.addEventListener('click', () => {
    const assistants = storage.getAssistants();
    openFarmerMeetingModal(assistants[0], () => renderAdminView(container, storage.rows));
  });

  document.getElementById('btnFieldOpsAddDemo')?.addEventListener('click', () => {
    const assistants = storage.getAssistants();
    openDemoPlotModal(assistants[0], null, () => renderAdminView(container, storage.rows));
  });

  document.getElementById('btnFieldOpsAddLead')?.addEventListener('click', () => {
    const assistants = storage.getAssistants();
    openFarmerLeadModal(assistants[0].name, null, () => renderAdminView(container, storage.rows));
  });

  document.getElementById('btnFieldOpsAddIntel')?.addEventListener('click', () => {
    showToast('Add intel from dealer modal or rep field view.', 'ℹ️');
  });

  const fieldSearch = document.getElementById('fieldOpsSearchInput');
  fieldSearch?.addEventListener('input', (e) => {
    fieldOpsSearch = e.target.value;
    fieldOpsPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('fieldOpsRepFilterSelect')?.addEventListener('change', (e) => {
    fieldOpsRepFilter = e.target.value;
    fieldOpsPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnFieldOpsPrev')?.addEventListener('click', () => {
    if (fieldOpsPage > 1) {
      fieldOpsPage--;
      renderAdminView(container, storage.rows);
    }
  });

  document.getElementById('btnFieldOpsNext')?.addEventListener('click', () => {
    fieldOpsPage++;
    renderAdminView(container, storage.rows);
  });

  container.querySelectorAll('.btn-delete-meeting').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Delete this farmer meeting log?')) {
        storage.deleteFarmerMeeting(id);
        showToast('Meeting record deleted', '🗑️');
        renderAdminView(container, storage.rows);
      }
    });
  });

  container.querySelectorAll('.btn-delete-demo').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Delete this demo plot record?')) {
        storage.deleteDemoPlot(id);
        showToast('Demo plot record deleted', '🗑️');
        renderAdminView(container, storage.rows);
      }
    });
  });

  container.querySelectorAll('.btn-delete-lead').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Delete this farmer demand lead?')) {
        storage.deleteFarmerLead(id);
        showToast('Farmer lead deleted', '🗑️');
        renderAdminView(container, storage.rows);
      }
    });
  });

  container.querySelectorAll('.btn-delete-intel').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Delete this competitor intel record?')) {
        storage.deleteCompetitorIntel(id);
        showToast('Competitor intel deleted', '🗑️');
        renderAdminView(container, storage.rows);
      }
    });
  });

  // EOD Tab Listeners
  document.getElementById('btnEodToday')?.addEventListener('click', () => {
    eodFilterDate = getTodayDateStr();
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnEodYesterday')?.addEventListener('click', () => {
    eodFilterDate = getYesterdayDateStr();
    renderAdminView(container, storage.rows);
  });

  document.getElementById('eodDateInput')?.addEventListener('change', (e) => {
    eodFilterDate = e.target.value;
    renderAdminView(container, storage.rows);
  });

  container.querySelectorAll('.btn-ack-eod').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      const date = btn.getAttribute('data-date');
      const input = document.getElementById(`eodFeedback_${asst}`);
      const feedback = input ? input.value.trim() : 'Approved';
      storage.acknowledgeEodReport(asst, date, feedback);
      showToast(`Acknowledged ${asst}'s EOD report. +5 habit points awarded!`, '⭐');
      renderAdminView(container, storage.rows);
    });
  });

  // Quiz Tab Listeners
  document.getElementById('btnAdminManageQuestions')?.addEventListener('click', () => {
    openAdminQuizModal(() => renderAdminView(container, storage.rows));
  });

  document.getElementById('btnAdminResetQuizCycle')?.addEventListener('click', () => {
    if (confirm('Launch new weekly cycle? This will reset all field reps to "Due / Incomplete" and broadcast a push reminder to all 8 reps.')) {
      storage.resetAllQuizStates();
      storage.broadcastNotification({
        title: 'New Weekly Agronomy Quiz Active',
        message: 'Management has launched a new weekly agronomy quiz cycle. Please complete the assessment in your field panel.',
        type: 'quiz'
      });
      showToast('Weekly assessment cycle launched! Notifications broadcast to all 8 reps.', '🔄');
      renderAdminView(container, storage.rows);
    }
  });

  container.querySelectorAll('.btn-audit-rep-quiz').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      if (asst) openRepQuizAuditModal(asst);
    });
  });

  container.querySelectorAll('.btn-remind-quiz').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      storage.sendAssistantNotification(asst, {
        title: 'Weekly Agronomy Assessment Due',
        message: 'Management reminder: Please complete your Weekly Agronomy Quiz today to earn your 10 Tech SOP points.',
        type: 'quiz'
      });
      showToast(`Push reminder delivered to ${asst}!`, '🔔');
    });
  });

  // Dynamic Forms Studio Listeners
  const handleOpenFormBuilder = () => {
    openFormBuilderModal(null, () => renderAdminView(container, storage.rows));
  };
  document.getElementById('btnAdminCreateForm')?.addEventListener('click', handleOpenFormBuilder);
  document.getElementById('btnAdminCreateFormEmpty')?.addEventListener('click', handleOpenFormBuilder);

  container.querySelectorAll('.btn-view-form-subs').forEach(btn => {
    btn.addEventListener('click', () => {
      const formId = btn.getAttribute('data-id');
      const form = storage.getDynamicForms().find(f => f.id === formId);
      if (form) {
        openFormSubmissionsModal(form, () => renderAdminView(container, storage.rows));
      }
    });
  });

  container.querySelectorAll('.btn-export-form-excel').forEach(btn => {
    btn.addEventListener('click', () => {
      const formId = btn.getAttribute('data-id');
      const form = storage.getDynamicForms().find(f => f.id === formId);
      if (form) {
        const subs = storage.getFormSubmissions().filter(s => s.formId === formId);
        exportFormSubmissionsToExcel(form, subs);
      }
    });
  });

  container.querySelectorAll('.btn-remind-form-reps').forEach(btn => {
    btn.addEventListener('click', () => {
      const formId = btn.getAttribute('data-id');
      const form = storage.getDynamicForms().find(f => f.id === formId);
      if (form) {
        const notif = {
          title: `Survey Action: ${form.title}`,
          message: `Management notice: Please fill out the assigned field survey "${form.title}" before ${form.deadline || 'end of week'}.`,
          type: 'form'
        };
        if (form.targetType === 'all') {
          storage.broadcastNotification(notif);
          showToast(`Survey notice broadcast to all 8 reps!`, '🔔');
        } else if (form.targetType === 'individual') {
          storage.sendAssistantNotification(form.targetValue, notif);
          showToast(`Survey notice delivered to ${form.targetValue}!`, '🔔');
        } else if (form.targetType === 'district') {
          const matching = storage.getAssistants().filter(a => a.district === form.targetValue);
          matching.forEach(a => storage.sendAssistantNotification(a.name, notif));
          showToast(`Survey notice delivered to ${matching.length} rep(s) in ${form.targetValue}!`, '🔔');
        }
      }
    });
  });

  container.querySelectorAll('.btn-delete-dynamic-form').forEach(btn => {
    btn.addEventListener('click', () => {
      const formId = btn.getAttribute('data-id');
      if (formId && confirm('Delete this dynamic form and all associated submissions? This cannot be undone.')) {
        storage.deleteDynamicForm(formId);
        showToast('Dynamic form removed', '🗑️');
        renderAdminView(container, storage.rows);
      }
    });
  });

  // Physical Inventory & Stock Quota Listeners
  const handleOpenIssueStockModal = (e) => {
    if (e) e.preventDefault();
    openAdminInventoryModal(null, () => renderAdminView(container, storage.rows));
  };
  document.getElementById('btnAdminIssueStock')?.addEventListener('click', handleOpenIssueStockModal);
  document.getElementById('btnAdminIssueStock2')?.addEventListener('click', handleOpenIssueStockModal);

  // Bulk Inventory Excel Template Download
  document.getElementById('btnDownloadStockTemplate')?.addEventListener('click', () => {
    downloadInventoryImportTemplate();
  });

  // Bulk Inventory Excel Upload
  const fileInputInv = document.getElementById('fileInputInventoryBulk');
  document.getElementById('btnAdminBulkUploadStock')?.addEventListener('click', () => {
    fileInputInv?.click();
  });

  fileInputInv?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showToast('Reading and validating Excel file…', '⏳');
      const { validRows, errors, totalRows } = await parseInventoryExcelFile(file);

      if (validRows.length === 0) {
        alert(
          `No valid stock quota rows found in "${file.name}".\n\n` +
          (errors.length ? 'Errors encountered:\n' + errors.slice(0, 6).join('\n') : 'Please ensure the sheet contains columns for Product Name and Allocated Quantity.') +
          '\n\nTip: Click "📑 Download Excel Template" to view the standard format.'
        );
        fileInputInv.value = '';
        return;
      }

      let confirmMsg = `Found ${validRows.length} valid stock allocations across ${totalRows} rows in "${file.name}":\n\n`;
      validRows.slice(0, 4).forEach(r => {
        confirmMsg += `• ${r.productName} (${r.crop}) — ${r.allocatedQty} ${r.unit} ➔ ${r.targetRep === 'ALL_ACTIVE' ? 'ALL 8 Active Assistants' : r.targetRep}\n`;
      });
      if (validRows.length > 4) confirmMsg += `...and ${validRows.length - 4} more items.\n`;
      if (errors.length > 0) confirmMsg += `\n⚠️ Note: ${errors.length} invalid rows will be skipped.\n`;
      confirmMsg += `\nConfirm and issue these stock quotas to the field ledger now?`;

      if (confirm(confirmMsg)) {
        const assistants = storage.getAssistants();
        let totalCreated = 0;

        for (const item of validRows) {
          if (item.targetRep === 'ALL_ACTIVE') {
            assistants.forEach(a => {
              storage.saveInventoryAllocation({
                ...item,
                targetRep: a.name
              });
              storage.sendAssistantNotification(a.name, {
                title: `New Stock Quota: ${item.allocatedQty} ${item.unit} of ${item.productName}`,
                message: `Management has issued ${item.allocatedQty} ${item.unit} of ${item.productName} for ${item.season}. Check your Stock Ledger.`,
                type: 'stock'
              });
              totalCreated++;
            });
          } else {
            storage.saveInventoryAllocation(item);
            storage.sendAssistantNotification(item.targetRep, {
              title: `Stock Allocated: ${item.allocatedQty} ${item.unit} of ${item.productName}`,
              message: `Management has issued ${item.allocatedQty} ${item.unit} of ${item.productName}. Check your Stock Ledger.`,
              type: 'stock'
            });
            totalCreated++;
          }
        }

        showToast(`Successfully issued ${totalCreated} stock quota allocations!`, '🎉');
        renderAdminView(container, storage.rows);
      }
    } catch(err) {
      console.error(err);
      alert('Error parsing inventory Excel file: ' + err.message);
    } finally {
      fileInputInv.value = '';
    }
  });

  document.getElementById('btnExportInventoryExcel')?.addEventListener('click', () => {
    const summary = storage.getInventoryLedgerSummary({
      period: inventoryPeriodFilter,
      startDate: inventoryCustomStartDate,
      endDate: inventoryCustomEndDate,
      assistant: inventoryFilterRep,
      product: inventoryFilterProduct,
      includePastAllocations: inventoryIncludePast
    });
    exportInventoryToExcel(summary);
  });

  document.getElementById('btnPrintStockDossier')?.addEventListener('click', () => {
    window.print();
  });

  // Weekly & Historical Filter Controls
  document.getElementById('selInvPeriod')?.addEventListener('change', (e) => {
    inventoryPeriodFilter = e.target.value;
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('chkInvIncludePast')?.addEventListener('change', (e) => {
    inventoryIncludePast = e.target.checked;
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('selInvRep')?.addEventListener('change', (e) => {
    inventoryFilterRep = e.target.value;
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('selInvProduct')?.addEventListener('change', (e) => {
    inventoryFilterProduct = e.target.value;
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('inpInvStartDate')?.addEventListener('change', (e) => {
    inventoryCustomStartDate = e.target.value;
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('inpInvEndDate')?.addEventListener('change', (e) => {
    inventoryCustomEndDate = e.target.value;
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnResetInvFilters')?.addEventListener('click', () => {
    inventoryPeriodFilter = 'all';
    inventoryFilterRep = '';
    inventoryFilterProduct = '';
    inventoryCustomStartDate = '';
    inventoryCustomEndDate = '';
    inventoryIncludePast = true;
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  // Inventory Table Pagination Event Handlers
  document.getElementById('selInvPageSize')?.addEventListener('change', (e) => {
    inventoryPageSize = parseInt(e.target.value, 10) || 10;
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnInvFirstPage')?.addEventListener('click', () => {
    inventoryPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnInvPrevPage')?.addEventListener('click', () => {
    if (inventoryPage > 1) {
      inventoryPage--;
      renderAdminView(container, storage.rows);
    }
  });

  document.getElementById('btnInvNextPage')?.addEventListener('click', () => {
    inventoryPage++;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnInvLastPage')?.addEventListener('click', () => {
    const summary = storage.getInventoryLedgerSummary({
      period: inventoryPeriodFilter,
      startDate: inventoryCustomStartDate,
      endDate: inventoryCustomEndDate,
      assistant: inventoryFilterRep,
      product: inventoryFilterProduct,
      includePastAllocations: inventoryIncludePast
    });
    const maxP = Math.ceil(summary.allocMetrics.length / inventoryPageSize) || 1;
    inventoryPage = maxP;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnAdminReconcileWeek')?.addEventListener('click', () => {
    const summary = storage.getInventoryLedgerSummary({
      period: inventoryPeriodFilter,
      startDate: inventoryCustomStartDate,
      endDate: inventoryCustomEndDate,
      assistant: inventoryFilterRep,
      product: inventoryFilterProduct,
      includePastAllocations: inventoryIncludePast
    });

    const remarks = prompt(
      `Sign-Off & Reconcile ${summary.filterMeta.periodLabel}:\n\n` +
      `• Portfolio Realized: ₹${summary.totalRealizedVal.toLocaleString()} (${summary.overallLiquidationPct}%)\n` +
      `• Total Field Movements: ${summary.totalMovementsCount}\n\n` +
      `Enter supervisory review remarks or audit notes:`
    );

    if (remarks !== null) {
      storage.broadcastNotification({
        title: `Weekly Stock Liquidation Reconciled (${summary.filterMeta.periodLabel})`,
        message: `Management review signed off: "${remarks || 'Approved and reconciled'}". Realization: ₹${summary.totalRealizedVal.toLocaleString()} across territory hubs.`,
        type: 'stock'
      });
      showToast(`Weekly stock liquidation successfully reconciled & signed off!`, '✅');
    }
  });

  container.querySelectorAll('.btn-admin-issue-to-rep').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      openAdminInventoryModal({ targetRep: asst }, () => renderAdminView(container, storage.rows));
    });
  });

  container.querySelectorAll('.btn-admin-remind-liquidation').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      storage.sendAssistantNotification(asst, {
        title: 'Physical Stock Liquidation & Sample Audit',
        message: 'Management reminder: Please record your counter liquidation sales and farmer demo samples in your Stock Ledger today.',
        type: 'stock'
      });
      showToast(`Stock reminder sent to ${asst}!`, '🔔');
    });
  });

  container.querySelectorAll('.btn-delete-alloc').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id && confirm('Delete this inventory allocation quota? This will also remove any linked movements.')) {
        storage.deleteInventoryAllocation(id);
        showToast('Inventory quota deleted', '🗑️');
        renderAdminView(container, storage.rows);
      }
    });
  });

  // GPS Check-In Audit Listeners
  document.getElementById('btnExportCheckInExcel')?.addEventListener('click', () => {
    const logs = storage.getCheckInLogs();
    if (logs.length === 0) return showToast('No check-in records available to export.', 'ℹ️');
    exportCheckInAuditToExcel(logs);
  });

  document.getElementById('btnExportCheckInCsv')?.addEventListener('click', () => {
    const logs = storage.getCheckInLogs();
    if (logs.length === 0) return showToast('No check-in records available to export.', 'ℹ️');
    exportCheckInAuditToCsv(logs);
  });

  document.getElementById('checkInSearchInput')?.addEventListener('input', (e) => {
    checkInSearch = e.target.value;
    checkInPage = 1;
    renderCheckInAuditRows();
  });

  document.getElementById('checkInDateFilter')?.addEventListener('change', (e) => {
    checkInFilterDate = e.target.value;
    checkInPage = 1;
    renderCheckInAuditRows();
  });

  document.getElementById('checkInRepFilter')?.addEventListener('change', (e) => {
    checkInFilterRep = e.target.value;
    checkInPage = 1;
    renderCheckInAuditRows();
  });

  document.getElementById('checkInProxFilter')?.addEventListener('change', (e) => {
    checkInFilterProximity = e.target.value;
    checkInPage = 1;
    renderCheckInAuditRows();
  });

  document.getElementById('btnCheckInPrev')?.addEventListener('click', () => {
    if (checkInPage > 1) {
      checkInPage--;
      renderCheckInAuditRows();
    }
  });

  // TA/DA Claims & Smart Tour Beat Listeners
  document.getElementById('btnAdminOpenTadaPolicy')?.addEventListener('click', () => {
    openTadaPolicyModal(() => renderAdminView(container, storage.rows));
  });

  document.getElementById('btnAdminEditPolicyStrip')?.addEventListener('click', () => {
    openTadaPolicyModal(() => renderAdminView(container, storage.rows));
  });

  document.getElementById('btnExportTadaExcel')?.addEventListener('click', () => {
    const claims = storage.getTadaClaims({
      assistant: tadaFilterRep,
      status: tadaFilterStatus,
      startDate: tadaFilterDate,
      endDate: tadaFilterDate
    });
    if (claims.length === 0) return showToast('No claims match the filter criteria.', 'ℹ️');
    exportTadaClaimsToExcel(claims);
  });

  document.getElementById('btnAdminOpenBeatPlanner')?.addEventListener('click', () => {
    const defaultRep = tadaFilterRep !== 'ALL' ? tadaFilterRep : 'Assistant 1 (West Patna)';
    openSmartTourBeatModal({ assistant: defaultRep, initialTab: 'beat' });
  });

  document.getElementById('btnApproveAllVerifiedTada')?.addEventListener('click', () => {
    const allClaims = storage.getTadaClaims();
    const pendingVerified = allClaims.filter(c => {
      if (c.status !== 'Pending Approval') return false;
      const diff = (Number(c.claimedKm) || 0) - (Number(c.gpsVerifiedKm) || 0);
      return !((c.gpsVerifiedKm > 0 && c.claimedKm > c.gpsVerifiedKm * 1.15) || diff > 10);
    });

    if (pendingVerified.length === 0) {
      return showToast('No unflagged pending claims to approve.', 'ℹ️');
    }

    if (confirm(`Approve all ${pendingVerified.length} verified TA/DA claims?`)) {
      pendingVerified.forEach(c => {
        storage.updateTadaClaimStatus(c.id, {
          status: 'Approved',
          approvedAmount: c.totalClaimAmount,
          managerNotes: 'Batch approved: verified GPS telemetry confirmed.',
          approvedBy: 'State Sales Manager (Bihar HQ)',
          approvedAt: new Date().toISOString()
        });
      });
      showToast(`✅ ${pendingVerified.length} TA/DA claims approved in batch!`, '⚡');
      renderAdminView(container, storage.rows);
    }
  });

  document.getElementById('selTadaRepFilter')?.addEventListener('change', (e) => {
    tadaFilterRep = e.target.value;
    tadaPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('selTadaStatusFilter')?.addEventListener('change', (e) => {
    tadaFilterStatus = e.target.value;
    tadaPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('iptTadaAdminDate')?.addEventListener('change', (e) => {
    tadaFilterDate = e.target.value;
    tadaPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnResetTadaFilters')?.addEventListener('click', () => {
    tadaFilterRep = 'ALL';
    tadaFilterStatus = 'all';
    tadaFilterDate = '';
    tadaPage = 1;
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnTadaPrevPage')?.addEventListener('click', () => {
    if (tadaPage > 1) {
      tadaPage--;
      renderAdminView(container, storage.rows);
    }
  });

  document.getElementById('btnTadaNextPage')?.addEventListener('click', () => {
    tadaPage++;
    renderAdminView(container, storage.rows);
  });

  container.querySelectorAll('.btn-quick-approve-tada').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const claim = storage.getTadaClaim(id);
      if (claim) {
        storage.updateTadaClaimStatus(id, {
          status: 'Approved',
          approvedAmount: claim.totalClaimAmount,
          managerNotes: 'Quick approved by State Sales Manager.',
          approvedBy: 'State Sales Manager (Bihar HQ)',
          approvedAt: new Date().toISOString()
        });
        showToast(`Approved claim of ₹${claim.totalClaimAmount} for ${claim.assistant}!`, '✅');
        renderAdminView(container, storage.rows);
      }
    });
  });

  container.querySelectorAll('.btn-audit-adjust-tada').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        openTadaAuditAdjustModal(id, () => renderAdminView(container, storage.rows));
      }
    });
  });

  container.querySelectorAll('.btn-reject-tada').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const claim = storage.getTadaClaim(id);
      if (claim) {
        const reason = prompt(`Enter rejection reason for ${claim.assistant}'s claim (${claim.date}):`, 'Mileage discrepancy / unverified check-in trail');
        if (reason !== null) {
          storage.updateTadaClaimStatus(id, {
            status: 'Rejected',
            approvedAmount: 0,
            managerNotes: reason,
            approvedBy: 'State Sales Manager (Bihar HQ)',
            approvedAt: new Date().toISOString()
          });
          showToast(`Claim rejected.`, 'ℹ️');
          renderAdminView(container, storage.rows);
        }
      }
    });
  });

  // =========================================================================
  // MUSTER ROLL TAB EVENT LISTENERS
  // =========================================================================

  document.getElementById('selMusterMonth')?.addEventListener('change', (e) => {
    musterMonth = parseInt(e.target.value, 10);
    renderAdminView(container, storage.rows);
  });

  document.getElementById('selMusterYear')?.addEventListener('change', (e) => {
    musterYear = parseInt(e.target.value, 10);
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnMusterAutoGps')?.addEventListener('click', () => {
    if (typeof storage.autoPopulateMusterRollFromGps === 'function') {
      const count = storage.autoPopulateMusterRollFromGps(musterYear, musterMonth);
      showToast(`⚡ Auto-populated ${count} attendance records from GPS check-in logs!`, '📡');
      renderAdminView(container, storage.rows);
    } else {
      showToast('Auto-populate feature syncing from GPS logs…', '📡');
    }
  });

  document.getElementById('btnMusterMarkSundays')?.addEventListener('click', () => {
    if (typeof storage.autoMarkSundaysWeeklyOff === 'function') {
      const count = storage.autoMarkSundaysWeeklyOff(musterYear, musterMonth);
      showToast(`📅 Marked ${count} Sundays as Weekly Off (WO) for ${musterMonth}/${musterYear}!`, '✅');
      renderAdminView(container, storage.rows);
    }
  });

  document.getElementById('btnMusterApplyHolidays')?.addEventListener('click', () => {
    const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
    const holidays = settings.biharGazettedHolidays || [];
    const monthStr = `${musterYear}-${String(musterMonth).padStart(2, '0')}`;
    const applicable = holidays.filter(h => h.date && h.date.startsWith(monthStr));
    if (applicable.length === 0) {
      showToast(`No Bihar gazetted holidays in ${musterMonth}/${musterYear}.`, 'ℹ️');
      return;
    }
    const assistants = storage.getAssistants();
    applicable.forEach(holiday => {
      assistants.forEach(asst => {
        if (typeof storage.updateAttendanceStatus === 'function') {
          storage.updateAttendanceStatus(asst.name, holiday.date, 'H', `Bihar Gazetted Holiday: ${holiday.name}`);
        }
      });
    });
    showToast(`🏛️ Applied ${applicable.length} Bihar gazetted holiday(s) for all reps in ${musterMonth}/${musterYear}!`, '✅');
    renderAdminView(container, storage.rows);
  });

  document.getElementById('btnMusterExportExcel')?.addEventListener('click', () => {
    const musterData = storage.getMusterRollMonthData(musterYear, musterMonth);
    if (musterData) {
      exportMusterRollToExcel(musterData);
    } else {
      showToast('No muster data available to export.', 'ℹ️');
    }
  });

  document.getElementById('btnMusterPrintFormD')?.addEventListener('click', () => {
    showToast('Opening print-ready Form D view…', '🖨️');
    const musterData = storage.getMusterRollMonthData(musterYear, musterMonth);
    if (!musterData) return;
    const printWin = window.open('', '_blank', 'width=1200,height=800');
    if (!printWin) { showToast('Pop-up blocked. Allow pop-ups and try again.', '⚠️'); return; }
    const { rows, monthName, daysInMonth, totalPayableDays, totalGrossPayroll, settings } = musterData;
    const dayNums = Array.from({length: daysInMonth}, (_, i) => i + 1);
    printWin.document.write(`
      <html><head><title>Form D - Muster Roll - ${monthName} ${musterYear}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 10px; }
        h2, h3 { text-align: center; margin: 4px 0; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border: 1px solid #333; padding: 3px 5px; text-align: center; font-size: 9px; }
        th { background: #dbeafe; font-weight: bold; }
        .emp-col { text-align: left; min-width: 120px; }
        .total-row { background: #f0fdf4; font-weight: bold; }
        @media print { @page { size: A3 landscape; margin: 5mm; } }
      </style></head><body>
      <h2>BIHAR AGTECH - STATUTORY MUSTER ROLL</h2>
      <h3>Form XVI / Form D — ${monthName} ${musterYear}</h3>
      <p style="text-align:center; font-size:9px;">Field Operations Division | Bihar Territory | Daily Wage: ₹${settings.dailyBaseWage || 650}/day</p>
      <table>
        <thead>
          <tr>
            <th>Emp ID</th><th class="emp-col">Name & Designation</th><th>HQ</th>
            ${dayNums.map(d => `<th>${d}</th>`).join('')}
            <th>P</th><th>HD</th><th>OD</th><th>WO</th><th>A</th><th>Payable Days</th><th>Wage (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.empCode}</td>
              <td class="emp-col" style="text-align:left;">${r.assistant}<br><small>${r.designation || 'MGO'}</small></td>
              <td>${r.hq}</td>
              ${r.dailyAttendance.map(d => `<td>${d.code === '—' ? '·' : d.code}</td>`).join('')}
              <td><b>${r.presentCount}</b></td><td>${r.halfDayCount}</td><td>${r.onDutyCount}</td><td>${r.weeklyOffCount}</td><td style="color:red;">${r.absentCount}</td>
              <td><b>${r.payableDays.toFixed(1)}</b></td><td><b>₹${r.grossWage.toLocaleString('en-IN')}</b></td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3"><b>TOTAL</b></td>
            ${dayNums.map(() => '<td>—</td>').join('')}
            <td><b>${rows.reduce((s,r)=>s+r.presentCount,0)}</b></td>
            <td>${rows.reduce((s,r)=>s+r.halfDayCount,0)}</td>
            <td>${rows.reduce((s,r)=>s+r.onDutyCount,0)}</td>
            <td>${rows.reduce((s,r)=>s+r.weeklyOffCount,0)}</td>
            <td>${rows.reduce((s,r)=>s+r.absentCount,0)}</td>
            <td><b>${totalPayableDays.toFixed(1)}</b></td>
            <td><b>₹${totalGrossPayroll.toLocaleString('en-IN')}</b></td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top:20px; font-size:9px;">Supervisor Signature: __________________ &nbsp;&nbsp; Date: __________</p>
      <script>window.print();</script></body></html>`);
    printWin.document.close();
  });

  // Inline Muster Cell Override (click any cell to change status)
  container.querySelectorAll('.btn-muster-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      const date = btn.getAttribute('data-date');
      const currentCode = btn.getAttribute('data-code');
      const codes = ['P', 'HD', 'OD', 'WO', 'PL', 'H', 'A'];
      const labels = { P:'Present (Full Day)', HD:'Half Day (0.5)', OD:'On Duty / Field Tour', WO:'Weekly Off (Sunday)', PL:'Paid Leave', H:'Bihar Gazetted Holiday', A:'Absent' };
      const choice = prompt(
        `Override attendance for ${asst} on ${date}:\nCurrent: ${currentCode}\n\nEnter new code:\n${codes.map(c => `  ${c} = ${labels[c]}`).join('\n')}`,
        currentCode
      );
      if (choice && codes.includes(choice.toUpperCase().trim())) {
        const newCode = choice.toUpperCase().trim();
        if (typeof storage.updateAttendanceStatus === 'function') {
          storage.updateAttendanceStatus(asst, date, newCode, `Manager override → ${labels[newCode]}`);
          showToast(`✅ ${asst} (${date}): Updated to ${newCode}`, '📋');
          renderAdminView(container, storage.rows);
        }
      } else if (choice !== null) {
        showToast('Invalid code. Use P, HD, OD, WO, PL, H, or A.', '⚠️');
      }
    });
  });

  // Regularization Approve
  container.querySelectorAll('.btn-approve-regularization').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      const date = btn.getAttribute('data-date');
      const status = btn.getAttribute('data-status') || 'P';
      if (typeof storage.reviewAttendanceRegularization === 'function') {
        storage.reviewAttendanceRegularization(asst, date, 'Approved', status);
      } else if (typeof storage.updateAttendanceStatus === 'function') {
        storage.updateAttendanceStatus(asst, date, status, 'Regularization approved by manager');
      }
      showToast(`✅ Regularization approved for ${asst} on ${date}`, '✓');
      renderAdminView(container, storage.rows);
    });
  });

  // Regularization Reject
  container.querySelectorAll('.btn-reject-regularization').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      const date = btn.getAttribute('data-date');
      const reason = prompt(`Rejection reason for ${asst}'s punch correction (${date}):`, 'Insufficient justification');
      if (reason !== null) {
        if (typeof storage.reviewAttendanceRegularization === 'function') {
          storage.reviewAttendanceRegularization(asst, date, 'Rejected', null, reason);
        }
        showToast(`Punch correction request rejected for ${asst} on ${date}.`, 'ℹ️');
        renderAdminView(container, storage.rows);
      }
    });
  });

  // Individual Rep Attendance Drill-Down
  container.querySelectorAll('.btn-view-rep-attendance').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      openAttendanceModal({ assistant: asst, initialTab: 'calendar' });
    });
  });

  // =========================================================================
  // LEAVE MANAGEMENT TAB EVENT LISTENERS
  // =========================================================================

  // Sub-tab switchers
  ['pending','balance','calendar','history','settings'].forEach(tab => {
    document.getElementById(`leaveAdminSubTab_${tab}`)?.addEventListener('click', () => {
      leaveAdminSubTab = tab;
      renderAdminView(container, storage.rows);
    });
  });

  // ── Leave Policy Settings form ──
  document.getElementById('frmLeavePolicy')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
    settings.dailyBaseWage = parseInt(document.getElementById('cfgDailyWage')?.value || '650', 10);
    settings.leavePolicy = {
      ...(settings.leavePolicy || {}),
      annualPL: parseInt(document.getElementById('cfgAnnualPL')?.value || '12', 10),
      annualCL: parseInt(document.getElementById('cfgAnnualCL')?.value || '12', 10),
      annualSL: parseInt(document.getElementById('cfgAnnualSL')?.value || '12', 10),
      plMaxCarryForward: parseInt(document.getElementById('cfgPLCarryFwd')?.value || '15', 10),
      plMaxEncashableYearEnd: parseInt(document.getElementById('cfgPLEncash')?.value || '30', 10)
    };
    if (storage.saveAttendanceSettings) storage.saveAttendanceSettings(settings);
    showToast('✅ Leave policy saved! PL/CL/SL entitlements updated for all reps.', '💾');
    renderAdminView(container, storage.rows);
  });

  // ── Balance Override form ──
  document.getElementById('frmBalanceOverride')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const assistant = document.getElementById('overrideRepSelect')?.value;
    const plCarry = parseFloat(document.getElementById('overridePLCarry')?.value || '0');
    const reason = document.getElementById('overrideReason')?.value?.trim();
    if (!assistant) { showToast('Please select a representative.', '⚠️'); return; }
    if (plCarry === 0) { showToast('Please enter a carry-forward value.', '⚠️'); return; }

    // Save as a manual PL adjustment leave application (backdated to Jan 1)
    const year = leaveAdminYear;
    storage.saveLeaveApplication({
      id: `leave_pl_adj_${assistant.replace(/[^a-z0-9]/gi,'_')}_${year}_${Date.now()}`,
      assistant,
      empCode: storage.getEmployeeMetadata(assistant).empCode,
      leaveType: 'PL_ADJ',
      leaveLabel: 'PL Opening Balance Adjustment',
      fromDate: `${year-1}-12-31`,
      toDate: `${year-1}-12-31`,
      days: -plCarry, // negative = adding to carry forward (not deducting)
      halfDay: false,
      reason: reason || `Manual PL carry-forward adjustment by admin`,
      status: 'Approved',
      appliedAt: new Date().toISOString(),
      approvedBy: 'State Sales Manager (Bihar HQ)',
      approvedAt: new Date().toISOString(),
      managerRemarks: `Opening balance override: +${plCarry} PL days carry-forward. ${reason || ''}`
    });
    showToast(`✅ PL balance override applied for ${assistant}: +${plCarry} days carry-forward.`, '✓');
    renderAdminView(container, storage.rows);
  });

  // ── Add Holiday form ──
  document.getElementById('frmAddHoliday')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('newHolidayDate')?.value;
    const name = document.getElementById('newHolidayName')?.value?.trim();
    if (!date || !name) return;
    const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
    if (!Array.isArray(settings.biharGazettedHolidays)) settings.biharGazettedHolidays = [];
    if (settings.biharGazettedHolidays.some(h => h.date === date)) {
      showToast('A holiday already exists on this date.', '⚠️'); return;
    }
    settings.biharGazettedHolidays.push({ date, name });
    if (storage.saveAttendanceSettings) storage.saveAttendanceSettings(settings);
    showToast(`✅ Holiday added: ${name} (${date})`, '🏛️');
    renderAdminView(container, storage.rows);
  });

  // ── Delete individual holiday ──
  container.querySelectorAll('.btn-delete-holiday').forEach(btn => {
    btn.addEventListener('click', () => {
      const date = btn.getAttribute('data-date');
      if (!confirm(`Remove holiday on ${date}?`)) return;
      const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
      settings.biharGazettedHolidays = (settings.biharGazettedHolidays || []).filter(h => h.date !== date);
      if (storage.saveAttendanceSettings) storage.saveAttendanceSettings(settings);
      showToast('Holiday removed.', 'ℹ️');
      renderAdminView(container, storage.rows);
    });
  });

  // ── Preset 2026 Bihar Gazetted Holidays ──
  document.getElementById('btnPreset2026Holidays')?.addEventListener('click', () => {
    if (!confirm('This will ADD all standard 2026 Bihar gazetted holidays (will not remove existing). Proceed?')) return;
    const preset2026 = [
      { date: '2026-01-14', name: 'Makar Sankranti / Khichdi (मकर संक्रांति)' },
      { date: '2026-01-26', name: 'Republic Day (गणतंत्र दिवस)' },
      { date: '2026-02-26', name: 'Maha Shivratri (महाशिवरात्रि)' },
      { date: '2026-03-13', name: 'Holika Dahan (होलिका दहन)' },
      { date: '2026-03-14', name: 'Holi (होली)' },
      { date: '2026-03-22', name: 'Bihar Diwas (बिहार दिवस)' },
      { date: '2026-03-30', name: 'Ram Navami (रामनवमी)' },
      { date: '2026-04-02', name: 'Mahavir Jayanti (महावीर जयंती)' },
      { date: '2026-04-03', name: 'Good Friday' },
      { date: '2026-04-14', name: 'Ambedkar Jayanti / Baisakhi (आंबेडकर जयंती)' },
      { date: '2026-05-25', name: 'Buddha Purnima (बुद्ध पूर्णिमा)' },
      { date: '2026-06-19', name: 'Eid ul-Zuha / Bakrid (ईद-उल-जुहा)' },
      { date: '2026-07-17', name: 'Muharram (मुहर्रम)' },
      { date: '2026-08-15', name: 'Independence Day (स्वतंत्रता दिवस)' },
      { date: '2026-09-16', name: 'Milad-un-Nabi (मिलाद-उन-नबी)' },
      { date: '2026-10-02', name: 'Gandhi Jayanti (गांधी जयंती)' },
      { date: '2026-10-20', name: 'Dussehra / Vijaya Dashami (दशहरा)' },
      { date: '2026-11-09', name: 'Diwali / Deepawali (दीपावली)' },
      { date: '2026-11-10', name: 'Govardhan Puja (गोवर्धन पूजा)' },
      { date: '2026-11-11', name: 'Bhai Dooj (भाई दूज)' },
      { date: '2026-11-15', name: 'Chhath Puja Sandhya Arghya (छठ संध्या अर्घ्य)' },
      { date: '2026-11-16', name: 'Chhath Puja Usha Arghya / Parayan (छठ पारण)' },
      { date: '2026-11-25', name: 'Guru Nanak Jayanti (गुरु नानक जयंती)' },
      { date: '2026-12-25', name: 'Christmas Day (क्रिसमस)' }
    ];
    const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
    if (!Array.isArray(settings.biharGazettedHolidays)) settings.biharGazettedHolidays = [];
    let added = 0;
    preset2026.forEach(h => {
      if (!settings.biharGazettedHolidays.some(ex => ex.date === h.date)) {
        settings.biharGazettedHolidays.push(h); added++;
      }
    });
    if (storage.saveAttendanceSettings) storage.saveAttendanceSettings(settings);
    showToast(`✅ ${added} Bihar 2026 gazetted holidays added!`, '🏛️');
    renderAdminView(container, storage.rows);
  });

  // ── Preset 2027 Bihar Gazetted Holidays ──
  document.getElementById('btnPreset2027Holidays')?.addEventListener('click', () => {
    if (!confirm('This will ADD all standard 2027 Bihar gazetted holidays. Proceed?')) return;
    const preset2027 = [
      { date: '2027-01-14', name: 'Makar Sankranti (मकर संक्रांति)' },
      { date: '2027-01-26', name: 'Republic Day (गणतंत्र दिवस)' },
      { date: '2027-03-04', name: 'Maha Shivratri (महाशिवरात्रि)' },
      { date: '2027-03-22', name: 'Bihar Diwas (बिहार दिवस)' },
      { date: '2027-03-22', name: 'Holi (होली)' },
      { date: '2027-04-13', name: 'Baisakhi / Ambedkar Jayanti (आंबेडकर जयंती)' },
      { date: '2027-04-14', name: 'Ram Navami (रामनवमी)' },
      { date: '2027-08-15', name: 'Independence Day (स्वतंत्रता दिवस)' },
      { date: '2027-10-02', name: 'Gandhi Jayanti (गांधी जयंती)' },
      { date: '2027-10-09', name: 'Dussehra / Vijaya Dashami (दशहरा)' },
      { date: '2027-10-29', name: 'Diwali / Deepawali (दीपावली)' },
      { date: '2027-11-03', name: 'Chhath Puja Sandhya Arghya (छठ संध्या अर्घ्य)' },
      { date: '2027-11-04', name: 'Chhath Puja Usha Arghya / Parayan (छठ पारण)' },
      { date: '2027-12-25', name: 'Christmas Day (क्रिसमस)' }
    ];
    const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
    if (!Array.isArray(settings.biharGazettedHolidays)) settings.biharGazettedHolidays = [];
    let added = 0;
    preset2027.forEach(h => {
      if (!settings.biharGazettedHolidays.some(ex => ex.date === h.date)) {
        settings.biharGazettedHolidays.push(h); added++;
      }
    });
    if (storage.saveAttendanceSettings) storage.saveAttendanceSettings(settings);
    showToast(`✅ ${added} Bihar 2027 gazetted holidays added!`, '🏛️');
    renderAdminView(container, storage.rows);
  });

  // ── Clear all holidays ──
  document.getElementById('btnClearAllHolidays')?.addEventListener('click', () => {
    if (!confirm('⚠️ This will remove ALL configured holidays. This cannot be undone. Are you sure?')) return;
    const settings = storage.getAttendanceSettings ? storage.getAttendanceSettings() : {};
    settings.biharGazettedHolidays = [];
    if (storage.saveAttendanceSettings) storage.saveAttendanceSettings(settings);
    showToast('All holidays cleared.', 'ℹ️');
    renderAdminView(container, storage.rows);
  });


  document.getElementById('leaveAdminYearSelect')?.addEventListener('change', (e) => {
    leaveAdminYear = parseInt(e.target.value, 10);
    renderAdminView(container, storage.rows);
  });

  // Calendar navigation
  document.getElementById('btnLeaveAdminCalPrev')?.addEventListener('click', () => {
    leaveAdminMonth--;
    if (leaveAdminMonth < 1) { leaveAdminMonth = 12; leaveAdminYear--; }
    renderAdminView(container, storage.rows);
  });
  document.getElementById('btnLeaveAdminCalNext')?.addEventListener('click', () => {
    leaveAdminMonth++;
    if (leaveAdminMonth > 12) { leaveAdminMonth = 1; leaveAdminYear++; }
    renderAdminView(container, storage.rows);
  });

  // History filters
  document.getElementById('leaveAdminRepFilter')?.addEventListener('change', (e) => {
    leaveAdminRepFilter = e.target.value;
    renderAdminView(container, storage.rows);
  });
  document.getElementById('leaveAdminStatusFilter')?.addEventListener('change', (e) => {
    leaveAdminStatusFilter = e.target.value;
    renderAdminView(container, storage.rows);
  });

  // Export Leave Balance Report
  document.getElementById('btnExportLeaveExcel')?.addEventListener('click', () => {
    const balances = storage.getAllLeaveBalances ? storage.getAllLeaveBalances(leaveAdminYear) : [];
    const applications = storage.getLeaveApplications({ year: leaveAdminYear });
    if (typeof exportLeaveBalanceReportToExcel === 'function') {
      exportLeaveBalanceReportToExcel(balances, applications, leaveAdminYear);
    } else {
      showToast('Excel export function loading…', 'ℹ️');
    }
  });

  // Approve leave
  container.querySelectorAll('.btn-approve-leave').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const remarks = prompt('Approval remarks (optional):', 'Approved. Attendance will be updated accordingly.');
      if (remarks === null) return; // cancelled
      const result = storage.reviewLeaveApplication(id, 'Approved', remarks);
      if (result.success) {
        showToast('✅ Leave application approved! Attendance records updated.', '✓');
        renderAdminView(container, storage.rows);
      } else {
        showToast(`Error: ${result.error}`, '⚠️');
      }
    });
  });

  // Reject leave
  container.querySelectorAll('.btn-reject-leave').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const asst = btn.getAttribute('data-asst');
      const reason = prompt(`Rejection reason for ${asst}'s leave request:`, 'Operational requirement — cannot be spared during this period.');
      if (reason !== null) {
        const result = storage.reviewLeaveApplication(id, 'Rejected', reason);
        if (result.success) {
          showToast(`Leave application rejected.`, 'ℹ️');
          renderAdminView(container, storage.rows);
        }
      }
    });
  });

  // Open individual rep leave modal from admin
  container.querySelectorAll('.btn-open-leave-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const asst = btn.getAttribute('data-asst');
      openLeaveModal({ assistant: asst, initialTab: 'history' });
    });
  });

  // Dealers Master Listeners
  document.getElementById('btnAdminAddRetailer')?.addEventListener('click', () => openRetailerModal());

  const searchInput = document.getElementById('adminSearchInput');
  searchInput?.addEventListener('input', (e) => {
    adminSearch = e.target.value;
    adminPage = 1;
    renderTableRows();
  });

  document.getElementById('adminAssistantSelect')?.addEventListener('change', (e) => {
    adminAssistantFilter = e.target.value;
    adminPage = 1;
    renderTableRows();
  });

  document.getElementById('adminStatusSelect')?.addEventListener('change', (e) => {
    adminStatusFilter = e.target.value;
    adminPage = 1;
    renderTableRows();
  });

  document.getElementById('adminCategorySelect')?.addEventListener('change', (e) => {
    adminCategoryFilter = e.target.value;
    adminPage = 1;
    renderTableRows();
  });

  document.getElementById('btnAdminPrevPage')?.addEventListener('click', () => {
    adminPage--;
    renderTableRows();
  });

  document.getElementById('btnAdminNextPage')?.addEventListener('click', () => {
    adminPage++;
    renderTableRows();
  });

  // Clear Bulk Selection
  document.getElementById('btnAdminClearSelection')?.addEventListener('click', () => {
    selectedRetailerIds.clear();
    updateBulkBarUI();
    renderTableRows();
  });

  // Apply Bulk Reassign
  document.getElementById('btnAdminApplyBulkReassign')?.addEventListener('click', async () => {
    const targetRep = document.getElementById('adminBulkTargetRep')?.value;
    const count = selectedRetailerIds.size;
    if (count === 0) return;

    if (confirm(`Reassign ${count} selected retailers to "${targetRep}"?`)) {
      try {
        await storage.reassignMultipleRetailers(Array.from(selectedRetailerIds), targetRep);
        showToast(`Successfully reassigned ${count} retailers to ${targetRep}!`, '🎉');
        selectedRetailerIds.clear();
        updateBulkBarUI();
        renderTableRows();
      } catch(err) {
        showToast(err.message, '❌');
      }
    }
  });

  // Select all on page
  document.getElementById('adminSelectAllPage')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    container.querySelectorAll('.admin-row-cb').forEach(cb => {
      const id = cb.getAttribute('data-id');
      if (checked) {
        selectedRetailerIds.add(id);
        cb.checked = true;
      } else {
        selectedRetailerIds.delete(id);
        cb.checked = false;
      }
    });
    updateBulkBarUI();
  });
}

function updateBulkBarUI() {
  const bulkBar = document.getElementById('adminBulkBar');
  const countEl = document.getElementById('adminSelectedCount');
  if (!bulkBar || !countEl) return;

  const count = selectedRetailerIds.size;
  if (count > 0) {
    bulkBar.style.display = 'flex';
    countEl.textContent = `${count} retailer${count > 1 ? 's' : ''} selected`;
  } else {
    bulkBar.style.display = 'none';
  }
}

function renderTableRows() {
  const tbody = document.getElementById('adminTableBody');
  const pageInfo = document.getElementById('adminPageInfo');
  const prevBtn = document.getElementById('btnAdminPrevPage');
  const nextBtn = document.getElementById('btnAdminNextPage');
  const selectAll = document.getElementById('adminSelectAllPage');
  if (!tbody) return;

  const q = (adminSearch || '').toLowerCase().trim();
  let filtered = storage.rows.filter(r => {
    if (adminAssistantFilter && r.assistant !== adminAssistantFilter) return false;
    if (adminStatusFilter && (r.status || 'Pending') !== adminStatusFilter) return false;
    if (adminCategoryFilter && r.potentialFor !== adminCategoryFilter) return false;
    if (q) {
      const match = (r.retailer || '').toLowerCase().includes(q) ||
        (r.district || '').toLowerCase().includes(q) ||
        (r.block || '').toLowerCase().includes(q) ||
        (r.assistant || '').toLowerCase().includes(q) ||
        (r.mobile || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / adminPageSize) || 1;
  if (adminPage < 1) adminPage = 1;
  if (adminPage > totalPages) adminPage = totalPages;

  const start = (adminPage - 1) * adminPageSize;
  const pageRows = filtered.slice(start, start + adminPageSize);

  if (pageInfo) {
    pageInfo.textContent = total > 0 
      ? `Showing ${start + 1}–${Math.min(start + adminPageSize, total)} of ${total} records`
      : 'No records found';
  }

  if (prevBtn) prevBtn.disabled = adminPage <= 1;
  if (nextBtn) nextBtn.disabled = adminPage >= totalPages;

  if (pageRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 36px; color: var(--muted);">No matching retailers found in directory.</td></tr>`;
    if (selectAll) selectAll.checked = false;
    return;
  }

  const allOnPageSelected = pageRows.every(r => selectedRetailerIds.has(r.id));
  if (selectAll) selectAll.checked = allOnPageSelected && pageRows.length > 0;

  tbody.innerHTML = pageRows.map(r => {
    const statusObj = STATUS_OPTIONS.find(s => s.id === (r.status || 'Pending')) || STATUS_OPTIONS[0];
    const isChecked = selectedRetailerIds.has(r.id);
    return `
      <tr style="${isChecked ? 'background: var(--primary-subtle);' : ''}">
        <td style="text-align: center;">
          <input type="checkbox" class="admin-row-cb" data-id="${r.id}" ${isChecked ? 'checked' : ''}>
        </td>
        <td>
          <strong style="color: var(--ink); font-size: 13.5px;">${escapeHtml(r.retailer)}</strong>
          ${r.hq ? `<div style="color: var(--muted); font-size: 11px;">HQ: ${escapeHtml(r.hq)}</div>` : ''}
        </td>
        <td>${escapeHtml(r.district)} · ${escapeHtml(r.block)}</td>
        <td><span style="font-weight: 600;">${escapeHtml(r.assistant || 'Unassigned')}</span></td>
        <td>${escapeHtml(r.mobile || '—')}</td>
        <td>
          <span class="badge ${statusObj.badge}">${statusObj.icon} ${statusObj.label}</span>
          ${(r.verifiedVisit && r.checkInCoords) ? `
            <div style="margin-top: 4px; display: flex; align-items: center; gap: 4px;">
              <span class="badge badge-visited" style="font-size: 10px; padding: 2px 6px;" title="Checked in on ${escapeHtml(r.checkInDate || '')} at ${escapeHtml(r.checkInTime || '')} (${r.checkInCoords.lat.toFixed(4)}, ${r.checkInCoords.lng.toFixed(4)})">
                📍 Live (${escapeHtml(r.checkInTime || 'Checked in')})
              </span>
              <a href="${r.checkInMapUrl || `https://www.google.com/maps?q=${r.checkInCoords.lat},${r.checkInCoords.lng}`}" target="_blank" rel="noopener" class="btn btn-icon" style="padding: 1px 5px; font-size: 11px; text-decoration: none;" title="Open exact pin on Google Maps">🗺️</a>
            </div>
          ` : ''}
        </td>
        <td>
          <div style="font-weight: 700; font-size: 12px;">${escapeHtml(r.potentialFor || '—')}</div>
          <div style="color: var(--muted); font-size: 11px;">₹${escapeHtml(r.potentialSell || '')}</div>
        </td>
        <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.notes || '')}">
          ${escapeHtml(r.notes || '—')}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm btn-edit-row" data-id="${r.id}">Edit</button>
          <button class="btn btn-secondary btn-sm btn-delete-row" data-id="${r.id}" style="color: var(--danger);">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.admin-row-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = cb.getAttribute('data-id');
      if (e.target.checked) selectedRetailerIds.add(id);
      else selectedRetailerIds.delete(id);
      updateBulkBarUI();
      renderTableRows();
    });
  });

  tbody.querySelectorAll('.btn-edit-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const row = storage.rows.find(r => r.id === id);
      if (row) openRetailerModal(row);
    });
  });

  tbody.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const row = storage.rows.find(r => r.id === id);
      if (row && confirm(`Delete retailer "${row.retailer}" from directory?`)) {
        try {
          await storage.deleteRow(id);
          selectedRetailerIds.delete(id);
          showToast('Retailer deleted', '🗑️');
          updateBulkBarUI();
          renderTableRows();
        } catch(err) {
          showToast(err.message, '❌');
        }
      }
    });
  });

  updateBulkBarUI();
}

function renderCheckInAuditRows() {
  const tbody = document.getElementById('checkInTableBody');
  const pageInfo = document.getElementById('checkInPageInfo');
  const prevBtn = document.getElementById('btnCheckInPrev');
  const nextBtn = document.getElementById('btnCheckInNext');
  const totalBadge = document.getElementById('checkInTotalBadge');
  const kpiStrip = document.getElementById('checkInKpiStrip');
  if (!tbody) return;

  const checkInLogs = storage.getCheckInLogs();
  const todayStr = getTodayDateStr();
  const yesterdayStr = getYesterdayDateStr();

  // Render KPI strip
  if (kpiStrip) {
    const totalLogs = checkInLogs.length;
    const todayLogsCount = checkInLogs.filter(l => l.date === todayStr).length;
    const activeRepsToday = new Set(checkInLogs.filter(l => l.date === todayStr).map(l => l.rep)).size;
    const onSiteLogsCount = checkInLogs.filter(l => l.distKm !== undefined && l.distKm <= 2.5).length;
    const onSiteRate = totalLogs ? Math.round((onSiteLogsCount / totalLogs) * 100) : 100;

    if (totalBadge) totalBadge.textContent = `${totalLogs} Logs`;

    kpiStrip.innerHTML = `
      <div style="background: var(--surface-alt); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Total Check-Ins</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--ink); margin-top: 2px;">${totalLogs}</div>
        <div style="font-size: 11px; color: var(--muted);">Lifetime GPS audits</div>
      </div>

      <div style="background: var(--surface-alt); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Today's Live Visits</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--primary); margin-top: 2px;">${todayLogsCount}</div>
        <div style="font-size: 11px; color: var(--muted);">${activeRepsToday} reps active today</div>
      </div>

      <div style="background: var(--surface-alt); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Verified On-Site Rate</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--success); margin-top: 2px;">${onSiteRate}%</div>
        <div style="font-size: 11px; color: var(--muted);">Within 2.5 km of block HQ</div>
      </div>

      <div style="background: var(--surface-alt); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
        <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">GPS Precision</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--accent); margin-top: 2px;">±15m</div>
        <div style="font-size: 11px; color: var(--muted);">Satellite high-accuracy lock</div>
      </div>
    `;
  }

  // Filter logs
  const filteredLogs = checkInLogs.filter(l => {
    if (checkInFilterDate === 'today' && l.date !== todayStr) return false;
    if (checkInFilterDate === 'yesterday' && l.date !== yesterdayStr) return false;
    if (checkInFilterDate === 'week') {
      const msDiff = Date.now() - (l.timestamp || 0);
      if (msDiff > 7 * 24 * 3600 * 1000) return false;
    }
    if (checkInFilterRep && l.rep !== checkInFilterRep) return false;
    if (checkInFilterProximity === 'onsite' && (l.distKm > 2.5 || l.distKm === undefined)) return false;
    if (checkInFilterProximity === 'vicinity' && (l.distKm <= 2.5 || l.distKm > 7.0)) return false;
    if (checkInFilterProximity === 'offsite' && l.distKm <= 7.0) return false;
    if (checkInSearch) {
      const q = checkInSearch.toLowerCase().trim();
      const match = (l.retailer || '').toLowerCase().includes(q) ||
                    (l.block || '').toLowerCase().includes(q) ||
                    (l.district || '').toLowerCase().includes(q) ||
                    (l.rep || '').toLowerCase().includes(q) ||
                    (l.notes || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const total = filteredLogs.length;
  const totalPages = Math.ceil(total / checkInPageSize) || 1;
  if (checkInPage < 1) checkInPage = 1;
  if (checkInPage > totalPages) checkInPage = totalPages;

  const start = (checkInPage - 1) * checkInPageSize;
  const pageRows = filteredLogs.slice(start, start + checkInPageSize);

  if (pageInfo) {
    pageInfo.textContent = total > 0 
      ? `Showing ${start + 1}–${Math.min(start + checkInPageSize, total)} of ${total} check-in records`
      : 'No check-in records found';
  }

  if (prevBtn) prevBtn.disabled = checkInPage <= 1;
  if (nextBtn) nextBtn.disabled = checkInPage >= totalPages;

  if (pageRows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 36px 20px; color: var(--muted);">
          <div style="font-size: 28px; margin-bottom: 6px;">🛰️</div>
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">No GPS Check-In Records Found</div>
          <div style="font-size: 12px;">When field reps click "📍 Live GPS Check-In" at a dealer's counter, the exact GPS coordinates, timestamp, and Google Maps pin will appear here automatically.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pageRows.map(l => {
    const hasCoords = l.lat !== null && l.lng !== null;
    const coordsStr = hasCoords ? `${l.lat.toFixed(5)}° N, ${l.lng.toFixed(5)}° E` : 'Pending GPS';
    const accuracyStr = l.accuracy ? `±${l.accuracy}m` : 'Standard';
    const mapUrl = l.mapUrl || (hasCoords ? `https://www.google.com/maps?q=${l.lat},${l.lng}` : '#');
    
    let proxBadge = `<span class="badge badge-visited" style="font-size: 10.5px;">🟢 On-Site (${l.distKm !== undefined ? l.distKm + ' km' : 'Verified'})</span>`;
    if (l.distKm > 7.0) {
      proxBadge = `<span class="badge badge-pending" style="background: #fee2e2; color: #dc2626; font-size: 10.5px;">🚨 Off-Site (${l.distKm} km)</span>`;
    } else if (l.distKm > 2.5) {
      proxBadge = `<span class="badge badge-called" style="font-size: 10.5px;">🟡 Vicinity (${l.distKm} km)</span>`;
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 700; font-size: 13px;">${escapeHtml(l.time || '')}</div>
          <div style="font-size: 11px; color: var(--muted);">${escapeHtml(l.date || '')}</div>
        </td>
        <td>
          <div style="font-weight: 700; font-size: 13px;">${escapeHtml(l.rep || '')}</div>
        </td>
        <td>
          <div style="font-weight: 700; font-size: 13.5px; color: var(--ink);">${escapeHtml(l.retailer || '')}</div>
          <div style="font-size: 11.5px; color: var(--muted);">${escapeHtml(l.mobile || '')}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(l.block || '')}</div>
          <div style="font-size: 11.5px; color: var(--muted);">${escapeHtml(l.district || '')}</div>
        </td>
        <td>
          <div style="font-family: monospace; font-size: 12px; font-weight: 600; color: var(--ink);">
            ${coordsStr}
          </div>
          <div style="font-size: 11px; color: var(--muted);">Precision: <span style="font-weight: 600; color: var(--primary);">${accuracyStr}</span></div>
        </td>
        <td>${proxBadge}</td>
        <td>
          <span class="badge ${l.status === 'Closed' ? 'badge-closed' : 'badge-visited'}">
            ${escapeHtml(l.status || 'Visited')}
          </span>
          ${l.notes ? `<div style="font-size: 11px; color: var(--muted); margin-top: 2px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(l.notes)}">${escapeHtml(l.notes)}</div>` : ''}
        </td>
        <td style="text-align: right;">
          ${hasCoords ? `
            <a href="${mapUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 11.5px; text-decoration: none;">
              <span>🗺️</span> View Pin
            </a>
          ` : `<span style="color: var(--muted); font-size: 11px;">No GPS</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
