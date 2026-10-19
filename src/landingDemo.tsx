/** Демо на настоящих компонентах приложения, с синтетикой и без HTTP. */
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { AxiosAdapter } from 'axios';
import 'antd/dist/reset.css';
import './index.css';
import { antdTheme } from '@/theme/antdTheme';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { MlRiskPage } from '@/pages/MlRiskPage';
import { WellDetailPage } from '@/pages/WellDetailPage';
import { apiClient } from '@/api/client';
import type { MlWell } from '@/api/ml';
const ids=[1042,2087,4021,3156,5184,6012,7025,8123];
const wells=ids.map(id=>({id,well_number:String(id),unitek_id:id,armits_id:id,ngdu:'Демоучасток',department:1,active:true}));
const scored:MlWell[]=ids.map((id,i)=>({well_id:id,unitek_id:id,app_well_id:id,alert_id:i<4?id:null,alert_status:i<4?'new':null,tier:i<2?'alert':i<4?'watch':null,oilfield:'Участок А',risk:[.92,.86,.74,.68,.34,.27,.18,.12][i],alert:i<2,windows_fired:i<2?12:i<4?4:0,windows_total:30,data_ok:true,rule_findings:[],window_end:'2026-10-14T05:00:00',true_failure_type:null,true_failure_type_name:null,true_failure_at:null}));
const contributions=[{feature:'flow_trend',label:'Динамика дебита',value:34,shap:.24},{feature:'current_trend',label:'Нагрузка двигателя',value:22.4,shap:.18},{feature:'temperature_trend',label:'Температура двигателя',value:91,shap:.12},{feature:'frequency_stability',label:'Стабильность частоты',value:50,shap:-.06}];
let demoRunning=false;
const adapter:AxiosAdapter=async config=>{
 const path=(config.url??'').replace('/api/v1','');const id=Number(path.match(/\/(\d+)/)?.[1]??1042);let data:unknown=[];
 if(config.method!=='get'&&path.includes('/alerts/')){const body=typeof config.data==='string'?JSON.parse(config.data):config.data;const row=scored.find(w=>w.alert_id===id);if(row)row.alert_status=body.status;data={id,status:body.status};}
 else if(path==='/ml/wells/refresh'){demoRunning=true;setTimeout(()=>{demoRunning=false;},1200);data={started:true};}
 else if(path==='/ml/wells')data={count:8,alert_threshold:.7,high_threshold:.85,running:false,wells:scored};
 else if(path==='/ml/runs')data={running:demoRunning,runs:[{id:1,started_at:'2026-10-14T05:00:00',finished_at:'2026-10-14T05:02:00',status:demoRunning?'running':'done',trigger:'manual',wells_scored:8,alerts_count:2,error:null,drift_verdict:'stable',drift_psi_max:.04,drift_top:null}]};
 else if(path==='/ml/health')data={urgency:'none',needed:false,reasons:[],drift_verdict:'stable',alerts_reviewed:0,alerts_false:0,false_alert_rate:null,model_age_days:5};
 else if(path==='/ml/metrics')data={models:[]};
 else if(path.endsWith('/explain'))data={well_id:id,contributions};
 else if(path.endsWith('/history'))data={well_id:id,threshold:.7,high_threshold:.85,windows_total:30,windows_fired:12,points:Array.from({length:30},(_,i)=>({window_end:new Date(Date.UTC(2026,8,15+i)).toISOString(),risk:.18+i*.024,fired:i>21}))};
 else if(path.includes('/by-unitek/'))data=scored.find(w=>w.unitek_id===id)??scored[0];
 else if(path==='/wells')data=wells;
 else if(/^\/wells\/\d+$/.test(path))data=wells.find(w=>w.id===id)??wells[0];
 else if(path.endsWith('/classification'))data={classification:'Требуется проверка',well_id:id};
 else if(path==='/departments')data=[{id:1,name:'Цех 01'}];
 else if(path.includes('stats'))data={total:16,by_type:[{failure_type:1,count:6},{failure_type:2,count:5},{failure_type:10,count:5}],by_month:[{month:'2026-07',count:4},{month:'2026-08',count:7},{month:'2026-09',count:5}]};
 return {config,data,status:200,statusText:'OK',headers:{}};
};
apiClient.defaults.adapter=adapter;
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,refetchOnWindowFocus:false}}});
const router=createMemoryRouter([{path:'/',element:<AppLayout/>,children:[{index:true,element:<Dashboard/>},{path:'ml-risk',element:<MlRiskPage/>},{path:'wells/:wellId',element:<WellDetailPage/>},{path:'*',element:<Alert type="info" message="Этот раздел доступен в полной версии" description={<Button onClick={()=>router.navigate('/')}>Вернуться к обзору</Button>}/>}]}]);
window.addEventListener('message',e=>{if(e.source!==window.parent)return;const routes:Record<string,string>={overview:'/',well:'/wells/1042',signal:'/ml-risk'};const route=routes[e.data?.pulseView];if(route)void router.navigate(route);});
function reportRoute():void{const path=router.state.location.pathname;const view=path.startsWith('/wells/')?'well':path==='/ml-risk'?'signal':path==='/'?'overview':null;if(view)window.parent.postMessage({pulseRoute:view},'*');}
router.subscribe(reportRoute);
window.parent.postMessage({pulseReady:true},'*');
const root=document.getElementById('root');if(!root)throw new Error('Не найден контейнер демо');
createRoot(root).render(<ConfigProvider theme={antdTheme} locale={ruRU}><AntApp><div style={{padding:'10px 16px',background:'#fff7e7',fontSize:13,color:'#765115'}}>Демонстрация приложения · 8 синтетических скважин · действия не сохраняются на сервере</div><QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider></AntApp></ConfigProvider>);
