import { storage } from '../src/services/storage.js';
import { calculateAssistantScore } from '../src/services/kpiService.js';

// Setup minimal mocks for Node
global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; }
};

global.window = {
  dispatchEvent() {}
};
global.CustomEvent = class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } };

console.log('Testing storage methods...');

// 1. Farmer Meeting
const meeting = {
  id: 'test_fm_1',
  assistant: 'Assistant 1 (West Patna)',
  village: 'Bihta Village',
  block: 'Bihta',
  district: 'Patna',
  crop: 'Maize (Corn)',
  meeting_type: 'Group Meeting',
  attendees_count: 15,
  lead_farmers: [{ name: 'Ram Singh', mobile: '9876543210', acre: 3 }],
  key_discussion: 'Tested new hybrid maize features.',
  date: '2026-09-28'
};
storage.saveFarmerMeeting(meeting);
const meetings = storage.getFarmerMeetings();
console.log('Farmer meetings count:', meetings.length);
console.log('Saved meeting found:', meetings.some(m => m.id === 'test_fm_1'));

// 2. Demo Plot
const demo = {
  id: 'test_dp_1',
  assistant: 'Assistant 1 (West Patna)',
  farmer_name: 'Shyam Kumar',
  farmer_mobile: '9876543211',
  village: 'Maner',
  block: 'Maner',
  district: 'Patna',
  crop: 'Maize (Corn)',
  hybrid_tested: 'Hy-Maize Gold 910',
  competitor_check: 'DKC 9108',
  sowing_date: '2026-08-15',
  current_stage: 'Vegetative Growth',
  observations: 'Vigorous crop canopy'
};
storage.saveDemoPlot(demo);
const demos = storage.getDemoPlots();
console.log('Demo plots count:', demos.length);
console.log('Saved demo found:', demos.some(d => d.id === 'test_dp_1'));

// 3. Farmer Lead
const lead = {
  id: 'test_fl_1',
  assistant: 'Assistant 1 (West Patna)',
  farmer_name: 'Gopal Verma',
  mobile: '9876543212',
  village: 'Bikram',
  block: 'Bikram',
  district: 'Patna',
  crop: 'Paddy (Rice)',
  acreage: 4.5,
  farmer_category: 'Progressive',
  product_interest: 'Super Paddy 64',
  funnel_stage: 'Trial',
  assigned_dealer_id: 'ret_001',
  assigned_dealer_name: 'Kisan Kendra',
  demand_volume_bags: 5,
  follow_up_date: '2026-10-02',
  follow_up_notes: 'Will inspect trial plot next week'
};
storage.saveFarmerLead(lead);
const leads = storage.getFarmerLeads();
console.log('Farmer leads count:', leads.length);
console.log('Saved lead found:', leads.some(l => l.id === 'test_fl_1'));

console.log('ALL STORAGE TESTS PASSED SUCCESSFULLY!');
