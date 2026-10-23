import type {Principal, AccessFields} from '../api/access';

/** Fixed catalogue shipped with this client. Prerequisites are checked after server union. */
const prerequisites = {
 "wells.read": [],
 "wells.create": [
  "wells.read"
 ],
 "wells.update": [
  "wells.read"
 ],
 "wells.import": [
  "wells.read"
 ],
 "wells.export": [
  "wells.read"
 ],
 "wells.archive": [
  "wells.read"
 ],
 "wells.restore": [
  "wells.read"
 ],
 "wells.delete": [
  "wells.read"
 ],
 "wells.history.read": [
  "wells.read"
 ],
 "telemetry.read": [
  "wells.read"
 ],
 "telemetry.import": [
  "telemetry.read"
 ],
 "telemetry.compat.read": [
  "telemetry.read"
 ],
 "telemetry.compat.score": [
  "telemetry.compat.read",
  "checks.run"
 ],
 "risks.read": [
  "wells.read"
 ],
 "risks.explain": [
  "risks.read"
 ],
 "risks.export": [
  "risks.read"
 ],
 "risks.external.read": [
  "risks.read"
 ],
 "checks.read": [
  "wells.read"
 ],
 "checks.run": [
  "checks.read",
  "telemetry.read"
 ],
 "checks.review": [
  "checks.read"
 ],
 "filechecks.read": [
  "wells.read"
 ],
 "filechecks.run": [
  "filechecks.read"
 ],
 "filechecks.cancel": [
  "filechecks.read"
 ],
 "filechecks.review": [
  "filechecks.read"
 ],
 "filechecks.legacy.run": [
  "wells.read"
 ],
 "alerts.read": [
  "risks.read"
 ],
 "alerts.review": [
  "alerts.read"
 ],
 "incidents.read": [
  "wells.read"
 ],
 "incidents.create": [
  "incidents.read"
 ],
 "incidents.delete": [
  "incidents.read"
 ],
 "references.read": [],
 "parameters.read": [],
 "references.create": [
  "references.read"
 ],
 "references.update": [
  "references.read"
 ],
 "references.delete": [
  "references.read"
 ],
 "runs.read": [],
 "runs.export": [
  "runs.read"
 ],
 "runs.start": [
  "runs.read",
  "risks.read"
 ],
 "cohort.runs.read": [
  "risks.read"
 ],
 "services.read": [],
 "metrics.read": [],
 "analytics.read": [],
 "audit.read": [],
 "presentation.scenario.read": [],
 "integrations.read": [],
 "integrations.create": [
  "integrations.read"
 ],
 "integrations.update": [
  "integrations.read"
 ],
 "integrations.check": [
  "integrations.read"
 ],
 "integrations.status": [
  "integrations.read"
 ],
 "integrations.logs.read": [
  "integrations.read"
 ],
 "integrations.collect": [
  "integrations.read",
  "telemetry.import"
 ],
 "integrations.ingest": [
  "integrations.read",
  "telemetry.import"
 ],
 "collectionjobs.read": [
  "integrations.read",
  "wells.read"
 ],
 "collectionjobs.run": [
  "collectionjobs.read",
  "integrations.collect"
 ],
 "collectionjobs.cancel": [
  "collectionjobs.read"
 ],
 "cohortjobs.read": [
  "cohort.runs.read"
 ],
 "cohortjobs.run": [
  "cohortjobs.read",
  "runs.start"
 ],
 "cohortjobs.cancel": [
  "cohortjobs.read"
 ],
 "users.read": [],
 "users.update": [
  "users.read"
 ],
 "users.scope.assign": [
  "users.update"
 ],
 "users.create": [
  "users.read",
  "users.scope.assign"
 ],
 "roles.read": [],
 "groups.read": [],
 "users.roles.assign": [
  "users.update",
  "roles.read"
 ],
 "users.groups.assign": [
  "users.update",
  "groups.read"
 ],
 "roles.manage": [
  "roles.read",
  "access.manage_global"
 ],
 "groups.manage": [
  "groups.read",
  "access.manage_global"
 ],
 "access.manage_global": []
} as const;
export type PermissionKey = keyof typeof prerequisites;
const legacyCompatibility: Record<string, readonly string[]> = {
 "admin": [
  "access.manage_global",
  "alerts.read",
  "alerts.review",
  "analytics.read",
  "audit.read",
  "checks.read",
  "checks.review",
  "checks.run",
  "cohort.runs.read",
  "cohortjobs.cancel",
  "cohortjobs.read",
  "cohortjobs.run",
  "collectionjobs.cancel",
  "collectionjobs.read",
  "collectionjobs.run",
  "filechecks.cancel",
  "filechecks.legacy.run",
  "filechecks.read",
  "filechecks.review",
  "filechecks.run",
  "groups.manage",
  "groups.read",
  "incidents.create",
  "incidents.delete",
  "incidents.read",
  "integrations.check",
  "integrations.collect",
  "integrations.create",
  "integrations.ingest",
  "integrations.logs.read",
  "integrations.read",
  "integrations.status",
  "integrations.update",
  "metrics.read",
  "parameters.read",
  "presentation.scenario.read",
  "references.create",
  "references.delete",
  "references.read",
  "references.update",
  "risks.explain",
  "risks.export",
  "risks.external.read",
  "risks.read",
  "roles.manage",
  "roles.read",
  "runs.export",
  "runs.read",
  "runs.start",
  "services.read",
  "telemetry.compat.read",
  "telemetry.compat.score",
  "telemetry.import",
  "telemetry.read",
  "users.create",
  "users.groups.assign",
  "users.read",
  "users.roles.assign",
  "users.scope.assign",
  "users.update",
  "wells.archive",
  "wells.create",
  "wells.delete",
  "wells.export",
  "wells.history.read",
  "wells.import",
  "wells.read",
  "wells.restore",
  "wells.update"
 ],
 "viewer": [
  "alerts.read",
  "checks.read",
  "cohort.runs.read",
  "incidents.read",
  "parameters.read",
  "references.read",
  "risks.explain",
  "risks.export",
  "risks.read",
  "telemetry.read",
  "wells.export",
  "wells.history.read",
  "wells.read"
 ],
 "technologist": [
  "alerts.read",
  "alerts.review",
  "checks.read",
  "checks.review",
  "checks.run",
  "cohort.runs.read",
  "filechecks.cancel",
  "filechecks.read",
  "filechecks.review",
  "filechecks.run",
  "incidents.create",
  "incidents.read",
  "parameters.read",
  "references.read",
  "risks.explain",
  "risks.export",
  "risks.read",
  "telemetry.read",
  "wells.export",
  "wells.history.read",
  "wells.read"
 ]
};

