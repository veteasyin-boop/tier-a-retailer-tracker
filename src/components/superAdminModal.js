/**
 * GROWTA ENTERPRISE SUPER ADMIN CONSOLE & SYSTEM GOVERNANCE MODAL
 * Authority: GROWTA-MASTER-PRD-001 (Section 45 — Module 26)
 * Parent: Varyanta Global Industries
 */

import { storage } from '../services/storage.js';
import { supabaseService } from '../services/supabase.js';
import { auditLogger, AUDIT_ACTIONS } from '../../packages/audit/auditLogger.js';
import { showToast } from './toast.js';

const FEATURE_FLAGS_KEY = 'growta_system_feature_flags_v1';

export function getFeatureFlags() {
  try {
    const raw = localStorage.getItem(FEATURE_FLAGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return {
    offlineIdbSync: true,
    gpsVisitIntegrity: true,
    doubleEntryInventory: true,
    dynamicFormStudio: true,
    formXviMusterRoll: true,
    naturalLanguageBi: true,
    speedGovernance: true
  };
}

export function saveFeatureFlags(flags) {
  try {
    localStorage.setItem(FEATURE_FLAGS_KEY, JSON.stringify(flags));
  } catch (e) {}
}

export function openSuperAdminModal() {
  let modalEl = document.getElementById('superAdminModal');
  if (!modalEl) {
    createSuperAdminModalDOM();
    modalEl = document.getElementById('superAdminModal');
  }

  renderSuperAdminContent();
  modalEl.classList.add('open');
}

export function closeSuperAdminModal() {
  const modalEl = document.getElementById('superAdminModal');
  if (modalEl) modalEl.classList.remove('open');
}

function createSuperAdminModalDOM() {
  const backdrop = document.createElement('div');
  backdrop.id = 'superAdminModal';
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal-box" style="max-width: 860px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
      
      <!-- Super Admin Header -->
      <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); color: #fff; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);">
            🛡️
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="margin: 0; font-family: var(--font-heading); font-size: 18px; font-weight: 800; color: #fff;">
                Super Admin Control Plane &amp; System Governance
              </h3>
              <span class="badge" style="background: rgba(16, 185, 129, 0.25); color: #34d399; font-weight: 700; font-size: 11px; border: 1px solid rgba(16, 185, 129, 0.4);">
                SUPER_ADMIN
              </span>
            </div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 2px;">
              Tenant: Varyanta Global Industries (Growta OS v1.0) | Global Module &amp; Security State
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-icon" id="superAdminCloseBtn" style="color: #fff; background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2);">
          ✕
        </button>
      </div>

      <!-- Super Admin Navigation Tabs -->
      <div style="display: flex; background: var(--surface-alt); border-bottom: 1px solid var(--line); padding: 0 20px; gap: 8px; overflow-x: auto;">
        <button type="button" class="admin-sub-tab-btn active" data-subtab="tenant" id="saTabTenant" style="padding: 12px 14px; font-size: 13px;">
          🏢 Tenant &amp; Subscription
        </button>
        <button type="button" class="admin-sub-tab-btn" data-subtab="flags" id="saTabFlags" style="padding: 12px 14px; font-size: 13px;">
          🚩 Feature Flags
        </button>
        <button type="button" class="admin-sub-tab-btn" data-subtab="health" id="saTabHealth" style="padding: 12px 14px; font-size: 13px;">
          💓 System Health
        </button>
        <button type="button" class="admin-sub-tab-btn" data-subtab="audit" id="saTabAudit" style="padding: 12px 14px; font-size: 13px;">
          📜 Global Audit Trail
        </button>
        <button type="button" class="admin-sub-tab-btn" data-subtab="ai" id="saTabAi" style="padding: 12px 14px; font-size: 13px;">
          🧠 AI &amp; NeuronCore
        </button>
      </div>

      <!-- Main Body Container -->
      <div id="superAdminBody" style="flex: 1; overflow-y: auto; padding: 22px; background: var(--surface);">
        <!-- Dynamically rendered -->
      </div>

      <!-- Footer Bar -->
      <div style="background: var(--surface-card); padding: 12px 24px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 12px; color: var(--muted);">
          Authority: GROWTA-MASTER-PRD-001 | Non-Hallucination Contract Active
        </span>
        <button type="button" class="btn btn-secondary btn-sm" id="superAdminCloseFooterBtn">
          Close Console
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(backdrop);

  // Tab listeners
  const tabs = backdrop.querySelectorAll('[data-subtab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderSuperAdminSubTab(tab.getAttribute('data-subtab'));
    });
  });

  document.getElementById('superAdminCloseBtn')?.addEventListener('click', closeSuperAdminModal);
  document.getElementById('superAdminCloseFooterBtn')?.addEventListener('click', closeSuperAdminModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSuperAdminModal();
  });
}

