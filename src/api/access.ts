import { apiClient } from './client';
export type Role = 'admin' | 'technologist' | 'viewer';
export interface AccessScope {funds: ('operational'|'presentation')[]; ngdus: number[] | null; departments: number[] | null}
export interface Principal {account_id: number|null; name:string; role:Role; scope:AccessScope; authenticated:boolean; mechanism:string}
export interface AuthState {mode:'legacy'|'local'; principal:Principal|null}
export interface Account {id:number;login:string;name:string;role:Role;scope:AccessScope;active:boolean;revision:number;created_at:string;last_login:string|null}
export type AccountInput = Omit<Account,'id'|'created_at'|'last_login'> & {password?:string};
export const accessApi = {
 me:async()=>(await apiClient.get<AuthState>('/api/v1/auth/me')).data,
 login:async(login:string,password:string)=>(await apiClient.post<AuthState>('/api/v1/auth/login',{login,password})).data,
 logout:async()=>{await apiClient.post('/api/v1/auth/logout');},
 users:async()=>(await apiClient.get<Account[]>('/api/v1/auth/users')).data,
 create:async(input:AccountInput)=>(await apiClient.post<Account>('/api/v1/auth/users',input)).data,
 update:async(id:number,input:AccountInput)=>(await apiClient.put<Account>(`/api/v1/auth/users/${id}`,input)).data,
};
export const roleLabels:Record<Role,string>={admin:'Администратор',technologist:'Технолог',viewer:'Наблюдатель'};
