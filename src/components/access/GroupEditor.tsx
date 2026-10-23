import { LoadingOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Input, Table } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { managementApi, type Account, type AccessPage, type GroupChange } from '@/api/access';
import { useAuth } from '@/auth/AuthProvider';
import { completeMembers } from '@/lib/accessDraft';
import { AccessError, AssignmentSelector, PageControls, organizationLabel, useAccessPage } from './UsersPanel';
export function GroupEditor({ value, onChange, disabled, baselineReady, onBaseline }: {
    value: GroupChange;
    onChange: (patch: Partial<GroupChange>) => void;
    disabled: boolean;
    baselineReady: boolean;
    onBaseline: (ids: string[]) => void;
}) {
    const { can, capturePrivate } = useAuth();
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown>();
    const [adding, setAdding] = useState(false);
    const members = useAccessPage(`members-${value.id}`, q => managementApi.groupMembers(value.id!, q), value.id !== null && can('users.read'));
    const candidates = useAccessPage('member-candidates', managementApi.users, adding && can('users.read'));
    async function loadBaseline() { const ticket = capturePrivate(); setLoading(true); setError(undefined); try {
        const pages: AccessPage<Account>[] = [];
        let cursor: string | undefined;
        let revision: string | undefined;
        do {
            const p = await managementApi.groupMembers(value.id!, { cursor, graph_revision: revision, limit: 100 });
            if (!ticket.current() || !mounted.current)
                return;
            pages.push(p);
            revision = p.graph_revision;
            cursor = p.next_cursor ?? undefined;
        } while (cursor);
        onBaseline(completeMembers(pages));
    }
    catch (e) {
        if (ticket.current() && mounted.current)
            setError(e);
    }
    finally {
        if (ticket.current() && mounted.current)
            setLoading(false);
    } }
    const list = adding ? candidates : members;
    return <div className="access-form"><p className="access-note">Постоянная группа с ручным составом</p><label>Название<Input value={value.name} disabled={disabled} onChange={e => onChange({ name: e.target.value })}/></label><label>Описание<Input.TextArea value={value.description} disabled={disabled} onChange={e => onChange({ description: e.target.value })}/></label><h2>Роли группы</h2><AssignmentSelector kind="roles" value={value.role_ids} onChange={role_ids => onChange({ role_ids })} disabled={disabled || !can('roles.read')}/><p className="access-note">Эти роли действуют в пределах подразделения каждого участника.</p><h2>Участники</h2>
 {!can('users.read') ? <Alert type="info" message="Чтение участников недоступно. Полная замена состава заблокирована."/> : <>
 {value.id !== null && !baselineReady && <Alert type="info" message="Состав сохраняется целиком" description="До загрузки полного состава проверка изменений недоступна." action={<Button aria-label="Загрузить полный состав" aria-busy={loading} loading={loading?{icon:<LoadingOutlined aria-hidden="true"/>}:false} disabled={disabled} onClick={() => void loadBaseline()}>Загрузить полный состав</Button>}/>}
 {error != null && <AccessError error={error} retry={() => void loadBaseline()}/>}
 <label>Поиск участника<Input placeholder="Имя или логин" value={list.search} onChange={e => list.setSearch(e.target.value)}/></label>
 {list.isError ? <AccessError error={list.error} retry={list.reset}/> : <Table<Account> size="small" rowKey={u => u.access_id!} loading={list.isFetching} scroll={{ x: 600 }} pagination={false} dataSource={list.data?.items} columns={[{ title: 'Участник', dataIndex: 'name' }, { title: 'Подразделение', render: (_, u) => organizationLabel(u.organization_scope, u.legacy_scope) }, { title: 'Статус', render: (_, u) => u.active ? 'Активен' : 'Отключён' }, { title: 'Членство', render: (_, u) => <Checkbox disabled={disabled || !baselineReady || !can('users.groups.assign')} checked={value.member_ids.includes(u.access_id!)} onChange={e => onChange({ member_ids: e.target.checked ? [...value.member_ids, u.access_id!] : value.member_ids.filter(id => id !== u.access_id) })}>В группе</Checkbox> }]}/>}
 <PageControls page={list}/><Button disabled={disabled || !baselineReady || !can('users.groups.assign')} onClick={() => setAdding(v => !v)}>{adding ? 'Показать участников' : 'Добавить участника'}</Button></>}
 <div className="pulse-system-callout"><strong>Состав сохраняется целиком</strong><p>Поиск и страницы не исключают остальных участников. Отключённый участник не станет активным. Подразделения участников не изменятся.</p></div></div>;
}