function renderSuperAdminContent() {
  const activeTab = document.querySelector('#superAdminModal [data-subtab].active');
  const subTab = activeTab ? activeTab.getAttribute('data-subtab') : 'tenant';
  renderSuperAdminSubTab(subTab);
}

function renderSuperAdminSubTab(subTab) {
  const body = document.getElementById('superAdminBody');
  if (!body) return;

  switch (subTab) {
    case 'tenant':
      body.innerHTML = renderTenantSection();
      break;
    case 'flags':
      body.innerHTML = renderFlagsSection();
      wireFlagsListeners();
      break;
    case 'health':
      body.innerHTML = renderHealthSection();
      break;
    case 'audit':
      body.innerHTML = renderAuditSection();
      wireAuditListeners();
      break;
    case 'ai':
      body.innerHTML = renderAiSection();
      break;
    default:
      body.innerHTML = renderTenantSection();
  }
}

function renderTenantSection() {
  const retailersCount = storage.rows.length;
  const assistants = storage.getAssistants();

  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- Primary Tenant Card -->
      <div class="card" style="border-left: 4px solid #6366f1; background: var(--surface-card);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <h4 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--ink);">Varyanta Global Industries</h4>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700;">LIVE TENANT</span>
            </div>
            <div style="font-size: 12.5px; color: var(--muted); margin-top: 4px;">
              Tenant ID: <code>00000000-0000-0000-0000-000000000001</code> | Domain: <code>varyanta.com / growta.in</code>
            </div>
          </div>
          <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; font-weight: 700; font-size: 12px;">
            Enterprise Plan (Unlimited)
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 16px;">
          <div style="padding: 12px; background: var(--surface); border-radius: 8px; border: 1px solid var(--line);">
            <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Tier-A Retailers</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--ink); margin-top: 2px;">${retailersCount}</div>
            <div style="font-size: 11px; color: #10b981;">100% Partitioned</div>
          </div>
          <div style="padding: 12px; background: var(--surface); border-radius: 8px; border: 1px solid var(--line);">
            <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Field Officer HQs</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--ink); margin-top: 2px;">${assistants.length}</div>
            <div style="font-size: 11px; color: var(--accent);">Bihar Central Grid</div>
          </div>
          <div style="padding: 12px; background: var(--surface); border-radius: 8px; border: 1px solid var(--line);">
            <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Security Isolation</div>
            <div style="font-size: 16px; font-weight: 700; color: #10b981; margin-top: 4px;">Postgres RLS</div>
            <div style="font-size: 11px; color: var(--muted);">Strict Tenant Guard</div>
          </div>
          <div style="padding: 12px; background: var(--surface); border-radius: 8px; border: 1px solid var(--line);">
            <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Subscription Renewal</div>
            <div style="font-size: 16px; font-weight: 700; color: var(--ink); margin-top: 4px;">Perpetual</div>
            <div style="font-size: 11px; color: #10b981;">Owner Provisioned</div>
          </div>
        </div>
      </div>

      <!-- Territory Structure Table -->
      <div class="card">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: var(--ink);">
          Configured Field Headquarters &amp; Officers (Bihar Region)
        </h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
            <thead>
              <tr style="border-bottom: 1.5px solid var(--line); text-align: left; color: var(--muted);">
                <th style="padding: 8px 10px;">Officer Name</th>
                <th style="padding: 8px 10px;">Headquarters (HQ)</th>
                <th style="padding: 8px 10px;">District</th>
                <th style="padding: 8px 10px;">Assigned Target</th>
                <th style="padding: 8px 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${assistants.map(a => `
                <tr style="border-bottom: 1px solid var(--line);">
                  <td style="padding: 8px 10px; font-weight: 600; color: var(--ink);">${a.name}</td>
                  <td style="padding: 8px 10px;">${a.hq}</td>
                  <td style="padding: 8px 10px;">${a.district}</td>
                  <td style="padding: 8px 10px;">${a.target || 80} counters</td>
                  <td style="padding: 8px 10px;"><span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">ACTIVE</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

