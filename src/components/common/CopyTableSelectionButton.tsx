import {useState} from 'react';
import {App,Button,Input,Modal} from 'antd';
import {CopyOutlined} from '@ant-design/icons';
import {useAuth} from '@/auth/AuthProvider';

interface Props {
 getLink:()=>string;
 disabled?:boolean;
 clipboard?:Pick<Clipboard,'writeText'>|null;
}
/** A link is constructed only after an explicit user action. */
export function CopyTableSelectionButton({getLink,disabled=false,clipboard}:Props){
 const auth=useAuth(),{message}=App.useApp();
 const [pending,setPending]=useState(false),[fallback,setFallback]=useState('');
 const copy=async()=>{
  if(disabled||pending||auth.privateBlocked)return;
  const ticket=auth.capturePrivate(),link=getLink();setPending(true);
  try {
   const target=clipboard===undefined?navigator.clipboard:clipboard;
   if(!target)throw new Error('Clipboard unavailable');
   await target.writeText(link);
   if(ticket.current())message.success('Ссылка на выборку скопирована');
  }catch{if(ticket.current())setFallback(link);}
  finally{if(ticket.current())setPending(false);}
 };
 return <>
  <Button className="pulse-table-selection-copy" icon={<CopyOutlined />} disabled={disabled||auth.privateBlocked||pending} loading={pending} onClick={copy}>Скопировать параметры выборки</Button>
  <Modal title="Не удалось скопировать ссылку" open={!!fallback&&!auth.privateBlocked} onCancel={()=>setFallback('')}
   footer={<Button onClick={()=>setFallback('')}>Закрыть</Button>} focusTriggerAfterClose
   afterOpenChange={open=>{if(open)document.getElementById('pulse-table-selection-link')?.focus();}}>
   <p>Выделите ссылку и скопируйте её вручную.</p>
   <Input.TextArea id="pulse-table-selection-link" aria-label="Ссылка на выборку" readOnly value={fallback} autoSize={{minRows:3,maxRows:8}} onFocus={event=>event.target.select()} />
  </Modal>
 </>;
}
