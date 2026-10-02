const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jmzbsotojorqmrlhxmoy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptemJzb3Rvam9ycW1ybGh4bW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Mjc3NTAsImV4cCI6MjEwNjEwMzc1MH0.ezwAHWTDUQjMQKOiskCj87gOCfsssrseXNuWiL33h7M';

async function test() {
  console.log('Testing live Supabase connection to:', SUPABASE_URL);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  // Check assistants table
  const { data: asstData, error: asstErr } = await client.from('assistants').select('*').limit(5);
  if (asstErr) {
    console.error('❌ Error querying assistants table:', asstErr.message);
  } else {
    console.log('✅ assistants table found! Rows count:', asstData.length);
  }

  // Check retailers table
  const { data: retData, error: retErr } = await client.from('retailers').select('id, retailer').limit(5);
  if (retErr) {
    console.error('❌ Error querying retailers table:', retErr.message);
  } else {
    console.log('✅ retailers table found! Rows count:', retData.length);
  }

  // Check check_in_logs table
  const { data: logData, error: logErr } = await client.from('check_in_logs').select('id').limit(5);
  if (logErr) {
    console.error('❌ Error querying check_in_logs table:', logErr.message);
  } else {
    console.log('✅ check_in_logs table found! Rows count:', logData.length);
  }

  // Check tour_plans table
  const { data: tourData, error: tourErr } = await client.from('tour_plans').select('id').limit(5);
  if (tourErr) {
    console.error('❌ Error querying tour_plans table:', tourErr.message);
  } else {
    console.log('✅ tour_plans table found! Rows count:', tourData.length);
  }
}

test().catch(console.error);
