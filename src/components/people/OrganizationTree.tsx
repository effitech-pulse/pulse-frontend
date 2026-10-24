import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import type { OrganizationTree as Snapshot } from '@/api/people';
import { flattenOrganizationTree, organizationTreeKey, type OrganizationTreeRow } from '@/lib/organizationTree';
import { anchorChartScroll, centerChartCard, chartWindow, initialChartExpansion, layoutOrganizationChart, revealChartCard, zoomChartCamera, type ChartCard, type ChartPoint } from '@/lib/organizationChart';

function countLabel(count: number) {
    const n = count % 100, last = count % 10;
    return `${count} ${n >= 11 && n <= 14 ? 'сотрудников' : last === 1 ? 'сотрудник' : last >= 2 && last <= 4 ? 'сотрудника' : 'сотрудников'}`;
}
function MeasuredCard({ card, zoom, measure, children }: { card: ChartCard; zoom: number; measure: (key: string, height: number) => void; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const update = () => measure(card.key, element.getBoundingClientRect().height / zoom);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [card.key, zoom, measure]);
    return <div ref={ref} className="organization-chart-position" style={{ left: card.x, top: card.y, width: card.width }}>{children}</div>;
}
interface FocusIntent { key: string; mode: 'initial' | 'reveal' | 'center'; focus: boolean }
/** Complete logical forest, bounded HTML cards and clipped decorative SVG in one world space. */
export function OrganizationTree({ data }: { data: Snapshot }) {
    const container = useRef<HTMLDivElement>(null), controls = useRef(new Map<string, HTMLElement>());
    const [snapshot, setSnapshot] = useState(data);
    const [expanded, setExpanded] = useState<Set<string>>(() => initialChartExpansion(data));
    const [active, setActive] = useState<string | null>(data.organizations[0]?.key ?? null);
    const [heights, setHeights] = useState<Map<string, number>>(() => new Map());
    const [camera, setCamera] = useState<ChartPoint>({ x: 0, y: 0 });
    const [viewport, setViewport] = useState({ width: 1112, height: 640 });
    const [zoom, setZoom] = useState(1);
    const [intent, setIntent] = useState<FocusIntent | null>(() => data.organizations[0] ? { key: data.organizations[0].key, mode: 'initial', focus: false } : null);
    const anchor = useRef<{ key: string; x: number; y: number } | null>(null);
    const measurements = useRef(new Map<string, number>()), measurementFrame = useRef<number | null>(null);
    const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; started: boolean } | null>(null);
    if (snapshot !== data) {
        const allKeys = new Set(data.organizations.flatMap(org => [org.key, ...org.divisions.flatMap(div => [div.key, ...div.departments.map(dept => dept.key)])]));
        const full = flattenOrganizationTree(data, allKeys), surviving = full.find(row => row.key === active);
        const next = surviving?.key ?? data.organizations[0]?.key ?? null;
        const nextExpanded = initialChartExpansion(data);
        let row = surviving;
        const parents = new Map(full.map(item => [item.key, item]));
        while (row?.parent) { nextExpanded.add(row.parent); row = parents.get(row.parent); }
        const restore = typeof document !== 'undefined' && !!container.current?.contains(document.activeElement);
        setSnapshot(data); setExpanded(nextExpanded); setActive(next); setHeights(new Map());
        setIntent(next ? { key: next, mode: surviving ? 'reveal' : 'initial', focus: restore } : null);
        anchor.current = null; measurements.current.clear();
        if (measurementFrame.current !== null) { cancelAnimationFrame(measurementFrame.current); measurementFrame.current = null; }
    }
    const rows = useMemo(() => flattenOrganizationTree(data, expanded), [data, expanded]);
    const layout = useMemo(() => layoutOrganizationChart(rows, heights), [rows, heights]);
    const cards = useMemo(() => new Map(layout.cards.map(card => [card.key, card])), [layout]);
    const world = { x: camera.x / zoom, y: camera.y / zoom, width: viewport.width / zoom, height: viewport.height / zoom };
    const visible = useMemo(() => chartWindow(layout, { x: camera.x / zoom, y: camera.y / zoom, width: viewport.width / zoom, height: viewport.height / zoom }, active), [layout, camera, viewport, zoom, active]);
    const measure = useCallback((key: string, height: number) => {
        measurements.current.set(key, height);
        if (measurementFrame.current !== null) return;
        // Yield between virtualized mount → measurement → camera passes. A complete
        // far jump may mount several batches; none can recurse through React commits.
        measurementFrame.current = requestAnimationFrame(() => {
            measurementFrame.current = null;
            const batch = new Map(measurements.current); measurements.current.clear();
            setHeights(current => {
                let next = current;
                for (const [id, value] of batch) {
                    if (Math.abs((current.get(id) ?? 0) - value) < .5) continue;
                    if (next === current) next = new Map(current);
                    next.set(id, value);
                }
                return next;
            });
        });
    }, []);
    useLayoutEffect(() => () => {
        if (measurementFrame.current !== null) cancelAnimationFrame(measurementFrame.current);
        measurementFrame.current = null; measurements.current.clear();
    }, []);
    useLayoutEffect(() => {
        const element = container.current;
        if (!element) return;
        const update = () => setViewport(current => current.width === element.clientWidth && current.height === element.clientHeight ? current : { width: element.clientWidth, height: element.clientHeight });
        update(); const observer = new ResizeObserver(update); observer.observe(element);
        return () => observer.disconnect();
    }, []);
    useLayoutEffect(() => {
        const host = container.current;
        if (!host) return;
        let next = { x: host.scrollLeft, y: host.scrollTop };
        const target = intent ? cards.get(intent.key) : undefined;
        if (target && intent) {
            if (intent.mode === 'initial') next = { x: Math.max(0, (target.x + target.width / 2) * zoom - host.clientWidth / 2), y: 0 };
            else if (intent.mode === 'center') next = centerChartCard(target, { width: host.clientWidth, height: host.clientHeight }, zoom);
            else next = revealChartCard(target, { ...next, width: host.clientWidth, height: host.clientHeight }, zoom);
        } else if (anchor.current) {
            const updated = cards.get(anchor.current.key);
            if (updated) next = anchorChartScroll(anchor.current, updated, next, zoom);
        }
        host.scrollLeft = next.x; host.scrollTop = next.y;
        setCamera(current => current.x === host.scrollLeft && current.y === host.scrollTop ? current : { x: host.scrollLeft, y: host.scrollTop });
        if (target && intent?.focus) controls.current.get(target.key)?.focus({ preventScroll: true });
        const first = target ?? layout.cards.find(card => card.x < (host.scrollLeft + host.clientWidth) / zoom && card.x + card.width > host.scrollLeft / zoom && card.y < (host.scrollTop + host.clientHeight) / zoom && card.y + card.height > host.scrollTop / zoom);
        anchor.current = first ? { key: first.key, x: first.x, y: first.y } : null;
    }, [layout, cards, intent, zoom, viewport]);
    function releaseIntent() { setIntent(null); anchor.current = null; }
    function keyboard(event: KeyboardEvent<HTMLElement>, row: OrganizationTreeRow) {
        if (event.ctrlKey || event.metaKey || event.altKey || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = organizationTreeKey(rows, expanded, row.key, event.key);
        setExpanded(next.expanded); setActive(next.active);
        setIntent(next.active ? { key: next.active, mode: 'reveal', focus: true } : null);
    }
    function changeZoom(next: number) {
        const host = container.current;
        if (!host) return;
        const scroll = zoomChartCamera({ x: host.scrollLeft, y: host.scrollTop }, viewport, zoom, next, layout, active ? cards.get(active) : undefined);
        releaseIntent(); setZoom(next); setCamera(scroll);
        // The scaled spacer is committed before this native scroll is applied by the layout effect.
        anchor.current = null;
        zoomScroll.current = scroll;
    }
    const zoomScroll = useRef<ChartPoint | null>(null);
    useLayoutEffect(() => {
        const host = container.current, scroll = zoomScroll.current;
        if (host && scroll) { host.scrollLeft = scroll.x; host.scrollTop = scroll.y; setCamera({ x: host.scrollLeft, y: host.scrollTop }); zoomScroll.current = null; }
    }, [zoom]);
    function center() {
        const key = active && cards.has(active) ? active : rows[0]?.key;
        if (!key) return;
        setZoom(1); setIntent({ key, mode: active ? 'center' : 'initial', focus: false });
    }
    function pointerDown(event: PointerEvent<HTMLDivElement>) {
        releaseIntent();
        if (event.pointerType !== 'mouse' || event.button !== 0 || (event.target as Element).closest('button,a')) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, started: false };
    }
    function pointerMove(event: PointerEvent<HTMLDivElement>) {
        const pan = drag.current;
        if (!pan || pan.id !== event.pointerId) return;
        if (!pan.started && Math.hypot(event.clientX - pan.x, event.clientY - pan.y) < 5) return;
        if (!pan.started) { pan.started = true; event.currentTarget.setPointerCapture(event.pointerId); }
        event.preventDefault(); event.currentTarget.scrollLeft = pan.left - event.clientX + pan.x; event.currentTarget.scrollTop = pan.top - event.clientY + pan.y;
    }
    function pointerEnd(event: PointerEvent<HTMLDivElement>) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
    }
    return <section className="organization-tree-panel" aria-label="Структура организации">
        <div className="organization-chart-toolbar"><p className="organization-tree-count" role="status">В текущей выборке: {countLabel(data.employee_count)}</p>
            <div className="organization-chart-camera" role="group" aria-label="Масштаб и положение схемы">
                <Button aria-label="Уменьшить масштаб" icon={<MinusOutlined />} disabled={zoom <= .5} onClick={() => changeZoom(Math.max(.5, zoom - .25))} />
                <output aria-label="Масштаб">{Math.round(zoom * 100)} %</output>
                <Button aria-label="Увеличить масштаб" icon={<PlusOutlined />} disabled={zoom >= 2} onClick={() => changeZoom(Math.min(2, zoom + .25))} />
                <Button onClick={center}>По центру</Button>
            </div>
        </div>
        <p className="organization-tree-hint">Линии показывают рабочую структуру. Перемещайте схему прокруткой или перетаскиванием фона.</p>
        <div ref={container} role="tree" aria-label="Организация, подразделение, отдел и сотрудники" className="organization-tree-viewport"
            onWheel={releaseIntent} onTouchStart={releaseIntent} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) releaseIntent(); }}
            onScroll={event => { const host = event.currentTarget; setCamera({ x: host.scrollLeft, y: host.scrollTop }); }}>
            <div className="organization-chart-spacer" role="presentation" style={{ width: Math.max(layout.width * zoom, viewport.width), height: Math.max(layout.height * zoom, viewport.height) }}>
                <div className="organization-chart-world" role="presentation" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
                    <svg className="organization-chart-connectors" aria-hidden="true" focusable="false" style={{ left: world.x, top: world.y }} width={world.width} height={world.height} viewBox={`${world.x} ${world.y} ${world.width} ${world.height}`}>
                        {visible.edges.map(edge => <line key={edge.key} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} />)}
                    </svg>
                    {visible.cards.map(card => {
                        const row = card.row;
                        const attributes = { role: 'treeitem', tabIndex: active === row.key ? 0 : -1, 'aria-level': row.depth + 1, 'aria-posinset': row.position, 'aria-setsize': row.siblings, onFocus: () => setActive(row.key), onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboard(event, row) };
                        const controlRef = (element: HTMLElement | null) => { if (element) controls.current.set(row.key, element); else controls.current.delete(row.key); };
                        return <MeasuredCard key={row.key} card={card} zoom={zoom} measure={measure}>
                            {row.employee ? <Link {...attributes} ref={controlRef} to={`/people/${row.employee.id}`} className="organization-tree-leaf organization-chart-card">
                                <span className="organization-chart-level">Сотрудник</span><span className="organization-tree-name">{row.employee.name}</span>
                                <span className="organization-tree-title">{row.employee.job_title ?? 'Должность не указана'}</span>
                                {!row.employee.active && <span className="organization-tree-title">Учётная запись отключена</span>}
                            </Link> : <button {...attributes} ref={controlRef} type="button" aria-expanded={expanded.has(row.key)} className="organization-tree-branch organization-chart-card" onClick={() => {
                                setActive(row.key); setExpanded(current => { const next = new Set(current); if (next.has(row.key)) next.delete(row.key); else next.add(row.key); return next; });
                                setIntent({ key: row.key, mode: 'reveal', focus: false });
                            }}>
                                <span className="organization-chart-level">{row.level}{row.empty ? ' · Не заполнено' : ''}</span><span className="organization-tree-branch-label">{row.label}</span>
                                <span className="organization-chart-footer"><span className="organization-tree-meta">{countLabel(row.count)}</span><span className="organization-chart-disclosure" aria-hidden="true">{expanded.has(row.key) ? 'Скрыть' : 'Показать'}</span></span>
                            </button>}
                        </MeasuredCard>;
                    })}
                </div>
            </div>
        </div>
    </section>;
}
