import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassportDraft, reducePassportDraft, toPassportChangeSet, normalizePassportDecimal, passportDiffFields} from '../src/lib/equipmentPassportDraft.ts';
const row={row_key:'manual-1',well_id:'9007199254740993',expected_well_revision:'9007199254740994',expected_passport_revision:'7',slot:'control_station',action:'update',component_id:'9007199254740995',installation_id:'9007199254740996',change_reason:'Уточнение',source_reference:''};
const preview={id:'99',digest:'a'.repeat(64),expires_at:'2026-10-24T13:00:00Z',commands:{schema_version:'equipment-passport-v1',rows:[row]},diff:[],issues:[],changed_count:1,unchanged_count:0};
test('serialization keeps omission, deliberate null, zero and exact identifiers',()=>{
 let s=createPassportDraft([row]);
 s=reducePassportDraft(s,{type:'change',rowKey:'manual-1',field:'control_output_frequency_min_hz',value:'000,000000'});
 s=reducePassportDraft(s,{type:'clear',rowKey:'manual-1',field:'serial_number'});
 const wire=JSON.parse(JSON.stringify(toPassportChangeSet(s))).rows[0];
 assert.equal(wire.well_id,'9007199254740993');assert.equal(wire.expected_well_revision,'9007199254740994');
 assert.equal(wire.control_output_frequency_min_hz,'0');assert.equal(wire.serial_number,null);assert.equal(Object.hasOwn(wire,'model'),false);
});
test('decimal normalization never uses binary floating point or accepts exponent',()=>{
 assert.equal(normalizePassportDecimal('000123456789.123456'),'123456789.123456');
 for(const value of ['1e3','+1','NaN','1.1234567','1000000001','-1'])assert.throws(()=>normalizePassportDecimal(value));
});
test('stage count alone becomes bounded integer; empty edit requires explicit clear',()=>{
 let s=createPassportDraft([{...row,slot:'pump'}]);s=reducePassportDraft(s,{type:'change',rowKey:'manual-1',field:'pump_stage_count',value:'240'});
 assert.equal(toPassportChangeSet(s).rows[0].pump_stage_count,240);
 s=reducePassportDraft(s,{type:'change',rowKey:'manual-1',field:'model',value:''});assert.throws(()=>toPassportChangeSet(s),/очист/i);
});
test('close requires deliberate date or unknown; linked correction sends one boundary',()=>{
 assert.throws(()=>toPassportChangeSet(createPassportDraft([{...row,action:'close'}])),/дат/i);
 let s=createPassportDraft([{...row,action:'correct',linked_installation_id:'9007199254740997'}]);
 s=reducePassportDraft(s,{type:'clear',rowKey:'manual-1',field:'replacement_on'});
 const wire=toPassportChangeSet(s).rows[0];assert.equal(wire.replacement_on,null);assert.equal(Object.hasOwn(wire,'removed_on'),false);assert.equal(Object.hasOwn(wire,'installed_on'),false);
});
test('conflict retains intention; network retry keeps key; editing invalidates receipt',()=>{
 let s=createPassportDraft([row]);s=reducePassportDraft(s,{type:'preview',version:s.version,preview,idempotencyKey:'uuid-one'});
 const retry=reducePassportDraft(s,{type:'retry'});assert.equal(retry.preview.id,'99');assert.equal(retry.idempotencyKey,'uuid-one');
 const conflict=reducePassportDraft(s,{type:'conflict'});assert.deepEqual(conflict.rows,[row]);assert.equal(conflict.preview,null);
 const edit=reducePassportDraft(s,{type:'change',rowKey:'manual-1',field:'model',value:'Новая'});assert.equal(edit.preview,null);assert.equal(edit.idempotencyKey,null);
});
test('private reset blocks late preview/receipt and clears every private value',()=>{
 const initial=createPassportDraft([row]);const cleared=reducePassportDraft(initial,{type:'private_reset'});
 assert.deepEqual(cleared.rows,[]);assert.equal(cleared.receipt,null);
 assert.equal(reducePassportDraft(cleared,{type:'preview',version:initial.version,preview,idempotencyKey:'old'}),cleared);
 assert.equal(reducePassportDraft(cleared,{type:'commit',version:initial.version,receipt:{id:'1'}}),cleared);
});
test('replacement and linked diff include both full episodes, unknowns and provisional identities',()=>{
 const old={id:'4012',component_id:'3017',slot:'pump',status:'current',installed_on:'2025-01-01',removed_on:null,predecessor_id:null,attributes:{model:'A',serial_number:null,pump_nominal_flow_m3_day:'80'}};
 const diff={row_key:'1',well_id:'1',slot:'pump',action:'replace',before:[old],after:[{...old,status:'closed',removed_on:null},{...old,id:null,component_id:null,status:'current',installed_on:null,predecessor_id:'4012',attributes:{model:'B'}}]};
 const fields=passportDiffFields(diff);assert.ok(fields.some(f=>f.field==='id'&&f.after==='Создаст сервер'));assert.ok(fields.some(f=>f.field==='model'&&f.after==='B'));assert.ok(fields.some(f=>f.field==='status'&&f.before==='current'&&f.after==='closed'));
 assert.ok(fields.some(f=>f.field==='pump_stage_count'&&f.after==='Не указано'));
});
test('foreign-slot clear and action-forbidden patches cannot reach HTTP',()=>{
 assert.throws(()=>toPassportChangeSet(createPassportDraft([{...row,pump_nominal_head_m:null}])),/слот/i);
 assert.throws(()=>toPassportChangeSet(createPassportDraft([{...row,action:'void',model:'X'}])),/действ/i);
 assert.throws(()=>toPassportChangeSet(createPassportDraft([{...row,action:'update',replacement_on:null}])),/действ/i);
});
test('canonical int64 identifiers reject numeric JSON, zero identities and overflow',()=>{
 for(const well_id of [9007199254740992,'0','01','9223372036854775808'])assert.throws(()=>toPassportChangeSet(createPassportDraft([{...row,well_id}])));
});
test('blank create/replace attributes are unknown, while blank patch produces field-linked issue',()=>{
 const registered=toPassportChangeSet(createPassportDraft([{...row,action:'register',component_id:undefined,installation_id:undefined,model:'A',serial_number:''}])).rows[0];
 assert.equal(registered.serial_number,null);
 try{toPassportChangeSet(createPassportDraft([{...row,control_rated_power_kw:'1e9'}]));assert.fail('must reject');}catch(error){assert.equal(error.issues?.[0].field,'control_rated_power_kw');assert.equal(error.issues?.[0].row_key,'manual-1');}
});
test('409 requires explicit reread even after editing; a refreshed basis releases preview',()=>{
 const conflict=reducePassportDraft(createPassportDraft([row]),{type:'conflict'});
 const edited=reducePassportDraft(conflict,{type:'change',rowKey:'manual-1',field:'model',value:'Исправлено'});
 assert.equal(edited.conflict,true);
 const reread=reducePassportDraft(edited,{type:'begin',rows:[{...edited.rows[0],expected_passport_revision:'8'}]});
 assert.equal(reread.conflict,false);assert.equal(reread.rows[0].model,'Исправлено');
});

