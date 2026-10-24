import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTableQuery, createEmptyTableQuery, cycleSort, resetFilters, resetSort, validateTableFilter} from '../src/lib/tableQuery.ts';
const schema={fields:[{key:'id',label:'ID',kind:'pulseId',read:r=>r.id},{key:'name',label:'Имя',kind:'text',read:r=>r.name},{key:'n',label:'Число',kind:'number',read:r=>r.n},{key:'b',label:'Флаг',kind:'boolean',read:r=>r.b},{key:'dt',label:'Время',kind:'datetime',read:r=>r.dt},{key:'date',label:'Дата',kind:'date',read:r=>r.date},{key:'period',label:'Период',kind:'datetime',read:r=>r.start,readEnd:r=>r.end}],defaultSort:[],rowId:r=>r.id};
const q=(sort=[],filters=[])=>({version:1,sort,filters});
test('ordinary clicks append, toggle in place and remove keys; independent resets',()=>{
 let query=cycleSort(createEmptyTableQuery(),'name'); query=cycleSort(query,'n');
 assert.deepEqual(query.sort,[{field:'name',direction:'asc'},{field:'n',direction:'asc'}]);
 query=cycleSort(query,'name'); assert.equal(query.sort[0].direction,'desc');
 query=cycleSort(query,'name'); assert.deepEqual(query.sort,[{field:'n',direction:'asc'}]);
 const withFilter={...query,filters:[{field:'name',op:'contains',value:'a'}]};
 assert.deepEqual(resetFilters(withFilter).sort,query.sort); assert.deepEqual(resetSort(withFilter).filters,withFilter.filters);
});
test('all keys precede stable numeric ID; null last both directions; zero/false preserved',()=>{
 const rows=[{id:'10',name:'a',n:1,b:false},{id:'2',name:'a',n:0,b:false},{id:'1',name:'a',n:null,b:true},{id:'3',name:'a',n:0,b:true}];
 assert.deepEqual(applyTableQuery(rows,schema,q([{field:'name',direction:'asc'},{field:'n',direction:'asc'}])).map(r=>r.id),['2','3','10','1']);
 assert.deepEqual(applyTableQuery(rows,schema,q([{field:'n',direction:'desc'}])).map(r=>r.id),['10','2','3','1']);
 assert.deepEqual(applyTableQuery(rows,schema,q([], [{field:'b',op:'in',values:[false]},{field:'n',op:'in',values:[0]}])).map(r=>r.id),['2']);
});
test('int64 never rounds and case-insensitive text AND multi-value OR work over full immutable array',()=>{
 const rows=Object.freeze([{id:'9223372036854775807',name:'АЛЬФА',n:1},{id:'9223372036854775806',name:'альфа',n:2},{id:'2',name:'бета',n:1}]);
 assert.deepEqual(applyTableQuery(rows,schema,q([{field:'id',direction:'asc'}],[{field:'name',op:'contains',value:'АлЬ'},{field:'n',op:'in',values:[1,2]}])).map(r=>r.id),['9223372036854775806','9223372036854775807']);
 assert.equal(rows[0].id,'9223372036854775807');
});
test('timestamp offsets compare instants, naive timestamp stays unknown, dates do not shift',()=>{
 const rows=[{id:'1',dt:'2026-10-24T03:00:00+03:00',date:'2026-10-24'},{id:'2',dt:'2026-10-23T23:00:00Z',date:'2026-10-23'},{id:'3',dt:'2026-10-24T01:00:00',date:null}];
 assert.deepEqual(applyTableQuery(rows,schema,q([{field:'dt',direction:'asc'}])).map(r=>r.id),['2','1','3']);
 assert.deepEqual(applyTableQuery(rows,schema,q([],[{field:'date',op:'range',from:'2026-10-24',to:'2026-10-24'}])).map(r=>r.id),['1']);
 assert.deepEqual(applyTableQuery(rows,schema,q([],[{field:'dt',op:'range',from:'2026-10-24T00:00:00Z',to:'2026-10-24T00:00:00Z'}])).map(r=>r.id),['1']);
});
test('inclusive numeric and overlap bounds, undefined normalized null and invalid filters rejected',()=>{
 const rows=[{id:'1',n:0,start:'2026-10-24T00:00:00Z',end:'2026-10-25T00:00:00Z'},{id:'2'}];
 assert.deepEqual(applyTableQuery(rows,schema,q([],[{field:'n',op:'range',from:0,to:0}])).map(r=>r.id),['1']);
 assert.deepEqual(applyTableQuery(rows,schema,q([],[{field:'period',op:'overlap',from:'2026-10-25T00:00:00Z',to:'2026-10-26T00:00:00Z'}])).map(r=>r.id),['1']);
 assert.deepEqual(applyTableQuery(rows,schema,q([],[{field:'n',op:'in',values:[null]}])).map(r=>r.id),['2']);
 assert.equal(validateTableFilter(schema.fields[2],{field:'n',op:'range',from:2,to:1}),false);
 assert.equal(validateTableFilter(schema.fields[0],{field:'id',op:'contains',value:'9223372036854775808'}),false);
 assert.deepEqual(applyTableQuery(rows,{...schema,defaultSort:[{field:'id',direction:'desc'}]},q()).map(r=>r.id),['2','1']);
});
test('folded ordinal order matches server C collation and Latin/Russian/Tatar folding',()=>{
 const rows=[{id:'1',name:'я'},{id:'2',name:'Я'},{id:'3',name:'Ё'},{id:'4',name:'A'},{id:'5',name:'a'},{id:'6',name:'😀'},{id:'7',name:'\uE000'}];
 assert.deepEqual(applyTableQuery(rows,schema,q([{field:'name',direction:'asc'}])).map(r=>r.id),['4','5','1','2','3','7','6']);
 assert.deepEqual(applyTableQuery(rows,schema,q([],[{field:'name',op:'contains',value:'ё'}])).map(r=>r.id),['3']);
 assert.equal(validateTableFilter(schema.fields[5],{field:'date',op:'range',from:'2026-02-30'}),false);
});

