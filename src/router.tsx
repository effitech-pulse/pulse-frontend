import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

// Lazy pages → каждый экран в своём чанке (antd/charts грузятся по требованию).
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
// Список скважин теперь — вкладка внутри «Структуры добычи» (StructurePage).
const WellDetailPage = lazy(() =>
  import('@/pages/WellDetailPage').then((m) => ({ default: m.WellDetailPage })),
);
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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'wells', element: <Navigate to="/structure" replace /> },
      { path: 'wells/:wellId', element: <WellDetailPage /> },
      { path: 'structure', element: <StructurePage /> },
      { path: 'ml-risk', element: <MlRiskPage /> },
      { path: 'upload-check', element: <UploadCheckPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