import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadDependency} from './load-dependency.mjs';
test('full React diff renders both replacement episodes with readable statuses and unknown values',()=>{
 const {PassportFullDiff}=loadDependency('@/components/equipment/EquipmentPassportPreview',new URL('../src/components/equipment/EquipmentPassportPreview.tsx',import.meta.url).pathname);
 const before={id:'4012',component_id:'3017',slot:'pump',status:'current',installed_on:'2025-01-01',removed_on:null,predecessor_id:null,attributes:{model:'A'}};
 const html=renderToStaticMarkup(React.createElement(PassportFullDiff,{diff:{row_key:'1',well_id:'9007199254740993',slot:'pump',action:'replace',before:[before],after:[{...before,status:'closed'},{...before,id:null,component_id:null,predecessor_id:'4012',attributes:{model:'Новая модель'}}]}}));
 assert.match(html,/Текущая/);assert.match(html,/Закрыта/);assert.match(html,/Новая модель/);assert.match(html,/Создаст сервер/);assert.match(html,/Число ступеней/);assert.match(html,/Не указано/);
});
test('manual close form explains released slot and never offers attribute editing',()=>{
 const {EquipmentPassportEditor}=loadDependency('@/components/equipment/EquipmentPassportEditor',new URL('../src/components/equipment/EquipmentPassportEditor.tsx',import.meta.url).pathname);
 const html=renderToStaticMarkup(React.createElement(EquipmentPassportEditor,{row:{...row,action:'close'},issues:[],busy:false,checkBlocked:false,onEvent:()=>{},onCheck:()=>{},onCancel:()=>{}}));
 assert.match(html,/слот останется без текущих сведений/);assert.match(html,/Дата снятия/);assert.doesNotMatch(html,/id="passport-model"/);
});

