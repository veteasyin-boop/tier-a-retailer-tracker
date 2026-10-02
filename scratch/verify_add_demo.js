import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('🌱 VERIFYING ADDING & UPDATING A DEMO PLOT');
console.log('====================================================\n');

// 1. Setup JSDOM
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

// Mock storage
class StorageMock {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}
global.localStorage = new StorageMock();
global.sessionStorage = new StorageMock();

// Import modules
const { storage } = await import('../src/services/storage.js');
const { auth } = await import('../src/services/auth.js');
const { calculateAssistantScore } = await import('../src/services/kpiService.js');
const { renderFieldView } = await import('../src/components/fieldView.js');
const { openDemoPlotModal } = await import('../src/components/demoPlotModal.js');

await storage.init();

const container = document.getElementById('mainViewContainer') || document.body;

// 1. Authenticate Assistant 1 (West Patna)
auth.setAssignedRep('Assistant 1 (West Patna)');
renderFieldView(container, storage.rows);

// Switch to Meetings & Demos subtab
const tabFarmersBtn = document.getElementById('btnSubTabFarmers');
if (tabFarmersBtn) tabFarmersBtn.click();

console.log('Step 1: Current State Before Adding Demo Plot');
const initialDemos = storage.getDemoPlots();
const repInitialDemos = initialDemos.filter(d => d.assistant === 'Assistant 1 (West Patna)');
console.log(`- Total system demo plots: ${initialDemos.length}`);
console.log(`- Assistant 1 demo plots: ${repInitialDemos.length}`);

// Calculate initial KPI score
const initialKpi = calculateAssistantScore('Assistant 1 (West Patna)', {
  farmerMeetings: storage.getFarmerMeetings(),
  demoPlots: storage.getDemoPlots(),
  farmerLeads: storage.getFarmerLeads(),
  competitorIntel: storage.getCompetitorIntel(),
  retailerRows: storage.rows
});
console.log(`- Initial Pillar 3 Demo Plots Score: ${initialKpi.breakdown.p3_farmerEngagement.subParameters[2].score} / 5 pts`);
console.log(`- Initial Total KPI Score: ${initialKpi.totalScore} / 100 (${initialKpi.grade.label})`);

// 2. Open Demo Plot Registration Modal
console.log('\nStep 2: Opening Demo Plot Registration Modal...');
openDemoPlotModal('Assistant 1 (West Patna)', null, () => renderFieldView(container, storage.rows));

const modalEl = document.getElementById('demoPlotModal');
if (!modalEl) {
  console.error('❌ Modal failed to open!');
  process.exit(1);
}
console.log('✅ Demo Plot modal opened successfully');

// 3. Fill Form Fields
console.log('\nStep 3: Populating Demo Plot Form Details...');
document.getElementById('demoFarmerName').value = 'Kameshwar Nath Sharma';
document.getElementById('demoFarmerMobile').value = '9835123456';
document.getElementById('demoVillage').value = 'Maner Proper';
document.getElementById('demoBlock').value = 'Maner';
document.getElementById('demoCrop').value = 'Maize (Corn)';
document.getElementById('demoHybrid').value = 'Hy-Maize Gold 910 (High Vigor)';
document.getElementById('demoCompetitorCheck').value = 'DKC 9108';
document.getElementById('demoStage').value = 'Flowering / Tasseling';
document.getElementById('demoSowingDate').value = '2026-08-20';
document.getElementById('demoObservations').value = 
  'Observed 98% uniform emergence, sturdy root anchorage resisting waterlogging, tighter husk coverage, and dark green stay-green canopy vs. DKC 9108 check plot.';

console.log('  • Host Farmer: Kameshwar Nath Sharma (📞 9835123456)');
console.log('  • Location: Village Maner Proper, Block Maner');
console.log('  • Trial: Hy-Maize Gold 910 vs. DKC 9108');
console.log('  • Stage: Flowering / Tasseling (Sown: 2026-08-20)');

// 4. Submit Form
console.log('\nStep 4: Submitting Form & Saving Demo Plot...');
const demoForm = document.getElementById('demoForm');
demoForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

// Wait for async execution
await new Promise(resolve => setTimeout(resolve, 80));

// 5. Verify Results
console.log('\nStep 5: Verifying Persistence & UI Update...');
const modalAfterSubmit = document.getElementById('demoPlotModal');
if (modalAfterSubmit === null) {
  console.log('✅ Modal closed cleanly after submission');
} else {
  console.error('❌ Modal did not close!');
  process.exit(1);
}

