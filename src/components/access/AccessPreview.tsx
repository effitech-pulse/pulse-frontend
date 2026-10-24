import { Alert, Button, Input, Skeleton, Space, Table } from 'antd';
import type { AccessImpact, AccessPreviewResponse, AccessSnapshot, PermissionDefinition } from '@/api/access';
import { impactCounts, sessionEffectMessage } from '@/lib/accessDraft';
import { organizationLabel } from './UsersPanel';
function PermissionSources({snapshot,names}:{snapshot:AccessSnapshot;names:Record<string,string>}){
 return <>{Object.entries(snapshot.permission_sources??{}).map(([key,sources])=><div key={key}><strong>{names[key]??key}</strong>{sources.map((source,index)=><div key={index}>{source.role_name} → {source.group_id===null?'напрямую':`группа «${source.group_name}»`}</div>)}</div>)}</>;
}
export function AccessPreview({ preview, search, onSearch, loading, onNext, onBack, hasBack, catalog, userChange }: {
    preview: AccessPreviewResponse | null;
    search: string;
    onSearch: (s: string) => void;
    loading: boolean;
    onNext: () => void;
    onBack: () => void;
    hasBack: boolean;
    catalog: PermissionDefinition[];
    userChange: boolean;
}) {
    const counts = impactCounts(preview);
    const names = Object.fromEntries(catalog.map(p => [p.key, p.name]));
    const label = (p: string) => names[p] ?? p;
    return <div className="access-form"><p>Затронуто пользователей: {counts.assigned ?? '—'} · Права изменятся: {counts.changed ?? '—'} · Среди затронутых отключены: {counts.disabled ?? '—'}</p>
 <div className="pulse-system-callout"><strong>{userChange ? sessionEffectMessage(preview?.session_effect) : 'Подразделения участников не изменятся'}</strong><p>Предпросмотр ещё не изменяет сведения и назначения.</p></div>
 {preview?.profile_change && <section className="profile-preview" aria-label="Сведения сотрудника"><h2>Сведения сотрудника</h2>{([['До изменения',preview.profile_change.before],['После изменения',preview.profile_change.after]] as const).map(([label,snapshot])=><div key={label}><h3>{label}</h3>{snapshot?<><p>{snapshot.name}</p><dl>{([['Должность',snapshot.profile.job_title],['Организация',snapshot.profile.workplace.organization],['Подразделение',snapshot.profile.workplace.division],['Отдел',snapshot.profile.workplace.department],['Руководитель',snapshot.profile.manager_id===null?null:`ID ${snapshot.profile.manager_id}`]] as const).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value??'Не указано'}</dd></div>)}</dl></>:<p>Новый сотрудник</p>}</div>)}</section>}
 <label>Поиск пользователей<Input placeholder="Поиск по имени или логину" value={search} onChange={e => onSearch(e.target.value)} allowClear/></label>
 {loading && !preview ? <Skeleton active/> : <Table<AccessImpact> rowKey={i => i.user.access_id!} loading={loading} scroll={{ x: 780 }} pagination={false} dataSource={preview?.items} locale={{ emptyText: search ? <><p>Ничего не найдено</p><Button onClick={() => onSearch('')}>Сбросить поиск</Button></> : 'Нет пользователей в последствиях изменения' }} columns={[
                { title: 'Пользователь', render: (_, i) => i.user.name },
                { title: 'Подразделение', render: (_, i) => <>{organizationLabel(i.before.organization_scope, i.before.legacy_scope)} → {organizationLabel(i.after.organization_scope, i.after.legacy_scope)}</> },
                { title: 'Что изменится', render: (_, i) => <><div>Прямые роли до: {i.before.direct_roles?.map(r => r.name).join(', ') || 'нет ролей'} / {i.before.groups?.map(g => g.name).join(', ') || 'нет групп'}</div><div>Прямые роли после: {i.after.direct_roles?.map(r => r.name).join(', ') || 'нет ролей'} / {i.after.groups?.map(g => g.name).join(', ') || 'нет групп'}</div><div>Итоговые роли до: {i.before.roles?.map(r=>r.name).join(', ')||'нет ролей'}</div><div>Итоговые роли после: {i.after.roles?.map(r=>r.name).join(', ')||'нет ролей'}</div><div>Добавятся: {i.after.permission_keys?.filter(k => !i.before.permission_keys?.includes(k)).map(label).join(', ') || '—'}</div><div>Уйдут: {i.before.permission_keys?.filter(k => !i.after.permission_keys?.includes(k)).map(label).join(', ') || '—'}</div></> },
                { title: 'Статус', render: (_, i) => `${i.before.active?'Активен':'Отключён'} → ${i.after.active?'Активен':'Отключён'}` },
                { title: 'Источники', render: (_, i) => <><h3>Источники до изменения</h3><PermissionSources snapshot={i.before} names={names}/><h3>Источники после изменения</h3><PermissionSources snapshot={i.after} names={names}/></> },
            ]}/>}
 <Space><Button disabled={!hasBack || loading} onClick={onBack}>Назад</Button><Button disabled={!preview?.next_cursor || loading} onClick={onNext}>Далее</Button><span>Доступные записи</span></Space>
 {preview?.self_affected && <Alert type="warning" message="Изменения затрагивают ваш доступ" description="После применения может потребоваться повторный вход."/>}
 <h2>Права сохранятся через другой источник</h2>{preview?.items.filter(i => i.retained_by_other_source.length > 0).map(i => <p key={i.user.access_id}>{i.user.name}: {i.retained_by_other_source.map(label).join(', ')}. {i.after.groups?.map(g => `Группа «${g.name}»`).join(', ')}</p>)}
 </div>;
}
