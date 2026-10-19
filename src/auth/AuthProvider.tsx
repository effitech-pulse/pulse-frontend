import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Card, Form, Input, Space, Spin, Typography } from 'antd';
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
 if(!state || !state.principal)return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}><Card style={{width:'100%',maxWidth:420}}><Space direction="vertical" size="large" style={{width:'100%'}}><div><Typography.Title level={3}>Пульс скважины</Typography.Title><Typography.Text type="secondary">Вход в рабочее пространство</Typography.Text></div>{error&&<Alert type="error" message={error} />}{state?.mode==='local'?<Form layout="vertical" onFinish={login}><Form.Item name="login" label="Логин" rules={[{required:true,message:'Введите логин'}]}><Input autoComplete="username" autoFocus maxLength={80} /></Form.Item><Form.Item name="password" label="Пароль" rules={[{required:true,message:'Введите пароль'}]}><Input.Password autoComplete="current-password" /></Form.Item><Button block type="primary" htmlType="submit" loading={busy}>Войти</Button></Form>:<Button onClick={()=>void refresh()}>Повторить подключение</Button>}</Space></Card></div>;
 const isAdmin=state.principal.role==='admin';
 return <AuthContext.Provider value={{...state,isAdmin,canOperate:isAdmin||state.principal.role==='technologist',logout}}>{children}</AuthContext.Provider>;
}
