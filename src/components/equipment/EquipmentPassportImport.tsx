import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Alert,Button,Card,Select,Space,Upload} from 'antd';
import {useAuth} from '../../auth/AuthProvider';
import {wellsApi} from '../../api/wells';
import {guardTablePage} from '../../lib/tableTransport';
import type {PassportIssue} from '../../api/equipmentPassports';
import {PulseTable} from '../common/PulseTable';
import {createEmptyTableQuery} from '../../lib/tableQuery';

export function EquipmentPassportImport({selected,onSelection,file,onFile,onCheck,onTemplate,onExport,onBack,onFailure,canImport,canExport,busy,checkBlocked,issues}:{selected:string[];onSelection:(ids:string[])=>void;file:File|null;onFile:(file:File|null)=>void;onCheck:()=>void;onTemplate:()=>void;onExport:()=>void;onBack:()=>void;onFailure:(error:unknown)=>void;canImport:boolean;canExport:boolean;busy:boolean;checkBlocked:boolean;issues:PassportIssue[]}){
 const auth=useAuth();const [fileError,setFileError]=useState('');const [query,setQuery]=useState(createEmptyTableQuery);const [pagination,setPagination]=useState({page:1,pageSize:25});
 const wells=useQuery({queryKey:['equipment-passport-wells',auth.privateEpoch],retry:false,enabled:!auth.privateBlocked&&auth.can('wells.read'),queryFn:({signal})=>guardTablePage(auth.capturePrivate(),async()=>{try{return await wellsApi.list(false,undefined,'current',signal);}catch(error){if(!signal.aborted)onFailure(error);throw error;}},signal)});
 const options=(wells.data??[]).map(well=>({value:String(well.id),label:`${well.id} · № ${well.well_number??'не указан'} · НГДУ ${well.ngdu}`}));
 return <><Card className="passport-surface" title="Выбор скважин и шаблон">
  <p>1. Выбрать скважины → 2. Загрузить файл → 3. Проверить изменения → 4. Подтвердить → 5. Результат</p>
  <Alert type="info" message={`Выбрано ${selected.length} из 100 скважин`} description="Выбор сохраняется при поиске. Только доступные скважины; один пакет — до 300 строк и 2 МиБ."/>
  <label htmlFor="passport-well-selection">Добавить скважины по ID Pulse или номеру</label>
  <Select id="passport-well-selection" mode="multiple" showSearch optionFilterProp="label" value={selected} options={options} onChange={values=>{if(values.length<=100)onSelection(values);}} loading={wells.isFetching} disabled={busy} style={{width:'100%'}} placeholder="Поиск доступных скважин"/>
  {wells.isError?<Alert type="error" message="Не удалось загрузить доступные скважины" action={<Button onClick={()=>void wells.refetch()}>Повторить</Button>}/>:null}
  <Space wrap>{canImport?<Button type="primary" disabled={busy||!selected.length} onClick={onTemplate}>Скачать шаблон</Button>:null}{canExport?<Button disabled={busy||!selected.length} onClick={onExport}>Экспорт текущего состава</Button>:null}<Button disabled={busy} onClick={onBack}>Текущий состав</Button></Space>
  <p>Шаблон содержит точные ID и версии: update для заполненных слотов, register для пустых. Заполните известные слоты; ненужные пустые register-строки удалите. Пропущенные слоты не меняются.</p>
 </Card>{canImport?<Card className="passport-surface" title="Загрузить заполненную книгу">
  <p>Только XLSX equipment-passport-v1 · до 2 МиБ · листы meta и components. Загрузка ничего не устанавливает.</p>
  <Upload.Dragger accept=".xlsx" maxCount={1} multiple={false} disabled={busy} showUploadList={false} beforeUpload={next=>{
   if(next.size>2*1024*1024||!next.name.toLowerCase().endsWith('.xlsx')){setFileError('Выберите XLSX до 2 МиБ');return false;}
   setFileError('');onFile(next);return false;
  }}><p>Выберите XLSX или перетащите файл в эту область</p><Button disabled={busy}>Выбрать файл</Button></Upload.Dragger>
  {file?<p>{file.name} · {file.size} байт <Button type="link" disabled={busy} onClick={()=>onFile(null)}>Убрать файл</Button></p>:null}
  {fileError?<Alert type="error" message={fileError}/>:null}
  <p>В update пустая ячейка не меняет значение; очистка указывается отдельно в clear_fields. В register/replace пустое значение неизвестно. ID и даты YYYY-MM-DD — текст. Формулы, скрытые структуры и импорт history запрещены.</p>
  <Button type="primary" disabled={!file||busy||checkBlocked} loading={busy} onClick={onCheck}>Проверить файл</Button>
  {issues.length?<><Alert type="error" message="Ошибки блокируют весь пакет. Исправьте исходную книгу и загрузите заново."/>
   <PulseTable<PassportIssue> mode="local" rows={issues} query={query} onQueryChange={next=>{setQuery(next);setPagination(previous=>({...previous,page:1}));}} schema={{fields:[{key:'row_key',label:'Строка',kind:'text',read:issue=>issue.row_key},{key:'field',label:'Поле',kind:'text',read:issue=>issue.field}],defaultSort:[],rowId:issue=>`${issue.row_key}-${issue.field}-${issue.code}`}} columns={[{key:'row_key',title:'Строка',dataIndex:'row_key'},{key:'field',title:'Поле',dataIndex:'field'},{key:'message',title:'Ошибка',render:(_,issue)=><span>{issue.message}<br/>{issue.code}</span>}]} pagination={{...pagination,onPageChange:(page,pageSize)=>setPagination({page,pageSize})}}/>
  </>:null}
 </Card>:null}</>;
}
