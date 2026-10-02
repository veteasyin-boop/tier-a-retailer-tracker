const { createClient } = require('@supabase/supabase-js');

const DEFAULT_URL = 'https://jmzbsotojorqmrlhxmoy.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptemJzb3Rvam9ycW1ybGh4bW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Mjc3NTAsImV4cCI6MjEwNjEwMzc1MH0.ezwAHWTDUQjMQKOiskCj87gOCfsssrseXNuWiL33h7M';

const tablesToCheck = [
  'assistants',
  'retailers',
  'check_in_logs',
  'tour_plans',
  'farmer_meetings',
  'demo_plots',
  'competitor_intel',
  'assistant_kpi_scores',
  'farmer_leads',
  'aqfs_audits',
  'weekly_reviews'
];

async function checkTables() {
  console.log('Connecting to Supabase at:', DEFAULT_URL);
  const client = createClient(DEFAULT_URL, DEFAULT_KEY, {
    auth: { persistSession: false }
  });

  const results = [];

  for (const tableName of tablesToCheck) {
    try {
      const { data, error, count } = await client
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) {
        results.push({
          table: tableName,
          exists: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      } else {
        results.push({
          table: tableName,
          exists: true,
          count: count !== null ? count : (data ? data.length : 0),
          sample: data && data.length > 0 ? Object.keys(data[0]) : []
        });
      }
    } catch (err) {
      results.push({
        table: tableName,
        exists: false,
        error: err.message
      });
    }
  }

  console.log('\n=== SUPABASE TABLE CHECK REPORT ===');
  console.log(JSON.stringify(results, null, 2));

  console.log('\n=== SUMMARY ===');
  results.forEach(r => {
    if (r.exists) {
      console.log(`✅ [EXISTS]  Table: ${r.table.padEnd(22)} | Records: ${r.count} | Columns: ${r.sample.join(', ')}`);
    } else {
      console.log(`❌ [MISSING] Table: ${r.table.padEnd(22)} | Error: ${r.error} (${r.code || ''})`);
    }
  });
}

checkTables().catch(console.error);