export function can(principal: Principal | null, ...keys: PermissionKey[]): boolean {
 if (!principal || !principal.authenticated) return false;
 const permissions = principal.access_model === 'rbac_v1' ? principal.permission_keys
  : principal.access_model === undefined || principal.access_model === 'legacy' ? legacyCompatibility[principal.role] : undefined;
 if (!Array.isArray(permissions) || permissions.some(key => !Object.hasOwn(prerequisites,key))) return false;
 const union = new Set<string>(permissions);
 const allows = (key: PermissionKey): boolean => union.has(key) && prerequisites[key].every(dep => allows(dep as PermissionKey));
 return keys.every(allows);
}
export function canAny(principal: Principal | null, ...alternatives: PermissionKey[][]): boolean {
 return alternatives.some(keys => keys.length > 0 && can(principal, ...keys));
}
export function queryAccess(principal: Principal | null, resource: PermissionKey): {enabled: boolean} {
 return {enabled: can(principal, resource)};
}
export function routeAccess(principal: Principal | null, path: string): boolean {
 if (path === '/') return canAny(principal, ['wells.read'], ['risks.read'], ['metrics.read']);
 if (path.startsWith('/accounts') || path.startsWith('/system/access')) return canAny(principal, ['users.read'], ['groups.read'], ['roles.read']);
 if (path.startsWith('/upload-check')) return canAny(principal, ['filechecks.read'], ['filechecks.run']) || canFull(principal,'filechecks.legacy.run');
 if (path.startsWith('/ml-risk')) return can(principal, 'risks.read');
 if (path.startsWith('/audit')) return canFull(principal, 'audit.read');
 if (path.startsWith('/analytics')) return can(principal, 'analytics.read');
 if (path.startsWith('/integrations')) return can(principal, 'integrations.read');
 if(path==='/structure')return canAny(principal,['wells.read'],['references.read']);
 return can(principal, 'wells.read');
}

/** Modern int64 fields must arrive as decimal strings, never reconstructed from legacy numbers. */
export function parseAccessFields<T extends AccessFields>(value: T): T {
 const decimal = (v: unknown) => {if (typeof v !== 'string' || !/^-?(0|[1-9]\d*)$/.test(v)) throw new Error('Invalid decimal access identifier');};
 for (const key of ['access_id','access_revision','authz_epoch','graph_revision'] as const) if (value[key] !== undefined) decimal(value[key]);
 for (const key of ['role_ids','group_ids'] as const) value[key]?.forEach(decimal);
 for (const role of [...(value.roles ?? []),...(value.direct_roles ?? [])]) {decimal(role.id);decimal(role.revision);}
 for (const group of value.groups ?? []) {decimal(group.id);decimal(group.revision);group.role_ids.forEach(decimal);}
 for (const sources of Object.values(value.permission_sources ?? {})) for (const source of sources) {decimal(source.role_id);decimal(source.role_revision);if(source.group_id !== null)decimal(source.group_id);}
 if(value.organization_scope) for(const key of ['ngdu_id','department_id'] as const) if(value.organization_scope[key] !== null)decimal(value.organization_scope[key]);
 return value;
}

/** Exact counterpart of backend FullApplicationScope; management permissions do not prove data scope. */
export function fullApplicationScope(principal: Principal | null): boolean {
 if (!principal?.authenticated || !can(principal)) return false;
 const scope = principal.scope;
 if (!scope?.funds?.includes('operational') || !scope.funds.includes('presentation')) return false;
 if (principal.organization_scope != null) return principal.organization_scope.kind === 'organization';
 return scope.ngdus === null && scope.departments === null;
}
export function canFull(principal: Principal | null, ...keys: PermissionKey[]): boolean {
 return fullApplicationScope(principal) && can(principal, ...keys);
}
/** Grant membership is raw, so valid permission fragments need not satisfy their own prerequisites. */
export function canGrantPermission(principal: Principal | null, key: string): boolean {
 if (!principal?.authenticated) return false;
 const keys = principal.access_model === 'rbac_v1'
  ? principal.permission_keys
  : principal.access_model === undefined || principal.access_model === 'legacy' ? legacyCompatibility[principal.role] : undefined;
 return Array.isArray(keys) && keys.includes(key);
}
