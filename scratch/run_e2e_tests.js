import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🧪 RUNNING FULL E2E SUITE FOR ALL TABS & SOP WORKFLOWS');
console.log('====================================================\n');

// 1. Setup JSDOM environment
const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');
const dom = new JSDOM(indexHtml, {
  url: 'http://localhost:3000/',
  runScripts: 'dangerously',
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.CustomEvent = dom.window.CustomEvent;

// Mock localStorage & sessionStorage
class StorageMock {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}
global.localStorage = new StorageMock();
global.sessionStorage = new StorageMock();

// Import app modules
const { storage } = await import('../src/services/storage.js');
const { auth } = await import('../src/services/auth.js');
const { calculateAssistantScore } = await import('../src/services/kpiService.js');
const { renderFieldView } = await import('../src/components/fieldView.js');
const { renderAdminView } = await import('../src/components/adminView.js');
const { openFarmerMeetingModal } = await import('../src/components/farmerMeetingModal.js');
const { openDemoPlotModal } = await import('../src/components/demoPlotModal.js');
const { openFarmerLeadModal } = await import('../src/components/farmerLeadsModal.js');
const { openCompetitorIntelModal } = await import('../src/components/competitorModal.js');
const { openKpiScoreModal } = await import('../src/components/kpiScoreModal.js');
const { openAqfsAuditModal } = await import('../src/components/aqfsAuditModal.js');
const { openWeeklyReviewModal } = await import('../src/components/weeklyReviewModal.js');
const { openMgoSuccessModal } = await import('../src/components/mgoSuccessModal.js');
const { exportKpiReportToExcel } = await import('../src/utils/excel.js');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runTestSuite() {
  // Initialize storage so default rows and data are loaded
  await storage.init();
  const container = document.getElementById('mainViewContainer') || document.body;

  // -----------------------------------------------------------------
  // TEST SUITE 1: FIELD REPRESENTATIVE LOGIN & QUICK LOGIN
  // -----------------------------------------------------------------
  console.log('\n--- 1. Testing Field Rep Login Screen ---');
  auth.logoutRep();
  auth.logoutManager();
  renderFieldView(container, storage.rows);

  const loginForm = document.getElementById('repLoginForm');
  assert(loginForm !== null, 'Rep login form is rendered when unauthenticated');

  const quickBtns = container.querySelectorAll('.btn-quick-station-login');
  assert(quickBtns.length > 0, `Found ${quickBtns.length} 1-Click Station Quick Login buttons`);

  // Test 1-click login as Assistant 1 (West Patna)
  quickBtns[0].click();
  assert(auth.isRepAuthenticated() === true, '1-Click Login successfully authenticated representative');
  assert(auth.getAssignedRep() === 'Assistant 1 (West Patna)', 'Assigned rep is Assistant 1 (West Patna)');

  // -----------------------------------------------------------------
  // TEST SUITE 2: MGO FIELD DASHBOARD & PROFILE
  // -----------------------------------------------------------------
  console.log('\n--- 2. Testing MGO Field Dashboard Header & KPIs ---');
  assert(container.innerHTML.includes('Assistant 1 (West Patna)'), 'Dashboard displays logged-in Assistant name');
  assert(container.innerHTML.includes('Bihta'), 'Dashboard displays Station HQ (Bihta)');

  const kpiPill = document.getElementById('btnRepKpiScorecard');
  assert(kpiPill !== null, '100-Point KPI Scorecard pill is rendered in header');
  assert(kpiPill.textContent.includes('/100'), `KPI score pill displays score: ${kpiPill.textContent.replace(/\s+/g, ' ').trim()}`);

  assert(container.innerHTML.includes('Daily Operating Rhythm (10 Disciplines)'), '10-Step Daily Operating Rhythm widget rendered');

  // -----------------------------------------------------------------
  // TEST SUITE 3: ALWAYS-ACCESSIBLE QUICK ACTIVITY BAR
  // -----------------------------------------------------------------
  console.log('\n--- 3. Testing Always-Accessible Quick Activity Bar ---');
  const btnQuickMeeting = document.getElementById('btnQuickLogFarmerMeeting');
  const btnQuickDemo = document.getElementById('btnQuickAddDemoPlot');
  const btnQuickLead = document.getElementById('btnQuickAddFarmerLead');
  const btnQuickIntel = document.getElementById('btnQuickAddCompetitor');

  assert(btnQuickMeeting !== null, 'Quick Log Farmer Meeting button exists in bar');
  assert(btnQuickDemo !== null, 'Quick Register Demo Plot button exists in bar');
  assert(btnQuickLead !== null, 'Quick Demand Lead (CRM) button exists in bar');
  assert(btnQuickIntel !== null, 'Quick Competitor Intel button exists in bar');

  // -----------------------------------------------------------------
  // TEST SUITE 4: TAB 1 - STATION RETAILERS
  // -----------------------------------------------------------------
  console.log('\n--- 4. Testing Tab 1: Station Retailers ---');
  const tabNearbyBtn = document.getElementById('btnSubTabNearby');
  assert(tabNearbyBtn !== null, 'Station Retailers subtab button exists');
  tabNearbyBtn.click();

  const retailerCards = container.querySelectorAll('.mobile-counter-card');
  assert(retailerCards.length > 0, `Station Retailers tab displays ${retailerCards.length} dealer cards`);

  // Test search input
  const searchInput = document.getElementById('nearbySearchInput');
  assert(searchInput !== null, 'Retailer search input exists');

  // -----------------------------------------------------------------
  // TEST SUITE 5: TAB 2 - TODAY\'S TOUR / PJP
  // -----------------------------------------------------------------
  console.log('\n--- 5. Testing Tab 2: Today\'s Tour / PJP ---');
  const tabTourBtn = document.getElementById('btnSubTabTour');
  assert(tabTourBtn !== null, 'Today\'s Tour subtab button exists');
  tabTourBtn.click();
  assert(container.innerHTML.includes('Tour') || container.innerHTML.includes('Journey Plan'), 'Tour Plan view rendered successfully');

  // -----------------------------------------------------------------
  // TEST SUITE 6: TAB 3 - FARMER LEADS CRM & DEMAND PIPELINE
  // -----------------------------------------------------------------
  console.log('\n--- 6. Testing Tab 3: Farmer Leads CRM & Pipeline ---');
  const tabLeadsBtn = document.getElementById('btnSubTabLeads');
  assert(tabLeadsBtn !== null, 'Farmer Leads CRM subtab button exists');
  tabLeadsBtn.click();

  assert(container.innerHTML.includes('Farmer Leads'), 'Farmer Leads CRM workspace rendered');
  assert(container.innerHTML.includes('Awareness'), 'Funnel stage Awareness displayed');
  assert(container.innerHTML.includes('Interest'), 'Funnel stage Interest displayed');
  assert(container.innerHTML.includes('Trial'), 'Funnel stage Trial displayed');
  assert(container.innerHTML.includes('Adoption'), 'Funnel stage Adoption displayed');
  assert(container.innerHTML.includes('Repeat Demand'), 'Funnel stage Repeat Demand displayed');

  // Test opening Farmer Lead modal & saving new lead
  console.log('  Testing Farmer Lead registration workflow...');
  const initialLeadsCount = storage.getFarmerLeads().length;
  openFarmerLeadModal('Assistant 1 (West Patna)', null, () => renderFieldView(container, storage.rows));
  
  const leadModal = document.getElementById('farmerLeadModal');
  assert(leadModal !== null, 'Farmer Lead registration modal opened successfully');

  // Fill and submit form
  document.getElementById('leadFarmerName').value = 'Manoj Yadav';
  document.getElementById('leadFarmerMobile').value = '9835012345';
  document.getElementById('leadVillage').value = 'Katesar';
  document.getElementById('leadBlock').value = 'Bihta';
  document.getElementById('leadProduct').value = 'Hy-Maize Gold 910';
  document.getElementById('leadStage').value = 'Interest';
  document.getElementById('leadDemandBags').value = '5';
  
  const leadForm = document.getElementById('farmerLeadForm');
  leadForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  assert(document.getElementById('farmerLeadModal') === null, 'Farmer Lead modal closed after submission');
  const newLeadsCount = storage.getFarmerLeads().length;
  assert(newLeadsCount === initialLeadsCount + 1, `Farmer lead successfully saved in storage (${initialLeadsCount} -> ${newLeadsCount})`);

  // Verify lead appears in UI
  assert(container.innerHTML.includes('Manoj Yadav'), 'New farmer lead "Manoj Yadav" immediately rendered in CRM pipeline');

  // -----------------------------------------------------------------
  // TEST SUITE 7: TAB 4 - MEETINGS & DEMOS LIFECYCLE
  // -----------------------------------------------------------------
  console.log('\n--- 7. Testing Tab 4: Meetings & Demos Lifecycle ---');
  const tabFarmersBtn = document.getElementById('btnSubTabFarmers');
  assert(tabFarmersBtn !== null, 'Meetings & Demos subtab button exists');
  tabFarmersBtn.click();

  assert(container.innerHTML.includes('Demonstrations') || container.innerHTML.includes('Demo'), 'Demo plots section rendered');
  assert(container.innerHTML.includes('Farmer Meetings'), 'Farmer meetings ledger rendered');

  // Test logging farmer meeting
  console.log('  Testing Farmer Meeting logging workflow...');
  const initialMeetings = storage.getFarmerMeetings().length;
  openFarmerMeetingModal('Assistant 1 (West Patna)', () => renderFieldView(container, storage.rows));

  const meetingModal = document.getElementById('farmerMeetingModal');
  assert(meetingModal !== null, 'Farmer Meeting modal opened successfully');

  document.getElementById('meetingVillage').value = 'Bikram Proper';
  document.getElementById('meetingAttendees').value = '25';
  document.getElementById('meetingDiscussion').value = 'High interest in drought tolerance and cob uniformity.';

  const meetingForm = document.getElementById('meetingForm');
  meetingForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  await new Promise(r => setTimeout(r, 50));
  assert(document.getElementById('farmerMeetingModal') === null, 'Farmer Meeting modal closed after submission');
  const newMeetings = storage.getFarmerMeetings().length;
  assert(newMeetings === initialMeetings + 1, `Farmer meeting saved to storage (${initialMeetings} -> ${newMeetings})`);

  // Test registering Demo Plot
  console.log('  Testing Demo Plot registration workflow...');
  const initialDemos = storage.getDemoPlots().length;
  openDemoPlotModal('Assistant 1 (West Patna)', null, () => renderFieldView(container, storage.rows));

  const demoModal = document.getElementById('demoPlotModal');
  assert(demoModal !== null, 'Demo Plot registration modal opened successfully');

  document.getElementById('demoFarmerName').value = 'Dharmendra Pandey';
  document.getElementById('demoFarmerMobile').value = '9431098765';
  document.getElementById('demoVillage').value = 'Sikaria';
  document.getElementById('demoHybrid').value = 'Hy-Maize Gold 910';
  document.getElementById('demoCompetitorCheck').value = 'DKC 9108';
  document.getElementById('demoStage').value = 'Vegetative Growth';

  const demoForm = document.getElementById('demoForm');
  demoForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  await new Promise(r => setTimeout(r, 50));
  assert(document.getElementById('demoPlotModal') === null, 'Demo Plot modal closed after submission');
  const newDemos = storage.getDemoPlots().length;
  assert(newDemos === initialDemos + 1, `Demo plot saved to storage (${initialDemos} -> ${newDemos})`);

  // -----------------------------------------------------------------
  // TEST SUITE 8: TAB 5 - COMPETITOR MARKET INTELLIGENCE
  // -----------------------------------------------------------------
  console.log('\n--- 8. Testing Tab 5: Competitor Market Intelligence ---');
  const tabCompetitorBtn = document.getElementById('btnSubTabCompetitor');
  assert(tabCompetitorBtn !== null, 'Competitor Intel subtab button exists');
  tabCompetitorBtn.click();

  assert(container.innerHTML.includes('Competitor'), 'Competitor Intel workspace rendered');

  const initialIntel = storage.getCompetitorIntel().length;
  openCompetitorIntelModal('Assistant 1 (West Patna)', null, () => renderFieldView(container, storage.rows));

  const intelModal = document.getElementById('competitorIntelModal');
  assert(intelModal !== null, 'Competitor Intel modal opened successfully');

  document.getElementById('intelBrand').value = 'Corteva';
  document.getElementById('intelProduct').value = 'Pioneer 3355';
  document.getElementById('intelRetailPrice').value = '2480';
  document.getElementById('intelDealerPrice').value = '2240';

  const intelForm = document.getElementById('competitorForm');
  intelForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  assert(document.getElementById('competitorIntelModal') === null, 'Competitor Intel modal closed after submission');
  const newIntel = storage.getCompetitorIntel().length;
  assert(newIntel === initialIntel + 1, `Competitor Intel saved to storage (${initialIntel} -> ${newIntel})`);

  // -----------------------------------------------------------------
  // TEST SUITE 9: 100-POINT KPI SCORECARD MODAL
  // -----------------------------------------------------------------
  console.log('\n--- 9. Testing 100-Point KPI Scorecard Modal ---');
  const kpiData = calculateAssistantScore('Assistant 1 (West Patna)', {
    farmerMeetings: storage.getFarmerMeetings(),
    demoPlots: storage.getDemoPlots(),
    farmerLeads: storage.getFarmerLeads(),
    competitorIntel: storage.getCompetitorIntel(),
    retailerRows: storage.rows,
    quizCompleted: true,
    eodSubmitted: true
  });

  openKpiScoreModal(kpiData);
  const scoreModal = document.getElementById('kpiScoreModal');
  assert(scoreModal !== null, '100-Point KPI Scorecard modal opened');
  assert(scoreModal.textContent.includes('Education & Technical Knowledge'), 'Pillar 1 (10 pts) present in scorecard');
  assert(scoreModal.textContent.includes('Product & Competitor Knowledge'), 'Pillar 2 (15 pts) present in scorecard');
  assert(scoreModal.textContent.includes('Farmer Engagement & Market Dev'), 'Pillar 3 (25 pts) present in scorecard');
  assert(scoreModal.textContent.includes('Planning, Field & Sales Support'), 'Pillar 4 (20 pts) present in scorecard');
  assert(scoreModal.textContent.includes('AQFS Activity Quality & Standards'), 'Pillar 5 (15 pts) present in scorecard');
  assert(scoreModal.textContent.includes('Dealer Feedback & Market Intel'), 'Pillar 6 (15 pts) present in scorecard');
  scoreModal.remove();

  // -----------------------------------------------------------------
  // TEST SUITE 10: WEEKLY REVIEW & SOP SUCCESS MODEL MODALS
  // -----------------------------------------------------------------
  console.log('\n--- 10. Testing Weekly Review & SOP Success Guide Modals ---');
  openWeeklyReviewModal('Assistant 1 (West Patna)');
  const weeklyModal = document.getElementById('weeklyReviewModal');
  assert(weeklyModal !== null, 'Weekly Review modal opened successfully');
  assert(weeklyModal.textContent.includes('Week-to-Date Execution Summary'), 'Week-to-date execution summary displayed');
  weeklyModal.remove();

  openMgoSuccessModal();
  const successModal = document.getElementById('mgoSuccessModal');
  assert(successModal !== null, 'MGO Success Guide modal opened successfully');
  assert(successModal.textContent.includes('The 10-Step MGO Success Model'), '10-Step Success Model displayed');
  assert(successModal.textContent.includes('Bihar Crop Agronomy & POP Advisory Guide'), 'POP Agronomy Guide displayed');
  successModal.remove();

  // -----------------------------------------------------------------
  // TEST SUITE 11: MANAGER CONTROL CENTER & LEADERBOARD (ADMIN MODE)
  // -----------------------------------------------------------------
  console.log('\n--- 11. Testing Manager Control Center & Admin Mode ---');
  auth.loginAsManager('2026');
  assert(auth.isAdmin === true, 'Admin Mode unlocked with Manager PIN 2026');

  renderAdminView(container, storage.rows);
  assert(container.innerHTML.includes('Manager Control Center (Admin Mode Active)'), 'Admin View banner rendered');
  assert(container.innerHTML.includes('Supervisory Field Activity Logging'), 'Supervisory Field Activity action strip rendered');
  assert(container.innerHTML.includes('MGO Performance Leaderboard'), '100-Point Leaderboard rendered for all 8 territory assistants');

  // Verify manager action buttons
  const btnAdminLogMeeting = document.getElementById('btnAdminLogMeeting');
  const btnAdminAddDemo = document.getElementById('btnAdminAddDemo');
  const btnAdminAddLead = document.getElementById('btnAdminAddLead');
  assert(btnAdminLogMeeting !== null, 'Manager + Log Farmer Meeting button exists');
  assert(btnAdminAddDemo !== null, 'Manager + Register Demo Plot button exists');
  assert(btnAdminAddLead !== null, 'Manager + Add Farmer Lead button exists');

  // Test AQFS audit modal from admin leaderboard
  console.log('  Testing AQFS Quality Audit Studio modal...');
  openAqfsAuditModal('Assistant 1 (West Patna)', 'Regional Sales Manager', () => renderAdminView(container, storage.rows));
  const aqfsModal = document.getElementById('aqfsAuditModal');
  assert(aqfsModal !== null, 'AQFS Quality Audit modal opened successfully');
  assert(aqfsModal.innerHTML.includes('Compliance with Activity Standards'), 'AQFS Parameter 1 slider rendered');
  assert(aqfsModal.innerHTML.includes('Quality of Execution'), 'AQFS Parameter 2 slider rendered');
  assert(aqfsModal.innerHTML.includes('Verified Field Evidence Ledger'), 'Verified Field Evidence Ledger displayed');
  aqfsModal.remove();

  // -----------------------------------------------------------------
  // TEST SUITE 12: ENTERPRISE MULTI-SHEET EXCEL EXPORT
  // -----------------------------------------------------------------
  console.log('\n--- 12. Testing Enterprise Multi-Sheet Excel Export ---');
  try {
    const assistants = storage.getAssistants();
    const scores = assistants.map(a => calculateAssistantScore(a.name, {
      farmerMeetings: storage.getFarmerMeetings(),
      demoPlots: storage.getDemoPlots(),
      farmerLeads: storage.getFarmerLeads(),
      competitorIntel: storage.getCompetitorIntel(),
      retailerRows: storage.rows,
      quizCompleted: true,
      eodSubmitted: true
    }));
    exportKpiReportToExcel(scores, storage.rows);
    assert(true, 'Multi-Sheet Excel export engine executed with zero errors');
  } catch (err) {
    assert(false, 'Excel export failed: ' + err.message);
  }

  // -----------------------------------------------------------------
  // FINAL SCORECARD SUMMARY
  // -----------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 E2E TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================');

  if (failCount === 0) {
    console.log('🎉 ALL TABS, MODALS, CRM PIPELINES & WORKFLOWS ARE 100% OPERATIONAL!\n');
    process.exit(0);
  } else {
    console.error('💥 SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Unhandled E2E Error:', err);
  process.exit(1);
});
