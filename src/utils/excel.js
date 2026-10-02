import * as XLSX from 'xlsx';
import { ASSISTANTS } from '../data/assistants.js';
import { storage } from '../services/storage.js';
import { showToast } from '../components/toast.js';

export async function exportToExcel(allRows) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const headers = [
    "Assigned Assistant", "Base Station (HQ)", "Travel Radius", 
    "District", "Block Name", "Retailer Name", "Mobile Number", 
    "Potential For", "Potential Sell", "Visit Status", "Field Notes",
    "Live GPS Verified", "CheckIn Date", "CheckIn Time", "CheckIn Lat", "CheckIn Lng", 
    "GPS Accuracy (m)", "Distance to Block (km)", "Google Maps Pin URL", "Last Updated"
  ];

  const rows = allRows.map(r => [
    r.assistant || '',
    r.hq || '',
    r.radius || '',
    r.district || '',
    r.block || '',
    r.retailer || '',
    r.mobile || '',
    r.potentialFor || '',
    r.potentialSell || '',
    r.status || 'Pending',
    r.notes || '',
    r.verifiedVisit ? 'YES' : 'NO',
    r.checkInDate || '',
    r.checkInTime || '',
    r.checkInCoords?.lat || '',
    r.checkInCoords?.lng || '',
    r.checkInCoords?.accuracy || '',
    r.checkInDistKm !== undefined ? r.checkInDistKm : '',
    r.checkInMapUrl || (r.checkInCoords ? `https://www.google.com/maps?q=${r.checkInCoords.lat},${r.checkInCoords.lng}` : ''),
    r.updatedAt ? new Date(r.updatedAt).toLocaleString() : ''
  ]);

  // Executive Summary Sheet
  const summaryHeader = ["Assistant Territory", "Base Station (HQ)", "Target Dealers", "Outreach Completed", "Completion %", "Deals Closed (Booked)"];
  const liveAssistants = (storage && typeof storage.getAssistants === 'function') ? storage.getAssistants() : ASSISTANTS;
  const summaryRows = liveAssistants.map(a => {
    const mine = allRows.filter(r => r.assistant === a.name);
    const done = mine.filter(r => (r.status && r.status !== 'Pending') || r.mobile || r.potentialFor).length;
    const closed = mine.filter(r => r.status === 'Closed').length;
    const pct = (a.target || mine.length) ? Math.round((done / (a.target || mine.length)) * 100) + '%' : '0%';
    return [a.name, a.hq, a.target || mine.length, done, pct, closed];
  });

  // Dedicated Live GPS Check-In Audit Sheet
  const checkInLogs = (storage && typeof storage.getCheckInLogs === 'function') ? storage.getCheckInLogs() : [];
  const auditHeader = [
    "Check-In ID", "Check-In Date", "Check-In Time", "Field Assistant", 
    "Retailer Name", "Mobile Number", "District", "Block Name", 
    "Latitude", "Longitude", "GPS Accuracy (m)", "Distance to Block (km)", 
    "Visit Status", "Google Maps URL", "Field Notes"
  ];
  const auditRows = checkInLogs.map(l => [
    l.id || '',
    l.date || '',
    l.time || '',
    l.rep || '',
    l.retailer || '',
    l.mobile || '',
    l.district || '',
    l.block || '',
    l.lat || '',
    l.lng || '',
    l.accuracy || '',
    l.distKm !== undefined ? l.distKm : '',
    l.status || 'Visited',
    l.mapUrl || '',
    l.notes || ''
  ]);

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows]);
  const wsDetails = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wsAudit = XLSX.utils.aoa_to_sheet([auditHeader, ...auditRows]);

  XLSX.utils.book_append_sheet(wb, wsSummary, "Outreach Summary");
  XLSX.utils.book_append_sheet(wb, wsDetails, "Retailer Directory");
  XLSX.utils.book_append_sheet(wb, wsAudit, "Live GPS Check-In Audit");

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await triggerDownload(`Bihar_Tier_A_Retailers_Master_${timestamp}.xlsx`, blob);
}

