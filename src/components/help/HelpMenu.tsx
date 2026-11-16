import {useRef,useState} from 'react';
import {Button,Dropdown,Tooltip} from 'antd';
import {ReadOutlined} from '@ant-design/icons';
import {Link} from 'react-router-dom';
import '../../styles/help.css';

export interface HelpMenuProps {onFeedback?:()=>void;onPolicy?:()=>void;feedbackEnabled?:boolean}
/** Общий вход в справку; дополнительные действия принадлежат оболочке приложения. */
export function HelpMenu({onFeedback,onPolicy,feedbackEnabled=false}:HelpMenuProps){
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
 const restoreFocus=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus());};
 const items=[{key:'documentation',label:<Link to="/help">Документация</Link>},
  ...((feedbackEnabled&&onFeedback)||onPolicy?[{type:'divider' as const}]:[]),
  ...(feedbackEnabled&&onFeedback?[{key:'feedback',label:'Предложить улучшение',onClick:onFeedback}]:[]),
  ...(onPolicy?[{key:'policy',label:'Как используются данные',onClick:onPolicy}]:[])];
 return <Tooltip title={open?null:'Справка'}><Dropdown placement="bottomRight" align={{overflow:{adjustX:true,adjustY:true,shiftX:true}}} overlayClassName="help-dropdown" trigger={['click']} open={open} autoFocus onOpenChange={setOpen} menu={{items,onClick:()=>setOpen(false),onKeyDown:event=>{if(event.key==='Escape'){event.preventDefault();restoreFocus();}}}}>
  <Button ref={trigger} type="text" className="app-icon-button help-trigger" aria-label="Справка" aria-haspopup="menu" aria-expanded={open} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);}if(event.key==='Escape')restoreFocus();}} icon={<ReadOutlined/>}/>
 </Dropdown></Tooltip>;
}
