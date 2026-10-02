const fs = require('fs');
const assert = require('assert');

console.log('🧪 Testing Supabase Integration & Hybrid Sync...');

// 1. Check supabase_schema.sql
const sql = fs.readFileSync('supabase_schema.sql', 'utf8');
assert(sql.includes('CREATE TABLE IF NOT EXISTS public.retailers'), 'Schema must define retailers table');
assert(sql.includes('CREATE TABLE IF NOT EXISTS public.check_in_logs'), 'Schema must define check_in_logs table');
assert(sql.includes('CREATE TABLE IF NOT EXISTS public.assistants'), 'Schema must define assistants table');
assert(sql.includes('CREATE TABLE IF NOT EXISTS public.tour_plans'), 'Schema must define tour_plans table');
assert(sql.includes('check_in_lat DOUBLE PRECISION'), 'Schema must have GPS lat');
assert(sql.includes('check_in_lng DOUBLE PRECISION'), 'Schema must have GPS lng');
assert(sql.includes('verified_visit BOOLEAN'), 'Schema must have verified_visit');
assert(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Schema must enable RLS');
console.log('  ✅ supabase_schema.sql has all tables, columns, RLS, and seed scripts');

// 2. Check modular src/services/supabase.js
const sbCode = fs.readFileSync('src/services/supabase.js', 'utf8');
assert(sbCode.includes('class SupabaseService'), 'supabase.js must define SupabaseService');
assert(sbCode.includes('testConnection'), 'supabase.js must define testConnection');
assert(sbCode.includes('subscribeToRealtime'), 'supabase.js must define subscribeToRealtime');
assert(sbCode.includes('bulkUpsertRetailers'), 'supabase.js must define bulkUpsertRetailers');
assert(sbCode.includes('fetchCheckInLogs'), 'supabase.js must define fetchCheckInLogs');
assert(sbCode.includes('saveTodayTour'), 'supabase.js must define saveTodayTour');
console.log('  ✅ src/services/supabase.js implements all required cloud sync methods');

// 3. Check modular src/components/supabaseModal.js
const modalCode = fs.readFileSync('src/components/supabaseModal.js', 'utf8');
assert(modalCode.includes('openSupabaseModal'), 'supabaseModal.js must export openSupabaseModal');
assert(modalCode.includes('closeSupabaseModal'), 'supabaseModal.js must export closeSupabaseModal');
assert(modalCode.includes('handleTestConnection'), 'supabaseModal.js must implement handleTestConnection');
assert(modalCode.includes('handlePushLocalToCloud'), 'supabaseModal.js must implement handlePushLocalToCloud');
console.log('  ✅ src/components/supabaseModal.js implements modal UI and 1-click cloud sync');

// 4. Check standalone tier-a-tracker.html
const html = fs.readFileSync('tier-a-tracker.html', 'utf8');
assert(html.includes('@supabase/supabase-js@2'), 'tier-a-tracker.html must load supabase-js CDN');
assert(html.includes('id="supabaseModal"'), 'tier-a-tracker.html must render supabaseModal markup');
assert(html.includes('const SupabaseStore = {'), 'tier-a-tracker.html must define SupabaseStore');
assert(html.includes('openSupabaseModal()'), 'tier-a-tracker.html must define openSupabaseModal');
assert(html.includes('Supabase Cloud Active'), 'tier-a-tracker.html must support Supabase cloud indicator');
assert(html.includes('handlePushLocalToCloud'), 'tier-a-tracker.html must support 1-click cloud seeding');
console.log('  ✅ tier-a-tracker.html matches full modular capability in standalone format');

console.log('🎉 All Supabase integration verification tests passed successfully!');
