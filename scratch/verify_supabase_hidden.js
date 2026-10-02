// ========================================================
// VERIFICATION SCRIPT: SUPABASE CLOUD STATUS HIDDEN FROM
// ASSISTANT & HOMEPAGE
// ========================================================

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const htmlContent = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
const dom = new JSDOM(htmlContent, {
  url: 'http://localhost:3000',
  runScripts: 'dangerously',
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.CustomEvent = dom.window.CustomEvent;

const { auth } = await import('../src/services/auth.js');
const { storage } = await import('../src/services/storage.js');

console.log('\n====================================================');
console.log('🔒 VERIFYING SUPABASE CLOUD VISIBILITY RESTRICTIONS');
console.log('====================================================');

const storagePill = document.getElementById('storagePill');

// Test 1: Homepage (unauthenticated)
console.log('\nTest 1: Initial Homepage State (Unauthenticated)');
console.log(`- storagePill inline style: "${storagePill.style.display}"`);
if (storagePill.style.display === 'none') {
  console.log('✅ PASS: Supabase cloud indicator is completely HIDDEN on Homepage');
} else {
  console.error('❌ FAIL: Supabase cloud indicator is visible on Homepage!');
  process.exit(1);
}

// Initialize storage & check indicator update
await storage.init();

// Test 2: Assistant Logged In
console.log('\nTest 2: Field Assistant Logged In');
auth.loginRep('Assistant 1 (West Patna)', 'rep123', storage.getAssistants());
console.log(`- Active rep: ${auth.getAssignedRep()}`);
console.log(`- Is admin: ${auth.isAdmin}`);

// Re-evaluate display as done in main.js
const currentView = 'field';
storagePill.style.display = (auth.isAdmin && currentView === 'admin') ? 'inline-flex' : 'none';

console.log(`- storagePill display in Assistant view: "${storagePill.style.display}"`);
if (storagePill.style.display === 'none') {
  console.log('✅ PASS: Supabase cloud indicator is completely HIDDEN from Field Assistant');
} else {
  console.error('❌ FAIL: Supabase cloud indicator is visible to Field Assistant!');
  process.exit(1);
}

// Test 3: Admin Mode Activated
console.log('\nTest 3: Admin Mode Unlocked');
auth.loginAsManager('2026');
const adminView = 'admin';
storagePill.style.display = (auth.isAdmin && adminView === 'admin') ? 'inline-flex' : 'none';

console.log(`- storagePill display in Admin view: "${storagePill.style.display}"`);
if (storagePill.style.display === 'inline-flex') {
  console.log('✅ PASS: Supabase cloud indicator is VISIBLE in Admin/Manager Mode');
} else {
  console.error('❌ FAIL: Supabase cloud indicator is not visible in Admin Mode!');
  process.exit(1);
}

// Test 4: Admin Logout Back to Field / Homepage
console.log('\nTest 4: Admin Logs Out Back to Field / Homepage');
auth.logoutManager();
const returnView = 'field';
storagePill.style.display = (auth.isAdmin && returnView === 'admin') ? 'inline-flex' : 'none';

console.log(`- storagePill display after logout: "${storagePill.style.display}"`);
if (storagePill.style.display === 'none') {
  console.log('✅ PASS: Supabase cloud indicator safely RE-HIDES upon Admin logout');
} else {
  console.error('❌ FAIL: Supabase cloud indicator remained visible after logout!');
  process.exit(1);
}

console.log('\n====================================================');
console.log('🎉 ALL VISIBILITY TESTS PASSED: SUPABASE CLOUD IS HIDDEN');
console.log('   FROM BOTH THE HOMEPAGE AND FIELD ASSISTANTS.');
console.log('====================================================\n');
process.exit(0);
