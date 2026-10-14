import { Tag } from 'antd';

// Maps pipeline states to antd Tag colors.
const COLOR_MAP: Record<string, string> = {
  success: 'green',
  failed: 'red',
  running: 'blue',
  queued: 'orange',
  scheduled: 'orange',
  up_for_retry: 'gold',
  upstream_failed: 'volcano',
  skipped: 'default',
  removed: 'default',
  // pipeline status_type / severity
  ok: 'green',
  no_data: 'default',
  invalid: 'gold',
  error: 'red',
  failure_detected: 'red',
  warning: 'orange',
  info: 'blue',
};

export function StatusTag({ status }: { status: string | null | undefined }) {
  if (!status) return <Tag>—</Tag>;
  return <Tag color={COLOR_MAP[status.toLowerCase()] ?? 'default'}>{status}</Tag>;
}
