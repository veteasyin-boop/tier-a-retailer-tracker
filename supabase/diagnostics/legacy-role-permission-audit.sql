-- Read-only diagnostic: inspect legacy and tenant-copied role grants.
-- Run only after the Growta tenant RBAC migration has been applied.
-- This script does not mutate data and deliberately does not decide which
-- permissions a tenant role should retain.

-- 1. Source catalogue: the global legacy role-permission mapping.
SELECT
  r.id AS role_code,
  r.name AS role_name,
  COUNT(DISTINCT rp.permission_id) AS granted_permission_count,
  (SELECT COUNT(*) FROM public.permissions) AS catalogue_permission_count,
  COALESCE(
    ARRAY_AGG(DISTINCT p.id ORDER BY p.id)
      FILTER (WHERE p.id IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS granted_permissions
FROM public.roles AS r
LEFT JOIN public.role_permissions AS rp ON rp.role_id = r.id
LEFT JOIN public.permissions AS p ON p.id = rp.permission_id
GROUP BY r.id, r.name
ORDER BY r.id;

-- 2. Tenant copies: compare each tenant's copied grants with the source.
SELECT
  tr.tenant_id,
  tr.code AS role_code,
  tr.name AS role_name,
  tr.is_active,
  COUNT(DISTINCT trp.permission_code) AS granted_permission_count,
  COALESCE(
    ARRAY_AGG(DISTINCT trp.permission_code ORDER BY trp.permission_code)
      FILTER (WHERE trp.permission_code IS NOT NULL),
    ARRAY[]::TEXT[]
  ) AS granted_permissions
FROM public.tenant_roles AS tr
LEFT JOIN public.tenant_role_permissions AS trp
  ON trp.tenant_id = tr.tenant_id
 AND trp.role_id = tr.id
GROUP BY tr.tenant_id, tr.code, tr.name, tr.is_active
ORDER BY tr.tenant_id, tr.code;

-- 3. Highlight roles whose source mapping is empty or grants the entire
-- catalogue. This is diagnostic only; do not auto-modify these mappings.
WITH permission_totals AS (
  SELECT COUNT(*)::BIGINT AS total FROM public.permissions
),
role_counts AS (
  SELECT
    r.id AS role_code,
    COUNT(DISTINCT rp.permission_id)::BIGINT AS granted
  FROM public.roles AS r
  LEFT JOIN public.role_permissions AS rp ON rp.role_id = r.id
  GROUP BY r.id
)
SELECT
  rc.role_code,
  rc.granted AS granted_permission_count,
  pt.total AS catalogue_permission_count,
  CASE
    WHEN rc.granted = 0 THEN 'NO_GRANTS_REVIEW'
    WHEN rc.granted = pt.total THEN 'ALL_PERMISSIONS_REVIEW'
    ELSE 'PARTIAL_GRANTS'
  END AS review_status
FROM role_counts AS rc
CROSS JOIN permission_totals AS pt
ORDER BY
  CASE
    WHEN rc.granted = 0 OR rc.granted = pt.total THEN 0
    ELSE 1
  END,
  rc.role_code;
