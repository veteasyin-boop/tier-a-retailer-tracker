const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jmzbsotojorqmrlhxmoy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptemJzb3Rvam9ycW1ybGh4bW95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Mjc3NTAsImV4cCI6MjEwNjEwMzc1MH0.ezwAHWTDUQjMQKOiskCj87gOCfsssrseXNuWiL33h7M';

const ASSISTANTS = [
  { name: "Assistant 1 (West Patna)", hq: "Bihta", district: "Patna", target: 116, blocks: ["Bihta", "Maner", "Bikram", "Naubatpur", "Danapur"], password: "rep123" },
  { name: "Assistant 2 (Central/South Patna)", hq: "Phulwari Sharif", district: "Patna", target: 103, blocks: ["Phulwari Sharif", "Masaurhi", "Punpun", "Dhanarua", "Sampatchak"], password: "rep123" },
  { name: "Assistant 3 (East Patna)", hq: "Bakhtiarpur", district: "Patna", target: 80, blocks: ["Bakhtiarpur", "Barh", "Mokama", "Fatuha", "Daniyawan", "Pandarak"], password: "rep123" },
  { name: "Assistant 4 (West Vaishali)", hq: "Hajipur", district: "Vaishali", target: 99, blocks: ["Hajipur", "Lalganj", "Vaishali", "Bhagwanpur", "Garaul"], password: "rep123" },
  { name: "Assistant 5 (East Vaishali)", hq: "Mahua", district: "Vaishali", target: 79, blocks: ["Mahua", "Jandaha", "Patepur", "Bidupur", "Desri", "Rajapakar"], password: "rep123" },
  { name: "Assistant 6 (Rohtas)", hq: "Sasaram", district: "Rohtas", target: 66, blocks: ["Sasaram", "Dehri", "Nokha", "Karakat", "Bikramganj", "Sheosagar"], password: "rep123" },
  { name: "Assistant 7 (Kaimur)", hq: "Bhabua", district: "Kaimur", target: 7, blocks: ["Bhabua", "Mohania", "Kudra", "Chainpur"], password: "rep123" },
  { name: "Assistant 8 (Bhojpur & Buxar)", hq: "Behea", district: "Bhojpur", target: 23, blocks: ["Behea", "Jagdishpur", "Arrah", "Buxar", "Dumraon"], password: "rep123" }
];

const FIRM_PREFIXES = [
  "Kisan", "Maa Durga", "Jai Kisan", "Patel", "Sharma", "Verma", "Singh",
  "Arya", "Gupta", "Maa Sharda", "Son Valley", "Shershah", "Ganga Agro",
  "Bhojpur", "Vaishali", "Bihar", "Bhabua", "Kaimur", "Magadh", "Chhinnamastika",
  "Annapurna", "Shree Ram", "Bajrang", "Mahavir", "Adarsh", "Swastik", "Navdurga",
  "Pooja", "Laxmi", "Bharat", "Prabhat", "Surya", "Chandra", "Riddhi Siddhi"
];

const FIRM_SUFFIXES = [
  "Khad Beej Bhandar", "Agro Agency", "Krishi Kendra", "Fertilizers & Seeds",
  "Krishi Sewa Kendra", "Agrochemicals", "Seed Store", "Kisan Mitra Traders",
  "Pesticide & Bio-Fertilizers", "Krishi Vikas Kendra", "Agri Input Center", "Beej Agency"
];

const SAMPLE_NOTES = [
  "High demand for hybrid cauliflower & tomato seeds. Order expected next week.",
  "Interested in insecticide rate list and credit terms.",
  "Stock of competitor brand is high right now; follow up after festival.",
  "Wants demonstration trial on okra and bitter gourd varieties.",
  "Supplying bulk wheat seed bookings for upcoming Rabi season.",
  "Major vegetable belt shop; proprietor requested product catalogue.",
  "High fertilizer volume dealer. Potential distributor candidate.",
  "Visits farmers directly in adjoining villages. Very influential retailer.",
  "Contacted proprietor Mr. Kumar. Visit scheduled for upcoming Thursday.",
  "Long standing counter with strong farmer loyalty in local Haat.",
  "Requested demo samples for bio-stimulant & micronutrients.",
  "Booked initial trial order: 50 packets of chilli & cabbage seeds.",
  "High footfall during morning mandi hours. Contact before 11 AM.",
  "Owner requested credit extension before taking high volume CP stock.",
  "Specializes in paddy hybrid seeds; key supplier for northern panchayats."
];

