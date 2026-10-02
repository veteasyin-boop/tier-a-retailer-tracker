// ========================================================
// MGO (ASSISTANT) 100-POINT KPI CALCULATION ENGINE
// Evaluates performance across all 6 core SOP pillars & sub-parameters:
// 1. Education & Technical Knowledge: 10 pts
// 2. Product & Competitor Knowledge: 15 pts
// 3. Farmer Engagement & Market Development: 25 pts
// 4. Planning, Field Activities & Sales Support: 20 pts
// 5. AQFS – Activity Quality & Field Standards: 15 pts
// 6. Dealer/Retailer Feedback & Market Intelligence: 15 pts
// Total = 100 Points
// ========================================================

export const KPI_STANDARDS = {
  EXCEPTIONAL: { min: 90, max: 100, label: 'Exceptional Performance', color: '#16a34a', bg: '#dcfce7', icon: '⭐', desc: 'Star performer. Demonstrates high technical mastery, market creation & discipline. Eligible for quarterly recognition.' },
  STRONG: { min: 80, max: 89.9, label: 'Strong Performance', color: '#0284c7', bg: '#e0f2fe', icon: '🟢', desc: 'Consistently high-standard execution. Strong farmer relationships and active market intelligence.' },
  MEETS: { min: 70, max: 79.9, label: 'Meets Expectations', color: '#2563eb', bg: '#dbeafe', icon: '🔵', desc: 'Effective baseline. Target enhancement in farmer meetings, trial plots, and competitor intelligence.' },
  IMPROVEMENT: { min: 60, max: 69.9, label: 'Improvement Required', color: '#d97706', bg: '#fef3c7', icon: '🟠', desc: 'Performance below expected standards. Requires supervisor coaching and weekly progress reviews.' },
  PIP: { min: 0, max: 59.9, label: 'Performance Improvement Required', color: '#dc2626', bg: '#fee2e2', icon: '🔴', desc: 'Critical shortfall. Triggers mandatory joint-field working with Regional Sales Manager.' }
};

export const CROP_PORTFOLIO = [
  'Maize (Corn)',
  'Paddy (Rice)',
  'Wheat',
  'Mustard',
  'Vegetables (Cauliflower, Chilli, Tomato)',
  'Pulses (Gram, Lentil)'
];

export const DEMO_STAGES = [
  'Sowing & Emergence',
  'Vegetative Growth',
  'Flowering / Tasseling',
  'Maturity / Harvest Yield Cut'
];

export const FARMER_LEAD_STAGES = [
  'Awareness',
  'Interest',
  'Trial',
  'Adoption',
  'Repeat Demand'
];

/**
 * Calculates real-time 100-point score for a given assistant
 * Evaluates all 6 pillars and their exact sub-parameters as defined in the SOP.
 */
