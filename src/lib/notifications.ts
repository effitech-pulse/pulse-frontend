import type { AuthState } from '../api/access';
import { decimalID, notificationID, type NotificationCapabilities, type NotificationCount, type NotificationItem, type NotificationPage, type NotificationRead, type NotificationState, type NotificationTarget } from '../api/notifications';
/** F4 has a narrower in-memory lifetime than the global authentication cache. */
export function notificationsBoundary(auth: AuthState, epoch: number, blocked: boolean): string {
    const p = auth.principal;
    return JSON.stringify([epoch, blocked, auth.mode, p?.access_id, p?.account_id, p?.authenticated, p?.mechanism, p?.authz_epoch, p?.graph_revision, p?.access_model, p?.role, p?.scope, p?.role_ids, p?.group_ids, p?.roles, p?.groups, p?.organization_scope, p?.permission_keys, p?.legacy_scope, p?.direct_roles]);
}
function query(search: string, key: string): string {
    if (!search.startsWith('?'))
        throw new Error('invalid_notification_link');
    const values = new Map<string, string>();
    for (const pair of search.slice(1).split('&')) {
        if (!pair)
            continue;
        const split = pair.indexOf('=');
        let name: string, value: string;
        try {
            name = decodeURIComponent((split < 0 ? pair : pair.slice(0, split)).replace(/\+/g, ' '));
            value = decodeURIComponent((split < 0 ? '' : pair.slice(split + 1)).replace(/\+/g, ' '));
        }
        catch {
            throw new Error('invalid_notification_link');
        }
        if (name !== key || values.has(name) || !value)
            throw new Error('invalid_notification_link');
        values.set(name, value);
    }
    const value = values.get(key);
    if (!value)
        throw new Error('invalid_notification_link');
    return value;
}
export const sourceRouteID = (search: string) => query(search, 'source_id');
export function alertRouteTuple(well: unknown, alert: unknown, search: string) { return { well: decimalID(well), alert: decimalID(alert), run: decimalID(query(search, 'run_id')) }; }
export function notificationLocation(target: NotificationTarget): string {
    if (target.kind === 'alert')
        return `/wells/${decimalID(target.well.id)}/alerts/${decimalID(target.alert_id)}?run_id=${decimalID(target.run_id)}`;
    if (typeof target.source_id !== 'string' || !target.source_id)
        throw new Error('invalid_notification_link');
    return '/integrations/source-overview?' + new URLSearchParams({ source_id: target.source_id });
}
export function notificationStatus(error: unknown): number | undefined { return (error as {
    response?: {
        status?: number;
    };
} | null)?.response?.status; }
export function notificationError(error: unknown): string {
    switch (notificationStatus(error)) {
        case 401: return 'Войдите, чтобы продолжить';
        case 403: return 'Доступ к уведомлениям изменился';
        case 404: return 'Объект недоступен';
        case 422: return 'Некорректная ссылка или срок списка истёк';
        default: return 'Уведомления временно недоступны';
    }
}
export interface NotificationsAPI {
    capabilities(signal?: AbortSignal): Promise<NotificationCapabilities>;
    unreadCount(signal?: AbortSignal): Promise<NotificationCount>;
    list(query: {
        state: NotificationState;
        limit?: number;
        cursor?: string;
    }, signal?: AbortSignal): Promise<NotificationPage>;
    markRead(id: string, signal?: AbortSignal): Promise<NotificationRead>;
}
export interface NotificationsSnapshot {
    capability: NotificationCapabilities | null;
    count: NotificationCount | null;
    countError: boolean;
    items: NotificationItem[];
    cursor: string | null;
    state: NotificationState;
    buffer: NotificationPage | null;
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    moreError: string | null;
    restart: boolean;
    mutations: Record<string, 'pending' | 'error'>;
    blocked: boolean;
}
interface Dependencies {
    api: NotificationsAPI;
    capturePrivate: () => {
        current: () => boolean;
    };
    verifySession: () => Promise<boolean>;
    visible: () => boolean;
    online: () => boolean;
    setTimer: (fn: () => void, ms: number) => unknown;
    clearTimer: (id: unknown) => void;
    shouldBuffer: () => boolean;
}
const empty = (): NotificationsSnapshot => ({ capability: null, count: null, countError: false, items: [], cursor: null, state: 'unread', buffer: null, loading: false, loadingMore: false, error: null, moreError: null, restart: false, mutations: {}, blocked: false });
/** One scheduler, one resource flight, no persistent or query-cache state. */
export class NotificationsController {
    private value = empty();
    private listeners = new Set<() => void>();
    private timer: unknown;
    private active = true;
    private generation = 0;
    private open = false;
    private failures = 0;
    private failureSequence = 0;
    private flights = new Map<string, Promise<void>>();
    private aborts = new Set<AbortController>();
    private cycle: Promise<void> | null = null;
    private verificationRequested = false;
    private queuedWake: Promise<void> | null = null;
    constructor(private deps: Dependencies) { }
    getSnapshot = () => this.value;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private patch(next: Partial<NotificationsSnapshot>) { this.value = { ...this.value, ...next }; this.listeners.forEach(l => l()); }
    private allowed() { return this.value.capability?.enabled === true && this.value.capability.families.length > 0 && !this.value.blocked && !this.verificationRequested; }
    private cancelTimer() { if (this.timer !== undefined) {
        this.deps.clearTimer(this.timer);
        this.timer = undefined;
    } }
    private clear(blocked = false) { this.generation++; for (const abort of this.aborts)
        abort.abort(); this.aborts.clear(); this.cancelTimer(); const state = this.value.state; this.value = { ...empty(), state, blocked, error: blocked ? 'Доступ к уведомлениям требует повторной проверки' : null }; this.listeners.forEach(l => l()); }
    deny = () => this.clear(true);
    dispose() { this.active = false; this.clear(); this.listeners.clear(); }
    private schedule() { this.cancelTimer(); if (!this.active || !this.deps.visible() || !this.deps.online())
        return; const delay = [30000, 60000, 120000, 120000][Math.min(Math.max(this.failures - 1, 0), 3)]; this.timer = this.deps.setTimer(() => { this.timer = undefined; return this.poll(); }, delay); }
    private async request<T>(key: string, fetch: (signal: AbortSignal) => Promise<T>, apply: (data: T) => void, onError: (error: unknown) => void): Promise<void> {
        const existing = this.flights.get(key);
        if (existing)
            return existing;
        const gen = this.generation, ticket = this.deps.capturePrivate(), abort = new AbortController();
        this.aborts.add(abort);
        const current = () => this.active && gen === this.generation && ticket.current();
        const task = (async () => { try {
            const data = await fetch(abort.signal);
            if (current())
                apply(data);
        }
        catch (error) {
            if (!current())
                return;
            this.failureSequence++;
            const status = notificationStatus(error);
            if (status === 401 || status === 403) {
                this.clear(true);
                void this.recheckDenied();
            }
            else
                onError(error);
        }
        finally {
            this.aborts.delete(abort);
        } })();
        this.flights.set(key, task);
        try {
            await task;
        }
        finally {
            if (this.flights.get(key) === task)
                this.flights.delete(key);
        }
    }
    private async recheckDenied() { const ticket = this.deps.capturePrivate(); const gen = this.generation; await this.deps.verifySession(); if (!this.active || gen !== this.generation || !ticket.current())
        return; /* Next explicit refresh rechecks capabilities. */ }
    start = () => { this.active = true; this.cycle = null; this.flights.clear(); return this.poll(); };
    poll = (): Promise<void> => this.run(false, false);
    refresh = (): Promise<void> => this.run(true, true);
    wake = (): Promise<void> => this.run(true, true);
    private run(explicit: boolean, verify: boolean): Promise<void> {
        if (verify) this.verificationRequested = true;
        if (this.cycle) {
            if (!verify) return this.cycle;
            // A wake during count/head needs a follow-up. A wake during capabilities
            // is consumed by this cycle's barrier before it starts private reads.
            if (!this.queuedWake) {
                const pending = this.cycle.then(async () => {
                    // Paused work is resumed by the next focus/online/visibility event.
                    // Keep its verification flag, but never spin on an early-returned cycle.
                    while (this.active && this.verificationRequested && this.deps.visible() && this.deps.online()) {
                        await this.run(explicit, true);
                    }
                });
                this.queuedWake = pending;
                void pending.finally(() => { if (this.queuedWake === pending) this.queuedWake = null; });
            }
            return this.queuedWake;
        }
        const task = this.runCycle(explicit, verify);
        this.cycle = task;
        void task.finally(() => { if (this.cycle === task) this.cycle = null; });
        return task;
    }
    private async verifyBoundary(generation: number, ticket: {current: () => boolean}): Promise<boolean> {
        let verified = false;
        try { verified = await this.deps.verifySession(); } catch { /* Fail closed. */ }
        if (generation === this.generation) this.verificationRequested = false;
        if (!this.active || generation !== this.generation || !ticket.current()) return false;
        if (!verified) {
            this.clear(true);
            this.failures++;
            this.patch({ error: 'Не удалось проверить сеанс. Повторите попытку.' });
            this.schedule();
            return false;
        }
        this.patch({ blocked: false });
        return true;
    }
    private async runCycle(explicit: boolean, verify: boolean) {
        this.cancelTimer();
        if (!this.active || !this.deps.visible() || !this.deps.online())
            return;
        const gen = this.generation, ticket = this.deps.capturePrivate();
        const before = this.failureSequence;
        const existingList = this.flights.get('list');
        if ((verify || this.value.blocked || this.verificationRequested) && !await this.verifyBoundary(gen, ticket)) return;
        let replacingFamily = false;
        await this.request('capability', signal => this.deps.api.capabilities(signal), capability => {
            const changed = this.value.capability && JSON.stringify(this.value.capability.families) !== JSON.stringify(capability.families);
            if (!capability.enabled || !capability.families.length || changed) {
                this.clear();
                this.failures = 0;
                replacingFamily = capability.enabled && capability.families.length > 0;
                this.patch({ capability, loading: replacingFamily && this.open });
                if (!replacingFamily) this.schedule();
            } else this.patch({ capability, error: null });
        }, error => this.patch({ error: notificationError(error), countError: true }));
        if (replacingFamily && this.active && ticket.current()) {
            // Old-generation responses must drain before the replacement reader owns a resource.
            await Promise.all([...this.flights.values()]);
            if (this.active && ticket.current()) await this.runCycle(true, false);
            return;
        }
        if (this.verificationRequested && !await this.verifyBoundary(gen, ticket)) return;
        if (this.active && gen === this.generation && ticket.current() && this.allowed())
            await Promise.all([this.fetchCount(), this.open ? (existingList ?? this.head(explicit)) : Promise.resolve()]);
        this.failures = this.failureSequence === before ? 0 : this.failures + 1;
        if (this.active && gen === this.generation && ticket.current())
            this.schedule();
    }
    private fetchCount() { return this.request('count', s => this.deps.api.unreadCount(s), count => this.patch({ count, countError: false }), () => this.patch({ countError: true })); }
    private head(explicit: boolean) {
        if (this.flights.has('list'))
            return this.flights.get('list')!;
        this.patch({ loading: this.value.items.length === 0, error: null });
        const state = this.value.state;
        return this.request('list', s => this.deps.api.list({ state, limit: 25 }, s), page => { if (!explicit && this.value.items.length && this.deps.shouldBuffer() && (JSON.stringify(page.items) !== JSON.stringify(this.value.items) || page.next_cursor !== this.value.cursor))
            this.patch({ buffer: page, loading: false });
        else
            this.applyHead(page); }, e => this.patch({ loading: false, error: notificationError(e) }));
    }
    private applyHead(page: NotificationPage) { this.patch({ items: this.dedupe(page.items), cursor: page.next_cursor, buffer: null, loading: false, error: null, moreError: null, restart: false }); }
    applyBuffer = () => { if (this.value.buffer)
        this.applyHead(this.value.buffer); };
    private dedupe(items: NotificationItem[]) { const seen = new Set<string>(); return items.filter(i => !seen.has(i.notification_id) && !!seen.add(i.notification_id)); }
    setOpen = async (open: boolean) => { this.open = open; if (open && this.allowed())
        await this.head(true); };
    setState = async (state: NotificationState) => { if (state === this.value.state)
        return; const previous = this.cycle, previousList = this.flights.get('list'); this.clear(); this.patch({ state }); await Promise.all([previous, previousList]); await this.refresh(); };
    loadMore = async () => {
        if (!this.allowed() || !this.value.cursor || this.value.restart || this.flights.has('list'))
            return;
        const cursor = this.value.cursor, state = this.value.state;
        this.patch({ loadingMore: true, moreError: null });
        await this.request('list', s => this.deps.api.list({ state, limit: 25, cursor }, s), page => this.patch({ items: this.dedupe([...this.value.items, ...page.items]), cursor: page.next_cursor, loadingMore: false }), e => this.patch({ loadingMore: false, moreError: notificationError(e), restart: notificationStatus(e) === 422 }));
    };
    markRead = async (id: string): Promise<boolean> => {
        notificationID(id);
        if (!this.allowed() || this.value.mutations[id] === 'pending' || !this.value.items.some(i => i.notification_id === id && !i.read_at)) return false;
        const generation = this.generation, ticket = this.deps.capturePrivate();
        this.patch({ mutations: { ...this.value.mutations, [id]: 'pending' } });
        let receipt: NotificationRead | undefined;
        await this.request('read:' + id, signal => this.deps.api.markRead(id, signal), read => {
            if (read.notification_id === id) receipt = read;
            else this.patch({ mutations: { ...this.value.mutations, [id]: 'error' } });
        }, () => this.patch({ mutations: { ...this.value.mutations, [id]: 'error' } }));
        if (!receipt) return false;
        // Drain reads begun before PUT so an older server snapshot cannot revive unread state.
        await Promise.all([this.flights.get('list'), this.flights.get('count')]);
        if (!this.active || generation !== this.generation || !ticket.current() || !this.allowed()) return false;
        const readAt = receipt.read_at, mutations = { ...this.value.mutations };
        delete mutations[id];
        this.patch({
            items: this.value.state === 'unread' ? this.value.items.filter(i => i.notification_id !== id) : this.value.items.map(i => i.notification_id === id ? { ...i, read_at: readAt } : i),
            mutations, buffer: null,
        });
        await Promise.all([this.fetchCount(), this.head(true)]);
        return this.active && generation === this.generation && ticket.current();
    };
}
