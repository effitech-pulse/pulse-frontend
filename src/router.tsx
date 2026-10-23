import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

// Lazy pages → каждый экран в своём чанке (antd/charts грузятся по требованию).
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
// Список скважин теперь — вкладка внутри «Структуры добычи» (StructurePage).
const WellEventRoute = lazy(() => import('@/pages/WellEventRoute').then(m => ({default:m.WellEventRoute})));
const EventsPage = lazy(() => import('@/pages/EventsPage').then(m => ({default:m.EventsPage})));
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage').then(m => ({default:m.EventDetailPage})));
const MlRiskPage = lazy(() =>
  import('@/pages/MlRiskPage').then((m) => ({ default: m.MlRiskPage })),
);
const UploadCheckPage = lazy(() =>
  import('@/pages/UploadCheckPage').then((m) => ({ default: m.UploadCheckPage })),
);
const StructurePage = lazy(() =>
  import('@/pages/StructurePage').then((m) => ({ default: m.StructurePage })),
);
const AuditPage = lazy(() => import('@/pages/AuditPage').then((m) => ({ default: m.AuditPage })));
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const TelemetryPage = lazy(() => import('@/pages/TelemetryPage').then(m => ({ default: m.TelemetryPage })));

const AccountsPage=lazy(()=>import('@/pages/AccountsPage').then(m=>({default:m.AccountsPage})));
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'wells', element: <Navigate to="/structure" replace /> },
      { path: 'wells/:wellId', element: <WellEventRoute /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'events/:eventId', element: <EventDetailPage /> },
      { path: 'structure', element: <StructurePage /> },
      { path: 'ml-risk', element: <MlRiskPage /> },
      { path: 'upload-check', element: <UploadCheckPage /> },
      { path:'accounts',element:<AccountsPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'integrations', element: <IntegrationsPage /> },
      { path: 'telemetry/:wellId', element: <TelemetryPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
