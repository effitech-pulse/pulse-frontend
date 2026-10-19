import { App, Button, Dropdown, Grid, Layout, Menu, Select, Space, Spin, Tooltip, Result } from 'antd';
import { Suspense, useEffect, useState } from 'react';
import { ApartmentOutlined, BarChartOutlined, DashboardOutlined, TeamOutlined, HistoryOutlined, FileSearchOutlined, AlertOutlined, ApiOutlined, BulbOutlined, MoonOutlined, UserOutlined, DownOutlined, BellOutlined, LogoutOutlined, SettingOutlined, MenuOutlined } from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useFund, type FundType } from '@/theme/FundProvider';
import { FundFilterBar } from './FundFilterBar';
import { WorkspaceEvents, WorkspaceProfile } from './WorkspaceMenu';
import { useAuth } from '@/auth/AuthProvider';
import { toApiError } from '@/api/client';
import { useTheme } from '@/theme/ThemeProvider';

const { Sider, Header, Content } = Layout;
const MONITORING = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Обзор фонда</Link>, title: 'Обзор фонда' },
  { key: '/structure', icon: <ApartmentOutlined />, label: <Link to="/structure">Скважины</Link>, title: 'Скважины' },
  { key: '/ml-risk', icon: <AlertOutlined />, label: <Link to="/ml-risk">Тревоги</Link>, title: 'Тревоги' },
];
const TOOLS = [
  { key: '/upload-check', icon: <FileSearchOutlined />, label: <Link to="/upload-check">Проверка файла</Link>, title: 'Проверка файла' },
  { key: '/audit', icon: <HistoryOutlined />, label: <Link to="/audit">Журнал</Link>, title: 'Журнал действий' },
  { key: '/integrations', icon: <ApiOutlined />, label: <Link to="/integrations">Интеграции</Link>, title: 'Источники данных' },
  { key: '/analytics', icon: <BarChartOutlined />, label: <Link to="/analytics">Аналитика</Link>, title: 'Аналитика' },
  { key: '/accounts', icon: <SettingOutlined />, label: <Link to="/accounts">Система</Link>, title: 'Пользователи и доступ' },
];
const ITEMS = [...MONITORING, ...TOOLS];
const RESTRICTED = ['/accounts', '/audit', '/integrations', '/analytics', '/upload-check'];

/** Existing sidebar, exposed through a native keyboard-operable header control. */
export function NavigationToggle({collapsed, onToggle}: {collapsed:boolean; onToggle:()=>void}) {
  return <Button className="app-icon-button app-nav-toggle"
    aria-label={collapsed ? 'Открыть навигацию' : 'Закрыть навигацию'}
    aria-expanded={!collapsed} aria-controls="pulse-main-navigation"
    onClick={onToggle} icon={<MenuOutlined />} />;
}