export async function exportToCsv(allRows) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const headers = [
    "Assigned Assistant", "Base Station (HQ)", "Travel Radius", 
    "District", "Block Name", "Retailer Name", "Mobile Number", 
    "Potential For", "Potential Sell", "Visit Status", "Field Notes",
    "Live GPS Verified", "CheckIn Date", "CheckIn Time", "CheckIn Lat", "CheckIn Lng", 
    "GPS Accuracy (m)", "Distance to Block (km)", "Google Maps Pin URL", "Last Updated"
  ];

  const rows = allRows.map(r => [
    r.assistant || '',
    r.hq || '',
    r.radius || '',
    r.district || '',
    r.block || '',
    r.retailer || '',
    r.mobile || '',
    r.potentialFor || '',
    r.potentialSell || '',
    r.status || 'Pending',
    r.notes || '',
    r.verifiedVisit ? 'YES' : 'NO',
    r.checkInDate || '',
    r.checkInTime || '',
    r.checkInCoords?.lat || '',
    r.checkInCoords?.lng || '',
    r.checkInCoords?.accuracy || '',
    r.checkInDistKm !== undefined ? r.checkInDistKm : '',
    r.checkInMapUrl || (r.checkInCoords ? `https://www.google.com/maps?q=${r.checkInCoords.lat},${r.checkInCoords.lng}` : ''),
    r.updatedAt ? new Date(r.updatedAt).toLocaleString() : ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
    
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  await triggerDownload(`Bihar_Tier_A_Retailers_${timestamp}.csv`, blob);
}

export async function exportCheckInAuditToExcel(checkInLogs) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const auditHeader = [
    "Check-In ID", "Check-In Date", "Check-In Time", "Field Assistant", 
    "Retailer Name", "Mobile Number", "District", "Block Name", 
    "Exact Latitude", "Exact Longitude", "GPS Accuracy (±m)", "Distance to Block HQ (km)", 
    "Proximity Assessment", "Visit Status", "Google Maps URL", "Field Notes"
  ];

  const auditRows = checkInLogs.map(l => {
    let prox = 'On-Site';
    if (l.distKm > 7.0) prox = 'Flagged Off-Site';
    else if (l.distKm > 2.5) prox = 'Vicinity Zone';

    return [
      l.id || '',
      l.date || '',
      l.time || '',
      l.rep || '',
      l.retailer || '',
      l.mobile || '',
      l.district || '',
      l.block || '',
      l.lat || '',
      l.lng || '',
      l.accuracy ? `±${l.accuracy}m` : '',
      l.distKm !== undefined ? l.distKm : '',
      prox,
      l.status || 'Visited',
      l.mapUrl || '',
      l.notes || ''
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([auditHeader, ...auditRows]);
  XLSX.utils.book_append_sheet(wb, ws, "GPS Check-In Audit");

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await triggerDownload(`Bihar_Field_Rep_GPS_CheckIn_Audit_${timestamp}.xlsx`, blob);
}

export async function exportCheckInAuditToCsv(checkInLogs) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const auditHeader = [
    "Check-In ID", "Check-In Date", "Check-In Time", "Field Assistant", 
    "Retailer Name", "Mobile Number", "District", "Block Name", 
    "Exact Latitude", "Exact Longitude", "GPS Accuracy (±m)", "Distance to Block HQ (km)", 
    "Proximity Assessment", "Visit Status", "Google Maps URL", "Field Notes"
  ];

  const auditRows = checkInLogs.map(l => {
    let prox = 'On-Site';
    if (l.distKm > 7.0) prox = 'Flagged Off-Site';
    else if (l.distKm > 2.5) prox = 'Vicinity Zone';

    return [
      l.id || '',
      l.date || '',
      l.time || '',
      l.rep || '',
      l.retailer || '',
      l.mobile || '',
      l.district || '',
      l.block || '',
      l.lat || '',
      l.lng || '',
      l.accuracy ? `±${l.accuracy}m` : '',
      l.distKm !== undefined ? l.distKm : '',
      prox,
      l.status || 'Visited',
      l.mapUrl || '',
      l.notes || ''
    ];
  });

  const csvContent = [auditHeader, ...auditRows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
    
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  await triggerDownload(`Bihar_Field_Rep_GPS_CheckIn_Audit_${timestamp}.csv`, blob);
}

export async function parseExcelOrCsvFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.find(n => /route|travel|retailer|directory|sheet1/i.test(n)) || wb.SheetNames[0];
  const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

  if (!json || json.length === 0) {
    throw new Error('File appears to be empty or has no recognizable data rows.');
  }

  const norm = (h) => String(h || '').trim().toLowerCase();
  const parsedRows = [];

  for (let i = 0; i < json.length; i++) {
    const row = json[i];
    const getVal = (pattern) => {
      for (const k in row) {
        if (norm(k).includes(pattern)) return String(row[k]).trim();
      }
      return '';
    };

    const retailer = getVal('retailer') || getVal('dealer') || getVal('shop') || getVal('firm') || getVal('name');
    if (!retailer) continue;

    parsedRows.push({
      id: 'r_imp_' + Date.now() + '_' + i,
      idx: i,
      assistant: getVal('assistant') || getVal('assigned') || 'Assistant 1 (West Patna)',
      hq: getVal('base') || getVal('hq') || '',
      radius: getVal('radius') || '10 km',
      district: getVal('district') || 'Patna',
      block: getVal('block') || '',
      retailer,
      mobile: getVal('mobile') || getVal('phone') || getVal('contact') || '',
      potentialFor: getVal('potential for') || getVal('category') || '',
      potentialSell: getVal('potential sell') || getVal('bracket') || '',
      status: getVal('status') || 'Pending',
      notes: getVal('notes') || getVal('remark') || '',
      updatedAt: Date.now()
    });
  }

  return parsedRows;
}

async function triggerDownload(filename, blob) {
  // Claude capability downloads check
  if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') {
    try {
      const downloads = await window.claude.use('downloads');
      if (downloads && typeof downloads.save === 'function') {
        await downloads.save({ filename, data: blob });
        showToast('Saved file via Claude Artifacts: ' + filename, '💾');
        return;
      }
    } catch(e) {
      console.warn("Claude download check skipped:", e);
    }
  }

  // Standard Browser fallback download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded ' + filename, '💾');
}

export async function exportKpiReportToExcel(assistantScores, allMeetings = [], allDemos = [], allIntel = [], allLeads = []) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const wb = XLSX.utils.book_new();

  // 1. Leaderboard Sheet
  const leaderboardHeaders = [
    "Rank", "Assistant (MGO)", "Total KPI Score (/100)", "Performance Standard", 
    "1. Tech Knowledge (10)", "2. Competitor Intel (15)", "3. Farmer Engagement (25)", 
    "4. Planning & Sales (20)", "5. AQFS Quality (15)", "6. Dealer Intel & Feedback (15)",
    "Retailer Visits", "Farmer Meetings", "Demo Plots", "Farmer Leads", "Competitor Logs", "Quiz Done", "EOD Submitted", "AQFS Audited"
  ];

  const leaderboardRows = assistantScores.map((s, idx) => [
    idx + 1,
    s.assistant,
    s.totalScore,
    s.grade.label,
    s.breakdown.p1_techKnowledge.score,
    s.breakdown.p2_competitorIntel.score,
    s.breakdown.p3_farmerEngagement.score,
    s.breakdown.p4_planningSales.score,
    s.breakdown.p5_aqfsQuality.score,
    s.breakdown.p6_dealerFeedback.score,
    s.counts.retailerCheckIns,
    s.counts.farmerMeetings,
    s.counts.demoPlots,
    s.counts.farmerLeads || 0,
    s.counts.competitorEntries,
    s.counts.quizCompleted ? 'YES' : 'NO',
    s.counts.eodSubmitted ? 'YES' : 'NO',
    s.counts.isAqfsAudited ? 'YES' : 'NO'
  ]);

  const wsLeaderboard = XLSX.utils.aoa_to_sheet([leaderboardHeaders, ...leaderboardRows]);
  XLSX.utils.book_append_sheet(wb, wsLeaderboard, "100-Pt KPI Scorecard");

  // 2. Granular Sub-Parameters Breakdown Sheet
  const subParamHeaders = [
    "Assistant (MGO)", "Pillar", "Sub-Parameter Name", "Score Earned", "Max Points", "Weightage %"
  ];
  const subParamRows = [];
  assistantScores.forEach(s => {
    Object.values(s.breakdown).forEach(pillar => {
      (pillar.subParameters || []).forEach(sp => {
        subParamRows.push([
          s.assistant,
          pillar.label,
          sp.name,
          sp.score,
          sp.max,
          Math.round((sp.score / sp.max) * 100) + '%'
        ]);
      });
    });
  });
  if (subParamRows.length > 0) {
    const wsSubParams = XLSX.utils.aoa_to_sheet([subParamHeaders, ...subParamRows]);
    XLSX.utils.book_append_sheet(wb, wsSubParams, "Sub-Parameters Rubric");
  }

  // 3. Farmer Leads & Market Development Pipeline Sheet
  if (allLeads.length > 0) {
    const leadHeaders = [
      "Lead ID", "Assistant (MGO)", "Farmer Name", "Mobile", "Village", "Block", "District", 
      "Crop", "Acreage", "Category", "Target Product", "Funnel Stage", 
      "Assigned Dealer (Liquidation)", "Demand (Bags)", "Next Follow-Up Date", "Follow-up Notes", "Created At"
    ];
    const leadRows = allLeads.map(l => [
      l.id,
      l.assistant,
      l.farmer_name,
      l.mobile || '',
      l.village,
      l.block,
      l.district,
      l.crop,
      l.acreage || 1.0,
      l.farmer_category || 'Progressive',
      l.product_interest || '',
      l.funnel_stage || 'Awareness',
      l.assigned_dealer_name || '',
      l.demand_volume_bags || 1,
      l.follow_up_date || '',
      l.follow_up_notes || '',
      l.created_at || ''
    ]);
    const wsLeads = XLSX.utils.aoa_to_sheet([leadHeaders, ...leadRows]);
    XLSX.utils.book_append_sheet(wb, wsLeads, "Farmer Leads CRM");
  }

  // 4. Farmer Meetings Sheet
  if (allMeetings.length > 0) {
    const meetingHeaders = ["Assistant", "Date", "District", "Block", "Village", "Crop", "Meeting Format", "Attendees", "Lead Farmer", "Key Discussion"];
    const meetingRows = allMeetings.map(m => [
      m.assistant,
      m.date,
      m.district,
      m.block,
      m.village,
      m.crop,
      m.meeting_type || 'Group Meeting',
      m.attendees_count || 0,
      m.lead_farmers?.[0]?.name ? `${m.lead_farmers[0].name} (${m.lead_farmers[0].mobile || ''})` : '',
      m.key_discussion || ''
    ]);
    const wsMeetings = XLSX.utils.aoa_to_sheet([meetingHeaders, ...meetingRows]);
    XLSX.utils.book_append_sheet(wb, wsMeetings, "Farmer Meetings");
  }

  // 5. Demo Plots Sheet
  if (allDemos.length > 0) {
    const demoHeaders = ["Assistant", "Crop", "Hybrid Tested", "Competitor Check", "Current Stage", "Farmer Name", "Mobile", "Village", "Block", "Sowing Date", "Yield (kg/acre)", "Observations"];
    const demoRows = allDemos.map(d => [
      d.assistant,
      d.crop,
      d.hybrid_tested,
      d.competitor_check || '',
      d.current_stage || 'Sowing',
      d.farmer_name,
      d.farmer_mobile || '',
      d.village,
      d.block,
      d.sowing_date || '',
      d.yield_result_kg_acre || '',
      d.observations || ''
    ]);
    const wsDemos = XLSX.utils.aoa_to_sheet([demoHeaders, ...demoRows]);
    XLSX.utils.book_append_sheet(wb, wsDemos, "Demo Plots");
  }

  // 6. Competitor Intel Sheet
  if (allIntel.length > 0) {
    const intelHeaders = ["Assistant", "Date", "District", "Block", "Retailer Counter", "Crop", "Competitor Brand", "Product", "Retail Price", "Dealer Price", "Scheme", "Farmer Sentiment"];
    const intelRows = allIntel.map(c => [
      c.assistant,
      c.date,
      c.district,
      c.block,
      c.retailer_name || '',
      c.crop,
      c.competitor_brand,
      c.product_name,
      c.retail_price || '',
      c.dealer_price || '',
      c.promotional_scheme || '',
      c.farmer_sentiment || ''
    ]);
    const wsIntel = XLSX.utils.aoa_to_sheet([intelHeaders, ...intelRows]);
    XLSX.utils.book_append_sheet(wb, wsIntel, "Competitor Intel");
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await triggerDownload(`MGO_SOP_Performance_Weekly_${timestamp}.xlsx`, blob);
}

export async function exportFormSubmissionsToExcel(form, submissions) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const wb = XLSX.utils.book_new();

  // 1. Submissions Sheet
  const fieldHeaders = form.fields.map(f => f.label);
  const headers = ["Submission ID", "Submitted Date & Time", "Field Assistant", "Station HQ", "District", "GPS Geotag", ...fieldHeaders];

  const rows = submissions.map(s => {
    const coordsStr = s.coords ? `${s.coords.lat.toFixed(5)}° N, ${s.coords.lng.toFixed(5)}° E` : 'Pending GPS';
    const fieldValues = form.fields.map(f => {
      const val = s.answers ? s.answers[f.id] : '';
      return val !== undefined && val !== null ? val : '';
    });
    return [
      s.id,
      new Date(s.submittedAt).toLocaleString(),
      s.assistant,
      s.hq || '',
      s.district || '',
      coordsStr,
      ...fieldValues
    ];
  });

  const wsSubmissions = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, wsSubmissions, "Survey Responses");

  // 2. Form Metadata Sheet
  const metaRows = [
    ["Form Title", form.title],
    ["Category", form.category || 'General Field Audit'],
    ["Target Scope", form.targetType === 'all' ? 'All Assistants' : form.targetType === 'district' ? `District: ${form.targetValue}` : `Individual: ${form.targetValue}`],
    ["Total Submissions", submissions.length],
    ["Due Deadline", form.deadline || 'None'],
    ["Created Date", form.createdAt ? new Date(form.createdAt).toLocaleString() : ''],
    ["", ""],
    ["Field ID", "Field Label", "Input Type", "Required"]
  ];
  form.fields.forEach(f => {
    metaRows.push([f.id, f.label, f.type, f.required ? 'YES' : 'NO']);
  });

  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Form Schema");

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const sanitizedTitle = (form.title || 'Field_Survey').replace(/[^a-zA-Z0-9]/g, '_');
  await triggerDownload(`${sanitizedTitle}_Responses_${timestamp}.xlsx`, blob);
  showToast(`Exported "${form.title}" responses to Excel!`, '📥');
}

