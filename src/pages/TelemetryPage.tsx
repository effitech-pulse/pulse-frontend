import { Navigate, useParams } from 'react-router-dom';
export function TelemetryPage() {
  const { wellId } = useParams();
  return <Navigate to={wellId && /^[1-9][0-9]*$/.test(wellId) ? `/wells/${wellId}?tab=telemetry` : '/structure'} replace />;
}
