import {apiClient} from './client';
import {parseLosslessJSON} from '../lib/fileJobs';
import {tablePageParams} from '../lib/tableTransport';
import type {TablePage,TablePageRequest} from '../lib/tableTransport';
export async function getTablePage<T>(path:string,request:TablePageRequest,signal?:AbortSignal,params:Record<string,unknown>={}):Promise<TablePage<T>> {
 const result=await apiClient.get<TablePage<T>>(path,{signal,params:{...params,...tablePageParams(request)},transformResponse:[parseLosslessJSON]});
 if(!Array.isArray(result.data?.items)||!(result.data.next_cursor===null||typeof result.data.next_cursor==='string'))throw new Error('Сервер не вернул страницу таблицы');
 return result.data;
}
