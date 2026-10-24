import type {ReactNode} from 'react';
import {Alert} from 'antd';
import type {TableProps} from 'antd';
import {PulseTable} from './PulseTable';
import {entityColumns} from './LocalEntityTable';
import type {EntityField} from './LocalEntityTable';
import {useServerTable} from '../../hooks/useServerTable';
import type {TablePage,TablePageRequest} from '../../lib/tableTransport';
import type {TableQuery} from '../../lib/tableQuery';
import {toApiError} from '../../api/client';
export function ServerEntityTable<T extends object>({tableKey,fields,read,enabled=true,initialQuery,renderError,...props}:Omit<TableProps<T>,'pagination'|'dataSource'> & {tableKey:string;fields:EntityField<T>[];read:(request:TablePageRequest,signal:AbortSignal)=>Promise<TablePage<T>>;enabled?:boolean;initialQuery?:TableQuery;renderError?:(error:unknown,retry:()=>void)=>ReactNode}){
 const table=useServerTable(tableKey,fields,read,enabled,initialQuery);
 const rowId=(row:T)=>typeof props.rowKey==='function'?String(props.rowKey(row)):String((row as Record<string,unknown>)[typeof props.rowKey==='string'?props.rowKey:'id']);
 return <>{table.isError&&renderError?renderError(table.error,()=>void table.refetch()):null}{table.notice?<Alert type="info" message={table.notice}/>:null}<PulseTable mode="server" schema={{fields,defaultSort:[],rowId}} columns={entityColumns(props.columns??[],fields)} query={table.state.query} onQueryChange={table.state.setQuery}
  onRefresh={table.refresh} refreshing={table.isFetching} refreshDisabled={table.refreshDisabled} headerActions={table.data?.total_visible!==undefined?<span>Доступные записи: {table.data.total_visible}</span>:null} page={table.data??{items:[],next_cursor:null}} pagination={table.pagination} error={table.isError&&!renderError?toApiError(table.error).message:undefined} loading={table.isFetching} rowKey={props.rowKey} scroll={props.scroll} size={props.size} locale={props.locale} rowClassName={props.rowClassName} onRow={props.onRow}/></>;
}
