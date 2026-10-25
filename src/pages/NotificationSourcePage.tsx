import { useAuth } from '@/auth/AuthProvider';
import { useLocation } from 'react-router-dom';
import { notificationsApi } from '@/api/notifications';
import { sourceRouteID } from '@/lib/notifications';
import { useNotificationTarget } from '@/hooks/useNotifications';
import { NotificationSourceView, NotificationTargetFrame } from '@/components/notifications/NotificationTargets';
export function NotificationSourcePage() {
    const auth = useAuth(), location = useLocation();
    let id: string | null = null;
    try {
        id = sourceRouteID(location.search);
    }
    catch { /* Fail closed. */ }
    const result = useNotificationTarget(id, signal => notificationsApi.source(id!, signal), auth.canFull('integrations.read'));
    return <NotificationTargetFrame title="Обзор источника" loading={result.loading} error={result.error} onRetry={result.retry}>{result.data ? <NotificationSourceView data={result.data}/> : null}</NotificationTargetFrame>;
}
