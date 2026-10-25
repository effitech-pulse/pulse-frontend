import type { ManagedProfile } from './people';
import { parseAccessFields } from '../auth/authorization';
import { apiClient } from './client';
export type Role = 'admin' | 'technologist' | 'viewer';
export interface AccessScope {
    funds: ('operational' | 'presentation')[];
    ngdus: number[] | null;
    departments: number[] | null;
}
export type Decimal = string;
export interface RoleSummary {
    id: Decimal;
    name: string;
    revision: Decimal;
    builtin_key: string | null;
}
export interface GroupMembership {
    id: Decimal;
    name: string;
    revision: Decimal;
    role_ids: Decimal[];
}
export interface PermissionSource {
    role_id: Decimal;
    role_name: string;
    role_revision: Decimal;
    builtin_key: string | null;
    group_id: Decimal | null;
    group_name: string | null;
}
export interface OrganizationScope {
    kind: 'none' | 'organization' | 'ngdu' | 'department';
    ngdu_id: Decimal | null;
    department_id: Decimal | null;
}
export interface AccessFields {
    access_model?: string;
    access_id?: Decimal;
    access_revision?: Decimal;
    legacy_role?: string | null;
    role_ids?: Decimal[];
    group_ids?: Decimal[];
    roles?: RoleSummary[];
    direct_roles?: RoleSummary[];
    groups?: GroupMembership[];
    permission_keys?: string[];
    permission_sources?: Record<string, PermissionSource[]>;
    organization_scope?: OrganizationScope | null;
    legacy_scope?: boolean;
    authz_epoch?: Decimal;
    graph_revision?: Decimal;
}
export interface Principal extends AccessFields {
    account_id: number | null;
    name: string;
    role: Role;
    scope: AccessScope;
    authenticated: boolean;
    mechanism: string;
}
export interface AuthState {
    mode: 'legacy' | 'local';
    principal: Principal | null;
}
export interface Account extends AccessFields {
    profile?: ManagedProfile;
    id: number;
    login: string;
    name: string;
    role: Role;
    scope: AccessScope;
    active: boolean;
    revision: number;
    created_at: string;
    last_login: string | null;
}
export type AccountInput = Omit<Account, 'id' | 'created_at' | 'last_login'> & {
    password?: string;
};
export const accessApi = {
    me: async () => parseAuthState((await apiClient.get<AuthState>('/api/v1/auth/me')).data),
    login: async (login: string, password: string) => parseAuthState((await apiClient.post<AuthState>('/api/v1/auth/login', { login, password })).data),
    logout: async () => { await apiClient.post('/api/v1/auth/logout'); },
    users: async () => (await apiClient.get<Account[]>('/api/v1/auth/users')).data,
    create: async (input: AccountInput) => (await apiClient.post<Account>('/api/v1/auth/users', input)).data,
    update: async (id: number, input: AccountInput) => (await apiClient.put<Account>(`/api/v1/auth/users/${id}`, input)).data,
};
export const roleLabels: Record<Role, string> = { admin: 'Администратор', technologist: 'Технолог', viewer: 'Наблюдатель' };
function parseAuthState(state: AuthState): AuthState { if (state.principal)
    parseAccessFields(state.principal); return state; }
