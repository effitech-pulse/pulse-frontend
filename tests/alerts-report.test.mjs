import test from 'node:test';
import assert from 'node:assert/strict';
import * as options from '../src/lib/tableOptions.ts';
import * as report from '../src/lib/alertExport.ts';
import {applyTableQuery} from '../src/lib/tableQuery.ts';
import * as XLSX from 'xlsx';

test('typed values survive chips, removal and remote option replacement',()=>{
 assert.equal(typeof options.optionKey,'function');
 const values=[null,false,0,'0'];
 assert.equal(new Set(values.map(options.optionKey)).size,4);
 const initial=values.map(value=>({value,label:`label ${typeof value} ${value}`}));
 const retained=options.mergeFieldOptions(initial,[{value:'new',label:'Новый'}]);
 assert.equal(retained.length,5);
 assert.deepEqual(options.availableFieldOptions(retained,values).map(o=>o.value),['new']);
 assert.deepEqual(options.availableFieldOptions(retained,[null,false,'0']).map(o=>o.value),[0,'new']);
 assert.equal(options.selectedFieldOptions(retained,[false])[0].label,'label boolean false');
 assert.equal(options.availableFieldOptions(retained,[]).length,5);
});
test('only completed snapshots qualify and run transition preserves filters/sort',()=>{
 assert.equal(typeof report.availableAlertRuns,'function');
 assert.deepEqual(report.availableAlertRuns([{id:1,status:'done',snapshot_id:'x'},{id:2,status:'running',snapshot_id:'y'},{id:3,status:'done',snapshot_id:null}]).map(r=>r.id),[1]);
 const query={version:1,filters:[{field:'owner',op:'in',values:[null,'Анна']}],sort:[{field:'id',direction:'desc'}]};
 const p=new URLSearchParams({model:'all',other:'keep','table.alerts':JSON.stringify({query,page:5,pageSize:50,cursors:['c'],revision:'r'})});
 const next=report.selectAlertRun(p,42);
 assert.equal(next.get('run_id'),'42'); assert.equal(next.get('other'),'keep');
 assert.deepEqual(JSON.parse(next.get('table.alerts')),{query,page:1,pageSize:50,cursors:[]});
 assert.equal(report.selectAlertRun(next,undefined).has('run_id'),false);
 assert.equal(report.normalizeResponsible('  '),null);
 assert.equal(report.normalizeResponsible(' Анна '),'Анна');
});
test('XLSX roundtrip exports full filtered sorted set, text IDs and nullable risk',async()=>{
 assert.equal(typeof report.createAlertWorkbook,'function');
 const rows=Array.from({length:48},(_,i)=>({app_well_id:String(9223372036854775807n-BigInt(i)),risk:i===0?null:i/100,status:i===0?'inactive':'scored',run_id:42,metadata:{well_number:`00${i}`,responsible:i%2?'Борис':' Анна ',ngdu:'Н',department:0},rule_findings:[],alert_status:'new',alert_id:1,windows_fired:0,windows_total:0,window_end:null}));
 const schema={fields:[{key:'owner',kind:'enum',label:'Ответственный',read:r=>report.normalizeResponsible(r.metadata.responsible)},{key:'id',kind:'pulseId',label:'ID',read:r=>r.app_well_id}],defaultSort:[],rowId:r=>r.app_well_id};
 const query={version:1,filters:[{field:'owner',op:'in',values:['Анна']}],sort:[{field:'id',direction:'desc'}]};
 const filtered=applyTableQuery(rows,schema,query);
 const book=await report.createAlertWorkbook(filtered,{runId:42,query,exportedAt:'2026-10-28T10:00:00Z',metadata:r=>r.metadata});
 const decoded=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 const data=XLSX.utils.sheet_to_json(decoded.Sheets['Тревоги'],{header:1,defval:null});
 assert.equal(data.length,25); assert.equal(data[1][1],'9223372036854775807'); assert.equal(data[1][2],'000');
 assert.equal(decoded.Sheets['Тревоги'].B2.t,'s'); assert.equal(decoded.Sheets['Тревоги'].C2.t,'s');
 assert.equal(data[1][5],'Неактивна · без оценки'); assert.equal(data[1][6],null); assert.equal(data[2][6],0.02); assert.equal(data[1][4],0);
 const context=XLSX.utils.sheet_to_json(decoded.Sheets['Контекст'],{header:1});
 assert.ok(context.flat().some(v=>String(v).includes('alert_status')));
 assert.ok(context.flat().some(v=>String(v).includes('Анна')));
});

