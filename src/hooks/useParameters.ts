import {useAuth} from '@/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { parametersApi } from '@/api/parameters';

export const useParameters = () =>
  useQuery({enabled: useAuth().can('parameters.read'),  queryKey: ['parameters'], queryFn: parametersApi.list, staleTime: 600_000 });
