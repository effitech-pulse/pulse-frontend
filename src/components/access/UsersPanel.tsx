import { Alert, Button, Card, Empty, Input, Skeleton, Space, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { managementApi, type Account, type AccessPage, type PageQuery, type OrganizationScope } from '@/api/access';
import { toApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { mergeSelection } from '@/lib/accessDraft';
export function organizationLabel(scope: OrganizationScope | null | undefined, legacy = false) { if (legacy)
    return 'Прежняя область доступа'; if (!scope || scope.kind === 'none')
    return 'Подразделение не назначено'; if (scope.kind === 'organization')
    return 'Вся организация'; return `НГДУ ${scope.ngdu_id}${scope.kind === 'department' ? ` / Цех ${scope.department_id}` : ''}`; }
export function useAccessPage<T>(key: string, read: (query: PageQuery) => Promise<AccessPage<T>>, enabled = true) {
    const { privateEpoch, privateBlocked } = useAuth();
    const [params, setParams] = useSearchParams();
    const linked = ['users', 'groups', 'roles'].includes(key);
    const [localSearch, setSearchValue] = useState('');
    const search = linked ? (params.get('search') ?? '') : localSearch;
    const [history, setHistory] = useState<string[]>([]);
    const [revision, setRevision] = useState<string>();
    const cursor = history.at(-1);
    const query = useQuery({ queryKey: ['access', key, privateEpoch, search, cursor, revision], queryFn: () => read({ search, cursor, graph_revision: revision, limit: 25 }), enabled: enabled && !privateBlocked, retry: false });
    function setSearch(v: string) { if (linked) {
        const next = new URLSearchParams(params);
        if (v)
            next.set('search', v);
        else
            next.delete('search');
        setParams(next);
    }
    else
        setSearchValue(v); setHistory([]); setRevision(undefined); }
    return { ...query, search, setSearch, back: () => setHistory(h => h.slice(0, -1)), hasBack: history.length > 0, next: () => { if (query.data?.next_cursor) {
            setRevision(query.data.graph_revision);
            setHistory(h => [...h, query.data!.next_cursor!]);
        } }, reset: () => { setHistory([]); setRevision(undefined); void query.refetch(); } };
}
export function AccessError({ error, retry }: {
    error: unknown;
    retry: () => void;
}) { return <Alert role="alert" type="error" showIcon message={toApiError(error).message} action={<Button onClick={retry}>Обновить данные</Button>}/>; }
export function PageControls({ page }: {
    page: {
        hasBack: boolean;
        back: () => void;
        next: () => void;
        data?: {
            next_cursor: string | null;
            total_visible: number;
        };
        isFetching: boolean;
    };
}) { return <Space wrap className="access-paging"><Button disabled={!page.hasBack || page.isFetching} onClick={page.back}>Назад</Button><Button disabled={!page.data?.next_cursor || page.isFetching} onClick={page.next}>Далее</Button><span>Доступные записи: {page.isFetching ? '—' : page.data?.total_visible ?? '—'}</span></Space>; }
export function ListFrame({ label, placeholder, search, onSearch, action, children }: {
    label: string;
    placeholder: string;
    search: string;
    onSearch: (s: string) => void;
    action?: ReactNode;
    children: ReactNode;
}) { return <><div className="access-toolbar"><label>{label}<Input value={search} placeholder={placeholder} onChange={e => onSearch(e.target.value)} allowClear/></label>{action}</div>{children}</>; }
export function UsersPanel({ open }: {
    open: (id: string | null) => void;
}) {
    const { can, principal } = useAuth();
    const page = useAccessPage('users', managementApi.users, can('users.read'));
    return <ListFrame label="Поиск пользователя" placeholder="Имя или логин" search={page.search} onSearch={page.setSearch} action={can('users.create') ? <Button type="primary" onClick={() => open(null)}>Добавить пользователя</Button> : null}>
 <Card className="access-list-card">{page.isError ? <AccessError error={page.error} retry={page.reset}/> : page.isPending ? <Skeleton active/> : <>
 <div className="access-desktop"><Table<Account> rowKey={u => u.access_id!} pagination={false} dataSource={page.data?.items} locale={{ emptyText: <Empty description={page.search ? 'Ничего не найдено' : 'Пользователей пока нет'}>{page.search && <Button onClick={() => page.setSearch('')}>Сбросить поиск</Button>}</Empty> }} columns={[
                { title: 'Пользователь', width: '26%', render: (_, u) => <div>{u.name}{u.access_id === principal?.access_id ? ' · вы' : ''}<span className="pulse-cell-meta">{u.login}</span></div> },
                { title: 'Роли и группы', width: '23%', render: (_, u) => <>{u.roles?.map(r => r.name).join(', ') || 'Роли не назначены'}<span className="pulse-cell-meta">{u.groups?.map(g => `Группа «${g.name}»`).join(', ') || (u.direct_roles?.length ? 'Назначены напрямую' : '')}</span></> },
                { title: 'Подразделение', width: '23%', render: (_, u) => organizationLabel(u.organization_scope, u.legacy_scope) },
                { title: 'Статус', width: '12%', render: (_, u) => u.active ? 'Активен' : 'Отключён' },
                { title: 'Действие', render: (_, u) => <Button type="link" onClick={() => open(u.access_id!)}>Настроить</Button> }
            ]}/></div>
 <div className="access-mobile">{page.data?.items.map(u => <div key={u.access_id}><Card><strong>{u.name}</strong><p>{organizationLabel(u.organization_scope, u.legacy_scope)}<br />{u.active ? 'Активен' : 'Отключён'} · {u.roles?.map(r => r.name).join(', ') || 'Нет ролей'}<br />{u.groups?.map(g => `Группа «${g.name}»`).join(', ')}</p></Card><Button block onClick={() => open(u.access_id!)}>Настроить пользователя</Button></div>)}</div><PageControls page={page}/></>}
 </Card></ListFrame>;
}
/** Paginated selectors preserve selected values absent from the currently searched page. */
export function AssignmentSelector({ kind, value, onChange, disabled, labels = {} }: {
    kind: 'roles' | 'groups';
    value: string[];
    onChange: (v: string[]) => void;
    disabled: boolean;
    labels?: Record<string, string>;
}) {
    const { can } = useAuth();
    const page = useAccessPage<{
        id: string;
        name: string;
    }>(`options-${kind}`, kind === 'roles' ? managementApi.roles : managementApi.groups, !disabled && can(kind === 'roles' ? 'roles.read' : 'groups.read'));
    const [options, setOptions] = useState<Record<string, string>>(labels);
    useEffect(() => { if (page.data)
        setOptions(o => ({ ...o, ...Object.fromEntries(page.data.items.map(x => [x.id, x.name])) })); }, [page.data]);
    return <div className="access-assignment"><Space wrap>{value.length ? value.map(id => <span className="access-chip" key={id}>{options[id] ?? labels[id] ?? `ID ${id}`}{!disabled && <Button type="text" aria-label={`Убрать ${options[id] ?? labels[id] ?? id}`} onClick={() => onChange(value.filter(v => v !== id))}>×</Button>}</span>) : <span>Нет назначений</span>}</Space>{!disabled && <><Input aria-label={kind === 'roles' ? 'Поиск доступной роли' : 'Поиск доступной группы'} placeholder="Поиск" value={page.search} onChange={e => page.setSearch(e.target.value)}/>{page.isError ? <AccessError error={page.error} retry={page.reset}/> : page.isPending ? <Skeleton active paragraph={{ rows: 1 }}/> : <div className="access-checkboxes">{page.data?.items.map(x => <label key={x.id}><input type="checkbox" checked={value.includes(x.id)} onChange={e => onChange(mergeSelection(value, [x.id], e.target.checked ? [x.id] : []))}/>{x.name}</label>)}</div>}<PageControls page={page}/></>}</div>;
}
