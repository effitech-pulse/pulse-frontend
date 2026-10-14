import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';

export const useAnalyticsStatus = () =>
  useQuery({ queryKey: ['analytics', 'status'], queryFn: analyticsApi.status });

export const useEmbedUrl = (dashboardId: number | null) =>
  useQuery({
    queryKey: ['analytics', 'embed', dashboardId],
    queryFn: () => analyticsApi.embed(dashboardId as number),
    enabled: dashboardId != null,
    // Токен подписан с ограниченным сроком — обновляем периодически и при возврате на вкладку.
    staleTime: 1000 * 60 * 25,
    refetchInterval: 1000 * 60 * 25,
  });
