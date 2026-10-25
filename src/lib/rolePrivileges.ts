import type { PermissionDefinition } from '../api/access';

export interface PrivilegeRow { id: string; resource: string | null; keys: string[] }
export interface RolePrivileges { rows: PrivilegeRow[]; retained: string[]; retainedResources: string[]; nextId: number }
export interface IncompletePrivilege { rowId: string; field: 'resource' | 'actions'; message: string }
const resourceOf = (key: string) => key.split('.')[0];
const unique = (keys: string[]) => [...new Set(keys)];
const resources: Record<string, string> = {
    equipment_passports: 'Паспорта оборудования', access: 'Доступ', alerts: 'Тревоги', analytics: 'Аналитика', audit: 'Аудит', checks: 'Проверки',
    cohort: 'Прогоны фонда', cohortjobs: 'Задания проверки фонда', collectionjobs: 'Задания сбора',
    filechecks: 'Файловые проверки', groups: 'Группы пользователей', incidents: 'Инциденты',
    integrations: 'Интеграции', metrics: 'Метрики', parameters: 'Параметры', presentation: 'Сценарий презентационного фонда',
    references: 'Справочники', risks: 'Риски', roles: 'Роли', runs: 'Прогоны', services: 'Состояние сервисов',
    telemetry: 'Телеметрия', users: 'Пользователи', wells: 'Скважины',
};
const actions: Record<string, string> = {
    read: 'Просмотр', create: 'Создание', update: 'Изменение', delete: 'Удаление', export: 'Экспорт',
    import: 'Импорт', archive: 'Архивация', restore: 'Восстановление', 'history.read': 'История',
    run: 'Запуск', start: 'Запуск', cancel: 'Отмена', review: 'Решение', manage: 'Управление',
    manage_global: 'Глобальное управление доступом', explain: 'Объяснение', 'external.read': 'Внешние риски',
    'runs.read': 'Просмотр прогонов', 'scope.assign': 'Назначение подразделения', 'roles.assign': 'Назначение ролей',
    'groups.assign': 'Назначение групп', check: 'Проверка подключения', status: 'Изменение состояния',
    'logs.read': 'Просмотр журнала', collect: 'Сбор', ingest: 'Приём данных', 'legacy.run': 'Синхронная проверка',
    'compat.read': 'Совместимое чтение', 'compat.score': 'Совместимая проверка', 'scenario.read': 'Просмотр сценария',
};
export function resourceLabel(resource: string, _catalog: PermissionDefinition[]): string { return resources[resource] ?? resource; }
export function actionLabel(permission: PermissionDefinition): string {
    const action = permission.key.slice(permission.key.indexOf('.') + 1);
    return actions[action] ?? permission.name ?? action;
}
/** Mirrors current backend CanGrant: prerequisites belong to the actor, never auto-added to a role. */
export function grantDecision(key: string, catalog: PermissionDefinition[], actorKeys: string[]): { allowed: boolean; reason?: string } {
    const registry = new Map(catalog.map(p => [p.key, p]));
    const actor = new Set(actorKeys);
    function unavailable(value: string, visiting: Set<string>): string | undefined {
        const definition = registry.get(value);
        if (!definition) return `Нет определения разрешения ${value}`;
        if (!actor.has(value)) return `У вас нет разрешения ${value}`;
        if (visiting.has(value)) return `Не удалось проверить предпосылки ${value}`;
        const next = new Set(visiting).add(value);
        for (const prerequisite of definition.requires) {
            const reason = unavailable(prerequisite, next);
            if (reason) return reason;
        }
    }
    const reason = unavailable(key, new Set());
    return reason ? { allowed: false, reason } : { allowed: true };
}
export function createPrivileges(keys: string[], catalog: PermissionDefinition[], actorKeys: string[]): RolePrivileges {
    const model: RolePrivileges = { rows: [], retained: [], retainedResources: [], nextId: 1 };
    for (const key of unique(keys)) {
        const definition = catalog.find(p => p.key === key);
        if (!definition || !grantDecision(key, catalog, actorKeys).allowed) { model.retained.push(key); model.retainedResources = unique([...model.retainedResources, definition?.resource ?? resourceOf(key)]); continue; }
        let row = model.rows.find(r => r.resource === definition.resource);
        if (!row) { row = { id: `privilege-${model.nextId++}`, resource: definition.resource, keys: [] }; model.rows.push(row); }
        row.keys.push(key);
    }
    return model;
}
export function addPrivilege(model: RolePrivileges): RolePrivileges {
    return { ...model, nextId: model.nextId + 1, rows: [...model.rows, { id: `privilege-${model.nextId}`, resource: null, keys: [] }] };
}
export function removePrivilege(model: RolePrivileges, id: string): RolePrivileges {
    return { ...model, rows: model.rows.filter(row => row.id !== id) };
}
export function resourceOptions(model: RolePrivileges, catalog: PermissionDefinition[], id: string): string[] {
    const current = model.rows.find(row => row.id === id)?.resource;
    const used = new Set([...model.rows.filter(row => row.id !== id).flatMap(row => row.resource ? [row.resource] : []),
        ...model.retainedResources]);
    return unique(catalog.map(p => p.resource)).filter(resource => resource === current || !used.has(resource));
}
export function changeResource(model: RolePrivileges, id: string, resource: string | null): RolePrivileges {
    const row = model.rows.find(r => r.id === id);
    if (!row) throw new Error('Строка привилегий не найдена');
    if (resource !== row.resource && resource && (model.rows.some(r => r.id !== id && r.resource === resource) || model.retainedResources.includes(resource)))
        throw new Error('Ресурс уже выбран');
    return { ...model, rows: model.rows.map(r => r.id === id && r.resource !== resource ? { ...r, resource, keys: [] } : r) };
}
export function changeActions(model: RolePrivileges, id: string, keys: string[], catalog: PermissionDefinition[], actorKeys: string[]): RolePrivileges {
    const row = model.rows.find(r => r.id === id);
    if (!row) throw new Error('Строка привилегий не найдена');
    const selected = unique(keys);
    if (selected.some(key => catalog.find(p => p.key === key)?.resource !== row.resource || !grantDecision(key, catalog, actorKeys).allowed))
        throw new Error('Разрешение недоступно для этой строки');
    return { ...model, rows: model.rows.map(r => r.id === id ? { ...r, keys: selected } : r) };
}
export function privilegeKeys(model: RolePrivileges): string[] { return unique([...model.retained, ...model.rows.flatMap(row => row.keys)]); }
export function incompletePrivilege(model: RolePrivileges): IncompletePrivilege | null {
    for (const row of model.rows) {
        if (!row.resource) return { rowId: row.id, field: 'resource', message: 'Выберите ресурс или удалите строку.' };
        if (!row.keys.length) return { rowId: row.id, field: 'actions', message: 'Выберите хотя бы одно действие или удалите строку.' };
    }
    return null;
}

export class RoleFormError extends Error {
    readonly controlId: string;
    constructor(controlId: string, message: string) { super(message); this.name = 'RoleFormError'; this.controlId = controlId; }
}
export function validateRoleForm(role: { name: string; description: string }, model: RolePrivileges): void {
    if (!role.name.trim() || Array.from(role.name).length > 120)
        throw new RoleFormError('access-field-name', 'Введите название роли: от 1 до 120 символов.');
    if (Array.from(role.description).length > 2000)
        throw new RoleFormError('access-field-description', 'Описание роли: не более 2000 символов.');
    const incomplete = incompletePrivilege(model);
    if (incomplete) throw new RoleFormError(`${incomplete.rowId}-${incomplete.field}`, incomplete.message);
}
