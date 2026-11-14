import { auth } from '../services/auth.js';
import { idbStorage } from '../services/idbStorage.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function attachOfflineQueueExport(container) {
  attachOfflineQueueExport(container);
}

function renderShell(container, body) {
  container.classList.remove('hidden');
  container.innerHTML = `
    <section class="card" style="max-width: 620px; margin: 28px auto; padding: 24px; box-shadow: var(--shadow-lg);">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
        <div style="font-size:32px;">🌱</div>
        <div>
          <h2 style="font-family:var(--font-heading); margin:0; font-size:22px;">Growta secure sign-in</h2>
          <p style="margin:4px 0 0; color:var(--muted); font-size:13px;">Individual account · tenant membership · server-verified permissions</p>
        </div>
      </div>
      ${body}
    </section>
  `;
}

function renderSignIn(container, state) {
  renderShell(container, `
    <form id="tenantSignInForm" novalidate>
      <div class="form-group">
        <label class="form-label" for="tenantEmail">Work email</label>
        <input id="tenantEmail" name="email" type="email" autocomplete="username" required maxlength="254"
          placeholder="name@company.com" style="width:100%; padding:12px;">
      </div>
      <div class="form-group">
        <label class="form-label" for="tenantPassword">Password</label>
        <input id="tenantPassword" name="password" type="password" autocomplete="current-password" required maxlength="256"
          placeholder="Enter your password" style="width:100%; padding:12px;">
      </div>
      <p id="tenantAuthError" role="alert" style="color:var(--danger); min-height:20px; font-size:13px;">${escapeHtml(state.error || '')}</p>
      <button id="tenantSignInButton" class="btn btn-primary" type="submit" style="width:100%; padding:12px;">Sign in securely →</button>
      <button id="tenantResetPassword" class="btn btn-secondary" type="button" style="width:100%; margin-top:8px;">Send password reset link</button>
    </form>
    <p style="font-size:12px; color:var(--muted); margin:16px 0 0;">
      Accounts must be provisioned by an authorized platform administrator. Self-registration and tenant creation are not enabled.
    </p>
    <div style="border-top:1px solid var(--line); margin-top:18px; padding-top:12px; font-size:12px; color:var(--muted);">
      Existing local PINs and shared representative passwords are disabled in production.
    </div>
    <div style="margin-top:14px;">
      <button id="exportOfflineQueue" class="btn btn-secondary" type="button" style="width:100%;">Export preserved offline operations</button>
      <p id="queueExportStatus" style="font-size:11px; color:var(--muted); min-height:16px; margin:6px 0 0;"></p>
    </div>
  `);

  const form = container.querySelector('#tenantSignInForm');
  const button = container.querySelector('#tenantSignInButton');
  const errorEl = container.querySelector('#tenantAuthError');
  attachOfflineQueueExport(container);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = container.querySelector('#tenantEmail')?.value || '';
    const password = container.querySelector('#tenantPassword')?.value || '';
    button.disabled = true;
    button.textContent = 'Verifying credentials…';
    if (errorEl) errorEl.textContent = '';
    try {
      await auth.signIn(email, password);
      renderTenantAuthView(container);
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Sign-in failed.';
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = 'Sign in securely →';
      }
    }
  });

  container.querySelector('#tenantResetPassword')?.addEventListener('click', async () => {
    const email = container.querySelector('#tenantEmail')?.value || '';
    const resetButton = container.querySelector('#tenantResetPassword');
    resetButton.disabled = true;
    try {
      await auth.requestPasswordReset(email);
      if (errorEl) {
        errorEl.style.color = 'var(--success)';
        errorEl.textContent = 'If the account exists, Supabase will send a password reset email.';
      }
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Unable to request password reset.';
    } finally {
      resetButton.disabled = false;
    }
  });
}