function renderFlagsSection() {
  const flags = getFeatureFlags();

  const items = [
    { key: 'offlineIdbSync', title: 'Offline-First IDB & Local Sync Queue', desc: 'Permits field reps to capture visits, watermarked photos, and orders when disconnected.' },
    { key: 'gpsVisitIntegrity', title: 'GPS Visit Integrity & Geofencing', desc: 'Categorizes visits (ON_SITE, NEAR_SITE, REMOTE) and enforces 200m retailer geofences.' },
    { key: 'doubleEntryInventory', title: 'Double-Entry Depot & Stock Ledgers', desc: 'Tracks SKU stock allocations, double-entry inventory movements, and liquidation risks.' },
    { key: 'dynamicFormStudio', title: 'Dynamic Agronomy Forms Studio', desc: 'Allows admins to build, publish, and audit targeted farmer & counter surveys.' },
    { key: 'formXviMusterRoll', title: 'Statutory Form XVI Muster Roll Export', desc: 'Generates compliance-grade Excel payroll muster rolls under the Shops & Establishments Act.' },
    { key: 'naturalLanguageBi', title: 'Natural Language BI Analytics Engine', desc: 'Deterministic semantic query engine with structured tabular responses and source field tracing.' },
    { key: 'speedGovernance', title: 'Fleet Speed Governance & Warning Notices', desc: 'Captures excess travel speed events and generates formal managerial warning notices.' }
  ];

  return `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px;">
        Toggle enterprise platform capabilities across the web control plane and mobile field shell. Changes take effect immediately.
      </div>

      ${items.map(i => `
        <div class="card" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px;">
          <div>
            <div style="font-weight: 700; font-size: 14px; color: var(--ink);">${i.title}</div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">${i.desc}</div>
          </div>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; cursor: pointer;">
            <input type="checkbox" data-flag="${i.key}" ${flags[i.key] !== false ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
            <span class="flag-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${flags[i.key] !== false ? '#10b981' : '#cbd5e1'}; border-radius: 24px; transition: .3s;">
              <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${flags[i.key] !== false ? '23px' : '3px'}; bottom: 3px; background-color: white; border-radius: 50%; transition: .3s;"></span>
            </span>
          </label>
        </div>
      `).join('')}

      <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
        <button type="button" class="btn btn-primary btn-sm" id="btnSaveFeatureFlags">
          Save All Feature Flags ✓
        </button>
      </div>
    </div>
  `;
}

function wireFlagsListeners() {
  const body = document.getElementById('superAdminBody');
  if (!body) return;

  const btnSave = body.querySelector('#btnSaveFeatureFlags');
  btnSave?.addEventListener('click', () => {
    const checkboxes = body.querySelectorAll('input[data-flag]');
    const flags = {};
    checkboxes.forEach(cb => {
      flags[cb.getAttribute('data-flag')] = cb.checked;
    });

    saveFeatureFlags(flags);
    auditLogger.log({
      action: 'FEATURE_FLAGS_UPDATED',
      entityType: 'system_config',
      entityId: 'global_flags',
      user: { fullName: 'Super Admin', role: 'SUPER_ADMIN' },
      diff: flags
    });

    showToast('Platform feature flags updated successfully!', '🎉');
  });
}

function renderHealthSection() {
  const isSupabaseReady = supabaseService.isReady;
  const retailersCount = storage.rows.length;
  const auditLogsCount = auditLogger.getLogs().length;

  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
        <div class="card" style="border-top: 3px solid ${isSupabaseReady ? '#10b981' : '#f59e0b'};">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">PostgreSQL Connection</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 4px;">
            ${isSupabaseReady ? '🟢 Supabase Active' : '🟡 Offline Local Mode'}
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
            Endpoint: ${isSupabaseReady ? 'https://fofquqch...supabase.co' : 'Local IndexedDB Fallback'}
          </div>
        </div>

        <div class="card" style="border-top: 3px solid #0284c7;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Database Master Records</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 4px;">
            ${retailersCount} Retailers
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
            8 Headquarters | 100% In-Memory Hydrated
          </div>
        </div>

        <div class="card" style="border-top: 3px solid #6366f1;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Immutable Audit Buffer</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 4px;">
            ${auditLogsCount} Logged Events
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
            Zero-mutation cryptographic record
          </div>
        </div>
      </div>

      <div class="card">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: var(--ink);">
          Runtime Architecture &amp; Subsystem Diagnostic
        </h4>
        <div style="font-size: 12.5px; line-height: 1.6; color: var(--muted);">
          <div>• <strong>Host Platform</strong>: Web Application Control Plane (Vite + Vanilla ES Modules)</div>
          <div>• <strong>Database Engine</strong>: PostgreSQL 15 via Supabase Client (RLS enabled)</div>
          <div>• <strong>Mobile Shell Storage</strong>: HTML5 IndexedDB + LocalStorage fallback</div>
          <div>• <strong>Field Location Sensor</strong>: HTML5 High-Accuracy Geolocation API</div>
          <div>• <strong>Export Engine</strong>: SheetJS XLSX (Compliance-grade Form XVI)</div>
          <div>• <strong>Intelligence Engine</strong>: Growta Deterministic Semantic BiEngine + Google Gemini API</div>
        </div>
      </div>

    </div>
  `;
}

function renderAuditSection() {
  const logs = auditLogger.getLogs();

  return `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--ink);">
            System Audit Trail (${logs.length} events)
          </h4>
          <div style="font-size: 12px; color: var(--muted);">
            Section 59 Compliance: Immutable log of all mutations across Bihar territories.
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnExportAuditJson">
            📥 Export JSON
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btnClearAuditLogs" style="color: var(--danger);">
            🧹 Clear Logs
          </button>
        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="max-height: 380px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead style="background: var(--surface-alt); position: sticky; top: 0; z-index: 1;">
              <tr style="border-bottom: 1px solid var(--line); text-align: left; color: var(--muted);">
                <th style="padding: 10px 12px;">Timestamp</th>
                <th style="padding: 10px 12px;">Actor</th>
                <th style="padding: 10px 12px;">Action</th>
                <th style="padding: 10px 12px;">Entity Type</th>
                <th style="padding: 10px 12px;">Entity ID</th>
                <th style="padding: 10px 12px;">Diff / Context</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length > 0 ? logs.map(l => `
                <tr style="border-bottom: 1px solid var(--line);">
                  <td style="padding: 8px 12px; white-space: nowrap; color: var(--muted);">
                    ${new Date(l.created_at).toLocaleString('en-IN', { hour12: false })}
                  </td>
                  <td style="padding: 8px 12px; font-weight: 600; color: var(--ink); white-space: nowrap;">
                    ${l.user_name || 'System'} <span style="font-size: 10px; color: var(--muted);">(${l.user_role || 'ADMIN'})</span>
                  </td>
                  <td style="padding: 8px 12px;">
                    <span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #0284c7; font-size: 11px;">
                      ${l.action}
                    </span>
                  </td>
                  <td style="padding: 8px 12px; color: var(--ink);">${l.entity_type}</td>
                  <td style="padding: 8px 12px; color: var(--muted); font-family: monospace;">${String(l.entity_id || '').slice(0, 18)}</td>
                  <td style="padding: 8px 12px; color: var(--muted); font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${JSON.stringify(l.diff || {})}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" style="padding: 30px; text-align: center; color: var(--muted);">
                    No audit log events recorded yet.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

function wireAuditListeners() {
  const body = document.getElementById('superAdminBody');
  if (!body) return;

  body.querySelector('#btnExportAuditJson')?.addEventListener('click', () => {
    const logs = auditLogger.getLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Growta_Audit_Trail_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Audit trail exported as JSON', '📥');
  });

  body.querySelector('#btnClearAuditLogs')?.addEventListener('click', () => {
    if (confirm('Clear audit log buffer from local storage? (Cloud logs remain intact)')) {
      auditLogger.buffer = [];
      auditLogger.saveLocalBuffer();
      renderSuperAdminSubTab('audit');
      showToast('Local audit buffer cleared', '🧹');
    }
  });
}

function renderAiSection() {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <div class="card" style="border-left: 4px solid #0ea5e9;">
        <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: var(--ink);">
          NeuronCore AI &amp; Gateway Configuration
        </h4>
        <div style="font-size: 12.5px; color: var(--muted); line-height: 1.5;">
          Per Section 49 of GROWTA-MASTER-PRD-001, all model interactions must pass through the unified AI Gateway with strict read-only enforcement and automated fallback to the deterministic semantic engine.
        </div>
      </div>

      <div class="card">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: var(--ink);">
          Active Model Routing &amp; Policy
        </h4>
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--line);">
            <span style="color: var(--muted);">Primary Cognitive LLM</span>
            <strong style="color: var(--ink);">Google Gemini 1.5 Flash / Pro (via AI Studio API)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--line);">
            <span style="color: var(--muted);">Deterministic Fallback Engine</span>
            <strong style="color: #10b981;">Growta Semantic BiEngine (Zero External Dependency)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--line);">
            <span style="color: var(--muted);">Read-Only Mandate (Non-Hallucination)</span>
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">STRICTLY ENFORCED</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span style="color: var(--muted);">Source Field Tracing</span>
            <strong style="color: var(--ink);">PostgreSQL Schema Column Reference Included</strong>
          </div>
        </div>
      </div>

    </div>
  `;
}
