import { Button, Card, Select, Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { WellsPage, type WellAssessmentFilter } from '@/pages/WellsPage';
import { FundFilterBar } from '@/components/layout/FundFilterBar';
import { NgduPanel } from '@/components/structure/NgduPanel';
import { DepartmentsPanel } from '@/components/structure/DepartmentsPanel';

export function StructurePage() {
  const { can, canAny } = useAuth();
  const canWells=can('wells.read'),canReferences=can('references.read');
  const canManage = canReferences || canAny(['wells.create'],['wells.update'],['wells.import'],['wells.archive'],['wells.restore']);
  const [search, setSearch] = useSearchParams();
  const management = !canWells && canReferences || canManage && search.get('view') === 'manage';
  const rawAssessment = search.get('assessment');
  const assessment: WellAssessmentFilter = ['alert', 'watch', 'normal', 'unscored'].includes(rawAssessment ?? '') ? rawAssessment as WellAssessmentFilter : 'all';
  const setAssessment = (value: WellAssessmentFilter) => { const next = new URLSearchParams(search); if (value === 'all') next.delete('assessment'); else next.set('assessment', value); next.delete('page'); setSearch(next, { replace: true }); };
  return <div className="pulse-stack pulse-registry">
    <div className="pulse-page-heading pulse-toolbar">
      <div><h1>{canWells?'Скважины':'Справочники'}</h1><p>{management ? 'Учёт фонда, распределение ответственности и контроль изменений' : 'Найдите объект по номеру, подразделению или идентификатору'}</p></div>
      {canManage && canWells && <Button aria-pressed={management} onClick={() => { const next = new URLSearchParams(search); if (management) next.delete('view'); else next.set('view', 'manage'); setSearch(next); }}>{management ? 'К мониторингу' : 'Управление фондом'}</Button>}
    </div>
    {canWells && <FundFilterBar hasExtraFilters={assessment !== 'all'} onReset={() => setAssessment('all')}>
      {!management && <label className="pulse-filter-field"><span>Оценка</span><Select aria-label="Оценка модели" value={assessment} onChange={setAssessment} options={[{value:'all',label:'Все состояния'},{value:'alert',label:'Тревога'},{value:'watch',label:'Наблюдение'},{value:'normal',label:'Норма'},{value:'unscored',label:'Без оценки'}]} /></label>}
    </FundFilterBar>}
    {management ? <Tabs className="pulse-management-tabs" defaultActiveKey={canWells?"wells":"ngdu"} items={[
      ...(canWells?[{ key: 'wells', label: 'Реестр и архив', children: <WellsPage management /> }]:[]),
      ...(can('references.read') ? [{ key: 'ngdu', label: 'НГДУ', children: <Card><NgduPanel /></Card> },
      { key: 'departments', label: 'Цеха', children: <Card><DepartmentsPanel /></Card> }] : []),
    ]} /> : <WellsPage assessment={assessment} />}
  </div>;
}
