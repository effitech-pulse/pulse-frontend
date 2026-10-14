import { useQuery } from '@tanstack/react-query';
import { parametersApi } from '@/api/parameters';

export const useParameters = () =>
  useQuery({ queryKey: ['parameters'], queryFn: parametersApi.list, staleTime: 600_000 });
