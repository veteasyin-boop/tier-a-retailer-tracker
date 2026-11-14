-- ============================================================================
-- GROWTA: TENANT-OWNED ORGANOGRAM AND DYNAMIC RBAC
-- Additive migration. Does not rewrite legacy users/roles/organizations.
--
-- Identity: Supabase Auth auth.users
-- Authorization: active tenant membership + tenant role permissions
-- Security: RLS derives identity from auth.uid(); never trusts X-Tenant-ID or
-- a caller-controlled PostgreSQL setting as an authorization source.
-- ============================================================================
begin;

create schema if not exists growta_private;
revoke all on schema growta_private from public, anon;
grant usage on schema growta_private to authenticated;

-- 1. Tenant-owned organization units. unit_type is tenant-defined
-- (e.g. company, state, region, zone, territory, HQ, department, branch).
create table if not exists public.tenant_org_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_unit_id uuid,
  unit_type text not null check (length(trim(unit_type)) between 1 and 60),
  name text not null check (length(trim(name)) between 1 and 160),
  code text not null check (length(trim(code)) between 1 and 60),
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tenant_org_unit_id unique (tenant_id, id),
  constraint uq_tenant_org_unit_code unique (tenant_id, code),
  constraint fk_tenant_org_unit_parent
    foreign key (tenant_id, parent_unit_id)
    references public.tenant_org_units(tenant_id, id)
    on delete restrict
);

create index if not exists idx_tenant_org_units_parent
  on public.tenant_org_units(tenant_id, parent_unit_id);
create index if not exists idx_tenant_org_units_active
  on public.tenant_org_units(tenant_id, is_active, sort_order);

create or replace function growta_private.prevent_org_unit_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_unit_id is null then
    return new;
  end if;

  if new.parent_unit_id = new.id then
    raise exception 'An organizational unit cannot be its own parent'
      using errcode = '23514';
  end if;

  if exists (
    with recursive ancestors(id, parent_unit_id) as (
      select u.id, u.parent_unit_id
      from public.tenant_org_units u
      where u.tenant_id = new.tenant_id and u.id = new.parent_unit_id
      union
      select p.id, p.parent_unit_id
      from public.tenant_org_units p
      join ancestors a on p.id = a.parent_unit_id
      where p.tenant_id = new.tenant_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'Organizational hierarchy cycle detected'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_org_unit_cycle on public.tenant_org_units;
create trigger trg_prevent_org_unit_cycle
before insert or update of parent_unit_id, tenant_id
on public.tenant_org_units
for each row execute function growta_private.prevent_org_unit_cycle();

-- 2. Tenant-owned designations. Designation is a job title, not a permission role.
create table if not exists public.tenant_designations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  code text not null check (length(trim(code)) between 1 and 60),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tenant_designation_id unique (tenant_id, id),
  constraint uq_tenant_designation_code unique (tenant_id, code)
);

-- 3. Tenant membership is the relationship between a Supabase identity
-- and one tenant. The same auth user may have many tenant memberships.
create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  employee_code text,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  designation_id uuid,
  org_unit_id uuid,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'inactive', 'suspended', 'invited')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tenant_membership_id unique (tenant_id, id),
  constraint uq_tenant_auth_user unique (tenant_id, auth_user_id),
  constraint fk_membership_designation
    foreign key (tenant_id, designation_id)
    references public.tenant_designations(tenant_id, id)
    on delete restrict,
  constraint fk_membership_org_unit
    foreign key (tenant_id, org_unit_id)
    references public.tenant_org_units(tenant_id, id)
    on delete restrict
);

create unique index if not exists uq_tenant_employee_code
  on public.tenant_memberships(tenant_id, employee_code)
  where employee_code is not null;
create index if not exists idx_tenant_memberships_user
  on public.tenant_memberships(auth_user_id, employment_status);
create index if not exists idx_tenant_memberships_org
  on public.tenant_memberships(tenant_id, org_unit_id, employment_status);

-- 4. Permission vocabulary is platform-defined; roles are tenant-defined.
create table if not exists public.tenant_permission_catalog (
  permission_code text primary key,
  module text not null,
  description text not null,
  is_active boolean not null default true
);

