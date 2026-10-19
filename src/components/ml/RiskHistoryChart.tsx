import { Line } from '@ant-design/charts';
import { useCallback, useEffect, useRef } from 'react';

type RiskPoint = {date:string; risk:number};
type ResizablePlot = {changeSize:(width:number, height:number)=>void};
const HEIGHT = 280;

/** G2 autoFit tracks window.resize; sidebar/tab layout can resize afterwards. */
export function RiskHistoryChart({data}: {data:RiskPoint[]}) {
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
      containerStyle={{width:'100%',height:'100%',minWidth:0,maxWidth:'100%'}} />
  </div>;
}