// Exercises the actual panel's permission branch and menu handlers; only hooks/network
// are bounded so a missing history permission cannot be replaced by a history lookup.
function currentActionsScenario({update=true,history=false,archived=false,blocked=false}={}){
 const state=[];let cursor=0;const queries=[];
 const hooks={...React,useEffect:()=>{},useCallback:fn=>fn,
  useState(initial){const i=cursor++;if(!state[i])state[i]={value:typeof initial==='function'?initial():initial};return [state[i].value,value=>{state[i].value=typeof value==='function'?value(state[i].value):value;}];},
  useRef(initial){const i=cursor++;if(!state[i])state[i]={value:{current:initial}};return state[i].value;},
  useReducer(reducer,arg,init){const i=cursor++;if(!state[i])state[i]={value:init(arg)};return [state[i].value,event=>{state[i].value=reducer(state[i].value,event);}];},
 };
 const installation={id:'9007199254740996',component_id:'9007199254740995',slot:'pump',status:'current',installed_on:null,removed_on:null,predecessor_id:'9007199254740997',attributes:{model:'Текущий насос'}};
 const permissions=new Set(['equipment_passports.read',...(update?['equipment_passports.update']:[]),...(history?['equipment_passports.history.read']:[])]);
 const boundaries={react:hooks,'@/auth/AuthProvider':{useAuth:()=>({mode:'local',principal:{mechanism:'session',access_model:'rbac_v1'},privateEpoch:3,privateBlocked:blocked,can:key=>permissions.has(key),capturePrivate:()=>({current:()=>true})})},
  '@tanstack/react-query':{useQueryClient:()=>({}),useQuery:options=>{queries.push(options);return {data:options.queryKey[0]==='equipment-passport'?{revision:'9007199254740994',well_revision:'9007199254740998',slots:[installation],provenance:[]}:{archived_at:archived?'2026-10-25T00:00:00Z':null}};}},
  '@/api/client':{apiClient:{get:()=>assert.fail('entry must not perform HTTP')},toApiError:error=>error},
  '@/api/equipmentPassports':{readEquipmentPassportHistory:()=>assert.fail('history lookup without permission')},
 };
 const {EquipmentPassportPanel}=loadDependency('@/components/equipment/EquipmentPassportPanel',new URL('../src/components/equipment/EquipmentPassportPanel.tsx',import.meta.url).pathname,boundaries);
 const render=()=>{cursor=0;return EquipmentPassportPanel({wellId:'9007199254740993'});};
 const nodes=tree=>{const result=[];function visit(node){React.Children.forEach(node,child=>{if(React.isValidElement(child)){result.push(child);visit(child.props.children);}});}visit(tree);return result;};
 return {render,nodes,queries,installation};
}
test('current correct/void enter existing reason and preview flow without history permission or lookup',()=>{
 for(const action of ['correct','void']){
  const view=currentActionsScenario();const tree=view.nodes(view.render());
  const recordRow=tree.find(node=>node.props.role==='group'&&node.props['aria-label']==='Действия с текущей записью: Насос');
  assert.ok(recordRow,'current update and More must share the first action row');
  const recordActions=React.Children.toArray(recordRow.props.children);
  assert.equal(recordActions.length,2);
  assert.equal(recordActions[0].props.children,'Исправить сведения');
  assert.equal(recordActions[1].props.children.props.children,'Ещё');
  const equipmentRow=tree.find(node=>node.props.role==='group'&&node.props['aria-label']==='Действия с оборудованием: Насос');
  assert.ok(equipmentRow,'physical actions must occupy their own second row');
  assert.deepEqual(React.Children.toArray(equipmentRow.props.children).map(node=>node.props.children),['Заменить','Снять']);
  const renderedRows=renderToStaticMarkup(React.createElement(React.Fragment,null,recordRow,equipmentRow));
  assert.ok(renderedRows.indexOf('Исправить сведения')<renderedRows.indexOf('>Ещё<'));
  assert.ok(renderedRows.indexOf('>Ещё<')<renderedRows.indexOf('>Заменить<'),'rendered/Tab order keeps More before physical actions');
  const menus=tree.filter(node=>node.props.menu?.items?.some(item=>item.key==='correct'));
  assert.equal(menus.length,1,'only the populated current slot offers record actions');
  assert.deepEqual(menus[0].props.menu.items.map(item=>[item.key,item.label,!!item.danger]),[['correct','Исправить запись',false],['void','Отметить запись ошибочной',true]]);
  menus[0].props.menu.onClick({key:action});
  const editor=view.nodes(view.render()).find(node=>node.type.name==='EquipmentPassportEditor');
  assert.ok(editor,'menu opens the existing editor before any write');
  assert.deepEqual(editor.props.row,{row_key:'manual-1',well_id:'9007199254740993',expected_well_revision:'9007199254740998',expected_passport_revision:'9007199254740994',slot:'pump',action,change_reason:'',source_reference:'',component_id:'9007199254740995',installation_id:'9007199254740996'});
  assert.equal(editor.props.original.id,'9007199254740996');assert.equal(editor.props.linkedId,undefined,'current entry cannot infer closed/linked history');
  const {EquipmentPassportEditor}=loadDependency('@/components/equipment/EquipmentPassportEditor',new URL('../src/components/equipment/EquipmentPassportEditor.tsx',import.meta.url).pathname);
  const form=renderToStaticMarkup(React.createElement(EquipmentPassportEditor,editor.props));
  assert.match(form,/id="passport-change_reason"/);assert.match(form,/Причина изменения/);assert.match(form,/type="submit"/);
  assert.ok(view.queries.every(query=>['equipment-passport','equipment-passport-well'].includes(query.queryKey[0])));
  assert.ok(!tree.some(node=>node.props.children==='История оборудования'));
 }
});
test('current record menu is hidden for read-only, archive and revoked access',()=>{
 for(const options of [{update:false},{archived:true},{blocked:true}]){
  const view=currentActionsScenario(options);
  assert.ok(!view.nodes(view.render()).some(node=>node.props.menu?.items?.some(item=>item.key==='correct')),JSON.stringify(options));
 }
});

