import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Spin } from 'antd';
import { LoginPage } from '@/auth/LoginPage';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { accessApi, type AuthState } from '@/api/access';
import { apiClient, toApiError } from '@/api/client';
interface AuthContextValue extends AuthState {isAdmin:boolean;canOperate:boolean;logout:()=>Promise<void>}
const AuthContext=createContext<AuthContextValue>({mode:'legacy',principal:null,isAdmin:false,canOperate:false,logout:async()=>{}});
export const useAuth=()=>useContext(AuthContext);
export function AuthProvider({children}:{children:ReactNode}) {
 const client=useQueryClient();const [state,setState]=useState<AuthState>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function refresh(){setError('');try{setState(await accessApi.me());}catch(e){if(axios.isAxiosError(e)&&e.response?.status===401){setState({mode:'local',principal:null});}else setError(toApiError(e).message);}}
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{const id=apiClient.interceptors.response.use(r=>r,e=>{if(e.response?.status===401 && !e.config?.url?.endsWith('/auth/login')) {void client.cancelQueries();client.clear();setState(v=>v?.mode==='local'?{mode:'local',principal:null}:v);}return Promise.reject(e);});return()=>apiClient.interceptors.response.eject(id);},[client]);
 async function login(values:{login:string;password:string}){setBusy(true);setError('');try{const next=await accessApi.login(values.login,values.password);await client.cancelQueries();client.clear();setState(next);}catch(e){setError(toApiError(e).message);}finally{setBusy(false);}}
 async function logout(){await accessApi.logout();await client.cancelQueries();client.clear();setState({mode:'local',principal:null});}
 if(!state && !error)return <div style={{padding:80,textAlign:'center'}}><Spin size="large" /></div>;
 if(!state || !state.principal)return <LoginPage mode={state?.mode} error={error} busy={busy} onLogin={login} onRetry={refresh} />;
 const isAdmin=state.principal.role==='admin';
 return <AuthContext.Provider value={{...state,isAdmin,canOperate:isAdmin||state.principal.role==='technologist',logout}}>{children}</AuthContext.Provider>;
}
