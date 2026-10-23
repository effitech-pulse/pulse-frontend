import { Alert, App, Button, Drawer, Skeleton, Space } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { managementApi, type Account, type AccessChange, type AccessPreviewResponse, type GroupChange, type RoleChange, type UserChange } from '@/api/access';
import { useAuth } from '@/auth/AuthProvider';
import { toApiError } from '@/api/client';
import { acceptPreview, applyReceipt, createDraft, previewTicket, rejectApply, updateDraft, userChange, validateUserChange, type AccessDraft } from '@/lib/accessDraft';
import { UsersPanel, AccessError } from '@/components/access/UsersPanel';
import { GroupsPanel } from '@/components/access/GroupsPanel';
import { RolesPanel } from '@/components/access/RolesPanel';
import { UserAccessDrawer } from '@/components/access/UserAccessDrawer';
import { GroupEditor } from '@/components/access/GroupEditor';
import { RoleEditor } from '@/components/access/RoleEditor';
import { AccessPreview } from '@/components/access/AccessPreview';
import '@/styles/portal-system.css';
type Tab = 'users' | 'groups' | 'roles';
const tabs: {
    key: Tab;
    label: string;
    permission: 'users.read' | 'groups.read' | 'roles.read';
}[] = [{ key: 'users', label: 'Пользователи', permission: 'users.read' }, { key: 'groups', label: 'Группы пользователей', permission: 'groups.read' }, { key: 'roles', label: 'Роли', permission: 'roles.read' }];
export function AccountsPage() {
    const auth = useAuth();
    const { can, principal, privateEpoch, capturePrivate, refreshSession } = auth;
    const client = useQueryClient();
    const { message, modal } = App.useApp();
    const [params, setParams] = useSearchParams();
    const available = tabs.filter(t => can(t.permission));
    const tab = available.find(t => t.key === params.get('tab'))?.key ?? available[0]?.key;
    const modern = auth.mode === 'local' && principal?.access_model === 'rbac_v1' && !auth.privateBlocked;
    const [draft, setDraft] = useState<AccessDraft | null>(null);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const [account, setAccount] = useState<Account | null>(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>();
    const [forbidden, setForbidden] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [previewSearch, setPreviewSearch] = useState('');
    const [previewPage, setPreviewPage] = useState<AccessPreviewResponse | null>(null);
    const [previewHistory, setPreviewHistory] = useState<string[]>([]);
    const [baselineReady, setBaselineReady] = useState(false);
    const [departmentPending, setDepartmentPending] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(searchTimer.current), []);
    const bypassNavigation = useRef(false);
    const blockingModal = useRef(false);
    const sequence = useRef(0);
    const opener = useRef<HTMLElement | null>(null);
    const errorRef = useRef<HTMLDivElement>(null);
    const blocker = useBlocker(({ currentLocation, nextLocation }) => { if (bypassNavigation.current) {
        bypassNavigation.current = false;
        return false;
    } return !busy && draftRef.current?.dirty === true && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search); });
    useEffect(() => { if (blocker.state !== 'blocked' || blockingModal.current)
        return; blockingModal.current = true; modal.confirm({ rootClassName: 'access-confirm-modal', title: 'Закрыть без сохранения?', content: 'Несохранённые изменения будут потеряны.', okText: 'Закрыть', cancelText: 'Продолжить редактирование', onOk: () => { blockingModal.current = false; blocker.proceed(); }, onCancel: () => { blockingModal.current = false; blocker.reset(); } }); }, [blocker, modal]);
    const catalog = useQuery({ queryKey: ['access', 'permissions', privateEpoch], queryFn: managementApi.permissions, enabled: modern && available.length > 0, retry: false });
    useEffect(() => { if (modern && tab && params.get('tab') !== tab) {
        const p = new URLSearchParams(params);
        p.set('tab', tab);
        setParams(p, { replace: true });
    } }, [modern, tab, params, setParams]);
    useEffect(() => { if (error)
        errorRef.current?.focus(); }, [error]);
    const entity = params.get('entity');
    const entityID = params.get('id');
    useEffect(() => {
        clearTimeout(searchTimer.current);
        setBusy(false);
        if (!modern || !entity) {
            sequence.current++;
            setDraft(null);
            setPreviewMode(false);
            setPassword('');
            setLoading(false);
            return;
        }
        if (!['users', 'groups', 'roles'].includes(entity) || !available.some(t => t.key === entity)) {
            sequence.current++;
            setDraft(null);
            setPassword('');
            setPreviewPage(null);
            setForbidden(true);
            setError(new Error('Доступ к карточке закрыт'));
            setLoading(false);
            return;
        }
        const ticket = capturePrivate();
        const n = ++sequence.current;
        setLoading(true);
        setDraft(null);
        setError(undefined);
        setForbidden(false);
        setUncertain(false);
        setPassword('');
        setPreviewMode(false);
        setPreviewPage(null);
        setAccount(null);
        setBaselineReady(entityID === 'new');
        setDepartmentPending(false);
        async function load() {
            try {
                let change: AccessChange;
                if (entity === 'users') {
                    if (entityID === 'new') {
                        if (!can('users.create'))
                            throw new Error('Создание пользователя недоступно');
                        change = { user: { id: null, revision: '0', name: '', login: '', active: true, role_ids: [], group_ids: [], reset_password: true } };
                    }
                    else {
                        const u = await managementApi.user(entityID!);
                        if (!ticket.current() || n !== sequence.current)
                            return;
                        setAccount(u);
                        change = userChange(u, {});
                    }
                }
                else if (entity === 'roles') {
                    const r = entityID === 'new' ? null : await managementApi.role(entityID!);
                    change = { role: r ? { id: params.get('copy') === '1' ? null : r.id, revision: params.get('copy') === '1' ? '0' : r.revision, name: params.get('copy') === '1' ? `${r.name} (копия)` : r.name, description: r.description, permission_keys: r.permission_keys, delete: false } : { id: null, revision: '0', name: '', description: '', permission_keys: [], delete: false } };
                }
                else {
                    const g = entityID === 'new' ? null : await managementApi.group(entityID!);
                    change = { group: g ? { ...g, member_ids: [], delete: false } : { id: null, revision: '0', name: '', description: '', role_ids: [], member_ids: [], delete: false } };
                }
                if (ticket.current() && n === sequence.current)
                    setDraft(createDraft(change, privateEpoch));
            }
            catch (e) {
                if (ticket.current() && n === sequence.current) {
                    setError(e);
                    setForbidden(axios.isAxiosError(e) && e.response?.status === 403);
                }
            }
            finally {
                if (ticket.current() && n === sequence.current)
                    setLoading(false);
            }
        }
        void load();
    }, [entity, entityID, params.get('copy'), privateEpoch, modern]);
    function open(kind: Tab, id: string | null, copy = false) { opener.current = document.activeElement as HTMLElement; const p = new URLSearchParams(params); p.set('tab', kind); p.set('entity', kind); p.set('id', id ?? 'new'); if (copy)
        p.set('copy', '1');
    else
        p.delete('copy'); setParams(p); }
    function closeNow() { bypassNavigation.current = true; clearTimeout(searchTimer.current); sequence.current++; setPassword(''); setDraft(null); setPreviewPage(null); const p = new URLSearchParams(params); p.delete('entity'); p.delete('id'); p.delete('copy'); setParams(p); setTimeout(() => opener.current?.focus(), 0); }
    function close() { if (busy)
        return; if (draft?.dirty || password)
        modal.confirm({ rootClassName: 'access-confirm-modal', title: 'Закрыть без сохранения?', content: 'Несохранённые изменения будут потеряны.', okText: 'Закрыть', cancelText: 'Продолжить редактирование', onOk: closeNow });
    else
        closeNow(); }
    function edit(change: AccessChange) { setDraft(d => d ? updateDraft(d, change) : d); setError(undefined); setPreviewPage(null); }
    function userPatch(patch: Partial<UserChange>) { if (draft?.change.user)
        edit({ user: { ...draft.change.user, ...patch } }); }
    function rolePatch(patch: Partial<RoleChange>) { if (draft?.change.role)
        edit({ role: { ...draft.change.role, ...patch } }); }
    function groupPatch(patch: Partial<GroupChange>) { if (draft?.change.group)
        edit({ group: { ...draft.change.group, ...patch } }); }
    const writable = draft?.change.user ? can(draft.change.user.id === null ? 'users.create' : 'users.update') : draft?.change.role ? can('roles.manage', 'access.manage_global') : draft?.change.group ? can('groups.manage', 'access.manage_global') : false;
    async function preview(search = '', cursor?: string, history: string[] = []) {
        const current = draftRef.current;
        if (!current || busy)
            return;
        const ticket = capturePrivate();
        const n = ++sequence.current;
        const dt = previewTicket(current);
        setBusy(true);
        setError(undefined);
        try {
            const c = current.change;
            if (c.user) {
                validateUserChange(c.user, password, departmentPending);
            }
            else if (!(c.role ?? c.group)?.name.trim())
                throw new Error('Введите название.');
            const response = await managementApi.preview(current.change, { search, cursor, graph_revision: current.conflict ? undefined : current.preview?.graph_revision, limit: 25 });
            if (!ticket.current() || n !== sequence.current || dt.version !== draftRef.current?.version)
                return;
            setDraft(d => d ? acceptPreview(d, response, dt, privateEpoch) : d);
            setPreviewPage(response);
            setPreviewMode(true);
            setPreviewSearch(search);
            setPreviewHistory(history);
        }
        catch (e) {
            if (ticket.current() && n === sequence.current) {
                setError(e);
                if (axios.isAxiosError(e) && e.response?.status === 403) {
                    setForbidden(true);
                    setDraft(null);
                    setPassword('');
                    setPreviewPage(null);
                }
                else
                    setDraft(d => d ? rejectApply(d, axios.isAxiosError(e) ? e.response?.status ?? 0 : 0) : d);
            }
        }
        finally {
            if (ticket.current() && n === sequence.current)
                setBusy(false);
        }
    }
    async function apply() { if (!draft || busy)
        return; const ticket = capturePrivate(); const n = ++sequence.current; setBusy(true); setError(undefined); try {
        const result = await managementApi.apply(applyReceipt(draft, privateEpoch), password || undefined);
        if (!ticket.current() || n !== sequence.current)
            return;
        if (result.user)
            client.setQueryData(['access', 'committed-user', result.user.access_id], result.user);
        closeNow();
        message.success('Изменения сохранены. Затронутые сеансы завершены.');
        await client.invalidateQueries({ queryKey: ['access'] });
        await refreshSession();
    }
    catch (e) {
        if (ticket.current() && n === sequence.current) {
            setError(e);
            const status = axios.isAxiosError(e) ? e.response?.status ?? 0 : 0;
            setDraft(d => d ? rejectApply(d, status) : d);
            if (status === 403) {
                setForbidden(true);
                setDraft(null);
                setPassword('');
                setPreviewPage(null);
            }
            if (!status) {
                setUncertain(true);
            }
        }
    }
    finally {
        if (ticket.current() && n === sequence.current)
            setBusy(false);
    } }
    if (!modern)
        return <Alert type="info" message="Управление доступом пока недоступно" description="Для постоянных ролей и групп требуется включённая серверная модель доступа. Прежний режим не поддерживает этот редактор."/>;
    return <div className="pulse-stack pulse-system-page access-page"><div className="pulse-page-heading"><h1>Управление доступом</h1><p>Пользователи, группы и роли. Доступ к данным определяется подразделением пользователя.</p></div>
 {available.length > 1 && <div role="tablist" aria-label="Управление доступом" className="access-tabs">{available.map((t, index) => <Button key={t.key} id={`access-tab-${t.key}`} role="tab" aria-selected={tab === t.key} aria-controls={`access-panel-${t.key}`} tabIndex={tab === t.key ? 0 : -1} type={tab === t.key ? 'primary' : 'default'} onClick={() => { const p = new URLSearchParams(); p.set('tab', t.key); setParams(p); }} onKeyDown={e => { const next = e.key === 'Home' ? 0 : e.key === 'End' ? available.length - 1 : e.key === 'ArrowRight' ? (index + 1) % available.length : e.key === 'ArrowLeft' ? (index + available.length - 1) % available.length : -1; if (next >= 0) {
        e.preventDefault();
        const p = new URLSearchParams();
        p.set('tab', available[next].key);
        setParams(p);
        document.getElementById(`access-tab-${available[next].key}`)?.focus();
    } }}>{t.label}</Button>)}</div>}
 <section role="tabpanel" id={`access-panel-${tab}`} aria-labelledby={available.length > 1 ? `access-tab-${tab}` : undefined}>{tab === 'users' ? <UsersPanel open={id => open('users', id)}/> : tab === 'groups' ? <GroupsPanel open={id => open('groups', id)}/> : tab === 'roles' ? <RolesPanel open={(id, copy) => open('roles', id, copy)}/> : <Alert type="warning" message="Нет доступа к разделу"/>}</section>
 <div className="pulse-system-callout"><strong>Роль — действия. Подразделение — данные.</strong><p>Группа объединяет сотрудников для назначения ролей и не меняет доступные каждому НГДУ и цех.</p></div>
 <Drawer closable={false} rootClassName="pulse-system-overlay access-overlay" title={previewMode ? 'Проверка изменений' : entity === 'users' ? 'Настройка пользователя' : entity === 'groups' ? 'Настройка группы' : 'Настройка роли'} width={`min(${previewMode ? 960 : entity === 'users' ? 600 : 760}px, 100vw)`} open={!!entity} onClose={close} keyboard={!busy} maskClosable={!busy} destroyOnClose footer={<Space wrap>{!forbidden && draft && writable && !uncertain && (previewMode ? <><Button aria-label="Применить изменения" type="primary" loading={busy ? {icon:<LoadingOutlined aria-hidden="true"/>} : false} aria-busy={busy} disabled={!draft.preview || draft.conflict} onClick={() => void apply()}>Применить изменения</Button><Button disabled={busy} onClick={() => { setPreviewMode(false); setPreviewPage(null); }}>Вернуться к редактированию</Button></> : <><Button aria-label="Проверить изменения" type="primary" loading={busy ? {icon:<LoadingOutlined aria-hidden="true"/>} : false} aria-busy={busy} disabled={draft.change.group && !baselineReady || catalog.isPending || catalog.isError} onClick={() => void preview()}>Проверить изменения</Button>{(draft.change.role?.id || draft.change.group?.id) && <Button danger disabled={busy || !!draft.change.group && !baselineReady} onClick={() => { if (draft.change.role)
        rolePatch({ delete: !draft.change.role.delete }); if (draft.change.group)
        groupPatch({ delete: !draft.change.group.delete }); }}>{(draft.change.role ?? draft.change.group)?.delete ? 'Отменить удаление' : 'Удалить'}</Button>}</>)}<Button disabled={busy} onClick={close}>Отмена</Button></Space>}>
 {error != null && <div ref={errorRef} tabIndex={-1}><Alert type="error" message={forbidden ? 'Доступ к сведениям закрыт' : toApiError(error).message} description={draft?.conflict ? 'Черновик сохранён. Данные изменились. Проверьте последствия повторно.' : uncertain ? 'Результат записи неизвестен. Закройте карточку и перечитайте данные перед дальнейшей записью.' : undefined} action={draft?.conflict ? <Button disabled={busy} onClick={() => void preview()}>Обновить предпросмотр</Button> : undefined}/></div>}
 {loading ? <Skeleton active/> : draft && !forbidden ? previewMode ? <AccessPreview preview={previewPage} loading={busy} search={previewSearch} onSearch={search => { setPreviewSearch(search); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => void preview(search), 300); }} onNext={() => { if (previewPage?.next_cursor)
        void preview(previewSearch, previewPage.next_cursor, [...previewHistory, previewPage.next_cursor]); }} onBack={() => { const h = previewHistory.slice(0, -1); void preview(previewSearch, h.at(-1), h); }} hasBack={previewHistory.length > 0} catalog={catalog.data ?? []} userChange={!!draft.change.user}/> : <>{catalog.isError && <AccessError error={catalog.error} retry={() => void catalog.refetch()}/>} {draft.change.user ? <UserAccessDrawer value={draft.change.user} account={account} password={password} onPassword={v => { setPassword(v); userPatch({ reset_password: !!v || draft.change.user!.id === null }); }} onChange={userPatch} onDepartmentPending={setDepartmentPending} onClose={close} catalog={catalog.data ?? []}/> : draft.change.role ? <RoleEditor value={draft.change.role} onChange={rolePatch} catalog={catalog.data ?? []} disabled={!writable}/> : <GroupEditor value={draft.change.group!} onChange={groupPatch} disabled={!writable} baselineReady={baselineReady} onBaseline={ids => { setBaselineReady(true); groupPatch({ member_ids: ids }); }}/>}{(draft.change.role ?? draft.change.group)?.delete && <Alert type="warning" message="Выбрано удаление. Сервер проверит зависимые назначения."/>}</> : null}
 </Drawer></div>;
}
