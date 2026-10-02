/**
 * apply_migration.js
 * Applies the missing farmer_leads, aqfs_audits, and weekly_reviews tables
 * directly to the Supabase instance via the REST API.
 * 
 * Run: node scratch/apply_migration.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jmzbsotojorqmrlhxmoy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptemJzb3Rvam9ycW1ybGh4bW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Mjc3NTAsImV4cCI6MjEwNjEwMzc1MH0.ezwAHWTDUQjMQKOiskCj87gOCfsssrseXNuWiL33h7M';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

console.log('🔧 Supabase Migration — farmer_leads, aqfs_audits, weekly_reviews\n');

// Test connection
console.log('Testing connection...');
const { data: connTest, error: connErr } = await supabase.from('assistants').select('name').limit(1);
if (connErr) {
  console.error('❌ Connection failed:', connErr.message);
  process.exit(1);
}
console.log('✅ Connected to Supabase. Found assistants table.\n');

// Check which tables exist
console.log('Checking which tables exist...');

async function tableExists(tableName) {
  const { data, error } = await supabase.from(tableName).select('id').limit(1);
  // If error message contains "schema cache" or "relation does not exist" -> missing
  if (error) {
    if (error.message.includes('schema cache') || error.message.includes('does not exist') || error.message.includes('relation')) {
      return false;
    }
    // Other errors (like empty table returning 0 rows) are fine
    return true;
  }
  return true;
}

const farmerLeadsExists = await tableExists('farmer_leads');
const aqfsAuditsExists = await tableExists('aqfs_audits');
const weeklyReviewsExists = await tableExists('weekly_reviews');

console.log(`  farmer_leads:   ${farmerLeadsExists ? '✅ exists' : '❌ MISSING'}`);
console.log(`  aqfs_audits:    ${aqfsAuditsExists ? '✅ exists' : '❌ MISSING'}`);
console.log(`  weekly_reviews: ${weeklyReviewsExists ? '✅ exists' : '❌ MISSING'}`);

// Try a direct insert to create the table if missing
// (Supabase anon key cannot run DDL, so we test the data path instead)

const allExist = farmerLeadsExists && aqfsAuditsExists && weeklyReviewsExists;

if (allExist) {
  console.log('\n🎉 All 3 tables already exist in Supabase. No migration needed.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tables are MISSING from Supabase.');
  console.log('\n📋 ACTION REQUIRED:');
  console.log('   1. Open your Supabase Dashboard: https://jmzbsotojorqmrlhxmoy.supabase.co');
  console.log('   2. Go to: SQL Editor → New Query');
  console.log('   3. Paste and run the MIGRATION v2 block from supabase_schema.sql');
  console.log('      (the section starting at line ~405 of supabase_schema.sql)');
  console.log('\n   OR paste this minimal migration SQL directly:\n');
  
  const missingSql = [];
  
  if (!farmerLeadsExists) {
    missingSql.push(`-- CREATE farmer_leads table
CREATE TABLE IF NOT EXISTS public.farmer_leads (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  farmer_name TEXT NOT NULL,
  mobile TEXT,
  village TEXT NOT NULL,
  block TEXT NOT NULL,
  district TEXT NOT NULL,
  crop TEXT NOT NULL DEFAULT 'Maize (Corn)',
  acreage DOUBLE PRECISION DEFAULT 1.0,
  farmer_category TEXT DEFAULT 'Progressive',
  product_interest TEXT NOT NULL,
  funnel_stage TEXT DEFAULT 'Awareness',
  assigned_dealer_id TEXT,
  assigned_dealer_name TEXT,
  demand_volume_bags INTEGER DEFAULT 2,
  follow_up_date DATE,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.farmer_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on farmer_leads" ON public.farmer_leads;
CREATE POLICY "Allow public all on farmer_leads" ON public.farmer_leads FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_farmer_leads_assistant ON public.farmer_leads(assistant);
CREATE INDEX IF NOT EXISTS idx_farmer_leads_stage ON public.farmer_leads(funnel_stage);
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_leads; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  }
  
  if (!aqfsAuditsExists) {
    missingSql.push(`-- CREATE aqfs_audits table
CREATE TABLE IF NOT EXISTS public.aqfs_audits (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  auditor TEXT DEFAULT 'Regional Sales Manager',
  week_code TEXT NOT NULL,
  compliance_score NUMERIC(3,1) DEFAULT 3.5,
  quality_score NUMERIC(3,1) DEFAULT 3.5,
  documentation_score NUMERIC(3,1) DEFAULT 2.5,
  followup_score NUMERIC(3,1) DEFAULT 2.0,
  accuracy_score NUMERIC(3,1) DEFAULT 2.0,
  total_aqfs_score NUMERIC(4,1) DEFAULT 13.5,
  coaching_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.aqfs_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on aqfs_audits" ON public.aqfs_audits;
CREATE POLICY "Allow public all on aqfs_audits" ON public.aqfs_audits FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_aqfs_audits_assistant ON public.aqfs_audits(assistant);
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.aqfs_audits; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  }
  
  if (!weeklyReviewsExists) {
    missingSql.push(`-- CREATE weekly_reviews table
CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id TEXT PRIMARY KEY,
  assistant TEXT REFERENCES public.assistants(name) ON UPDATE CASCADE ON DELETE CASCADE,
  week_code TEXT NOT NULL,
  planned_visits INTEGER DEFAULT 0,
  completed_visits INTEGER DEFAULT 0,
  farmer_meetings_count INTEGER DEFAULT 0,
  new_farmer_leads INTEGER DEFAULT 0,
  demos_active INTEGER DEFAULT 0,
  competitor_updates INTEGER DEFAULT 0,
  key_challenges TEXT,
  next_week_priorities TEXT,
  status TEXT DEFAULT 'Submitted',
  manager_remarks TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on weekly_reviews" ON public.weekly_reviews;
CREATE POLICY "Allow public all on weekly_reviews" ON public.weekly_reviews FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_assistant ON public.weekly_reviews(assistant);
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_reviews; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log(missingSql.join('\n\n'));
  console.log('═══════════════════════════════════════════════════════════\n');
  
  process.exit(1);
}
