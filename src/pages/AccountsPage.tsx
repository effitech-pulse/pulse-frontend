import { Alert, App, Button, Card, Drawer, Form, Input, Radio, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { accessApi, roleLabels, type Account } from '@/api/access';
import { useAuth } from '@/auth/AuthProvider';
import { toApiError } from '@/api/client';
import { useDepartments, useNgdus } from '@/hooks/useWells';
import { accountInputFromDraft, type AccountDraft as Draft } from '@/lib/accountInput';
import '@/styles/portal-system.css';
export function AccountsPage(){
 const {mode,principal}=useAuth();const {message}=App.useApp();const client=useQueryClient();
 const users=useQuery({queryKey:['accounts'],queryFn:accessApi.users,enabled:mode==='local'});
 const ngdus=useNgdus(),departments=useDepartments();
 const [editing,setEditing]=useState<Account|null>();const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [form]=Form.useForm<Draft>();
 const [statusFilter,setStatusFilter]=useState<'active'|'disabled'|'all'>('active');
 const visibleUsers=(users.data??[]).filter(u=>statusFilter==='all'||u.active===(statusFilter==='active'));
 const role=Form.useWatch('role',form),ngduMode=Form.useWatch('ngduMode',form),departmentMode=Form.useWatch('departmentMode',form);
 function open(account:Account|null){setEditing(account);setError('');form.resetFields();form.setFieldsValue(account?{...account,scope:{...account.scope,ngdus:account.scope.ngdus??[],departments:account.scope.departments??[]},password:undefined,ngduMode:account.scope.ngdus===null?'all':'selected',departmentMode:account.scope.departments===null?'all':'selected'}:{login:'',name:'',role:'viewer',active:true,revision:0,scope:{funds:['presentation'],ngdus:[],departments:[]},ngduMode:'all',departmentMode:'all'});}
 async function save(v:Draft){setSaving(true);setError('');try{const input=accountInputFromDraft(v,editing);if(editing)await accessApi.update(editing.id,input);else await accessApi.create(input);setEditing(undefined);form.resetFields();await client.invalidateQueries({queryKey:['accounts']});message.success('Учётная запись сохранена. Прежние сеансы пользователя отозваны.');}catch(e){setError(toApiError(e).message);}finally{setSaving(false);}}
 return <div className="pulse-stack pulse-system-page pulse-system-accounts">
 <div className="pulse-page-heading"><h1>Система</h1><p>Пользователи, роли и область доступа.</p></div>
 <div className="pulse-system-section-tabs"><Button type="primary" aria-current="page">Пользователи</Button></div>
 <div className="pulse-toolbar"><h2>Учётные записи</h2><Space wrap><Select aria-label="Статус пользователей" value={statusFilter} onChange={setStatusFilter} options={[{value:'active',label:'Активные'},{value:'disabled',label:'Отключённые'},{value:'all',label:'Все пользователи'}]} /><Button type="primary" disabled={mode!=='local'} onClick={()=>open(null)}>Добавить пользователя</Button></Space></div>
 {mode==='legacy'?<Alert type="info" showIcon message="Персональный вход ещё не включён" description="Для перехода создайте первого администратора серверной командой adminuser, затем включите AUTH_MODE=local. После этого здесь появится управление пользователями, ролями и областью доступа." />:null}
 <Card className="pulse-system-table-card" title="Пользователи">
 {users.isError&&<Alert type="error" message={toApiError(users.error).message} />}
 <Table<Account> rowKey="id" loading={users.isLoading} dataSource={visibleUsers} scroll={{x:900}} locale={{emptyText:users.isError?'Пользователи не загружены':statusFilter==='disabled'?'Нет отключённых пользователей':'Нет пользователей в выбранной группе'}} columns={[
 {title:'Пользователь',width:280,render:(_,u)=><div><button className="pulse-system-source-link" onClick={()=>open(u)}>{u.name}</button><span className="pulse-cell-meta">{u.login}{u.id===principal?.account_id?' · вы':''}</span></div>},
 {title:'Роль',dataIndex:'role',render:(r:Account['role'])=>roleLabels[r]},
 {title:'Область доступа',render:(_,u)=>u.role==='admin'?'Весь фонд':<><div>{u.scope.funds.includes('presentation')?'Pulse Connector':'Нет доступа к текущим скважинам'}</div><Typography.Text type="secondary">НГДУ: {u.scope.ngdus===null?'все':u.scope.ngdus.join(', ')||'нет доступа'} · Цеха: {u.scope.departments===null?'все':u.scope.departments.join(', ')||'нет доступа'}</Typography.Text></>},
 {title:'Статус',dataIndex:'active',render:(a:boolean)=><Tag color={a?'green':undefined}>{a?'Активен':'Отключён'}</Tag>},
 {title:'Действия',render:(_,u)=><Button type="text" onClick={()=>open(u)}>Настроить →</Button>},
 ]} />
 </Card>
 <div className="pulse-system-callout"><strong>Доступ к скважинам</strong><p>Технолог выполняет проверки и оформляет заключения. Наблюдатель просматривает данные. Администратор управляет системой и всем фондом. Изменение учётной записи завершает её действующие сеансы.</p></div>
 <Typography.Text className="pulse-system-footnote" type="secondary">Роли Pulse хранятся отдельно от способа входа. Подготовлена связь с внешней учётной записью для последующего подключения Keycloak и других провайдеров OIDC. Само подключение SSO ещё не настроено.</Typography.Text>
 <Drawer className="pulse-system-overlay" title={editing?'Настройка пользователя':'Новый пользователь'} width="min(520px, 100vw)" open={editing!==undefined} onClose={()=>{if(!saving){setEditing(undefined);form.resetFields();}}} destroyOnClose>
 <Form form={form} layout="vertical" onFinish={save}>
 {error&&<Alert type="error" message={error} style={{marginBottom:16}} />}
 <Form.Item name="revision" hidden><Input /></Form.Item>
 <Form.Item name="login" label="Логин" rules={[{required:true},{pattern:/^[a-zA-Z0-9][a-zA-Z0-9._@-]{2,79}$/,message:'3–80 латинских букв, цифр, точка, дефис, @ или _'}]}><Input autoComplete="username" spellCheck={false} /></Form.Item>
 <Form.Item name="name" label="Имя и фамилия" rules={[{required:true}]}><Input autoComplete="name" maxLength={120} /></Form.Item>
 <Form.Item name="role" label="Роль" rules={[{required:true}]}><Select options={Object.entries(roleLabels).map(([value,label])=>({value,label}))} /></Form.Item>
 <Form.Item name="active" label="Учётная запись активна" valuePropName="checked"><Switch /></Form.Item>
 {role!=='admin'&&<>
 <Typography.Paragraph type="secondary">Pulse Connector · доступ ограничивается разрешёнными скважинами, НГДУ и цехами.</Typography.Paragraph>
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
