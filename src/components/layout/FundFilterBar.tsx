import { Button, Input, Select, Space, Typography } from 'antd';
import { useDepartments, useNgdus, useWells } from '@/hooks/useWells';
import { useFundFilters } from '@/theme/FundFilters';
export function FundFilterBar(){
 const {filters,setFilters,reset}=useFundFilters();const wells=useWells(false,false,'all'),ngdus=useNgdus(),departments=useDepartments();
 const codes=(key:'ngdu'|'department')=>Array.from(new Set(wells.data?.map(w=>w[key])??[])).sort((a,b)=>a-b);
 const options=(key:'ngdu'|'department')=>codes(key).map(code=>({value:code,label:(key==='ngdu'?ngdus.data:departments.data)?.find(r=>r.id===code)?.name??String(code)}));
 return <div className="pulse-toolbar" style={{marginBottom:16}}><Space wrap>
 <Input aria-label="Поиск скважины по ID Pulse или номеру" placeholder="ID Pulse или номер скважины" allowClear value={filters.search} maxLength={120} style={{width:240}} onChange={e=>setFilters({search:e.target.value})} />
 <Select aria-label="Фильтр НГДУ" placeholder="Все НГДУ" allowClear showSearch optionFilterProp="label" value={filters.ngdu} options={options('ngdu')} style={{width:170}} onChange={ngdu=>setFilters({ngdu})} />
 <Select aria-label="Фильтр цеха" placeholder="Все цеха" allowClear showSearch optionFilterProp="label" value={filters.department} options={options('department')} style={{width:170}} onChange={department=>setFilters({department})} />
 <Select aria-label="Сортировка скважин" value={filters.sort} style={{width:180}} options={[{value:'id_asc',label:'ID Pulse ↑'},{value:'id_desc',label:'ID Pulse ↓'},{value:'name_asc',label:'Номер скважины ↑'},{value:'name_desc',label:'Номер скважины ↓'}]} onChange={sort=>setFilters({sort})} />
 <Button type="text" disabled={!filters.search&&filters.ngdu===undefined&&filters.department===undefined&&filters.sort==='id_asc'} onClick={reset}>Сбросить</Button>
 </Space><Typography.Text type="secondary">Выбор сохраняется между экранами</Typography.Text></div>;
}
