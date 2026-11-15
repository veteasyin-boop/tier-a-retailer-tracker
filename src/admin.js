import './styles/admin.css';
import { supabaseService } from './services/supabase.js';

const API_BASE = String(import.meta.env?.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, '');
const root = document.getElementById('admin-root');
let session = null;
let currentPage = 'overview';
let tenants = [];
let auditEvents = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function notify(message, type = 'info') {
  const el = document.getElementById('notice');
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
  el.hidden = false;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => { el.hidden = true; }, 4500);
}
async function api(path, options = {}) {
  const activeSession = await supabaseService.getCurrentSession();
  if (!activeSession?.access_token) throw new Error('Your session has expired. Sign in again.');
  const response = await fetch(`${API_BASE}/api/v1/platform/admin${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeSession.access_token}`
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'omit',
    cache: 'no-store'
  });
  let body;
  try { body = await response.json(); } catch { throw new Error('The platform API returned an invalid response.'); }
  if (!response.ok || body?.success !== true) {
    const error = new Error(body?.error?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body;
}
function renderLogin(message = '') {
  root.innerHTML = `
    <main class="login-wrap">
      <section class="login-card">
        <div class="brand-mark">G<span>·</span></div>
        <p class="eyebrow">GROWTA ONE / PLATFORM</p>
        <h1>Platform control<br>starts here.</h1>
        <p class="muted">Sign in with your existing email and password. Platform access is verified separately from tenant roles.</p>
        <form id="login-form">
          <label>Email address<input id="email" type="email" autocomplete="username" maxlength="254" required placeholder="admin@company.com"></label>
          <label>Password<input id="password" type="password" autocomplete="current-password" maxlength="256" required placeholder="Your password"></label>
          <p class="form-error" id="login-error" role="alert">${escapeHtml(message)}</p>
          <button class="btn primary full" id="login-submit">Sign in securely <span>→</span></button>
        </form>
        <p class="login-foot">Access is restricted to provisioned platform administrators.</p>
      </section>
    </main>`;
  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('login-submit');
    const error = document.getElementById('login-error');
    button.disabled = true; button.textContent = 'Verifying…'; error.textContent = '';
    try {
      const { error: authError, data } = await supabaseService.signInWithEmail(
        document.getElementById('email').value.trim().toLowerCase(),
        document.getElementById('password').value
      );
      if (authError) throw authError;
      session = data.session;
      await verifyAdmin();
      await renderConsole();
    } catch (err) {
      await supabaseService.signOutUser();
      session = null;
      error.textContent = err.status === 403 || err.code === 'PLATFORM_ADMIN_REQUIRED'
        ? 'This account is authenticated but is not an active platform administrator.'
        : (err.message || 'Unable to sign in.');
      button.disabled = false; button.textContent = 'Sign in securely →';
    }
  });
}
async function verifyAdmin() {
  const result = await api('/me');
  if (!result.data?.status || result.data.status !== 'active') throw new Error('Platform administrator access is not active.');
  return result.data;
}
function shell(content) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="logo" href="/admin">growta<span>.</span><small>PLATFORM</small></a>
        <div class="side-label">WORKSPACE</div>
        <button class="nav-item" data-page="overview"><span>▦</span> Overview</button>
        <button class="nav-item" data-page="tenants"><span>▤</span> Tenants</button>
        <button class="nav-item" data-page="audit"><span>◷</span> Audit trail</button>
        <div class="side-bottom"><div class="secure"><i></i><span>Platform security<br><b>Server verified</b></span></div><button id="logout" class="logout">↗ Sign out</button></div>
      </aside>
      <main class="main">
        <header class="topbar"><div><div class="crumb">GROWTA ONE <span>/</span> PLATFORM</div><h2 id="page-title">Overview</h2></div><div class="user-chip"><div class="avatar">A</div><span id="user-email">Administrator</span></div></header>
        <div id="notice" class="notice" role="status" hidden></div>
        <section id="page-content">${content}</section>
        <footer>Growta One · Platform control plane <span>Tenant data remains isolated by tenant authorization.</span></footer>
      </main>
    </div>`;
  root.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => loadPage(button.dataset.page)));
  document.getElementById('logout').addEventListener('click', async () => {
    await supabaseService.signOutUser(); session = null; renderLogin();
  });
  document.getElementById('user-email').textContent = session?.user?.email || 'Administrator';
  root.querySelector(`[data-page="${currentPage}"]`)?.classList.add('active');
}
async function renderConsole() {
  currentPage = 'overview';
  shell('<div class="loading-card">Loading platform metrics…</div>');
  await loadPage('overview');
}
async function loadPage(page) {
  currentPage = page;
  root.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  const title = {overview:'Overview',tenants:'Tenant management',audit:'Platform audit trail'}[page] || 'Overview';
  const titleEl = document.getElementById('page-title');
  const content = document.getElementById('page-content');
  if (!content) return;
  titleEl.textContent = title;
  content.innerHTML = '<div class="loading-card">Loading…</div>';
  try {
    if (page === 'overview') {
      const [tenantResponse, auditResponse] = await Promise.all([
        api('/tenants?limit=5&offset=0'),
        api('/audit-events?limit=5&offset=0')
      ]);
      tenants = tenantResponse.data || []; auditEvents = auditResponse.data || [];
      const total = tenantResponse.meta?.total ?? tenants.length;
      const active = tenants.filter(t => t.is_active).length;
      content.innerHTML = `
        <div class="welcome"><div><p class="eyebrow">CONTROL PLANE</p><h1>Good to have you back.</h1><p>Manage workspaces, monitor platform activity and keep tenant access under control.</p></div><div class="welcome-orb">G</div></div>
        <div class="stat-grid">
          <article class="stat"><span>Total tenants</span><strong>${total}</strong><small>Registered workspaces</small></article>
          <article class="stat"><span>Active in latest page</span><strong>${active}</strong><small>Latest five tenants</small></article>
          <article class="stat"><span>Recent audit events</span><strong>${auditEvents.length}</strong><small>Latest five records</small></article>
        </div>
        <div class="section-head"><div><p class="eyebrow">DIRECTORY</p><h3>Recently created tenants</h3></div><button class="btn ghost" id="view-tenants">View all tenants →</button></div>
        ${tenantTable(tenants.slice(0,5))}
        <div class="section-head audit-head"><div><p class="eyebrow">GOVERNANCE</p><h3>Recent platform activity</h3></div><button class="btn ghost" id="view-audit">Open audit trail →</button></div>
        ${auditTable(auditEvents)}`;
      document.getElementById('view-tenants')?.addEventListener('click',()=>loadPage('tenants'));
      document.getElementById('view-audit')?.addEventListener('click',()=>loadPage('audit'));
    } else if (page === 'tenants') {
      const response = await api('/tenants?limit=100&offset=0');
      tenants = response.data || [];
      content.innerHTML = `
        <div class="section-head"><div><p class="eyebrow">WORKSPACE DIRECTORY</p><h3>All tenants</h3><p class="muted">Create, search and control tenant availability.</p></div><button class="btn primary" id="create-tenant">＋ Create tenant</button></div>
        <div class="toolbar"><input id="tenant-search" type="search" placeholder="Search by tenant name or slug…"><span>${response.meta?.total ?? tenants.length} records</span></div>
        <div id="tenant-table">${tenantTable(tenants,true)}</div>`;
      document.getElementById('create-tenant').addEventListener('click', showCreateTenant);
      document.getElementById('tenant-search').addEventListener('input', event => {
        const term = event.target.value.toLowerCase();
        document.getElementById('tenant-table').innerHTML = tenantTable(tenants.filter(t => t.name.toLowerCase().includes(term) || t.slug.toLowerCase().includes(term)),true);
        bindTenantActions();
      });
      bindTenantActions();
    } else if (page === 'audit') {
      const response = await api('/audit-events?limit=100&offset=0');
      auditEvents = response.data || [];
      content.innerHTML = `
        <div class="section-head"><div><p class="eyebrow">SECURITY & GOVERNANCE</p><h3>Platform audit trail</h3><p class="muted">Immutable events for platform-level tenant lifecycle actions.</p></div><span class="record-count">${response.meta?.total ?? auditEvents.length} events</span></div>
        ${auditTable(auditEvents,true)}`;
    }
  } catch (error) {
    content.innerHTML = `<div class="error-card"><b>Unable to load this section</b><p>${escapeHtml(error.message)}</p><button class="btn ghost" id="retry">Try again</button></div>`;
    document.getElementById('retry')?.addEventListener('click',()=>loadPage(page));
    if (error.status === 401 || error.status === 403) notify('Platform authorization failed. Sign in with an active platform administrator account.','error');
  }
}
function tenantTable(rows, actions = false) {
  if (!rows.length) return '<div class="empty">No tenants found.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Tenant</th><th>Plan</th><th>Status</th><th>Created</th>${actions?'<th>Action</th>':''}</tr></thead><tbody>${rows.map(t=>`<tr><td><b>${escapeHtml(t.name)}</b><small>${escapeHtml(t.slug)}</small></td><td>${escapeHtml(t.tier || 'standard')}</td><td><span class="status ${t.is_active?'on':'off'}">${t.is_active?'Active':'Suspended'}</span></td><td>${formatDate(t.created_at)}</td>${actions?`<td><button class="table-action" data-tenant-id="${escapeHtml(t.id)}" data-active="${t.is_active}">${t.is_active?'Suspend':'Activate'}</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function auditTable(rows, full = false) {
  if (!rows.length) return '<div class="empty">No platform events recorded yet.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Entity</th><th>Actor</th><th>Time</th></tr></thead><tbody>${rows.map(e=>`<tr><td><b>${escapeHtml(e.action)}</b><small>Request ${escapeHtml(e.request_id)}</small></td><td>${escapeHtml(e.entity_type)}<small>${escapeHtml(e.entity_id)}</small></td><td>${escapeHtml(e.actor_user_id)}</td><td>${formatDate(e.created_at,true)}</td></tr>`).join('')}</tbody></table></div>`;
}
function formatDate(value, time = false) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',...(time?{timeStyle:'short'}:{})}).format(date);
}
function bindTenantActions() {
  root.querySelectorAll('[data-tenant-id]').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.tenantId, isActive = button.dataset.active === 'true';
    const action = isActive ? 'suspend' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} this tenant? Existing tenant sessions will be denied by tenant access checks.`)) return;
    button.disabled = true;
    try {
      await api(`/tenants/${encodeURIComponent(id)}/status`,{method:'PATCH',body:{isActive:!isActive}});
      notify(`Tenant ${action}d successfully.`,'success');
      await loadPage('tenants');
    } catch(error) { notify(error.message,'error'); button.disabled = false; }
  }));
}
function showCreateTenant() {
  const layer = document.createElement('div');
  layer.className = 'modal-backdrop';
  layer.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" aria-label="Close">×</button>
      <p class="eyebrow">NEW WORKSPACE</p><h3 id="modal-title">Create tenant</h3><p class="muted">Tenant creation is recorded in the platform audit trail.</p>
      <form id="create-tenant-form">
        <label>Tenant name<input name="name" required minlength="2" maxlength="120" placeholder="Acme Distribution"></label>
        <label>Tenant slug<input name="slug" required minlength="3" maxlength="63" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="acme-distribution"></label>
        <label>Plan / tier<select name="tier"><option value="standard">Standard</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select></label>
        <p class="form-error" id="create-error" role="alert"></p>
        <button class="btn primary full" type="submit">Create tenant</button>
      </form>
    </section>`;
  root.appendChild(layer);
  const close=()=>layer.remove();
  layer.querySelector('.modal-close').addEventListener('click',close);
  layer.addEventListener('click',event=>{if(event.target===layer)close();});
  layer.querySelector('[name="name"]').addEventListener('input',event=>{
    const slug=layer.querySelector('[name="slug"]');
    if(!slug.dataset.edited) slug.value=event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  });
  layer.querySelector('[name="slug"]').addEventListener('input',event=>{event.target.dataset.edited='true';});
  layer.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget, button=form.querySelector('button[type="submit"]'), errorEl=form.querySelector('#create-error');
    const values=Object.fromEntries(new FormData(form).entries());
    button.disabled=true;button.textContent='Creating…';errorEl.textContent='';
    try{
      await api('/tenants',{method:'POST',body:values});
      close();notify('Tenant created and audit event recorded.','success');await loadPage('tenants');
    }catch(error){errorEl.textContent=error.message;button.disabled=false;button.textContent='Create tenant';}
  });
}
async function boot() {
  const ready = await supabaseService.init();
  if (!ready) { renderLogin('Authentication service is not configured.'); return; }
  const { data } = await supabaseService.client.auth.getSession();
  session = data?.session || null;
  if (!session) { renderLogin(); return; }
  try { await verifyAdmin(); await renderConsole(); }
  catch (error) { await supabaseService.signOutUser(); session=null; renderLogin(error.message); }
  supabaseService.client.auth.onAuthStateChange((_event,nextSession)=>{
    if (!nextSession) { session=null; renderLogin(); }
    else session=nextSession;
  });
}
boot().catch(error=>renderLogin(error.message || 'Unable to initialize admin console.'));
