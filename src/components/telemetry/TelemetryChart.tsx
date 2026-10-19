import { useEffect, useId, useRef, useState } from 'react';
import type { Measurement } from '@/api/integrations';
import { channels, normalizedValue } from '@/lib/telemetry';

export type ZoomRange = [number, number];
interface Props {
  points: Measurement[]; selected: string[]; normalized?: boolean; dual?: boolean; elapsed?: boolean;
  zoom: ZoomRange; onZoom: (v: ZoomRange) => void; cursor: number | null; onCursor: (v: number | null) => void;
  sharedBounds?: Record<string, [number, number]>;
  fixedBounds?: Record<string, [number, number]>;
}
export const seriesColors = ['var(--series-blue)', 'var(--series-amber)', 'var(--series-green)', '#ba4e98', '#8c82ed', '#36a9b0'];

/** SVG-график: причинные исходные значения, разрывы, общий курсор и масштаб. */
export function TelemetryChart({ points, selected, normalized, dual, elapsed, zoom, onZoom, cursor, onCursor, sharedBounds, fixedBounds }: Props) {
  const host = useRef<HTMLDivElement>(null); const [width, setWidth] = useState(800); const [drag, setDrag] = useState<number | null>(null);
  const clip = useId().replace(/:/g, '');
  useEffect(() => { const node = host.current; if (!node) return; const o = new ResizeObserver(entries => setWidth(Math.max(280, entries[0].contentRect.width))); o.observe(node); return () => o.disconnect(); }, []);
  const h = 280, left = 55, right = width - (dual ? 55 : 20), top = 20, bottom = 240;
  const start = points.length ? Date.parse(points[0].timestamp) : 0, end = points.length ? Date.parse(points[points.length - 1].timestamp) : 1;
  const duration = Math.max(end - start, 1);
  const fraction = (p: Measurement) => (Date.parse(p.timestamp) - start) / duration;
  const visible = points.filter(p => fraction(p) >= zoom[0] && fraction(p) <= zoom[1]);
  const base = Object.fromEntries(selected.map(k => [k, points.find(p => p.values[k] != null)?.values[k] ?? null]));
  const value = (p: Measurement, k: string) => normalized ? normalizedValue(p.values[k] ?? null, base[k]) : p.values[k] ?? null;
  const unit = (k: string) => normalized ? '%' : channels.find(c => c.key === k)?.unit ?? k;
  const units = [...new Set(selected.map(unit))];
  const ranges: Record<string, [number, number]> = {};
  for (const u of units) {
    if (fixedBounds?.[u]) { ranges[u] = fixedBounds[u]; continue; }
    let low = Infinity, high = -Infinity;
    for (const p of visible) for (const k of selected) { if (unit(k) !== u) continue; const v = value(p, k); if (v !== null) { low = Math.min(low, v); high = Math.max(high, v); } }
    if (!Number.isFinite(low)) { low = 0; high = 1; }
    if (sharedBounds?.[u]) [low, high] = sharedBounds[u];
    const pad = Math.max((high - low) * .1, Math.abs(high) * .02, .01); ranges[u] = [low - pad, high + pad];
  }
  const x = (f: number) => left + (f - zoom[0]) / (zoom[1] - zoom[0]) * (right - left);
  const y = (v: number, k: string) => { const [lo, hi] = ranges[unit(k)]; return bottom - (v - lo) / (hi - lo) * (bottom - top); };
  const nearest = cursor === null ? undefined : visible.reduce<Measurement | undefined>((best, p) => !best || Math.abs(fraction(p) - cursor) < Math.abs(fraction(best) - cursor) ? p : best, undefined);
  const locate = (clientX: number) => {
    const rect = host.current!.getBoundingClientRect();
    return Math.max(zoom[0], Math.min(zoom[1], zoom[0] + (clientX - rect.left - left) / (right - left) * (zoom[1] - zoom[0])));
  };
  function wheel(e: WheelEvent) {
    e.preventDefault(); const at = locate(e.clientX), scale = e.deltaY > 0 ? 1.25 : .8;
    const size = Math.min(1, Math.max(.002, (zoom[1] - zoom[0]) * scale));
    const a = Math.max(0, Math.min(1 - size, at - (at - zoom[0]) / (zoom[1] - zoom[0]) * size)); onZoom([a, a + size]);
  }
  const wheelRef = useRef(wheel); wheelRef.current = wheel;
  useEffect(() => { const node = host.current!; const handler = (e: WheelEvent) => wheelRef.current(e); node.addEventListener('wheel', handler, { passive: false }); return () => node.removeEventListener('wheel', handler); }, []);
  return <div ref={host} className="telemetry-chart" tabIndex={0} aria-label="График телеметрии. Выделите интервал мышью или измените масштаб колесом. Escape — сброс." onKeyDown={e => { if (e.key === 'Escape') onZoom([0, 1]); }}>
    {visible.length > 0 && <svg width="100%" height={h} viewBox={`0 0 ${width} ${h}`} role="img" aria-label={selected.map(k => channels.find(c => c.key === k)?.label ?? k).join(', ')}
      onPointerMove={e => onCursor(locate(e.clientX))} onPointerLeave={() => { if (drag === null) onCursor(null); }}
      onPointerDown={e => { if (e.button !== 0) return; setDrag(locate(e.clientX)); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerUp={e => { if (drag !== null) { const at = locate(e.clientX); if (Math.abs(at - drag) > .004) onZoom([Math.min(at, drag), Math.max(at, drag)]); } setDrag(null); }} onPointerCancel={() => setDrag(null)} onDoubleClick={() => onZoom([0, 1])}>
      <defs><clipPath id={clip}><rect x={left} y={top} width={Math.max(1, right - left)} height={bottom - top} /></clipPath></defs>
      {[0, .5, 1].map(t => <g key={t}><line x1={left} x2={right} y1={top + t * (bottom - top)} y2={top + t * (bottom - top)} className="chart-grid" />{units.slice(0, dual ? 2 : 1).map((u, i) => <text key={u} x={i ? right + 6 : left - 6} y={top + t * (bottom - top) + 4} textAnchor={i ? 'start' : 'end'} className="chart-label">{(ranges[u][1] - t * (ranges[u][1] - ranges[u][0])).toLocaleString('ru', { maximumFractionDigits: 1 })}</text>)}</g>)}
      {units.slice(0, dual ? 2 : 1).map((u, i) => <text key={u} x={i ? right : left} y={12} textAnchor={i ? 'end' : 'start'} className="chart-label">{u}</text>)}
      {[0, .33, .66, 1].map(t => <text key={t} x={left + t * (right - left)} y={265} textAnchor={t === 0 ? 'start' : t === 1 ? 'end' : 'middle'} className="chart-label">{elapsed ? `${((zoom[0] + t * (zoom[1] - zoom[0])) * duration / 3600000).toFixed(1)} ч` : new Date(start + (zoom[0] + t * (zoom[1] - zoom[0])) * duration).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })}</text>)}
      <g clipPath={`url(#${clip})`}>{selected.map((key, index) => {
        let path = '', connected = false;
        // Отрисовываем все загруженные точки: пики и пропуски не сглаживаются.
        for (const p of visible) { const v = value(p, key); if (v === null) { connected = false; continue; } path += `${connected ? 'L' : 'M'}${x(fraction(p)).toFixed(2)} ${y(v, key).toFixed(2)} `; connected = true; }
        return <path key={key} d={path} fill="none" stroke={seriesColors[index % seriesColors.length]} strokeWidth={1.8} />;
      })}</g>
      {cursor !== null && <line x1={x(cursor)} x2={x(cursor)} y1={top} y2={bottom} className="chart-cursor" />}
      {drag !== null && cursor !== null && <rect x={Math.min(x(drag), x(cursor))} y={top} width={Math.abs(x(drag) - x(cursor))} height={bottom - top} fill="#2f6fed" opacity={.15} />}
    </svg>}
    {nearest && <div className="chart-tooltip" style={{ left: Math.min(width - 240, Math.max(10, x(cursor!) + 12)) }}><div>{new Date(nearest.timestamp).toLocaleString('ru', { timeZone: 'Europe/Moscow' })} МСК</div>{selected.map((k, i) => <div key={k}><span style={{ color: seriesColors[i % seriesColors.length] }}>━ </span>{channels.find(c => c.key === k)?.label ?? k}: {nearest.values[k]?.toLocaleString('ru', { maximumFractionDigits: 2 }) ?? '—'} {channels.find(c => c.key === k)?.unit}{normalized && ` (${value(nearest, k)?.toFixed(1) ?? '—'}%)`}</div>)}</div>}
    {!visible.length && <div className="chart-empty">Нет измерений в выбранном интервале</div>}
  </div>;
}
