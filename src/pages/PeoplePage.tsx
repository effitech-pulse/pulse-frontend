import {Alert,Card} from 'antd';
import {Link} from 'react-router-dom';
import type {EmployeeProfile} from '@/api/people';
import {useAuth} from '@/auth/AuthProvider';
import {routeAccess} from '@/auth/authorization';
import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
import '@/styles/portal-system.css';
export function PeoplePage(){
 const {principal,privateBlocked}=useAuth();const allowed=routeAccess(principal,'/people')&&!privateBlocked;
 if(!allowed)return <Alert type="warning" message="Сотрудники доступны после входа в личную учётную запись"/>;
 return <div className="pulse-stack pulse-system-page people-page"><div className="pulse-page-heading"><h1>Сотрудники</h1><p>Место работы и руководители коллег.</p></div><Card><ServerEntityTable<EmployeeProfile> tableKey="people" read={(q,s)=>getTablePage('/api/v1/people',q,s)} rowKey="id" initialQuery={{version:1,sort:[],filters:[{field:'active',op:'in',values:[true]}]}} scroll={{x:900}}
 fields={[{key:'name',label:'Сотрудник',kind:'text',read:r=>r.name},{key:'job_title',label:'Должность',kind:'text',read:r=>r.job_title},
 {key:'workplace_organization',label:'Организация',column:'Место работы',primary:true,kind:'text',read:r=>r.workplace.organization},{key:'workplace_division',label:'Подразделение',column:'Место работы',kind:'text',read:r=>r.workplace.division},{key:'workplace_department',label:'Отдел',column:'Место работы',kind:'text',read:r=>r.workplace.department},
 {key:'manager_name',label:'Руководитель',kind:'text',read:r=>r.manager?.name},{key:'active',label:'Учётная запись',kind:'boolean',read:r=>r.active}]}
 columns={[{title:'Сотрудник',render:(_,p)=><Link className="employee-name-link" to={`/people/${p.id}`}>{p.name}</Link>},{title:'Должность',dataIndex:'job_title',render:v=>v??'Не указана'},
 {title:'Место работы',render:(_,p)=>[p.workplace.organization,p.workplace.division,p.workplace.department].filter(Boolean).join(' → ')||'Не указано'},
 {title:'Руководитель',render:(_,p)=>p.manager?<Link className="employee-name-link" to={`/people/${p.manager.id}`}>{p.manager.name}{p.manager.active?'':' · Учётная запись отключена'}</Link>:'Не указан'},
 {title:'Учётная запись',render:(_,p)=>p.active?'Активна':'Отключена'}]}/></Card></div>;
}
