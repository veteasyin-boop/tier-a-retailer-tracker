import { storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils/geo.js';

export function openTadaPolicyModal(onComplete) {
  const existing = document.getElementById('tadaPolicyModal');
  if (existing) existing.remove();

  const policy = storage.getTadaPolicyConfig();
  const speedPolicy = storage.getSpeedPolicyConfig();
  const allAssistants = storage.getAssistants();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop open';
  modal.id = 'tadaPolicyModal';
  modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 10000; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px);';

  modal.innerHTML = `
    <div class="modal-box" style="width: 95%; max-width: 820px; max-height: 92vh; display: flex; flex-direction: column; background: var(--surface-card); border-radius: var(--radius-lg); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); border: 1px solid var(--line); overflow: hidden; animation: modal-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
      
      <!-- Header -->
      <div style="padding: 16px 22px; background: linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%); color: #fff; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            ⚙️
          </div>
          <div>
            <div style="font-weight: 800; font-size: 16.5px; font-family: var(--font-heading); display: flex; align-items: center; gap: 8px;">
              <span>TA/DA Policy & Rate Matrix Settings</span>
              <span class="badge" style="background: rgba(255, 255, 255, 0.22); color: #fff; font-size: 11px;">
                State Operations
              </span>
            </div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 1px;">
              Configure fuel allowances per km for Bike & Car, daily allowances, night stay rates, and assistant defaults.
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-sm" id="btnClosePolicyModal" style="background: rgba(255, 255, 255, 0.15); border: none; color: #fff; font-size: 14px; width: 32px; height: 32px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ✕
        </button>
      </div>

      <!-- Scrollable Form Body -->
      <div style="flex: 1; overflow-y: auto; padding: 20px; background: var(--surface-bg); display: flex; flex-direction: column; gap: 18px;">
        
        <!-- SECTION 1: Mileage Rates (Bike vs Car) -->
        <div class="card" style="padding: 16px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: var(--primary); letter-spacing: 0.05em; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <span>⛽ Vehicle Fuel Reimbursement Rates (₹ / km)</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
            <div style="padding: 12px 14px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1.5px solid rgba(16, 185, 129, 0.3);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <label style="font-weight: 800; font-size: 13px; color: var(--ink); display: flex; align-items: center; gap: 6px;">
                  <span>🏍️ Motorbike Rate</span>
                </label>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #16a34a; font-size: 11px;">Standard 2-Wheeler</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 15px; font-weight: 800; color: var(--ink);">₹</span>
                <input type="number" id="iptBikeFuelRate" class="form-control" value="${policy.bikeFuelRatePerKm || 4.50}" step="0.25" min="1" max="50" style="font-size: 16px; font-weight: 900; color: var(--primary); width: 110px;" />
                <span style="font-size: 12px; color: var(--muted); font-weight: 600;">/ km traveled</span>
              </div>
              <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Applied to road distance verified by chronological GPS telemetry check-ins.</div>
            </div>

            <div style="padding: 12px 14px; background: var(--surface-bg); border-radius: var(--radius-sm); border: 1.5px solid rgba(2, 132, 199, 0.3);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <label style="font-weight: 800; font-size: 13px; color: var(--ink); display: flex; align-items: center; gap: 6px;">
                  <span>🚗 4-Wheeler / Car Rate</span>
                </label>
                <span class="badge" style="background: rgba(2, 132, 199, 0.15); color: #0284c7; font-size: 11px;">Car / Utility Vehicle</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 15px; font-weight: 800; color: var(--ink);">₹</span>
                <input type="number" id="iptCarFuelRate" class="form-control" value="${policy.carFuelRatePerKm || 9.50}" step="0.25" min="1" max="100" style="font-size: 16px; font-weight: 900; color: #0284c7; width: 110px;" />
                <span style="font-size: 12px; color: var(--muted); font-weight: 600;">/ km traveled</span>
              </div>
              <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Standard rate when representative travels in company/personal car.</div>
            </div>
          </div>
        </div>

        <!-- FLEET SAFETY & SPEED THRESHOLD GOVERNANCE -->
        <div class="card" style="padding: 16px 18px; background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #dc2626; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
              <span>🚨 Fleet Speed Limit Thresholds & Auto-Capture Governance</span>
            </div>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--ink); cursor: pointer;">
              <input type="checkbox" id="chkSpeedMonitoringEnabled" ${speedPolicy.enabled !== false ? 'checked' : ''} />
              <span>Enable Automatic Breach Detection</span>
            </label>
          </div>
          <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 12px; line-height: 1.5;">
            Speeds are <strong>automatically logged ONLY when representatives breach these limits</strong> during transit or check-ins. Rule breakers will be flagged for management to issue formal warning notices.
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
            <div style="background: var(--surface-card); padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <label style="font-size: 12px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span>🏍️ Two-Wheeler / Bike Speed Limit</span>
              </label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" id="iptBikeSpeedLimit" class="form-control" value="${speedPolicy.bikeMaxSpeedKmH || 60}" min="20" max="150" step="5" style="font-weight: 900; font-size: 15px; color: #dc2626; width: 100px;" />
                <span style="font-size: 12px; font-weight: 700; color: var(--muted);">km/h threshold</span>
              </div>
              <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px;">Bihar state highway safety recommendation: 50-60 km/h.</div>
            </div>

            <div style="background: var(--surface-card); padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <label style="font-size: 12px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span>🚗 Four-Wheeler / Car Speed Limit</span>
              </label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" id="iptCarSpeedLimit" class="form-control" value="${speedPolicy.carMaxSpeedKmH || 80}" min="30" max="180" step="5" style="font-weight: 900; font-size: 15px; color: #dc2626; width: 100px;" />
                <span style="font-size: 12px; font-weight: 700; color: var(--muted);">km/h threshold</span>
              </div>
              <div style="font-size: 10.5px; color: var(--muted); margin-top: 4px;">National / state highway safety limit: 70-80 km/h.</div>
            </div>
          </div>
        </div>

        <!-- SECTION 2: Daily Allowance (DA) & Night Allowance -->
        <div class="card" style="padding: 16px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #d97706; letter-spacing: 0.05em; margin-bottom: 12px;">
            🍲 Daily Food Allowance (DA) & Night Halt Rules
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
            <div>
              <label style="font-size: 12px; font-weight: 700; color: var(--ink); display: block; margin-bottom: 4px;">
                Full-Day Field DA (₹)
              </label>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: var(--muted);">₹</span>
                <input type="number" id="iptDaFullDay" class="form-control" value="${policy.daFullDayAmount || 250}" step="10" min="0" max="2000" style="font-weight: 800; font-size: 14px;" />
              </div>
              <div style="font-size: 10.5px; color: var(--muted); margin-top: 3px;">Credited when min visit target is met.</div>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; color: var(--ink); display: block; margin-bottom: 4px;">
                Min Counter Visits For Full DA
              </label>
              <div style="display: flex; align-items: center; gap: 6px;">
                <input type="number" id="iptMinVisitsForFullDa" class="form-control" value="${policy.minVisitsForFullDa || 4}" min="1" max="20" style="font-weight: 800; font-size: 14px; width: 90px;" />
                <span style="font-size: 11.5px; color: var(--muted);">checked-in visits</span>
              </div>
              <div style="font-size: 10.5px; color: var(--muted); margin-top: 3px;">Below this, half-day DA triggers.</div>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; color: var(--ink); display: block; margin-bottom: 4px;">
                Half-Day / Partial DA (₹)
              </label>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: var(--muted);">₹</span>
                <input type="number" id="iptDaHalfDay" class="form-control" value="${policy.daHalfDayAmount || 150}" step="10" min="0" max="1500" style="font-weight: 800; font-size: 14px;" />
              </div>
              <div style="font-size: 10.5px; color: var(--muted); margin-top: 3px;">Credited for 1 to 3 verified counter visits.</div>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; color: var(--ink); display: block; margin-bottom: 4px;">
                Outstation Night Stay Allowance (₹)
              </label>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: var(--muted);">₹</span>
                <input type="number" id="iptNightStay" class="form-control" value="${policy.outstationNightAllowance || 800}" step="50" min="0" max="5000" style="font-weight: 800; font-size: 14px;" />
              </div>
              <div style="font-size: 10.5px; color: var(--muted); margin-top: 3px;">Inter-district overnight hotel/halt allowance.</div>
            </div>
          </div>
        </div>

        <!-- SECTION 3: Field Assistants Default Mode of Transportation -->
        <div class="card" style="padding: 16px 18px; background: var(--surface-card); border: 1px solid var(--line); border-radius: var(--radius-md);">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #7c3aed; letter-spacing: 0.05em; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span>🛵 Assistant Default Mode of Transportation (${allAssistants.length} Reps)</span>
            <span style="font-size: 11px; font-weight: 600; text-transform: none; color: var(--muted);">Rep can also toggle mode when filing specific trip claim</span>
          </div>
          <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 12px;">
            Set each field representative's primary assigned vehicle. Their daily claim calculations will default to this vehicle's per-km rate.
          </div>

          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; font-size: 12px; margin: 0;">
              <thead>
                <tr style="background: var(--surface-bg);">
                  <th style="padding: 8px 10px;">Field Representative</th>
                  <th style="padding: 8px 10px;">Base Station (HQ)</th>
                  <th style="padding: 8px 10px;">District</th>
                  <th style="padding: 8px 10px; width: 220px;">Default Vehicle Mode</th>
                </tr>
              </thead>
              <tbody>
                ${allAssistants.map(asst => {
                  const currentMode = policy.assistantVehicleModes?.[asst.name] || 'Bike';
                  const safeId = 'selMode_' + asst.name.replace(/[^a-zA-Z0-9]/g, '_');
                  return `
                    <tr>
                      <td style="padding: 8px 10px; font-weight: 700; color: var(--ink);">
                        ${escapeHtml(asst.name)}
                      </td>
                      <td style="padding: 8px 10px; color: var(--muted);">
                        ${escapeHtml(asst.hq)}
                      </td>
                      <td style="padding: 8px 10px;">
                        <span class="badge" style="background: var(--surface-bg); font-weight: 600;">
                          ${escapeHtml(asst.district)}
                        </span>
                      </td>
                      <td style="padding: 8px 10px;">
                        <select class="form-control asst-vehicle-mode-sel" data-asst="${escapeHtml(asst.name)}" id="${safeId}" style="font-size: 12px; font-weight: 700; padding: 4px 8px;">
                          <option value="Bike" ${currentMode === 'Bike' ? 'selected' : ''}>🏍️ Motorbike (₹${policy.bikeFuelRatePerKm || 4.50}/km)</option>
                          <option value="Car" ${currentMode === 'Car' ? 'selected' : ''}>🚗 Car / Utility (₹${policy.carFuelRatePerKm || 9.50}/km)</option>
                        </select>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Action Footer -->
      <div style="padding: 14px 22px; background: var(--surface-card); border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnResetPolicyDefaults" style="color: var(--muted); font-size: 11.5px;">
          🔄 Restore Standard Bihar Defaults
        </button>

        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnCancelPolicyModal">
            Cancel
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btnSaveTadaPolicy" style="font-weight: 800; font-size: 13px; padding: 7px 18px; background: #047857; border-color: #065f46; box-shadow: 0 4px 12px rgba(4, 120, 87, 0.3);">
            💾 Save TA/DA Policy Matrix →
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#btnClosePolicyModal')?.addEventListener('click', close);
  modal.querySelector('#btnCancelPolicyModal')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // Restore Defaults
  modal.querySelector('#btnResetPolicyDefaults')?.addEventListener('click', () => {
    if (confirm('Restore standard baseline policy rates (Bike ₹4.50/km, Car ₹9.50/km, Full DA ₹250, Night Stay ₹800, Bike limit 60km/h, Car limit 80km/h)?')) {
      const bikeInput = modal.querySelector('#iptBikeFuelRate');
      const carInput = modal.querySelector('#iptCarFuelRate');
      const daFullInput = modal.querySelector('#iptDaFullDay');
      const daHalfInput = modal.querySelector('#iptDaHalfDay');
      const minVisitsInput = modal.querySelector('#iptMinVisitsForFullDa');
      const nightInput = modal.querySelector('#iptNightStay');
      const bikeSpeedInput = modal.querySelector('#iptBikeSpeedLimit');
      const carSpeedInput = modal.querySelector('#iptCarSpeedLimit');
      const chkSpeed = modal.querySelector('#chkSpeedMonitoringEnabled');

      if (bikeInput) bikeInput.value = 4.50;
      if (carInput) carInput.value = 9.50;
      if (daFullInput) daFullInput.value = 250;
      if (daHalfInput) daHalfInput.value = 150;
      if (minVisitsInput) minVisitsInput.value = 4;
      if (nightInput) nightInput.value = 800;
      if (bikeSpeedInput) bikeSpeedInput.value = 60;
      if (carSpeedInput) carSpeedInput.value = 80;
      if (chkSpeed) chkSpeed.checked = true;
      showToast('Baseline policy rates restored in form.', '🔄');
    }
  });

  // Save Policy
  modal.querySelector('#btnSaveTadaPolicy')?.addEventListener('click', () => {
    const bikeRate = parseFloat(modal.querySelector('#iptBikeFuelRate')?.value) || 4.50;
    const carRate = parseFloat(modal.querySelector('#iptCarFuelRate')?.value) || 9.50;
    const daFull = parseFloat(modal.querySelector('#iptDaFullDay')?.value) || 250;
    const daHalf = parseFloat(modal.querySelector('#iptDaHalfDay')?.value) || 150;
    const minVisits = parseInt(modal.querySelector('#iptMinVisitsForFullDa')?.value, 10) || 4;
    const nightStay = parseFloat(modal.querySelector('#iptNightStay')?.value) || 800;

    const bikeSpeedLimit = parseInt(modal.querySelector('#iptBikeSpeedLimit')?.value, 10) || 60;
    const carSpeedLimit = parseInt(modal.querySelector('#iptCarSpeedLimit')?.value, 10) || 80;
    const speedMonEnabled = modal.querySelector('#chkSpeedMonitoringEnabled')?.checked !== false;

    const modes = {};
    modal.querySelectorAll('.asst-vehicle-mode-sel').forEach(sel => {
      const asstName = sel.getAttribute('data-asst');
      if (asstName) {
        modes[asstName] = sel.value;
      }
    });

    const updatedConfig = {
      ...policy,
      bikeFuelRatePerKm: bikeRate,
      carFuelRatePerKm: carRate,
      daFullDayAmount: daFull,
      daHalfDayAmount: daHalf,
      minVisitsForFullDa: minVisits,
      outstationNightAllowance: nightStay,
      assistantVehicleModes: modes,
      updatedAt: new Date().toISOString()
    };

    storage.saveTadaPolicyConfig(updatedConfig);

    // Save Speed Policy
    storage.saveSpeedPolicyConfig({
      ...speedPolicy,
      bikeMaxSpeedKmH: bikeSpeedLimit,
      carMaxSpeedKmH: carSpeedLimit,
      enabled: speedMonEnabled,
      updatedAt: new Date().toISOString()
    });

    // Broadcast notification to assistants about updated TA/DA & Speed policy
    storage.broadcastNotification({
      title: 'Updated TA/DA Travel & Speed Safety Policy',
      message: `Management updated official policy: Bike ₹${bikeRate}/km (Max ${bikeSpeedLimit} km/h), Car ₹${carRate}/km (Max ${carSpeedLimit} km/h). Auto-logging breaches is active.`,
      type: 'tada'
    });

    showToast('✅ TA/DA Policy Matrix, Speed Thresholds & Vehicle Modes saved!', '🎉');
    modal.remove();
    if (onComplete) onComplete();
  });
}
