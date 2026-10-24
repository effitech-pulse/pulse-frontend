import type { OrganizationTree } from '../api/people';
import type { OrganizationTreeRow } from './organizationTree';

export const CHART = { width: 248, minHeight: 88, siblingGap: 104, levelGap: 24, employeeGap: 24, rail: 24, left: 64, top: 16 } as const;
export interface ChartRect { x: number; y: number; width: number; height: number }
export interface ChartCard extends ChartRect { key: string; row: OrganizationTreeRow }
export interface ChartSegment { x1: number; y1: number; x2: number; y2: number }
export interface ChartEdge extends ChartSegment { key: string; parent: string; kind: 'branch' | 'rail' | 'employee' }
export interface ChartLayout { cards: ChartCard[]; edges: ChartEdge[]; width: number; height: number }
/** Only the first actual server path, including nullable workplace nodes; no synthetic root. */
export function initialChartExpansion(data: OrganizationTree): Set<string> {
    const org = data.organizations[0], division = org?.divisions[0], department = division?.departments[0];
    return new Set([org?.key, division?.key, department?.key].filter((key): key is string => key !== undefined));
}
/** One coordinate system for HTML cards and SVG. Parents lead their first child column. */
export function layoutOrganizationChart(rows: readonly OrganizationTreeRow[], heights: ReadonlyMap<string, number>): ChartLayout {
    const children = new Map<string | null, OrganizationTreeRow[]>(), widths = new Map<string, number>();
    const defaults = new Map(rows.map(row => [row.key, row.employee ? CHART.minHeight : 110]));
    const height = (key: string) => Math.max(CHART.minHeight, heights.get(key) ?? defaults.get(key) ?? CHART.minHeight);
    const levelHeights: number[] = [CHART.minHeight, CHART.minHeight, CHART.minHeight];
    for (const row of rows) { const siblings = children.get(row.parent) ?? []; siblings.push(row); children.set(row.parent, siblings); if (!row.employee) levelHeights[row.depth] = Math.max(levelHeights[row.depth], height(row.key)); }
    const levels: number[] = [CHART.top];
    for (let i = 0; i < 3; i++) levels.push(levels[i] + levelHeights[i] + CHART.levelGap);
    for (let i = rows.length - 1; i >= 0; i--) { const row = rows[i], descendants = children.get(row.key) ?? []; widths.set(row.key, row.depth === 2 || !descendants.length ? CHART.width : descendants.reduce((sum, child) => sum + widths.get(child.key)!, 0) + CHART.siblingGap * (descendants.length - 1)); }
    const cards: ChartCard[] = [], edges: ChartEdge[] = [];
    const edge = (parent: string, kind: ChartEdge['kind'], x1: number, y1: number, x2: number, y2: number) => { if (x1 !== x2 || y1 !== y2) edges.push({key: `${parent}:${edges.length}`, parent, kind, x1, y1, x2, y2}); };
    function place(row: OrganizationTreeRow, x: number, y: number) {
        const card: ChartCard = {key: row.key, row, x, y, width: CHART.width, height: height(row.key)}; cards.push(card);
        const descendants = children.get(row.key) ?? [];
        if (!descendants.length) return;
        if (row.depth === 2) {
            let nextY = y + card.height + CHART.levelGap;
            const railX = x - CHART.rail;
            edge(row.key, 'rail', x + CHART.width / 2, y + card.height, x + CHART.width / 2, nextY - CHART.levelGap / 2);
            edge(row.key, 'rail', x + CHART.width / 2, nextY - CHART.levelGap / 2, railX, nextY - CHART.levelGap / 2);
            const railTop = nextY - CHART.levelGap / 2;
            for (const child of descendants) {
                place(child, x, nextY);
                edge(row.key, 'employee', railX, nextY - CHART.levelGap / 2, x + CHART.width / 2, nextY - CHART.levelGap / 2);
                edge(row.key, 'employee', x + CHART.width / 2, nextY - CHART.levelGap / 2, x + CHART.width / 2, nextY);
                nextY += height(child.key) + CHART.employeeGap;
            }
            edge(row.key, 'rail', railX, railTop, railX, nextY - CHART.employeeGap - height(descendants.at(-1)!.key) - CHART.levelGap / 2);
        } else {
            const childY = levels[row.depth + 1], busY = childY - CHART.levelGap / 2;
            edge(row.key, 'branch', x + CHART.width / 2, y + card.height, x + CHART.width / 2, busY);
            let childX = x, lastX = x;
            for (const child of descendants) { place(child, childX, childY); lastX = childX; edge(row.key, 'branch', childX + CHART.width / 2, busY, childX + CHART.width / 2, childY); childX += widths.get(child.key)! + CHART.siblingGap; }
            edge(row.key, 'branch', x + CHART.width / 2, busY, lastX + CHART.width / 2, busY);
        }
    }
    let rootX: number = CHART.left;
    for (const root of children.get(null) ?? []) { place(root, rootX, CHART.top); rootX += widths.get(root.key)! + CHART.siblingGap; }
    let right = 0, bottom = 0;
    for (const card of cards) { right = Math.max(right, card.x + card.width); bottom = Math.max(bottom, card.y + card.height); }
    return {cards, edges, width: right + CHART.left, height: bottom + CHART.top};
}
/** Axis-aligned connectors are clipped, including rails whose endpoints are both outside. */
export function clipChartSegment(segment: ChartSegment, viewport: ChartRect): ChartSegment | null {
    const {x1, y1, x2, y2} = segment, right = viewport.x + viewport.width, bottom = viewport.y + viewport.height;
    if (x1 === x2) { if (x1 < viewport.x || x1 > right || Math.max(y1, y2) < viewport.y || Math.min(y1, y2) > bottom) return null; return {x1, x2, y1: Math.max(viewport.y, Math.min(y1,y2)), y2: Math.min(bottom, Math.max(y1,y2))}; }
    if (y1 === y2) { if (y1 < viewport.y || y1 > bottom || Math.max(x1,x2) < viewport.x || Math.min(x1,x2) > right) return null; return {y1, y2, x1: Math.max(viewport.x, Math.min(x1,x2)), x2: Math.min(right, Math.max(x1,x2))}; }
    return null;
}
export function chartWindow(layout: ChartLayout, viewport: ChartRect, active?: string | null) {
    const overscan = 100, area = {x: viewport.x - overscan, y: viewport.y - overscan, width: viewport.width + overscan * 2, height: viewport.height + overscan * 2};
    const cards = layout.cards.filter(card => card.key === active || (card.x < area.x + area.width && card.x + card.width > area.x && card.y < area.y + area.height && card.y + card.height > area.y));
    const edges: ChartEdge[] = [];
    for (const edge of layout.edges) { const clipped = clipChartSegment(edge, area); if (clipped) edges.push({...edge, ...clipped}); }
    return {cards, edges};
}

