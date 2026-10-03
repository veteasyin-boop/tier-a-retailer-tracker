/**
 * GROWTA E2MIS & WORKFLOW AUTOMATION MODAL
 * Authority: GROWTA-MASTER-PRD-001 (Sections 55, 56, 57 — Modules 36, 37, 38)
 * Parent: Varyanta Global Industries
 */

import { e2misEngine } from '../../packages/e2mis/e2misEngine.js';
import { outcomeVault, DECISION_STATES } from '../../packages/neuroncore/outcomeVault.js';
import { workflowEngine, WORKFLOW_STATUS } from '../../packages/workflow/workflowEngine.js';
import { showToast } from './toast.js';
import * as XLSX from 'xlsx';

let currentInspectedSheet = null;
let currentReconciliation = null;

let onUpdateCallback = null;

export function openE2misModal(onUpdate) {
  onUpdateCallback = onUpdate;
  let modalEl = document.getElementById('e2misModal');
  if (!modalEl) {
    createE2misModalDOM();
    modalEl = document.getElementById('e2misModal');
  }

  renderSubTab('e2mis');
  modalEl.classList.add('open');
}

export function closeE2misModal() {
  const modalEl = document.getElementById('e2misModal');
  if (modalEl) modalEl.classList.remove('open');
  if (typeof onUpdateCallback === 'function') {
    try {
      onUpdateCallback();
    } catch (e) {
      console.warn('onUpdateCallback note:', e);
    }
  }
}

function createE2misModalDOM() {
  const backdrop = document.createElement('div');
  backdrop.id = 'e2misModal';
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal-box" style="width: 95vw; max-width: 880px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 0; box-sizing: border-box; margin: auto;">
      
      <!-- Modal Header -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: #fff; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(14, 165, 233, 0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);">
            ⚡
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="margin: 0; font-family: var(--font-heading); font-size: 17px; font-weight: 800; color: #fff;">
                E2MIS, Outcome Vault &amp; Workflow Automation
              </h3>
              <span class="badge" style="background: rgba(14, 165, 233, 0.25); color: #38bdf8; font-weight: 700; font-size: 11px;">
                PRD Modules 36-38
              </span>
            </div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 2px;">
              Excel-to-Module Intelligence · AI Outcome Vault · Versioned Workflows
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-icon" id="e2misCloseBtn" style="color: #fff; background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2);">
          ✕
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; background: var(--surface-alt); border-bottom: 1px solid var(--line); padding: 0 20px; gap: 8px; overflow-x: auto;">
        <button type="button" class="admin-sub-tab-btn active" data-e2mistab="e2mis" id="tabE2misPipeline" style="padding: 12px 14px; font-size: 13px;">
          📊 E2MIS Excel Importer
        </button>
        <button type="button" class="admin-sub-tab-btn" data-e2mistab="vault" id="tabOutcomeVault" style="padding: 12px 14px; font-size: 13px;">
          🏛️ AI Outcome Vault
        </button>
        <button type="button" class="admin-sub-tab-btn" data-e2mistab="workflow" id="tabWorkflows" style="padding: 12px 14px; font-size: 13px;">
          ⚙️ Workflow Engine
        </button>
      </div>

      <!-- Tab Viewport Container -->
      <div id="e2misModalBody" style="flex: 1; overflow-y: auto; padding: 22px; background: var(--surface);">
        <!-- Dynamically rendered -->
      </div>

      <!-- Footer Bar -->
      <div style="background: var(--surface-card); padding: 12px 24px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 12px; color: var(--muted);">
          Rule: Never silently create production records without human validation.
        </span>
        <button type="button" class="btn btn-secondary btn-sm" id="e2misCloseFooterBtn">
          Close
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(backdrop);

  // Tab listeners
  const tabs = backdrop.querySelectorAll('[data-e2mistab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderSubTab(tab.getAttribute('data-e2mistab'));
    });
  });

  document.getElementById('e2misCloseBtn')?.addEventListener('click', closeE2misModal);
  document.getElementById('e2misCloseFooterBtn')?.addEventListener('click', closeE2misModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeE2misModal();
  });
}

