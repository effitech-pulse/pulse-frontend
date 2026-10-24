import { Alert, Button, Card, Checkbox, Empty, Input, Skeleton, Space, Table } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { peopleApi, type EmployeeProfile } from '@/api/people';
import { useAuth } from '@/auth/AuthProvider';
import { routeAccess } from '@/auth/authorization';
import { AccessError } from '@/components/access/UsersPanel';
import '@/styles/portal-system.css';
export function PeoplePage(){
 const {principal,privateEpoch,privateBlocked}=useAuth();
 const [search,setSearch]=useState('');const [inactive,setInactive]=useState(false);const [history,setHistory]=useState<string[]>([]);
 const allowed=routeAccess(principal,'/people')&&!privateBlocked;
 const page=useQuery({queryKey:['people','list',privateEpoch,search,inactive,history.at(-1)],queryFn:()=>peopleApi.list({search,include_inactive:inactive,limit:25,cursor:history.at(-1)}),enabled:allowed,retry:false});
 if(!allowed)return <Alert type="warning" message="Сотрудники доступны после входа в личную учётную запись"/>;
 return <div className="pulse-stack pulse-system-page access-page people-page"><div className="pulse-page-heading"><h1>Сотрудники</h1><p>Место работы и руководители коллег.</p></div>
 <div className="access-toolbar"><label>Поиск сотрудника<Input aria-label="Поиск сотрудника" placeholder="Имя, должность или место работы" value={search} onChange={e=>{setSearch(e.target.value);setHistory([]);}} allowClear/></label><Checkbox checked={inactive} onChange={e=>{setInactive(e.target.checked);setHistory([]);}}>Показать отключённые учётные записи</Checkbox></div>
 <Card className="access-list-card">{page.isError?<AccessError error={page.error} retry={()=>void page.refetch()}/>:page.isPending?<Skeleton active/>:<>
 <div className="access-desktop"><Table<EmployeeProfile> rowKey="id" pagination={false} dataSource={page.data?.items} locale={{emptyText:<Empty description={search?'Ничего не найдено':'Сотрудников пока нет'}>{search&&<Button onClick={()=>{setSearch('');setHistory([]);}}>Сбросить поиск</Button>}</Empty>}} columns={[
 {title:'Сотрудник',render:(_,p)=><Link className="employee-name-link" to={`/people/${p.id}`}>{p.name}</Link>},
 {title:'Должность',render:(_,p)=>p.job_title??'Не указана'},
 {title:'Место работы',render:(_,p)=><>{[p.workplace.organization,p.workplace.division,p.workplace.department].filter(Boolean).join(' → ')||'Не указано'}</>},
 {title:'Руководитель',render:(_,p)=>p.manager?<Link className="employee-name-link" to={`/people/${p.manager.id}`}>{p.manager.name}{p.manager.active?'':' · Учётная запись отключена'}</Link>:'Не указан'},
 {title:'Учётная запись',render:(_,p)=>p.active?'Активна':'Отключена'},
 ]}/></div>
 <div className="access-mobile">{page.data?.items.length?page.data.items.map(p=><Card key={p.id}><Link className="employee-name-link" to={`/people/${p.id}`}>{p.name}</Link><p>{p.job_title??'Должность не указана'}</p><p>{[p.workplace.organization,p.workplace.division,p.workplace.department].filter(Boolean).join(' → ')||'Место работы не указано'}</p><div className="employee-mobile-manager"><p>Руководитель</p>{p.manager?<><Link className="employee-name-link" to={`/people/${p.manager.id}`}>{p.manager.name}</Link>{!p.manager.active&&<p>Учётная запись руководителя отключена</p>}</>:<p>Не указан</p>}</div>{!p.active&&<p>Учётная запись отключена</p>}</Card>):<Empty description={search?'Ничего не найдено':'Сотрудников пока нет'}/>}</div>
 <Space wrap className="access-paging"><Button disabled={!history.length||page.isFetching} onClick={()=>setHistory(h=>h.slice(0,-1))}>Назад</Button><Button disabled={!page.data?.next_cursor||page.isFetching} onClick={()=>setHistory(h=>[...h,page.data!.next_cursor!])}>Далее</Button></Space>
 </>}</Card></div>;
}