export interface AccessRole extends RoleSummary {
    description: string;
    permission_keys: string[];
}
export interface AccessGroup {
    id: Decimal;
    revision: Decimal;
    name: string;
    description: string;
    role_ids: Decimal[];
}
export interface AccessPage<T> {
    items: T[];
    next_cursor: string | null;
    total_visible: number;
    graph_revision: Decimal;
}
export interface PageQuery {
    table_query?: string;
    page_size?: number;
    search?: string;
    cursor?: string;
    graph_revision?: Decimal;
    limit?: number;
}
export interface PermissionDefinition {
    key: string;
    name: string;
    description: string;
    resource: string;
    action: string;
    scope_kind: string;
    requires: string[];
}
export interface OrganizationOptions {
    ngdus: {
        id: Decimal;
        name: string;
    }[];
    departments: {
        id: Decimal;
        name: string;
    }[];
    pairs: {
        ngdu_id: Decimal;
        department_id: Decimal;
    }[];
    actor_scope: OrganizationScope | null;
}
export interface UserChange {
    profile?: ManagedProfile;
    id: Decimal | null;
    revision: Decimal;
    login: string;
    name: string;
    active: boolean;
    role_ids: Decimal[];
    group_ids: Decimal[];
    organization?: OrganizationScope;
    reset_password: boolean;
}
export interface RoleChange {
    id: Decimal | null;
    revision: Decimal;
    name: string;
    description: string;
    permission_keys: string[];
    delete: boolean;
}
export interface GroupChange {
    id: Decimal | null;
    revision: Decimal;
    name: string;
    description: string;
    role_ids: Decimal[];
    member_ids: Decimal[];
    delete: boolean;
}
export type AccessChange = {
    user: UserChange;
    role?: never;
    group?: never;
} | {
    role: RoleChange;
    user?: never;
    group?: never;
} | {
    group: GroupChange;
    user?: never;
    role?: never;
};
export interface AccessSnapshot extends AccessFields {
    active: boolean;
    scope: AccessScope;
}
export interface AccessImpact {
    user: Account;
    before: AccessSnapshot;
    after: AccessSnapshot;
    retained_by_other_source: string[];
}
export interface AccessPreviewResponse {
    table_filter_options?: {source_role_ids:{value:Decimal;label:string}[];source_group_ids:{value:Decimal;label:string}[]};
    profile_change?: { before: { name: string; profile: ManagedProfile } | null; after: { name: string; profile: ManagedProfile } } | null;
    session_effect?: 'none' | 'revoke_on_apply';
    graph_revision: Decimal;
    actor_epoch: Decimal;
    fingerprint: string;
    assigned_users: number;
    changed_users: number;
    disabled_users: number;
    self_affected: boolean;
    items: AccessImpact[];
    next_cursor: string | null;
}
export interface AccessApply {
    change: AccessChange;
    graph_revision: Decimal;
    actor_epoch: Decimal;
    fingerprint: string;
}
export interface AccessResult {
    session_effect?: 'none' | 'revoked';
    user: Account | null;
    role: AccessRole | null;
    group: AccessGroup | null;
    graph_revision: Decimal;
    affected_users: number;
}
const root = '/api/v1/auth';
export const managementApi = {
    groupFilterOptions:async(search='',cursor?:string,signal?:AbortSignal)=>(await apiClient.get<{items:{value:string;label:string}[];next_cursor:string|null;graph_revision:string}>(`${root}/groups/filter-options`,{params:{field:'role_ids',search,page_size:25,cursor},signal})).data,
    userFilterOptions:async(field:'role_ids'|'group_ids'|'ngdu_id'|'department_id',search='',cursor?:string,signal?:AbortSignal)=>(await apiClient.get<{items:{value:string;label:string}[];next_cursor:string|null;graph_revision:string}>(`${root}/users/filter-options`,{params:{field,search,page_size:25,cursor},signal})).data,
    users: async (query: PageQuery = {}) => { const page = (await apiClient.get<AccessPage<Account>>(`${root}/users`, { params: { ...query, access_version: 1 } })).data; page.items.forEach(parseAccessFields); return page; },
    user: async (id: Decimal) => parseAccessFields((await apiClient.get<Account>(`${root}/users/${encodeURIComponent(id)}`)).data),
    roles: async (query: PageQuery = {},signal?:AbortSignal) => (await apiClient.get<AccessPage<AccessRole>>(`${root}/roles`, { params: query,signal })).data,
    role: async (id: Decimal) => (await apiClient.get<AccessRole>(`${root}/roles/${encodeURIComponent(id)}`)).data,
    groups: async (query: PageQuery = {},signal?:AbortSignal) => (await apiClient.get<AccessPage<AccessGroup>>(`${root}/groups`, { params: query,signal })).data,
    group: async (id: Decimal) => (await apiClient.get<AccessGroup>(`${root}/groups/${encodeURIComponent(id)}`)).data,
    groupMembers: async (id: Decimal, query: PageQuery = {}) => { const p = (await apiClient.get<AccessPage<Account>>(`${root}/groups/${encodeURIComponent(id)}/members`, { params: query })).data; p.items.forEach(parseAccessFields); return p; },
    orgOptions: async (signal?:AbortSignal) => (await apiClient.get<OrganizationOptions>(`${root}/organization-options`,{signal})).data,
    permissions: async () => (await apiClient.get<PermissionDefinition[]>(`${root}/permissions`)).data,
    preview: async (change: AccessChange, query: PageQuery = {},signal?:AbortSignal) => (await apiClient.post<AccessPreviewResponse>(`${root}/access/preview`, { access_version: 1, change }, { params: query,signal })).data,
    apply: async (receipt: AccessApply, password?: string) => {
        const v = receipt.change.user ?? receipt.change.role ?? receipt.change.group;
        const resource = receipt.change.user ? 'users' : receipt.change.role ? 'roles' : 'groups';
        const deleting = 'delete' in v && v.delete;
        const method = deleting ? 'delete' : v.id === null ? 'post' : 'put';
        const url = `${root}/${resource}${v.id === null ? '' : `/${encodeURIComponent(v.id)}`}`;
        const result = (await apiClient.request<AccessResult>({ method, url, data: { access_version: 1, ...receipt, ...(password ? { password } : {}) } })).data;
        if (result.user)
            parseAccessFields(result.user);
        return result;
    },
};
