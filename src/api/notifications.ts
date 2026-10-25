import { apiClient } from './client';
export type DecimalID = string; // canonical positive signed-int64 decimal, checked at entry
export type NotificationID = string; // /^nf1_[1-9][0-9]*$/ plus int64 check
export type NotificationState = 'unread' | 'all';
export type NotificationFamily = 'alerts' | 'collection';
export interface NotificationCapabilities {
    enabled: boolean;
    reason: 'enabled' | 'feature_off' | 'no_families';
    families: NotificationFamily[];
}
export interface NotificationWell {
    id: DecimalID;
    number: string | null;
    active: boolean;
    archived_at: string | null;
}
export type NotificationTarget = {
    kind: 'alert';
    well: NotificationWell;
    run_id: DecimalID;
    alert_id: DecimalID;
    risk: number | null;
    window_end: string | null;
} | {
    kind: 'collection';
    source_id: string;
    source_name: string;
    collection_log_id: DecimalID;
};
export type NotificationItem = {
    notification_id: NotificationID;
    kind: 'alert.created.v1';
    code: 'alert_created';
    text: 'Тревога нового прогона';
    recorded_at: string;
    read_at: string | null;
    target: Extract<NotificationTarget, {
        kind: 'alert';
    }>;
} | {
    notification_id: NotificationID;
    kind: 'collection.failed.v1';
    code: 'collection_failed';
    text: 'Попытка сбора завершилась ошибкой';
    recorded_at: string;
    read_at: string | null;
    target: Extract<NotificationTarget, {
        kind: 'collection';
    }>;
};
export interface NotificationPage {
    items: NotificationItem[];
    next_cursor: string | null;
}
export interface NotificationCount {
    value: number;
    capped: boolean;
}
export interface NotificationRead {
    notification_id: NotificationID;
    read_at: string;
}
export interface NotificationAlertContext {
    target: Extract<NotificationTarget, {
        kind: 'alert';
    }>;
    run: {
        id: DecimalID;
        profile: 'research' | 'cohort';
        started_at: string;
        finished_at: string | null;
    };
    alert_status: 'new' | 'confirmed' | 'false_positive' | 'unknown';
    snapshot_id: string | null;
    saved_result: {
        verdict: 'watch' | 'alert';
        model_name: string | null;
        model_version: string | null;
    } | null;
}
export interface NotificationSourceOverview {
    id: string;
    name: string;
    kind: 'json_pull' | 'json_push' | 'clickhouse' | 'postgres' | 'mysql' | 'file' | 'unknown';
    status: 'draft' | 'running' | 'paused' | 'error' | 'unknown';
    interval_seconds: number;
    last_received: string | null;
    last_measured: string | null;
    error_code: 'collection_failed' | null;
}
const invalid = (): never => { throw new Error('notifications_invalid_response'); };
export function decimalID(value: unknown): DecimalID {
    if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || value.length > 19 || BigInt(value) > 9223372036854775807n)
        return invalid();
    return value;
}
export function notificationID(value: unknown): NotificationID {
    if (typeof value !== 'string' || !value.startsWith('nf1_'))
        return invalid();
    decimalID(value.slice(4));
    return value;
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid(); return value as Record<string, unknown>; }
function label(value: unknown): string { if (typeof value !== 'string' || [...value].length > 256)
    return invalid(); return value; }
function opaque(value: unknown): string { if (typeof value !== 'string' || !value || new TextEncoder().encode(value).length > 65536)
    return invalid(); return value; }
function time(value: unknown): string { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) || !Number.isFinite(Date.parse(value)))
    return invalid(); return value; }
const nullableTime = (v: unknown) => v === null ? null : time(v);
const nullableLabel = (v: unknown) => v === null ? null : label(v);
function bool(value: unknown): boolean { return typeof value === 'boolean' ? value : invalid(); }
function integer(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : invalid(); }
function enumValue<T extends string>(v: unknown, values: readonly T[]): T { return typeof v === 'string' && values.includes(v as T) ? v as T : invalid(); }
function alertTarget(value: unknown): Extract<NotificationTarget, {
    kind: 'alert';
}> {
    const v = object(value), w = object(v.well);
    if (v.kind !== 'alert' || (v.risk !== null && (typeof v.risk !== 'number' || !Number.isFinite(v.risk) || v.risk < 0 || v.risk > 1)))
        return invalid();
    return { kind: 'alert', well: { id: decimalID(w.id), number: nullableLabel(w.number), active: bool(w.active), archived_at: nullableTime(w.archived_at) }, run_id: decimalID(v.run_id), alert_id: decimalID(v.alert_id), risk: v.risk as number | null, window_end: nullableTime(v.window_end) };
}
export function parseNotificationItem(value: unknown): NotificationItem {
    const v = object(value), base = { notification_id: notificationID(v.notification_id), recorded_at: time(v.recorded_at), read_at: nullableTime(v.read_at) };
    if (v.kind === 'alert.created.v1' && v.code === 'alert_created')
        return { ...base, kind: v.kind, code: v.code, text: 'Тревога нового прогона', target: alertTarget(v.target) };
    if (v.kind === 'collection.failed.v1' && v.code === 'collection_failed') {
        const t = object(v.target);
        if (t.kind !== 'collection')
            return invalid();
        return { ...base, kind: v.kind, code: v.code, text: 'Попытка сбора завершилась ошибкой', target: { kind: 'collection', source_id: opaque(t.source_id), source_name: label(t.source_name), collection_log_id: decimalID(t.collection_log_id) } };
    }
    return invalid();
}
export function parseNotificationPage(value: unknown): NotificationPage { const v = object(value); if (!Array.isArray(v.items) || v.items.length > 100)
    return invalid(); return { items: v.items.map(parseNotificationItem), next_cursor: v.next_cursor === null ? null : opaque(v.next_cursor) }; }
