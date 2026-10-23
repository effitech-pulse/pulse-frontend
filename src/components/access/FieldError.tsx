import { Typography } from 'antd';
import type { AccessField, AccessFieldError } from '@/lib/accessDraft';

export function fieldAttributes(field: AccessField, error?: AccessFieldError) {
    const invalid = error?.field === field;
    return {
        id: `access-field-${field}`,
        'aria-invalid': invalid ? true : undefined,
        'aria-describedby': invalid ? `access-error-${field}` : undefined,
    };
}

export function FieldError({ field, error }: { field: AccessField; error?: AccessFieldError }) {
    return error?.field === field
        ? <Typography.Text type="danger" id={`access-error-${field}`}>{error.message}</Typography.Text>
        : null;
}
