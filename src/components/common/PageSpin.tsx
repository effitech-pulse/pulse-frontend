import { Alert, Spin } from 'antd';
import type { ReactNode } from 'react';
import { toApiError } from '@/api/client';

interface PageSpinProps {
  loading: boolean;
  error?: unknown;
  children: ReactNode;
}

/** Wraps content with a loading spinner and a structured error alert. */
export function PageSpin({ loading, error, children }: PageSpinProps) {
  if (error) {
    const apiErr = toApiError(error);
    return <Alert type="error" showIcon message={apiErr.code} description={<>
      <div>{apiErr.message}</div>
      {apiErr.http_request_id && <div className="pulse-error-reference">Код обращения: {apiErr.http_request_id}</div>}
    </>} />;
  }
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }
  return <>{children}</>;
}
