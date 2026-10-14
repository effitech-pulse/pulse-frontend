import { Grid, Layout, Menu, Spin } from 'antd';
import { Suspense, useEffect } from 'react';
import {
  ApartmentOutlined, BarChartOutlined, DashboardOutlined,
  HistoryOutlined, FileSearchOutlined, AlertOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { designTokens as t } from '@/theme/designTokens';

const { Sider, Header, Content } = Layout;
const MENU_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Обзор фонда</Link>, title: 'Обзор фонда' },
  { key: '/structure', icon: <ApartmentOutlined />, label: <Link to="/structure">Скважины</Link>, title: 'Скважины' },
  { key: '/ml-risk', icon: <AlertOutlined />, label: <Link to="/ml-risk">Риск отказа</Link>, title: 'Риск отказа' },
  { key: '/upload-check', icon: <FileSearchOutlined />, label: <Link to="/upload-check">Проверка файла</Link>, title: 'Проверка телеметрии' },
  { key: '/audit', icon: <HistoryOutlined />, label: <Link to="/audit">Журнал действий</Link>, title: 'Журнал действий' },
  { key: '/analytics', icon: <BarChartOutlined />, label: <Link to="/analytics">Аналитика</Link>, title: 'Аналитика' },
];
const PAGE_TITLE = Object.fromEntries(MENU_ITEMS.map((i) => [i.key, i.title]));

export function AppLayout() {
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  useEffect(() => {
    if (new URLSearchParams(location.search).has('blur')) {
      document.body.dataset.blur = '1';
    } else {
      delete document.body.dataset.blur;
    }
  }, [location.search]);
  const selectedKey = location.pathname.startsWith('/wells')
    ? '/structure'
    : MENU_ITEMS.map((i) => i.key)
        .filter((key) => key !== '/' && location.pathname.startsWith(key))
        .sort((a, b) => b.length - a.length)[0] ?? '/';
  const title = location.pathname.startsWith('/wells/')
    ? 'Карточка скважины' : PAGE_TITLE[selectedKey];
  const fullBleed = location.pathname.startsWith('/analytics');
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={224} breakpoint="lg" collapsedWidth="0" style={{ borderRight: `1px solid ${t.border}` }}>
        <Link to="/" className="app-brand" aria-label="Пульс скважины — обзор фонда">
          <span className="app-brand-mark" aria-hidden="true">ПС</span>
          <span>
            <strong>Пульс скважины</strong>
            <small>Мониторинг УЭЦН</small>
          </span>
        </Link>
        <Menu theme="light" mode="inline" selectedKeys={[selectedKey]} items={MENU_ITEMS} style={{ borderInlineEnd: 0 }} />
      </Sider>
      <Layout>
        <Header className="app-header">
          <h1>{title}</h1>
          {screens.md && <span className="app-company">ЭффиТех</span>}
        </Header>
        <Content style={{ margin: fullBleed ? 0 : screens.md ? 24 : 12 }}>
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}