insert into public.tenant_permission_catalog(permission_code, module, description)
values
 ('retailer.read','retailers','Read retailer records'),
 ('retailer.create','retailers','Create retailer records'),
 ('retailer.update','retailers','Update retailer records'),
 ('retailer.reassign','retailers','Reassign retailer ownership or territory'),
 ('retailer.export','retailers','Export retailer records'),
 ('visit.checkin','visits','Submit field visit check-ins'),
 ('visit.review','visits','Review field visits'),
 ('order.create','orders','Create commercial orders'),
 ('order.approve','orders','Approve commercial orders'),
 ('attendance.punch','attendance','Record attendance punches'),
 ('attendance.regularize','attendance','Request attendance regularization'),
 ('attendance.approve','attendance','Approve attendance regularization'),
 ('tada.claim','tada','Submit travel and allowance claims'),
 ('tada.approve','tada','Approve travel and allowance claims'),
 ('leave.apply','leave','Apply for leave'),
 ('leave.approve','leave','Approve leave applications'),
 ('inventory.read','inventory','Read inventory'),
 ('inventory.issue','inventory','Issue inventory'),
 ('inventory.reconcile','inventory','Reconcile inventory'),
 ('kpi.configure','performance','Configure KPI rules'),
 ('sop.manage','operations','Manage standard operating procedures'),
 ('ai.query','ai','Use approved AI query capabilities'),
 ('organization.read','organization','Read tenant organizational structure'),
 ('organization.manage','organization','Create and manage organizational units'),
 ('designation.manage','organization','Create and manage tenant designations'),
 ('membership.read','identity','Read tenant memberships'),
 ('membership.manage','identity','Invite, activate, suspend, and manage memberships'),
 ('reporting.manage','organization','Manage reporting relationships'),
 ('scope.assign','authorization','Assign organizational data scopes'),
 ('role.manage','authorization','Create roles and grant permissions within caller authority'),
 ('audit.read','audit','Read tenant audit events')
on conflict (permission_code) do update
set module = excluded.module,
    description = excluded.description;

create table if not exists public.tenant_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_key text not null check (length(trim(role_key)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_tenant_role_id unique (tenant_id, id),
  constraint uq_tenant_role_key unique (tenant_id, role_key)
);

create table if not exists public.tenant_role_permissions (
  tenant_id uuid not null,
  role_id uuid not null,
  permission_code text not null references public.tenant_permission_catalog(permission_code)
    on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tenant_id, role_id, permission_code),
  constraint fk_tenant_role_permission_role
    foreign key (tenant_id, role_id)
    references public.tenant_roles(tenant_id, id)
    on delete cascade
);

create table if not exists public.tenant_membership_roles (
  tenant_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (tenant_id, membership_id, role_id),
  constraint fk_membership_role_membership
    foreign key (tenant_id, membership_id)
    references public.tenant_memberships(tenant_id, id)
    on delete cascade,
  constraint fk_membership_role_role
    foreign key (tenant_id, role_id)
    references public.tenant_roles(tenant_id, id)
    on delete cascade
);

create index if not exists idx_tenant_role_permissions_role
  on public.tenant_role_permissions(tenant_id, role_id);
create index if not exists idx_tenant_membership_roles_membership
  on public.tenant_membership_roles(tenant_id, membership_id);

-- A membership may have multiple scoped grants. "tenant" and "self" do not
-- need an org unit; "unit" is exact-unit access; "subtree" includes descendants.
create table if not exists public.tenant_membership_scopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  membership_id uuid not null,
  scope_type text not null check (scope_type in ('tenant', 'self', 'unit', 'subtree')),
  org_unit_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint fk_membership_scope_membership
    foreign key (tenant_id, membership_id)
    references public.tenant_memberships(tenant_id, id)
    on delete cascade,
  constraint fk_membership_scope_org_unit
    foreign key (tenant_id, org_unit_id)
    references public.tenant_org_units(tenant_id, id)
    on delete cascade,
  constraint ck_membership_scope_unit
    check (
      (scope_type in ('unit', 'subtree') and org_unit_id is not null)
      or (scope_type in ('tenant', 'self') and org_unit_id is null)
    )
);