export interface ChartPoint { x: number; y: number }
export function zoomChartScroll(scroll: ChartPoint, viewport: Pick<ChartRect, 'width' | 'height'>, before: number, after: number): ChartPoint {
    return {x: Math.max(0, (scroll.x + viewport.width / 2) / before * after - viewport.width / 2), y: Math.max(0, (scroll.y + viewport.height / 2) / before * after - viewport.height / 2)};
}
export function anchorChartScroll(before: ChartPoint, after: ChartPoint, scroll: ChartPoint, zoom: number): ChartPoint {
    return {x: Math.max(0, scroll.x + (after.x - before.x) * zoom), y: Math.max(0, scroll.y + (after.y - before.y) * zoom)};
}
export function revealChartCard(card: ChartRect, viewport: ChartRect, zoom: number): ChartPoint {
    let x = viewport.x, y = viewport.y;
    const left = card.x * zoom, top = card.y * zoom, right = (card.x + card.width) * zoom, bottom = (card.y + card.height) * zoom;
    if (left < x) x = left; else if (right > x + viewport.width) x = Math.min(left, right - viewport.width);
    if (top < y) y = top; else if (bottom > y + viewport.height) y = Math.min(top, bottom - viewport.height);
    return {x: Math.max(0, x), y: Math.max(0, y)};
}
export function centerChartCard(card: ChartRect, viewport: Pick<ChartRect, 'width' | 'height'>, zoom: number): ChartPoint {
    return {x: Math.max(0, card.width * zoom > viewport.width ? card.x * zoom : (card.x + card.width / 2) * zoom - viewport.width / 2), y: Math.max(0, card.height * zoom > viewport.height ? card.y * zoom : (card.y + card.height / 2) * zoom - viewport.height / 2)};
}
/** Zoom preserves the world center where possible, then keeps the active control reachable. */
export function zoomChartCamera(scroll: ChartPoint, viewport: Pick<ChartRect, 'width' | 'height'>, before: number, after: number, bounds: Pick<ChartRect, 'width' | 'height'>, active?: ChartRect): ChartPoint {
    const clamp = (point: ChartPoint) => ({x: Math.max(0, Math.min(point.x, bounds.width * after - viewport.width)), y: Math.max(0, Math.min(point.y, bounds.height * after - viewport.height))});
    const centered = clamp(zoomChartScroll(scroll, viewport, before, after));
    return active ? clamp(revealChartCard(active, { ...centered, ...viewport }, after)) : centered;
}
