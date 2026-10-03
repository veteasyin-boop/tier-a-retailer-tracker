import { supabaseService } from '../services/supabase.js';
import { storage } from '../services/storage.js';
import { showToast } from './toast.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function openSupabaseModal() {
  let modalEl = document.getElementById('supabaseModal');
  if (!modalEl) {
    createSupabaseModalDOM();
    modalEl = document.getElementById('supabaseModal');
  }

  const { url, key } = supabaseService.getCredentials();
  const urlInput = document.getElementById('spUrl');
  const keyInput = document.getElementById('spKey');
  if (urlInput) urlInput.value = url || '';
  if (keyInput) keyInput.value = key || '';

  updateStatusUI();
  modalEl.classList.add('open');
}

export function closeSupabaseModal() {
  const modalEl = document.getElementById('supabaseModal');
  if (modalEl) modalEl.classList.remove('open');
}

function updateStatusUI() {
  const statusBadge = document.getElementById('spStatusBadge');
  const syncActions = document.getElementById('spSyncActions');
  const isConnected = supabaseService.isReady;

  if (statusBadge) {
    if (isConnected) {
      const { url } = supabaseService.getCredentials();
      const host = url ? new URL(url).hostname : 'Supabase';
      statusBadge.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: var(--radius-md);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🟢</span>
            <div>
              <strong style="color: var(--success); font-size: 13px;">Connected &amp; Live Synchronized</strong>
              <div style="font-size: 11px; color: var(--muted); font-family: monospace;">${escapeHtml(host)}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btnSpDisconnect" style="font-size: 11px; padding: 3px 8px; color: var(--danger);">Disconnect</button>
        </div>
      `;
      document.getElementById('btnSpDisconnect')?.addEventListener('click', handleDisconnect);
    } else {
      statusBadge.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.25); border-radius: var(--radius-md);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">⚡</span>
            <div>
              <strong style="color: var(--ink); font-size: 13px;">Local Storage Mode Active</strong>
              <div style="font-size: 11px; color: var(--muted);">Data is stored safely in your browser. Connect Supabase to sync across devices.</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  if (syncActions) {
    syncActions.style.display = isConnected ? 'block' : 'none';
  }
}

async function handleTestConnection() {
  const urlInput = document.getElementById('spUrl');
  const keyInput = document.getElementById('spKey');
  const resultEl = document.getElementById('spTestResult');
  const testBtn = document.getElementById('btnSpTest');

  const url = (urlInput?.value || '').trim();
  const key = (keyInput?.value || '').trim();

  if (!url || !key) {
    if (resultEl) {
      resultEl.innerHTML = `<span style="color: var(--danger);">⚠️ Please provide both Project URL and Anon API Key.</span>`;
    }
    return;
  }

  if (!url.startsWith('https://')) {
    if (resultEl) {
      resultEl.innerHTML = `<span style="color: var(--danger);">⚠️ Project URL must start with https://</span>`;
    }
    return;
  }

  if (testBtn) {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing Connection…';
  }
  if (resultEl) {
    resultEl.innerHTML = `<span style="color: var(--primary);">⏳ Connecting to Supabase project…</span>`;
  }

  try {
    const res = await supabaseService.testConnection(url, key);
    if (res.success) {
      if (resultEl) {
        resultEl.innerHTML = `<span style="color: var(--success); font-weight: 600;">✅ Connection Successful! Verified tables exist. (${res.count} assistant records found)</span>`;
      }
      showToast('Supabase connection verified!', '✅');
    } else {
      if (resultEl) {
        resultEl.innerHTML = `
          <div style="color: var(--danger); font-size: 12px; margin-top: 4px;">
            ❌ <strong>Connection Error:</strong> ${escapeHtml(res.error)}
            <div style="margin-top: 4px; color: var(--muted);">Tip: Make sure you ran <code>supabase_schema.sql</code> in your Supabase SQL Editor.</div>
          </div>
        `;
      }
    }
  } catch (err) {
    if (resultEl) {
      resultEl.innerHTML = `<span style="color: var(--danger);">❌ Unexpected error: ${escapeHtml(err.message)}</span>`;
    }
  } finally {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.textContent = '🔌 Test Connection';
    }
  }
}

