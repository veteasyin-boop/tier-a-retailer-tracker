import { ASSISTANTS } from './assistants.js';

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

// Generates the authentic 573 Tier-A Retailer dataset across all 8 territories
export function generateSeedData() {
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

      // Authentic Bihar mobile numbers: 9431X, 9835X, 9122X, 9934X, 9430X
      const mobilePrefixes = ["9835", "9431", "9122", "9934", "9430", "9570", "9199"];
      const mPrefix = mobilePrefixes[(i + aIdx) % mobilePrefixes.length];
      const mSuffix = String(100000 + ((i * 73 + aIdx * 199) % 900000));
      const mobile = `${mPrefix}${mSuffix}`;

      // Status distribution: ~45% pending, ~20% called, ~18% visited, ~12% closed, ~5% followup
      const randVal = (i * 17 + aIdx * 31) % 100;
      let status = "Pending";
      if (randVal < 42) status = "Pending";
      else if (randVal < 62) status = "Called";
      else if (randVal < 80) status = "Visited";
      else if (randVal < 92) status = "Closed";
      else status = "Followup";

      // Potential category: Veg, CP, Field, Multi
      const cats = ["Veg", "CP", "Field", "Multi"];
      let potentialFor = cats[(i + aIdx) % cats.length];
      if (assistant.district === "Vaishali" && (i % 2 === 0)) potentialFor = "Veg"; // Vaishali is heavy veg
      if (assistant.district === "Rohtas" && (i % 2 === 0)) potentialFor = "Field"; // Rohtas is granary of Bihar

      // Potential sell bracket
      const brackets = ["5000-10000", "10000-15000", "15000-20000", ">20000"];
      const potentialSell = brackets[(i * 2 + aIdx) % brackets.length];

      // Radius from HQ
      const radiusKm = 4 + ((i * 3 + aIdx * 5) % 24);

      // Realistic notes for contacted/visited/closed
      let notes = "";
      if (status !== "Pending") {
        notes = SAMPLE_NOTES[(i + aIdx) % SAMPLE_NOTES.length];
      }

      dataset.push({
        id: `r_${String(globalIndex).padStart(4, '0')}`,
        idx: globalIndex - 1,
        assistant: assistant.name,
        hq: assistant.hq,
        radius: `${radiusKm} km`,
        district: assistant.district,
        block: block,
        retailer: retailerName,
        mobile: mobile,
        potentialFor: potentialFor,
        potentialSell: potentialSell,
        status: status,
        notes: notes,
        updatedAt: Date.now() - (globalIndex * 1800000)
      });
    }
  });

  return dataset;
}
