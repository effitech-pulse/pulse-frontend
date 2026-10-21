import type { ReactNode } from 'react';
import { Button, Input, Select } from 'antd';
import { useDepartments, useNgdus, useWells } from '@/hooks/useWells';
import { useFundFilters } from '@/theme/FundFilters';

export function FundFilterBar({ children, hasExtraFilters = false, onReset }: { children?: ReactNode; hasExtraFilters?: boolean; onReset?: () => void }) {
  const { filters, setFilters, reset } = useFundFilters();
  const wells = useWells(false, false, 'all'), ngdus = useNgdus(), departments = useDepartments();
  const codes = (key: 'ngdu' | 'department') => Array.from(new Set(wells.data?.map(w => w[key]) ?? [])).sort((a, b) => a - b);
  const options = (key: 'ngdu' | 'department') => codes(key).map(code => ({ value: code, label: (key === 'ngdu' ? ngdus.data : departments.data)?.find(r => r.id === code)?.name ?? String(code) }));
  return <div className="pulse-fund-filters">
    <label className="pulse-filter-field pulse-filter-search"><span>Поиск</span><Input aria-label="Поиск скважины по ID Pulse или номеру" placeholder="Номер или ID Pulse" allowClear value={filters.search} maxLength={120} onChange={e => setFilters({ search: e.target.value })} /></label>
    <label className="pulse-filter-field"><span>НГДУ</span><Select aria-label="Фильтр НГДУ" placeholder="Все НГДУ" allowClear showSearch optionFilterProp="label" value={filters.ngdu} options={options('ngdu')} onChange={ngdu => setFilters({ ngdu })} /></label>
    <label className="pulse-filter-field"><span>Цех</span><Select aria-label="Фильтр цеха" placeholder="Все цеха" allowClear showSearch optionFilterProp="label" value={filters.department} options={options('department')} onChange={department => setFilters({ department })} /></label>
    {children}
    <label className="pulse-filter-field pulse-filter-sort"><span>Порядок</span><Select aria-label="Сортировка скважин" value={filters.sort} options={[{ value: 'id_asc', label: 'ID Pulse ↑' }, { value: 'id_desc', label: 'ID Pulse ↓' }, { value: 'name_asc', label: 'Номер ↑' }, { value: 'name_desc', label: 'Номер ↓' }]} onChange={sort => setFilters({ sort })} /></label>
    <Button className="pulse-filter-reset" disabled={!filters.search && filters.ngdu === undefined && filters.department === undefined && filters.sort === 'id_asc' && !hasExtraFilters} onClick={() => { reset(); onReset?.(); }}>Сбросить</Button>
  </div>;
}
