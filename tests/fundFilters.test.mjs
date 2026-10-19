import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFundFilters} from '../src/lib/fundFilters.ts';
test('фильтры сохраняют нулевые и отрицательные коды без внешних ID',()=>{
 assert.deepEqual(normalizeFundFilters({ngdu:0,department:-900,search:'001',sort:'id_desc',unitek_id:33}),{ngdu:0,department:-900,search:'001',sort:'id_desc'});
 assert.deepEqual(normalizeFundFilters({ngdu:null,department:'0',search:12,sort:'bad'}),{search:'',sort:'id_asc'});
 assert.equal(Array.from(normalizeFundFilters({search:'я'.repeat(150)}).search).length,120);
});
