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
export function userChange(account: Pick<Account, 'access_id' | 'access_revision' | 'login' | 'name' | 'active' | 'role_ids' | 'group_ids' | 'profile'>, patch: Partial<UserChange>): AccessChange {
    if (account.access_id === undefined || account.access_revision === undefined || !account.role_ids || !account.group_ids)
        throw new Error('Не загружена полная карточка пользователя');
    const profile = patch.profile === undefined ? account.profile : patch.profile;
    return { user: { id: account.access_id, revision: account.access_revision, login: account.login, name: account.name, active: account.active, role_ids: [...account.role_ids], group_ids: [...account.group_ids], reset_password: false, ...patch, ...(profile === undefined ? {} : { profile: normalizeProfile(profile) }) } };
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
export type AccessField = 'name'|'login'|'password'|'organization'|'ngdu'|'department'|'job_title'|'workplace_organization'|'workplace_division'|'workplace_department'|'manager_id'|'profile';
export class AccessFieldError extends Error {
 readonly field:AccessField;
 constructor(field:AccessField,message:string){super(message);this.name='AccessFieldError';this.field=field;}
}
export function validateUserChange(user:UserChange,password:string,departmentPending=false):void {
 validateProfile(user);
 if(!user.name.trim())throw new AccessFieldError('name','Введите имя и фамилию.');
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._@-]{2,79}$/.test(user.login))throw new AccessFieldError('login','Введите логин: 3–80 латинских букв, цифр, точка, дефис, @ или _.');
 if(user.id===null&&(!user.organization||user.organization.kind==='none'))throw new AccessFieldError('organization','Выберите подразделение нового пользователя.');
 if((user.id===null||password)&&(Array.from(password).length<15||new TextEncoder().encode(password).length>72))throw new AccessFieldError('password','Пароль: минимум 15 символов, максимум 72 байта UTF-8.');
 if(departmentPending)throw new AccessFieldError('department','После смены НГДУ явно выберите цех или всё НГДУ.');
 if(user.organization&&(user.organization.kind==='ngdu'||user.organization.kind==='department')&&user.organization.ngdu_id===null)throw new AccessFieldError('ngdu','Выберите НГДУ.');
 if(user.organization?.kind==='department'&&user.organization.department_id===null)throw new AccessFieldError('department','Выберите цех.');
}
export function blockAccessNavigation(dirty:boolean,pending:boolean):boolean{return dirty||pending;}
interface AccessNavigationLocation {pathname:string;search:string;hash?:string}
/** Изменение условий таблицы текущей группы не закрывает и не меняет черновик. */
export function blockAccessLocationNavigation(dirty:boolean,pending:boolean,current:AccessNavigationLocation,next:AccessNavigationLocation,ownerGroupId:string|null|undefined):boolean {
 if(!blockAccessNavigation(dirty,pending))return false;
 if(current.pathname===next.pathname&&current.search===next.search)return false;
 if(ownerGroupId!==undefined&&current.pathname===next.pathname&&(current.hash??'')===(next.hash??'')){
  const before=new URLSearchParams(current.search),after=new URLSearchParams(next.search),id=ownerGroupId??'new';
  if(before.get('entity')==='groups'&&after.get('entity')==='groups'&&before.get('id')===id&&after.get('id')===id){
   for(const mode of ['members','candidates']){const key=`table.group-members-${id}-${mode}`;before.delete(key);after.delete(key);}
   if(before.toString()===after.toString())return false;
  }
 }
 return true;
}


import type { ManagedProfile } from '../api/people';
export function normalizeProfile(profile: ManagedProfile): ManagedProfile {
 if (!profile || !profile.workplace) throw new AccessFieldError('profile','Сервер не поддерживает этот профиль.');
 const text = (value: string | null) => { if (value === null) return null; if (typeof value !== 'string') throw new AccessFieldError('profile','Профиль неполон. Перечитайте карточку.'); return value.trim() || null; };
 return { revision: profile.revision, job_title: text(profile.job_title), workplace: { organization: text(profile.workplace.organization), division: text(profile.workplace.division), department: text(profile.workplace.department) }, manager_id: profile.manager_id };
}
export function validateProfile(user: UserChange): void {
 if (user.profile === undefined) return;
 const p = normalizeProfile(user.profile);
 if (!/^(0|[1-9]\d*)$/.test(p.revision) || (user.id !== null && p.revision === '0')) throw new AccessFieldError('profile','Недоступна версия профиля. Перечитайте карточку.');
 const fields: [AccessField,string|null][] = [['job_title',p.job_title],['workplace_organization',p.workplace.organization],['workplace_division',p.workplace.division],['workplace_department',p.workplace.department]];
 for(const [field,value] of fields) if(value !== null && Array.from(value).length > 200) throw new AccessFieldError(field,'Максимум 200 символов.');
 if(p.manager_id !== null && (!/^[1-9]\d*$/.test(p.manager_id) || BigInt(p.manager_id) > 9223372036854775807n || p.manager_id === user.id)) throw new AccessFieldError('manager_id','Выберите другого существующего руководителя.');
}
/** Server classification is authoritative; absent additive fields promise no revoke. */
export function sessionEffectMessage(effect: 'none' | 'revoke_on_apply' | 'revoked' | undefined): string {
 if(effect === 'none') return 'Действующие сеансы сохранятся.';
 if(effect === 'revoke_on_apply') return 'Изменения завершат затронутые действующие сеансы. Потребуется войти снова.';
 if(effect === 'revoked') return 'Затронутые сеансы завершены. Потребуется войти снова.';
 return 'Последствия для сеансов определяет сервер.';
}
export function userEditorLocation(id: string | null, params: URLSearchParams): string {
 const query = new URLSearchParams({tab:'users'});
 const search = params.get('search'); if(search) query.set('search',search);
 return `/system/access/users/${id === null ? 'new' : `${encodeURIComponent(id)}/edit`}?${query}`;
}
/** Exact existing validation envelopes; generic profile failures are not manager failures. */
export function serverUserFieldError(status: number, body: {code?:unknown;message?:unknown} | undefined, user: UserChange | undefined): AccessFieldError | null {
 if(status !== 422 || body?.code !== 'validation_error')return null;
 if(body.message === 'Цикл руководителей недопустим' || body.message === 'Руководитель не найден')return new AccessFieldError('manager_id',body.message);
 if(body.message === 'Некорректный профиль сотрудника' && user?.id != null && user.profile?.manager_id === user.id)return new AccessFieldError('manager_id','Сотрудник не может быть своим руководителем.');
 return null;
}
/** Keep the route token unchanged until its heading exists, then focus exactly once. */
export function focusRouteHeading(route: string, heading: Pick<HTMLElement,'focus'> | null, previous: string | undefined): string | undefined {
 if(route !== previous && heading){heading.focus();return route;}
 return previous;
}
