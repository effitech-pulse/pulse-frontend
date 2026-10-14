import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { departmentsApi, ngduApi, runsApi, wellsApi } from '@/api/wells';
import { toApiError } from '@/api/client';
import type { WellUpdate } from '@/api/types';

export const useWells = (activeOnly = true) =>
  useQuery({ queryKey: ['wells', activeOnly], queryFn: () => wellsApi.list(activeOnly) });

export const useUpdateWell = () => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: WellUpdate }) => wellsApi.update(id, data),
    onSuccess: () => {
      message.success('Сохранено');
      qc.invalidateQueries({ queryKey: ['wells'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useDeleteWell = () => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (id: number) => wellsApi.remove(id),
    onSuccess: () => {
      message.success('Скважина удалена');
      qc.invalidateQueries({ queryKey: ['wells'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useWell = (wellId: number) =>
  useQuery({ queryKey: ['well', wellId], queryFn: () => wellsApi.get(wellId), enabled: wellId > 0 });

export const useWellPredictions = (wellId: number, limit = 100) =>
  useQuery({
    queryKey: ['well', wellId, 'predictions', limit],
    queryFn: () => wellsApi.predictions(wellId, limit),
    enabled: wellId > 0,
  });

export const useWellComplications = (wellId: number) =>
  useQuery({
    queryKey: ['well', wellId, 'complications'],
    queryFn: () => wellsApi.complications(wellId),
    enabled: wellId > 0,
  });

export const useDepartments = () =>
  useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });

export const useSaveDepartment = () => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: ({ id, name, isNew }: { id: number; name: string; isNew: boolean }) =>
      isNew ? departmentsApi.create({ id, name }) : departmentsApi.update(id, name),
    onSuccess: () => {
      message.success('Сохранено');
      qc.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useDeleteDepartment = () => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (id: number) => departmentsApi.remove(id),
    onSuccess: () => {
      message.success('Удалено');
      qc.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useNgdus = () => useQuery({ queryKey: ['ngdu'], queryFn: ngduApi.list });

export const useSaveNgdu = () => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: ({ id, name, isNew }: { id: number; name: string; isNew: boolean }) =>
      isNew ? ngduApi.create({ id, name }) : ngduApi.update(id, name),
    onSuccess: () => {
      message.success('Сохранено');
      qc.invalidateQueries({ queryKey: ['ngdu'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useDeleteNgdu = () => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (id: number) => ngduApi.remove(id),
    onSuccess: () => {
      message.success('Удалено');
      qc.invalidateQueries({ queryKey: ['ngdu'] });
    },
    onError: (e) => message.error(toApiError(e).message),
  });
};

export const useRecentRuns = (limit = 100) =>
  useQuery({ queryKey: ['runs', limit], queryFn: () => runsApi.list({ limit }) });