export function calculateAssistantScore(assistantName, {
  checkInLogs = [],
  tourPlan = null,
  farmerMeetings = [],
  demoPlots = [],
  competitorIntel = [],
  farmerLeads = [],
  retailerRows = [],
  quizCompleted = false,
  eodSubmitted = false,
  aqfsAudit = null
}) {
  const repLogs = checkInLogs.filter(l => l.rep === assistantName);
  const repMeetings = farmerMeetings.filter(m => m.assistant === assistantName);
  const repDemos = demoPlots.filter(d => d.assistant === assistantName);
  const repIntel = competitorIntel.filter(c => c.assistant === assistantName);
  const repLeads = farmerLeads.filter(f => f.assistant === assistantName);
  const repRetailers = retailerRows.filter(r => r.assistant === assistantName);

  // ----------------------------------------------------
  // PILLAR 1: Education & Technical Knowledge (10 pts)
  // Sub-parameters:
  // - Product & crop technical knowledge: 3 pts
  // - Participation in training & learning: 2 pts
  // - Application of knowledge in field: 3 pts
  // - Ability to communicate technical information: 2 pts
  // ----------------------------------------------------
  const sub1_productCropTech = quizCompleted ? 3 : 1; // 3 pts if verified in quiz
  const sub1_trainingLearning = quizCompleted ? 2 : 0; // 2 pts for active weekly module participation
  const fieldDiagnosisNotes = repLogs.filter(l => l.notes && l.notes.length > 10).length + repMeetings.length;
  const sub1_fieldApplication = Math.min(3, Math.round(fieldDiagnosisNotes * 1.0)); // up to 3 pts
  const sub1_communication = Math.min(2, Math.round(repMeetings.length * 1.0 + (repLeads.length > 0 ? 1 : 0))); // up to 2 pts
  const p1Total = Math.min(10, sub1_productCropTech + sub1_trainingLearning + sub1_fieldApplication + sub1_communication);

  // ----------------------------------------------------
  // PILLAR 2: Product & Competitor Knowledge (15 pts)
  // Sub-parameters:
  // - Company product knowledge: 4 pts
  // - Competitor product knowledge: 4 pts
  // - Competitive activity tracking: 3 pts
  // - Product differentiation & positioning: 2 pts
  // - Quality of competitive intelligence: 2 pts
  // ----------------------------------------------------
  const sub2_companyProduct = Math.min(4, Math.max(1, repDemos.length * 2 + repMeetings.length)); // up to 4 pts
  const sub2_competitorProduct = Math.min(4, repIntel.length * 2); // 2 pts per verified competitor entry, up to 4
  const sub2_activityTracking = Math.min(3, repIntel.filter(c => c.promotional_scheme || c.promotionalScheme).length * 1.5); // promo tracking
  const sub2_differentiation = Math.min(2, repIntel.filter(c => c.farmer_sentiment || c.farmerSentiment).length * 1); // sentiment & farmer preference
  const sub2_qualityIntel = Math.min(2, repIntel.filter(c => (c.retail_price || c.retailPrice) && (c.dealer_price || c.dealerPrice)).length * 1); // pricing margin analysis
  const p2Total = Math.min(15, sub2_companyProduct + sub2_competitorProduct + sub2_activityTracking + sub2_differentiation + sub2_qualityIntel);

  // ----------------------------------------------------
  // PILLAR 3: Farmer Engagement & Market Development (25 pts)
  // Sub-parameters:
  // - Productive farmer engagement: 5 pts
  // - Farmer meetings / group activities: 4 pts
  // - Demonstrations & trial plots: 5 pts
  // - Lead generation & follow-up: 5 pts
  // - Farmer adoption / market development: 6 pts
  // Funnel: Awareness → Interest → Trial → Adoption → Repeat Demand
  // ----------------------------------------------------
  const totalFarmersReached = repMeetings.reduce((acc, m) => acc + (parseInt(m.attendees_count || m.attendeesCount || 0) || 1), 0) + repLeads.length;
  const sub3_productiveEngagement = Math.min(5, Math.round(totalFarmersReached * 0.3) + (repMeetings.length > 0 ? 2 : 0)); // up to 5 pts
  const sub3_farmerMeetings = Math.min(4, repMeetings.length * 2); // 2 pts per meeting, up to 4
  const sub3_demoPlots = Math.min(5, repDemos.length * 2.5); // 2.5 pts per demo plot, up to 5
  
  // Leads & follow-up discipline
  const leadsGenerated = repLeads.length;
  const leadsWithFollowup = repLeads.filter(l => l.follow_up_date || l.followUpDate).length;
  const sub3_leadGenFollowup = Math.min(5, Math.round(leadsGenerated * 1.5 + leadsWithFollowup * 1)); // up to 5 pts

  // Adoption & Repeat Demand
  const adoptedFarmers = repLeads.filter(l => l.funnel_stage === 'Adoption' || l.funnel_stage === 'Repeat Demand').length;
  const trialFarmers = repLeads.filter(l => l.funnel_stage === 'Trial').length;
  const sub3_adoptionMarketDev = Math.min(6, adoptedFarmers * 2.5 + trialFarmers * 1.5 + (repDemos.filter(d => d.yield_result_kg_acre).length * 2)); // up to 6 pts
  const p3Total = Math.min(25, Math.round((sub3_productiveEngagement + sub3_farmerMeetings + sub3_demoPlots + sub3_leadGenFollowup + sub3_adoptionMarketDev) * 10) / 10);

  // ----------------------------------------------------
  // PILLAR 4: Planning, Field Activities & Sales Support (20 pts)
  // Sub-parameters:
  // - Quality of planning: 4 pts
  // - Execution against plan: 4 pts
  // - Field activity productivity: 4 pts
  // - Lead generation & conversion support: 4 pts
  // - Contribution to sales/business development: 4 pts
  // Cycle: PLAN → EXECUTE → GENERATE DEMAND → FOLLOW UP → CONVERT → REVIEW
  // ----------------------------------------------------
  const plannedStops = tourPlan ? (tourPlan.retailer_ids || tourPlan.retailerIds || []).length : 0;
  const sub4_qualityPlanning = plannedStops >= 4 ? 4 : (plannedStops > 0 ? 2 : 0); // 4 pts if robust plan with >=4 stops

  let adherencePct = 0;
  if (plannedStops > 0) {
    const plannedSet = new Set(tourPlan.retailer_ids || tourPlan.retailerIds || []);
    const visitedPlanned = repLogs.filter(l => plannedSet.has(l.retailerId)).length;
    adherencePct = Math.min(1, visitedPlanned / plannedStops);
  } else if (repLogs.length > 0) {
    adherencePct = 0.5; // partial credit if visited counters without formal plan
  }
  const sub4_executionPlan = Math.round(adherencePct * 4); // up to 4 pts

  const totalActivitiesToday = repLogs.length + repMeetings.length + repDemos.length;
  const sub4_productivity = Math.min(4, Math.round(totalActivitiesToday * 0.8)); // up to 4 pts

  // Lead generation & conversion support to dealers
  const dealerLinkedLeads = repLeads.filter(l => l.assigned_dealer_id || l.assignedDealerId).length;
  const sub4_conversionSupport = Math.min(4, Math.round(dealerLinkedLeads * 1.5 + (repMeetings.length > 0 ? 1 : 0))); // up to 4 pts

  const closedCount = repRetailers.filter(r => r.status === 'Closed').length;
  const sub4_salesContribution = Math.min(4, Math.round(closedCount * 1.5 + (repRetailers.filter(r => r.potentialSell === '>20000').length * 1))); // up to 4 pts
  const p4Total = Math.min(20, sub4_qualityPlanning + sub4_executionPlan + sub4_productivity + sub4_conversionSupport + sub4_salesContribution);

  // ----------------------------------------------------
  // PILLAR 5: AQFS – Activity Quality & Field Standards (15 pts)
  // Sub-parameters:
  // - Compliance with activity standards: 4 pts
  // - Quality of execution: 4 pts
  // - Documentation & reporting: 3 pts
  // - Follow-up discipline: 2 pts
  // - Accuracy & transparency: 2 pts
  // Principle: Quality of execution is as important as quantity of activities.
  // Can be audited directly by Supervisor/Manager or calculated from verifiable proofs!
  // ----------------------------------------------------
  let sub5_compliance = 3;
  let sub5_qualityExecution = 3;
  let sub5_documentation = eodSubmitted ? 3 : 1;
  let sub5_followupDiscipline = repLeads.some(l => l.follow_up_date) ? 2 : 1;
  let sub5_accuracyTransparency = 2;

  // If a manager has submitted a formal AQFS Audit for this assistant, use the manager's audit score!
  if (aqfsAudit && aqfsAudit.scores) {
    sub5_compliance = Math.min(4, aqfsAudit.scores.compliance ?? 3);
    sub5_qualityExecution = Math.min(4, aqfsAudit.scores.quality ?? 3);
    sub5_documentation = Math.min(3, aqfsAudit.scores.documentation ?? 2);
    sub5_followupDiscipline = Math.min(2, aqfsAudit.scores.followup ?? 1);
    sub5_accuracyTransparency = Math.min(2, aqfsAudit.scores.accuracy ?? 2);
  } else {
    // Automated heuristic based on verified check-in GPS proximity & accuracy
    if (repLogs.length > 0) {
      const accurateLogs = repLogs.filter(l => l.accuracy && l.accuracy <= 50).length;
      const nearLogs = repLogs.filter(l => l.distKm !== null && l.distKm !== undefined && l.distKm <= 0.15).length;
      const accuracyRatio = accurateLogs / repLogs.length;
      const proximityRatio = nearLogs / repLogs.length;

      sub5_compliance = Math.min(4, Math.round(proximityRatio * 4));
      sub5_accuracyTransparency = Math.min(2, Math.round(accuracyRatio * 2));
      sub5_qualityExecution = (repMeetings.some(m => m.key_discussion) || repDemos.some(d => d.observations)) ? 4 : 2;
    }
  }
  const p5Total = Math.min(15, sub5_compliance + sub5_qualityExecution + sub5_documentation + sub5_followupDiscipline + sub5_accuracyTransparency);

  // ----------------------------------------------------
  // PILLAR 6: Dealer / Retailer Feedback & Market Intelligence (15 pts)
  // Sub-parameters:
  // - Regularity of dealer/retailer engagement: 3 pts
  // - Quality of market feedback: 4 pts
  // - Competitor & market intelligence: 3 pts
  // - Identification of business opportunities: 3 pts
  // - Timely escalation/actionable reporting: 2 pts
  // Flow: COLLECT → VALIDATE → ANALYSE → REPORT → ACT → FOLLOW UP
  // ----------------------------------------------------
  const sub6_regularityEngagement = Math.min(3, Math.round(repLogs.length * 0.8)); // up to 3 pts
  const updatedRetailers = repRetailers.filter(r => (r.potentialSell || r.notes) && r.status !== 'Pending');
  const sub6_qualityFeedback = Math.min(4, Math.round(updatedRetailers.length * 1.0)); // up to 4 pts
  const sub6_competitorIntel = Math.min(3, repIntel.length * 1.5); // up to 3 pts
  const highPotentialDealers = repRetailers.filter(r => r.potentialSell === '>20000' || r.potentialSell === '15000-20000').length;
  const sub6_businessOpportunities = Math.min(3, Math.round(highPotentialDealers * 1.5)); // up to 3 pts
  const sub6_timelyEscalation = (repIntel.some(c => c.promotional_scheme || c.promotionalScheme) || eodSubmitted) ? 2 : 1; // up to 2 pts
  const p6Total = Math.min(15, sub6_regularityEngagement + sub6_qualityFeedback + sub6_competitorIntel + sub6_businessOpportunities + sub6_timelyEscalation);

  // ----------------------------------------------------
  // TOTAL SCORE & GRADE COMPUTATION (100 Points Model)
  // ----------------------------------------------------
  const totalScore = Math.min(100, Math.round((p1Total + p2Total + p3Total + p4Total + p5Total + p6Total) * 10) / 10);

  let grade = KPI_STANDARDS.PIP;
  if (totalScore >= KPI_STANDARDS.EXCEPTIONAL.min) grade = KPI_STANDARDS.EXCEPTIONAL;
  else if (totalScore >= KPI_STANDARDS.STRONG.min) grade = KPI_STANDARDS.STRONG;
  else if (totalScore >= KPI_STANDARDS.MEETS.min) grade = KPI_STANDARDS.MEETS;
  else if (totalScore >= KPI_STANDARDS.IMPROVEMENT.min) grade = KPI_STANDARDS.IMPROVEMENT;

  // Specific improvement recommendations
  const tips = [];
  if (!quizCompleted) tips.push('Take the 2-minute Weekly Agronomy Quiz (+5 pts under Tech Knowledge)');
  if (repIntel.length === 0) tips.push('Log competitor pricing, schemes, and farmer sentiment (+5 to +8 pts)');
  if (repMeetings.length === 0) tips.push('Conduct & log a Farmer Group Meeting or Field Day (+5 pts)');
  if (repDemos.length === 0) tips.push('Register and monitor a Demo / Trial Plot (+5 pts)');
  if (repLeads.length === 0) tips.push('Register Farmer Leads and link demand to dealer counters (+5 pts)');
  if (!eodSubmitted) tips.push('Submit Daily EOD Closing Report before 8:30 PM (+3 to +5 AQFS pts)');
  if (plannedStops === 0) tips.push('Select stops in Today\'s Tour Plan / PJP (+4 Planning pts)');

  return {
    assistant: assistantName,
    totalScore,
    grade,
    breakdown: {
      p1_techKnowledge: {
        score: p1Total,
        max: 10,
        label: 'Education & Technical Knowledge',
        subParameters: [
          { name: 'Product & Crop Technical Knowledge', score: sub1_productCropTech, max: 3 },
          { name: 'Participation in Training & Learning', score: sub1_trainingLearning, max: 2 },
          { name: 'Application of Knowledge in Field', score: sub1_fieldApplication, max: 3 },
          { name: 'Ability to Communicate Technical Info', score: sub1_communication, max: 2 }
        ]
      },
      p2_competitorIntel: {
        score: p2Total,
        max: 15,
        label: 'Product & Competitor Knowledge',
        subParameters: [
          { name: 'Company Product Knowledge', score: sub2_companyProduct, max: 4 },
          { name: 'Competitor Product Knowledge', score: sub2_competitorProduct, max: 4 },
          { name: 'Competitive Activity Tracking', score: sub2_activityTracking, max: 3 },
          { name: 'Product Differentiation & Positioning', score: sub2_differentiation, max: 2 },
          { name: 'Quality of Competitive Intelligence', score: sub2_qualityIntel, max: 2 }
        ]
      },
      p3_farmerEngagement: {
        score: p3Total,
        max: 25,
        label: 'Farmer Engagement & Market Development',
        subParameters: [
          { name: 'Productive Farmer Engagement', score: sub3_productiveEngagement, max: 5 },
          { name: 'Farmer Meetings / Group Activities', score: sub3_farmerMeetings, max: 4 },
          { name: 'Demonstrations & Trial Plots', score: sub3_demoPlots, max: 5 },
          { name: 'Lead Generation & Follow-Up', score: sub3_leadGenFollowup, max: 5 },
          { name: 'Farmer Adoption & Market Development', score: sub3_adoptionMarketDev, max: 6 }
        ]
      },
      p4_planningSales: {
        score: p4Total,
        max: 20,
        label: 'Planning, Field Activities & Sales Support',
        subParameters: [
          { name: 'Quality of Planning (PJP)', score: sub4_qualityPlanning, max: 4 },
          { name: 'Execution Against Plan', score: sub4_executionPlan, max: 4 },
          { name: 'Field Activity Productivity', score: sub4_productivity, max: 4 },
          { name: 'Lead Gen & Conversion Support', score: sub4_conversionSupport, max: 4 },
          { name: 'Contribution to Sales / Business Dev', score: sub4_salesContribution, max: 4 }
        ]
      },
      p5_aqfsQuality: {
        score: p5Total,
        max: 15,
        label: 'AQFS Activity Quality & Field Standards',
        subParameters: [
          { name: 'Compliance with Activity Standards', score: sub5_compliance, max: 4 },
          { name: 'Quality of Execution', score: sub5_qualityExecution, max: 4 },
          { name: 'Documentation & Reporting', score: sub5_documentation, max: 3 },
          { name: 'Follow-Up Discipline', score: sub5_followupDiscipline, max: 2 },
          { name: 'Accuracy & Transparency', score: sub5_accuracyTransparency, max: 2 }
        ],
        isAudited: Boolean(aqfsAudit)
      },
      p6_dealerFeedback: {
        score: p6Total,
        max: 15,
        label: 'Dealer/Retailer Feedback & Market Intel',
        subParameters: [
          { name: 'Regularity of Dealer Engagement', score: sub6_regularityEngagement, max: 3 },
          { name: 'Quality of Market Feedback', score: sub6_qualityFeedback, max: 4 },
          { name: 'Competitor & Market Intelligence', score: sub6_competitorIntel, max: 3 },
          { name: 'Identification of Business Opportunities', score: sub6_businessOpportunities, max: 3 },
          { name: 'Timely Escalation / Actionable Reporting', score: sub6_timelyEscalation, max: 2 }
        ]
      }
    },
    counts: {
      farmerMeetings: repMeetings.length,
      demoPlots: repDemos.length,
      competitorEntries: repIntel.length,
      farmerLeads: repLeads.length,
      retailerCheckIns: repLogs.length,
      plannedStops,
      quizCompleted,
      eodSubmitted,
      isAqfsAudited: Boolean(aqfsAudit)
    },
    tips: tips.slice(0, 3)
  };
}