function renderSubTab(tabName) {
  const body = document.getElementById('e2misModalBody');
  if (!body) return;

  switch (tabName) {
    case 'e2mis':
      body.innerHTML = renderE2misSection();
      wireE2misListeners();
      break;
    case 'vault':
      body.innerHTML = renderVaultSection();
      wireVaultListeners();
      break;
    case 'workflow':
      body.innerHTML = renderWorkflowSection();
      wireWorkflowListeners();
      break;
    default:
      body.innerHTML = renderE2misSection();
  }
}

function renderE2misSection() {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- Upload Drop Zone -->
      <div class="card" style="border: 2px dashed rgba(14, 165, 233, 0.4); background: rgba(14, 165, 233, 0.03); text-align: center; padding: 26px 20px;">
        <div style="font-size: 32px; margin-bottom: 8px;">📑</div>
        <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: var(--ink);">
          Upload External Spreadsheets for Schema Inspection
        </h4>
        <p style="font-size: 12.5px; color: var(--muted); margin: 0 0 16px 0; max-width: 520px; margin-left: auto; margin-right: auto;">
          E2MIS automatically inspects columns, detects polymorphic entity types (Retailers, Orders, Stock), suggests field mappings, and computes reconciliation diffs.
        </p>
        <button type="button" class="btn btn-primary btn-sm" id="btnSelectE2misFile" style="font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
          <span>📎</span> Select Excel (.xlsx) or CSV File
        </button>
        <input type="file" id="e2misFileInput" accept=".xlsx, .xls, .csv" style="display: none;">
      </div>

      <!-- Inspection & Mapping Preview Container -->
      <div id="e2misInspectionContainer" style="display: none;"></div>

    </div>
  `;
}

function wireE2misListeners() {
  const body = document.getElementById('e2misModalBody');
  if (!body) return;

  const btnSelect = body.querySelector('#btnSelectE2misFile');
  const fileInput = body.querySelector('#e2misFileInput');

  btnSelect?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

      currentInspectedSheet = e2misEngine.inspectSheet(file.name, rawRows);
      renderInspectionView(currentInspectedSheet, rawRows);
      showToast(`Inspected ${rawRows.length} rows from ${file.name}`, '🔍');
    } catch (err) {
      showToast(err.message, '❌');
    }
  });
}

function renderInspectionView(inspection, rawRows) {
  const container = document.getElementById('e2misInspectionContainer');
  if (!container) return;

  container.style.display = 'block';
  container.innerHTML = `
    <div class="card" style="border-top: 3px solid #0ea5e9;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
        <div>
          <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--ink);">
            Inspection Report: \`${inspection.fileName}\`
          </h4>
          <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
            Total Rows: <strong>${inspection.totalRows}</strong> | Detected Entity: <strong style="color: #0284c7;">${inspection.entityType}</strong> (${inspection.confidencePct}% confidence)
          </div>
        </div>
        <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700;">
          READY FOR MAPPING
        </span>
      </div>

      <!-- Suggested Field Mapping Table -->
      <div style="background: var(--surface-alt); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; border: 1px solid var(--line);">
        <strong style="font-size: 13px; color: var(--ink); display: block; margin-bottom: 8px;">
          Detected Field Mappings:
        </strong>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; font-size: 12px;">
          ${Object.entries(inspection.suggestedMappings).map(([canon, src]) => `
            <div style="background: var(--surface); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--line);">
              <span style="color: var(--muted); text-transform: uppercase; font-size: 10px; display: block;">${canon}</span>
              <strong style="color: #0284c7;">${src}</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Human Review & Reconciliation Step -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="font-size: 12px; color: var(--muted);">
          Validate schema and compute duplicate match diffs before writing to production.
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btnValidateReconcile">
          Validate &amp; Preview Reconciliation ⚡
        </button>
      </div>

      <div id="e2misReconciliationResult" style="margin-top: 14px; display: none;"></div>
    </div>
  `;

  document.getElementById('btnValidateReconcile')?.addEventListener('click', () => {
    currentReconciliation = e2misEngine.validateReconciliation(
      rawRows,
      inspection.entityType,
      inspection.suggestedMappings
    );
    renderReconciliationView(currentReconciliation, inspection.fileName);
  });
}

function renderReconciliationView(recon, fileName) {
  const resultDiv = document.getElementById('e2misReconciliationResult');
  if (!resultDiv) return;

  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `
    <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px 16px;">
      <h5 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #10b981;">
        ✓ Pre-Commit Validation Summary
      </h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; font-size: 12px; margin-bottom: 14px;">
        <div>Valid Records: <strong>${recon.validCount}</strong></div>
        <div>New Inserts: <strong style="color: #10b981;">+${recon.insertsCount}</strong></div>
        <div>Existing Matches (Updates): <strong style="color: #0284c7;">~${recon.updatesCount}</strong></div>
        <div>Invalid/Skipped: <strong style="color: #ef4444;">${recon.invalidCount}</strong></div>
      </div>

      <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 14px; width: 100%; box-sizing: border-box;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnCancelReconcile">
          Cancel
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="btnCommitE2misImport" style="background: #10b981; border: none; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
          Confirm Validated Import to Production ✓
        </button>
      </div>
    </div>
  `;

  document.getElementById('btnCancelReconcile')?.addEventListener('click', () => {
    const el = document.getElementById('e2misReconciliationResult');
    if (el) el.style.display = 'none';
  });

  const commitBtn = document.getElementById('btnCommitE2misImport');
  commitBtn?.addEventListener('click', async () => {
    try {
      commitBtn.disabled = true;
      commitBtn.style.opacity = '0.7';
      commitBtn.innerHTML = `<span>⏳</span> Importing ${recon.validCount} records...`;

      const res = await e2misEngine.executeImport(recon.reconciledRecords, { fileName });
      showToast(`Imported ${res.importedCount} records successfully! Total database: ${res.totalDatabaseCount}`, '🎉');
      
      closeE2misModal();
    } catch (err) {
      console.error('E2MIS Import failed:', err);
      showToast(`Import failed: ${err.message}`, '❌');
      commitBtn.disabled = false;
      commitBtn.style.opacity = '1';
      commitBtn.innerHTML = `Confirm Validated Import to Production ✓`;
    }
  });
}

function renderVaultSection() {
  const metrics = outcomeVault.getEvaluationMetrics();
  const records = outcomeVault.getAllRecords();

  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- Metrics KPI row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
        <div class="card" style="padding: 12px;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Total Recommendations</div>
          <div style="font-size: 20px; font-weight: 800; color: var(--ink); margin-top: 2px;">${metrics.totalRecommendations}</div>
        </div>
        <div class="card" style="padding: 12px;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Operator Acceptance</div>
          <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 2px;">${metrics.acceptanceRatePct}%</div>
        </div>
        <div class="card" style="padding: 12px;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Pending Decisions</div>
          <div style="font-size: 20px; font-weight: 800; color: #f59e0b; margin-top: 2px;">${metrics.pendingCount}</div>
        </div>
        <div class="card" style="padding: 12px;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Measured ROI Impact</div>
          <div style="font-size: 20px; font-weight: 800; color: var(--accent); margin-top: 2px;">₹${metrics.totalRoiImpactInr.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <!-- Action Proposal Simulation button -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--ink);">
          Recent AI Action Proposals &amp; Outcome History
        </h4>
        <button type="button" class="btn btn-secondary btn-sm" id="btnSimulateAiProposal">
          + Generate Sample Proposal
        </button>
      </div>

      <!-- Table -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead style="background: var(--surface-alt); text-align: left; color: var(--muted);">
            <tr style="border-bottom: 1px solid var(--line);">
              <th style="padding: 10px 12px;">Proposal</th>
              <th style="padding: 10px 12px;">Action</th>
              <th style="padding: 10px 12px;">Decision</th>
              <th style="padding: 10px 12px;">Measured ROI</th>
              <th style="padding: 10px 12px;">Manage</th>
            </tr>
          </thead>
          <tbody>
            ${records.length > 0 ? records.map(r => `
              <tr style="border-bottom: 1px solid var(--line);">
                <td style="padding: 8px 12px; font-weight: 600; color: var(--ink);">${r.recommendationText}</td>
                <td style="padding: 8px 12px; color: var(--muted);">${r.actionProposed}</td>
                <td style="padding: 8px 12px;">
                  <span class="badge" style="background: ${r.decision === 'ACCEPTED' ? 'rgba(16,185,129,0.15)' : (r.decision === 'REJECTED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)')}; color: ${r.decision === 'ACCEPTED' ? '#10b981' : (r.decision === 'REJECTED' ? '#ef4444' : '#f59e0b')}; font-size: 10px;">
                    ${r.decision}
                  </span>
                </td>
                <td style="padding: 8px 12px; font-weight: 600; color: #10b981;">₹${(r.roiImpactInr || 0).toLocaleString('en-IN')}</td>
                <td style="padding: 8px 12px; white-space: nowrap;">
                  ${r.decision === 'PENDING' ? `
                    <button type="button" class="btn btn-primary btn-sm btn-accept-prop" data-id="${r.id}" style="padding: 2px 8px; font-size: 11px; background: #10b981; border: none;">Accept</button>
                    <button type="button" class="btn btn-secondary btn-sm btn-reject-prop" data-id="${r.id}" style="padding: 2px 8px; font-size: 11px; color: #ef4444;">Reject</button>
                  ` : `<span style="color: var(--muted); font-size: 11px;">Decided by ${r.decidedBy || 'Admin'}</span>`}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="5" style="padding: 30px; text-align: center; color: var(--muted);">
                  No recommendation history in Outcome Vault yet. Tap "+ Generate Sample Proposal" to simulate!
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

