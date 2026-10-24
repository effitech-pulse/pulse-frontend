import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RightOutlined, DownOutlined } from '@ant-design/icons';
import type { OrganizationTree as Snapshot } from '@/api/people';
import { flattenOrganizationTree, organizationTreeKey, organizationTreeWindow, type OrganizationTreeRow } from '@/lib/organizationTree';
function countLabel(count: number) { const n=count%100, last=count%10; return `${count} ${n>=11&&n<=14?'сотрудников':last===1?'сотрудник':last>=2&&last<=4?'сотрудника':'сотрудников'}`; }
function MeasuredRow({row,top,measure,children}:{row:OrganizationTreeRow;top:number;measure:(key:string,height:number)=>void;children:ReactNode}) {
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const element=ref.current;if(!element)return;const update=()=>measure(row.key,element.getBoundingClientRect().height);update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();},[row.key,measure]);
 return <div ref={ref} className="organization-tree-position" style={{top,paddingLeft:row.depth*12}}>{children}</div>;
}
/** Measured variable-height rows keep the complete snapshot out of the DOM. */
export function OrganizationTree({data}:{data:Snapshot}) {
 const container=useRef<HTMLDivElement>(null), controls=useRef(new Map<string,HTMLElement>());
 const [snapshot,setSnapshot]=useState(data),[expanded,setExpanded]=useState<Set<string>>(()=>new Set()),[active,setActive]=useState<string|null>(data.organizations[0]?.key??null);
 const [heights,setHeights]=useState<Map<string,number>>(()=>new Map()),[scroll,setScroll]=useState(0),[viewport,setViewport]=useState(620),[pendingFocus,setPendingFocus]=useState<string|null>(null);
 if(snapshot!==data){const restore=typeof document!=='undefined'&&container.current?.contains(document.activeElement);setSnapshot(data);setExpanded(new Set());setHeights(new Map());setScroll(0);setActive(data.organizations[0]?.key??null);setPendingFocus(restore?data.organizations[0]?.key??null:null);}
 const rows=useMemo(()=>flattenOrganizationTree(data,expanded),[data,expanded]);
 const visible=useMemo(()=>organizationTreeWindow(rows,heights,scroll,viewport,active),[rows,heights,scroll,viewport,active]);
 const measure=useCallback((key:string,height:number)=>{setHeights(current=>{if(Math.abs((current.get(key)??0)-height)<.5)return current;const next=new Map(current);next.set(key,height);return next;});},[]);
 useLayoutEffect(()=>{const element=container.current;if(!element)return;const observer=new ResizeObserver(()=>{setViewport(element.clientHeight);});observer.observe(element);setViewport(element.clientHeight);return()=>observer.disconnect();},[]);
 useLayoutEffect(()=>{if(container.current)container.current.scrollTop=0;},[data]);
 useLayoutEffect(()=>{
  if(!pendingFocus||!container.current)return;
  const index=rows.findIndex(row=>row.key===pendingFocus),element=controls.current.get(pendingFocus);if(index<0||!element)return;
  const host=container.current,top=visible.offsets[index],bottom=visible.offsets[index+1];
  if(top<host.scrollTop)host.scrollTop=top;else if(bottom>host.scrollTop+host.clientHeight)host.scrollTop=Math.min(top,bottom-host.clientHeight);
  setScroll(host.scrollTop);element.focus({preventScroll:true});
  // Keep this keyboard intent while row observers refine estimated offsets.
  // Explicit pointer/wheel/blur intent releases it; scroll events also come from this effect.
 },[pendingFocus,rows,visible.offsets]);
 function keyboard(event:KeyboardEvent,row:OrganizationTreeRow){if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=organizationTreeKey(rows,expanded,row.key,event.key);setExpanded(next.expanded);setActive(next.active);setPendingFocus(next.active);}
 return <section className="organization-tree-panel" aria-label="Структура организации">
  <p className="organization-tree-count" role="status">В текущей выборке: {countLabel(data.employee_count)}</p><p className="organization-tree-hint">Нажмите на имя сотрудника, чтобы открыть профиль</p>
  <div ref={container} role="tree" aria-label="Организация, подразделение, отдел и сотрудники" className="organization-tree-viewport" onWheel={()=>setPendingFocus(null)} onTouchStart={()=>setPendingFocus(null)} onPointerDown={()=>setPendingFocus(null)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPendingFocus(null);}} onScroll={event=>setScroll(event.currentTarget.scrollTop)}>
   <div className="organization-tree-space" role="presentation" style={{height:visible.total}}>{visible.indices.map(index=>{const row=rows[index];const attributes={role:'treeitem',tabIndex:active===row.key?0:-1,'aria-level':row.depth+1,'aria-posinset':row.position,'aria-setsize':row.siblings,onFocus:()=>setActive(row.key),onKeyDown:(event:KeyboardEvent<HTMLElement>)=>keyboard(event,row)};return <MeasuredRow key={row.key} row={row} top={visible.offsets[index]} measure={measure}>
    {row.employee?<Link {...attributes} ref={element=>{if(element)controls.current.set(row.key,element);else controls.current.delete(row.key);}} to={`/people/${row.employee.id}`} className="organization-tree-leaf"><span className="organization-tree-text"><span className="organization-tree-name">{row.employee.name}</span><span className="organization-tree-title">{row.employee.job_title??'Должность не указана'}</span>{!row.employee.active&&<span className="organization-tree-title">Учётная запись отключена</span>}</span></Link>:<button {...attributes} ref={element=>{if(element)controls.current.set(row.key,element);else controls.current.delete(row.key);}} type="button" aria-expanded={expanded.has(row.key)} className="organization-tree-branch" onClick={()=>{setActive(row.key);setExpanded(current=>{const next=new Set(current);if(next.has(row.key))next.delete(row.key);else next.add(row.key);return next;});}}><span className="organization-tree-caret" aria-hidden="true">{expanded.has(row.key)?<DownOutlined/>:<RightOutlined/>}</span><span className="organization-tree-text"><span className="organization-tree-branch-label">{row.label}</span><span className="organization-tree-meta">{row.empty?'Не заполнено':row.level} · {countLabel(row.count)}</span></span></button>}
   </MeasuredRow>;})}</div>
  </div>
 </section>;
}
