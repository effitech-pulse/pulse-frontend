import {useAuth} from '@/auth/AuthProvider';
import { Alert, App, Button, Card, Collapse, Input, Select, Space, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsApi, type ReviewConclusion, type ReviewState, type ReviewStatus } from '@/api/reviews';
import { toApiError } from '@/api/client';
import {usePrivateFileRequest, fileProblem} from '@/hooks/useFileJobs';

const statuses = {new: 'Новая', in_progress: 'В работе', closed: 'Завершена'};
const conclusions = {confirmed: 'Подтверждено технологом', not_confirmed: 'Результат не подтверждён', inconclusive: 'Нужны дополнительные данные'};
export function ReviewPanel({path,privateFile=false}: {path: string;privateFile?:boolean}) {
  const {canOperate,privateEpoch,capturePrivate}=useAuth();
  const privateRequest=usePrivateFileRequest();
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const key=privateFile?['review',path,privateEpoch]:['review',path];
  const {message} = App.useApp(); const client = useQueryClient();
  const [before, setBefore] = useState<number>();
  const [draft, setDraft] = useState<ReviewState>();
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{message: string; conflict: boolean}>();
  const attempt = useRef<{body: string; id: string}>();
  const savingRef = useRef(false);
  const query = useQuery({queryKey:[...key,before], queryFn:({signal}) => privateFile?privateRequest(s=>reviewsApi.get(path,before,s),signal):reviewsApi.get(path,before,signal), refetchOnWindowFocus:false});
  useEffect(() => { if (!draft && query.data) setDraft(query.data.state); }, [query.data, draft]);
  const change = (patch: Partial<ReviewState>) => setDraft(v => v ? {...v, ...patch} : v);
  async function save() {
    if (!draft || savingRef.current) return;
    const body = JSON.stringify({revision:draft.revision,status:draft.status,owner:draft.owner,conclusion:draft.conclusion,comment});
    if (attempt.current?.body !== body) attempt.current = {body, id:crypto.randomUUID()};
    savingRef.current = true; setSaving(true); setError(undefined);
    try {
      const ticket=capturePrivate();
      const input={...JSON.parse(body),request_id:attempt.current.id};
      const saved=privateFile?await privateRequest(signal=>reviewsApi.save(path,input,signal)):await reviewsApi.save(path,input);
      if(!alive.current||!ticket.current())return;
      client.setQueryData([...key,undefined], saved); setBefore(undefined); setDraft(saved.state); setComment(''); attempt.current=undefined;
      await Promise.all([client.invalidateQueries({queryKey:['ml-wells']}),client.invalidateQueries({queryKey:['ml-snapshot']}),client.invalidateQueries({queryKey:['well-risk']}),client.invalidateQueries({queryKey:['ml-health']})]);
      message.success('Изменения и комментарий сохранены');
    } catch (e) { if(!alive.current)return;const problem=toApiError(e);setError({message:privateFile?(problem.code==='conflict'?'Заключение изменилось. Ваш комментарий и настройки сохранены в черновике.':fileProblem(e).message):problem.message,conflict:problem.code==='conflict'}); }
    finally {savingRef.current=false;if(alive.current)setSaving(false);}
  }
  async function reload() {
    const ticket=capturePrivate();
    const fresh=privateFile?await privateRequest(signal=>reviewsApi.get(path,undefined,signal)):await reviewsApi.get(path);
    if(!alive.current||!ticket.current())return;
    client.setQueryData([...key,undefined],fresh); setBefore(undefined); setDraft(v=>v?{...v,revision:fresh.state.revision}:fresh.state); setError(undefined); attempt.current=undefined;
  }
  const dirty = draft && query.data && (draft.status !== query.data.state.status || draft.owner !== query.data.state.owner || draft.conclusion !== query.data.state.conclusion || comment.trim());
  return <Card title="Работа технолога с результатом" extra={query.data && <Tag>{statuses[query.data.state.status]}</Tag>}>
    <div className="pulse-stack">
      {!canOperate && <Typography.Text type="secondary">Просмотр обработки. Изменения доступны технологу.</Typography.Text>}
      {query.isLoading && <Typography.Text>Загрузка обработки…</Typography.Text>}
      {query.isError && <Alert type="error" message={privateFile?fileProblem(query.error).message:toApiError(query.error).message} action={<Button onClick={() => query.refetch()}>Повторить</Button>} />}
      {error && <Alert type="error" message={error.message} action={error.conflict ? <Button onClick={() => reload().catch(e => {if(alive.current)message.error(privateFile?fileProblem(e).message:toApiError(e).message);})}>Сверить версию</Button> : undefined} />}
      {draft && <>
        <div className="pulse-two-columns">
          <label className="pulse-stack">Ответственный<Input aria-label="Ответственный за результат" value={draft.owner} maxLength={120} disabled={saving || !canOperate} placeholder="Имя технолога" onChange={e => change({owner:e.target.value})} /></label>
          <label className="pulse-stack">Статус обработки<Select aria-label="Статус обработки результата" value={draft.status} disabled={saving || !canOperate} options={Object.entries(statuses).map(([value,label]) => ({value,label}))} onChange={(status: ReviewStatus) => change({status, conclusion:status === 'closed' ? draft.conclusion : ''})} /></label>
        </div>
        {draft.status === 'closed' && <label className="pulse-stack">Заключение технолога<Select aria-label="Заключение технолога" value={draft.conclusion || undefined} placeholder="Выберите заключение" disabled={saving || !canOperate} options={Object.entries(conclusions).map(([value,label]) => ({value,label}))} onChange={(conclusion: ReviewConclusion) => change({conclusion})} /></label>}
        <label className="pulse-stack">Комментарий<Input.TextArea aria-label="Комментарий технолога" value={comment} maxLength={4000} showCount autoSize={{minRows:2,maxRows:8}} disabled={saving || !canOperate} placeholder={draft.status === 'closed' ? 'Обоснование заключения — обязательно' : 'Наблюдения, выполненные действия или причина повторного открытия'} onChange={e => setComment(e.target.value)} /></label>
        <Space wrap><Button type="primary" onClick={save} loading={saving} disabled={!dirty || !canOperate}>Сохранить</Button><Typography.Text type="secondary">Версия записи: {draft.revision}</Typography.Text></Space>
      </>}
      {!!query.data?.events.length && <Collapse items={[{key:'history',label:`История изменений · версия ${query.data.state.revision}`,children:<div className="pulse-stack">{query.data.events.map(event => <div key={event.revision}>
        <Typography.Text strong>{new Date(event.created_at).toLocaleString('ru', {timeZone:'Europe/Moscow'})} МСК · {event.actor.name}{!event.actor.authenticated ? ' · общий доступ' : ''}</Typography.Text>
        <div><Tag>{statuses[event.before.status]} → {statuses[event.after.status]}</Tag>{event.after.owner && <Typography.Text>Ответственный: {event.after.owner}</Typography.Text>}</div>
        {event.after.conclusion && <Typography.Text strong>{conclusions[event.after.conclusion]}</Typography.Text>}
        {event.comment && <Typography.Paragraph style={{whiteSpace:'pre-wrap', marginBottom:0}}>{event.comment}</Typography.Paragraph>}
      </div>)}<Space><Button disabled={!before} onClick={() => setBefore(undefined)}>Последние</Button><Button disabled={!query.data?.has_more} onClick={() => setBefore(query.data!.events.at(-1)!.revision)}>Предыдущие изменения</Button></Space></div>}]} />}
      {query.data && !query.data.events.length && <Typography.Text type="secondary">Изменений ещё нет. Заключение технолога сохраняется отдельно от ответа модели.</Typography.Text>}
    </div>
  </Card>;
}