function renderTenantSelection(container, state) {
  const options = state.tenants.map((tenant) => (
    `<option value="${escapeHtml(tenant.id)}">${escapeHtml(tenant.name)} (${escapeHtml(tenant.slug)})</option>`
  )).join('');

  renderShell(container, `
    <p style="color:var(--muted); font-size:13px;">Signed in as <strong>${escapeHtml(state.user?.email)}</strong></p>
    <form id="tenantSelectForm">
      <div class="form-group">
        <label class="form-label" for="tenantSelect">Choose your workspace</label>
        <select id="tenantSelect" required style="width:100%; padding:12px; border:1px solid var(--line); border-radius:var(--radius-sm); background:var(--surface);">
          <option value="">Select an active tenant</option>
          ${options}
        </select>
      </div>
      <p id="tenantSelectError" role="alert" style="color:var(--danger); min-height:20px; font-size:13px;"></p>
      <button id="tenantSelectButton" class="btn btn-primary" type="submit" style="width:100%; padding:12px;">Continue →</button>
    </form>
    <button id="tenantSignOut" class="btn btn-secondary" type="button" style="width:100%; margin-top:8px;">Sign out</button>
  `);

  container.querySelector('#tenantSelectForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tenantId = container.querySelector('#tenantSelect')?.value || '';
    const button = container.querySelector('#tenantSelectButton');
    const errorEl = container.querySelector('#tenantSelectError');
    button.disabled = true;
    button.textContent = 'Loading workspace…';
    try {
      await auth.selectTenant(tenantId);
      renderTenantAuthView(container);
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Unable to select tenant.';
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = 'Continue →';
      }
    }
  });

  container.querySelector('#tenantSignOut')?.addEventListener('click', () => auth.signOut());
}

function renderNoMembership(container, state) {
  renderShell(container, `
    <div style="padding:16px; border-radius:var(--radius-sm); background:var(--surface-alt);">
      <strong>No active tenant membership</strong>
      <p style="font-size:13px; color:var(--muted); margin:8px 0 0;">
        Your email/password was accepted, but this account is not assigned to an active tenant. Ask your platform administrator to verify your identity and provision a membership.
      </p>
    </div>
    <p style="font-size:12px; color:var(--muted);">Account: ${escapeHtml(state.user?.email)}</p>
    <button id="exportOfflineQueue" class="btn btn-secondary" type="button" style="width:100%; margin-bottom:8px;">Export preserved offline operations</button>
    <p id="queueExportStatus" style="font-size:11px; color:var(--muted); min-height:16px;"></p>
    <button id="tenantSignOut" class="btn btn-secondary" type="button" style="width:100%;">Sign out</button>
  `);
  attachOfflineQueueExport(container);
  container.querySelector('#tenantSignOut')?.addEventListener('click', () => auth.signOut());
}

