import {managementApi} from '@/api/access';
import type {Account} from '@/api/access';
import type {EntityField} from '@/components/common/LocalEntityTable';
import type {FieldSchema} from '@/lib/tableQuery';
export const groupRoleOptions:NonNullable<FieldSchema<unknown>['loadOptions']>=(search,cursor,signal)=>managementApi.groupFilterOptions(search,cursor,signal);
export const roleOptions:NonNullable<FieldSchema<unknown>['loadOptions']>=async(search,cursor,signal)=>{const page=await managementApi.roles({search,cursor,limit:25},signal);return {items:page.items.map(r=>({value:r.id,label:r.name})),next_cursor:page.next_cursor};};
export const groupOptions:NonNullable<FieldSchema<unknown>['loadOptions']>=async(search,cursor,signal)=>{const page=await managementApi.groups({search,cursor,limit:25},signal);return {items:page.items.map(r=>({value:r.id,label:r.name})),next_cursor:page.next_cursor};};
export const userRoleOptions:NonNullable<FieldSchema<unknown>['loadOptions']>=(search,cursor,signal)=>managementApi.userFilterOptions('role_ids',search,cursor,signal);
export const userGroupOptions:NonNullable<FieldSchema<unknown>['loadOptions']>=(search,cursor,signal)=>managementApi.userFilterOptions('group_ids',search,cursor,signal);
const userNgduOptions:NonNullable<FieldSchema<unknown>['loadOptions']>=(search,cursor,signal)=>managementApi.userFilterOptions('ngdu_id',search,cursor,signal);
const userDepartmentOptions:NonNullable<FieldSchema<unknown>['loadOptions']>=(search,cursor,signal)=>managementApi.userFilterOptions('department_id',search,cursor,signal);
export function accountFields(nameColumn='Пользователь'):EntityField<Account>[] {return [
 {key:'name',label:'Имя',column:nameColumn,primary:true,kind:'text',read:r=>r.name},{key:'login',label:'Логин',column:nameColumn,kind:'text',read:r=>r.login},
 {key:'role_ids',label:'Роли',column:'Роли и группы',primary:true,kind:'enum',loadOptions:userRoleOptions,read:r=>(r.role_ids??[]).join(',')},
 {key:'group_ids',label:'Группы',column:'Роли и группы',kind:'enum',loadOptions:userGroupOptions,read:r=>(r.group_ids??[]).join(',')},
 {key:'organization_kind',label:'Область',column:'Подразделение',primary:true,kind:'enum',options:['none','organization','ngdu','department'].map(value=>({value,label:({none:'Не назначено',organization:'Вся организация',ngdu:'НГДУ',department:'Цех'} as Record<string,string>)[value]})),read:r=>r.organization_scope?.kind??null},
 {key:'ngdu_id',label:'НГДУ',column:'Подразделение',kind:'enum',loadOptions:userNgduOptions,read:r=>r.organization_scope?.ngdu_id??null},
 {key:'department_id',label:'Цех',column:'Подразделение',kind:'enum',loadOptions:userDepartmentOptions,read:r=>r.organization_scope?.department_id??null},
 {key:'active',label:'Статус',kind:'boolean',read:r=>r.active},
];}
