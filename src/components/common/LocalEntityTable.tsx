import type {TableProps} from 'antd';
import {PulseTable} from './PulseTable';
import type {PulseColumn} from './PulseTable';
import type {FieldSchema,TableQuery,TableSort} from '../../lib/tableQuery';
import {useTableState} from '../../hooks/useTableState';
export type EntityField<T> = FieldSchema<T> & {column?:string;primary?:boolean};
export function entityColumns<T extends object>(columns:NonNullable<TableProps<T>['columns']>,fields:EntityField<T>[]):PulseColumn<T>[] {
 return columns.map((column,index)=>{
  const key=String(column.key??('dataIndex' in column?column.dataIndex:undefined)??`column-${index}`);
  const matches=fields.filter(field=>field.key===key||(field.column??field.label)===column.title);
  const {sorter:_sorter,filters:_filters,...rest}=column as PulseColumn<T>&{sorter?:unknown;filters?:unknown};
  return {...rest,key,filterKeys:matches.map(field=>field.key),sortKey:matches.find(field=>field.primary)?.key??matches[0]?.key};
 });
}
export type LocalEntityTableProps<T> = Omit<TableProps<T>,'pagination'|'columns'> & {tableKey:string;fields:EntityField<T>[];columns:NonNullable<TableProps<T>['columns']>;defaultSort?:TableSort[];initialQuery?:TableQuery;pagination?:TableProps<T>['pagination']};
export function LocalEntityTable<T extends object>({tableKey,fields,columns,dataSource=[],defaultSort=[],initialQuery,...props}:LocalEntityTableProps<T>){
 const state=useTableState(tableKey,fields,initialQuery);const rowId=(row:T)=>typeof props.rowKey==='function'?String(props.rowKey(row)):String((row as Record<string,unknown>)[typeof props.rowKey==='string'?props.rowKey:'id']);
 const size=props.pagination===false?Math.max(1,dataSource.length):state.pageSize;
 return <PulseTable mode="local" schema={{fields,defaultSort,rowId}} columns={entityColumns(columns,fields)} rows={[...dataSource]}
  query={state.query} onQueryChange={state.setQuery} pagination={{page:Math.min(state.page,Math.max(1,Math.ceil(dataSource.length/size))),pageSize:size,onPageChange:state.setPage}}
  rowKey={props.rowKey} scroll={props.scroll} size={props.size} loading={typeof props.loading==='boolean'?props.loading:props.loading?.spinning}
  locale={props.locale} rowClassName={props.rowClassName} onRow={props.onRow} components={props.components}/>
}
