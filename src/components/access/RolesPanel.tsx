import {Button,Card} from 'antd';
import {managementApi,type AccessRole} from '@/api/access';
import {useAuth} from '@/auth/AuthProvider';
import {ServerEntityTable} from '@/components/common/ServerEntityTable';
import {getTablePage} from '@/api/table';
export function RolesPanel({open}:{open:(id:string|null,copy?:boolean)=>void}){
 const {can}=useAuth();return <><div className="access-toolbar">{can('roles.manage','access.manage_global')?<Button type="primary" onClick={()=>open(null)}>Создать роль</Button>:null}</div>
 <Card className="access-list-card"><ServerEntityTable<AccessRole> tableKey="roles" rowKey="id" enabled={can('roles.read')} read={(q,s)=>getTablePage('/api/v1/auth/roles',q,s)} scroll={{x:800}}
 fields={[{key:'name',label:'Роль',kind:'text',read:r=>r.name},{key:'description',label:'Описание',kind:'text',read:r=>r.description},{key:'permission_keys',label:'Разрешения',kind:'enum',loadOptions:async(search)=>({items:(await managementApi.permissions()).filter(p=>p.name.includes(search)||p.key.includes(search)).map(p=>({value:p.key,label:p.name})),next_cursor:null}),read:r=>r.permission_keys.join(',')},{key:'permission_count',label:'Количество разрешений',column:'Разрешения',primary:true,kind:'number',read:r=>r.permission_keys.length}]} columns={[{ title: 'Роль', dataIndex: 'name', width: '26%' }, { title: 'Описание', dataIndex: 'description', width: '23%' }, { title: 'Разрешения', render: (_, r) => r.permission_keys.length ? `Настраиваемый набор (${r.permission_keys.length})` : 'Нет разрешений' }, { title: 'Область', render: () => 'Действия' }, { title: 'Действие', key:'actions', render: (_, r) => <><Button type="link" onClick={() => open(r.id)}>Настроить</Button>{can('roles.manage') && <Button type="link" onClick={() => open(r.id, true)}>Копировать</Button>}</> }]}/></Card></>;
}
