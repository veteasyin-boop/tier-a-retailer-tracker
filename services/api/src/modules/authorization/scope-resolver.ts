export type OrgUnit = {
  id: string;
  parent_id: string | null;
};

export type AssignedOrgScope = {
  org_unit_id: string;
  include_descendants: boolean;
};

/**
 * Expands only explicitly assigned org-unit scopes.
 * The primary organizational placement is deliberately not treated as an access grant.
 */
export function resolveScopeUnitIds(
  assignments: AssignedOrgScope[],
  units: OrgUnit[]
): string[] {
  const childrenByParent = new Map<string, string[]>();
  const knownIds = new Set(units.map((unit) => unit.id));

  for (const unit of units) {
    if (!unit.parent_id) continue;
    const children = childrenByParent.get(unit.parent_id) ?? [];
    children.push(unit.id);
    childrenByParent.set(unit.parent_id, children);
  }

  const resolved = new Set<string>();
  for (const assignment of assignments) {
    if (!knownIds.has(assignment.org_unit_id)) continue;
    resolved.add(assignment.org_unit_id);
    if (!assignment.include_descendants) continue;

    const queue = [...(childrenByParent.get(assignment.org_unit_id) ?? [])];
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next || resolved.has(next)) continue;
      resolved.add(next);
      queue.push(...(childrenByParent.get(next) ?? []));
    }
  }

  return [...resolved].sort();
}
