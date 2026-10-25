import type { ReactNode } from 'react';
/** Native disclosure keeps form descendants mounted and owns transient open state. */
export function UserEditorSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return <details open className="employee-panel user-editor-section">
        <summary className="user-editor-summary" aria-controls={`${id}-content`}>
            <h2>{title}</h2>
            <span className="user-editor-section-action"><span className="user-editor-when-open">Скрыть</span><span className="user-editor-when-closed">Отобразить</span></span>
        </summary>
        <div id={`${id}-content`} className="access-form user-editor-section-body">{children}</div>
    </details>;
}
