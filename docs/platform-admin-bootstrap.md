# Growta One — first platform administrator bootstrap

Platform administrators are separate from tenant-local roles. Do not create a platform administrator by assigning a tenant role.

## 1. Create the Auth identity

In Supabase Dashboard → Authentication → Users, invite the intended administrator's email address. The administrator must accept the invite and complete the normal email/password sign-in flow.

## 2. Grant platform administrator access

Copy the user's Auth UID from Authentication → Users, then run this SQL in the Supabase SQL Editor:

```sql
insert into public.platform_admins (user_id, status)
values ('<AUTH_USER_UUID>', 'active')
on conflict (user_id)
do update set status = 'active', updated_at = now();
```

Replace `<AUTH_USER_UUID>` with the Auth UID. Never use an email address in this column.

## 3. Verify access

Sign in through the existing email/password login, obtain the user's access token through the application session, and call:

```http
GET /api/v1/platform/admin/me
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

An active platform administrator receives HTTP 200. A signed-in user without an active platform-admin row receives HTTP 403. Unauthenticated requests receive HTTP 401.

## Security

- The `platform_admins` table has RLS enabled and no grants for `anon` or `authenticated`.
- Only the server-side API uses the service-role client to read this table.
- Never place the service-role key in a `VITE_*` variable or browser bundle.
- Suspend access by setting `status = 'suspended'`; remove an administrator only after reviewing audit and operational ownership.
- Do not create a default password or seed a known administrator UUID in migrations.