test('invalid zero-count preview blocks correction instead of promising a valid no-op receipt',()=>{
 const {EquipmentPassportPreview}=loadDependency('@/components/equipment/EquipmentPassportPreview',new URL('../src/components/equipment/EquipmentPassportPreview.tsx',import.meta.url).pathname);
 const render=issues=>renderToStaticMarkup(React.createElement(EquipmentPassportPreview,{preview:{...preview,expires_at:'2099-01-01T00:00:00Z',commands:{schema_version:'equipment-passport-v1',rows:[{...row,action:'void',change_reason:''}]},diff:[],changed_count:0,unchanged_count:issues.length?0:1,issues},busy:false,ambiguous:false,isImport:false,onCommit:()=>assert.fail('render cannot commit'),onBack:()=>{}}));
 const invalid=render([{row_key:'manual-1',field:'change_reason',severity:'error',code:'required',message:'Укажите причину изменения.'}]);
 assert.match(invalid,/Укажите причину изменения/);
 assert.doesNotMatch(invalid,/Все значения совпадают|Завершить без изменений|Завершение выдаст квитанцию/);
 assert.match(invalid,/<button\b[^>]*disabled=""[^>]*><span>Исправьте ошибки<\/span><\/button>/);
 assert.match(invalid,/Вернуться к вводу/);
 const noOp=render([]);
 assert.match(noOp,/Все значения совпадают/);assert.match(noOp,/Завершить без изменений/);assert.doesNotMatch(noOp,/Исправьте ошибки/);
});