function renderTenantReady(container, state) {
  const context = state.tenantContext;
  const permissions = Array.isArray(context?.permissions) ? context.permissions : [];
  const roles = Array.isArray(context?.roleCodes) ? context.roleCodes : [];
  const permissionList = permissions.length
    ? permissions.map((permission) => `<li>${escapeHtml(permission)}</li>`).join('')
    : '<li>No permissions assigned</li>';

  renderShell(container, `
    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
      <div>
        <div style="font-size:11px; color:var(--success); font-weight:800; text-transform:uppercase;">Identity verified</div>
        <h3 style="margin:4px 0 0; font-size:19px;">${escapeHtml(state.tenants.find((t) => t.id === state.selectedTenantId)?.name || 'Tenant workspace')}</h3>
        <p style="margin:4px 0; font-size:12px; color:var(--muted);">${escapeHtml(state.user?.email)}</p>
      </div>
      <span class="badge badge-visited">Authenticated</span>
    </div>
    <div style="margin-top:16px; padding:14px; background:var(--surface-alt); border-radius:var(--radius-sm);">
      <strong style="font-size:13px;">Authorization context</strong>
      <p style="font-size:12px; color:var(--muted); margin:6px 0;">Roles: ${escapeHtml(roles.join(', ') || 'None assigned')}</p>
      <p style="font-size:12px; color:var(--muted); margin:6px 0;">Primary unit: ${escapeHtml(context?.primaryOrgUnit?.name || 'Not assigned')}</p>
      <p style="font-size:12px; color:var(--muted); margin:6px 0;">Organizational scopes: ${escapeHtml(String(context?.scopedOrgUnitIds?.length || 0))}</p>
      <details style="margin-top:8px;">
        <summary style="cursor:pointer; font-size:12px; font-weight:700;">View granted permissions (${permissions.length})</summary>
        <ul style="font-size:12px; padding-left:20px; line-height:1.7;">${permissionList}</ul>
      </details>
    </div>
    <div style="margin-top:14px; border-left:4px solid var(--warning); background:var(--surface-alt); padding:12px;">
      <strong style="font-size:13px;">Operational workspace is not connected yet</strong>
      <p style="font-size:12px; color:var(--muted); margin:6px 0 0;">
        Your identity and tenant permissions are verified. Field operations remain locked until legacy records are mapped to this account and tenant-scoped API read/write paths replace direct browser database access. Existing offline data is preserved; it will not be uploaded under an unverified identity.
      </p>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:16px;">
      <button id="tenantSwitch" class="btn btn-secondary" type="button">Switch workspace</button>
      <button id="tenantSignOut" class="btn btn-secondary" type="button">Sign out</button>
    </div>
    <div style="margin-top:14px; border-top:1px solid var(--line); padding-top:12px;">
      <button id="exportOfflineQueue" class="btn btn-secondary" type="button" style="width:100%;">Export preserved offline operations</button>
      <p id="queueExportStatus" style="font-size:11px; color:var(--muted); min-height:16px; margin:6px 0 0;"></p>
    </div>
  `);

  container.querySelector('#tenantSwitch')?.addEventListener('click', () => {
    auth.clearSelectedTenant();
    renderTenantAuthView(container);
  });
  container.querySelector('#tenantSignOut')?.addEventListener('click', () => auth.signOut());
  container.querySelector('#exportOfflineQueue')?.addEventListener('click', async () => {
    const status = container.querySelector('#queueExportStatus');
    try {
      const items = await idbStorage.getAllSyncItems();
      const payload = {
        exportedAt: new Date().toISOString(),
        warning: 'Contains locally stored operational data. Store and share this file securely.',
        items
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `growta-offline-queue-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      if (status) status.textContent = `Exported ${items.length} queued operations.`;
    } catch (error) {
      if (status) status.textContent = error.message || 'Unable to export offline operations.';
    }
  });
}

export function renderTenantAuthView(container) {
  const state = auth.getState();
  switch (state.status) {
    case 'initializing':
    case 'loading_tenants':
      renderShell(container, '<p style="color:var(--muted);">Verifying your session and tenant memberships…</p>');
      return;
    case 'tenant_selection':
      renderTenantSelection(container, state);
      return;
    case 'no_memberships':
      renderNoMembership(container, state);
      return;
    case 'tenant_ready':
      renderTenantReady(container, state);
      return;
    case 'configuration_error':
    case 'error':
      renderShell(container, `
        <div role="alert" style="color:var(--danger); font-size:13px; margin-bottom:14px;">${escapeHtml(state.error || 'Authentication service is unavailable.')}</div>
        <button id="tenantRetry" class="btn btn-primary" type="button" style="width:100%;">Retry connection</button>
        <button id="tenantSignOut" class="btn btn-secondary" type="button" style="width:100%; margin-top:8px;">Clear session / sign out</button>
      `);
      container.querySelector('#tenantRetry')?.addEventListener('click', async () => {
        try {
          await auth.initialize();
          renderTenantAuthView(container);
        } catch (error) {
          auth.error = error.message || 'Unable to restore tenant membership.';
          auth.status = 'error';
          renderTenantAuthView(container);
        }
      });
      container.querySelector('#tenantSignOut')?.addEventListener('click', () => auth.signOut());
      return;
    case 'signed_out':
    default:
      renderSignIn(container, state);
  }
}
