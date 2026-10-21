import { Button, Card, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AuditEntry } from '@/api/types';
import { useAudit } from '@/hooks/useAudit';
import { PageSpin } from '@/components/common/PageSpin';
import { formatSnapshotTime } from '@/lib/displayTime';
const METHOD_COLOR: Record<string,string>={POST:'green',PUT:'blue',PATCH:'gold',DELETE:'red'};
export function AuditPage() {
  const {data,isLoading,error,refetch,isFetching}=useAudit();
  const columns:ColumnsType<AuditEntry>=[
    {title:'Время',dataIndex:'ts',key:'ts',width:220,render:(timestamp:string)=><time dateTime={timestamp} title={timestamp}>{formatSnapshotTime(timestamp)}</time>},
    {title:'Пользователь',dataIndex:'actor',key:'actor',width:180,render:(actor:string|null)=>actor??'—'},
    {title:'Метод',dataIndex:'method',key:'method',width:100,render:(method:string)=><Tag color={METHOD_COLOR[method]??'default'}>{method}</Tag>},
    {title:'Путь API',dataIndex:'path',key:'path',ellipsis:true,render:(value:string)=><span title={value}>{value}</span>},
    {title:'Статус',dataIndex:'status_code',key:'status_code',width:95,render:(status:number)=><Tag color={status>=400?'red':status>=200?'green':'default'}>{status}</Tag>},
  ];
  return <div className="pulse-stack pulse-monitoring-page pulse-monitoring-audit">
    <div className="pulse-page-heading pulse-toolbar"><div><h1>Журнал запросов</h1><p>Записи изменяющих запросов к API</p></div><Button loading={isFetching} onClick={()=>void refetch()}>Обновить</Button></div>
    <Card className="pulse-monitoring-table-card"><PageSpin loading={isLoading} error={error}><Table<AuditEntry> rowKey="id" columns={columns} dataSource={data??[]} scroll={{x:850}} pagination={{pageSize:20,showSizeChanger:false,showTotal:total=>`Количество: ${total}`}} locale={{emptyText:<span className="pulse-muted">В текущем пространстве записи журнала недоступны</span>}} /></PageSpin>{!isLoading&&!error&&data?.length===0&&<p className="pulse-monitoring-caption">Нет доступных записей</p>}</Card>
    <p className="pulse-monitoring-caption">HTTP-журнал не является предметной историей проверок и заключений. Показаны до 200 доступных записей; список обновляется каждые 15 секунд.</p>
  </div>;
}
