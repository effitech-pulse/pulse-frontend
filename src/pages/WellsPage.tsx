import {LocalEntityTable} from '@/components/common/LocalEntityTable';
import type {EntityField} from '@/components/common/LocalEntityTable';
import {applyTableQuery} from '@/lib/tableQuery';
import {readTableState} from '@/lib/tableState';
import {useAuth} from '@/auth/AuthProvider';
import {
  App,
  Alert,
  Modal,
  Tag,
  Typography,
  Tooltip,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  UndoOutlined,
  DownloadOutlined,
  EditOutlined,
  FileSearchOutlined,
  InboxOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useState, type DragEvent, type HTMLAttributes, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { mlApi } from '@/api/ml';
import { cohortStatusLabel, mlRows } from '@/lib/mlSnapshot';
import { filterWellWorkbook } from '@/lib/wellExport';
import type { Well } from '@/api/types';
import { type WellArchive, wellsApi } from '@/api/wells';
import { toApiError } from '@/api/client';
import { useDepartments, useNgdus, useUpdateWell, useWells } from '@/hooks/useWells';
import { PageSpin } from '@/components/common/PageSpin';
import { WellImportModal } from '@/components/wells/WellImportModal';
import { AddWellModal } from '@/components/wells/AddWellModal';

const XLSX_RE = /\.(xlsx|xlsm)$/i;

type CellInput = 'text' | 'number';

interface EditableCellProps extends HTMLAttributes<HTMLElement> {
  editing: boolean;
  dataIndex: string;
  inputType: CellInput;
  children?: ReactNode;
}

function EditableCell({ editing, dataIndex, inputType, children, ...rest }: EditableCellProps) {
  return (
    <td {...rest}>
      {editing ? (
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={inputType === 'number' ? [{ required: true, message: '' }] : []}
        >
          {inputType === 'number' ? (
            <InputNumber style={{ width: '100%' }} precision={0} />
          ) : (
            <Input />
          )}
        </Form.Item>
      ) : (
        children
      )}
    </td>
  );
}

export type WellAssessmentFilter = 'all' | 'alert' | 'watch' | 'normal' | 'unscored';

export function WellsPage({ management = false, assessment = 'all' }: { management?: boolean; assessment?: WellAssessmentFilter }) {
  const {can}=useAuth();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const ml = useQuery({ enabled:can('risks.read'), queryKey: ['ml-wells'], queryFn: () => mlApi.wells(false) });
  const assessments = new Map(mlRows(ml.data).map(row => [String(row.app_well_id), row]));

  const { message } = App.useApp();
  const [form] = Form.useForm();
  const client=useQueryClient();
  const archive:WellArchive='current';
  const [editingRevision,setEditingRevision]=useState<number>();
  const [editConflict,setEditConflict]=useState(false);
  const [lifecycle,setLifecycle]=useState<{well:Well;restore:boolean}>();
  const [reason,setReason]=useState('');
  const [lifecycleError,setLifecycleError]=useState('');
  const [lifecycleConflict,setLifecycleConflict]=useState(false);
  const [changingLifecycle,setChangingLifecycle]=useState(false);
  const { data, isLoading, error } = useWells(false,false,'all');
  const departments = useDepartments();
  const ngdus = useNgdus();
  const updateWell = useUpdateWell();


  const deptLabel = (code: number): string => {
    const name = departments.data?.find((d) => d.id === code)?.name;
    return name ? `${name} (${code})` : String(code);
  };

  const ngduLabel = (code: number): string => {
    const name = ngdus.data?.find((n) => n.id === code)?.name;
    return name ? `${name} (${code})` : String(code);
  };

  const [editingKey, setEditingKey] = useState<number|string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isEditing = (well: Well) => well.id === editingKey;
  const edit = (well: Well) => {
    form.setFieldsValue(well);
    setEditingRevision(well.revision);setEditConflict(false);
    setEditingKey(well.id);
  };
  const cancel = () => {setEditingKey(null);setEditConflict(false);};
  const save = async (id: number|string) => {
    const row = await form.validateFields();
    if (row.well_number === '') row.well_number = null;
    try {await updateWell.mutateAsync({ id, data: {...row,revision:editingRevision} });setEditingKey(null);setEditConflict(false);}
    catch(e){setEditConflict(toApiError(e).code==='conflict');}
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportFile(null);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!management || !can('wells.import') || archive!=='current' || ml.data?.profile === 'cohort') return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!XLSX_RE.test(file.name)) {
      message.error('Перетащите файл Excel (.xlsx)');
      return;
    }
    setImportFile(file);
    setImportOpen(true);
  };

  const handleExport = async () => {
    if(!can('wells.export'))return;
    setExporting(true);
    try {
      let blob = await wellsApi.exportXlsx(undefined,false,'all');
      const state=readTableState(search,tableKey,tableFields,initialQuery);
      const visible=applyTableQuery(data??[],{fields:tableFields,defaultSort:[{field:'id',direction:'asc'}],rowId:r=>String(r.id)},state.query);
      blob = new Blob([filterWellWorkbook(await blob.arrayBuffer(), visible.map(well => well.id))], { type: blob.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wells-${archive}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error(toApiError(e).message);
    } finally {
      setExporting(false);
    }
  };

  const baseColumns: (ColumnsType<Well>[number] & {
    editable?: boolean;
    inputType?: CellInput;
  })[] = [
    { title: 'ID Pulse', dataIndex: 'id', key: 'id', width: 110 },
    { title: '№ скв.', dataIndex: 'well_number', key: 'well_number', editable: true, inputType: 'text',
      render: (v: string | null) => v ?? '—' },
    {title:'Ответственный',dataIndex:'responsible',key:'responsible',editable:true,inputType:'text',render:(v:string|null)=>v??'—'},
    {title:'Состояние',key:'archive',render:(_,w)=>w.archived_at?<Tag>В архиве</Tag>:<Tag color="green">В фонде</Tag>},
    { title: 'НГДУ', dataIndex: 'ngdu', key: 'ngdu', editable: true, inputType: 'number',
      render: (v: number) => ngduLabel(v) },
    { title: 'Цех', dataIndex: 'department', key: 'department', editable: true, inputType: 'number',
      render: (v: number) => deptLabel(v) },
    {
      title: 'Активна',
      dataIndex: 'active',
      key: 'active',
      width: 90,
      render: (active: boolean, well: Well) => (
        <Switch
          checked={active}
          disabled={!can('wells.update') || !!well.archived_at || isEditing(well)}
          onChange={(checked) => updateWell.mutate({ id: well.id, data: { active: checked,revision:well.revision } })}
        />
      ),
    },
    {
      title: '',
      key: 'op',
      width: 140,
      render: (_: unknown, well: Well) =>
        isEditing(well) ? (
          <Space>
            <Button type="primary" size="small" icon={<CheckOutlined />} loading={updateWell.isPending}
              onClick={() => save(well.id)} />
            <Button size="small" icon={<CloseOutlined />} onClick={cancel} />
          </Space>
        ) : (
          <Space>
            <Button aria-label={`Открыть карточку ID Pulse ${well.id}`} size="small" icon={<FileSearchOutlined />} onClick={() => navigate(`/wells/${well.id}`)} />
            <Button size="small" icon={<EditOutlined />} disabled={!can('wells.update') || !!well.archived_at || editingKey !== null} onClick={() => edit(well)} />
            <Button aria-label={`${well.archived_at?'Восстановить':'В архив'} ID Pulse ${well.id}`} disabled={!can(well.archived_at?'wells.restore':'wells.archive') || editingKey!==null} size="small" icon={well.archived_at?<UndoOutlined />:<InboxOutlined />} onClick={()=>{setLifecycle({well,restore:!!well.archived_at});setReason('');setLifecycleError('');setLifecycleConflict(false);}} />
          </Space>
        ),
    },
  ];

  const columns: ColumnsType<Well> = baseColumns.map((col) => {
    if (!col.editable) return col;
    const dataIndex = (col as { dataIndex: string }).dataIndex;
    const inputType: CellInput = col.inputType ?? 'text';
    return {
      ...col,
      onCell: (record: Well) =>
        ({ editing: isEditing(record), dataIndex, inputType }) as unknown as HTMLAttributes<HTMLElement>,
    };
  });

  async function reloadEdit(){if(editingKey===null)return;try{const latest=await wellsApi.get(editingKey);if(latest.archived_at){cancel();message.info('Скважина перенесена в архив. Сначала восстановите её.');return;}form.setFieldsValue(latest);setEditingRevision(latest.revision);setEditConflict(false);}catch(e){message.error(toApiError(e).message);}}
  async function saveLifecycle(){
    if(!lifecycle || !can(lifecycle.restore?'wells.restore':'wells.archive') || changingLifecycle)return;if(!reason.trim()){setLifecycleError('Укажите причину');return;}setChangingLifecycle(true);setLifecycleError('');
    try{await (lifecycle.restore?wellsApi.restore(lifecycle.well,reason):wellsApi.archive(lifecycle.well,reason));setLifecycle(undefined);await Promise.all(['wells','well','well-history','ml-wells','incident-stats','table'].map(key=>client.invalidateQueries({queryKey:[key]})));message.success(lifecycle.restore?'Скважина восстановлена с прежним ID Pulse':'Скважина перенесена в архив');}
    catch(e){const problem=toApiError(e);setLifecycleError(problem.message);setLifecycleConflict(problem.code==='conflict');}finally{setChangingLifecycle(false);}
  }
  const monitorColumns: ColumnsType<Well> = [
    { title: 'Скважина', key: 'well', width: 180, render: (_, well) => <Link to={`/wells/${well.id}${assessments.get(String(well.id))?.run_id != null ? `?run_id=${assessments.get(String(well.id))!.run_id}` : ''}`}>№ {well.well_number ?? '—'}<small className="pulse-cell-meta">ID Pulse {well.id}</small></Link> },
    { title: 'Цех', key: 'department', width: 150, render: (_, well) => <span className="sensitive">{deptLabel(well.department)}</span> },
    { title: 'Оценка модели', key: 'assessment', width: 180, render: (_, well) => { const result = assessments.get(String(well.id)); return <span className={result?.risk == null ? 'pulse-muted' : result.tier === 'alert' ? 'pulse-danger' : result.tier === 'watch' ? 'pulse-warning' : 'pulse-success'}>{result ? cohortStatusLabel(result) : ml.isError ? 'Не удалось загрузить' : ml.isLoading ? 'Загрузка…' : 'Без оценки'}</span>; } },
    { title: 'Режим / данные', key: 'data', render: (_, well) => { const result = assessments.get(String(well.id)); return <>{well.active ? 'Активна в реестре' : 'Неактивна в реестре'}<small className="pulse-cell-meta">{result?.data_ok === false ? 'В последнем окне есть пропуски' : result?.data_ok === true ? 'Последнее окно полное' : 'Качество окна неизвестно'}</small></>; } },
    { title: 'Период данных', key: 'updated', width: 145, render: (_, well) => { const date = assessments.get(String(well.id))?.window_end; return date ? dayjs(date).format('DD.MM.YYYY') : '—'; } },
    { title: 'Действие', key: 'open', width: 110, align: 'right', render: (_, well) => <Link to={`/wells/${well.id}${assessments.get(String(well.id))?.run_id != null ? `?run_id=${assessments.get(String(well.id))!.run_id}` : ''}`}>Открыть</Link> },
  ];
  const tableKey=management?'wells-management':'wells-monitor';
  const tableFields:EntityField<Well>[]=[
   {key:'id',label:'ID Pulse',column:management?'ID Pulse':'Скважина',kind:'pulseId',read:r=>r.id},
   {key:'well_number',label:'№ скважины',column:management?'№ скв.':'Скважина',primary:true,kind:'text',read:r=>r.well_number},
   {key:'ngdu',label:'НГДУ',kind:'enum',options:ngdus.data?.map(r=>({value:r.id,label:ngduLabel(r.id)})),read:r=>r.ngdu},
   {key:'department',label:'Цех',kind:'enum',options:departments.data?.map(r=>({value:r.id,label:deptLabel(r.id)})),read:r=>r.department},
   {key:'archive',label:management?'Состояние':'Архив',kind:'boolean',read:r=>!!r.archived_at},
   ...(management?[
    {key:'responsible',label:'Ответственный',kind:'text' as const,read:(r:Well)=>r.responsible},
    {key:'active',label:'Активна',kind:'boolean' as const,read:(r:Well)=>r.active},
   ]:[
    {key:'assessment',label:'Оценка модели',kind:'enum' as const,options:[{value:0,label:'Норма'},{value:1,label:'Наблюдение'},{value:2,label:'Тревога'},{value:null,label:'Без оценки'}],read:(r:Well)=>{const v=assessments.get(String(r.id));return v?.risk==null?null:v.tier==='alert'?2:v.tier==='watch'?1:0;}},
    {key:'active',label:'Активность',column:'Режим / данные',primary:true,kind:'boolean' as const,read:(r:Well)=>r.active},
    {key:'data_ok',label:'Полнота окна',column:'Режим / данные',kind:'boolean' as const,read:(r:Well)=>assessments.get(String(r.id))?.data_ok??null},
    {key:'window_end',label:'Период данных',kind:'datetime' as const,read:(r:Well)=>assessments.get(String(r.id))?.window_end??null},
   ]),
  ];
  const initialQuery={version:1 as const,sort:[],filters:[{field:'archive',op:'in' as const,values:[false]},
   ...(management?[{field:'active',op:'in' as const,values:[true]}]:[]),
   ...(!management&&assessment!=='all'?[{field:'assessment',op:'in' as const,values:[assessment==='alert'?2:assessment==='watch'?1:assessment==='normal'?0:null]}]:[])]};
  const monitorExtra=[{title:'НГДУ',key:'ngdu',render:(_:unknown,r:Well)=>ngduLabel(r.ngdu)},{title:'Архив',key:'archive',render:(_:unknown,r:Well)=>r.archived_at?'В архиве':'В фонде'}];
  return (
    <div className="pulse-wells-table"
      style={{ position: 'relative' }}
      onDragOver={(e) => {
        e.preventDefault();
        if (management && can('wells.import') && ml.data?.profile !== 'cohort' && !dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      {editConflict&&<Alert type="warning" showIcon message="Карточка изменилась в другом сеансе" description="Ваши изменения ещё не сохранены. Скопируйте нужный текст, затем загрузите актуальные реквизиты." action={<Button onClick={()=>reloadEdit()}>Загрузить актуальную карточку</Button>} style={{marginBottom:16}} />}
      {ml.isError && !management && <Alert type="error" message="Не удалось загрузить оценки модели" description={toApiError(ml.error).message} action={<Button onClick={() => void ml.refetch()}>Повторить</Button>} />}
      <Card
        className="pulse-registry-card"
        extra={
          <Space wrap>
            {management && can('wells.create') && <Tooltip title={ml.data?.profile === 'cohort' ? 'Состав задаёт Pulse Connector' : undefined}><span><Button disabled={archive!=='current' || ml.isLoading || ml.data?.profile === 'cohort'} icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Добавить
            </Button></span></Tooltip>}
            {management && can('wells.import') && <Tooltip title={ml.data?.profile === 'cohort' ? 'Состав задаёт Pulse Connector' : undefined}><span><Button disabled={archive!=='current' || ml.isLoading || ml.data?.profile === 'cohort'} type="primary" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Импорт из Excel
            </Button></span></Tooltip>}
            <Button disabled={!can('wells.export') || (!management && assessment !== 'all' && (!ml.isSuccess || isLoading || !!error))} icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
              Экспорт в Excel
            </Button>
          </Space>
        }
      >
        <PageSpin loading={isLoading} error={error}>
          <Form form={form} component={false}>
            <LocalEntityTable<Well> tableKey={tableKey} fields={tableFields} initialQuery={initialQuery} defaultSort={[{field:'id',direction:'asc'}]}
              rowKey="id"
              loading={!management && ml.isLoading}
              scroll={{x:management ? 1100 : 950}}
              components={{ body: { cell: EditableCell } }}
              columns={management ? columns : [...monitorColumns.slice(0,1),...monitorExtra,...monitorColumns.slice(1)]}
              dataSource={data ?? []}
              size="middle"

            />
          </Form>
        </PageSpin>
      </Card>

      {!management && <p className="pulse-list-note">При возврате из карточки сохраняются фильтры и страница списка. Активность в реестре не подтверждает текущую работу установки.</p>}
      {dragging && management && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(22,119,255,0.06)',
            border: '2px dashed #1677ff',
            borderRadius: 8,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <InboxOutlined style={{ fontSize: 40, color: '#1677ff' }} />
          <span style={{ color: '#1677ff', fontWeight: 600 }}>Отпустите файл .xlsx для импорта</span>
        </div>
      )}

      <Modal title={lifecycle?.restore?'Восстановить скважину':'Перенести скважину в архив'} open={!!lifecycle} onCancel={()=>{if(!changingLifecycle)setLifecycle(undefined);}} onOk={()=>saveLifecycle()} confirmLoading={changingLifecycle} okText={lifecycle?.restore?'Восстановить':'В архив'} cancelText="Отмена">
        <div className="pulse-stack"><Typography.Text>ID Pulse {lifecycle?.well.id}. Телеметрия, проверки и заключения сохраняются. Флаг «Активна» не меняется.</Typography.Text>
        {lifecycleError&&<Alert type="warning" message={lifecycleError} />}
        {lifecycleConflict&&<Button onClick={async()=>{if(lifecycle){try{const latest=await wellsApi.get(lifecycle.well.id);setLifecycle({...lifecycle,well:latest});setLifecycleConflict(false);setLifecycleError((!!latest.archived_at)===!lifecycle.restore?'Состояние уже изменено. Закройте это окно.':'Проверьте актуальное состояние и повторите действие.');}catch(e){message.error(toApiError(e).message);}}}}>Обновить версию карточки</Button>}
        <label className="pulse-stack">Причина<Input.TextArea aria-label="Причина изменения состояния скважины" value={reason} maxLength={1000} showCount autoSize={{minRows:2,maxRows:6}} disabled={changingLifecycle} onChange={e=>setReason(e.target.value)} /></label>
        <Typography.Text type="secondary">Причина и автор будут сохранены в истории карточки. Версия: {lifecycle?.well.revision}</Typography.Text></div>
      </Modal>
      <WellImportModal open={importOpen} onClose={closeImport} initialFile={importFile} />
      <AddWellModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