for(const mixed of [false,true])test(`${mixed?'mixed valid/invalid':'all-invalid'} preview retains every command target and its row error without invented diff`,()=>{
 const {EquipmentPassportPreview}=loadDependency('@/components/equipment/EquipmentPassportPreview',new URL('../src/components/equipment/EquipmentPassportPreview.tsx',import.meta.url).pathname);
 const invalid={...row,row_key:'invalid-2',well_id:'9007199254740999',slot:'motor',action:'void',change_reason:''};
 const valid={...row,row_key:'valid-1',slot:'pump'};
 const before={id:'42',component_id:'43',slot:'pump',status:'current',installed_on:null,removed_on:null,predecessor_id:null,attributes:{model:'Старая'}};
 const actualDiff={row_key:'valid-1',well_id:'9007199254740993',slot:'pump',action:'update',before:[before],after:[{...before,attributes:{model:'Новая'}}]};
 const html=renderToStaticMarkup(React.createElement(EquipmentPassportPreview,{preview:{...preview,expires_at:'2099-01-01T00:00:00Z',commands:{schema_version:'equipment-passport-v1',rows:mixed?[valid,invalid]:[invalid]},diff:mixed?[actualDiff]:[],changed_count:mixed?1:0,unchanged_count:0,issues:[{row_key:'invalid-2',field:'change_reason',severity:'error',code:'required',message:'Укажите причину изменения.'}]},busy:false,ambiguous:false,isImport:true,onCommit:()=>assert.fail('invalid package cannot commit'),onBack:()=>{}}));
 const invalidRow=html.match(/<tr\b[^>]*data-row-key="invalid-2"[^>]*>([\s\S]*?)<\/tr>/)?.[1];
 assert.ok(invalidRow,'invalid command must remain a real overview table row');
 assert.match(invalidRow,/9007199254740999/);assert.match(invalidRow,/ПЭД/);assert.match(invalidRow,/Аннулировать запись/);
 assert.match(invalidRow,/Ошибка/);assert.match(invalidRow,/change_reason/);assert.match(invalidRow,/Укажите причину изменения/);
 assert.doesNotMatch(invalidRow,/эпизодов|Изменится|Без изменений/);
 assert.match(html,/<button\b[^>]*disabled=""[^>]*><span>Исправьте ошибки<\/span><\/button>/);
 if(mixed){const validRow=html.match(/<tr\b[^>]*data-row-key="valid-1"[^>]*>([\s\S]*?)<\/tr>/)?.[1];assert.ok(validRow);assert.match(validRow,/9007199254740993/);assert.match(validRow,/Насос/);assert.match(validRow,/Изменится/);assert.match(validRow,/1 → 1 эпизодов/);}
 else assert.doesNotMatch(html,/ant-table-placeholder/);
 assert.match(html,new RegExp(`Показать полный diff \\(${mixed?1:0} строк\\)`),'full diff counts only actual server diffs');
});

// Catch a history consumer that leaves the standard sticky refresh disabled or
// drops its busy/access state. The actual consumer and PulseTable render here;
// only the server hook is bounded to avoid session/network side effects.
test('equipment history uses one sticky refresh with idle, loading and denied source states',()=>{
 const tableFile=new URL('../src/components/common/PulseTable.tsx',import.meta.url).pathname;
 const historyFile=new URL('../src/components/equipment/EquipmentPassportHistory.tsx',import.meta.url).pathname;
 const {PulseTable}=loadDependency('@/components/common/PulseTable',tableFile);
 for(const source of [{isFetching:false,refreshDisabled:false},{isFetching:true,refreshDisabled:false},{isFetching:false,refreshDisabled:true}]){
  let tableProps,reads=0;
  const table={...source,data:{items:[],next_cursor:null},isError:false,notice:'',
   state:{query:{version:1,filters:[],sort:[{field:'recorded_at',direction:'desc'}]},setQuery:()=>assert.fail('refresh must preserve query')},
   pagination:{canPrevious:false,onPrevious:()=>{},onNext:()=>{}},refresh:()=>reads++};
  const {EquipmentPassportHistory}=loadDependency('@/components/equipment/EquipmentPassportHistory',historyFile,{
   '@/hooks/useServerTable':{useServerTable:()=>table},
   '@/components/common/PulseTable':{PulseTable:props=>{tableProps=props;return React.createElement(PulseTable,props);}},
  });
  const html=renderToStaticMarkup(React.createElement(EquipmentPassportHistory,{wellId:'9007199254740993',canUpdate:false,canExport:false,busy:false,onBack:()=>{},onExport:()=>{},onEdit:()=>{},onFailure:()=>{}}));
  const refresh=html.match(/<button\b[^>]*aria-label="Обновить"[^>]*>/g)??[];
  assert.ok(refresh.length,'history must offer the standard refresh');
  assert.equal(/disabled=""/.test(refresh[0]),source.isFetching||source.refreshDisabled,'idle allowed history must enable sticky refresh');
  assert.equal(tableProps.refreshing,source.isFetching,'own source loading reaches the standard action');
  assert.equal(tableProps.refreshDisabled,source.refreshDisabled,'access guard reaches the standard action');
  assert.equal(tableProps.headerActions,undefined,'legacy duplicate refresh must be removed');
  if(!source.isFetching&&!source.refreshDisabled){tableProps.onRefresh();assert.equal(reads,1,'standard refresh delegates the history reread');}
 }
});
