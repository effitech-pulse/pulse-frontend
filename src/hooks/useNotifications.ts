import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { notificationsApi } from '@/api/notifications';
import { NotificationsController, notificationsBoundary, notificationError, notificationStatus } from '@/lib/notifications';
export const NotificationsPrivateContext = createContext({ blocked: false, block: () => { }, recheck: async () => { } });
export function useNotifications(open: boolean, shouldBuffer: () => boolean = () => false) {
    const auth = useAuth(), latest = useRef(auth), buffer = useRef(shouldBuffer);
    latest.current = auth;
    buffer.current = shouldBuffer;
    const boundary = notificationsBoundary(auth, auth.privateEpoch, auth.privateBlocked);
    const personal = auth.mode === 'local' && auth.principal?.authenticated === true && auth.principal.mechanism === 'session' && !auth.privateBlocked;
    const controller = useMemo(() => new NotificationsController({ api: notificationsApi, capturePrivate: () => latest.current.capturePrivate(), verifySession: () => latest.current.refreshSessionVerified(), visible: () => typeof document !== 'undefined' && document.visibilityState !== 'hidden', online: () => typeof navigator !== 'undefined' && navigator.onLine, setTimer: (fn, ms) => window.setTimeout(fn, ms), clearTimer: id => window.clearTimeout(id as number), shouldBuffer: () => buffer.current() }), [boundary]);
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    useEffect(() => { if (!personal)
        return; void controller.setOpen(open); void controller.start(); const wake = () => { void controller.wake(); }, visibility = () => { void controller.wake(); }; window.addEventListener('focus', wake); window.addEventListener('online', wake); window.addEventListener('offline', visibility); document.addEventListener('visibilitychange', visibility); return () => { controller.dispose(); window.removeEventListener('focus', wake); window.removeEventListener('online', wake); window.removeEventListener('offline', visibility); document.removeEventListener('visibilitychange', visibility); }; }, [controller, personal]);
    useEffect(() => { if (personal)
        void controller.setOpen(open); }, [controller, personal, open]);
    return { ...snapshot, personal, controller, boundary };
}
/** Exact target reader with the same verified-session and late-response fence. */
export function useNotificationTarget<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, permitted = true) {
    const privateState = useContext(NotificationsPrivateContext);
    const auth = useAuth(), latest = useRef(auth), reader = useRef(load);
    latest.current = auth;
    reader.current = load;
    const boundary = notificationsBoundary(auth, auth.privateEpoch, auth.privateBlocked);
    const [result, setResult] = useState<{
        key: string;
        boundary: string;
        data?: T;
        error?: string;
    }>();
    const [revision, setRevision] = useState(0);
    const personal = auth.mode === 'local' && auth.principal?.authenticated === true && auth.principal.mechanism === 'session' && !auth.privateBlocked;
    useEffect(() => {
        if (!key || !personal || !permitted || privateState.blocked)
            return;
        const ticket = latest.current.capturePrivate(), abort = new AbortController();
        let active = true;
        const current = () => active && !abort.signal.aborted && ticket.current();
        setResult(undefined);
        void (async () => { try {
            const verified = await latest.current.refreshSessionVerified();
            if (!current())
                return;
            if (!verified) {
                privateState.block();
                setResult({ key, boundary, error: 'Не удалось проверить сеанс. Повторите попытку.' });
                return;
            }
            const data = await reader.current(abort.signal);
            if (current())
                setResult({ key, boundary, data });
        }
        catch (error) {
            if (!current())
                return;
            setResult({ key, boundary, error: notificationError(error) });
            if ([401, 403].includes(notificationStatus(error) ?? 0)) {
                privateState.block();
                void latest.current.refreshSessionVerified();
            }
        } })();
        return () => { active = false; abort.abort(); };
    }, [key, boundary, personal, permitted, privateState.blocked, revision]);
    const current = result?.key === key && result.boundary === boundary ? result : undefined;
    return { data: permitted && !privateState.blocked ? current?.data : undefined, error: privateState.blocked ? 'Не удалось проверить доступ. Откройте уведомления и повторите проверку.' : !permitted ? 'Доступ к объекту ограничен' : !key ? 'Некорректная ссылка' : !personal ? 'Войдите, чтобы продолжить' : current?.error, loading: !!key && personal && permitted && !privateState.blocked && !current, retry: () => { if (privateState.blocked) void privateState.recheck(); else setRevision(v => v + 1); } };
}
