import {useAuth} from '@/auth/AuthProvider';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { type WellArchive, departmentsApi, ngduApi, runsApi, wellsApi } from '@/api/wells';
import { toApiError } from '@/api/client';
import {useFundFilters} from '@/theme/FundFilters';
import type { WellUpdate } from '@/api/types';

export const useWells = (activeOnly = true, applyFilters = true, archive:WellArchive = 'current') => {
  const {filters}=useFundFilters();const selected=applyFilters?filters:undefined;
  return useQuery({enabled: useAuth().can('wells.read'), queryKey:['wells', activeOnly, selected, archive], queryFn:() => wellsApi.list(activeOnly,selected,archive)});
};

export const useUpdateWell = () => {
  const {can}=useAuth();
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: WellUpdate }) => {if(!can('wells.update'))throw new Error('Недостаточно прав');return wellsApi.update(id, data);},
    onSuccess: () => {
      message.success('Сохранено');
      qc.invalidateQueries({ queryKey: ['wells'] });
      qc.invalidateQueries({ queryKey: ['well'] });
      qc.invalidateQueries({ queryKey: ['well-history'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useWell = (wellId: number) =>
  useQuery({ queryKey: ['well', wellId], queryFn: () => wellsApi.get(wellId), enabled: useAuth().can('wells.read') && wellId > 0 });

export const useWellPredictions = (wellId: number, limit = 100) =>
  useQuery({
    queryKey: ['well', wellId, 'predictions', limit],
    queryFn: () => wellsApi.predictions(wellId, limit),
    enabled: useAuth().can('risks.read') && wellId > 0,
  });

export const useWellComplications = (wellId: number) =>
  useQuery({
    queryKey: ['well', wellId, 'complications'],
    queryFn: () => wellsApi.complications(wellId),
    enabled: useAuth().can('risks.read') && wellId > 0,
  });

export const useDepartments = () =>
  useQuery({enabled: useAuth().can('references.read'),  queryKey: ['departments'], queryFn: departmentsApi.list });

export const useSaveDepartment = () => {
  const {canFull}=useAuth();
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: ({ id, name, isNew }: { id: number; name: string; isNew: boolean }) =>
      {if(!canFull(isNew?'references.create':'references.update'))throw new Error('Недостаточно прав');return isNew ? departmentsApi.create({ id, name }) : departmentsApi.update(id, name);},
    onSuccess: () => {
      message.success('Сохранено');
      qc.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useDeleteDepartment = () => {
  const {canFull}=useAuth();
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (id: number) => {if(!canFull('references.delete'))throw new Error('Недостаточно прав');return departmentsApi.remove(id);},
    onSuccess: () => {
      message.success('Удалено');
      qc.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useNgdus = () => useQuery({enabled: useAuth().can('references.read'),  queryKey: ['ngdu'], queryFn: ngduApi.list });

export const useSaveNgdu = () => {
  const {canFull}=useAuth();
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: ({ id, name, isNew }: { id: number; name: string; isNew: boolean }) =>
      {if(!canFull(isNew?'references.create':'references.update'))throw new Error('Недостаточно прав');return isNew ? ngduApi.create({ id, name }) : ngduApi.update(id, name);},
    onSuccess: () => {
      message.success('Сохранено');
      qc.invalidateQueries({ queryKey: ['ngdu'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useDeleteNgdu = () => {
  const {canFull}=useAuth();
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (id: number) => {if(!canFull('references.delete'))throw new Error('Недостаточно прав');return ngduApi.remove(id);},
    onSuccess: () => {
      message.success('Удалено');
      qc.invalidateQueries({ queryKey: ['ngdu'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useRecentRuns = (limit = 100) =>
  useQuery({enabled: useAuth().can('runs.read'),  queryKey: ['runs', limit], queryFn: () => runsApi.list({ limit }) });