function generateDataset() {
  const dataset = [];
  let globalIndex = 0;

  ASSISTANTS.forEach((assistant, aIdx) => {
    const targetCount = assistant.target;
    const blocks = assistant.blocks;

    for (let i = 0; i < targetCount; i++) {
      globalIndex++;
      const block = blocks[i % blocks.length];
      const prefix = FIRM_PREFIXES[(i + aIdx * 7) % FIRM_PREFIXES.length];
      const suffix = FIRM_SUFFIXES[(i * 3 + aIdx) % FIRM_SUFFIXES.length];
      const retailerName = `${prefix} ${suffix} (${block})`;

      const mobilePrefixes = ["9835", "9431", "9122", "9934", "9430", "9570", "9199"];
      const mPrefix = mobilePrefixes[(i + aIdx) % mobilePrefixes.length];
      const mSuffix = String(100000 + ((i * 73 + aIdx * 199) % 900000));
      const mobile = `${mPrefix}${mSuffix}`;

      const randVal = (i * 17 + aIdx * 31) % 100;
      let status = "Pending";
      if (randVal < 42) status = "Pending";
      else if (randVal < 62) status = "Called";
      else if (randVal < 80) status = "Visited";
      else if (randVal < 92) status = "Closed";
      else status = "Follow-up Required";

      const potOptions = ["Veg", "CP", "Field", "Multi"];
      const potentialFor = potOptions[(i + aIdx * 3) % potOptions.length];

      const sellOptions = ["5000-10000", "10000-15000", "15000-20000", ">20000"];
      const potentialSell = sellOptions[(i * 2 + aIdx) % sellOptions.length];

      const note = status !== "Pending" ? SAMPLE_NOTES[(i * 3 + aIdx) % SAMPLE_NOTES.length] : "";

      dataset.push({
        id: `br_${assistant.district.toLowerCase()}_${String(globalIndex).padStart(3, '0')}`,
        retailer: retailerName,
        assistant: assistant.name,
        hq: assistant.hq,
        district: assistant.district,
        block: block,
        mobile: mobile,
        status: status,
        potential_for: potentialFor,
        potential_sell: potentialSell,
        notes: note,
        verified_visit: (status === "Visited" || status === "Closed"),
        updated_by: "System Initial Seed"
      });
    }
  });

  return dataset;
}

async function run() {
  console.log('🚀 Connecting to Supabase at:', SUPABASE_URL);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  // Verify connection & table existence
  const { data: testData, error: testErr } = await client.from('assistants').select('name').limit(1);
  if (testErr) {
    console.error('\n❌ Could not connect to public.assistants table.');
    console.error('Reason:', testErr.message);
    console.error('\n👉 Action Required: Open Supabase SQL Editor, paste supabase_schema.sql, and click "Run".');
    process.exit(1);
  }

  console.log('✅ Connection confirmed! Assistants table is ready.');

  // 1. Seed Assistants
  console.log(`\n1/2 Seeding ${ASSISTANTS.length} Field Assistants...`);
  for (const asst of ASSISTANTS) {
    const { error } = await client.from('assistants').upsert({
      name: asst.name,
      hq: asst.hq,
      district: asst.district,
      target: asst.target,
      blocks: asst.blocks,
      password: asst.password
    });
    if (error) console.error(`Error saving ${asst.name}:`, error.message);
  }
  console.log('✅ Assistants seeded successfully!');

  // 2. Seed Retailers
  const retailers = generateDataset();
  console.log(`\n2/2 Seeding ${retailers.length} Bihar Tier-A Retailers (in batches of 100)...`);
  const batchSize = 100;
  for (let i = 0; i < retailers.length; i += batchSize) {
    const chunk = retailers.slice(i, i + batchSize);
    const { error } = await client.from('retailers').upsert(chunk);
    if (error) {
      console.error(`Error saving batch ${i + 1}-${i + chunk.length}:`, error.message);
    } else {
      console.log(`  ✓ Seeded records ${i + 1} to ${Math.min(i + batchSize, retailers.length)}`);
    }
  }

  console.log('\n🎉 ALL 573 TIER-A RETAILERS SEEDED SUCCESSFULLY IN SUPABASE CLOUD!');
}

run().catch(console.error);
