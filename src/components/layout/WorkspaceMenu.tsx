import { App, Button, Descriptions, Drawer, Space } from 'antd';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { roleLabels, type Principal } from '@/api/access';
import { toApiError } from '@/api/client';

/** The modern self projection is authoritative, including zero-permission roles/groups. */
export function profileAccessSummary(principal: Principal | null) {
  if (principal?.access_model === 'rbac_v1') return {
    label: 'Роли', roles: principal.roles?.map(role => role.name).join(', ') || 'Роли не назначены',
    groups: principal.groups?.map(group => group.name).join(', ') || 'Группы не назначены',
  };
  return {label:'Роль',roles:principal && (principal.access_model === undefined || principal.access_model === 'legacy') ? roleLabels[principal.role] : 'Сведения о ролях недоступны',groups:null};
}

/** Never reconstruct a modern int64 ID from a rounded legacy JSON number. */
export function ownProfileLocation(principal: Pick<Principal,'access_id'|'account_id'> | null): string | null {
  if(principal?.access_id !== undefined)return typeof principal.access_id === 'string' && /^[1-9]\d*$/.test(principal.access_id) && BigInt(principal.access_id) <= 9223372036854775807n ? `/people/${principal.access_id}` : null;
  const id=principal?.account_id;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? `/people/${id}` : null;
}

export function WorkspaceProfile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { principal, mode, canAny, logout } = useAuth();
  const { message } = App.useApp();
  const access=profileAccessSummary(principal);
  const ownProfile=ownProfileLocation(principal);
  return <Drawer title="Мой профиль" open={open} onClose={onClose}>
    <Descriptions column={1} layout="vertical" items={[
      { key: 'name', label: 'Имя', children: principal?.name },
      { key: 'role', label: access.label, children: <div><div>{access.roles}</div>{access.groups!==null&&<div>Группы: {access.groups}</div>}</div> },
      { key: 'mode', label: 'Доступ', children: mode === 'local' ? 'Личная учётная запись' : 'Общее рабочее пространство' },
      { key: 'ngdu', label: 'НГДУ', children: principal?.scope.ngdus?.join(', ') ?? 'Все разрешённые НГДУ' },
      { key: 'departments', label: 'Цеха', children: principal?.scope.departments?.join(', ') ?? 'Все разрешённые цеха' },
    ]} />
    <Space direction="vertical" size={20}>
      {mode === 'local' && principal?.mechanism === 'session' && ownProfile && <Link to={ownProfile} onClick={onClose}>Мой профиль сотрудника →</Link>}
      {canAny(['users.read'],['groups.read'],['roles.read']) && <Link to="/system/access" onClick={onClose}>Управление пользователями и доступом →</Link>}
      {mode === 'local' && <Button onClick={() => { void logout().then(onClose).catch(error => message.error(toApiError(error).message)); }}>Выйти из аккаунта</Button>}
    </Space>
  </Drawer>;
}
