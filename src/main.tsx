import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { RouterProvider } from 'react-router-dom';
import 'antd/dist/reset.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import './index.css';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/auth/AuthProvider';
import {FundFiltersProvider} from '@/theme/FundFilters';
import { router } from '@/router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider><FundFiltersProvider><RouterProvider router={router} /></FundFiltersProvider></AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ThemeProvider>
  </StrictMode>,
);
