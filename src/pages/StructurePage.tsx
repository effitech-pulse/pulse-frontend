import { Button, Card, Tabs } from 'antd';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { WellsPage, type WellAssessmentFilter } from '@/pages/WellsPage';
import { NgduPanel } from '@/components/structure/NgduPanel';
import { DepartmentsPanel } from '@/components/structure/DepartmentsPanel';

export function StructurePage() {
  const { can, canAny } = useAuth();
  const canWells=can('wells.read'),canReferences=can('references.read');
  const canManage = canReferences || canAny(['wells.create'],['wells.update'],['wells.import'],['wells.archive'],['wells.restore']);
  const [search] = useSearchParams();
  const location=useLocation(),navigate=useNavigate();
  const management = !canWells && canReferences || canManage && search.get('view') === 'manage';
  const rawAssessment = search.get('assessment');
  const assessment: WellAssessmentFilter = ['alert', 'watch', 'normal', 'unscored'].includes(rawAssessment ?? '') ? rawAssessment as WellAssessmentFilter : 'all';
  return <div className="pulse-stack pulse-registry">
    <div className="pulse-page-heading pulse-toolbar">
      <div><h1>{canWells?'Скважины':'Справочники'}</h1><p>{management ? 'Учёт фонда, распределение ответственности и контроль изменений' : 'Найдите объект по номеру, подразделению или идентификатору'}</p></div>
      {canManage && canWells && <Button aria-pressed={management} onClick={() => { const next = new URLSearchParams(search); if (management) next.delete('view'); else next.set('view', 'manage'); navigate({pathname:location.pathname,search:next.toString(),hash:location.hash},{state:location.state}); }}>{management ? 'К мониторингу' : 'Управление фондом'}</Button>}
    </div>
    {management ? <Tabs className="pulse-management-tabs" defaultActiveKey={canWells?"wells":"ngdu"} items={[
      ...(canWells?[{ key: 'wells', label: 'Реестр и архив', children: <WellsPage management /> }]:[]),
      ...(can('references.read') ? [{ key: 'ngdu', label: 'НГДУ', children: <Card><NgduPanel /></Card> },
      { key: 'departments', label: 'Цеха', children: <Card><DepartmentsPanel /></Card> }] : []),
    ]} /> : <WellsPage assessment={assessment} />}
  </div>;
}