// Реальные обработчики таблицы, границы React/Ant заменены только деревом элементов.
import {loadDependency} from './load-dependency.mjs';
function nodes(value,result=[]) {
 if(!value || typeof value!=='object') return result;
 if(Array.isArray(value)) {value.forEach(item=>nodes(item,result));return result;}
 if(value.props) {result.push(value);nodes(value.props.children,result);} return result;
}
function tableHarness(variant,settings={}) {
 const jsx=(type,props)=>({type,props});
 const hooks={useMemo:fn=>fn(),useEffect:()=>{},useRef:value=>({current:value}),useState:value=>[value === '' ? settings.search ?? value : value,update=>settings.updates?.push(update)]};
 const antd={theme:{useToken:()=>({token:{}})}};
 for(const name of ['Alert','Button','Checkbox','Dropdown','Empty','Input','Pagination','Popover','Select','Space','Table','Tag','Tooltip']) antd[name]=()=>null;
 const {PulseTable}=loadDependency('@/components/common/PulseTable',new URL('../src/components/common/PulseTable.tsx',import.meta.url).pathname,{react:hooks,'react/jsx-runtime':{jsx,jsxs:jsx},antd});
 const values=settings.values ?? [null,false,0,'0'];const fields=[{key:'state',label:'Состояние',kind:'enum',read:r=>r.state,options:values.map((value,i)=>({value,label:`Длинный ответственный ${i}`}))}];
 let query={version:1,sort:[{field:'state',direction:'asc'}],filters:[{field:'state',op:'in',values:settings.selected ?? [null,false,0]},{field:'other',op:'contains',value:'keep'}]};
 let refreshed=0;
 const tree=PulseTable({variant,mode:'local',rows:[],schema:{fields,defaultSort:[],rowId:r=>r.id},columns:[{key:'state',title:'Состояние'},{key:'action',title:'Действия',render:()=>null}],query,onQueryChange:next=>{query=next;},onRefresh:()=>refreshed++,refreshing:settings.refreshing,refreshDisabled:settings.refreshDisabled,pagination:{page:1,pageSize:20,onPageChange:()=>{}}});
 const columns=nodes(tree).find(node=>node.type===antd.Table).props.columns;
 return {antd,columns,get query(){return query;},get refreshed(){return refreshed;}};
}
test('alerts header exposes three left actions and keeps independent refresh and resets',()=>{
 const h=tableHarness('alerts');assert.equal(h.columns.length,2);assert.equal(h.columns[0].title,'Действия');
 assert.equal(h.columns[0].width,120);
 const buttons=nodes(h.columns[0].children[0].title).filter(node=>node.type===h.antd.Button);
 assert.deepEqual(buttons.map(button=>button.props['aria-label']),['Обновить','Сбросить сортировку','Сбросить фильтры']);
 assert.equal(nodes(h.columns[0].children[0].title).some(node=>node.type===h.antd.Dropdown),false);
 buttons[0].props.onClick();assert.equal(h.refreshed,1);assert.equal(h.query.filters.length,2);
 buttons[1].props.onClick();assert.deepEqual(h.query.sort,[]);assert.equal(h.query.filters.length,2);
 buttons[2].props.onClick();assert.deepEqual(h.query.filters,[]);assert.equal(h.query.sort.length,1);
 for(const state of [{refreshDisabled:true},{refreshing:true}]){
  const blocked=tableHarness('alerts',state);
  const refresh=nodes(blocked.columns[0].children[0].title).find(node=>node.type===blocked.antd.Button&&node.props['aria-label']==='Обновить');
  assert.equal(refresh.props.disabled,true);
 }
 const normal=tableHarness();assert.equal(normal.columns[0].key,'heading-state');assert.equal(normal.columns[1].title,'Действия');
});
test('alerts select hides selected typed options; removal, clear and overflow preserve unrelated filters',()=>{
 const h=tableHarness('alerts');
 const owner=nodes(h.columns[1].children[0].title).find(node=>node.props.fields);
 const field=nodes(owner.type(owner.props)).find(node=>node.props.field);
 const select=nodes(field.type(field.props)).find(node=>node.type===h.antd.Select);
 assert.equal(select.props.mode,'multiple');assert.equal(select.props.maxTagCount,'responsive');
 assert.deepEqual(select.props.options.map(option=>option.value),['string:0']);
 select.props.onChange(['object:null','number:0','string:0']);
 assert.deepEqual(h.query.filters.find(f=>f.field==='state').values,[null,0,'0']);
 assert.equal(h.query.filters.find(f=>f.field==='other').value,'keep');
 const overflow=select.props.maxTagPlaceholder([{},{}]);
 assert.equal(select.props.tagRender({isMaxTag:true,label:overflow}).props.children,overflow,'custom tag renderer preserves keyboard overflow control');
 const overflowTree=overflow.type(overflow.props);
 const remove=nodes(overflowTree.props.content).find(node=>node.props['aria-label']==='Удалить: Длинный ответственный 1');
 remove.props.onClick();assert.deepEqual(h.query.filters.find(f=>f.field==='state').values,[null,0]);
 select.props.onChange([]);assert.deepEqual(h.query.filters,[{field:'other',op:'contains',value:'keep'}]);
 assert.deepEqual(h.query.sort,[{field:'state',direction:'asc'}]);
});

