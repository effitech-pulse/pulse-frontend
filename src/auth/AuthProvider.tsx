import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Spin } from 'antd';
import { LoginPage } from '@/auth/LoginPage';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { accessApi, type AuthState } from '@/api/access';
import { apiClient, toApiError } from '@/api/client';
import {can,canAny,type PermissionKey} from './authorization';
import {PrivateEpoch} from '@/lib/privateEpoch';
interface AuthContextValue extends AuthState {can:(...keys:PermissionKey[])=>boolean;canAny:(...alternatives:PermissionKey[][])=>boolean;logout:()=>Promise<void>;privateEpoch:number;privateBlocked:boolean;capturePrivate:()=>{value:number;current:()=>boolean};denyPrivate:()=>void;refreshSession:()=>Promise<void>}
const fallbackEpoch=new PrivateEpoch();
const AuthContext=createContext<AuthContextValue>({mode:'legacy',principal:null,can:()=>false,canAny:()=>false,logout:async()=>{},privateEpoch:0,privateBlocked:true,capturePrivate:()=>fallbackEpoch.capture(),denyPrivate:()=>{},refreshSession:async()=>{}});
export const useAuth=()=>useContext(AuthContext);
export function AuthProvider({children}:{children:ReactNode}) {
 const client=useQueryClient();const [state,setState]=useState<AuthState>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const epoch=useRef(new PrivateEpoch());const [version,setVersion]=useState(0);const [privateBlocked,setPrivateBlocked]=useState(false);const signature=useRef('');const refreshSequence=useRef(0);
 function invalidate(){try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith('pulse-check-request:'))sessionStorage.removeItem(key);}}catch{/* Storage unavailable. */}epoch.current.invalidate();setVersion(epoch.current.capture().value);void client.cancelQueries();client.clear();}
 function accept(next:AuthState){const sig=JSON.stringify(next);if(signature.current!==sig){signature.current=sig;invalidate();}setState(next);}
 async function refresh(){const sequence=++refreshSequence.current;const ticket=epoch.current.capture();setError('');try{const next=await accessApi.me();if(sequence===refreshSequence.current&&ticket.current())accept(next);}catch(e){if(sequence!==refreshSequence.current||!ticket.current())return;if(axios.isAxiosError(e)&&e.response?.status===401){accept({mode:'local',principal:null});}else setError(toApiError(e).message);}}
 useEffect(()=>{void refresh();const focus=()=>{if(document.visibilityState!=='hidden')void refresh();};window.addEventListener('focus',focus);window.addEventListener('online',focus);return()=>{window.removeEventListener('focus',focus);window.removeEventListener('online',focus);};},[]);
 useEffect(()=>{
  const tickets=new WeakMap<object,ReturnType<PrivateEpoch['capture']>>();
  const requestID=apiClient.interceptors.request.use(config=>{tickets.set(config,epoch.current.capture());return config;});
  const responseID=apiClient.interceptors.response.use(response=>{
   if(tickets.get(response.config)?.current()===false)throw new DOMException('Old session','AbortError');
   return response;
  },error=>{
   if(error.config&&tickets.get(error.config)?.current()===false)return Promise.reject(new DOMException('Old session','AbortError'));
   if(error.response?.status===401&&!error.config?.url?.endsWith('/auth/login')){refreshSequence.current++;invalidate();signature.current='';setState({mode:'local',principal:null});}
   return Promise.reject(error);
  });
  return()=>{apiClient.interceptors.request.eject(requestID);apiClient.interceptors.response.eject(responseID);};
 },[client]);
 async function login(values:{login:string;password:string}){setBusy(true);setError('');refreshSequence.current++;invalidate();try{const next=await accessApi.login(values.login,values.password);setPrivateBlocked(false);accept(next);}catch(e){setError(toApiError(e).message);}finally{setBusy(false);}}
 async function logout(){refreshSequence.current++;invalidate();signature.current='';setState({mode:'local',principal:null});try{await accessApi.logout();}catch(e){setError(toApiError(e).message);}}
 function denyPrivate(){setPrivateBlocked(true);invalidate();}
 if(!state && !error)return <div style={{padding:80,textAlign:'center'}}><Spin size="large" /></div>;
 if(!state || !state.principal)return <LoginPage mode={state?.mode} error={error} busy={busy} onLogin={login} onRetry={refresh} />;
 return <AuthContext.Provider value={{...state,can:(...keys)=>can(state.principal,...keys),canAny:(...alternatives)=>canAny(state.principal,...alternatives),logout,privateEpoch:version,privateBlocked,capturePrivate:()=>epoch.current.capture(),denyPrivate,refreshSession:refresh}}><PrivateSession key={version}>{children}</PrivateSession></AuthContext.Provider>;
}
function PrivateSession({children}:{children:ReactNode}){return <>{children}</>;}
