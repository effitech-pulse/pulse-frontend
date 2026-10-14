import { Input } from 'antd';
import { useMemo } from 'react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

/** Textarea with inline JSON validation, used for DAG run conf. */
export function JsonEditor({ value, onChange, rows = 8 }: JsonEditorProps) {
  const error = useMemo(() => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [value]);

  return (
    <>
      <Input.TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        status={error ? 'error' : undefined}
        style={{ fontFamily: 'monospace' }}
        placeholder='{ "well_ids": [618], "processing_date": "2025-09-10" }'
      />
      {error && <div style={{ color: '#ff4d4f', marginTop: 4, fontSize: 12 }}>JSON: {error}</div>}
    </>
  );
}

export function isValidJson(value: string): boolean {
  if (!value.trim()) return true;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
