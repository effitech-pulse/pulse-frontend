import { Line } from '@ant-design/charts';
import { useCallback, useEffect, useRef } from 'react';
import { useTheme } from '@/theme/ThemeProvider';

type RiskPoint = {date:string; risk:number|null};
type ResizablePlot = {changeSize:(width:number, height:number)=>void};
const HEIGHT = 240;

/** G2 autoFit tracks window.resize; sidebar/tab layout can resize afterwards. */
export function RiskHistoryChart({data}: {data:RiskPoint[]}) {
  const { dark } = useTheme();
  const muted = dark ? '#9eafc4' : '#657487';
  const border = dark ? '#2d3e53' : '#dce3ea';
  const container = useRef<HTMLDivElement>(null);
  const plot = useRef<ResizablePlot>();
  const ready = useCallback((chart:ResizablePlot) => {plot.current = chart;}, []);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let frame = 0;
    let lastWidth = 0;
    const observer = new ResizeObserver(entries => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (width <= 0) {lastWidth = 0;cancelAnimationFrame(frame);return;}
      if (width === lastWidth) return;
      lastWidth = width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => plot.current?.changeSize(width, HEIGHT));
    });
    observer.observe(element);
    return () => {observer.disconnect();cancelAnimationFrame(frame);plot.current = undefined;};
  }, []);
  return <div className="pulse-risk-history-chart" ref={container}>
    <Line data={data} xField="date" yField="risk" height={HEIGHT} autoFit onReady={ready}
      scale={{ y: { domain: [0, 1], nice: false } }}
      axis={{ x: { title: false, tickCount: 4, tickFilter: (_value: unknown, index: number, ticks: unknown[]) => [0, Math.round((ticks.length - 1) / 3), Math.round((ticks.length - 1) * 2 / 3), ticks.length - 1].includes(index), labelAutoRotate: false, labelAutoHide: true, labelFill: muted, labelFillOpacity: 1, labelOpacity: 1, labelFontSize: 11, lineStroke: border },
        y: { title: false, tickCount: 5, labelFormatter: (value: number) => `${Math.round(Number(value) * 100)}%`, labelFill: muted, labelFillOpacity: 1, labelOpacity: 1, labelFontSize: 11, gridStroke: border, gridStrokeOpacity: 1 } }}
      style={{ stroke: dark ? '#82adff' : '#2f6fed', lineWidth: 2 }}
      connectNulls={{ connect: false }}
      tooltip={{ items: [{ channel: 'y', name: 'Риск', valueFormatter: (value: number) => `${(value * 100).toFixed(1)}%` }] }}
      theme={dark ? 'dark' : 'light'}
      containerStyle={{width:'100%',height:'100%',minWidth:0,maxWidth:'100%'}} />
  </div>;
}
