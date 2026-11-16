import { useEffect, useRef } from 'react';
import { focusRouteHeading } from '@/lib/accessDraft';
import { Alert, Skeleton } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { peopleApi } from '@/api/people';
import { useAuth } from '@/auth/AuthProvider';
import { routeAccess } from '@/auth/authorization';
import { NavigationAction } from '@/components/common/NavigationAction';
import { AccessError } from '@/components/access/UsersPanel';
import '@/styles/portal-system.css';
export function EmployeeProfilePage(){
 const {id}=useParams();const {principal,privateEpoch,privateBlocked}=useAuth();
 const focusedRoute=useRef<string>();
 const allowed=routeAccess(principal,'/people')&&!privateBlocked;
 const query=useQuery({queryKey:['people','profile',privateEpoch,id],queryFn:()=>peopleApi.get(id!),enabled:allowed&&!!id,retry:false});
 useEffect(()=>{if(allowed)focusedRoute.current=focusRouteHeading(`profile:${id}`,document.getElementById('employee-profile-heading'),focusedRoute.current);},[id,allowed]);
 if(!allowed)return <Alert type="warning" message="Профиль доступен после входа в личную учётную запись"/>;
 const p=query.data;
 return <div className="pulse-stack pulse-system-page access-page employee-profile-page"><NavigationAction to="/people" direction="back">К сотрудникам</NavigationAction>
 <div className="pulse-page-heading"><h1 id="employee-profile-heading" tabIndex={-1}>{p?.name??'Профиль сотрудника'}</h1>{p&&<p>{p.job_title??'Должность не указана'}{p.workplace.department?` · ${p.workplace.department}`:''}</p>}</div>
 {query.isError?axios.isAxiosError(query.error)&&query.error.response?.status===404?<Alert type="info" message="Сотрудник не найден"/>:<AccessError error={query.error} retry={()=>void query.refetch()}/>:query.isPending?<Skeleton active/>:p?<>
 {!p.active&&<Alert type="info" message="Учётная запись отключена" description="Вход в систему закрыт."/>}
 <section className="employee-panel access-form"><h2>Рабочая структура</h2><dl>{([['Организация',p.workplace.organization],['Подразделение',p.workplace.division],['Отдел',p.workplace.department]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value??'Не указано'}</dd></div>)}</dl></section>
 <section className="employee-panel access-form"><h2>Руководитель</h2>{p.manager?<><Link className="employee-name-link" to={`/people/${p.manager.id}`}>{p.manager.name}</Link><p>{p.manager.job_title??'Должность не указана'}</p>{!p.manager.active&&<p>Учётная запись руководителя отключена</p>}</>:<p>Не указан</p>}</section>
 </>:null}</div>;
}
