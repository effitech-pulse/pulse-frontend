import {useAuth} from '@/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/api/audit';

export const useAudit = () =>
  useQuery({enabled: useAuth().can('audit.read'),  queryKey: ['audit'], queryFn: () => auditApi.list(), refetchInterval: 15_000 });