test('fractional timestamps preserve microseconds before the stable ID tie breaker',()=>{
 const rows=[{id:'1',dt:'2026-10-24T00:00:00.000002Z'},{id:'2',dt:'2026-10-24T03:00:00.000001+03:00'}];
 assert.deepEqual(applyTableQuery(rows,schema,q([{field:'dt',direction:'asc'}])).map(r=>r.id),['2','1']);
 assert.deepEqual(applyTableQuery(rows,schema,q([],[{field:'dt',op:'range',from:'2026-10-24T00:00:00.000002Z'}])).map(r=>r.id),['1']);
 assert.deepEqual(applyTableQuery([{id:'1',name:'ӘӨҮҖҢҺ'},{id:'2',name:'әөүҗңһ'}],schema,q([],[{field:'name',op:'contains',value:'әөүҗңһ'}])).map(r=>r.id),['1','2']);
});
test('unsafe numeric Pulse IDs are unknown instead of rounded identities',()=>{
 const rows=[{id:'1',pid:9007199254740993},{id:'2',pid:'9007199254740993'},{id:'3',pid:0}];
 const exact={fields:[{key:'pid',label:'ID',kind:'pulseId',read:r=>r.pid}],defaultSort:[],rowId:r=>r.id};
 assert.deepEqual(applyTableQuery(rows,exact,q([{field:'pid',direction:'asc'}])).map(r=>r.id),['2','1','3']);
});
test('audit unspecified wallclock sorts and filters exact civil time without inventing a zone',()=>{
 const wall={fields:[{key:'ts',label:'Время записи · пояс не задан',kind:'datetime',timezone:'unspecified',read:r=>r.ts}],defaultSort:[],rowId:r=>r.id};
 const rows=[{id:'1',ts:'2026-10-24T12:00:00.000002'},{id:'2',ts:'2026-10-24T12:00:00.000001'},{id:'3',ts:'2026-02-30T12:00:00'}];
 assert.deepEqual(applyTableQuery(rows,wall,q([{field:'ts',direction:'asc'}])).map(r=>r.id),['2','1','3']);
 assert.deepEqual(applyTableQuery(rows,wall,q([],[{field:'ts',op:'range',from:'2026-10-24T12:00:00.000002'}])).map(r=>r.id),['1']);
 assert.equal(validateTableFilter(wall.fields[0],{field:'ts',op:'range',from:'2026-02-30T12:00:00'}),false);
 assert.equal(validateTableFilter(wall.fields[0],{field:'ts',op:'range',from:'2026-10-24T12:00:00Z'}),false);
});
test('unsafe numeric Pulse ID is also excluded from literal identity search',()=>{
 const rows=[{id:'1',pid:9007199254740993},{id:'2',pid:'9007199254740992'}];const exact={fields:[{key:'pid',label:'ID',kind:'pulseId',read:r=>r.pid}],defaultSort:[],rowId:r=>r.id};
 assert.deepEqual(applyTableQuery(rows,exact,q([],[{field:'pid',op:'contains',value:'9007199254740992'}])).map(r=>r.id),['2']);
});
test('integer measurements preserved as strings retain exact order and range beyond safe integer',()=>{
 const rows=[{id:'1',n:'9007199254740993'},{id:'2',n:'9007199254740992'}];
 assert.deepEqual(applyTableQuery(rows,schema,q([{field:'n',direction:'asc'}])).map(r=>r.id),['2','1']);
 assert.deepEqual(applyTableQuery(rows,schema,q([],[{field:'n',op:'range',from:'9007199254740993'}])).map(r=>r.id),['1']);
});
test('numeric input bounds canonicalize exactly before serialization and reject lossy time precision',async()=>{
 const {parseTableNumberBound}=await import('../src/lib/tableQuery.ts');
 for(const [raw,expected] of [['9007199254740993','9007199254740993'],['009007199254740993.50','9007199254740993.5'],['9.007199254740993e15','9007199254740993'],['0','0'],['-.5','-0.5']])assert.equal(parseTableNumberBound(raw),expected);
 assert.equal(parseTableNumberBound(''),undefined);assert.throws(()=>parseTableNumberBound('bad'));
 const filter={field:'n',op:'range',from:parseTableNumberBound('9007199254740993')};assert.equal(JSON.parse(JSON.stringify(filter)).from,'9007199254740993');
 assert.equal(validateTableFilter(schema.fields[4],{field:'dt',op:'range',from:'2026-10-24T00:00:00.1234561Z'}),false);
 assert.equal(validateTableFilter(schema.fields[4],{field:'dt',op:'range',from:'2026-10-24T00:00:00.123456000Z'}),true);
});