async function handleSaveCredentials() {
  const urlInput = document.getElementById('spUrl');
  const keyInput = document.getElementById('spKey');
  const saveBtn = document.getElementById('btnSpSave');

  const url = (urlInput?.value || '').trim();
  const key = (keyInput?.value || '').trim();

  if (!url || !key) {
    showToast('Please enter both Supabase URL and Anon Key', '⚠️');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving & Initializing…';
  }

  try {
    const ok = await supabaseService.saveCredentials(url, key);
    if (ok) {
      // Re-initialize storage sync
      await storage.initSupabaseSync();
      updateStatusUI();
      showToast('Supabase Cloud Sync Activated! 🚀', '🟢');
      closeSupabaseModal();
    } else {
      showToast('Could not initialize Supabase. Check credentials.', '❌');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, '❌');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save & Activate Cloud Sync';
    }
  }
}

async function handleDisconnect() {
  if (confirm('Disconnect from Supabase? The app will operate in local offline mode.')) {
    supabaseService.saveCredentials('', '');
    storage.updateStorageIndicator('⚡ Local Offline Storage', 'Offline persistence enabled via localStorage');
    updateStatusUI();
    showToast('Disconnected from Supabase. Running in Local Mode.', '⚡');
  }
}

async function handlePushLocalToCloud() {
  const btn = document.getElementById('btnSpPush');
  const progEl = document.getElementById('spSyncProgress');
  const progBar = document.getElementById('spSyncProgressBar');
  const progText = document.getElementById('spSyncProgressText');

  if (!confirm(`Push all ${storage.rows.length} local retailers, ${storage.assistants.length} assistants, and check-in logs to your Supabase database?`)) {
    return;
  }

  if (btn) btn.disabled = true;
  if (progEl) progEl.style.display = 'block';

  try {
    if (progText) progText.textContent = '1/3 Syncing Field Assistants…';
    if (progBar) progBar.style.width = '20%';
    for (const asst of storage.assistants) {
      await supabaseService.saveAssistant(asst);
    }

    if (progText) progText.textContent = `2/3 Syncing ${storage.rows.length} Tier-A Bihar Retailers (Batched)…`;
    if (progBar) progBar.style.width = '60%';
    await supabaseService.bulkUpsertRetailers(storage.rows);

    if (progText) progText.textContent = '3/3 Syncing Live Check-In Audit Logs…';
    if (progBar) progBar.style.width = '90%';
    const logs = storage.getCheckInLogs();
    for (const log of logs) {
      await supabaseService.saveCheckInLog(log);
    }

    if (progBar) progBar.style.width = '100%';
    if (progText) progText.textContent = '✅ Cloud Sync Complete!';
    showToast(`Successfully seeded Supabase with ${storage.rows.length} retailers!`, '🚀');

    setTimeout(() => {
      if (progEl) progEl.style.display = 'none';
      if (btn) btn.disabled = false;
    }, 2500);
  } catch (err) {
    if (progText) progText.textContent = `❌ Cloud Push Failed: ${err.message}`;
    if (btn) btn.disabled = false;
    showToast(`Sync failed: ${err.message}`, '❌');
  }
}

async function handlePullCloudToLocal() {
  const btn = document.getElementById('btnSpPull');
  if (!confirm('Pull all datasets from Supabase Cloud? This will refresh all 14 tables including check-in logs, attendance, leaves, TA/DA, dealer visits, and SOP data.')) {
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Pulling Cloud Data…';
  }

  try {
    const success = await storage.pullAllFromCloud();
    if (success) {
      showToast(`Cloud pull complete! ${storage.rows.length} retailers, ${storage.getCheckInLogs().length} check-ins, and all records refreshed!`, '📥');
    } else {
      showToast('Could not complete full cloud pull. Check console for details.', '⚠️');
    }
  } catch (err) {
    showToast(`Pull error: ${err.message}`, '❌');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📥 Pull Latest from Cloud';
    }
  }
}

