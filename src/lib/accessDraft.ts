import type { AccessChange, AccessApply, AccessPreviewResponse, Account, OrganizationScope, UserChange } from '../api/access';
export interface AccessDraft {
    change: AccessChange;
    preview: AccessPreviewResponse | null;
    dirty: boolean;
    version: number;
    epoch: number;
    conflict: boolean;
}
export function createDraft(change: AccessChange, epoch: number): AccessDraft { return { change, preview: null, dirty: false, version: 0, epoch, conflict: false }; }
export function updateDraft(draft: AccessDraft, change: AccessChange): AccessDraft { return { ...draft, change, preview: null, dirty: true, version: draft.version + 1, conflict: false }; }
export function previewTicket(draft: AccessDraft) { return { version: draft.version, epoch: draft.epoch, change: JSON.stringify(draft.change) }; }
export function acceptPreview(draft: AccessDraft, response: AccessPreviewResponse, ticket: ReturnType<typeof previewTicket>, epoch: number): AccessDraft {
    if (draft.epoch !== epoch || ticket.epoch !== epoch || ticket.version !== draft.version || ticket.change !== JSON.stringify(draft.change))
        return { ...draft, preview: null };
    return { ...draft, preview: response, conflict: false };
}
export function applyReceipt(draft: AccessDraft, epoch: number): AccessApply { if (!draft.preview || draft.epoch !== epoch || draft.conflict)
    throw new Error('Сначала обновите предпросмотр'); const p = draft.preview; return { change: draft.change, graph_revision: p.graph_revision, actor_epoch: p.actor_epoch, fingerprint: p.fingerprint }; }
export function rejectApply(draft: AccessDraft, status: number): AccessDraft { return { ...draft, preview: null, conflict: status === 409 }; }
export function userChange(account: Pick<Account, 'access_id' | 'access_revision' | 'login' | 'name' | 'active' | 'role_ids' | 'group_ids'>, patch: Partial<UserChange>): AccessChange {
    if (account.access_id === undefined || account.access_revision === undefined || !account.role_ids || !account.group_ids)
        throw new Error('Не загружена полная карточка пользователя');
    return { user: { id: account.access_id, revision: account.access_revision, login: account.login, name: account.name, active: account.active, role_ids: [...account.role_ids], group_ids: [...account.group_ids], reset_password: false, ...patch } };
}
export function changeNgdu(_scope: OrganizationScope | null, id: string): OrganizationScope { return { kind: 'ngdu', ngdu_id: id, department_id: null }; }
/** Only visible selected entries are replaced; unloaded assignments survive. */
export function mergeSelection(existing: string[], visible: string[], selected: string[]): string[] { const loaded = new Set(visible); return [...new Set([...existing.filter(id => !loaded.has(id)), ...selected])]; }
export function impactCounts(preview: AccessPreviewResponse | null) { return { assigned: preview?.assigned_users ?? null, changed: preview?.changed_users ?? null, disabled: preview?.disabled_users ?? null }; }
export function completeMembers(pages: {
    items: {
        access_id?: string;
    }[];
    next_cursor: string | null;
    graph_revision: string;
}[]): string[] { if (!pages.length || pages.at(-1)?.next_cursor !== null || pages.some(p => p.graph_revision !== pages[0].graph_revision))
    throw new Error('Не загружен полный состав на одной версии'); const ids = pages.flatMap(p => p.items.map(u => { if (u.access_id === undefined)
    throw new Error('Нет access_id'); return u.access_id; })); return [...new Set(ids)]; }
export function validateUserChange(user: UserChange, password: string, departmentPending = false): void {
    if (!user.name.trim() || !/^[a-zA-Z0-9][a-zA-Z0-9._@-]{2,79}$/.test(user.login))
        throw new Error('Введите имя и корректный логин (3–80 символов).');
    if (user.id === null && (!user.organization || user.organization.kind === 'none'))
        throw new Error('Выберите подразделение нового пользователя.');
    if ((user.id === null || password) && (Array.from(password).length < 15 || new TextEncoder().encode(password).length > 72))
        throw new Error('Пароль: минимум 15 символов, максимум 72 байта UTF-8.');
    if (departmentPending)
        throw new Error('После смены НГДУ явно выберите цех или всё НГДУ.');
    if (user.organization && (user.organization.kind === 'ngdu' || user.organization.kind === 'department') && user.organization.ngdu_id === null)
        throw new Error('Выберите НГДУ.');
    if (user.organization?.kind === 'department' && user.organization.department_id === null)
        throw new Error('Выберите цех.');
}