// =========================================================================
// INVENTORY ALLOCATION & FIELD LIQUIDATION MULTI-SHEET EXCEL EXPORT
// =========================================================================
export async function exportInventoryToExcel(summaryData) {
  const XLSX = await loadSheetJS();
  const wb = XLSX.utils.book_new();
  const timestamp = new Date().toISOString().slice(0, 10);
  const { allocMetrics, productSummaries, assistantSummaries, totalAllocatedVal, totalRealizedVal, overallLiquidationPct } = summaryData;

  // 1. Sheet 1: Master Company Stock Summary
  const summaryHeaders = [
    "Product Name", "Crop", "Category", "Unit", "Unit Price (₹)", 
    "Total Allocated", "Sold to Dealers", "Farmer Trial Samples", "Damaged/Returned", 
    "Closing Balance In-Hand", "Liquidation %", "Realized Revenue (₹)"
  ];

  const summaryRows = productSummaries.map(p => [
    p.productName,
    p.crop,
    p.category,
    p.unit,
    p.unitPrice,
    p.totalAllocated,
    p.totalLiquidated,
    p.totalSampleDistributed,
    p.totalDamaged,
    p.totalBalance,
    `${p.liquidationPct}%`,
    p.totalRealizedValue
  ]);

  // Append Totals Row
  summaryRows.push([
    "COMPANY TOTAL", "", "", "", "",
    productSummaries.reduce((s, p) => s + p.totalAllocated, 0),
    productSummaries.reduce((s, p) => s + p.totalLiquidated, 0),
    productSummaries.reduce((s, p) => s + p.totalSampleDistributed, 0),
    productSummaries.reduce((s, p) => s + p.totalDamaged, 0),
    productSummaries.reduce((s, p) => s + p.totalBalance, 0),
    `${overallLiquidationPct}%`,
    totalRealizedVal
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet([
    ["BIHAR FIELD OPERATIONS - INVENTORY ALLOCATION & LIQUIDATION LEDGER"],
    [`Report Period: ${summaryData.filterMeta?.periodLabel || 'All Time'} | Generated: ${new Date().toLocaleString()}`],
    [`Portfolio Valuation: ₹${totalAllocatedVal.toLocaleString()} | Period Realized: ₹${totalRealizedVal.toLocaleString()} (${overallLiquidationPct}%) | Historical Stock Included: ${summaryData.filterMeta?.includePastAllocations ? 'YES' : 'NO'}`],
    [""],
    summaryHeaders,
    ...summaryRows
  ]);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Company Stock Rollup");

  // 2. Sheet 2: Assistant-Wise Allocation & Balance Matrix
  const asstHeaders = [
    "Assistant Name", "Hub HQ", "District", "Product Name", "Batch No", 
    "Unit", "Allocated Qty", "Sold to Counters", "Farmer Samples", "Damage/Return", 
    "In-Hand Balance", "Liquidation %", "Realized Value (₹)", "Status"
  ];

  const asstRows = [];
  allocMetrics.forEach(a => {
    let status = "🟢 Active";
    if (a.balanceQty === 0) status = "🔴 Depleted";
    else if (a.liquidationPct >= 85) status = "🟡 Near Complete";
    else if (a.liquidationPct === 0) status = "⚠️ Unmoved";

    asstRows.push([
      a.targetRep,
      a.targetRepInfo?.hq || '',
      a.targetRepInfo?.district || '',
      a.productName,
      a.batchNo || 'N/A',
      a.unit,
      a.allocatedQty,
      a.liquidatedQty,
      a.sampleQty,
      a.damageQty,
      a.balanceQty,
      `${a.liquidationPct}%`,
      a.realizedRevenue,
      status
    ]);
  });

  const wsAsst = XLSX.utils.aoa_to_sheet([asstHeaders, ...asstRows]);
  XLSX.utils.book_append_sheet(wb, wsAsst, "Assistant Stock Matrix");

  // 3. Sheet 3: Movement Transaction Audit Trail
  const moveHeaders = [
    "Date", "Field Assistant", "Product Name", "Movement Type", 
    "Quantity", "Unit", "Realized Unit Price (₹)", "Total Value (₹)", 
    "Recipient / Destination", "Recipient Type", "Invoice / Memo Ref", "Verified GPS", "Field Notes"
  ];

  const moveRows = [];
  allocMetrics.forEach(a => {
    (a.movements || []).forEach(m => {
      const typeLabel = m.movementType === 'liquidation' ? 'Counter Liquidation / Sale'
        : m.movementType === 'demo_sample' ? 'Farmer Trial Sample'
        : m.movementType === 'dealer_transfer' ? 'Dealer Transfer'
        : 'Damage / Return';

      const gpsStr = m.gps ? `${m.gps.lat?.toFixed(4)}, ${m.gps.lng?.toFixed(4)}` : 'Manual';
      const totVal = (Number(m.quantity) || 0) * (Number(m.realizedPricePerUnit) || Number(a.unitPrice) || 0);

      moveRows.push([
        m.date || '',
        m.assistant,
        a.productName,
        typeLabel,
        m.quantity,
        m.unit || a.unit,
        m.realizedPricePerUnit || a.unitPrice || 0,
        totVal,
        m.recipientName || 'Unspecified',
        m.recipientType || 'dealer',
        m.invoiceOrRefNo || '',
        gpsStr,
        m.notes || ''
      ]);
    });
  });

  moveRows.sort((a, b) => (b[0] || '').localeCompare(a[0] || ''));

  const wsMoves = XLSX.utils.aoa_to_sheet([moveHeaders, ...moveRows]);
  XLSX.utils.book_append_sheet(wb, wsMoves, "Movement Audit Trail");

  // 4. Sheet 4: Low Stock & Reorder Alerts
  const lowStockHeaders = ["Assistant", "Product", "Unit", "Allocated", "Liquidated", "In-Hand Balance", "Liquidation %", "Urgency"];
  const lowStockRows = allocMetrics
    .filter(a => a.balanceQty <= (a.allocatedQty * 0.20) || a.balanceQty === 0)
    .map(a => [
      a.targetRep,
      a.productName,
      a.unit,
      a.allocatedQty,
      a.liquidatedQty + a.sampleQty,
      a.balanceQty,
      `${a.liquidationPct}%`,
      a.balanceQty === 0 ? "URGENT REPLENISHMENT" : "LOW STOCK ALERT"
    ]);

  const wsLow = XLSX.utils.aoa_to_sheet([lowStockHeaders, ...lowStockRows]);
  XLSX.utils.book_append_sheet(wb, wsLow, "Low Stock Alerts");

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await triggerDownload(`Bihar_Field_Inventory_Liquidation_Ledger_${timestamp}.xlsx`, blob);
  showToast('Comprehensive Multi-Sheet Inventory Ledger exported to Excel!', '📊');
}

// =========================================================================
// BULK INVENTORY EXCEL TEMPLATE & INGESTION
// =========================================================================

export async function downloadInventoryImportTemplate() {
  const timestamp = new Date().toISOString().slice(0, 10);
  const liveAssistants = (storage && typeof storage.getAssistants === 'function') ? storage.getAssistants() : ASSISTANTS;

  // Sheet 1: Data Entry Upload Form
  const templateHeaders = [
    "Product / Variety Name *",
    "Target Crop *",
    "Category *",
    "Unit of Measure *",
    "Allocated Quantity *",
    "Landing Unit Price (INR)",
    "Batch / Lot Number",
    "Target Field Assistant *",
    "Campaign / Season",
    "Dispatch Date (YYYY-MM-DD)",
    "Manager Dispatch Notes"
  ];

  const sampleRows = [
    [
      "Shaktiman Hybrid Maize 3355",
      "Maize",
      "Hybrid Seeds",
      "packets",
      500,
      650,
      "LOT-MZ-3355",
      liveAssistants[0]?.name || "Assistant 1 (West Patna)",
      "Rabi 2026",
      timestamp,
      "Focus on Rosera and Bihta Tier-A dealer counters"
    ],
    [
      "Snowball 16 Cauliflower Seed",
      "Cauliflower",
      "Vegetable Seeds",
      "kg",
      100,
      4800,
      "LOT-SNOW-16",
      liveAssistants[1]?.name || "Assistant 2 (East Patna)",
      "Rabi 2026",
      timestamp,
      "High germination batch, advise 10 kg for farmer trial plots"
    ],
    [
      "Biozyme Crop Energizer (Liquid)",
      "General",
      "Bio-stimulants",
      "liters",
      250,
      850,
      "LOT-BIO-99",
      "ALL",
      "Rabi 2026",
      timestamp,
      "Standard portfolio allocation across all territory hubs"
    ],
    [
      "Abhinav F1 Tomato Seeds",
      "Tomato",
      "Vegetable Seeds",
      "packets",
      300,
      950,
      "LOT-TOM-88",
      liveAssistants[2]?.name || "Assistant 3 (Nalanda Central)",
      "Rabi 2026",
      timestamp,
      "Promote with nursery growers"
    ]
  ];

  // Sheet 2: Field Rules and Specifications
  const guideHeaders = ["Field Name", "Required?", "Accepted Values / Examples", "Description"];
  const guideRows = [
    ["Product / Variety Name", "YES", "e.g. Shaktiman Hybrid Maize 3355", "Full commercial brand or variety name."],
    ["Target Crop", "YES", "e.g. Maize, Cauliflower, Paddy, Tomato", "Primary agronomy crop."],
    ["Category", "YES", "Hybrid Seeds | Vegetable Seeds | Crop Protection | Bio-stimulants | Trial Samples", "Select standard product category."],
    ["Unit of Measure", "YES", "packets | kg | bags | liters | grams | boxes", "Stock measurement unit."],
    ["Allocated Quantity", "YES", "e.g. 500 (Must be positive number)", "Total physical quantity issued to the field representative."],
    ["Landing Unit Price (INR)", "NO", "e.g. 650", "Wholesale or landing price per unit in rupees."],
    ["Batch / Lot Number", "NO", "e.g. LOT-BIH-2026", "Traceability batch code."],
    ["Target Field Assistant", "YES", "Specific Assistant Name OR 'ALL'", "Enter exact assistant name from the list below, or 'ALL' to issue equal quota to all active field reps."],
    ["Campaign / Season", "NO", "Rabi 2026 | Kharif 2026 | Zaid 2026", "Operating crop season."],
    ["Dispatch Date", "NO", `YYYY-MM-DD (e.g. ${timestamp})`, "Date physical stock dispatched to territory hub."],
    ["Manager Dispatch Notes", "NO", "Text remarks", "Guidance on counter liquidation strategy."]
  ];

  // Sheet 3: Valid Active Assistants reference
  const assistantsListHeaders = ["Active Field Assistant", "Base Station (HQ)", "District"];
  const assistantsListRows = liveAssistants.map(a => [a.name, a.hq, a.district]);
  assistantsListRows.push(["ALL", "All Hubs", "Entire Bihar Territory (Issues equal quota to every rep)"]);

  const wb = XLSX.utils.book_new();
  const wsTemplate = XLSX.utils.aoa_to_sheet([templateHeaders, ...sampleRows]);
  const wsGuide = XLSX.utils.aoa_to_sheet([guideHeaders, ...guideRows]);
  const wsReps = XLSX.utils.aoa_to_sheet([assistantsListHeaders, ...assistantsListRows]);

  XLSX.utils.book_append_sheet(wb, wsTemplate, "Stock Quota Upload");
  XLSX.utils.book_append_sheet(wb, wsGuide, "Field Guidelines");
  XLSX.utils.book_append_sheet(wb, wsReps, "Valid Assistants & Hubs");

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await triggerDownload(`Inventory_Bulk_Upload_Template_${timestamp}.xlsx`, blob);
  showToast('Downloaded Inventory Bulk Upload Excel Template!', '📥');
}

export async function parseInventoryExcelFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.find(n => /stock|quota|inventory|upload|sheet1/i.test(n)) || wb.SheetNames[0];
  const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

  if (!json || json.length === 0) {
    throw new Error('File appears to be empty or has no recognizable data rows.');
  }

  const liveAssistants = (storage && typeof storage.getAssistants === 'function') ? storage.getAssistants() : ASSISTANTS;
  const validRows = [];
  const errors = [];

  for (let i = 0; i < json.length; i++) {
    const row = json[i];
    const rowNum = i + 2; // Row 1 is header

    const getVal = (patterns) => {
      for (const k in row) {
        const normKey = String(k || '').trim().toLowerCase();
        for (const p of patterns) {
          if (normKey.includes(p)) return row[k];
        }
      }
      return '';
    };

    const productName = String(getVal(['product', 'variety', 'item', 'name']) || '').trim();
    const rawQty = getVal(['qty', 'quantity', 'allocated', 'units', 'quota']);
    const allocatedQty = parseFloat(rawQty);

    if (!productName) {
      // Skip blank rows
      continue;
    }

    if (isNaN(allocatedQty) || allocatedQty <= 0) {
      errors.push(`Row ${rowNum} (${productName}): Invalid quantity '${rawQty}'. Must be positive number.`);
      continue;
    }

    const crop = String(getVal(['crop', 'target crop']) || 'General').trim();
    const category = normalizeInventoryCategory(getVal(['category', 'type', 'cat']));
    const unit = normalizeInventoryUnit(getVal(['unit', 'uom', 'measure']));
    const rawPrice = getVal(['price', 'rate', 'mrp', 'cost']);
    const unitPrice = parseFloat(rawPrice) || 0;
    const batchNo = String(getVal(['batch', 'lot', 'serial']) || `LOT-IMP-${new Date().getFullYear()}`).trim();
    const rawRep = String(getVal(['assistant', 'rep', 'target', 'assign', 'allocated to']) || 'ALL').trim();
    const targetRep = resolveInventoryAssistant(rawRep, liveAssistants);
    const season = String(getVal(['season', 'campaign']) || 'Rabi 2026').trim();
    const rawDate = getVal(['date', 'dispatch', 'issued']);
    const allocatedDate = formatInventoryExcelDate(rawDate);
    const notes = String(getVal(['note', 'remark', 'comment', 'strategy']) || 'Bulk Excel Dispatched').trim();

    validRows.push({
      productName,
      crop,
      category,
      unit,
      allocatedQty,
      unitPrice,
      batchNo,
      targetRep,
      season,
      allocatedDate,
      notes
    });
  }

  return { validRows, errors, totalRows: json.length };
}

function formatInventoryExcelDate(val) {
  if (!val) return new Date().toISOString().slice(0, 10);
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return !isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function normalizeInventoryUnit(rawUnit) {
  const u = String(rawUnit || '').trim().toLowerCase();
  if (u.includes('kg') || u.includes('kilo')) return 'kg';
  if (u.includes('pkt') || u.includes('packet')) return 'packets';
  if (u.includes('bag')) return 'bags';
  if (u.includes('liter') || u.includes('litre') || u === 'l') return 'liters';
  if (u.includes('gram') || u === 'g') return 'grams';
  if (u.includes('box') || u.includes('master')) return 'boxes';
  return 'packets';
}

function normalizeInventoryCategory(rawCat) {
  const c = String(rawCat || '').trim().toLowerCase();
  if (c.includes('veg')) return 'Vegetable Seeds';
  if (c.includes('protect') || c.includes('pesticide') || c.includes('chem')) return 'Crop Protection';
  if (c.includes('bio') || c.includes('stimulant')) return 'Bio-stimulants';
  if (c.includes('trial') || c.includes('sample')) return 'Trial Samples';
  return 'Hybrid Seeds';
}

function resolveInventoryAssistant(rawRep, liveAssistants) {
  const str = String(rawRep || '').trim().toLowerCase();
  if (!str || str === 'all' || str === 'all_active' || str.includes('all assistant') || str.includes('all rep')) {
    return 'ALL_ACTIVE';
  }
  const exact = liveAssistants.find(a => a.name.toLowerCase() === str);
  if (exact) return exact.name;
  const partial = liveAssistants.find(a => a.name.toLowerCase().includes(str) || str.includes(a.name.toLowerCase()));
  if (partial) return partial.name;
  return 'ALL_ACTIVE';
}

export async function exportTadaClaimsToExcel(claims, filterMeta = {}) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const wb = XLSX.utils.book_new();

  // Sheet 1: TA-DA Claims Payout Sheet
  const headers = [
    "Claim ID", "Date", "Field Assistant", "Station HQ", "District", 
    "Vehicle Mode", "Fuel Rate (₹/km)", "Verified Visits", "GPS Route Dist (km)", "Claimed Dist (km)", "Variance %", 
    "Audit Status", "Fuel Allowance (₹)", "Daily Allowance (₹)", "Outstation Allowance (₹)", 
    "Attached Bills (Count)", "Attached Bills (₹)", "Incidentals (₹)", "Incidental Notes", 
    "Total Claim (₹)", "Approved Amount (₹)", "Claim Status", "Approved By", "Approval Date", "Manager Remarks"
  ];

  let totalVisits = 0;
  let totalGpsKm = 0;
  let totalClaimedKm = 0;
  let totalFuel = 0;
  let totalDA = 0;
  let totalOutstation = 0;
  let totalBillsCount = 0;
  let totalBillsAmount = 0;
  let totalIncidentals = 0;
  let totalClaimedVal = 0;
  let totalApprovedVal = 0;

  const rows = (claims || []).map(c => {
    const visits = c.verifiedStops || 0;
    const gpsKm = Number(c.gpsVerifiedKm || 0);
    const claimedKm = Number(c.claimedKm || c.gpsVerifiedKm || 0);
    const fuel = Number(c.fuelAmount || 0);
    const da = Number(c.daAmount || 0);
    const outstation = Number(c.outstationAmount || 0);
    const incidentals = Number(c.incidentalAmount || 0);
    const totalClaim = Number(c.totalClaimAmount || 0);
    const approved = c.approvedAmount !== undefined ? Number(c.approvedAmount) : totalClaim;
    const diff = claimedKm - gpsKm;
    const variancePct = gpsKm > 0 ? (Math.round((diff / gpsKm) * 100) + '%') : '0%';
    const bills = c.attachedBills || [];
    const billsCount = bills.length;
    const billsTotal = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

    totalVisits += visits;
    totalGpsKm += gpsKm;
    totalClaimedKm += claimedKm;
    totalFuel += fuel;
    totalDA += da;
    totalOutstation += outstation;
    totalBillsCount += billsCount;
    totalBillsAmount += billsTotal;
    totalIncidentals += incidentals;
    totalClaimedVal += totalClaim;
    totalApprovedVal += approved;

    const auditBadge = c.auditFlags && c.auditFlags.length > 0 
      ? c.auditFlags.join(' | ') 
      : (claimedKm > gpsKm * 1.15 ? 'FLAGGED: High Mileage Discrepancy' : 'VERIFIED: GPS Proximity Confirmed');

    return [
      c.id || '',
      c.date || '',
      c.assistant || '',
      c.hq || '',
      c.district || '',
      c.vehicleMode || 'Bike',
      c.fuelRate || (c.vehicleMode === 'Car' ? 9.50 : 4.50),
      visits,
      gpsKm,
      claimedKm,
      variancePct,
      auditBadge,
      fuel,
      da,
      outstation,
      billsCount,
      billsTotal,
      incidentals,
      c.incidentalNotes || '',
      totalClaim,
      approved,
      c.status || 'Pending Approval',
      c.approvedBy || '',
      c.approvedAt ? new Date(c.approvedAt).toLocaleDateString('en-IN') : '',
      c.managerNotes || ''
    ];
  });

  // Append Totals Summary Row
  rows.push([
    "TOTALS / SUMMARY", "", "", "", "",
    "", "",
    totalVisits,
    Math.round(totalGpsKm * 10) / 10,
    Math.round(totalClaimedKm * 10) / 10,
    "",
    "Aggregated Field Telemetry",
    Math.round(totalFuel * 10) / 10,
    Math.round(totalDA * 10) / 10,
    Math.round(totalOutstation * 10) / 10,
    totalBillsCount,
    Math.round(totalBillsAmount * 10) / 10,
    Math.round(totalIncidentals * 10) / 10,
    "",
    Math.round(totalClaimedVal * 10) / 10,
    Math.round(totalApprovedVal * 10) / 10,
    "",
    "",
    "",
    ""
  ]);

  const wsClaims = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  wsClaims['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 35 },
    { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
    { wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 24 },
    { wch: 14 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsClaims, "TA-DA Claims Payout");

  // Sheet 2: Field Assistant Aggregate Summary
  const liveAssistants = (storage && typeof storage.getAssistants === 'function') ? storage.getAssistants() : ASSISTANTS;
  const policy = (storage && typeof storage.getTadaPolicyConfig === 'function')
    ? storage.getTadaPolicyConfig()
    : { bikeFuelRatePerKm: 4.50, carFuelRatePerKm: 9.50, daFullDayAmount: 250, daHalfDayAmount: 150, minVisitsForFullDa: 4, outstationNightAllowance: 800 };

  const asstHeader = [
    "Field Assistant", "Base Station HQ", "District", "Default Vehicle", "Total Claims", 
    "Approved Claims", "Pending Claims", "Total GPS Distance (km)", 
    "Fuel Disbursed (₹)", "Daily Food Allowance (₹)", "Outstation Allowance (₹)", 
    "Incidentals (₹)", "Total Approved Payout (₹)"
  ];

  const asstRows = liveAssistants.map(a => {
    const mine = (claims || []).filter(c => c.assistant === a.name);
    const approved = mine.filter(c => c.status === 'Approved' || c.status === 'Adjusted');
    const pending = mine.filter(c => c.status === 'Pending Approval');
    const gpsKm = mine.reduce((sum, c) => sum + (c.gpsVerifiedKm || 0), 0);
    const fuel = approved.reduce((sum, c) => sum + (c.fuelAmount || 0), 0);
    const da = approved.reduce((sum, c) => sum + (c.daAmount || 0), 0);
    const outstation = approved.reduce((sum, c) => sum + (c.outstationAmount || 0), 0);
    const incidentals = approved.reduce((sum, c) => sum + (c.incidentalAmount || 0), 0);
    const totalPayout = approved.reduce((sum, c) => sum + (c.approvedAmount !== undefined ? c.approvedAmount : (c.totalClaimAmount || 0)), 0);
    const defaultMode = policy.assistantVehicleModes?.[a.name] || 'Bike';

    return [
      a.name, a.hq, a.district, defaultMode, mine.length, approved.length, pending.length,
      Math.round(gpsKm * 10) / 10,
      Math.round(fuel * 10) / 10,
      Math.round(da * 10) / 10,
      Math.round(outstation * 10) / 10,
      Math.round(incidentals * 10) / 10,
      Math.round(totalPayout * 10) / 10
    ];
  });

  const wsAsst = XLSX.utils.aoa_to_sheet([asstHeader, ...asstRows]);
  wsAsst['!cols'] = [
    { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 22 },
    { wch: 18 }, { wch: 22 }, { wch: 22 },
    { wch: 16 }, { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, wsAsst, "Assistant Mileage Summary");

  // Sheet 3: Official Policy Guidelines
  const policyHeader = ["Policy Section", "Standard Rule / Allowance Parameter", "Validation Mechanism"];
  const policyRows = [
    ["1. Motorbike Fuel Allowance", `₹${policy.bikeFuelRatePerKm.toFixed(2)} per verified kilometer`, "Calculated automatically using chronological GPS counter check-in telemetry road curvature"],
    ["2. Car / 4-Wheeler Fuel Allowance", `₹${policy.carFuelRatePerKm.toFixed(2)} per verified kilometer`, "Configurable per representative; validated against verified counter visit circuit"],
    ["3. Full-Day Field DA", `₹${policy.daFullDayAmount} per field day`, `Requires minimum ${policy.minVisitsForFullDa} GPS-verified physical dealer counter visits on the date`],
    ["4. Partial-Day Field DA", `₹${policy.daHalfDayAmount} per field day`, `Applicable for 1 to ${policy.minVisitsForFullDa - 1} verified dealer counter visits`],
    ["5. Outstation Night Stay", `₹${policy.outstationNightAllowance} per night`, "Triggered when conducting field operations outside assigned home district with hotel receipt"],
    ["6. Bill / Receipt Requirement", "Fuel slips, hotel bills, toll slips attached via photo", "Stored directly in digital dossier; accessible via supervisory audit lightbox"],
    ["7. Anti-Fraud Audit Policy", "Claims with >15% mileage inflation are flagged", "Supervisory portal auto-adjusts claimed distance to true GPS telemetry distance"],
    ["8. Approval Authority", "State Sales Manager (Bihar HQ)", "Claims audited weekly; approved amounts forwarded to finance for direct bank disbursement"]
  ];

  const wsPolicy = XLSX.utils.aoa_to_sheet([policyHeader, ...policyRows]);
  wsPolicy['!cols'] = [{ wch: 28 }, { wch: 45 }, { wch: 75 }];
  XLSX.utils.book_append_sheet(wb, wsPolicy, "TA-DA Policy Guidelines");

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await triggerDownload(`Bihar_AgTech_TADA_Payroll_Report_${timestamp}.xlsx`, blob);
  showToast('✅ TA/DA Payroll Sheet exported successfully to Excel!', '📊');
}



export async function exportMusterRollToExcel(musterData) {
  if (!musterData) { showToast('No muster roll data available to export.', 'ℹ️'); return; }

  const timestamp = new Date().toISOString().slice(0, 10);
  const { rows, monthName, year, month, daysInMonth, totalPayableDays, totalGrossPayroll, settings, pendingRegularizations } = musterData;
  const dailyWage = settings?.dailyBaseWage || 650;

  const wb = XLSX.utils.book_new();

  // ─── SHEET 1: FORM XVI — STATUTORY MUSTER ROLL ─────────────────────────────
  const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Company header rows
  const formXVIHeader = [
    ['BIHAR AGTECH SOLUTIONS PVT. LTD.'],
    ['Statutory Muster Roll — Form XVI / Form D (As per Shops & Establishments Act)'],
    [`Field Operations Division | ${monthName} ${year}`],
    [`Daily Base Wage: ₹${dailyWage}/day | Payable Days Formula: P + OD + WO + PL + H + (HD × 0.5)`],
    [],
    [
      'Emp ID', 'Employee Name', 'Father\'s / Guardian\'s Name', 'Designation',
      'HQ Station', 'District', 'Date of Joining',
      ...dayNums.map(d => {
        const dt = new Date(year, month - 1, d);
        const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        return `${d}\n${dayNames[dt.getDay()]}`;
      }),
      'P (Present)', 'HD (Half Day)', 'OD (On Duty)', 'WO (Weekly Off)',
      'PL (Paid Leave)', 'H (Holiday)', 'A (Absent)',
      'Total Payable Days', `Daily Wage (₹)`, 'Gross Monthly Wage (₹)',
      'Supervisor Sign'
    ]
  ];

  const dataRows = rows.map(row => [
    row.empCode,
    row.assistant,
    `S/O ${row.fatherName || 'Ram Kumar'}`,
    row.designation || 'Field Representative (MGO)',
    row.hq,
    row.district,
    row.dateOfJoining || '01-04-2023',
    ...row.dailyAttendance.map(d => d.code === '—' ? '' : d.code),
    row.presentCount,
    row.halfDayCount,
    row.onDutyCount,
    row.weeklyOffCount,
    row.leaveCount || 0,
    row.holidayCount || 0,
    row.absentCount,
    row.payableDays,
    dailyWage,
    row.grossWage,
    ''
  ]);

  const totalRow = [
    'TOTAL', `${rows.length} Representatives`, '', '', '', '', '',
    ...dayNums.map(() => ''),
    rows.reduce((s, r) => s + r.presentCount, 0),
    rows.reduce((s, r) => s + r.halfDayCount, 0),
    rows.reduce((s, r) => s + r.onDutyCount, 0),
    rows.reduce((s, r) => s + r.weeklyOffCount, 0),
    rows.reduce((s, r) => s + (r.leaveCount || 0), 0),
    rows.reduce((s, r) => s + (r.holidayCount || 0), 0),
    rows.reduce((s, r) => s + r.absentCount, 0),
    totalPayableDays,
    dailyWage,
    totalGrossPayroll,
    ''
  ];

  const wsFormXVI = XLSX.utils.aoa_to_sheet([...formXVIHeader, ...dataRows, totalRow]);

  // Column widths
  wsFormXVI['!cols'] = [
    { wch: 10 }, { wch: 28 }, { wch: 24 }, { wch: 30 },
    { wch: 18 }, { wch: 14 }, { wch: 14 },
    ...dayNums.map(() => ({ wch: 5 })),
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 18 }
  ];

  // Merge header rows
  wsFormXVI['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } }
  ];

  XLSX.utils.book_append_sheet(wb, wsFormXVI, 'FORM XVI - Statutory Muster Roll');

  // ─── SHEET 2: DAILY IN-OUT PUNCH REGISTER ──────────────────────────────────
  const punchHeader = [
    'Emp ID', 'Employee Name', 'HQ Station', 'Date', 'Day',
    'Punch-In Time', 'Punch-Out Time', 'Working Hours',
    'Attendance Code', 'Status Label',
    'Work Mode', 'Punch-In Location', 'Punch-Out Location',
    'Late Arrival', 'Regularization Requested', 'Regularization Status',
    'Notes'
  ];

  const punchRows = [];
  rows.forEach(row => {
    row.dailyAttendance.forEach(day => {
      if (day.code === '—') return; // skip future dates
      const dt = new Date(row.year || year, (row.month || month) - 1, day.dayNum);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      punchRows.push([
        row.empCode,
        row.assistant,
        row.hq,
        day.dateStr,
        dayNames[dt.getDay()],
        day.timeIn || '—',
        day.timeOut || '—',
        day.hours || '—',
        day.code,
        day.label,
        day.workMode || 'Field Operations',
        day.punchInLocation || row.hq,
        day.punchOutLocation || row.hq,
        day.isLate ? 'YES' : 'NO',
        day.regularizationRequested ? 'YES' : 'NO',
        day.regularizationStatus || 'None',
        day.notes || ''
      ]);
    });
  });

  const wsPunch = XLSX.utils.aoa_to_sheet([punchHeader, ...punchRows]);
  wsPunch['!cols'] = [
    { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 28 },
    { wch: 22 }, { wch: 24 }, { wch: 24 },
    { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 40 }
  ];
  XLSX.utils.book_append_sheet(wb, wsPunch, 'Daily In-Out Punch Register');

  // ─── SHEET 3: ATTENDANCE GUIDELINES & CODES ────────────────────────────────
  const guidelinesHeader = ['Attendance Code', 'Full Name', 'Pay Factor', 'Description / Conditions'];
  const guidelinesData = [
    ['P', 'Present (Full Day)', '1.0', 'Rep attended field operations for the full working day. Punch-in before 09:30 AM, Punch-out after 05:30 PM.'],
    ['HD', 'Half Day', '0.5', 'Rep attended for half the working day only. Less than 4 hours of duty or punch-out before 1:30 PM.'],
    ['OD', 'On Duty / Official Field Tour', '1.0', 'Rep was on approved official tour or outstation field assignment. Tour beat / GPS tour plan mandatory.'],
    ['WO', 'Weekly Off (Sunday)', '1.0 (paid)', 'Sunday or officially declared weekly off. Auto-marked for all Sundays. Counts in payable days.'],
    ['PL', 'Paid Leave (Approved)', '1.0', 'Prior-approved annual leave, earned leave, or privilege leave. Approval must be on record.'],
    ['CL', 'Casual Leave', '1.0', 'Short casual leave applied on same/next day. Limited to 12 CL per year per employee.'],
    ['SL', 'Sick Leave', '1.0', 'Medical leave with doctor\'s certificate (if > 2 consecutive days). Up to 12 SL per year.'],
    ['H', 'Bihar Gazetted Holiday', '1.0', 'Declared state or central government gazetted holiday. Applies to all representatives.'],
    ['A', 'Absent (Unauthorised)', '0.0', 'No punch-in, no tour beat, no approved leave. Absent day = zero pay for that day.'],
    [],
    ['PAYABLE DAYS FORMULA', '', '', 'P + OD + WO + PL + CL + SL + H + (HD × 0.5)'],
    ['GROSS MONTHLY WAGE', '', '', `Payable Days × ₹${dailyWage} (daily base wage rate)`],
    [],
    ['DISCIPLINARY NOTES', '', '', ''],
    ['Late Arrival Policy', '', '', 'Grace period: 30 minutes after scheduled start (09:00 AM). Arrival after 09:30 AM = Late Mark. 3 late marks = 0.5 day deduction.'],
    ['Absence Threshold', '', '', 'More than 3 unauthorised absences in a month triggers HR warning notice from State Sales Manager.'],
    ['GPS Verification', '', '', 'Field attendance is cross-validated with GPS counter check-in telemetry. Punch without GPS may be flagged for regularization.'],
    [],
    ['EXPORT INFO', '', '', `Generated: ${new Date().toLocaleString('en-IN')} | Month: ${monthName} ${year} | Total Reps: ${rows.length}`]
  ];

  const wsGuidelines = XLSX.utils.aoa_to_sheet([guidelinesHeader, ...guidelinesData]);
  wsGuidelines['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsGuidelines, 'Attendance Guidelines & Codes');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await triggerDownload(`Bihar_AgTech_Statutory_MusterRoll_${monthName}_${year}.xlsx`, blob);
  showToast(`✅ Statutory Muster Roll (Form XVI) exported successfully!`, '📊');
}

export async function exportLeaveBalanceReportToExcel(balances = [], applications = [], year = new Date().getFullYear()) {
  const wb = XLSX.utils.book_new();
  const settings = { dailyBaseWage: 650 };
  const dailyWage = settings.dailyBaseWage;
  const totalEncashment = balances.reduce((s, b) => s + (b.balance?.PL?.encashmentValue || 0), 0);

  // ─── SHEET 1: LEAVE BALANCE SUMMARY ───────────────────────────────────────
  const balanceHeader = [
    [`BIHAR AGTECH SOLUTIONS PVT. LTD. — ANNUAL LEAVE BALANCE REPORT (${year})`],
    [`Generated: ${new Date().toLocaleString('en-IN')} | Daily Wage: ₹${dailyWage}/day | Policy: 12 PL + 12 CL + 12 SL per year`],
    [],
    [
      'Emp ID', 'Representative Name', 'HQ Station', 'District',
      'PL Annual', 'PL Carry Fwd', 'PL Opening', 'PL Used', 'PL Balance',
      'CL Annual', 'CL Used', 'CL Balance',
      'SL Annual', 'SL Used', 'SL Balance',
      'LWP Days Used',
      'PL Encashable Days', `PL Encashment Value (₹)`,
      'Total Leave Used (All Types)'
    ]
  ];

  const balanceRows = balances.map(rb => {
    const b = rb.balance;
    const totalUsed = (b.PL?.used || 0) + (b.CL?.used || 0) + (b.SL?.used || 0) + (b.LWP?.used || 0);
    return [
      rb.empCode, rb.assistant, rb.hq, rb.district,
      b.PL?.annual, b.PL?.carryForward, b.PL?.opening, b.PL?.used, b.PL?.available,
      b.CL?.annual, b.CL?.used, b.CL?.available,
      b.SL?.annual, b.SL?.used, b.SL?.available,
      b.LWP?.used,
      b.PL?.encashableBalance, b.PL?.encashmentValue,
      totalUsed
    ];
  });

  const totalRow = [
    'TOTAL', `${balances.length} Representatives`, '', '',
    balances.reduce((s,r)=>s+(r.balance.PL?.annual||0),0),
    balances.reduce((s,r)=>s+(r.balance.PL?.carryForward||0),0),
    balances.reduce((s,r)=>s+(r.balance.PL?.opening||0),0),
    balances.reduce((s,r)=>s+(r.balance.PL?.used||0),0),
    balances.reduce((s,r)=>s+(r.balance.PL?.available||0),0),
    balances.reduce((s,r)=>s+(r.balance.CL?.annual||0),0),
    balances.reduce((s,r)=>s+(r.balance.CL?.used||0),0),
    balances.reduce((s,r)=>s+(r.balance.CL?.available||0),0),
    balances.reduce((s,r)=>s+(r.balance.SL?.annual||0),0),
    balances.reduce((s,r)=>s+(r.balance.SL?.used||0),0),
    balances.reduce((s,r)=>s+(r.balance.SL?.available||0),0),
    balances.reduce((s,r)=>s+(r.balance.LWP?.used||0),0),
    balances.reduce((s,r)=>s+(r.balance.PL?.encashableBalance||0),0),
    totalEncashment,
    ''
  ];

  const wsBalance = XLSX.utils.aoa_to_sheet([...balanceHeader, ...balanceRows, totalRow]);
  wsBalance['!cols'] = [
    {wch:10},{wch:28},{wch:18},{wch:14},
    {wch:11},{wch:12},{wch:11},{wch:10},{wch:11},
    {wch:11},{wch:10},{wch:11},
    {wch:11},{wch:10},{wch:11},
    {wch:14},{wch:18},{wch:22},{wch:20}
  ];
  wsBalance['!merges'] = [
    { s:{r:0,c:0}, e:{r:0,c:10} },
    { s:{r:1,c:0}, e:{r:1,c:10} }
  ];
  XLSX.utils.book_append_sheet(wb, wsBalance, 'Leave Balance Summary');

  // ─── SHEET 2: ALL LEAVE APPLICATIONS ─────────────────────────────────────
  const appHeader = [
    'Application ID', 'Emp ID', 'Representative', 'HQ',
    'Leave Type', 'Leave Label',
    'From Date', 'To Date', 'No. of Days', 'Half Day?', 'Session',
    'Reason', 'Status',
    'Applied Date', 'Reviewed By', 'Reviewed Date', 'Manager Remarks'
  ];

  const appRows = applications.map(a => [
    a.id, a.empCode, a.assistant, a.hq,
    a.leaveType, a.leaveLabel,
    a.fromDate, a.toDate, a.days, a.halfDay ? 'Yes' : 'No', a.session || 'Full Day',
    a.reason, a.status,
    a.appliedAt ? new Date(a.appliedAt).toLocaleDateString('en-IN') : '',
    a.approvedBy || '',
    a.approvedAt ? new Date(a.approvedAt).toLocaleDateString('en-IN') : '',
    a.managerRemarks || ''
  ]);

  const wsApps = XLSX.utils.aoa_to_sheet([appHeader, ...appRows]);
  wsApps['!cols'] = [
    {wch:36},{wch:10},{wch:28},{wch:16},
    {wch:8},{wch:22},{wch:12},{wch:12},{wch:10},{wch:10},{wch:14},
    {wch:40},{wch:12},
    {wch:14},{wch:30},{wch:14},{wch:40}
  ];
  XLSX.utils.book_append_sheet(wb, wsApps, 'All Leave Applications');

  // ─── SHEET 3: LEAVE POLICY & ENCASHMENT GUIDELINES ───────────────────────
  const policyData = [
    ['BIHAR AGTECH SOLUTIONS PVT. LTD.'],
    ['Leave Policy & Encashment Guidelines — As per Bihar Shops & Establishments Act'],
    [],
    ['LEAVE ENTITLEMENTS'],
    ['Leave Type', 'Annual Entitlement', 'Carry Forward?', 'Encashable?', 'Policy Notes'],
    ['PL (Paid Leave)', '12 days/year', 'Yes — Max 15 days', 'Yes — Year-End', 'Earned/Privilege leave. Prior approval mandatory. Carry-forward credited on Apr 1.'],
    ['CL (Casual Leave)', '12 days/year', 'No — Lapses Dec 31', 'No', 'Short-duration informal leave. Maximum 3 consecutive days. Apply day before.'],
    ['SL (Sick Leave)', '12 days/year', 'No — Lapses Dec 31', 'No', 'Medical certificate required for >2 consecutive sick days. No carry-forward.'],
    ['LWP (Leave Without Pay)', 'Unlimited', 'N/A', 'N/A', 'Granted when all paid leave exhausted. Full daily wage deducted per LWP day.'],
    [],
    ['PAYABLE DAYS FORMULA (MUSTER ROLL)'],
    ['Formula', '', '', '', 'P + OD + WO + PL + CL + SL + H + (HD × 0.5) — Absents (A) = 0 payable days'],
    [],
    ['YEAR-END PL ENCASHMENT POLICY'],
    ['Eligibility', '', '', '', 'All active reps with PL balance > 0 at year-end (December 31)'],
    ['Encashment Rate', '', '', '', `₹${dailyWage} per PL day (current daily base wage)`],
    ['Maximum Encashable', '', '', '', `Up to 30 PL days can be encashed in a year`],
    ['Timing', '', '', '', 'Encashment processed in January payroll of following year'],
    ['Taxability', '', '', '', 'PL encashment up to ₹3,00,000 tax-exempt (Sec 10(10AA)) for non-government employees'],
    [],
    ['DISCIPLINARY NOTES'],
    ['Unauthorised Absence', '', '', '', '> 3 consecutive unauthorised absences triggers HR warning. Salary deducted.'],
    ['Leave Abandonment', '', '', '', 'Absence without prior approval or regularization for > 7 days = deemed abandonment.'],
    ['Late Arrivals', '', '', '', '3 late marks in a month = 0.5 day deduction from payable days.'],
    [],
    [`Report generated: ${new Date().toLocaleString('en-IN')} | Year: ${year}`]
  ];

  const wsPolicy = XLSX.utils.aoa_to_sheet(policyData);
  wsPolicy['!cols'] = [{wch:28},{wch:20},{wch:18},{wch:14},{wch:80}];
  wsPolicy['!merges'] = [
    { s:{r:0,c:0}, e:{r:0,c:4} },
    { s:{r:1,c:0}, e:{r:1,c:4} }
  ];
  XLSX.utils.book_append_sheet(wb, wsPolicy, 'Leave Policy & Guidelines');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await triggerDownload(`Bihar_AgTech_Leave_Balance_Report_${year}.xlsx`, blob);
  showToast(`✅ Leave Balance Report exported! ₹${totalEncashment.toLocaleString('en-IN')} encashment liability captured.`, '📊');
}
