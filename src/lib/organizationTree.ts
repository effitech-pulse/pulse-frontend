import type { OrganizationTree, OrganizationEmployee, DepartmentNode, DivisionNode, OrganizationNode } from '../api/people';
/** Complete allowlist projection: incomplete/malformed snapshots never become a tree. */
export function parseOrganizationTree(input: unknown): OrganizationTree {
    const fail = (): never => { throw new Error('Получена неполная или некорректная структура'); };
    const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
    const array = (v: unknown): unknown[] => Array.isArray(v) && v.length <= 5000 ? v : fail();
    const text = (v: unknown): string => typeof v === 'string' ? v : fail();
    const nullable = (v: unknown): string | null => v === null ? null : text(v);
    const count = (v: unknown): number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 5000 ? v : fail();
    const keys = new Set<string>(), employees = new Set<string>();
    const branch = (v: unknown) => {
        const b = object(v), key = text(b.key), employee_count = count(b.employee_count);
        if (!/^[A-Za-z0-9_-]+$/.test(key) || keys.has(key) || keys.size >= 15000 || !employee_count) fail();
        keys.add(key);
        return { source: b, key, value: nullable(b.value), employee_count };
    };
    const leaf = (v: unknown): OrganizationEmployee => {
        const p = object(v), id = text(p.id);
        if (id.length > 19 || !/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n || employees.has(id) || employees.size >= 5000 || typeof p.active !== 'boolean') fail();
        employees.add(id);
        return { id, name: text(p.name), job_title: nullable(p.job_title), active: p.active as boolean };
    };
    const root = object(input);
    if (root.complete !== true) fail();
    const organizations: OrganizationNode[] = array(root.organizations).map(org => {
        const o = branch(org);
        const divisions: DivisionNode[] = array(o.source.divisions).map(div => {
            const d = branch(div);
            const departments: DepartmentNode[] = array(d.source.departments).map(dept => {
                const n = branch(dept), items = array(n.source.employees).map(leaf);
                if (items.length !== n.employee_count) fail();
                return { key: n.key, value: n.value, employee_count: n.employee_count, employees: items };
            });
            if (departments.reduce((sum, n) => sum + n.employee_count, 0) !== d.employee_count) fail();
            return { key: d.key, value: d.value, employee_count: d.employee_count, departments };
        });
        if (divisions.reduce((sum, n) => sum + n.employee_count, 0) !== o.employee_count) fail();
        return { key: o.key, value: o.value, employee_count: o.employee_count, divisions };
    });
    const employee_count = count(root.employee_count);
    if (organizations.reduce((sum, n) => sum + n.employee_count, 0) !== employee_count) fail();
    return { complete: true, employee_count, organizations };
}
export interface OrganizationTreeRow {
    key: string; parent: string | null; depth: number; position: number; siblings: number;
    label: string; empty: boolean; count: number; level: string; employee?: OrganizationEmployee;
}
export function flattenOrganizationTree(tree: OrganizationTree, expanded: ReadonlySet<string>): OrganizationTreeRow[] {
    const rows: OrganizationTreeRow[] = [];
    const add = (nodes: (OrganizationNode | DivisionNode | DepartmentNode)[], depth: number, parent: string | null) => {
        nodes.forEach((node, index) => {
            const level = ['Организация', 'Подразделение', 'Отдел'][depth];
            rows.push({ key: node.key, parent, depth, position: index + 1, siblings: nodes.length, label: node.value ?? ['Организация не указана', 'Подразделение не указано', 'Отдел не указан'][depth], empty: node.value === null, count: node.employee_count, level });
            if (!expanded.has(node.key)) return;
            if ('divisions' in node) add(node.divisions, depth + 1, node.key);
            else if ('departments' in node) add(node.departments, depth + 1, node.key);
            else node.employees.forEach((employee, i) => rows.push({ key: `employee:${employee.id}`, parent: node.key, depth: 3, position: i + 1, siblings: node.employees.length, label: employee.name, empty: false, count: 1, level: 'Сотрудник', employee }));
        });
    };
    add(tree.organizations, 0, null);
    return rows;
}
export function organizationTreeError(status: number, body?: { code?: unknown; message?: unknown }): 'unsupported' | 'too_large' | 'timeout' | 'forbidden' | 'error' {
    if ([404, 405, 501].includes(status)) return 'unsupported';
    if (status === 401 || status === 403) return 'forbidden';
    if (status === 503 && body?.code === 'external_service_error') {
        if (body.message === 'organization_tree_too_large') return 'too_large';
        if (body.message === 'organization_tree_timeout') return 'timeout';
    }
    return 'error';
}
/** Variable measured heights, a bounded viewport window and at most one pinned focus row. */
export function organizationTreeWindow(rows: readonly Pick<OrganizationTreeRow, 'key'>[], heights: ReadonlyMap<string, number>, scrollTop: number, viewport: number, active?: string | null) {
    const offsets = [0];
    for (const row of rows) offsets.push(offsets.at(-1)! + Math.max(44, heights.get(row.key) ?? 60));
    let low = 0, high = rows.length;
    while (low < high) { const mid = (low + high) >>> 1; if (offsets[mid + 1] <= scrollTop) low = mid + 1; else high = mid; }
    let end = low;
    while (end < rows.length && offsets[end] < scrollTop + viewport) end++;
    const indices = Array.from({ length: Math.max(0, Math.min(rows.length, end + 8) - Math.max(0, low - 8)) }, (_, i) => Math.max(0, low - 8) + i);
    const pinned = active ? rows.findIndex(row => row.key === active) : -1;
    if (pinned >= 0 && !indices.includes(pinned)) indices.push(pinned);
    indices.sort((a, b) => a - b);
    return { offsets, indices, total: offsets.at(-1)! };
}
export function organizationTreeKey(rows: readonly OrganizationTreeRow[], expanded: ReadonlySet<string>, active: string, key: string) {
    const next = new Set(expanded), index = rows.findIndex(row => row.key === active), row = rows[index];
    let target = active;
    if (!row) return { active: rows[0]?.key ?? null, expanded: next };
    if (key === 'Home') target = rows[0].key;
    if (key === 'End') target = rows.at(-1)!.key;
    if (key === 'ArrowDown') target = rows[Math.min(index + 1, rows.length - 1)].key;
    if (key === 'ArrowUp') target = rows[Math.max(0, index - 1)].key;
    if (key === 'ArrowRight' && !row.employee) {
        if (!next.has(active)) next.add(active);
        else if (rows[index + 1]?.parent === active) target = rows[index + 1].key;
    }
    if (key === 'ArrowLeft') {
        if (next.has(active)) next.delete(active);
        else if (row.parent !== null) target = row.parent;
    }
    return { active: target, expanded: next };
}
