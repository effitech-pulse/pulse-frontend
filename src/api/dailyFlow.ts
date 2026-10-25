import {apiClient} from './client';
import {validateDailyFlow, type DailyFlowView, type DailyQuery} from '../lib/dailyFlow';
const path=(wellId:string)=>`/api/v1/wells/${encodeURIComponent(wellId)}/daily-flow`;
export async function readDailyFlow(wellId:string,query:DailyQuery={},signal?:AbortSignal){const response=await apiClient.get<unknown>(path(wellId),{params:query,signal});return validateDailyFlow(response.data,wellId,query);}
export async function exportDailyFlow(view:DailyFlowView,signal?:AbortSignal):Promise<Blob>{
 const {start_date,end_date,dataset_version,view_id}=view;
 const response=await apiClient.get<Blob>(`${path(view.well_id)}/export`,{params:{start_date,end_date,dataset_version,view_id},signal,responseType:'blob',transformResponse:[(value:Blob)=>value]});
 if(!(response.data instanceof Blob)||response.data.size===0)throw Error('Excel не удалось скачать');
 return response.data;
}
