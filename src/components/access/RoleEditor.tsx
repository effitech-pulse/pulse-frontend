import { Alert, Button, Input, Select, Typography } from 'antd';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import type { PermissionDefinition, RoleChange } from '@/api/access';
import { actionLabel, addPrivilege, changeActions, changeResource, grantDecision, removePrivilege, resourceLabel, resourceOptions, type RoleFormError, type RolePrivileges } from '@/lib/rolePrivileges';

export function RoleEditor({ value, onChange, catalog, disabled, rows, onRowsChange, formError, footer }: {
    value: RoleChange;
    onChange: (patch: Partial<RoleChange>) => void;
    catalog: PermissionDefinition[];
    disabled: boolean;
    rows: RolePrivileges;
    onRowsChange: (next: RolePrivileges) => void;
    formError?: RoleFormError;
    footer?: ReactNode;
}) {
    const { principal } = useAuth();
    const actorKeys = principal?.permission_keys ?? [];
    const [announcement, setAnnouncement] = useState('');
    const exhausted = resourceOptions(rows, catalog, '').length === 0;
    const focus = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);
    function attributes(id: string) {
        return { id, 'aria-invalid': formError?.controlId === id ? true : undefined,
            'aria-describedby': formError?.controlId === id ? `${id}-error` : undefined };
    }
    function error(id: string) {
        return formError?.controlId === id ? <Typography.Text type="danger" id={`${id}-error`}>{formError.message}</Typography.Text> : null;
    }
    return <div className="access-form role-editor">
        <label className="role-metadata">Название роли<Input aria-label="Название роли" {...attributes('access-field-name')} value={value.name} disabled={disabled} onChange={event => onChange({ name: event.target.value })} />{error('access-field-name')}</label>
        <label className="role-metadata">Описание · необязательно<Input.TextArea aria-label="Описание роли" {...attributes('access-field-description')} rows={3} value={value.description} disabled={disabled} onChange={event => onChange({ description: event.target.value })} />{error('access-field-description')}</label>
        <h2>Привилегии</h2>
        <div className="role-privileges">
            {rows.rows.map((row, index) => {
                const resourceId = `${row.id}-resource`, actionsId = `${row.id}-actions`;
                const definitions = catalog.filter(permission => permission.resource === row.resource);
                const dependencies = [...new Set(definitions.filter(permission => row.keys.includes(permission.key)).flatMap(permission => permission.requires))];
                return <section className="role-privilege-row" key={row.id} data-row-id={row.id} aria-label={`Строка привилегий ${index + 1}`}>
                    <div className="role-privilege-controls">
                        <label>Ресурс<Select showSearch optionFilterProp="label" aria-label={`Ресурс строки ${index + 1}`} {...attributes(resourceId)} value={row.resource} placeholder="Выберите ресурс" disabled={disabled} options={resourceOptions(rows, catalog, row.id).map(resource => ({ value: resource, label: resourceLabel(resource, catalog) }))} onChange={resource => {
                            onRowsChange(changeResource(rows, row.id, resource));
                            setAnnouncement('Ресурс изменён. Привилегии этой строки сброшены.');
                        }} />{error(resourceId)}</label>
                        <label>Привилегии<Select mode="multiple" showSearch optionFilterProp="label" aria-label={`Привилегии строки ${index + 1}`} {...attributes(actionsId)} placeholder={row.resource ? 'Выберите привилегии' : 'Сначала выберите ресурс'} value={row.keys} disabled={disabled || !row.resource} tagRender={({ label }) => <span className="role-action-tag">{label}</span>} options={definitions.map(permission => {
                            const decision = grantDecision(permission.key, catalog, actorKeys);
                            return { value: permission.key, label: actionLabel(permission), disabled: !decision.allowed, title: decision.reason };
                        })} optionRender={option => <div className="role-action-option"><span>{option.label}</span>{option.data.title && <small>{option.data.title}</small>}</div>} onChange={keys => onRowsChange(changeActions(rows, row.id, keys, catalog, actorKeys))} />{error(actionsId)}</label>
                        <Button type="text" disabled={disabled} aria-label={`Удалить строку ${index + 1}`} onClick={() => {
                            const next = removePrivilege(rows, row.id);
                            onRowsChange(next);
                            setAnnouncement('Строка привилегий удалена.');
                            focus(next.rows[index]?.id ? `${next.rows[index].id}-resource` : next.rows.at(-1)?.id ? `${next.rows.at(-1)!.id}-resource` : 'role-add-privilege');
                        }}>Удалить строку</Button>
                    </div>
                    {dependencies.length > 0 && <p className="access-note">Требуются: {dependencies.join(', ')}. Предпосылки могут прийти из других ролей пользователя и не добавляются автоматически.</p>}
                    {row.keys.length > 0 && <p className="role-scope-note">{definitions.filter(permission => row.keys.includes(permission.key)).map(permission => `${actionLabel(permission)}: ${permission.scope_kind === 'global' ? 'вся система' : permission.scope_kind === 'data' || permission.scope_kind === 'organization' ? 'в пределах подразделения пользователя' : permission.scope_kind}`).join(' · ')}</p>}
                </section>;
            })}
        </div>
        {rows.retained.length > 0 && <Alert type="warning" message="Сохранённые разрешения недоступны для изменения" description={<><p>Ключи сохранены без изменений. Сервер может отклонить запись; разрешения не удаляются автоматически.</p>{rows.retained.map(key => <div key={key}><strong>{key}</strong> — {grantDecision(key, catalog, actorKeys).reason ?? 'Только чтение'}</div>)}</>} />}
        <Button type="link" id="role-add-privilege" className="role-add-privilege" disabled={disabled || exhausted} aria-describedby={exhausted ? "role-add-exhausted" : undefined} onClick={() => { const next = addPrivilege(rows); onRowsChange(next); setAnnouncement('Добавлена строка привилегий. Выберите ресурс.'); focus(`${next.rows.at(-1)!.id}-resource`); }}>+ Добавить привилегии</Button>
        {exhausted && <p id="role-add-exhausted" className="access-note">{catalog.length ? 'Все доступные ресурсы уже добавлены.' : 'В каталоге нет доступных ресурсов.'}</p>}
        <p>{rows.rows.length || rows.retained.length ? 'Ресурс можно добавить один раз. Для каждого ресурса выберите доступные действия.' : 'Можно сохранить роль без привилегий. Добавленная строка должна быть заполнена или удалена.'}</p>
        {footer}
        <p className="access-note">Перед сохранением покажем изменения. Подразделения пользователей не изменятся.</p>
        <span className="role-live-status" role="status">{announcement}</span>
    </div>;
}