/**
 * Agronomy & Product knowledge micro-quiz questions (Bihar season-aligned)
 */
export const AGRONOMY_QUIZ_QUESTIONS = [
  {
    id: 'q1',
    question: 'During Maize cultivation in Bihar, at which growth stage is moisture stress most critical to final yield?',
    options: [
      'Early vegetative stage (V3–V4)',
      'Tasseling and silking (flowering stage)',
      'Dough stage',
      'Black layer physiological maturity'
    ],
    correctIndex: 1,
    explanation: 'Moisture stress during tasseling and silking causes poor pollination and incomplete ear filling, resulting in up to 40% yield loss.'
  },
  {
    id: 'q2',
    question: 'What is the primary product differentiation advantage of high-yield hybrid rice over conventional varieties?',
    options: [
      'Requires 3x more chemical fertilizers',
      'Superior tillering capacity, uniform maturity, and higher grain output per panicle',
      'Cannot tolerate standing water',
      'Lower market grain price'
    ],
    correctIndex: 1,
    explanation: 'Hybrid rice exhibits strong vigor, vigorous root growth, and high productive tillers with excellent grain weight.'
  },
  {
    id: 'q3',
    question: 'According to MGO AQFS Standards, what is the required GPS proximity to confirm a live verified counter visit?',
    options: [
      'Within 5 kilometers',
      'Within 150 meters with live GPS lock',
      'Any location within the same district',
      'No GPS required if photo is taken'
    ],
    correctIndex: 1,
    explanation: 'AQFS field standards enforce verified proximity within 150 meters of the retail station to ensure genuine physical presence.'
  }
];

