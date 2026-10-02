import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import * as XLSX from 'xlsx';

export function openSpeedAuditModal(onComplete) {
  const existing = document.getElementById('speedAuditModal');
  if (existing) existing.remove();

  let policy = storage.getSpeedPolicyConfig();
  let filterRep = 'ALL';
  let filterVehicle = 'all';
  let filterStatus = 'all';

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.id = 'speedAuditModal';
  modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 10000; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px);';

  function renderModalContent() {
    policy = storage.getSpeedPolicyConfig();
    const allBreaches = storage.getSpeedBreachLogs({
      rep: filterRep,
      vehicleMode: filterVehicle,
      warningStatus: filterStatus
    });

    const totalBreaches = allBreaches.length;
    const pendingWarnings = allBreaches.filter(b => !b.warningSent).length;
    const sentWarnings = allBreaches.filter(b => b.warningSent).length;
    const highHazardCount = allBreaches.filter(b => b.severity === 'High Hazard Breach').length;
    const assistants = storage.getAssistants();

    modal.innerHTML = `
      <div class="modal-box" style="width: 95%; max-width: 960px; max-height: 92vh; display: flex; flex-direction: column; background: var(--surface-card); border-radius: var(--radius-lg); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45); border: 1.5px solid rgba(239, 68, 68, 0.3); overflow: hidden; animation: modal-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <!-- Header -->
        <div style="padding: 16px 22px; background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%); color: #fff; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; font-size: 22px;">
              🚨
            </div>
            <div>
              <div style="font-weight: 800; font-size: 17px; font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
                <span>Fleet Speed Governance & Over-Speeding Audits</span>
                <span class="badge" style="background: rgba(255, 255, 255, 0.25); color: #fff; font-size: 11px;">
                  Automatic Breach Telemetry
                </span>
              </div>
              <div style="font-size: 12px; opacity: 0.9; margin-top: 1px;">
                Speed is captured <strong>only when representatives breach the admin threshold</strong>. Send formal warnings directly to rule breakers.
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn btn-secondary btn-sm" id="btnExportSpeedExcel" style="background: rgba(255, 255, 255, 0.2); border: none; color: #fff; font-weight: 700; font-size: 12px;">
              📥 Export Excel
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnCloseSpeedModal" style="background: rgba(255, 255, 255, 0.15); border: none; color: #fff; font-size: 15px; width: 32px; height: 32px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              ✕
            </button>
          </div>
        </div>

        <!-- Scrollable Content Body -->
        <div style="flex: 1; overflow-y: auto; padding: 20px; background: var(--surface-bg); display: flex; flex-direction: column; gap: 18px;">
          
          <!-- KPI Summary Strip -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <div style="background: var(--surface-card); padding: 12px 16px; border-radius: var(--radius-sm); border: 1.5px solid rgba(239, 68, 68, 0.25);">
              <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Total Speed Breaches</div>
              <div style="font-size: 22px; font-weight: 900; color: #dc2626; margin-top: 2px;">${totalBreaches}</div>
              <div style="font-size: 11px; color: var(--muted);">Threshold violations captured</div>
            </div>

            <div style="background: var(--surface-card); padding: 12px 16px; border-radius: var(--radius-sm); border: 1.5px solid rgba(245, 158, 11, 0.3);">
              <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Warnings Pending</div>
              <div style="font-size: 22px; font-weight: 900; color: #d97706; margin-top: 2px;">${pendingWarnings}</div>
              <div style="font-size: 11px; color: var(--muted);">Awaiting supervisory notice</div>
            </div>

            <div style="background: var(--surface-card); padding: 12px 16px; border-radius: var(--radius-sm); border: 1.5px solid rgba(16, 185, 129, 0.3);">
              <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Warnings Dispatched</div>
              <div style="font-size: 22px; font-weight: 900; color: #16a34a; margin-top: 2px;">${sentWarnings}</div>
              <div style="font-size: 11px; color: var(--muted);">Notices delivered to reps</div>
            </div>

            <div style="background: var(--surface-card); padding: 12px 16px; border-radius: var(--radius-sm); border: 1.5px solid rgba(14, 165, 233, 0.3);">
              <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Active Policy Thresholds</div>
              <div style="font-size: 14px; font-weight: 800; color: var(--ink); margin-top: 4px;">
                🏍️ Bike: <strong>${policy.bikeThresholdKmH} km/h</strong> · 🚗 Car: <strong>${policy.carThresholdKmH} km/h</strong>
              </div>
              <div style="font-size: 11px; color: var(--accent); font-weight: 600; cursor: pointer; margin-top: 2px;" id="btnToggleThresholdForm">
                ⚙️ Click to modify thresholds
              </div>
            </div>
          </div>

          <!-- Policy Thresholds Quick Form (Collapsible) -->
          <div id="speedThresholdForm" style="display: none; background: var(--surface-card); padding: 16px 18px; border-radius: var(--radius-sm); border: 1.5px solid rgba(14, 165, 233, 0.4);">
            <div style="font-weight: 800; font-size: 13.5px; color: var(--ink); margin-bottom: 12px; font-family: var(--font-heading); display: flex; align-items: center; justify-content: space-between;">
              <span>⚙️ Adjust Speed Limits & Governance Rules</span>
              <button type="button" class="btn btn-secondary btn-sm" id="btnHideThresholdForm" style="font-size: 11px; padding: 2px 8px;">✕ Close</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 14px;">
              <div>
                <label class="form-label" style="font-weight: 700;">🏍️ Two-Wheeler Limit (km/h) *</label>
                <input type="number" id="iptBikeThreshold" value="${policy.bikeThresholdKmH}" min="20" max="100" class="form-control" style="font-weight: 700;" />
                <div style="font-size: 11px; color: var(--muted); margin-top: 3px;">Speeds above this are logged as bike violations (Default: 60)</div>
              </div>

              <div>
                <label class="form-label" style="font-weight: 700;">🚗 Four-Wheeler Limit (km/h) *</label>
                <input type="number" id="iptCarThreshold" value="${policy.carThresholdKmH}" min="40" max="140" class="form-control" style="font-weight: 700;" />
                <div style="font-size: 11px; color: var(--muted); margin-top: 3px;">Speeds above this are logged as car violations (Default: 80)</div>
              </div>

              <div>
                <label class="form-label" style="font-weight: 700;">Live Monitoring Status</label>
                <select id="selSpeedMonitoring" class="form-control" style="font-weight: 700;">
                  <option value="true" ${policy.speedMonitoringActive ? 'selected' : ''}>🟢 Active (Auto-Capture On)</option>
                  <option value="false" ${!policy.speedMonitoringActive ? 'selected' : ''}>🔴 Paused</option>
                </select>
                <div style="font-size: 11px; color: var(--muted); margin-top: 3px;">Controls whether telemetry breaches are automatically logged</div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" class="btn btn-primary btn-sm" id="btnSaveThresholdSettings" style="font-weight: 700;">
                ✓ Save Speed Limits
              </button>
            </div>
          </div>

          <!-- Supervisory Filters & Simulation Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: var(--surface-card); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 2px;">Representative</label>
                <select id="selFilterRep" class="form-control" style="font-size: 12px; font-weight: 600; padding: 4px 8px;">
                  <option value="ALL">All Representatives</option>
                  ${assistants.map(a => `<option value="${escapeHtml(a.name)}" ${filterRep === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
                </select>
              </div>

              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 2px;">Vehicle Mode</label>
                <select id="selFilterVehicle" class="form-control" style="font-size: 12px; font-weight: 600; padding: 4px 8px;">
                  <option value="all" ${filterVehicle === 'all' ? 'selected' : ''}>All Vehicles</option>
                  <option value="Bike" ${filterVehicle === 'Bike' ? 'selected' : ''}>🏍️ Two-Wheeler (Bike)</option>
                  <option value="Car" ${filterVehicle === 'Car' ? 'selected' : ''}>🚗 Four-Wheeler (Car)</option>
                </select>
              </div>

              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--muted); display: block; margin-bottom: 2px;">Warning Status</label>
                <select id="selFilterStatus" class="form-control" style="font-size: 12px; font-weight: 600; padding: 4px 8px;">
                  <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>All Logs</option>
                  <option value="pending" ${filterStatus === 'pending' ? 'selected' : ''}>⏳ Warning Pending</option>
                  <option value="sent" ${filterStatus === 'sent' ? 'selected' : ''}>📬 Warning Sent</option>
                </select>
              </div>
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btnSimulateBreach" title="Simulate a live speed breach for testing" style="color: #dc2626; border-color: rgba(239, 68, 68, 0.4); font-weight: 700; font-size: 11.5px;">
                ⚡ Simulate Speed Breach (Test)
              </button>
            </div>
          </div>

          <!-- Speed Breach Audit Table -->
          <div class="card" style="padding: 0; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden;">
            <div style="overflow-x: auto;">
              <table class="table" style="width: 100%; font-size: 12.5px; margin: 0;">
                <thead>
                  <tr style="background: var(--surface-bg); border-bottom: 1.5px solid var(--line);">
                    <th style="padding: 10px 14px;">Field Representative</th>
                    <th style="padding: 10px 14px;">Vehicle Mode</th>
                    <th style="padding: 10px 14px;">Recorded vs Limit</th>
                    <th style="padding: 10px 14px;">Excess Speed</th>
                    <th style="padding: 10px 14px;">Location / Sector</th>
                    <th style="padding: 10px 14px;">Date & Time</th>
                    <th style="padding: 10px 14px;">Severity</th>
                    <th style="padding: 10px 14px;">Warning Status</th>
                    <th style="padding: 10px 14px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${allBreaches.length === 0 ? `
                    <tr>
                      <td colspan="9" style="text-align: center; padding: 36px 20px; color: var(--muted);">
                        <div style="font-size: 28px; margin-bottom: 6px;">🛡️</div>
                        <div style="font-weight: 700; font-size: 14px; color: var(--ink);">Zero Over-Speeding Breaches Found</div>
                        <div style="font-size: 12px; margin-top: 2px;">All representatives are operating within permitted speed limits. Speed is automatically logged only upon threshold breach.</div>
                      </td>
                    </tr>
                  ` : allBreaches.map(b => {
                    const isCar = b.vehicleMode === 'Car';
                    const isHazard = b.severity === 'High Hazard Breach';
                    const mapUrl = (b.lat && b.lng) ? `https://www.google.com/maps?q=${b.lat},${b.lng}` : null;

                    return `
                      <tr style="border-bottom: 1px solid var(--line);">
                        <td style="padding: 10px 14px;">
                          <div style="font-weight: 800; color: var(--ink); font-size: 13px;">${escapeHtml(b.rep)}</div>
                        </td>

                        <td style="padding: 10px 14px;">
                          <span class="badge" style="font-size: 11px; font-weight: 700; background: ${isCar ? 'rgba(2, 132, 199, 0.12); color: #0284c7;' : 'rgba(16, 185, 129, 0.12); color: #16a34a;'}">
                            ${isCar ? '🚗 Four-Wheeler' : '🏍️ Two-Wheeler'}
                          </span>
                        </td>

                        <td style="padding: 10px 14px;">
                          <div style="font-weight: 900; font-size: 14px; color: #dc2626;">
                            ${b.recordedSpeedKmH} <span style="font-size: 11px; font-weight: 600;">km/h</span>
                          </div>
                          <div style="font-size: 10.5px; color: var(--muted);">
                            Limit: ${b.thresholdSpeedKmH} km/h
                          </div>
                        </td>

                        <td style="padding: 10px 14px;">
                          <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; font-weight: 800; font-size: 11px;">
                            +${b.excessKmH} km/h Over
                          </span>
                        </td>

                        <td style="padding: 10px 14px;">
                          <div style="font-weight: 600; color: var(--ink); font-size: 12px;">${escapeHtml(b.locationName || b.block)}</div>
                          <div style="font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px;">
                            <span>${escapeHtml(b.block)}, ${escapeHtml(b.district)}</span>
                            ${mapUrl ? `<a href="${mapUrl}" target="_blank" rel="noopener" style="color: var(--accent); text-decoration: none; font-size: 10.5px;">📍 Map</a>` : ''}
                          </div>
                        </td>

                        <td style="padding: 10px 14px;">
                          <div style="font-weight: 700; font-size: 12px;">${escapeHtml(b.time)}</div>
                          <div style="font-size: 10.5px; color: var(--muted);">${escapeHtml(b.date)}</div>
                        </td>

                        <td style="padding: 10px 14px;">
                          <span class="badge" style="background: ${isHazard ? '#fee2e2; color: #dc2626;' : '#fef3c7; color: #d97706;'} font-weight: 800; font-size: 10.5px;">
                            ${isHazard ? '🚨 High Hazard' : '⚠️ Moderate'}
                          </span>
                        </td>

                        <td style="padding: 10px 14px;">
                          ${b.warningSent ? `
                            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #16a34a; font-weight: 800; font-size: 11px;" title="${escapeHtml(b.warningNotice || '')}">
                              ✓ Notice Sent
                            </span>
                          ` : `
                            <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-weight: 800; font-size: 11px;">
                              ⏳ Pending
                            </span>
                          `}
                        </td>

                        <td style="padding: 10px 14px; text-align: right;">
                          ${!b.warningSent ? `
                            <button type="button" class="btn btn-primary btn-sm btn-issue-warning" data-id="${escapeHtml(b.id)}" style="background: #dc2626; border-color: #b91c1c; font-weight: 800; font-size: 11px; padding: 4px 10px; white-space: nowrap;">
                              ⚠️ Issue Warning Notice
                            </button>
                          ` : `
                            <button type="button" class="btn btn-secondary btn-sm btn-view-notice" data-id="${escapeHtml(b.id)}" style="font-size: 11px; padding: 4px 8px;">
                              👁️ View Notice
                            </button>
                          `}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div style="padding: 14px 22px; background: var(--surface-card); border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px;">
            <span>🛡️</span>
            <span>Policy compliance is enforced in real-time via GPS speed telemetry.</span>
          </div>

          <button type="button" class="btn btn-secondary btn-sm" id="btnCloseSpeedModalFooter" style="font-weight: 700;">
            Close
          </button>
        </div>

      </div>
    `;

    bindModalEvents();
  }

  function bindModalEvents() {
    // Close modal
    modal.querySelector('#btnCloseSpeedModal')?.addEventListener('click', () => {
      modal.remove();
      if (onComplete) onComplete();
    });
    modal.querySelector('#btnCloseSpeedModalFooter')?.addEventListener('click', () => {
      modal.remove();
      if (onComplete) onComplete();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        if (onComplete) onComplete();
      }
    });

    // Toggle threshold config form
    const form = modal.querySelector('#speedThresholdForm');
    modal.querySelector('#btnToggleThresholdForm')?.addEventListener('click', () => {
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    modal.querySelector('#btnHideThresholdForm')?.addEventListener('click', () => {
      if (form) form.style.display = 'none';
    });

    // Save Threshold Settings
    modal.querySelector('#btnSaveThresholdSettings')?.addEventListener('click', () => {
      const bikeVal = Number(modal.querySelector('#iptBikeThreshold')?.value) || 60;
      const carVal = Number(modal.querySelector('#iptCarThreshold')?.value) || 80;
      const activeVal = modal.querySelector('#selSpeedMonitoring')?.value === 'true';

      storage.saveSpeedPolicyConfig({
        ...policy,
        bikeThresholdKmH: bikeVal,
        carThresholdKmH: carVal,
        speedMonitoringActive: activeVal
      });

      showToast(`Speed limits updated: Bike ${bikeVal} km/h, Car ${carVal} km/h`, '✅');
      renderModalContent();
    });

    // Filters
    modal.querySelector('#selFilterRep')?.addEventListener('change', (e) => {
      filterRep = e.target.value;
      renderModalContent();
    });
    modal.querySelector('#selFilterVehicle')?.addEventListener('change', (e) => {
      filterVehicle = e.target.value;
      renderModalContent();
    });
    modal.querySelector('#selFilterStatus')?.addEventListener('change', (e) => {
      filterStatus = e.target.value;
      renderModalContent();
    });

    // Simulate Breach (Testing button)
    modal.querySelector('#btnSimulateBreach')?.addEventListener('click', () => {
      const assistants = storage.getAssistants();
      const randomRep = assistants[Math.floor(Math.random() * assistants.length)];
      const mode = storage.getAssistantVehicleMode(randomRep.name);
      const simulatedSpeed = mode === 'Car' ? 96.4 : 76.5;

      const res = storage.recordSpeedBreachIfViolated({
        rep: randomRep.name,
        speedKmH: simulatedSpeed,
        lat: 25.685,
        lng: 85.214,
        block: randomRep.hq || 'Hajipur',
        district: randomRep.district || 'Vaishali',
        locationName: `${randomRep.hq} Highway Corridor`
      });

      if (res.breached) {
        showToast(`Logged over-speeding breach: ${randomRep.name} (${simulatedSpeed} km/h)`, '🚨');
        renderModalContent();
      } else {
        showToast('Speed did not exceed threshold.', 'ℹ️');
      }
    });

    // Export to Excel
    modal.querySelector('#btnExportSpeedExcel')?.addEventListener('click', () => {
      const logs = storage.getSpeedBreachLogs();
      if (logs.length === 0) return showToast('No logs to export.', 'ℹ️');

      const data = logs.map(l => ({
        'Breach ID': l.id,
        'Representative': l.rep,
        'Vehicle Mode': l.vehicleMode,
        'Recorded Speed (km/h)': l.recordedSpeedKmH,
        'Threshold Speed (km/h)': l.thresholdSpeedKmH,
        'Excess Speed (km/h)': l.excessKmH,
        'Severity': l.severity,
        'Block': l.block,
        'District': l.district,
        'Date': l.date,
        'Time': l.time,
        'Warning Sent': l.warningSent ? 'YES' : 'NO',
        'Warning Sent At': l.warningSentAt || 'N/A',
        'Notice Content': l.warningNotice || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Speed Violations');
      XLSX.writeFile(wb, `Bihar_Fleet_Speed_Breaches_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Exported speed violations report!', '📥');
    });

    // Issue Warning Notice button
    modal.querySelectorAll('.btn-issue-warning').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const breach = storage.getSpeedBreachLogs().find(b => b.id === id);
        if (!breach) return;

        const defaultNotice = `OFFICIAL ROAD SAFETY WARNING NOTICE\n\n` +
          `To: ${breach.rep}\n` +
          `Date: ${breach.date} at ${breach.time}\n` +
          `Location: ${breach.locationName || breach.block} (${breach.district})\n\n` +
          `Telemetry Speed Violation Logged:\n` +
          `• Recorded Speed: ${breach.recordedSpeedKmH} km/h\n` +
          `• Permitted Limit: ${breach.thresholdSpeedKmH} km/h for ${breach.vehicleMode === 'Car' ? 'Four-Wheeler' : 'Two-Wheeler'}\n` +
          `• Variance: +${breach.excessKmH} km/h OVER LIMIT (${breach.severity})\n\n` +
          `Notice: Over-speeding is a severe violation of company road safety regulations and travel allowance guidelines. Continued violations will result in travel allowance forfeiture. Adhere strictly to the ${breach.thresholdSpeedKmH} km/h speed threshold.`;

        const userNotice = prompt(
          `Issue Formal Warning Notice to ${breach.rep} (${breach.recordedSpeedKmH} km/h):\n\nYou may customize the notice below:`,
          defaultNotice
        );

        if (userNotice !== null && userNotice.trim()) {
          const res = storage.sendSpeedWarningNotice(id, userNotice.trim());
          if (res.success) {
            showToast(`Warning notice dispatched to ${breach.rep}!`, '⚠️');
            renderModalContent();
          } else {
            showToast(res.error, '❌');
          }
        }
      });
    });

    // View Sent Notice
    modal.querySelectorAll('.btn-view-notice').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const breach = storage.getSpeedBreachLogs().find(b => b.id === id);
        if (!breach) return;

        alert(
          `📬 Warning Notice Details\n` +
          `Dispatched to: ${breach.rep}\n` +
          `Sent At: ${new Date(breach.warningSentAt).toLocaleString()}\n\n` +
          `Content:\n${breach.warningNotice}`
        );
      });
    });
  }

  renderModalContent();
  document.body.appendChild(modal);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
