import './styles/workspace-admin.css';
import { auth } from './services/auth.js';
import { supabaseService } from './services/supabase.js';

const root=document.getElementById('workspace-admin-root');
let state=null, page='employees', roleData=null, orgData=null;
const API=String(import.meta.env?.VITE_API_BASE_URL||window.location.origin).replace(/\/$/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message,error=false){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.className=error?'toast error':'toast';el.hidden=false;setTimeout(()=>el.hidden=true,4000);}
async function request(path,options={}){
 const session=await supabaseService.getCurrentSession();if(!session?.access_token)throw new Error('Session expired. Sign in again.');
 const headers={Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,'X-Tenant-ID':auth.selectedTenantId};
 const response=await fetch(`${API}/api/v1${path}`,{method:options.method||'GET',headers,body:options.body?JSON.stringify(options.body):undefined,credentials:'omit',cache:'no-store'});
 let body;try{body=await response.json()}catch{throw new Error('Invalid API response.')}
 if(!response.ok||body.success!==true){const e=new Error(body?.error?.message||`Request failed (${response.status})`);e.status=response.status;throw e;}return body;
}
function can(permission){return auth.can(permission);}
function signIn(message=''){
 root.innerHTML=`<main class="login"><section><div class="brand">growta<span>.</span></div><p class="eyebrow">TENANT CONTROL CENTRE</p><h1>Manage your<br>organisation.</h1><p class="muted">Use your existing Growta email and password. Access is controlled by your tenant membership and permissions.</p><form id="login"><label>Work email<input id="email" type="email" required autocomplete="username" maxlength="254"></label><label>Password<input id="password" type="password" required autocomplete="current-password" maxlength="256"></label><p id="error" class="error-text">${esc(message)}</p><button class="primary full">Sign in →</button></form></section></main>`;
 document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;b.textContent='Verifying…';try{await auth.signIn(document.getElementById('email').value,document.getElementById('password').value);await boot()}catch(err){document.getElementById('error').textContent=err.message;b.disabled=false;b.textContent='Sign in →'}});
}
function tenantPicker(){
 const tenants=state.tenants||[];
 root.innerHTML=`<main class="login"><section><div class="brand">growta<span>.</span></div><p class="eyebrow">SELECT WORKSPACE</p><h1>Choose your<br>organisation.</h1><p class="muted">Your account belongs to more than one tenant.</p><form id="choose"><label>Workspace<select id="tenant" required><option value="">Select tenant</option>${tenants.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${esc(t.slug)}</option>`).join('')}</select></label><button class="primary full">Continue →</button></form><button id="signout" class="secondary full">Sign out</button></section></main>`;
 document.getElementById('choose').addEventListener('submit',async e=>{e.preventDefault();try{await auth.selectTenant(document.getElementById('tenant').value);state=auth.getState();await render()}catch(err){toast(err.message,true)}});
 document.getElementById('signout').addEventListener('click',()=>auth.signOut().then(()=>signIn()));
}
function shell(){
 const tenant=state.tenants.find(t=>t.id===state.selectedTenantId);
 root.innerHTML=`<div class="layout"><aside><a class="brand" href="/workspace-admin">growta<span>.</span></a><small class="subbrand">WORKSPACE ADMIN</small><div class="tenant-chip"><b>${esc(tenant?.name||'Workspace')}</b><small>${esc(tenant?.slug||'')}</small></div><p class="nav-label">MANAGE</p><button data-page="employees">♙ &nbsp; Employees</button><button data-page="roles">▤ &nbsp; Roles & permissions</button><button data-page="org">⌘ &nbsp; Organogram</button><div class="aside-bottom"><button id="switch">⇄ Switch workspace</button><button id="logout">↗ Sign out</button></div></aside><main><header><div><p class="crumb">WORKSPACE / ADMINISTRATION</p><h2 id="heading">Employees</h2></div><div class="identity"><span>${esc(state.user?.email||'')}</span><i>${esc((state.user?.email||'U').slice(0,1).toUpperCase())}</i></div></header><div id="toast" class="toast" hidden></div><section id="content"><div class="loading">Loading…</div></section><footer>Growta One · Tenant-scoped administration</footer></main></div>`;
 root.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>loadPage(b.dataset.page)));
 document.getElementById('switch').addEventListener('click',()=>{auth.clearSelectedTenant();state=auth.getState();tenantPicker()});
 document.getElementById('logout').addEventListener('click',async()=>{await auth.signOut();signIn()});
}
async function render(){state=auth.getState();if(state.status==='signed_out'||!state.user){signIn();return}if(state.status==='tenant_selection'){tenantPicker();return}if(state.status==='no_memberships'){signIn('This account has no active tenant membership.');return}if(state.status!=='tenant_ready'){signIn(state.error||'Unable to load tenant access.');return}shell();await loadPage(page)}
async function loadPage(next){page=next;root.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const title={employees:'Employees',roles:'Roles & permissions',org:'Organogram'}[page];document.getElementById('heading').textContent=title;const content=document.getElementById('content');content.innerHTML='<div class="loading">Loading tenant data…</div>';
 try{
  if(page==='employees')await employees(content);
  if(page==='roles')await roles(content);
  if(page==='org')await organogram(content);
 }catch(e){content.innerHTML=`<div class="panel"><b>Unable to load this module</b><p class="muted">${esc(e.message)}</p><button id="retry" class="secondary">Retry</button></div>`;document.getElementById('retry').onclick=()=>loadPage(page);if(e.status===403)toast('Your tenant role does not grant access to this action.',true)}
}
async function employees(content){
 if(!can('membership.read')){content.innerHTML='<div class="panel">You do not have permission to view employees.</div>';return}
 const r=await request('/memberships?limit=100&offset=0');const rows=r.data||[];
 content.innerHTML=`<div class="page-intro"><div><p class="eyebrow">PEOPLE DIRECTORY</p><h1>Employees</h1><p class="muted">Tenant memberships, assigned roles and reporting information.</p></div><span class="count">${r.meta?.total??rows.length} members</span></div><div class="toolbar"><input id="employee-search" type="search" placeholder="Search name or role…"><select id="employee-status"><option value="">All statuses</option><option>active</option><option>invited</option><option>suspended</option></select></div><div id="employee-table">${employeeTable(rows)}</div><p class="note">Employee invitations and organizational assignment editing are not enabled yet; they require dedicated server-side workflows.</p>`;
 const draw=()=>{const q=document.getElementById('employee-search').value.toLowerCase(),s=document.getElementById('employee-status').value;document.getElementById('employee-table').innerHTML=employeeTable(rows.filter(x=>(!s||x.status===s)&&[x.profile?.fullName,x.userId,...(x.roles||[]).map(y=>y.name)].join(' ').toLowerCase().includes(q)));bindMemberActions()};
 document.getElementById('employee-search').addEventListener('input',draw);document.getElementById('employee-status').addEventListener('change',draw);bindMemberActions();
}
function employeeTable(rows){if(!rows.length)return '<div class="panel empty">No employees match this filter.</div>';return `<div class="table-wrap"><table><thead><tr><th>Employee</th><th>Roles</th><th>Organisation</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(m=>`<tr><td><b>${esc(m.profile?.fullName||'Name not set')}</b><small>${esc(m.userId)}</small></td><td>${esc((m.roles||[]).map(r=>r.name).join(', ')||'No roles')}</td><td>${esc(m.organization?.unit?.name||'Not assigned')}<small>${esc(m.organization?.designation?.name||'')}</small></td><td><span class="pill ${m.status}">${esc(m.status)}</span></td><td>${can('membership.manage')&&m.status!=='invited'? `<button class="action" data-membership="${esc(m.id)}" data-status="${esc(m.status)}">${m.status==='active'?'Suspend':'Reactivate'}</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`}
function bindMemberActions(){root.querySelectorAll('[data-membership]').forEach(b=>b.addEventListener('click',async()=>{const active=b.dataset.status==='active',next=active?'suspended':'active';if(!confirm(`${active?'Suspend':'Reactivate'} this employee's tenant membership?`))return;b.disabled=true;try{await request(`/memberships/${encodeURIComponent(b.dataset.membership)}/status`,{method:'PATCH',body:{status:next}});toast('Membership status updated.');await loadPage('employees')}catch(e){toast(e.message,true);b.disabled=false}}))}
async function roles(content){
 if(!can('role.manage')){content.innerHTML='<div class="panel">You do not have permission to manage roles.</div>';return}
 const r=await request('/roles?limit=100&offset=0&includeInactive=true');roleData=r.data;
 content.innerHTML=`<div class="page-intro"><div><p class="eyebrow">ACCESS CONTROL</p><h1>Roles & permissions</h1><p class="muted">Configure tenant-specific roles against the shared permission catalogue.</p></div><button id="new-role" class="primary">＋ Create role</button></div><div id="role-list" class="role-grid">${roleCards(roleData.roles||[])}</div>`;
 document.getElementById('new-role').onclick=()=>roleEditor();root.querySelectorAll('[data-role-edit]').forEach(b=>b.onclick=()=>roleEditor(roleData.roles.find(x=>x.id===b.dataset.roleEdit)));
}
function roleCards(rows){if(!rows.length)return '<div class="panel">No tenant roles configured.</div>';return rows.map(r=>`<article class="role-card"><div class="role-head"><span class="pill ${r.is_active?'active':'suspended'}">${r.is_active?'Active':'Inactive'}</span><small>${r.is_system?'System role':'Custom role'}</small></div><h3>${esc(r.name)}</h3><p class="muted">${esc(r.code)} · ${esc(r.description||'No description')}</p><div class="permission-tags">${(r.permissions||[]).slice(0,6).map(p=>`<span>${esc(p)}</span>`).join('')}${r.permissions?.length>6?`<span>+${r.permissions.length-6} more</span>`:''}</div><button class="secondary" data-role-edit="${esc(r.id)}" ${r.is_system?'disabled':''}>Edit role</button></article>`).join('')}
function roleEditor(role=null){
 const catalog=roleData.permissionCatalog||[], selected=new Set(role?.permissions||[]);
 const layer=document.createElement('div');layer.className='overlay';layer.innerHTML=`<section class="dialog"><button class="close" type="button">×</button><p class="eyebrow">${role?'UPDATE ROLE':'NEW TENANT ROLE'}</p><h2>${role?'Edit role':'Create role'}</h2><form id="role-form"><label>Role code<input name="code" ${role?'readonly':''} required pattern="[A-Z][A-Z0-9_]{1,49}" maxlength="50" value="${esc(role?.code||'')}" placeholder="AREA_MANAGER"></label><label>Role name<input name="name" required minlength="2" maxlength="100" value="${esc(role?.name||'')}"></label><label>Description<textarea name="description" maxlength="500">${esc(role?.description||'')}</textarea></label><div class="catalog"><b>Permissions</b><div class="permission-list">${catalog.map(p=>`<label class="check"><input type="checkbox" value="${esc(p.code)}" ${selected.has(p.code)?'checked':''}><span><b>${esc(p.code)}</b><small>${esc(p.description||p.category)}</small></span></label>`).join('')}</div></div>${role? `<label class="toggle"><input name="isActive" type="checkbox" ${role.is_active?'checked':''}> Role is active</label>`:''}<p id="role-error" class="error-text"></p><button class="primary full" type="submit">${role?'Save role':'Create role'}</button></form></section>`;
 root.appendChild(layer);const close=()=>layer.remove();layer.querySelector('.close').onclick=close;layer.addEventListener('click',e=>{if(e.target===layer)close()});
 layer.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button[type=submit]'),err=f.querySelector('#role-error'),fd=new FormData(f);const permissions=[...f.querySelectorAll('.permission-list input:checked')].map(x=>x.value);const body={name:fd.get('name'),description:fd.get('description')||null,permissions};if(role){body.isActive=f.elements.isActive.checked}else{body.code=fd.get('code').trim().toUpperCase()}b.disabled=true;b.textContent='Saving…';try{await request(role?`/roles/${encodeURIComponent(role.id)}`:'/roles',{method:role?'PATCH':'POST',body});close();toast('Role saved successfully.');await loadPage('roles')}catch(error){err.textContent=error.message;b.disabled=false;b.textContent=role?'Save role':'Create role'}};
}
async function organogram(content){
 if(!can('organization.read')){content.innerHTML='<div class="panel">You do not have permission to view the organogram.</div>';return}
 const [units,types,desigs]=await Promise.all([request('/organization/units?limit=100&offset=0&includeInactive=true'),request('/organization/unit-types?limit=100&offset=0&includeInactive=true'),request('/organization/designations?limit=100&offset=0&includeInactive=true')]);
 orgData={units:units.data||[],types:types.data||[],designations:desigs.data||[]};
 const typeMap=new Map(orgData.types.map(x=>[x.id,x.name]));
 const manageOrg=can('organization.manage'),manageDesignation=can('designation.manage');
 content.innerHTML=`<div class="page-intro"><div><p class="eyebrow">ORGANISATION DESIGN</p><h1>Dynamic organogram</h1><p class="muted">Configure the reporting structure independently for this tenant.</p></div><span class="count">Tenant scoped</span></div>
 <div class="org-stats"><div><b>${orgData.units.length}</b><small>Visible units</small></div><div><b>${orgData.types.length}</b><small>Unit types</small></div><div><b>${orgData.designations.length}</b><small>Designations</small></div></div>
 <div class="panel"><div class="panel-head"><div><h3>Organizational units</h3><p class="muted">Parent-child hierarchy. Cycles are rejected by the database.</p></div>${manageOrg?'<button class="primary" id="add-unit">＋ Add unit</button>':''}</div>
 <div class="unit-list">${orgData.units.length?orgData.units.map(u=>`<div class="unit-row" style="--depth:${Math.min(depth(u,orgData.units),5)}"><span class="unit-dot"></span><div><b>${esc(u.name)}</b><small>${esc(u.code)} · ${esc(typeMap.get(u.unit_type_id)||'Unclassified')}</small></div><span class="pill ${u.is_active?'active':'suspended'}">${u.is_active?'Active':'Inactive'}</span>${manageOrg?`<button class="action edit-unit" data-id="${esc(u.id)}">Edit</button>`:''}</div>`).join(''):'<p class="muted">No units are visible in your current scope.</p>'}</div></div>
 <div class="panel"><div class="panel-head"><div><h3>Unit types</h3><p class="muted">Define tenant-specific levels such as Region, Area, Territory or Branch.</p></div>${manageOrg?'<button class="secondary" id="add-type">＋ Add type</button>':''}</div><div class="designation-grid">${orgData.types.map(t=>`<div><b>${esc(t.name)}</b><small>${esc(t.code)} · ${t.is_active?'Active':'Inactive'}</small>${manageOrg?`<button class="action edit-type" data-id="${esc(t.id)}">Edit</button>`:''}</div>`).join('')||'<p class="muted">No unit types configured.</p>'}</div></div>
 <div class="panel"><div class="panel-head"><div><h3>Designation catalogue</h3><p class="muted">Job titles are descriptive and do not grant permissions.</p></div>${manageDesignation?'<button class="secondary" id="add-designation">＋ Add designation</button>':''}</div><div class="designation-grid">${orgData.designations.map(d=>`<div><b>${esc(d.name)}</b><small>${esc(d.code)} · ${d.is_active?'Active':'Inactive'}</small>${manageDesignation?`<button class="action edit-designation" data-id="${esc(d.id)}">Edit</button>`:''}</div>`).join('')||'<p class="muted">No designations configured.</p>'}</div></div>`;
 if(manageOrg){document.getElementById('add-unit').onclick=()=>orgRecordEditor('unit');document.getElementById('add-type').onclick=()=>orgRecordEditor('unit_type');root.querySelectorAll('.edit-unit').forEach(b=>b.onclick=()=>orgRecordEditor('unit',orgData.units.find(x=>x.id===b.dataset.id)));root.querySelectorAll('.edit-type').forEach(b=>b.onclick=()=>orgRecordEditor('unit_type',orgData.types.find(x=>x.id===b.dataset.id)));}
 if(manageDesignation){document.getElementById('add-designation').onclick=()=>orgRecordEditor('designation');root.querySelectorAll('.edit-designation').forEach(b=>b.onclick=()=>orgRecordEditor('designation',orgData.designations.find(x=>x.id===b.dataset.id)));}
}
function orgRecordEditor(entity,record=null){
 const isUnit=entity==='unit',isType=entity==='unit_type',isDesignation=entity==='designation';
 const title=isUnit?'Organizational unit':isType?'Unit type':'Designation';
 const layer=document.createElement('div');layer.className='overlay';
 const typeOptions=orgData.types.map(t=>`<option value="${esc(t.id)}" ${record?.unit_type_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('');
 const parentOptions=orgData.units.filter(u=>u.id!==record?.id).map(u=>`<option value="${esc(u.id)}" ${record?.parent_id===u.id?'selected':''}>${esc(u.name)}</option>`).join('');
 layer.innerHTML=`<section class="dialog"><button class="close" type="button">×</button><p class="eyebrow">TENANT ORGANISATION</p><h2>${record?'Edit':'Create'} ${title.toLowerCase()}</h2><form id="org-record-form">
 <label>Code<input name="code" required pattern="[A-Z0-9][A-Z0-9_-]{1,49}" maxlength="50" value="${esc(record?.code||'')}" ${record?'readonly':''} placeholder="NORTH_REGION"></label>
 <label>Name<input name="name" required minlength="2" maxlength="120" value="${esc(record?.name||'')}"></label>
 <label>Description<textarea name="description" maxlength="500">${esc(record?.description||'')}</textarea></label>
 ${isUnit? `<label>Unit type<select name="unitTypeId" required><option value="">Select type</option>${typeOptions}</select></label><label>Parent unit<select name="parentId"><option value="">No parent / root unit</option>${parentOptions}</select></label>`:''}
 ${isType? `<label>Sort order<input name="sortOrder" type="number" min="0" max="100000" value="${esc(record?.sort_order??0)}"></label>`:''}
 <label class="toggle"><input name="isActive" type="checkbox" ${record?.is_active===false?'':'checked'}> Active</label>
 <p id="org-error" class="error-text"></p><button class="primary full" type="submit">Save ${title.toLowerCase()}</button></form></section>`;
 root.appendChild(layer);const close=()=>layer.remove();layer.querySelector('.close').onclick=close;layer.addEventListener('click',e=>{if(e.target===layer)close()});
 layer.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button[type=submit]'),err=f.querySelector('#org-error'),fd=new FormData(f);
 const body={code:fd.get('code').trim().toUpperCase(),name:fd.get('name'),description:fd.get('description')||null,isActive:f.elements.isActive.checked};
 if(isUnit){body.unitTypeId=fd.get('unitTypeId');body.parentId=fd.get('parentId')||null}
 if(isType)body.sortOrder=Number(fd.get('sortOrder')||0);
 const base=isUnit?'units':isType?'unit-types':'designations';b.disabled=true;b.textContent='Saving…';
 try{await request(record?`/organization/${base}/${encodeURIComponent(record.id)}`:`/organization/${base}`,{method:record?'PATCH':'POST',body});close();toast(`${title} saved.`);await loadPage('org')}
 catch(error){err.textContent=error.message;b.disabled=false;b.textContent=`Save ${title.toLowerCase()}`}
 };
}
function depth(unit,units){let d=0,p=unit.parent_id,seen=new Set([unit.id]);while(p&&d<6){if(seen.has(p))break;seen.add(p);const parent=units.find(x=>x.id===p);if(!parent)break;p=parent.parent_id;d++}return d}
async function boot(){const s=await auth.initialize();state=s;if(s.status==='tenant_ready'){await render();return}if(s.status==='tenant_selection'){tenantPicker();return}signIn(s.error||'')}
boot().catch(e=>signIn(e.message||'Unable to initialize tenant admin.'));
