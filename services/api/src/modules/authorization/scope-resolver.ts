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
 * Primary organizational placement is descriptive and is never an access grant.
 *
 * The expansion-visited set is deliberately separate from the resolved set:
 * an explicitly scoped child can later be reached through an ancestor scope
 * that includes descendants, in which case its descendants must also expand.
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
  const expanded = new Set<string>();

  for (const assignment of assignments) {
    if (!knownIds.has(assignment.org_unit_id)) continue;
    resolved.add(assignment.org_unit_id);
    if (!assignment.include_descendants || expanded.has(assignment.org_unit_id)) continue;

    const queue = [assignment.org_unit_id];
    expanded.add(assignment.org_unit_id);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (!current) continue;

      for (const childId of childrenByParent.get(current) ?? []) {
        resolved.add(childId);
        if (expanded.has(childId)) continue;
        expanded.add(childId);
        queue.push(childId);
      }
    }
  }

  return [...resolved].sort();
}
