import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Modal, Space, Table, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useWells } from '@/hooks/useWells';
import { wellsApi } from '@/api/wells';
import type { Well } from '@/api/types';
import { toApiError } from '@/api/client';

/** Внешние идентификаторы редактируются только как связи с конкретными источниками. */
export function WellConnections({ initialWellId }: { initialWellId?: number }) {
  const wells = useWells(false,false,'all'), cache = useQueryClient(), { message } = App.useApp();
  const [editing, setEditing] = useState<Well | null>(null), [search, setSearch] = useState(''), [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{unitek_id:number|null;armits_id:number|null}>();
  const [conflict,setConflict]=useState(false);
  const [opened, setOpened] = useState(false);
  const open = (well: Well) => { setEditing(well);setConflict(false); form.setFieldsValue({unitek_id:well.unitek_id,armits_id:well.armits_id}); };
  useEffect(() => { if (!opened && initialWellId && wells.data) { const well = wells.data.find(w=>w.id===initialWellId); if (well && !well.archived_at) open(well); setOpened(true); } }, [initialWellId, wells.data, opened]);
  const save = async () => {
    const values = await form.validateFields(); if (!editing) return;
    setSaving(true);
    try {
      await wellsApi.update(editing.id,{revision:editing.revision,unitek_id:values.unitek_id ?? null,armits_id:values.armits_id ?? null});
      await cache.invalidateQueries({queryKey:['wells']});
      await cache.invalidateQueries({queryKey:['well',editing.id]});
      await cache.invalidateQueries({queryKey:['telemetry']});
      await cache.invalidateQueries({queryKey:['telemetry-bounds']});
      await cache.invalidateQueries({queryKey:['well-risk',editing.id]});
      await cache.invalidateQueries({queryKey:['ml-history',editing.id]});
      message.success('Связи с источниками сохранены'); setEditing(null);
    } catch(e) {const problem=toApiError(e);setConflict(problem.code==='conflict');message.error(problem.message);} finally {setSaving(false);}
  };
  return <Card title="Сопоставление скважин с внешними системами"><div className="pulse-stack">
    <Typography.Paragraph type="secondary">ID Pulse — постоянный идентификатор скважины в приложении. ID в Unitek и Armits относятся к конкретным источникам и используются для связи с их данными. Их можно добавить или отключить независимо от ID Pulse.</Typography.Paragraph>
    <Input.Search placeholder="Поиск по ID Pulse или номеру скважины" value={search} onChange={e=>setSearch(e.target.value)} allowClear />
    {wells.isError && <Typography.Text type="danger">{toApiError(wells.error).message}</Typography.Text>}
    <Table<Well> rowKey="id" loading={wells.isLoading} dataSource={wells.data?.filter(w=>!search || String(w.id).includes(search) || w.well_number?.includes(search))} pagination={{pageSize:20}} scroll={{x:700}} columns={[
      {title:'ID Pulse',render:(_,w)=><Link to={`/wells/${w.id}`}>{w.id}</Link>},
      {title:'№ скважины',dataIndex:'well_number',render:v=><span className="sensitive">{v ?? '—'}</span>},
      {title:'ID в Unitek',dataIndex:'unitek_id',render:v=><span className="sensitive">{v ?? 'Не связан'}</span>},
      {title:'ID в Armits',dataIndex:'armits_id',render:v=><span className="sensitive">{v ?? 'Не связан'}</span>},
      {title:'',render:(_,w)=><Button disabled={!!w.archived_at} onClick={()=>open(w)}>Настроить связи</Button>},
    ]} />
    <Modal title={`Связи скважины · ID Pulse ${editing?.id ?? ''}`} open={!!editing} onCancel={()=>setEditing(null)} onOk={save} confirmLoading={saving} okText="Сохранить" okButtonProps={{disabled:!!editing?.archived_at}}><Form form={form} layout="vertical">{conflict&&<Button onClick={async()=>{if(editing){const latest=await wellsApi.get(editing.id);open(latest);}}}>Загрузить актуальные связи</Button>}<Form.Item name="unitek_id" label="ID скважины в Unitek"><InputNumber style={{width:'100%'}} precision={0} /></Form.Item><Form.Item name="armits_id" label="ID скважины в Armits"><InputNumber style={{width:'100%'}} precision={0} /></Form.Item><Space><Typography.Text type="secondary">Пустое поле отключает связь. ID Pulse и импортированные в Pulse измерения сохраняются.</Typography.Text></Space></Form></Modal>
  </div></Card>;
}
