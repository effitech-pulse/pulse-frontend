import { Alert, App, Button, Card, Checkbox, Drawer, Form, Input, Radio, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { accessApi, roleLabels, type Account, type AccountInput } from '@/api/access';
import { useAuth } from '@/auth/AuthProvider';
import { toApiError } from '@/api/client';
import { useDepartments, useNgdus } from '@/hooks/useWells';
type Draft = AccountInput & {ngduMode:'all'|'selected';departmentMode:'all'|'selected'};
export function AccountsPage(){
 const {mode,principal}=useAuth();const {message}=App.useApp();const client=useQueryClient();
 const users=useQuery({queryKey:['accounts'],queryFn:accessApi.users,enabled:mode==='local'});
 const ngdus=useNgdus(),departments=useDepartments();
 const [editing,setEditing]=useState<Account|null>();const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [form]=Form.useForm<Draft>();
 const role=Form.useWatch('role',form),ngduMode=Form.useWatch('ngduMode',form),departmentMode=Form.useWatch('departmentMode',form);
 function open(account:Account|null){setEditing(account);setError('');form.resetFields();form.setFieldsValue(account?{...account,scope:{...account.scope,ngdus:account.scope.ngdus??[],departments:account.scope.departments??[]},password:undefined,ngduMode:account.scope.ngdus===null?'all':'selected',departmentMode:account.scope.departments===null?'all':'selected'}:{login:'',name:'',role:'viewer',active:true,revision:0,scope:{funds:['operational'],ngdus:[],departments:[]},ngduMode:'all',departmentMode:'all'});}
 async function save(v:Draft){setSaving(true);setError('');try{const input:AccountInput={login:v.login,name:v.name,role:v.role,active:v.active,revision:v.revision,scope:{funds:v.scope.funds,ngdus:v.ngduMode==='all'?null:(v.scope.ngdus??[]),departments:v.departmentMode==='all'?null:(v.scope.departments??[])},...(v.password?{password:v.password}:{})};if(editing)await accessApi.update(editing.id,input);else await accessApi.create(input);setEditing(undefined);form.resetFields();await client.invalidateQueries({queryKey:['accounts']});message.success('Учётная запись сохранена. Прежние сеансы пользователя отозваны.');}catch(e){setError(toApiError(e).message);}finally{setSaving(false);}}
 return <div className="pulse-stack">
 {mode==='legacy'?<Alert type="info" showIcon message="Персональный вход ещё не включён" description="Для перехода создайте первого администратора серверной командой adminuser, затем включите AUTH_MODE=local. После этого здесь появится управление пользователями, ролями и областью доступа." />:<Alert type="info" message="Доступ к скважинам" description="Технолог выполняет проверки и оформляет заключения. Наблюдатель просматривает данные. Администратор управляет системой и всем фондом. Изменение учётной записи завершает её действующие сеансы." />}
 <Card title="Пользователи" extra={<Button type="primary" disabled={mode!=='local'} onClick={()=>open(null)}>Добавить пользователя</Button>}>
 {users.isError&&<Alert type="error" message={toApiError(users.error).message} />}
 <Table<Account> rowKey="id" loading={users.isLoading} dataSource={users.data??[]} columns={[
 {title:'Пользователь',render:(_,u)=><div><b>{u.name}</b><div>{u.login}{u.id===principal?.account_id?' · вы':''}</div></div>},
 {title:'Роль',dataIndex:'role',render:(r:Account['role'])=>roleLabels[r]},
 {title:'Область доступа',render:(_,u)=>u.role==='admin'?'Весь фонд':<><div>{u.scope.funds.map(f=>f==='operational'?'Рабочий фонд':'Показательный фонд').join(', ')}</div><Typography.Text type="secondary">НГДУ: {u.scope.ngdus===null?'все':u.scope.ngdus.join(', ')||'нет доступа'} · Цеха: {u.scope.departments===null?'все':u.scope.departments.join(', ')||'нет доступа'}</Typography.Text></>},
 {title:'Статус',dataIndex:'active',render:(a:boolean)=><Tag color={a?'green':undefined}>{a?'Активен':'Отключён'}</Tag>},
 {title:'',render:(_,u)=><Button onClick={()=>open(u)}>Настроить</Button>},
 ]} />
 </Card>
 <Typography.Text type="secondary">Роли Pulse хранятся отдельно от способа входа. Подготовлена связь с внешней учётной записью для последующего подключения Keycloak и других провайдеров OIDC. Само подключение SSO ещё не настроено.</Typography.Text>
 <Drawer title={editing?'Настройка пользователя':'Новый пользователь'} width={520} open={editing!==undefined} onClose={()=>{if(!saving){setEditing(undefined);form.resetFields();}}} destroyOnClose>
 <Form form={form} layout="vertical" onFinish={save}>
 {error&&<Alert type="error" message={error} style={{marginBottom:16}} />}
 <Form.Item name="revision" hidden><Input /></Form.Item>
 <Form.Item name="login" label="Логин" rules={[{required:true},{pattern:/^[a-zA-Z0-9][a-zA-Z0-9._@-]{2,79}$/,message:'3–80 латинских букв, цифр, точка, дефис, @ или _'}]}><Input autoComplete="off" /></Form.Item>
 <Form.Item name="name" label="Имя" rules={[{required:true}]}><Input maxLength={120} /></Form.Item>
 <Form.Item name="role" label="Роль" rules={[{required:true}]}><Select options={Object.entries(roleLabels).map(([value,label])=>({value,label}))} /></Form.Item>
 <Form.Item name="active" label="Учётная запись активна" valuePropName="checked"><Switch /></Form.Item>
 {role!=='admin'&&<>
 <Form.Item name={['scope','funds']} label="Доступные фонды" rules={[{required:true,type:'array',min:1,message:'Выберите хотя бы один фонд'}]}><Checkbox.Group options={[{value:'operational',label:'Рабочий фонд'},{value:'presentation',label:'Показательный фонд'}]} /></Form.Item>
 <Form.Item name="ngduMode" label="НГДУ"><Radio.Group options={[{value:'all',label:'Все'},{value:'selected',label:'Выбранные'}]} /></Form.Item>
 {ngduMode==='selected'&&<Form.Item name={['scope','ngdus']}><Select mode="multiple" allowClear placeholder="Пустой список запрещает доступ" options={ngdus.data?.map(r=>({value:r.id,label:`${r.name} (${r.id})`}))} /></Form.Item>}
 <Form.Item name="departmentMode" label="Цеха"><Radio.Group options={[{value:'all',label:'Все'},{value:'selected',label:'Выбранные'}]} /></Form.Item>
 {departmentMode==='selected'&&<Form.Item name={['scope','departments']}><Select mode="multiple" allowClear placeholder="Пустой список запрещает доступ" options={departments.data?.map(r=>({value:r.id,label:`${r.name} (${r.id})`}))} /></Form.Item>}
 </>}
 <Form.Item name="password" label={editing?'Новый пароль (оставьте пустым, чтобы сохранить)':'Пароль'} rules={[{required:!editing,message:'Введите пароль'},{validator:(_,value)=>!value||(Array.from(value).length>=15&&new TextEncoder().encode(value).length<=72)?Promise.resolve():Promise.reject(new Error('Минимум 15 символов, максимум 72 байта UTF-8'))}]}><Input.Password autoComplete="new-password" /></Form.Item>
 <Space><Button type="primary" htmlType="submit" loading={saving}>Сохранить</Button><Button disabled={saving} onClick={()=>open(editing??null)}>Сбросить форму</Button></Space>
 </Form>
 </Drawer>
 </div>;
}