export function AppLayout() {
  const { principal, isAdmin, mode, logout } = useAuth();
  const { message } = App.useApp();
  const location = useLocation(), navigate = useNavigate();
  const { fund, setFund } = useFund();
  const screens = Grid.useBreakpoint();
  const { dark, toggle } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false), [eventsOpen, setEventsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const forbidden = !isAdmin && RESTRICTED.some(path => location.pathname.startsWith(path));
  useEffect(() => {
    if (new URLSearchParams(location.search).has('blur')) document.body.dataset.blur = '1';
    else delete document.body.dataset.blur;
  }, [location.search]);
  const selectedKey = location.pathname.startsWith('/wells') || location.pathname.startsWith('/telemetry/') ? '/structure'
    : ITEMS.map(i => i.key).filter(k => k !== '/' && location.pathname.startsWith(k)).sort((a,b) => b.length-a.length)[0] ?? '/';
  const title = location.pathname.startsWith('/telemetry/') ? 'Телеметрия' : location.pathname.startsWith('/wells/') ? 'Карточка скважины' : ITEMS.find(i => i.key === selectedKey)?.title;
  const name = mode === 'local' ? principal?.name : 'Рабочее пространство';
  const group = MONITORING.some(i => i.key === selectedKey) ? 'Мониторинг' : 'Система';
  return <Layout className="pulse-app">
    <Sider width={224} breakpoint="lg" collapsedWidth={0} collapsed={collapsed} onCollapse={setCollapsed} trigger={null} className="app-sidebar">
      <div className="app-sidebar-inner" aria-hidden={collapsed} ref={element=>{if(element)element.toggleAttribute('inert',collapsed);}}>
        <Link to="/" className="app-brand" aria-label="Пульс скважины — обзор фонда"><img className="app-brand-mark" src="/figma/pulse-symbol.svg" alt="" aria-hidden="true" /><span><strong>Пульс скважины</strong><small>Мониторинг УЭЦН</small></span></Link>
        <nav id="pulse-main-navigation" aria-label="Основная навигация"><div className="app-nav-label">Мониторинг</div><Menu mode="inline" selectedKeys={[selectedKey]} items={MONITORING} /><div className="app-nav-label app-nav-label-tools">Инструменты</div><Menu mode="inline" selectedKeys={[selectedKey]} items={TOOLS.filter(i => isAdmin || !RESTRICTED.includes(i.key))} /></nav>
        <div className="app-sidebar-bottom"><button className="app-profile-card" onClick={() => setProfileOpen(true)}><UserOutlined /><span><strong>{name}</strong><small>Мой профиль</small></span></button><div className="app-company"><span>Разработано</span><span>ООО «ЭффиТех»</span></div></div>
      </div>
    </Sider>
    <Layout className="app-main">
      <Header className="app-header"><div className="app-header-context"><NavigationToggle collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)} /><div className="app-breadcrumb">{group} / {title}</div></div><Space size={12}>
        <Select aria-label="Выбор фонда" className="app-fund-select" value={fund} variant="borderless" style={{width:screens.md ? 185 : 145}} options={[{value:'operational',label:'Рабочий фонд'},{value:'presentation',label:'Показательный фонд'}].filter(o=>principal?.scope.funds.includes(o.value as FundType))} onChange={(value:FundType)=>{setFund(value);if(location.pathname.startsWith('/wells/'))navigate('/');}} />
        <Tooltip title={dark?'Светлая тема':'Тёмная тема'}><Button className="app-icon-button" aria-label="Переключить тему" onClick={toggle} icon={dark?<BulbOutlined />:<MoonOutlined />} /></Tooltip>
        <Tooltip title="Новые тревоги и ошибки сбора"><Button className="app-icon-button" type="text" aria-label="Требуют внимания" icon={<BellOutlined />} onClick={()=>setEventsOpen(true)} /></Tooltip>
        <Dropdown trigger={['click']} menu={{items:[{key:'profile',icon:<UserOutlined />,label:'Мой профиль'},...(isAdmin?[{key:'accounts',icon:<TeamOutlined />,label:'Пользователи и доступ'}]:[]),...(mode==='local'?[{key:'logout',icon:<LogoutOutlined />,label:'Выйти'}]:[])],onClick:({key})=>{if(key==='profile')setProfileOpen(true);if(key==='accounts')navigate('/accounts');if(key==='logout')void logout().catch(e=>message.error(toApiError(e).message));}}}><Button className="app-account" aria-label="Меню пользователя"><UserOutlined /><span>{name}</span><DownOutlined /></Button></Dropdown>
      </Space></Header>
      <Content className={`app-content${location.pathname.startsWith('/analytics')?' app-content-full':''}`}>
        {['/structure','/ml-risk'].includes(location.pathname)&&<div className="pulse-page-heading"><h1>{title}</h1><p>{selectedKey==='/structure'?'Найдите объект по номеру, подразделению или идентификатору':'Оценки модели и очередь проверки технологом'}</p></div>}
        {['/structure','/ml-risk'].includes(location.pathname)&&<FundFilterBar />}
        <Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}>{forbidden?<Result status="403" title="Раздел доступен администратору" />:<Outlet />}</Suspense>
      </Content>
    </Layout>
    <WorkspaceProfile open={profileOpen} onClose={()=>setProfileOpen(false)} /><WorkspaceEvents open={eventsOpen} onClose={()=>setEventsOpen(false)} />
  </Layout>;
}
