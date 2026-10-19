import {useAuth} from '@/auth/AuthProvider';
import {
  App,
  Alert,
  Modal,
  Segmented,
  Tag,
  Typography,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
  Table,
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
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Well } from '@/api/types';
import { type WellArchive, wellsApi } from '@/api/wells';
import { toApiError } from '@/api/client';
import { useDepartments, useNgdus, useUpdateWell, useWells } from '@/hooks/useWells';
import {useFundFilters} from '@/theme/FundFilters';
import { useFund } from '@/theme/FundProvider';
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

export function WellsPage() {
  const {isAdmin}=useAuth();
  const navigate = useNavigate();
  const {fund} = useFund();
  const {filters}=useFundFilters();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const client=useQueryClient();
  const [archive,setArchive]=useState<WellArchive>('current');
  const [editingRevision,setEditingRevision]=useState<number>();
  const [editConflict,setEditConflict]=useState(false);
  const [lifecycle,setLifecycle]=useState<{well:Well;restore:boolean}>();
  const [reason,setReason]=useState('');
  const [lifecycleError,setLifecycleError]=useState('');
  const [lifecycleConflict,setLifecycleConflict]=useState(false);
  const [changingLifecycle,setChangingLifecycle]=useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const activeOnly=archive==='current'&&!showInactive;
  const { data, isLoading, error } = useWells(activeOnly,true,archive);
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

  const [editingKey, setEditingKey] = useState<number | null>(null);
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
  const save = async (id: number) => {
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
    if (!isAdmin || archive!=='current') return;
    if (fund === 'presentation') { message.info('Показательный фонд формируется в Pulse Data'); return; }
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
    setExporting(true);
    try {
      const blob = await wellsApi.exportXlsx(fund,filters,activeOnly,archive);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wells-${fund}-${archive}.xlsx`;
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
          disabled={!isAdmin || !!well.archived_at || isEditing(well)}
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
            <Button size="small" icon={<EditOutlined />} disabled={!isAdmin || !!well.archived_at || editingKey !== null} onClick={() => edit(well)} />
            <Button aria-label={`${well.archived_at?'Восстановить':'В архив'} ID Pulse ${well.id}`} disabled={!isAdmin || editingKey!==null} size="small" icon={well.archived_at?<UndoOutlined />:<InboxOutlined />} onClick={()=>{setLifecycle({well,restore:!!well.archived_at});setReason('');setLifecycleError('');setLifecycleConflict(false);}} />
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
    if(!lifecycle || changingLifecycle)return;if(!reason.trim()){setLifecycleError('Укажите причину');return;}setChangingLifecycle(true);setLifecycleError('');
    try{await (lifecycle.restore?wellsApi.restore(lifecycle.well,reason):wellsApi.archive(lifecycle.well,reason));setLifecycle(undefined);await Promise.all(['wells','well','well-history','presentation-summary','ml-wells','incident-stats'].map(key=>client.invalidateQueries({queryKey:[key]})));message.success(lifecycle.restore?'Скважина восстановлена с прежним ID Pulse':'Скважина перенесена в архив');}
    catch(e){const problem=toApiError(e);setLifecycleError(problem.message);setLifecycleConflict(problem.code==='conflict');}finally{setChangingLifecycle(false);}
  }
  return (
    <div
      style={{ position: 'relative' }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      {editConflict&&<Alert type="warning" showIcon message="Карточка изменилась в другом сеансе" description="Ваши изменения ещё не сохранены. Скопируйте нужный текст, затем загрузите актуальные реквизиты." action={<Button onClick={()=>reloadEdit()}>Загрузить актуальную карточку</Button>} style={{marginBottom:16}} />}
      <Card
        extra={
          <Space wrap>
            <Segmented aria-label="Состояние реестра" value={archive} onChange={value=>{setArchive(value as WellArchive);cancel();}} options={[{value:'current',label:'Текущие'},{value:'archived',label:'Архив'},{value:'all',label:'Все'}]} />
            <Switch
              disabled={archive!=='current'}
              checkedChildren="все"
              unCheckedChildren="активные"
              checked={showInactive}
              onChange={setShowInactive}
            />
            <Button disabled={!isAdmin || archive!=='current' || fund === 'presentation'} icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Добавить
            </Button>
            <Button disabled={!isAdmin || archive!=='current' || fund === 'presentation'} type="primary" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Импорт из Excel
            </Button>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
              Экспорт в Excel
            </Button>
          </Space>
        }
      >
        <PageSpin loading={isLoading} error={error}>
          <Form form={form} component={false}>
            <Table
              rowKey="id"
              scroll={{x:1100}}
              components={{ body: { cell: EditableCell } }}
              columns={columns}
              dataSource={data ?? []}
              size="middle"
              pagination={{ pageSize: 20 }}
            />
          </Form>
        </PageSpin>
      </Card>

      {dragging && (
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
