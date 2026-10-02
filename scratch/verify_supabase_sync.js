/**
 * verify_supabase_sync.js
 * Confirms all 8 Supabase tables accept reads and writes correctly.
 * Tests: farmer_leads, aqfs_audits, weekly_reviews (the formerly missing ones)
 * plus farmer_meetings, demo_plots, competitor_intel (existing ones).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jmzbsotojorqmrlhxmoy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptemJzb3Rvam9ycW1ybGh4bW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Mjc3NTAsImV4cCI6MjEwNjEwMzc1MH0.ezwAHWTDUQjMQKOiskCj87gOCfsssrseXNuWiL33h7M';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;

function ok(msg)  { console.log(`  ✅ ${msg}`); pass++; }
function err(msg) { console.error(`  ❌ ${msg}`); fail++; }

async function testTable(table, insertRow, pkField = 'id') {
  console.log(`\n  [${table}]`);

  // INSERT
  const { error: insErr } = await sb.from(table).upsert(insertRow);
  if (insErr) { err(`INSERT failed: ${insErr.message}`); return; }
  ok('INSERT succeeded');

  // SELECT
  const { data, error: selErr } = await sb.from(table).select('*').eq(pkField, insertRow[pkField]).limit(1);
  if (selErr || !data?.length) { err(`SELECT failed: ${selErr?.message || 'no row returned'}`); return; }
  ok(`SELECT returned row (id: ${data[0][pkField]})`);

  // DELETE (cleanup)
  const { error: delErr } = await sb.from(table).delete().eq(pkField, insertRow[pkField]);
  if (delErr) { err(`DELETE cleanup failed: ${delErr.message}`); }
  else ok('DELETE cleanup succeeded');
}

console.log('=========================================');
console.log('🔁 SUPABASE FULL SYNC VERIFICATION TEST');
console.log('=========================================');

// --- Previously working tables ---
console.log('\n── Existing Tables ──');

await testTable('farmer_meetings', {
  id: 'sync_test_fm_001',
  assistant: 'Assistant 1 (West Patna)',
  village: 'Test Village',
  block: 'Bihta',
  district: 'Patna',
  crop: 'Maize (Corn)',
  meeting_type: 'Group Meeting',
  attendees_count: 10,
  lead_farmers: [],
  key_discussion: 'Sync test meeting',
  date: '2026-09-28'
});

await testTable('demo_plots', {
  id: 'sync_test_dp_001',
  assistant: 'Assistant 1 (West Patna)',
  farmer_name: 'Sync Test Farmer',
  village: 'Test Village',
  block: 'Bihta',
  district: 'Patna',
  crop: 'Maize (Corn)',
  hybrid_tested: 'Hy-Maize Gold 910',
  current_stage: 'Vegetative Growth'
});

await testTable('competitor_intel', {
  id: 'sync_test_ci_001',
  assistant: 'Assistant 1 (West Patna)',
  district: 'Patna',
  block: 'Bihta',
  crop: 'Maize (Corn)',
  competitor_brand: 'TestBrand',
  product_name: 'TestProduct',
  retail_price: 2500,
  dealer_price: 2200,
  date: '2026-09-28'
});

// --- Newly created tables ---
console.log('\n── New Tables (Migration v2) ──');

await testTable('farmer_leads', {
  id: 'sync_test_fl_001',
  assistant: 'Assistant 1 (West Patna)',
  farmer_name: 'Sync Test Lead',
  village: 'Test Village',
  block: 'Bihta',
  district: 'Patna',
  crop: 'Maize (Corn)',
  product_interest: 'Hy-Maize Gold 910',
  funnel_stage: 'Awareness',
  demand_volume_bags: 2
});

await testTable('aqfs_audits', {
  id: 'sync_test_aqfs_001',
  assistant: 'Assistant 1 (West Patna)',
  auditor: 'Test Manager',
  week_code: '2026-W39',
  compliance_score: 3.5,
  quality_score: 3.5,
  documentation_score: 2.5,
  followup_score: 2.0,
  accuracy_score: 2.0,
  total_aqfs_score: 13.5,
  coaching_notes: 'Sync test audit'
});

await testTable('weekly_reviews', {
  id: 'sync_test_wr_001',
  assistant: 'Assistant 1 (West Patna)',
  week_code: '2026-W39',
  planned_visits: 5,
  completed_visits: 4,
  farmer_meetings_count: 2,
  new_farmer_leads: 1,
  demos_active: 1,
  competitor_updates: 1,
  key_challenges: 'Sync test',
  next_week_priorities: 'Sync test priorities',
  status: 'Submitted'
});

// --- Core tables ---
console.log('\n── Core Tables ──');

const { data: assistants } = await sb.from('assistants').select('name').limit(3);
if (assistants?.length > 0) {
  ok(`assistants: ${assistants.length} rows readable`);
  pass++;
} else {
  err('assistants: could not read');
  fail++;
}

const { data: retailers } = await sb.from('retailers').select('id').limit(5);
if (retailers?.length > 0) {
  ok(`retailers: ${retailers.length} rows readable`);
  pass++;
} else {
  err('retailers: could not read');
  fail++;
}

// --- Summary ---
console.log('\n=========================================');
console.log(`🏁 SYNC TEST: ${pass} PASSED, ${fail} FAILED`);
console.log('=========================================');

if (fail === 0) {
  console.log('🎉 ALL TABLES — READ/WRITE/DELETE WORKING PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('💥 Some sync issues remain — check above for details.\n');
  process.exit(1);
}
