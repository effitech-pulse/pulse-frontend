import {useEffect,useRef,useState} from 'react';
import {dailyDate, dailyNumber, dailySegments, dailyStatus, type DailyFlowView} from '@/lib/dailyFlow';

/** Две несглаженные серверные серии; null всегда разрывает путь. */
export function DailyFlowChart({view}:{view:DailyFlowView}) {
 const [cursor,setCursor]=useState<number|null>(null);
 const host=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(800);
 useEffect(()=>{const node=host.current;if(!node)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(200,entries[0].contentRect.width)));observer.observe(node);return()=>observer.disconnect();},[]);
 const height=width<600?256:276;const bottom=height-32;const left=40;const right=width-8;
 const values=view.rows.flatMap(row=>[row.actual,row.expected]).filter((v):v is number=>v!==null);
 const max=Math.max(1,...values)*1.1;
 const x=(index:number)=>left+index/Math.max(1,view.rows.length-1)*(right-left);
 const y=(value:number)=>bottom-value/max*(bottom-24);
 const row=cursor===null?null:view.rows[cursor];
 function locate(clientX:number,node:HTMLDivElement){const bounds=node.getBoundingClientRect();const index=Math.round((clientX-bounds.left-left)/(right-left)*(view.rows.length-1));setCursor(Math.max(0,Math.min(view.rows.length-1,index)));}
 return <section className="daily-panel daily-chart-panel" aria-label="Динамика суточного дебита">
  <h3>Динамика за {view.coverage.calendar_days} дней</h3>
  <div className="daily-legend"><span>Факт — сплошная</span><span>Ожидание · пунктир</span></div>
  <div ref={host} className="daily-chart" tabIndex={0} role="group" aria-label={`График, м³/сут, ${dailyDate(view.start_date)} — ${dailyDate(view.end_date)}. Стрелки — даты, Home и End — края, Escape — закрыть подсказку. Пропуски показаны разрывами.`}
   onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape')setCursor(null);else setCursor(i=>e.key==='Home'?0:e.key==='End'?view.rows.length-1:Math.max(0,Math.min(view.rows.length-1,(i??(e.key==='ArrowLeft'?view.rows.length: -1))+(e.key==='ArrowLeft'?-1:1))));}}
   onPointerMove={e=>locate(e.clientX,e.currentTarget)}
   onPointerDown={e=>{locate(e.clientX,e.currentTarget);e.currentTarget.focus({preventScroll:true});}}
   onPointerLeave={e=>{if(e.pointerType==='mouse')setCursor(null);}} onBlur={()=>setCursor(null)}>
   <svg viewBox={`0 0 ${width} ${height}`} style={{height}} role="img" aria-label="Факт — сплошная линия; ожидание — пунктир. Ноль — значение, пропуски не соединены.">
    {[0,1,2,3].map(i=>{const value=max*i/3;return <g key={i}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="daily-grid"/><text x="0" y={y(value)+4} className="daily-axis">{new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value)}</text></g>;})}
    {(['actual','expected'] as const).map(field=>dailySegments(view.rows,field).map((part,i)=><g key={`${field}-${i}`} className={`daily-${field}`} data-daily-series={field}>
     {part.length>1&&<polyline points={part.map(p=>`${x(p.index)},${y(p.value)}`).join(' ')} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray={field==='expected'?'6 4':undefined}/>}
     {part.length===1&&<circle cx={x(part[0].index)} cy={y(part[0].value)} r="3"/>}
    </g>))}
    {[0,Math.floor((view.rows.length-1)/2),view.rows.length-1].map((index,i)=><text key={i} x={x(index)} y={height-6} textAnchor={i===0?'start':i===2?'end':'middle'} className="daily-axis">{dailyDate(view.rows[index].date).slice(0,5)}</text>)}
    {cursor!==null&&<line x1={x(cursor)} x2={x(cursor)} y1="24" y2={bottom} className="daily-cursor"/>}
   </svg>
   <div className="daily-chart-output" aria-live="polite" aria-atomic="true">{row&&`${dailyDate(row.date)} · Факт: ${dailyNumber(row.actual)} · Ожидание: ${dailyNumber(row.expected)} · Отклонение: ${dailyNumber(row.delta,true)} м³/сут · ${dailyNumber(row.delta_percent,true)}${row.delta_percent===null?'':'%'} · ${dailyStatus(row)}`}</div>
  </div>
  <p className="daily-small">Пропуски показаны разрывами. Ноль — значение.</p>
 </section>;
}
