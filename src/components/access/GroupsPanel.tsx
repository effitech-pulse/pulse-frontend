import {Button,Card} from 'antd';
import type {AccessGroup} from '@/api/access';
import {useAuth} from '@/auth/AuthProvider';
import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
import {groupRoleOptions} from './tableFields';
export function GroupsPanel({open}:{open:(id:string|null,copy?:boolean)=>void}){
 const {can}=useAuth();return <><div className="access-toolbar">{can('groups.manage','access.manage_global')?<Button type="primary" onClick={()=>open(null)}>Создать группу</Button>:null}</div>
 <Card className="access-list-card"><ServerEntityTable<AccessGroup> tableKey="groups" rowKey="id" enabled={can('groups.read')} read={(q,s)=>getTablePage('/api/v1/auth/groups',q,s)} scroll={{x:800}}
 fields={[{key:'name',label:'Группа',kind:'text',read:r=>r.name},{key:'description',label:'Описание',kind:'text',read:r=>r.description},{key:'role_ids',label:'Роли',kind:'enum',loadOptions:groupRoleOptions,read:r=>r.role_ids.join(',')}]} columns={[{ title: 'Группа', dataIndex: 'name', width: '26%' }, { title: 'Описание', dataIndex: 'description', width: '23%' }, { title: 'Роли', render: (_, g) => g.role_ids.length ? g.role_ids.map(id => `ID ${id}`).join(', ') : 'Нет ролей' }, { title: 'Участники', render: () => '—' }, { title: 'Действие', key:'actions', render: (_, g) => <Button type="link" onClick={() => open(g.id)}>Настроить</Button> }]}/></Card></>;
}
