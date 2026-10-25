import type {TableQuery} from './tableQuery.ts';
export interface TablePage<T>{items:T[];next_cursor:string|null;graph_revision?:string;total_visible?:number}
export interface TablePageRequest{query:TableQuery;pageSize?:number;cursor?:string;graph_revision?:string}
export function tablePageParams(request:TablePageRequest){return {table_query:JSON.stringify(request.query),page_size:request.pageSize??25,...(request.cursor?{cursor:request.cursor}:{}),...(request.graph_revision?{graph_revision:request.graph_revision}:{})};}
export function isTableCursorError(problem:{code?:string;message?:string;detail?:unknown}):boolean {
 const reason=typeof problem.detail==='object'&&problem.detail!==null?(problem.detail as {reason?:string}).reason:undefined;
 return problem.message==='invalid_table_cursor'||problem.code==='invalid_table_cursor'||['table_cursor_invalid','table_cursor_stale','table_cursor_restart_required','cursor_restart_required'].includes(problem.code??'')||['table_cursor_invalid','table_cursor_stale','cursor_restart_required'].includes(reason??'');
}
/** Ответ не переживает смену сеанса, parent/query или отмену подписки. */
export async function guardTablePage<T>(ticket:{current:()=>boolean},work:()=>Promise<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted||!ticket.current())throw new DOMException('Устаревший запрос','AbortError');
 const result=await work();if(signal.aborted||!ticket.current())throw new DOMException('Устаревший ответ','AbortError');return result;
}
