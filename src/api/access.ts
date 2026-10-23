import {parseAccessFields} from '../auth/authorization';
import { apiClient } from './client';
export type Role = 'admin' | 'technologist' | 'viewer';
export interface AccessScope {funds: ('operational'|'presentation')[]; ngdus: number[] | null; departments: number[] | null}
export type Decimal = string;
export interface RoleSummary {id:Decimal; name:string; revision:Decimal; builtin_key:string|null}
export interface GroupMembership {id:Decimal; name:string; revision:Decimal; role_ids:Decimal[]}
export interface PermissionSource {role_id:Decimal;role_name:string;role_revision:Decimal;builtin_key:string|null;group_id:Decimal|null;group_name:string|null}
export interface OrganizationScope {kind:'none'|'organization'|'ngdu'|'department';ngdu_id:Decimal|null;department_id:Decimal|null}
export interface AccessFields {access_model?:string;access_id?:Decimal;access_revision?:Decimal;legacy_role?:string|null;role_ids?:Decimal[];group_ids?:Decimal[];roles?:RoleSummary[];direct_roles?:RoleSummary[];groups?:GroupMembership[];permission_keys?:string[];permission_sources?:Record<string,PermissionSource[]>;organization_scope?:OrganizationScope|null;legacy_scope?:boolean;authz_epoch?:Decimal;graph_revision?:Decimal}
export interface Principal extends AccessFields {account_id: number|null; name:string; role:Role; scope:AccessScope; authenticated:boolean; mechanism:string}
export interface AuthState {mode:'legacy'|'local'; principal:Principal|null}
export interface Account extends AccessFields {id:number;login:string;name:string;role:Role;scope:AccessScope;active:boolean;revision:number;created_at:string;last_login:string|null}
export type AccountInput = Omit<Account,'id'|'created_at'|'last_login'> & {password?:string};
export const accessApi = {
 me:async()=>parseAuthState((await apiClient.get<AuthState>('/api/v1/auth/me')).data),
 login:async(login:string,password:string)=>parseAuthState((await apiClient.post<AuthState>('/api/v1/auth/login',{login,password})).data),
 logout:async()=>{await apiClient.post('/api/v1/auth/logout');},
 users:async()=>(await apiClient.get<Account[]>('/api/v1/auth/users')).data,
 create:async(input:AccountInput)=>(await apiClient.post<Account>('/api/v1/auth/users',input)).data,
 update:async(id:number,input:AccountInput)=>(await apiClient.put<Account>(`/api/v1/auth/users/${id}`,input)).data,
};
export const roleLabels:Record<Role,string>={admin:'Администратор',technologist:'Технолог',viewer:'Наблюдатель'};

function parseAuthState(state:AuthState):AuthState {if(state.principal)parseAccessFields(state.principal);return state;}