function createSupabaseModalDOM() {
  const wrapper = document.createElement('div');
  wrapper.id = 'supabaseModal';
  wrapper.className = 'modal-backdrop';

  wrapper.innerHTML = `
    <div class="modal-card" style="max-width: 640px; border-radius: var(--radius-lg); overflow: hidden;">
      <!-- Modal Header -->
      <div class="modal-header" style="background: linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(34, 197, 94, 0.08));">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">☁️</span>
            <h3 style="font-family: var(--font-heading); font-size: 18px; margin: 0;">
              Supabase Cloud Database Sync
            </h3>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 3px;">
            PostgreSQL cloud storage with real-time field synchronization for all Bihar reps
          </div>
        </div>
        <button class="modal-close" id="btnSpClose" aria-label="Close modal">&times;</button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 18px;">
        
        <!-- Current Connection Status -->
        <div id="spStatusBadge"></div>

        <!-- Credentials Form -->
        <div style="background: var(--surface-alt); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--line);">
          <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <span>🔑</span> Supabase API Configuration
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px;">
                Supabase Project URL:
              </label>
              <input type="url" id="spUrl" class="filter-input" placeholder="https://xyzcompany.supabase.co" style="width: 100%; font-family: monospace; font-size: 13px;">
              <span style="font-size: 11px; color: var(--muted); margin-top: 3px; display: block;">
                Found in: Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL
              </span>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label style="font-size: 12px; font-weight: 600;">
                  Supabase Anon (Public) Key:
                </label>
                <button type="button" id="btnToggleKeyMask" style="background: none; border: none; font-size: 11px; color: var(--primary); cursor: pointer;">
                  👁️ Toggle Show
                </button>
              </div>
              <input type="password" id="spKey" class="filter-input" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." style="width: 100%; font-family: monospace; font-size: 12px;">
              <span style="font-size: 11px; color: var(--muted); margin-top: 3px; display: block;">
                Found in: Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys &gt; <code>anon</code> <code>public</code>
              </span>
            </div>

            <div id="spTestResult" style="min-height: 20px;"></div>

            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btnSpTest">
                🔌 Test Connection
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btnSpSave">
                💾 Save &amp; Activate Cloud Sync
              </button>
            </div>
          </div>
        </div>

        <!-- Sync Actions (shown when connected) -->
        <div id="spSyncActions" style="display: none; background: var(--surface); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--line);">
          <div style="font-weight: 700; font-size: 13.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>🚀</span> Cloud Data Operations
          </div>

          <div style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
            Synchronize all 573 Bihar Tier-A dealers, assistant assignments, and live GPS check-in audits.
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="btnSpPush">
              🚀 1-Click Push Local to Supabase
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnSpPull">
              📥 Pull Latest from Cloud
            </button>
          </div>

          <!-- Progress bar -->
          <div id="spSyncProgress" style="display: none; margin-top: 14px;">
            <div style="height: 8px; background: var(--line); border-radius: 9999px; overflow: hidden;">
              <div id="spSyncProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--success)); transition: width 0.3s ease;"></div>
            </div>
            <div id="spSyncProgressText" style="font-size: 11.5px; color: var(--muted); margin-top: 6px; text-align: center;">Syncing…</div>
          </div>
        </div>

        <!-- Setup Instructions Accordion -->
        <div style="background: var(--surface-alt); border-radius: var(--radius-md); border: 1px solid var(--line); padding: 14px;">
          <div style="font-weight: 700; font-size: 12.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>📖</span> Quick 3-Step Setup Guide
          </div>
          <ol style="font-size: 12px; color: var(--muted); line-height: 1.6; margin: 0; padding-left: 18px;">
            <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener" style="color: var(--primary); text-decoration: underline;">supabase.com</a>, create a free project named <code>tier-a-tracker</code>.</li>
            <li>In the left sidebar, click <strong>SQL Editor</strong> &gt; open the included <code>supabase_schema.sql</code> file &gt; click <strong>Run</strong>.</li>
            <li>Go to <strong>Project Settings &gt; API</strong>, copy the <strong>Project URL</strong> and <strong>anon key</strong>, paste them above, and click <strong>Test Connection</strong>.</li>
          </ol>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="modal-footer" style="padding: 12px 20px; background: var(--surface-alt); display: flex; justify-content: flex-end;">
        <button class="btn btn-secondary btn-sm" id="btnSpCloseFooter">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  // Wire event handlers
  document.getElementById('btnSpClose')?.addEventListener('click', closeSupabaseModal);
  document.getElementById('btnSpCloseFooter')?.addEventListener('click', closeSupabaseModal);
  wrapper.addEventListener('click', (e) => {
    if (e.target === wrapper) closeSupabaseModal();
  });

  document.getElementById('btnSpTest')?.addEventListener('click', handleTestConnection);
  document.getElementById('btnSpSave')?.addEventListener('click', handleSaveCredentials);
  document.getElementById('btnSpPush')?.addEventListener('click', handlePushLocalToCloud);
  document.getElementById('btnSpPull')?.addEventListener('click', handlePullCloudToLocal);

  const toggleBtn = document.getElementById('btnToggleKeyMask');
  toggleBtn?.addEventListener('click', () => {
    const keyInput = document.getElementById('spKey');
    if (keyInput) {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = '🔒 Hide Key';
      } else {
        keyInput.type = 'password';
        toggleBtn.textContent = '👁️ Toggle Show';
      }
    }
  });
}
