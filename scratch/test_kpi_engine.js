import { calculateAssistantScore, KPI_STANDARDS } from '../src/services/kpiService.js';

console.log('--- TESTING MGO 100-POINT KPI ENGINE ---');

// Test Case 1: Active star performer
const mockDataStar = {
  checkInLogs: [
    { rep: 'Assistant 1', retailerId: 'R1', accuracy: 25, distKm: 0.05, notes: 'Detailed diagnostic note on Fall Armyworm' },
    { rep: 'Assistant 1', retailerId: 'R2', accuracy: 30, distKm: 0.08, notes: 'High tillering observed on demo check' },
    { rep: 'Assistant 1', retailerId: 'R3', accuracy: 40, distKm: 0.10, notes: 'Followed up on booking order' },
    { rep: 'Assistant 1', retailerId: 'R4', accuracy: 35, distKm: 0.06, notes: 'Collected dealer stock movement' }
  ],
  tourPlan: { retailer_ids: ['R1', 'R2', 'R3', 'R4'] },
  farmerMeetings: [
    { assistant: 'Assistant 1', attendees_count: 18, key_discussion: 'Stay-green demo' },
    { assistant: 'Assistant 1', attendees_count: 22, key_discussion: 'Cob weight demonstration' }
  ],
  demoPlots: [
    { assistant: 'Assistant 1', yield_result_kg_acre: 3200, observations: 'Superior canopy' },
    { assistant: 'Assistant 1', yield_result_kg_acre: 3100, observations: 'Tight husk cover' }
  ],
  competitorIntel: [
    { assistant: 'Assistant 1', retail_price: 2400, dealer_price: 2150, promotional_scheme: 'Free pump', farmer_sentiment: 'High Demand' },
    { assistant: 'Assistant 1', retail_price: 1800, dealer_price: 1650, promotional_scheme: 'Cash discount', farmer_sentiment: 'Neutral' }
  ],
  farmerLeads: [
    { assistant: 'Assistant 1', funnel_stage: 'Adoption', assigned_dealer_id: 'R1', follow_up_date: '2026-10-02' },
    { assistant: 'Assistant 1', funnel_stage: 'Repeat Demand', assigned_dealer_id: 'R2', follow_up_date: '2026-10-04' },
    { assistant: 'Assistant 1', funnel_stage: 'Trial', assigned_dealer_id: 'R1', follow_up_date: '2026-10-06' }
  ],
  retailerRows: [
    { assistant: 'Assistant 1', status: 'Closed', potentialSell: '>20000', notes: 'Active' },
    { assistant: 'Assistant 1', status: 'Closed', potentialSell: '15000-20000', notes: 'Booked' },
    { assistant: 'Assistant 1', status: 'Visited', potentialSell: '10000-15000', notes: 'Stock high' }
  ],
  quizCompleted: true,
  eodSubmitted: true,
  aqfsAudit: {
    scores: { compliance: 4.0, quality: 4.0, documentation: 3.0, followup: 2.0, accuracy: 2.0 }
  }
};

const resultStar = calculateAssistantScore('Assistant 1', mockDataStar);
console.log('Star Performer Score:', resultStar.totalScore, '/ 100');
console.log('Grade:', resultStar.grade.label);
console.log('Breakdown:');
Object.entries(resultStar.breakdown).forEach(([k, v]) => {
  console.log(`  ${v.label}: ${v.score} / ${v.max}`);
  v.subParameters.forEach(sp => {
    console.log(`    - ${sp.name}: ${sp.score} / ${sp.max}`);
  });
});

console.log('\n--- VERIFYING EXACT MAXIMUM POINTS SUM ---');
const totalMax = Object.values(resultStar.breakdown).reduce((acc, v) => acc + v.max, 0);
console.log('Total Max Points:', totalMax, '(Expected: 100)');

if (totalMax === 100) {
  console.log('✅ Pillar weights perfectly sum to 100 Points!');
} else {
  console.error('❌ Error: Total max points does not equal 100:', totalMax);
}

// Check each pillar max
const expectedMax = {
  p1_techKnowledge: 10,
  p2_competitorIntel: 15,
  p3_farmerEngagement: 25,
  p4_planningSales: 20,
  p5_aqfsQuality: 15,
  p6_dealerFeedback: 15
};

let allMatch = true;
Object.entries(expectedMax).forEach(([pillarKey, maxPts]) => {
  const actual = resultStar.breakdown[pillarKey].max;
  const subSum = resultStar.breakdown[pillarKey].subParameters.reduce((a, b) => a + b.max, 0);
  if (actual === maxPts && subSum === maxPts) {
    console.log(`✅ ${pillarKey}: Max ${actual} pts, sub-parameters sum to ${subSum} pts`);
  } else {
    console.error(`❌ ${pillarKey} mismatch: actual=${actual}, subSum=${subSum}, expected=${maxPts}`);
    allMatch = false;
  }
});

if (allMatch) {
  console.log('🎉 ALL 6 PILLARS AND ALL SUB-PARAMETERS PERFECTLY MATCH SOP SPECIFICATION!');
}
