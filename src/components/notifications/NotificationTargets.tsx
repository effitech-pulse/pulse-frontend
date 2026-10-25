import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from 'antd';
import { Link } from 'react-router-dom';
import type { NotificationAlertContext, NotificationSourceOverview } from '@/api/notifications';
import { NotificationTime, useNotificationNavigation } from './NotificationsPanel';
import './notifications.css';
function Note({ title, children }: {
    title: string;
    children: ReactNode;
}) { return <section className="f4-target-note"><h2>{title}</h2><div>{children}</div></section>; }
export function NotificationTargetFrame({ title, loading, error, onRetry, children }: {
    title: string;
    loading: boolean;
    error?: string;
    onRetry: () => void;
    children: ReactNode;
}) {
    const heading = useRef<HTMLHeadingElement>(null), navigation = useNotificationNavigation();
    useEffect(() => { heading.current?.focus(); }, [title]);
    return <div className="f4-target"><Button type="text" block onClick={navigation.back}>К уведомлениям</Button><h1 tabIndex={-1} ref={heading}>{title}</h1>{loading ? <section className="f4-target-card" aria-busy="true">Загружаем сведения…</section> : error ? <section className="f4-target-card"><h2>{error}</h2>{error !== 'Объект недоступен' && error !== 'Некорректная ссылка' ? <Button onClick={() => { heading.current?.focus(); onRetry(); }}>Повторить</Button> : null}</section> : children}</div>;
}
const reviewLabels = { new: 'Новая', confirmed: 'Подтверждена технологом', false_positive: 'Ложная', unknown: 'Неизвестно' };
export function NotificationAlertView({ data }: {
    data: NotificationAlertContext;
}) {
    const t = data.target, saved = data.saved_result;
    return <>
  <Note title="Сохранённый контекст">Результат этого прогона. Текущая оценка скважины может отличаться.</Note>
  <section className="f4-target-card">
   <div>ID Pulse {t.well.id}{t.well.number !== null ? ` · № ${t.well.number}` : ''}<br />Прогон {t.run_id}<br />Тревога {t.alert_id}</div>
   {t.well.archived_at ? <p>Скважина в архиве · <NotificationTime value={t.well.archived_at}/></p> : !t.well.active ? <p>Скважина неактивна</p> : null}
   <hr className="f4-target-divider"/><h2 className="f4-danger">Тревога нового прогона</h2>
   <p>Риск исходного окна: {t.risk === null ? '—' : `${(t.risk * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`}</p>
   <p className="f4-small f4-muted">Окно до <NotificationTime value={t.window_end}/></p>
   <Note title="Риск и обработка независимы">Уведомление не подтверждает неисправность и не меняет решение технолога.</Note>
   <section className="f4-target-status"><span className="f4-small">Текущая обработка тревоги</span><span>{reviewLabels[data.alert_status]}</span></section>
   <Link className="f4-open" to={`/wells/${t.well.id}`}>Текущая карточка скважины</Link>
   <div className="f4-small f4-muted">{saved ? <><p>Результат прогона: {saved.verdict === 'watch' ? 'Наблюдение' : 'Тревога'}</p><p>Модель: {saved.model_name ?? '—'} · версия {saved.model_version ?? '—'}</p></> : <p>Полный снимок результата не сохранялся.</p>}</div>
   <div className="f4-small f4-muted"><p>Контур: {data.run.profile === 'cohort' ? 'когорта' : 'исследовательский'}</p><p>Начало: <NotificationTime value={data.run.started_at}/></p><p>Завершён: <NotificationTime value={data.run.finished_at}/></p>{data.snapshot_id ? <p>Снимок: {data.snapshot_id}</p> : null}</div>
  </section>
 </>;
}
const statusLabels = { draft: 'Черновик', running: 'Работает', paused: 'Приостановлен', error: 'Ошибка', unknown: 'Неизвестно' };
const kindLabels = { json_pull: 'JSON · получение', json_push: 'JSON · приём', clickhouse: 'ClickHouse', postgres: 'PostgreSQL', mysql: 'MySQL', file: 'Файл', unknown: 'Неизвестно' };
export function NotificationSourceView({ data }: {
    data: NotificationSourceOverview;
}) {
    return <section className="f4-target-card"><h2>{data.name}</h2><p>Источник {data.id}</p><p className={data.status === 'running' ? 'f4-success' : data.status === 'error' ? 'f4-danger' : ''}>Текущее состояние: {statusLabels[data.status] ?? 'Неизвестно'}</p><Note title="Уведомление о прошлой попытке">Уведомление описывает прошлую неудачную попытку сбора. Текущее состояние источника показано отдельно.</Note>{data.error_code === 'collection_failed' ? <p className="f4-danger">Попытка сбора завершилась ошибкой</p> : null}<div className="f4-small f4-muted"><p>Тип: {kindLabels[data.kind] ?? 'Неизвестно'}</p><p>Интервал сбора: {data.interval_seconds} с</p><p>Последний приём: <NotificationTime value={data.last_received}/></p><p>Последнее измерение: <NotificationTime value={data.last_measured}/></p></div></section>;
}
