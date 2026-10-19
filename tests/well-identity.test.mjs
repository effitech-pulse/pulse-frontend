import test from 'node:test';
import assert from 'node:assert/strict';
import { autoMap, buildPreview, toPayload, fieldInvalid } from '../src/lib/wellImport.ts';

test('ID Pulse не определяется по колонке Unitek ID или Armits ID',()=>{
 const mapping=autoMap(['UNITEK_ID','ARMITS_ID','NGDU','CEX']);
 assert.equal(mapping.id,undefined);
 assert.equal(mapping.unitek_id,'UNITEK_ID');
 assert.equal(autoMap(['PULSE_ID']).id,'PULSE_ID');
});
test('новая скважина не требует внешних ID, нули справочников сохранены',()=>{
 const parsed={columns:['NGDU','CEX','WELL_NUMBER'],rows:[{NGDU:0,CEX:0,WELL_NUMBER:'A'}]};
 const rows=buildPreview(parsed,autoMap(parsed.columns));
 assert.deepEqual(rows[0].errors,[]);
 assert.deepEqual(toPayload(rows),[{ngdu:0,department:0,well_number:'A'}]);
});
test('внутренний ID сохраняется при повторном импорте; внешние нули допустимы',()=>{
 const parsed={columns:['PULSE_ID','NGDU','CEX','UNITEK_ID'],rows:[{PULSE_ID:2,NGDU:0,CEX:0,UNITEK_ID:0}]};
 const rows=buildPreview(parsed,autoMap(parsed.columns));
 assert.deepEqual(toPayload(rows),[{id:2,ngdu:0,department:0,unitek_id:0}]);
 assert.equal(fieldInvalid('id','0'),true);
 assert.equal(fieldInvalid('id','1.2'),true);
 assert.equal(fieldInvalid('unitek_id',''),false);
 assert.equal(fieldInvalid('unitek_id','invalid'),true);
});