function wireVaultListeners() {
  const body = document.getElementById('e2misModalBody');
  if (!body) return;

  body.querySelector('#btnSimulateAiProposal')?.addEventListener('click', () => {
    outcomeVault.recordRecommendation({
      moduleSource: 'AI_INVENTORY_ANALYST',
      targetEntity: 'SKU_VGY_MZ_101',
      entityId: 'sku_mz_101',
      recommendationText: 'Overstock Risk: 450 bags of Hybrid Maize in Patna Mother Depot.',
      actionProposed: 'Dispatch 5% pre-season dealer booking discount to Bihta & Danapur retailers.'
    });
    renderSubTab('vault');
    showToast('Simulated new AI action proposal in Outcome Vault', '⚡');
  });

  body.querySelectorAll('.btn-accept-prop').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      outcomeVault.recordDecision(id, { decision: DECISION_STATES.ACCEPTED, decidedBy: 'Super Admin' });
      outcomeVault.recordOutcome(id, { outcomeText: 'Secured ₹45,000 bulk booking across 6 counters', roiImpactInr: 45000 });
      renderSubTab('vault');
      showToast('Proposal accepted & ₹45,000 ROI logged!', '✅');
    });
  });

  body.querySelectorAll('.btn-reject-prop').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      outcomeVault.recordDecision(id, { decision: DECISION_STATES.REJECTED, decidedBy: 'Super Admin' });
      renderSubTab('vault');
      showToast('Proposal rejected', '🗑️');
    });
  });
}

