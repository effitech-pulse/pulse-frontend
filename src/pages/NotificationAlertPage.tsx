import { useAuth } from '@/auth/AuthProvider';
import { useLocation, useParams } from 'react-router-dom';
import { notificationsApi } from '@/api/notifications';
import { alertRouteTuple } from '@/lib/notifications';
import { useNotificationTarget } from '@/hooks/useNotifications';
import { NotificationAlertView, NotificationTargetFrame } from '@/components/notifications/NotificationTargets';
export function NotificationAlertPage() {
    const auth = useAuth(), { wellId, alertId } = useParams(), location = useLocation();
    let tuple: ReturnType<typeof alertRouteTuple> | null = null;
    try {
        tuple = alertRouteTuple(wellId, alertId, location.search);
    }
    catch { /* Invalid route never fetches. */ }
    const target = tuple, result = useNotificationTarget(target ? JSON.stringify(target) : null, signal => notificationsApi.alert(target!.well, target!.run, target!.alert, signal), auth.can('alerts.read'));
    return <NotificationTargetFrame title="Сохранённая тревога" loading={result.loading} error={result.error} onRetry={result.retry}>{result.data ? <NotificationAlertView data={result.data}/> : null}</NotificationTargetFrame>;
}