const updatedDemos = storage.getDemoPlots();
const repUpdatedDemos = updatedDemos.filter(d => d.assistant === 'Assistant 1 (West Patna)');
console.log(`- Total system demo plots: ${updatedDemos.length} (was ${initialDemos.length})`);
console.log(`- Assistant 1 demo plots: ${repUpdatedDemos.length} (was ${repInitialDemos.length})`);

const createdDemo = updatedDemos.find(d => d.farmer_name === 'Kameshwar Nath Sharma');
if (createdDemo) {
  console.log(`✅ Demo plot record created with ID: ${createdDemo.id}`);
  console.log(`   Hybrid: ${createdDemo.hybrid_tested}`);
  console.log(`   Check: ${createdDemo.competitor_check}`);
  console.log(`   Current Stage: ${createdDemo.current_stage}`);
  console.log(`   Village: ${createdDemo.village} (${createdDemo.block})`);
} else {
  console.error('❌ Could not find created demo in storage!');
  process.exit(1);
}

// Check UI rendering
const uiContent = container.innerHTML;
if (uiContent.includes('Kameshwar Nath Sharma') && uiContent.includes('Hy-Maize Gold 910 (High Vigor)')) {
  console.log('✅ Demo plot card is immediately rendered in the UI list!');
} else {
  console.error('❌ Demo plot card not found in UI!');
  process.exit(1);
}

// Check KPI score update
const updatedKpi = calculateAssistantScore('Assistant 1 (West Patna)', {
  farmerMeetings: storage.getFarmerMeetings(),
  demoPlots: storage.getDemoPlots(),
  farmerLeads: storage.getFarmerLeads(),
  competitorIntel: storage.getCompetitorIntel(),
  retailerRows: storage.rows
});
console.log(`\nStep 6: KPI Impact Analysis`);
console.log(`- Updated Pillar 3 Demo Plots Score: ${updatedKpi.breakdown.p3_farmerEngagement.subParameters[2].score} / 5 pts`);
console.log(`- Updated Total KPI Score: ${updatedKpi.totalScore} / 100 (${updatedKpi.grade.label})`);

// 7. Test Updating the Demo Plot (Advancing to Harvest & Recording Yield)
console.log('\nStep 7: Testing Demo Stage Advancement to Harvest & Yield Cut...');
openDemoPlotModal('Assistant 1 (West Patna)', createdDemo, () => renderFieldView(container, storage.rows));

const editModalEl = document.getElementById('demoPlotModal');
if (!editModalEl) {
  console.error('❌ Edit modal failed to open!');
  process.exit(1);
}

document.getElementById('demoStage').value = 'Maturity / Harvest Yield Cut';
document.getElementById('demoYield').value = '3850';
document.getElementById('demoObservations').value = 
  'Harvest cut completed: 3,850 kg/acre vs. 3,420 kg/acre in DKC 9108 (+12.5% yield gain). 100% grain filling to tip.';

const editForm = document.getElementById('demoForm');
editForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

await new Promise(resolve => setTimeout(resolve, 80));

const finalDemos = storage.getDemoPlots();
const finalDemo = finalDemos.find(d => d.id === createdDemo.id);
if (finalDemo && finalDemo.current_stage === 'Maturity / Harvest Yield Cut' && finalDemo.yield_result_kg_acre === 3850) {
  console.log('✅ Demo plot stage updated to "Maturity / Harvest Yield Cut"');
  console.log(`✅ Recorded harvest yield: ${finalDemo.yield_result_kg_acre} kg/acre (+12.5% yield gain)`);
} else {
  console.error('❌ Stage update failed!', finalDemo);
  process.exit(1);
}

// Verify updated card in UI
const finalUi = container.innerHTML;
if (finalUi.includes('Maturity / Harvest Yield Cut') && finalUi.includes('3850 kg / acre')) {
  console.log('✅ Updated harvest yield badge & stage rendered in the UI card!');
} else {
  console.error('❌ Updated yield cut not visible in UI card!');
  process.exit(1);
}

console.log('\n====================================================');
console.log('🎉 DEMO PLOT LIFECYCLE 100% VERIFIED SUCCESSFULLY!');
console.log('====================================================\n');
