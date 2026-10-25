import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
import {accountFields} from './tableFields';
import type {AccessFieldError} from '@/lib/accessDraft';
import {FieldError,fieldAttributes} from './FieldError';
import { LoadingOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Input } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { managementApi, type Account, type AccessPage, type GroupChange } from '@/api/access';
import { useAuth } from '@/auth/AuthProvider';
import { completeMembers } from '@/lib/accessDraft';
import { AccessError, organizationLabel } from './UsersPanel';
export function GroupEditor({ value, onChange, disabled, baselineReady, onBaseline, fieldError }: {
    value: GroupChange;
    onChange: (patch: Partial<GroupChange>) => void;
    disabled: boolean;
    baselineReady: boolean;
    onBaseline: (ids: string[]) => void;
    fieldError?:AccessFieldError;
}) {
    const { can, capturePrivate } = useAuth();
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown>();
    const [adding, setAdding] = useState(false);
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
    return <div className="access-form"><p className="access-note">Постоянная группа с ручным составом</p><label>Название<Input aria-label="Название" {...fieldAttributes('name',fieldError)} value={value.name} disabled={disabled} onChange={e => onChange({ name: e.target.value })}/><FieldError field="name" error={fieldError}/></label><label>Описание<Input.TextArea value={value.description} disabled={disabled} onChange={e => onChange({ description: e.target.value })}/></label>{value.id !== null ? <><h2>Действующие назначения</h2><p>{value.role_ids.length ? `Действующие назначения сохранены. Изменение ролей в этой форме недоступно. ID ролей: ${value.role_ids.join(', ')}.` : 'Роли не назначены. Изменение ролей в этой форме недоступно.'}</p></> : <p className="access-note">Новая группа создаётся без ролей.</p>}<h2>Участники</h2>
 {!can('users.read') ? <Alert type="info" message="Чтение участников недоступно. Полная замена состава заблокирована."/> : <>
 {value.id !== null && !baselineReady && <Alert type="info" message="Состав сохраняется целиком" description="До загрузки полного состава проверка изменений недоступна." action={<Button aria-label="Загрузить полный состав" aria-busy={loading} loading={loading?{icon:<LoadingOutlined aria-hidden="true"/>}:false} disabled={disabled} onClick={() => void loadBaseline()}>Загрузить полный состав</Button>}/>}
 {error != null && <AccessError error={error} retry={() => void loadBaseline()}/>}
 <ServerEntityTable<Account> tableKey={`group-members-${value.id??'new'}-${adding?'candidates':'members'}`} enabled={can('users.read')&&(adding||value.id!==null)}
 fields={accountFields('Участник').filter(f=>!['role_ids','group_ids'].includes(f.key))}
 read={(q,signal)=>getTablePage(adding?'/api/v1/auth/users':`/api/v1/auth/groups/${value.id}/members`,q,signal,{access_version:1})}
 size="small" rowKey={u=>u.access_id!} scroll={{x:800}} columns={[{ title: 'Участник', dataIndex: 'name' }, { title: 'Подразделение', render: (_, u) => organizationLabel(u.organization_scope, u.legacy_scope) }, { title: 'Статус', render: (_, u) => u.active ? 'Активен' : 'Отключён' }, { title: 'Членство', key:'membership', render: (_, u) => <Checkbox disabled={disabled || !baselineReady || !can('users.groups.assign')} checked={value.member_ids.includes(u.access_id!)} onChange={e => onChange({ member_ids: e.target.checked ? [...value.member_ids, u.access_id!] : value.member_ids.filter(id => id !== u.access_id) })}>В группе</Checkbox> }]}/>
 <Button disabled={disabled || !baselineReady || !can('users.groups.assign')} onClick={() => setAdding(v => !v)}>{adding ? 'Показать участников' : 'Добавить участника'}</Button></>}
 <div className="pulse-system-callout"><strong>Состав сохраняется целиком</strong><p>Поиск и страницы не исключают остальных участников. Отключённый участник не станет активным. Подразделения участников не изменятся.</p></div></div>;
}