function selectFromHarness(h) {
 const owner=nodes(h.columns[1].children[0].title).find(node=>node.props.fields);
 const field=nodes(owner.type(owner.props)).find(node=>node.props.field);
 return nodes(field.type(field.props)).find(node=>node.type===h.antd.Select);
}
test('alerts options distinguish all selected, unsuccessful search and genuinely empty data',()=>{
 const all=selectFromHarness(tableHarness('alerts',{selected:[null,false,0,'0']}));
 assert.equal(all.props.notFoundContent,'Все варианты выбраны');
 const searched=selectFromHarness(tableHarness('alerts',{selected:[],search:'Несуществующее имя'}));
 assert.equal(searched.props.notFoundContent,'Нет совпадений');
 const empty=selectFromHarness(tableHarness('alerts',{values:[],selected:[]}));
 assert.equal(empty.props.notFoundContent,'Нет данных');
 assert.equal(all.props.allowClear,true);assert.equal(all.props.value.length,4);
});
test('overflow Enter and Space toggle the real owner and suppress Select/default activation',()=>{
 for(const key of ['Enter',' ']) {
  const updates=[];const select=selectFromHarness(tableHarness('alerts',{updates}));
  const overflow=select.props.maxTagPlaceholder([{},{}]);
  const button=nodes(overflow.type(overflow.props)).find(node=>node.type==='button');
  let prevented=0,stopped=0;
  button.props.onKeyDown({key,preventDefault(){prevented++;},stopPropagation(){stopped++;}});
  assert.equal(prevented,1,`${key} suppresses native synthetic click`);
  assert.equal(stopped,1,`${key} does not reach Select`);
  assert.equal(updates.length,1);
  assert.equal(typeof updates[0],'function');assert.equal(updates[0](false),true);assert.equal(updates[0](true),false);
 }
});
