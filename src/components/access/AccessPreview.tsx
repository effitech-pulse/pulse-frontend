import {PulseTable} from '@/components/common/PulseTable';
import {entityColumns} from '@/components/common/LocalEntityTable';
import type {EntityField} from '@/components/common/LocalEntityTable';
import {createEmptyTableQuery,type TableQuery} from '@/lib/tableQuery';
import { Alert, Button, Skeleton } from 'antd';
import type { AccessImpact, AccessPreviewResponse, AccessSnapshot, PermissionDefinition } from '@/api/access';
import { impactCounts, sessionEffectMessage } from '@/lib/accessDraft';
import { organizationLabel } from './UsersPanel';
function PermissionSources({snapshot,names}:{snapshot:AccessSnapshot;names:Record<string,string>}){
 return <>{Object.entries(snapshot.permission_sources??{}).map(([key,sources])=><div key={key}><strong>{names[key]??key}</strong>{sources.map((source,index)=><div key={index}>{source.role_name} → {source.group_id===null?'напрямую':`группа «${source.group_name}»`}</div>)}</div>)}</>;
}
export function AccessPreview({ preview, search, onSearch, loading, onNext, onBack, hasBack, catalog, userChange, query=createEmptyTableQuery(), onQueryChange=()=>{} }: {
    query?:TableQuery;onQueryChange?:(query:TableQuery)=>void;
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
    const fields:EntityField<AccessImpact>[]=[
 {key:'user_name',label:'Пользователь',kind:'text',read:r=>r.user.name},
 {key:'before_organization',label:'Подразделение до',column:'Подразделение',primary:true,kind:'text',read:r=>organizationLabel(r.before.organization_scope,r.before.legacy_scope)},
 {key:'after_organization',label:'Подразделение после',column:'Подразделение',kind:'text',read:r=>organizationLabel(r.after.organization_scope,r.after.legacy_scope)},
 {key:'before_active',label:'Статус до',column:'Статус',primary:true,kind:'boolean',read:r=>r.before.active},{key:'after_active',label:'Статус после',column:'Статус',kind:'boolean',read:r=>r.after.active},
 {key:'added_permissions',label:'Добавятся',column:'Что изменится',primary:true,kind:'enum',options:catalog.map(p=>({value:p.key,label:p.name})),read:r=>r.after.permission_keys?.filter(k=>!r.before.permission_keys?.includes(k)).join(',')??''},
 {key:'removed_permissions',label:'Уйдут',column:'Что изменится',kind:'enum',options:catalog.map(p=>({value:p.key,label:p.name})),read:r=>r.before.permission_keys?.filter(k=>!r.after.permission_keys?.includes(k)).join(',')??''},
 {key:'source_role_ids',label:'Роли-источники после',column:'Источники',primary:true,kind:'enum',options:preview?.table_filter_options?.source_role_ids??[],read:r=>Array.from(new Set(Object.values(r.after.permission_sources??{}).flatMap(s=>s.map(v=>v.role_id)))).join(',')},
 {key:'source_group_ids',label:'Группы-источники после',column:'Источники',kind:'enum',options:preview?.table_filter_options?.source_group_ids??[],read:r=>Array.from(new Set(Object.values(r.after.permission_sources??{}).flatMap(s=>s.map(v=>v.group_id).filter((v):v is string=>v!==null)))).join(',')},
 ];
    return <div className="access-form"><p>Затронуто пользователей: {counts.assigned ?? '—'} · Права изменятся: {counts.changed ?? '—'} · Среди затронутых отключены: {counts.disabled ?? '—'}</p>
 <div className="pulse-system-callout"><strong>{userChange ? sessionEffectMessage(preview?.session_effect) : 'Подразделения участников не изменятся'}</strong><p>Предпросмотр ещё не изменяет сведения и назначения.</p></div>
 {preview?.profile_change && <section className="profile-preview" aria-label="Сведения сотрудника"><h2>Сведения сотрудника</h2>{([['До изменения',preview.profile_change.before],['После изменения',preview.profile_change.after]] as const).map(([label,snapshot])=><div key={label}><h3>{label}</h3>{snapshot?<><p>{snapshot.name}</p><dl>{([['Должность',snapshot.profile.job_title],['Организация',snapshot.profile.workplace.organization],['Подразделение',snapshot.profile.workplace.division],['Отдел',snapshot.profile.workplace.department],['Руководитель',snapshot.profile.manager_id===null?null:`ID ${snapshot.profile.manager_id}`]] as const).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value??'Не указано'}</dd></div>)}</dl></>:<p>Новый сотрудник</p>}</div>)}</section>}
 {loading && !preview ? <Skeleton active/> : <PulseTable<AccessImpact> mode="server" schema={{fields,defaultSort:[],rowId:r=>r.user.access_id!}} query={query} onQueryChange={onQueryChange} page={{items:preview?.items??[],next_cursor:preview?.next_cursor??null}} pagination={{canPrevious:hasBack,onPrevious:onBack,onNext}}
 rowKey={i => i.user.access_id!} loading={loading} scroll={{ x: 780 }} locale={{ emptyText: search ? <><p>Ничего не найдено</p><Button onClick={() => onSearch('')}>Сбросить поиск</Button></> : 'Нет пользователей в последствиях изменения' }} columns={entityColumns<AccessImpact>([
                { title: 'Пользователь', render: (_, i) => i.user.name },
                { title: 'Подразделение', render: (_, i) => <>{organizationLabel(i.before.organization_scope, i.before.legacy_scope)} → {organizationLabel(i.after.organization_scope, i.after.legacy_scope)}</> },
                { title: 'Что изменится', render: (_, i) => <><div>Прямые роли до: {i.before.direct_roles?.map(r => r.name).join(', ') || 'нет ролей'} / {i.before.groups?.map(g => g.name).join(', ') || 'нет групп'}</div><div>Прямые роли после: {i.after.direct_roles?.map(r => r.name).join(', ') || 'нет ролей'} / {i.after.groups?.map(g => g.name).join(', ') || 'нет групп'}</div><div>Итоговые роли до: {i.before.roles?.map(r=>r.name).join(', ')||'нет ролей'}</div><div>Итоговые роли после: {i.after.roles?.map(r=>r.name).join(', ')||'нет ролей'}</div><div>Добавятся: {i.after.permission_keys?.filter(k => !i.before.permission_keys?.includes(k)).map(label).join(', ') || '—'}</div><div>Уйдут: {i.before.permission_keys?.filter(k => !i.after.permission_keys?.includes(k)).map(label).join(', ') || '—'}</div></> },
                { title: 'Статус', render: (_, i) => `${i.before.active?'Активен':'Отключён'} → ${i.after.active?'Активен':'Отключён'}` },
                { title: 'Источники', render: (_, i) => <><h3>Источники до изменения</h3><PermissionSources snapshot={i.before} names={names}/><h3>Источники после изменения</h3><PermissionSources snapshot={i.after} names={names}/></> },
            ],fields)}/>}

 {preview?.self_affected && <Alert type="warning" message="Изменения затрагивают ваш доступ" description="После применения может потребоваться повторный вход."/>}
 <h2>Права сохранятся через другой источник</h2>{preview?.items.filter(i => i.retained_by_other_source.length > 0).map(i => <p key={i.user.access_id}>{i.user.name}: {i.retained_by_other_source.map(label).join(', ')}. {i.after.groups?.map(g => `Группа «${g.name}»`).join(', ')}</p>)}
 </div>;
}
