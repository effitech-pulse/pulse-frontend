import { createContext, useContext, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Badge, Button, Drawer, Tabs } from 'antd';
import { designTokens } from '@/theme/designTokens';
import { BellOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { NotificationItem } from '@/api/notifications';
import type { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/auth/AuthProvider';
import { notificationLocation } from '@/lib/notifications';
import { formatSnapshotTime } from '@/lib/displayTime';
import './notifications.css';
export const NotificationNavigation = createContext({ back: () => { }, remember: (_id: string) => { }, focusTarget: (heading: HTMLElement | null) => { heading?.focus(); } });
export const useNotificationNavigation = () => useContext(NotificationNavigation);
export const actionID = (id: string) => 'notification-open-' + id;
export function NotificationTime({ value }: {
    value: string | null;
}) { return value ? <time dateTime={value}>{formatSnapshotTime(value)}</time> : <>—</>; }
export function NotificationBell({ count, countError, onClick, open, buttonRef }: {
    count: {
        value: number;
        capped: boolean;
    } | null;
    countError: boolean;
    onClick: () => void;
    open: boolean;
    buttonRef: RefObject<HTMLButtonElement>;
}) {
    const badge = countError ? '?' : count?.capped ? '99+' : count?.value || null;
    return <Badge count={badge} color={designTokens.blue}><Button ref={buttonRef} className="app-icon-button f4-bell" type="text" aria-label={`Уведомления${countError ? ', количество недоступно' : count ? `, непрочитанных ${count.capped ? '99+' : count.value}` : ''}`} aria-expanded={open} aria-controls="f4-notifications" icon={<BellOutlined aria-hidden="true"/>} onClick={onClick}/></Badge>;
}
export function NotificationRow({ item, mutation, onOpen, onMark }: {
    item: NotificationItem;
    mutation?: 'pending' | 'error';
    onOpen: () => void;
    onMark: () => void;
}) {
    const alert = item.target.kind === 'alert', errorID = 'notification-error-' + item.notification_id;
    return <article className="f4-row">
  <div className={`f4-small ${alert ? 'f4-danger' : 'f4-warning'}`}>{alert ? 'Тревога' : 'Сбор данных'} · {item.read_at ? 'Прочитано' : 'Непрочитано'}</div>
  <h3>{alert ? 'Тревога нового прогона' : 'Попытка сбора завершилась ошибкой'}</h3>
  <div>{item.target.kind === 'alert' ? <>Скважина · ID Pulse {item.target.well.id}{item.target.well.number !== null ? ` · № ${item.target.well.number}` : ''}{item.target.well.archived_at ? ' · В архиве' : !item.target.well.active ? ' · Неактивна' : ''}</> : <>{item.target.source_name} · источник {item.target.source_id}</>}</div>
  <div className="f4-small f4-muted"><NotificationTime value={item.recorded_at}/><br />{item.target.kind === 'alert' ? <>Прогон {item.target.run_id}</> : <>Историческая попытка сбора · {item.target.collection_log_id}</>}</div>
  <Link id={actionID(item.notification_id)} className="f4-open" to={notificationLocation(item.target)} onClick={onOpen}>{alert ? 'Открыть скважину' : 'Открыть источник'}</Link>
  {item.read_at ? <div className="f4-small f4-muted">Прочитано <NotificationTime value={item.read_at}/></div> : <>
   {mutation === 'error' ? <p className="f4-inline-error" role="alert" id={errorID}>Не удалось сохранить отметку. Повторите попытку.</p> : null}
   <Button type="text" block aria-busy={mutation === 'pending'} aria-disabled={mutation === 'pending'} aria-describedby={mutation === 'error' ? errorID : undefined} onClick={() => { if (mutation !== 'pending') onMark(); }}>{mutation === 'pending' ? 'Сохраняем отметку…' : mutation === 'error' ? 'Повторить отметку' : 'Отметить прочитанным'}</Button>
  </>}
 </article>;
}
type Notifications = ReturnType<typeof useNotifications>;
export function NotificationsPanel({ open, onClose, notifications, headingRef, onOpen, focusReturn, onEntered }: {
    open: boolean;
    onClose: () => void;
    notifications: Notifications;
    headingRef: RefObject<HTMLHeadingElement>;
    onOpen: (id: string) => void;
    focusReturn: () => void;
    onEntered: () => void;
}) {
    const [continued, setContinued] = useState(false);
    const auth = useAuth(), n = notifications, c = n.controller, pendingFocus = useRef<{
        old: Element | null;
        ids: string[];
    } | null>(null);
    const focusAfter = () => { const p = pendingFocus.current; if (!p)
        return; pendingFocus.current = null; if (document.activeElement !== document.body && document.activeElement !== p.old)
        return; const node = p.ids.map(id => document.getElementById(actionID(id))).find(Boolean); (node ?? document.getElementById('f4-empty-heading') ?? headingRef.current)?.focus(); };
    useLayoutEffect(focusAfter, [n.items]);
    const explicit = (action: () => Promise<unknown> | void) => { const active = document.activeElement; pendingFocus.current = { old: active, ids: n.items.map(i => i.notification_id) }; void Promise.resolve(action()).then(() => { if (pendingFocus.current)
        focusAfter(); }); };
    const mark = (id: string) => { const items = n.items, index = items.findIndex(i => i.notification_id === id), old = document.activeElement, ids = [...(n.state === 'all' ? [items[index]] : []), ...items.slice(index + 1), ...items.slice(0, index).reverse()].map(i => i.notification_id); const ticket = auth.capturePrivate(); void c.markRead(id).then(success => { if (!success || !ticket.current())
        return; requestAnimationFrame(() => { if (!ticket.current())
        return; if (document.activeElement !== document.body && document.activeElement !== old)
        return; const next = ids.map(i => document.getElementById(actionID(i))).find(Boolean); (next ?? document.getElementById('f4-empty-heading') ?? headingRef.current)?.focus(); }); }); };
    const feedback = !n.personal ? 'Для персональных уведомлений войдите в личную учётную запись' : n.capability?.reason === 'feature_off' ? 'Персональные уведомления отключены' : n.capability?.reason === 'no_families' || n.capability && n.capability.families.length === 0 ? 'Нет доступных типов уведомлений' : null;
    const enabled = n.personal && n.capability?.enabled && !!n.capability.families.length && !n.blocked;
    const content = <div className="f4-list">
     {n.countError ? <p className="f4-inline-error">Количество непрочитанных недоступно{n.count ? ` · прежнее значение: ${n.count.capped ? '99+' : n.count.value} (устарело)` : ''}</p> : null}
     {n.buffer ? <Button block onClick={() => explicit(c.applyBuffer)}>Есть новые уведомления</Button> : null}
     {n.loading || !n.capability && !n.error ? <div className="f4-feedback" aria-busy="true">Загружаем уведомления…</div> : null}
     {n.error ? <div className="f4-feedback"><h3>{n.error}</h3><Button onClick={() => explicit(c.refresh)}>Повторить</Button></div> : null}
     {enabled && n.items.length === 0 && !n.loading && !n.error ? <div className="f4-feedback"><h3 id="f4-empty-heading" tabIndex={-1}>{n.state === 'unread' ? 'Непрочитанных уведомлений нет' : 'Уведомлений пока нет'}</h3>{n.state === 'unread' ? <Button onClick={() => { void c.setState('all'); }}>Показать все</Button> : <p>Новые тревоги и ошибки сбора появятся после включения уведомлений.</p>}</div> : null}
     {n.items.map(item => <NotificationRow key={item.notification_id} item={item} mutation={n.mutations[item.notification_id]} onOpen={() => onOpen(item.notification_id)} onMark={() => mark(item.notification_id)}/>)}
     {n.moreError ? <p className="f4-inline-error">{n.moreError}</p> : null}
     {n.restart ? <Button block onClick={() => explicit(c.refresh)}>Обновить с начала</Button> : n.cursor || continued ? <Button block disabled={n.loadingMore || !n.cursor} aria-busy={n.loadingMore} onClick={() => { setContinued(true); void c.loadMore(); }}>{!n.cursor ? 'Все доступные уведомления загружены' : n.loadingMore ? 'Загружаем…' : n.moreError ? 'Повторить загрузку' : 'Загрузить ещё'}</Button> : null}
     <div role="status" aria-live="polite" aria-atomic="true" className="f4-small f4-muted">{n.items.length ? `Загружено ${n.items.length} · По времени появления` : ''}</div>
     {enabled ? <Button type="text" block onClick={() => explicit(c.refresh)}>Обновить список</Button> : null}
    </div>;
    return <Drawer aria-label="Уведомления" rootClassName="f4-drawer" width="min(440px, 100vw)" open={open} title={null} closable={false} onClose={onClose} afterOpenChange={visible => { if (visible) {
        headingRef.current?.focus();
        onEntered();
    }
    else
        focusReturn(); }} styles={{ body: { padding: 0 } }}>
  <div className="f4-panel" id="f4-notifications">
   <div className="f4-panel-header"><h2 ref={headingRef} tabIndex={-1}>Уведомления</h2><Button type="text" onClick={onClose}>Закрыть</Button></div>
   <p className="f4-small f4-muted">Прочтение сохраняется только для вашего аккаунта.</p>
   {feedback ? <section className="f4-feedback"><h3>{feedback}</h3>{n.personal ? <Button onClick={() => explicit(c.refresh)}>Проверить доступ</Button> : null}</section> : <>
    <Tabs id="f4-tabs" activeKey={n.state} onChange={key => { void c.setState(key === 'all' ? 'all' : 'unread'); }} items={[
        { key: 'unread', label: 'Непрочитанные', children: n.state === 'unread' ? content : null },
        { key: 'all', label: 'Все', children: n.state === 'all' ? content : null },
    ]}/>
   </>}
  </div>
 </Drawer>;
}
