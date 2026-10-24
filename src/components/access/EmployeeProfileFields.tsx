import { Alert, Button, Input, Select, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { peopleApi } from '@/api/people';
import type { UserChange } from '@/api/access';
import { useAuth } from '@/auth/AuthProvider';
import type { AccessFieldError } from '@/lib/accessDraft';
import { FieldError, fieldAttributes } from './FieldError';
import { AccessError } from './UsersPanel';
export function EmployeeProfileFields({ value, onChange, disabled, fieldError }: { value: UserChange; onChange: (patch: Partial<UserChange>) => void; disabled: boolean; fieldError?: AccessFieldError }) {
 const {privateEpoch, privateBlocked} = useAuth();
 const [search,setSearch]=useState('');
 const [history,setHistory]=useState<string[]>([]);
 const p=value.profile;
 const selected=useQuery({queryKey:['people','manager',privateEpoch,p?.manager_id],queryFn:()=>peopleApi.get(p!.manager_id!),enabled:!!p?.manager_id&&!privateBlocked,retry:false});
 const page=useQuery({queryKey:['people','manager-options',privateEpoch,search,history.at(-1)],queryFn:()=>peopleApi.list({search,include_inactive:true,limit:25,cursor:history.at(-1)}),enabled:!!p&&!disabled&&!privateBlocked,retry:false});
 const options=page.data?.items.filter(person=>person.id!==value.id).map(person=>({value:person.id,label:`${person.name}${person.active?'':' · Учётная запись отключена'}`}))??[];
 if(p?.manager_id&&!options.some(option=>option.value===p.manager_id))options.unshift({value:p.manager_id,label:selected.data?`${selected.data.name}${selected.data.active?'':' · Учётная запись отключена'}`:`ID ${p.manager_id}`});
 return <><h2>Сотрудник</h2><p className="access-note">Рабочая принадлежность описывает сотрудника и не назначает права доступа.</p>
 <label>Имя и фамилия<Input aria-label="Имя и фамилия" {...fieldAttributes('name',fieldError)} value={value.name} disabled={disabled} maxLength={120} onChange={e=>onChange({name:e.target.value})}/><FieldError field="name" error={fieldError}/></label>
 {p===undefined?<Alert type="info" message="Профиль сотрудника не поддерживается сервером" description="Учётную запись и доступ можно редактировать. Сведения о месте работы недоступны."/>:<>
 <label>Должность<Input aria-label="Должность" {...fieldAttributes('job_title',fieldError)} value={p.job_title??''} disabled={disabled} placeholder="Не указана" onChange={e=>onChange({profile:{...p,job_title:e.target.value}})}/><FieldError field="job_title" error={fieldError}/></label>
 {(['organization','division','department'] as const).map((key,index)=>{const field=`workplace_${key}` as const;return <label key={key}>{['Организация','Подразделение','Отдел'][index]}<Input aria-label={['Организация','Подразделение','Отдел'][index]} {...fieldAttributes(field,fieldError)} value={p.workplace[key]??''} disabled={disabled} placeholder="Не указано" onChange={e=>onChange({profile:{...p,workplace:{...p.workplace,[key]:e.target.value}}})}/><FieldError field={field} error={fieldError}/></label>;})}
 <label>Руководитель<Select aria-label="Руководитель" {...fieldAttributes('manager_id',fieldError)} showSearch filterOption={false} allowClear placeholder="Не указан" value={p.manager_id??undefined} options={options} loading={page.isFetching||selected.isFetching} disabled={disabled} onSearch={s=>{setSearch(s);setHistory([]);}} onChange={id=>onChange({profile:{...p,manager_id:id??null}})} notFoundContent={page.isFetching?'Загрузка…':page.isError?'Не удалось загрузить сотрудников':'Сотрудники не найдены'}/><FieldError field="manager_id" error={fieldError}/></label>
 <p className="access-note">Выберите существующего сотрудника. Можно оставить без руководителя.</p>
 {page.isError&&<AccessError error={page.error} retry={()=>void page.refetch()}/>} {selected.isError&&<AccessError error={selected.error} retry={()=>void selected.refetch()}/>}
 <Space wrap><Button disabled={!history.length||page.isFetching||disabled} onClick={()=>setHistory(h=>h.slice(0,-1))}>Предыдущие руководители</Button><Button disabled={!page.data?.next_cursor||page.isFetching||disabled} onClick={()=>setHistory(h=>[...h,page.data!.next_cursor!])}>Следующие руководители</Button></Space>
 </> }</>;
}
