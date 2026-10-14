import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/api/audit';

export const useAudit = () =>
  useQuery({ queryKey: ['audit'], queryFn: () => auditApi.list(), refetchInterval: 15_000 });
