import {Alert,Button,Card,Checkbox,Empty,Input,Skeleton} from 'antd';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import axios from 'axios';
import {OrganizationTree} from '@/components/people/OrganizationTree';
import {organizationTreeError} from '@/lib/organizationTree';
import {Link} from 'react-router-dom';
import {peopleApi,type EmployeeProfile} from '@/api/people';
import {useAuth} from '@/auth/AuthProvider';
import {routeAccess} from '@/auth/authorization';
import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
import '@/styles/portal-system.css';
export function PeoplePage(){
 const {principal,privateEpoch,privateBlocked}=useAuth();const allowed=routeAccess(principal,'/people')&&!privateBlocked;
 const [view,setView]=useState<'list'|'structure'>('list');const [search,setSearch]=useState('');const [inactive,setInactive]=useState(false);const normalizedSearch=search.trim();
 const structure=useQuery({queryKey:['people','organization-tree',privateEpoch,normalizedSearch,inactive],queryFn:({signal})=>peopleApi.organizationTree({search:normalizedSearch,include_inactive:inactive},signal),enabled:allowed&&view==='structure',retry:false});
 if(!allowed)return <Alert type="warning" message="Сотрудники доступны после входа в личную учётную запись"/>;
 return <div className="pulse-stack pulse-system-page people-page"><div className="pulse-page-heading"><h1>Сотрудники</h1><p>Место работы и руководители коллег.</p></div>
 <div className="people-view-switch" role="group" aria-label="Вид сотрудников"><Button aria-pressed={view==='list'} type={view==='list'?'primary':'default'} onClick={()=>setView('list')}>Список</Button><Button aria-pressed={view==='structure'} type={view==='structure'?'primary':'default'} onClick={()=>setView('structure')}>Структура</Button></div>
 {view==='structure'?<>
 <p className="organization-tree-hint">У структуры свой поиск и показ отключённых учётных записей. Фильтры и сортировка списка сохраняются при возврате.</p>
 <div className="access-toolbar"><label>Поиск по структуре<Input aria-label="Поиск по структуре" placeholder="Имя, должность или место работы" value={search} onChange={e=>setSearch(e.target.value)} allowClear/></label><Checkbox checked={inactive} onChange={e=>setInactive(e.target.checked)}>Показать отключённые учётные записи</Checkbox></div>
 <OrganizationTreeState query={structure} search={normalizedSearch} scope={`${privateEpoch}:${normalizedSearch}:${inactive}`} onList={()=>setView('list')} onReset={()=>setSearch('')}/>
 </>:<Card><ServerEntityTable<EmployeeProfile> tableKey="people" read={(q,s)=>getTablePage('/api/v1/people',q,s)} rowKey="id" initialQuery={{version:1,sort:[],filters:[{field:'active',op:'in',values:[true]}]}} scroll={{x:900}}
 fields={[{key:'name',label:'Сотрудник',kind:'text',read:r=>r.name},{key:'job_title',label:'Должность',kind:'text',read:r=>r.job_title},
 {key:'workplace_organization',label:'Организация',column:'Место работы',primary:true,kind:'text',read:r=>r.workplace.organization},{key:'workplace_division',label:'Подразделение',column:'Место работы',kind:'text',read:r=>r.workplace.division},{key:'workplace_department',label:'Отдел',column:'Место работы',kind:'text',read:r=>r.workplace.department},
 {key:'manager_name',label:'Руководитель',kind:'text',read:r=>r.manager?.name},{key:'active',label:'Учётная запись',kind:'boolean',read:r=>r.active}]}
 columns={[{title:'Сотрудник',render:(_,p)=><Link className="employee-name-link" to={`/people/${p.id}`}>{p.name}</Link>},{title:'Должность',dataIndex:'job_title',render:v=>v??'Не указана'},
 {title:'Место работы',render:(_,p)=>[p.workplace.organization,p.workplace.division,p.workplace.department].filter(Boolean).join(' → ')||'Не указано'},
 {title:'Руководитель',render:(_,p)=>p.manager?<Link className="employee-name-link" to={`/people/${p.manager.id}`}>{p.manager.name}{p.manager.active?'':' · Учётная запись отключена'}</Link>:'Не указан'},
 {title:'Учётная запись',render:(_,p)=>p.active?'Активна':'Отключена'}]}/></Card>}</div>;
}

function OrganizationTreeState({query,search,scope,onList,onReset}:{query:{isPending:boolean;isFetching:boolean;isError:boolean;error:unknown;data?:import('@/api/people').OrganizationTree;refetch:()=>unknown};search:string;scope:string;onList:()=>void;onReset:()=>void}){
 if(query.isError){const error=axios.isAxiosError(query.error)?organizationTreeError(query.error.response?.status??0,query.error.response?.data):'error';const message={unsupported:'Структура недоступна в этой версии сервера',too_large:'Слишком много данных для структуры',timeout:'Загрузка структуры заняла слишком много времени',forbidden:'Доступ к структуре закрыт',error:'Не удалось загрузить структуру'}[error];return <Alert className="organization-tree-state" role="alert" type="error" message={message} description={error==='too_large'?'Уточните поиск или выключите показ отключённых учётных записей':undefined} action={error==='unsupported'||error==='too_large'?<Button onClick={onList}>Перейти к списку</Button>:error==='forbidden'?undefined:<Button onClick={()=>void query.refetch()}>Повторить</Button>}/>;}
 if(query.isPending||(!query.data&&query.isFetching))return <div className="organization-tree-panel" aria-busy="true"><p role="status">Загрузка структуры…</p><Skeleton active/></div>;
 if(!query.data)return null;
 if(!query.data.employee_count)return <div className="organization-tree-panel organization-tree-state"><Empty description={search?'Сотрудники не найдены':'Пока нет сотрудников'}/><p>{search?'Измените поиск или фильтр отключённых учётных записей':'Структура появится, когда будут заполнены профили сотрудников'}</p>{search&&<Button onClick={onReset}>Сбросить поиск</Button>}</div>;
 return <OrganizationTree key={scope} data={query.data}/>;
}
