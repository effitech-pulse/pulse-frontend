import {Card} from 'antd';
import {useAuth} from '@/auth/AuthProvider';
import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
import type {AuditEntry} from '@/api/types';
export function AuditPage(){
 const {canFull}=useAuth();
 return <div className="pulse-stack pulse-monitoring-page"><div className="pulse-page-heading"><h1>Технический журнал</h1><p>Технический журнал HTTP-запросов не является предметной историей.</p></div><Card><ServerEntityTable<AuditEntry> tableKey="audit" enabled={canFull('audit.read')} read={(q,s)=>getTablePage('/api/v1/audit',q,s)} rowKey="id" locale={{emptyText:<span>Нет доступных записей · записи журнала недоступны</span>}} scroll={{x:850}}
 fields={[{key:'ts',label:'Время записи · пояс не задан',kind:'datetime',timezone:'unspecified',read:r=>r.ts},{key:'actor',label:'Автор',kind:'text',options:[{value:null,label:'Неизвестный автор'}],read:r=>r.actor},{key:'method',label:'Метод',kind:'enum',options:['GET','POST','PUT','PATCH','DELETE'].map(value=>({value,label:value})),read:r=>r.method},{key:'path',label:'Путь',kind:'text',read:r=>r.path},{key:'status_code',label:'Код ответа',kind:'number',read:r=>r.status_code}]}
 columns={[{title:'Время записи · пояс не задан',dataIndex:'ts',render:v=>String(v).replace('T',' ')},{title:'Автор',dataIndex:'actor',render:v=>v??'Неизвестно'},{title:'Метод',dataIndex:'method'},{title:'Путь',dataIndex:'path'},{title:'Код ответа',dataIndex:'status_code'}]}/></Card></div>;
}