function renderWorkflowSection() {
  const definitions = workflowEngine.getRegisteredDefinitions();
  const instances = workflowEngine.getAllInstances();

  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <div class="card" style="border-left: 4px solid #6366f1;">
        <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: var(--ink);">
          Registered Versioned Enterprise Workflows
        </h4>
        <div style="font-size: 12.5px; color: var(--muted); line-height: 1.5;">
          Per Section 57 of GROWTA-MASTER-PRD-001, critical state-mutating actions follow deterministic Trigger → Condition → Action → Approval cycles.
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
        ${definitions.map(wf => `
          <div class="card" style="padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <strong style="font-size: 13px; color: var(--ink);">${wf.name}</strong>
              <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; font-size: 10px;">v${wf.version}</span>
            </div>
            <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 8px;">${wf.description}</div>
            <div style="font-size: 11px; color: var(--ink);">Trigger: <code>${wf.trigger}</code> | Required: <strong>${wf.requiredRole}</strong></div>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--ink);">
          Active Workflow Execution Queue (${instances.length})
        </h4>
        <button type="button" class="btn btn-secondary btn-sm" id="btnSimulateWorkflowTrigger">
          + Trigger Sample Workflow
        </button>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead style="background: var(--surface-alt); text-align: left; color: var(--muted);">
            <tr style="border-bottom: 1px solid var(--line);">
              <th style="padding: 10px 12px;">Instance ID</th>
              <th style="padding: 10px 12px;">Workflow</th>
              <th style="padding: 10px 12px;">Status</th>
              <th style="padding: 10px 12px;">Initiated</th>
              <th style="padding: 10px 12px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${instances.length > 0 ? instances.map(i => `
              <tr style="border-bottom: 1px solid var(--line);">
                <td style="padding: 8px 12px; font-family: monospace; color: var(--muted);">${i.id}</td>
                <td style="padding: 8px 12px; font-weight: 600; color: var(--ink);">${i.workflowName}</td>
                <td style="padding: 8px 12px;">
                  <span class="badge" style="background: ${i.status === 'APPROVED' ? 'rgba(16,185,129,0.15)' : (i.status === 'REJECTED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)')}; color: ${i.status === 'APPROVED' ? '#10b981' : (i.status === 'REJECTED' ? '#ef4444' : '#f59e0b')}; font-size: 10px;">
                    ${i.status}
                  </span>
                </td>
                <td style="padding: 8px 12px; color: var(--muted);">${new Date(i.initiatedAt).toLocaleTimeString('en-IN')}</td>
                <td style="padding: 8px 12px;">
                  ${i.status === 'PENDING_APPROVAL' ? `
                    <button type="button" class="btn btn-primary btn-sm btn-wf-approve" data-id="${i.id}" style="padding: 2px 8px; font-size: 11px; background: #10b981; border: none;">Approve</button>
                  ` : `<span style="color: var(--muted); font-size: 11px;">Completed</span>`}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="5" style="padding: 30px; text-align: center; color: var(--muted);">
                  No active workflow executions. Tap "+ Trigger Sample Workflow" to simulate!
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

function wireWorkflowListeners() {
  const body = document.getElementById('e2misModalBody');
  if (!body) return;

  body.querySelector('#btnSimulateWorkflowTrigger')?.addEventListener('click', () => {
    workflowEngine.evaluateTrigger('ORDER_SUBMITTED', {
      total_order_value: 35000,
      discount_pct: 6,
      retailer: 'Maa Durga Krishi Kendra (Danapur)'
    });
    renderSubTab('workflow');
    showToast('Triggered High-Value Order Approval Workflow', '⚡');
  });

  body.querySelectorAll('.btn-wf-approve').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      workflowEngine.approveInstance(id, { name: 'Super Admin', role: 'SUPER_ADMIN' });
      renderSubTab('workflow');
      showToast('Workflow step approved and audit logged!', '✅');
    });
  });
}
