import { storage } from '../services/storage.js';
import { auth } from '../services/auth.js';
import { showToast } from './toast.js';

let activeLeaveTab = 'apply'; // 'apply' | 'balance' | 'history' | 'calendar'
let leaveCalYear = new Date().getFullYear();
let leaveCalMonth = new Date().getMonth() + 1;

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

export function openLeaveModal(options = {}) {
  const existing = document.getElementById('leaveModal');
  if (existing) existing.remove();

  activeLeaveTab = options.initialTab || 'apply';
  const assignedRep = options.assistant || auth.getAssignedRep();
  const allAssistants = storage.getAssistants();
  const repInfo = allAssistants.find(a => a.name === assignedRep) || allAssistants[0];
  const empMeta = storage.getEmployeeMetadata(repInfo.name);
  const currentYear = new Date().getFullYear();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.id = 'leaveModal';
  modal.style.cssText = 'display:flex; align-items:center; justify-content:center; z-index:9999;';

  function render() {
    const balance = storage.getLeaveBalance(repInfo.name, currentYear);
    const applications = storage.getLeaveApplications({ assistant: repInfo.name });
    const pending = applications.filter(a => a.status === 'Pending').length;

    const tabStyle = (t) => `flex:1; padding:12px 14px; font-weight:700; font-size:12.5px; border:none; background:transparent; cursor:pointer; border-bottom:3px solid ${activeLeaveTab === t ? '#1d4ed8' : 'transparent'}; color:${activeLeaveTab === t ? '#1d4ed8' : 'var(--muted)'}; display:flex; align-items:center; justify-content:center; gap:5px;`;

    let content = '';
    if (activeLeaveTab === 'apply') content = renderApplyTab(repInfo, balance);
    else if (activeLeaveTab === 'balance') content = renderBalanceTab(repInfo, balance, currentYear);
    else if (activeLeaveTab === 'history') content = renderHistoryTab(repInfo, applications);
    else if (activeLeaveTab === 'calendar') content = renderCalendarTab();

    modal.innerHTML = `
      <div class="modal-box" style="width:95%; max-width:820px; max-height:92vh; display:flex; flex-direction:column; background:var(--surface-card); border-radius:var(--radius-lg); box-shadow:0 25px 50px -12px rgba(0,0,0,0.4); border:1px solid var(--line); overflow:hidden; animation:modal-scale-in 0.2s cubic-bezier(0.16,1,0.3,1);">

        <!-- Header -->
        <div style="padding:16px 22px; background:linear-gradient(135deg,#1e3a8a,#1d4ed8 60%,#2563eb); color:#fff; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px; height:42px; border-radius:12px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:22px;">🏖️</div>
            <div>
              <div style="font-weight:800; font-size:16px; font-family:var(--font-heading);">Leave Management System (अवकाश प्रबंधन)</div>
              <div style="font-size:12px; opacity:0.9;">${escapeHtml(repInfo.name)} · ${escapeHtml(empMeta.empCode)} · HQ: ${escapeHtml(repInfo.hq)}</div>
            </div>
          </div>
          <button type="button" id="btnCloseLeaveModal" style="background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:14px; width:34px; height:34px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
        </div>

        <!-- Quick Balance Strip -->
        <div style="display:flex; gap:0; border-bottom:1px solid var(--line); background:var(--surface-alt);">
          ${['PL','CL','SL'].map(t => {
            const b = balance[t];
            const pct = Math.round((b.available / b.opening) * 100) || 0;
            return `<div style="flex:1; padding:8px 14px; border-right:1px solid var(--line); text-align:center;">
              <div style="font-size:11px; color:var(--muted); font-weight:600;">${b.label}</div>
              <div style="font-size:18px; font-weight:800; color:${b.color};">${b.available}<span style="font-size:11px; font-weight:500; color:var(--muted);">/${b.opening}</span></div>
              <div style="height:4px; background:#e2e8f0; border-radius:2px; margin-top:3px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:${b.color}; border-radius:2px; transition:width 0.5s;"></div>
              </div>
            </div>`;
          }).join('')}
          <div style="flex:1; padding:8px 14px; text-align:center;">
            <div style="font-size:11px; color:var(--muted); font-weight:600;">PL Encashable</div>
            <div style="font-size:18px; font-weight:800; color:#059669;">₹${(balance.PL.encashmentValue || 0).toLocaleString('en-IN')}</div>
            <div style="font-size:10px; color:var(--muted); margin-top:3px;">${balance.PL.encashableBalance || 0} days × ₹${storage.getAttendanceSettings().dailyBaseWage || 650}</div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex; border-bottom:1px solid var(--line); background:var(--surface-bg);">
          <button type="button" id="leaveTab_apply" style="${tabStyle('apply')}"><span>📝</span><span>Apply Leave</span></button>
          <button type="button" id="leaveTab_balance" style="${tabStyle('balance')}"><span>📊</span><span>Leave Balance</span></button>
          <button type="button" id="leaveTab_history" style="${tabStyle('history')}"><span>📋</span><span>My History ${pending > 0 ? `<span style="background:#ef4444;color:#fff;border-radius:50%;padding:1px 5px;font-size:9px;margin-left:3px;">${pending}</span>` : ''}</span></button>
          <button type="button" id="leaveTab_calendar" style="${tabStyle('calendar')}"><span>🗓️</span><span>Team Calendar</span></button>
        </div>

        <!-- Content -->
        <div id="leaveModalContent" style="flex:1; overflow-y:auto; padding:18px 20px; background:var(--surface-bg);">
          ${content}
        </div>
      </div>
    `;

    bindEvents();
  }

  function renderApplyTab(repInfo, balance) {
    const today = new Date().toISOString().split('T')[0];
    return `
      <div style="max-width:560px; margin:0 auto;">
        <div class="card" style="padding:20px 24px;">
          <h3 style="font-family:var(--font-heading); font-size:15px; font-weight:800; margin-bottom:16px; color:var(--ink);">📝 Submit Leave Application</h3>
          <form id="leaveApplicationForm" style="display:flex; flex-direction:column; gap:14px;">
            <div class="form-group">
              <label class="form-label">Leave Type *</label>
              <select id="leaveTypeSelect" required style="padding:9px 12px; font-size:13.5px; font-weight:600;">
                <option value="">Select leave type…</option>
                <option value="PL">Paid Leave (वेतन सहित छुट्टी) — ${balance.PL.available} days available</option>
                <option value="CL">Casual Leave (अनौपचारिक छुट्टी) — ${balance.CL.available} days available</option>
                <option value="SL">Sick Leave (बीमारी छुट्टी) — ${balance.SL.available} days available</option>
                <option value="LWP">Leave Without Pay (बिना वेतन) — No balance required</option>
              </select>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">From Date *</label>
                <input type="date" id="leaveFromDate" required min="${today}" value="${today}" style="padding:9px 12px; font-size:13.5px;">
              </div>
              <div class="form-group">
                <label class="form-label">To Date *</label>
                <input type="date" id="leaveToDate" required min="${today}" value="${today}" style="padding:9px 12px; font-size:13.5px;">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Leave Duration</label>
              <div style="display:flex; gap:12px; align-items:center;">
                <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; cursor:pointer;">
                  <input type="radio" name="leaveDuration" value="full" checked> Full Day(s)
                </label>
                <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; cursor:pointer;">
                  <input type="radio" name="leaveDuration" value="half"> Half Day
                </label>
              </div>
              <div id="halfDaySession" style="display:none; margin-top:8px;">
                <select id="leaveSessionSelect" style="padding:7px 10px; font-size:13px;">
                  <option value="morning">Morning Session (First Half)</option>
                  <option value="afternoon">Afternoon Session (Second Half)</option>
                </select>
              </div>
            </div>

            <div id="leaveDaysPreview" style="padding:10px 14px; background:rgba(29,78,216,0.06); border:1px solid rgba(29,78,216,0.2); border-radius:var(--radius-sm); font-size:13px; font-weight:600; color:#1d4ed8; display:none;">
              📅 Leave Duration: <span id="leaveDaysCount">0</span> working day(s)
            </div>

            <div class="form-group">
              <label class="form-label">Reason / Justification *</label>
              <textarea id="leaveReason" required rows="3" placeholder="Please provide a brief reason for your leave request…" style="padding:10px 12px; font-size:13px; resize:vertical;"></textarea>
            </div>

            <div id="leaveFormError" style="color:var(--danger); font-size:12.5px; font-weight:600; min-height:16px;"></div>

            <button type="submit" class="btn btn-primary" id="btnSubmitLeave" style="padding:12px; font-size:14px; font-weight:800;">
              📤 Submit Leave Application
            </button>
          </form>
        </div>
      </div>
    `;
  }

  function renderBalanceTab(repInfo, balance, year) {
    const totalEncashment = balance.PL.encashmentValue || 0;
    const rows = ['PL','CL','SL'].map(t => {
      const b = balance[t];
      const usedPct = b.opening > 0 ? Math.round((b.used / b.opening) * 100) : 0;
      const availPct = b.opening > 0 ? Math.round((b.available / b.opening) * 100) : 0;
      return `
        <div class="card" style="padding:16px 20px; border-left:4px solid ${b.color};">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
            <div>
              <div style="font-weight:800; font-size:14px; color:var(--ink);">${b.label}</div>
              <div style="font-size:11px; color:var(--muted); margin-top:1px;">Annual Entitlement: ${b.annual} days${b.carryForward > 0 ? ` + ${b.carryForward} Carry Forward` : ''}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:26px; font-weight:800; color:${b.color}; font-family:var(--font-heading);">${b.available}</div>
              <div style="font-size:11px; color:var(--muted);">days available</div>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px; text-align:center;">
            <div style="padding:8px; background:rgba(0,0,0,0.03); border-radius:6px;">
              <div style="font-size:18px; font-weight:800; color:var(--ink);">${b.opening}</div>
              <div style="font-size:10px; color:var(--muted);">Opening Balance</div>
            </div>
            <div style="padding:8px; background:rgba(220,38,38,0.05); border-radius:6px;">
              <div style="font-size:18px; font-weight:800; color:#dc2626;">${b.used}</div>
              <div style="font-size:10px; color:var(--muted);">Used</div>
            </div>
            <div style="padding:8px; background:rgba(0,0,0,0.03); border-radius:6px;">
              <div style="font-size:18px; font-weight:800; color:${b.color};">${b.available}</div>
              <div style="font-size:10px; color:var(--muted);">Remaining</div>
            </div>
          </div>
          <div style="height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${availPct}%; background:${b.color}; border-radius:4px; transition:width 0.5s;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--muted); margin-top:3px;">
            <span>0</span><span>${b.available} remaining (${availPct}%)</span><span>${b.opening}</span>
          </div>
          ${t === 'PL' && b.encashableBalance > 0 ? `
            <div style="margin-top:10px; padding:8px 12px; background:rgba(5,150,105,0.08); border:1px solid rgba(5,150,105,0.2); border-radius:6px; font-size:12.5px; font-weight:700; color:#059669;">
              💰 PL Encashment Eligible: ${b.encashableBalance} days = ₹${(b.encashmentValue || 0).toLocaleString('en-IN')} (year-end)
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="card" style="padding:14px 18px; background:linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.04)); border:1px solid rgba(5,150,105,0.25); border-left:4px solid #059669; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Year-End PL Encashment Value (${year})</div>
            <div style="font-size:26px; font-weight:800; color:#059669; font-family:var(--font-heading);">₹${totalEncashment.toLocaleString('en-IN')}</div>
            <div style="font-size:11.5px; color:var(--muted);">${balance.PL.encashableBalance} encashable PL days × ₹${storage.getAttendanceSettings().dailyBaseWage || 650}/day base wage</div>
          </div>
          <div style="font-size:32px; opacity:0.5;">💰</div>
        </div>
        ${rows}
        <div class="card" style="padding:14px 18px; background:rgba(220,38,38,0.04); border:1px solid rgba(220,38,38,0.2); border-left:4px solid #dc2626;">
          <div style="font-weight:700; font-size:13px; color:#dc2626; margin-bottom:6px;">⚠️ Leave Without Pay (LWP)</div>
          <div style="font-size:12.5px; color:var(--muted);">LWP days are deducted directly from your monthly gross wage. Used this year: <strong style="color:#dc2626;">${balance.LWP.used} day(s)</strong> = ₹${(balance.LWP.used * (storage.getAttendanceSettings().dailyBaseWage || 650)).toLocaleString('en-IN')} deducted from payroll.</div>
        </div>
      </div>
    `;
  }

  function renderHistoryTab(repInfo, applications) {
    const statusBg = { Pending: 'rgba(245,158,11,0.1)', Approved: 'rgba(22,163,74,0.1)', Rejected: 'rgba(220,38,38,0.1)', Cancelled: 'rgba(100,116,139,0.1)' };
    const statusFg = { Pending: '#d97706', Approved: '#16a34a', Rejected: '#dc2626', Cancelled: '#64748b' };
    const typeColor = { PL: '#16a34a', CL: '#0284c7', SL: '#db2777', LWP: '#dc2626' };

    if (applications.length === 0) {
      return `<div style="text-align:center; padding:40px 20px; color:var(--muted);">
        <div style="font-size:36px; margin-bottom:8px;">📭</div>
        <div style="font-weight:700; font-size:14px;">No leave applications yet</div>
        <div style="font-size:12px; margin-top:4px;">Your submitted leave requests will appear here</div>
      </div>`;
    }

    return `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${applications.map(app => `
          <div class="card" style="padding:14px 18px; border-left:4px solid ${typeColor[app.leaveType] || '#94a3b8'};">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <div style="flex:1; min-width:200px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                  <span style="font-weight:800; font-size:13.5px; color:var(--ink);">${escapeHtml(app.leaveLabel)}</span>
                  <span style="padding:2px 8px; border-radius:var(--radius-pill); font-size:10.5px; font-weight:700; background:${statusBg[app.status] || '#f1f5f9'}; color:${statusFg[app.status] || '#64748b'};">${escapeHtml(app.status)}</span>
                </div>
                <div style="font-size:12.5px; color:var(--ink); margin-bottom:2px;">📅 ${escapeHtml(app.fromDate)} to ${escapeHtml(app.toDate)} · <strong>${app.days} day(s)</strong>${app.halfDay ? ' (Half Day)' : ''}</div>
                <div style="font-size:12px; color:var(--muted);">Reason: ${escapeHtml(app.reason)}</div>
                ${app.managerRemarks ? `<div style="font-size:11.5px; color:var(--primary); margin-top:3px;">Manager: "${escapeHtml(app.managerRemarks)}"</div>` : ''}
              </div>
              <div style="text-align:right; font-size:11px; color:var(--muted); white-space:nowrap;">
                Applied: ${escapeHtml(app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('en-IN') : '')}
                ${app.approvedAt ? `<br>Reviewed: ${new Date(app.approvedAt).toLocaleDateString('en-IN')}` : ''}
                ${app.status === 'Pending' ? `<br><button type="button" class="btn btn-secondary btn-sm btn-cancel-leave" data-id="${escapeHtml(app.id)}" style="font-size:11px; color:#dc2626; border-color:rgba(220,38,38,0.3); margin-top:4px;">Cancel</button>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderCalendarTab() {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const daysInMonth = new Date(leaveCalYear, leaveCalMonth, 0).getDate();
    const firstDay = new Date(leaveCalYear, leaveCalMonth - 1, 1).getDay();
    const calData = storage.getLeaveCalendarData(leaveCalYear, leaveCalMonth);
    const assistants = storage.getAssistants();
    const typeColors = { PL: '#dcfce7', CL: '#e0f2fe', SL: '#fce7f3', LWP: '#fee2e2' };
    const typeFg = { PL: '#16a34a', CL: '#0284c7', SL: '#db2777', LWP: '#dc2626' };
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const calCells = [];
    // Empty cells for first week offset
    for (let i = 0; i < firstDay; i++) calCells.push(`<div></div>`);

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(leaveCalYear, leaveCalMonth - 1, d);
      const dateStr = dt.toISOString().split('T')[0];
      const isSun = dt.getDay() === 0;
      const onLeave = calData[dateStr] || [];
      const approvedLeaves = onLeave.filter(l => l.status === 'Approved');
      const pendingLeaves = onLeave.filter(l => l.status === 'Pending');
      const isToday = dateStr === new Date().toISOString().split('T')[0];

      calCells.push(`
        <div style="min-height:72px; padding:4px 6px; border:1px solid var(--line); border-radius:6px; background:${isSun ? 'rgba(245,158,11,0.04)' : 'var(--surface-card)'}; ${isToday ? 'outline:2px solid #2563eb;' : ''}">
          <div style="font-size:12px; font-weight:800; color:${isSun ? '#d97706' : isToday ? '#2563eb' : 'var(--ink)'}; margin-bottom:3px;">${d}</div>
          ${approvedLeaves.slice(0,3).map(l => `
            <div style="font-size:9px; font-weight:700; padding:1px 4px; border-radius:3px; background:${typeColors[l.leaveType] || '#f1f5f9'}; color:${typeFg[l.leaveType] || '#64748b'}; margin-bottom:1px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;" title="${escapeHtml(l.assistant)} — ${escapeHtml(l.leaveLabel)}">
              ${escapeHtml(l.empCode || l.assistant.split(' ')[0])} ${l.halfDay ? '½' : ''}
            </div>
          `).join('')}
          ${pendingLeaves.length > 0 ? `<div style="font-size:9px; color:#d97706; font-weight:700;">+${pendingLeaves.length} pending</div>` : ''}
          ${approvedLeaves.length > 3 ? `<div style="font-size:9px; color:var(--muted);">+${approvedLeaves.length - 3} more</div>` : ''}
        </div>
      `);
    }

    // Rep legend
    const leaveCountByRep = {};
    Object.values(calData).flat().filter(l => l.status === 'Approved').forEach(l => {
      if (!leaveCountByRep[l.assistant]) leaveCountByRep[l.assistant] = { count: 0, empCode: l.empCode };
      leaveCountByRep[l.assistant].count++;
    });

    return `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <!-- Month Navigator -->
        <div class="card" style="padding:12px 18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <button type="button" id="btnLeaveCalPrev" class="btn btn-secondary btn-sm" style="font-weight:700;">← Prev</button>
            <div style="font-weight:800; font-size:15px; font-family:var(--font-heading); color:var(--ink);">${monthNames[leaveCalMonth - 1]} ${leaveCalYear}</div>
            <button type="button" id="btnLeaveCalNext" class="btn btn-secondary btn-sm" style="font-weight:700;">Next →</button>
          </div>
          <div style="display:flex; gap:8px; font-size:11px; flex-wrap:wrap;">
            ${Object.entries(typeColors).map(([t, bg]) => `
              <span style="display:inline-flex; align-items:center; gap:4px;">
                <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:${bg};"></span>
                <span style="color:var(--muted);">${t}</span>
              </span>
            `).join('')}
          </div>
        </div>

        <!-- Calendar Grid -->
        <div class="card" style="padding:14px; overflow:hidden;">
          <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:6px;">
            ${dayNames.map(d => `<div style="text-align:center; font-size:11px; font-weight:700; color:${d==='Sun'?'#d97706':'var(--muted)'}; padding:4px 0;">${d}</div>`).join('')}
          </div>
          <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">
            ${calCells.join('')}
          </div>
        </div>

        <!-- Who's on Leave This Month -->
        <div class="card" style="padding:14px 18px;">
          <div style="font-weight:700; font-size:13px; margin-bottom:10px; color:var(--ink);">🏖️ On Leave This Month</div>
          ${Object.keys(leaveCountByRep).length === 0
            ? `<div style="color:var(--muted); font-size:12.5px;">No approved leaves in ${monthNames[leaveCalMonth-1]} ${leaveCalYear}.</div>`
            : Object.entries(leaveCountByRep).map(([asst, info]) => {
                const apps = storage.getLeaveApplications({ assistant: asst, status: 'Approved', year: leaveCalYear });
                return `<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--line);">
                  <div style="width:32px; height:32px; border-radius:8px; background:var(--primary-subtle); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800;">${escapeHtml(info.empCode || 'N').slice(-3)}</div>
                  <div style="flex:1;">
                    <div style="font-weight:700; font-size:12.5px;">${escapeHtml(asst)}</div>
                    <div style="font-size:11px; color:var(--muted);">${info.count} leave day(s) this month</div>
                  </div>
                </div>`;
              }).join('')
          }
        </div>
      </div>
    `;
  }

  function bindEvents() {
    modal.querySelector('#btnCloseLeaveModal')?.addEventListener('click', () => { modal.remove(); });
    modal.querySelector('#leaveTab_apply')?.addEventListener('click', () => { activeLeaveTab = 'apply'; render(); });
    modal.querySelector('#leaveTab_balance')?.addEventListener('click', () => { activeLeaveTab = 'balance'; render(); });
    modal.querySelector('#leaveTab_history')?.addEventListener('click', () => { activeLeaveTab = 'history'; render(); });
    modal.querySelector('#leaveTab_calendar')?.addEventListener('click', () => { activeLeaveTab = 'calendar'; render(); });

    // Close on backdrop click
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Leave application form logic
    const form = modal.querySelector('#leaveApplicationForm');
    const fromInput = modal.querySelector('#leaveFromDate');
    const toInput = modal.querySelector('#leaveToDate');
    const durationRadios = modal.querySelectorAll('input[name="leaveDuration"]');
    const halfDaySection = modal.querySelector('#halfDaySession');
    const preview = modal.querySelector('#leaveDaysPreview');
    const daysCount = modal.querySelector('#leaveDaysCount');

    const calcWorkingDays = (from, to) => {
      let count = 0;
      for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0) count++;
      }
      return count;
    };

    const updatePreview = () => {
      const from = fromInput?.value, to = toInput?.value;
      const isHalf = modal.querySelector('input[name="leaveDuration"]:checked')?.value === 'half';
      if (from && to && from <= to) {
        const days = isHalf ? 0.5 : calcWorkingDays(from, to);
        if (daysCount) daysCount.textContent = days;
        if (preview) preview.style.display = 'block';
      }
    };

    fromInput?.addEventListener('change', updatePreview);
    toInput?.addEventListener('change', updatePreview);
    durationRadios.forEach(r => r.addEventListener('change', () => {
      const isHalf = r.value === 'half';
      if (halfDaySection) halfDaySection.style.display = isHalf ? 'block' : 'none';
      if (isHalf && toInput && fromInput) toInput.value = fromInput.value;
      updatePreview();
    }));

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const errEl = modal.querySelector('#leaveFormError');
      const leaveType = modal.querySelector('#leaveTypeSelect').value;
      const fromDate = fromInput?.value;
      const toDate = toInput?.value;
      const reason = modal.querySelector('#leaveReason').value.trim();
      const isHalf = modal.querySelector('input[name="leaveDuration"]:checked')?.value === 'half';
      const session = modal.querySelector('#leaveSessionSelect')?.value || 'full';

      if (!leaveType) { if (errEl) errEl.textContent = 'Please select a leave type.'; return; }
      if (!fromDate || !toDate) { if (errEl) errEl.textContent = 'Please select leave dates.'; return; }
      if (fromDate > toDate) { if (errEl) errEl.textContent = 'From date cannot be after To date.'; return; }
      if (!reason) { if (errEl) errEl.textContent = 'Please provide a reason for your leave.'; return; }

      const days = isHalf ? 0.5 : calcWorkingDays(fromDate, toDate);
      if (days === 0) { if (errEl) errEl.textContent = 'No working days in the selected range (Sundays excluded).'; return; }

      const result = storage.applyForLeave({ assistant: repInfo.name, leaveType, fromDate, toDate, reason, days, halfDay: isHalf, session });

      if (result.success) {
        showToast(`✅ Leave application submitted! Pending manager approval.`, '📤');
        activeLeaveTab = 'history';
        render();
      } else {
        if (errEl) errEl.textContent = result.error || 'Failed to submit leave application.';
      }
    });

    // Cancel leave
    modal.querySelectorAll('.btn-cancel-leave').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Cancel this leave application?')) {
          storage.reviewLeaveApplication(id, 'Cancelled', 'Cancelled by employee.');
          showToast('Leave application cancelled.', 'ℹ️');
          render();
        }
      });
    });

    // Leave calendar navigation
    modal.querySelector('#btnLeaveCalPrev')?.addEventListener('click', () => {
      leaveCalMonth--;
      if (leaveCalMonth < 1) { leaveCalMonth = 12; leaveCalYear--; }
      render();
    });
    modal.querySelector('#btnLeaveCalNext')?.addEventListener('click', () => {
      leaveCalMonth++;
      if (leaveCalMonth > 12) { leaveCalMonth = 1; leaveCalYear++; }
      render();
    });
  }

  document.body.appendChild(modal);
  render();
}