create unique index if not exists uq_tenant_membership_scope
  on public.tenant_membership_scopes(
    tenant_id, membership_id, scope_type, coalesce(org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists idx_membership_scopes_unit
  on public.tenant_membership_scopes(tenant_id, org_unit_id);

-- Multiple reporting relationships support primary and dotted-line managers.
create table if not exists public.tenant_reporting_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  report_membership_id uuid not null,
  manager_membership_id uuid not null,
  relationship_type text not null default 'primary'
    check (relationship_type in ('primary', 'dotted')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint fk_reporting_report
    foreign key (tenant_id, report_membership_id)
    references public.tenant_memberships(tenant_id, id)
    on delete cascade,
  constraint fk_reporting_manager
    foreign key (tenant_id, manager_membership_id)
    references public.tenant_memberships(tenant_id, id)
    on delete cascade,
  constraint ck_reporting_not_self check (report_membership_id <> manager_membership_id),
  constraint ck_reporting_dates check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists uq_primary_reporting_manager
  on public.tenant_reporting_lines(tenant_id, report_membership_id)
  where relationship_type = 'primary' and ends_at is null;
create index if not exists idx_reporting_manager
  on public.tenant_reporting_lines(tenant_id, manager_membership_id)
  where ends_at is null;
create index if not exists idx_reporting_report
  on public.tenant_reporting_lines(tenant_id, report_membership_id)
  where ends_at is null;

create or replace function growta_private.prevent_reporting_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.relationship_type <> 'primary' or new.ends_at is not null then
    return new;
  end if;

  if exists (
    with recursive manager_chain(membership_id) as (
      select new.manager_membership_id
      union
      select rl.manager_membership_id
      from public.tenant_reporting_lines rl
      join manager_chain mc on rl.report_membership_id = mc.membership_id
      where rl.tenant_id = new.tenant_id
        and rl.relationship_type = 'primary'
        and rl.ends_at is null
        and (tg_op <> 'UPDATE' or rl.id <> new.id)
    )
    select 1 from manager_chain where membership_id = new.report_membership_id
  ) then
    raise exception 'Primary reporting hierarchy cycle detected'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_reporting_cycle on public.tenant_reporting_lines;
create trigger trg_prevent_reporting_cycle
before insert or update of tenant_id, report_membership_id, manager_membership_id, relationship_type, ends_at
on public.tenant_reporting_lines
for each row execute function growta_private.prevent_reporting_cycle();

-- 5. Authorization helpers. These functions are private, use auth.uid(),
-- and do not trust user-editable metadata or caller-supplied tenant context.
create or replace function growta_private.has_tenant_permission(
  p_tenant_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.tenant_memberships m
      join public.tenant_membership_roles mr
        on mr.tenant_id = m.tenant_id and mr.membership_id = m.id
      join public.tenant_roles r
        on r.tenant_id = mr.tenant_id and r.id = mr.role_id
      join public.tenant_role_permissions rp
        on rp.tenant_id = r.tenant_id and rp.role_id = r.id
      join public.tenant_permission_catalog pc
        on pc.permission_code = rp.permission_code and pc.is_active
      where m.tenant_id = p_tenant_id
        and m.auth_user_id = (select auth.uid())
        and m.employment_status = 'active'
        and r.is_active
        and rp.permission_code = p_permission_code
    );
$$;

create or replace function growta_private.can_assign_tenant_role(
  p_tenant_id uuid,
  p_role_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    growta_private.has_tenant_permission(p_tenant_id, 'membership.manage')
    and growta_private.has_tenant_permission(p_tenant_id, 'role.manage')
    and exists (
      select 1 from public.tenant_roles target_role
      where target_role.tenant_id = p_tenant_id
        and target_role.id = p_role_id
        and target_role.is_active
    )
    and not exists (
      select 1
      from public.tenant_role_permissions target_permission
      where target_permission.tenant_id = p_tenant_id
        and target_permission.role_id = p_role_id
        and not growta_private.has_tenant_permission(
          p_tenant_id, target_permission.permission_code
        )
    );
$$;

revoke all on function growta_private.has_tenant_permission(uuid, text) from public, anon;
revoke all on function growta_private.can_assign_tenant_role(uuid, uuid) from public, anon;
grant execute on function growta_private.has_tenant_permission(uuid, text) to authenticated;
grant execute on function growta_private.can_assign_tenant_role(uuid, uuid) to authenticated;

create or replace function growta_private.can_assign_membership_scope(
  p_tenant_id uuid,
  p_membership_id uuid,
  p_scope_type text,
  p_org_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $scope$
  with actor_scopes as (
    select s.scope_type, s.org_unit_id
    from public.tenant_memberships actor
    join public.tenant_membership_scopes s
      on s.tenant_id = actor.tenant_id and s.membership_id = actor.id
    where actor.tenant_id = p_tenant_id
      and actor.auth_user_id = (select auth.uid())
      and actor.employment_status = 'active'
  ),
  permitted_subtree(unit_id) as (
    select org_unit_id from actor_scopes where scope_type = 'subtree'
    union
    select child.id
    from public.tenant_org_units child
    join permitted_subtree parent on child.parent_unit_id = parent.unit_id
    where child.tenant_id = p_tenant_id
  )
  select
    growta_private.has_tenant_permission(p_tenant_id, 'membership.manage')
    and growta_private.has_tenant_permission(p_tenant_id, 'scope.assign')
    and exists (
      select 1
      from public.tenant_memberships target
      where target.tenant_id = p_tenant_id
        and target.id = p_membership_id
        and (
          (p_scope_type = 'self' and target.auth_user_id = (select auth.uid()))
          or exists (
            select 1 from actor_scopes a
            where a.scope_type = 'tenant'
          )
          or (
            p_scope_type = 'unit'
            and exists (
              select 1 from actor_scopes a
              where a.scope_type = 'unit' and a.org_unit_id = p_org_unit_id
            )
          )
          or (
            p_scope_type in ('unit', 'subtree')
            and p_org_unit_id in (select unit_id from permitted_subtree)
          )
        )
    );
$scope$;

revoke all on function growta_private.can_assign_membership_scope(uuid, uuid, text, uuid) from public, anon;
grant execute on function growta_private.can_assign_membership_scope(uuid, uuid, text, uuid) to authenticated;

-- 6. Immutable audit events for organizational and authorization changes.
create table if not exists public.tenant_org_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenant_org_audit_tenant_time
  on public.tenant_org_audit_events(tenant_id, created_at desc);
create index if not exists idx_tenant_org_audit_entity
  on public.tenant_org_audit_events(tenant_id, entity_type, entity_id);

create or replace function growta_private.audit_tenant_org_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  row_data jsonb;
  event_tenant_id uuid;
  event_entity_id text;
begin
  if tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    row_data := new_row;
  elsif tg_op = 'UPDATE' then
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);
    row_data := new_row;
  else
    old_row := to_jsonb(old);
    row_data := old_row;
  end if;

  event_tenant_id := (row_data ->> 'tenant_id')::uuid;
  event_entity_id := coalesce(row_data ->> 'id', row_data ->> 'membership_id',
                              row_data ->> 'role_id', 'unknown');

  insert into public.tenant_org_audit_events(
    tenant_id, actor_auth_user_id, action, entity_type, entity_id, old_data, new_data
  )
  values (
    event_tenant_id, auth.uid(), tg_op, tg_table_name, event_entity_id,
    old_row, new_row
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function growta_private.audit_tenant_org_change() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenant_org_units',
    'tenant_designations',
    'tenant_memberships',
    'tenant_roles',
    'tenant_role_permissions',
    'tenant_membership_roles',
    'tenant_membership_scopes',
    'tenant_reporting_lines'
  ]
  loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', table_name, table_name);
    execute format(
      'create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function growta_private.audit_tenant_org_change()',
      table_name, table_name
    );
  end loop;
end;
$$;

-- 7. RLS: every tenant table is isolated by verified membership permissions.
alter table public.tenant_org_units enable row level security;
alter table public.tenant_designations enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_permission_catalog enable row level security;
alter table public.tenant_roles enable row level security;
alter table public.tenant_role_permissions enable row level security;
alter table public.tenant_membership_roles enable row level security;
alter table public.tenant_membership_scopes enable row level security;
alter table public.tenant_reporting_lines enable row level security;
alter table public.tenant_org_audit_events enable row level security;

drop policy if exists tenant_permission_catalog_read on public.tenant_permission_catalog;
create policy tenant_permission_catalog_read
on public.tenant_permission_catalog for select to authenticated
using (is_active = true);

drop policy if exists tenant_org_units_read on public.tenant_org_units;
create policy tenant_org_units_read
on public.tenant_org_units for select to authenticated
using (
  growta_private.has_tenant_permission(tenant_id, 'organization.read')
  or growta_private.has_tenant_permission(tenant_id, 'organization.manage')
);

drop policy if exists tenant_org_units_manage on public.tenant_org_units;
create policy tenant_org_units_manage
on public.tenant_org_units for all to authenticated
using (growta_private.has_tenant_permission(tenant_id, 'organization.manage'))
with check (growta_private.has_tenant_permission(tenant_id, 'organization.manage'));

drop policy if exists tenant_designations_read on public.tenant_designations;
create policy tenant_designations_read
on public.tenant_designations for select to authenticated
using (
  growta_private.has_tenant_permission(tenant_id, 'organization.read')
  or growta_private.has_tenant_permission(tenant_id, 'designation.manage')
);

drop policy if exists tenant_designations_manage on public.tenant_designations;
create policy tenant_designations_manage
on public.tenant_designations for all to authenticated
using (growta_private.has_tenant_permission(tenant_id, 'designation.manage'))
with check (growta_private.has_tenant_permission(tenant_id, 'designation.manage'));

drop policy if exists tenant_memberships_read on public.tenant_memberships;
create policy tenant_memberships_read
on public.tenant_memberships for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or growta_private.has_tenant_permission(tenant_id, 'membership.read')
  or growta_private.has_tenant_permission(tenant_id, 'membership.manage')
);

drop policy if exists tenant_memberships_manage on public.tenant_memberships;
create policy tenant_memberships_manage
on public.tenant_memberships for all to authenticated
using (growta_private.has_tenant_permission(tenant_id, 'membership.manage'))
with check (growta_private.has_tenant_permission(tenant_id, 'membership.manage'));

drop policy if exists tenant_roles_read on public.tenant_roles;
create policy tenant_roles_read
on public.tenant_roles for select to authenticated
using (growta_private.has_tenant_permission(tenant_id, 'role.manage'));

drop policy if exists tenant_roles_manage on public.tenant_roles;
create policy tenant_roles_manage
on public.tenant_roles for all to authenticated
using (
  not is_system
  and growta_private.has_tenant_permission(tenant_id, 'role.manage')
)
with check (
  not is_system
  and growta_private.has_tenant_permission(tenant_id, 'role.manage')
);

drop policy if exists tenant_role_permissions_read on public.tenant_role_permissions;
create policy tenant_role_permissions_read
on public.tenant_role_permissions for select to authenticated
using (growta_private.has_tenant_permission(tenant_id, 'role.manage'));

drop policy if exists tenant_role_permissions_manage on public.tenant_role_permissions;
drop policy if exists tenant_role_permissions_insert on public.tenant_role_permissions;
create policy tenant_role_permissions_insert
on public.tenant_role_permissions for insert to authenticated
with check (
  growta_private.has_tenant_permission(tenant_id, 'role.manage')
  and growta_private.has_tenant_permission(tenant_id, permission_code)
  and exists (
    select 1 from public.tenant_roles r
    where r.tenant_id = tenant_role_permissions.tenant_id
      and r.id = tenant_role_permissions.role_id
      and not r.is_system
  )
);
drop policy if exists tenant_role_permissions_delete on public.tenant_role_permissions;
create policy tenant_role_permissions_delete
on public.tenant_role_permissions for delete to authenticated
using (
  growta_private.has_tenant_permission(tenant_id, 'role.manage')
  and exists (
    select 1 from public.tenant_roles r
    where r.tenant_id = tenant_role_permissions.tenant_id
      and r.id = tenant_role_permissions.role_id
      and not r.is_system
  )
);

drop policy if exists tenant_membership_roles_read on public.tenant_membership_roles;
create policy tenant_membership_roles_read
on public.tenant_membership_roles for select to authenticated
using (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_membership_roles.tenant_id
      and m.id = tenant_membership_roles.membership_id
      and m.auth_user_id = (select auth.uid())
      and m.employment_status = 'active'
  )
  or growta_private.has_tenant_permission(tenant_id, 'membership.read')
  or growta_private.has_tenant_permission(tenant_id, 'membership.manage')
);

drop policy if exists tenant_membership_roles_manage on public.tenant_membership_roles;
drop policy if exists tenant_membership_roles_insert on public.tenant_membership_roles;
create policy tenant_membership_roles_insert
on public.tenant_membership_roles for insert to authenticated
with check (growta_private.can_assign_tenant_role(tenant_id, role_id));
drop policy if exists tenant_membership_roles_delete on public.tenant_membership_roles;
create policy tenant_membership_roles_delete
on public.tenant_membership_roles for delete to authenticated
using (
  growta_private.has_tenant_permission(tenant_id, 'membership.manage')
  and growta_private.has_tenant_permission(tenant_id, 'role.manage')
);

drop policy if exists tenant_membership_scopes_read on public.tenant_membership_scopes;
create policy tenant_membership_scopes_read
on public.tenant_membership_scopes for select to authenticated
using (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_membership_scopes.tenant_id
      and m.id = tenant_membership_scopes.membership_id
      and m.auth_user_id = (select auth.uid())
      and m.employment_status = 'active'
  )
  or growta_private.has_tenant_permission(tenant_id, 'membership.read')
  or growta_private.has_tenant_permission(tenant_id, 'scope.assign')
);

drop policy if exists tenant_membership_scopes_manage on public.tenant_membership_scopes;
drop policy if exists tenant_membership_scopes_insert on public.tenant_membership_scopes;
create policy tenant_membership_scopes_insert
on public.tenant_membership_scopes for insert to authenticated
with check (
  growta_private.can_assign_membership_scope(tenant_id, membership_id, scope_type, org_unit_id)
);
drop policy if exists tenant_membership_scopes_delete on public.tenant_membership_scopes;
create policy tenant_membership_scopes_delete
on public.tenant_membership_scopes for delete to authenticated
using (
  growta_private.has_tenant_permission(tenant_id, 'membership.manage')
  and growta_private.has_tenant_permission(tenant_id, 'scope.assign')
);

drop policy if exists tenant_reporting_lines_read on public.tenant_reporting_lines;
create policy tenant_reporting_lines_read
on public.tenant_reporting_lines for select to authenticated
using (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_reporting_lines.tenant_id
      and m.id = tenant_reporting_lines.report_membership_id
      and m.auth_user_id = (select auth.uid())
      and m.employment_status = 'active'
  )
  or exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_reporting_lines.tenant_id
      and m.id = tenant_reporting_lines.manager_membership_id
      and m.auth_user_id = (select auth.uid())
      and m.employment_status = 'active'
  )
  or growta_private.has_tenant_permission(tenant_id, 'membership.read')
  or growta_private.has_tenant_permission(tenant_id, 'reporting.manage')
);

drop policy if exists tenant_reporting_lines_manage on public.tenant_reporting_lines;
create policy tenant_reporting_lines_manage
on public.tenant_reporting_lines for all to authenticated
using (growta_private.has_tenant_permission(tenant_id, 'reporting.manage'))
with check (growta_private.has_tenant_permission(tenant_id, 'reporting.manage'));

drop policy if exists tenant_org_audit_events_read on public.tenant_org_audit_events;
create policy tenant_org_audit_events_read
on public.tenant_org_audit_events for select to authenticated
using (growta_private.has_tenant_permission(tenant_id, 'audit.read'));

-- Deliberately no INSERT/UPDATE/DELETE policy on audit events. The trigger is
-- the only write path for authenticated application users.
grant select on public.tenant_permission_catalog to authenticated;
grant select, insert, update, delete on
  public.tenant_org_units,
  public.tenant_designations,
  public.tenant_memberships,
  public.tenant_roles,
  public.tenant_role_permissions,
  public.tenant_membership_roles,
  public.tenant_membership_scopes,
  public.tenant_reporting_lines
to authenticated;
grant select on public.tenant_org_audit_events to authenticated;

commit;