function capabilities(value: unknown): NotificationCapabilities { const v = object(value); if (!Array.isArray(v.families))
    return invalid(); return { enabled: bool(v.enabled), reason: enumValue(v.reason, ['enabled', 'feature_off', 'no_families']), families: v.families.map(f => enumValue(f, ['alerts', 'collection'])) }; }
function count(value: unknown): NotificationCount { const v = object(value), n = integer(v.value); if (n > 99)
    return invalid(); return { value: n, capped: bool(v.capped) }; }
function read(value: unknown): NotificationRead { const v = object(value); return { notification_id: notificationID(v.notification_id), read_at: time(v.read_at) }; }
export function parseNotificationAlert(value: unknown): NotificationAlertContext { const v = object(value), r = object(v.run), saved = v.saved_result === null ? null : object(v.saved_result); return { target: alertTarget(v.target), run: { id: decimalID(r.id), profile: enumValue(r.profile, ['research', 'cohort']), started_at: time(r.started_at), finished_at: nullableTime(r.finished_at) }, alert_status: enumValue(v.alert_status, ['new', 'confirmed', 'false_positive', 'unknown']), snapshot_id: nullableLabel(v.snapshot_id), saved_result: saved === null ? null : { verdict: enumValue(saved.verdict, ['watch', 'alert']), model_name: nullableLabel(saved.model_name), model_version: nullableLabel(saved.model_version) } }; }
export function parseNotificationSource(value: unknown): NotificationSourceOverview { const v = object(value); return { id: opaque(v.id), name: label(v.name), kind: typeof v.kind === 'string' && ['json_pull', 'json_push', 'clickhouse', 'postgres', 'mysql', 'file'].includes(v.kind) ? v.kind as NotificationSourceOverview['kind'] : 'unknown', status: typeof v.status === 'string' && ['draft', 'running', 'paused', 'error'].includes(v.status) ? v.status as NotificationSourceOverview['status'] : 'unknown', interval_seconds: integer(v.interval_seconds), last_received: nullableTime(v.last_received), last_measured: nullableTime(v.last_measured), error_code: v.error_code === null ? null : enumValue(v.error_code, ['collection_failed'] as const) }; }
const prefix = '/api/v1';
async function get<T>(path: string, parse: (data: unknown) => T, signal?: AbortSignal): Promise<T> { return parse((await apiClient.get(prefix + path, { signal })).data); }
export const notificationsApi = {
    capabilities: (signal?: AbortSignal) => get('/notifications/capabilities', capabilities, signal),
    list: (q: {
        state: NotificationState;
        limit?: number;
        cursor?: string;
    }, signal?: AbortSignal) => { const p = new URLSearchParams({ state: q.state, limit: String(q.limit ?? 25) }); if (q.cursor)
        p.set('cursor', q.cursor); return get('/notifications?' + p, parseNotificationPage, signal); },
    unreadCount: (signal?: AbortSignal) => get('/notifications/unread-count', count, signal),
    markRead: async (id: NotificationID, signal?: AbortSignal) => { notificationID(id); const result = read((await apiClient.put(prefix + '/notifications/' + id + '/read', undefined, { signal })).data); if (result.notification_id !== id)
        return invalid(); return result; },
    alert: async (well: DecimalID, run: DecimalID, alert: DecimalID, signal?: AbortSignal) => { const result = await get(`/wells/${decimalID(well)}/runs/${decimalID(run)}/alerts/${decimalID(alert)}`, parseNotificationAlert, signal); if (result.target.well.id !== well || result.target.run_id !== run || result.target.alert_id !== alert || result.run.id !== run)
        return invalid(); return result; },
    source: async (id: string, signal?: AbortSignal) => { const result = await get('/notification-targets/source?' + new URLSearchParams({ source_id: opaque(id) }), parseNotificationSource, signal); if (result.id !== id)
        return invalid(); return result; },
};
