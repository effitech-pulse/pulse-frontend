import { Alert, Button, Checkbox, Input, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { managementApi, type Account, type UserChange, type PermissionDefinition } from '@/api/access';
import { useAuth } from '@/auth/AuthProvider';
import { changeNgdu } from '@/lib/accessDraft';
import { AccessError, AssignmentSelector, organizationLabel } from './UsersPanel';
export function UserAccessDrawer({ value, account, onChange, password, onPassword, onDepartmentPending, onClose, catalog }: {
    value: UserChange;
    account: Account | null;
    onChange: (patch: Partial<UserChange>) => void;
    password: string;
    onPassword: (s: string) => void;
    onDepartmentPending: (v: boolean) => void;
    onClose: () => void;
    catalog: PermissionDefinition[];
}) {
    const { can, privateEpoch } = useAuth();
    const [all, setAll] = useState(false);
    const mutable = value.id === null ? can('users.create') : can('users.update');
    const scope = useQuery({ queryKey: ['access', 'organizations', privateEpoch], queryFn: managementApi.orgOptions, enabled: can('users.scope.assign'), retry: false });
    const org = value.organization ?? account?.organization_scope;
    const names = Object.fromEntries(catalog.map(p => [p.key, p.name]));
    return <div className="access-form"><p className="access-note">{account ? `${account.name} · ${account.login}` : 'Новая личная учётная запись'}</p><Button type="text" className="access-close" onClick={onClose}>Закрыть</Button><h2>Учётная запись</h2>
 <label>Имя и фамилия<Input value={value.name} disabled={!mutable} maxLength={120} onChange={e => onChange({ name: e.target.value })}/></label>
 <label>Логин<Input value={value.login} disabled={!mutable} autoComplete="username" spellCheck={false} onChange={e => onChange({ login: e.target.value })}/></label>
 <Checkbox checked={value.active} disabled={!mutable} onChange={e => onChange({ active: e.target.checked })}>Учётная запись активна</Checkbox>
 <label>{account ? 'Новый пароль' : 'Пароль'}<Input.Password value={password} disabled={!mutable} autoComplete="new-password" placeholder={account ? 'Оставьте пустым, чтобы сохранить' : 'Минимум 15 символов'} onChange={e => onPassword(e.target.value)}/></label>
 <h2>Подразделение</h2><p>{organizationLabel(account?.organization_scope, account?.legacy_scope)}</p>
 {account?.legacy_scope && !value.organization && <Alert type="info" message="Сохранена прежняя область доступа" description={`НГДУ: ${account.scope.ngdus?.join(', ') ?? 'все'} · Цеха: ${account.scope.departments?.join(', ') ?? 'все'}. Обычная правка не меняет область.`}/>}
 {can('users.scope.assign') ? <>{scope.isError ? <AccessError error={scope.error} retry={() => void scope.refetch()}/> : <>
 <label>Область подразделения<Select aria-label="Область подразделения" loading={scope.isPending} value={value.organization?.kind ?? (account?.legacy_scope ? undefined : org?.kind)} placeholder="Выберите область" onChange={kind => {onDepartmentPending(false);onChange({ organization: { kind, ngdu_id: null, department_id: null } });}} options={[...(can('access.manage_global') ? [{ value: 'organization', label: 'Вся организация' }] : []), { value: 'ngdu', label: 'НГДУ' }, { value: 'department', label: 'Цех' }]}/></label>
 {(org?.kind === 'ngdu' || org?.kind === 'department') && <label>НГДУ<Select aria-label="НГДУ" value={org.ngdu_id} options={scope.data?.ngdus.map(n => ({ value: n.id, label: n.name }))} onChange={id => { onDepartmentPending(true); onChange({ organization: changeNgdu(org, id) }); }}/></label>}
 {(org?.kind === 'ngdu' || org?.kind === 'department') && <label>Цех<Select aria-label="Цех" placeholder="Выберите цех или всё НГДУ" value={org.department_id} options={[{ value: '__all__', label: 'Всё НГДУ' }, ...(scope.data?.departments.filter(d => scope.data?.pairs.some(p => p.ngdu_id === org.ngdu_id && p.department_id === d.id)).map(d => ({ value: d.id, label: d.name })) ?? [])]} onChange={id => { onDepartmentPending(false); onChange({ organization: { kind: id === '__all__' ? 'ngdu' : 'department', ngdu_id: org.ngdu_id, department_id: id === '__all__' ? null : id } }); }}/></label>}
 </>}</> : <p>Подразделение доступно только для чтения.</p>}
 <p className="access-note">Смена НГДУ требует нового выбора цеха. Группы не расширяют область данных.</p><h2>Роли и группы</h2>
 <section aria-label="Назначены напрямую"><h3>Назначены напрямую</h3><AssignmentSelector kind="roles" value={value.role_ids} onChange={role_ids => onChange({ role_ids })} disabled={!can('users.roles.assign')} labels={Object.fromEntries(account?.direct_roles?.map(r => [r.id, r.name]) ?? [])}/></section>
 <section aria-label="Группы пользователей"><h3>Группы пользователей</h3><AssignmentSelector kind="groups" value={value.group_ids} onChange={group_ids => onChange({ group_ids })} disabled={!can('users.groups.assign')} labels={Object.fromEntries(account?.groups?.map(g => [g.id, g.name]) ?? [])}/></section>
 <div className="pulse-system-callout"><strong>Получены через группы</strong><p>{account?.roles?.filter(r => account.groups?.some(g => value.group_ids.includes(g.id) && g.role_ids.includes(r.id))).map(r => `${r.name} — ${account.groups?.filter(g => value.group_ids.includes(g.id) && g.role_ids.includes(r.id)).map(g => `группа «${g.name}»`).join(', ')}`).join('; ') || 'Нет сохранённых источников через выбранные группы'}. Снятие прямой роли не отменяет её другие источники.</p></div>
 <h2>Итоговые права</h2><p className="access-note">Сохранённые права и все источники. Новые назначения будут рассчитаны в предпросмотре.</p>
 {(account?.permission_keys ?? []).slice(0, all ? undefined : 3).map(key => <div key={key}><strong>{names[key] ?? key}</strong>{account?.permission_sources?.[key]?.map((s, i) => <div key={i}>{s.role_name} → {s.group_id === null ? 'напрямую' : `группа «${s.group_name}»`}</div>)}</div>)}<Button type="text" onClick={() => setAll(v => !v)}>{all ? 'Свернуть права' : 'Все права и источники'}</Button>
 <p className="access-note">Проверка изменений покажет новые права и персональную область. Назначения при переводе не меняются автоматически.</p></div>;
}
