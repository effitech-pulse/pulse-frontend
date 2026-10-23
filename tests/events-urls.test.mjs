import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildEventsURL,buildEventURL,buildWellEventURL,normalizeEventFilters,parseEventFilters,normalizeEventTimestamp,assertEventTarget} from '../src/lib/events.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/events-examples.json',import.meta.url)));
const max='9223372036854775807';
test('canonical requests match frozen wire URLs without double encoding',()=>{
 const urls=fixture.requests.canonical_urls;const id=fixture.responses.details[0].response.body.event.event_id;
 assert.equal(buildEventsURL({well_id:max}),urls.list);
 const cursor=new URL(urls.continuation,'http://local').searchParams.get('cursor');
 assert.equal(buildEventsURL({well_id:max},cursor),urls.continuation);
 assert.equal(buildEventURL(id,'api'),urls.exact_api);assert.equal(buildEventURL(id,'spa'),urls.event_spa);
 assert.equal(buildWellEventURL(max,id,'checks'),urls.well_exact);
});
test('filter parsing rejects unknown duplicate or encoded-twice values and invalid IDs',()=>{
 for(const q of ['x=1','limit=25&limit=25','types=well.restored.v1,well.restored.v1','types=well.restored.v1%252Cwell.archived.v1','well_id=9223372036854775808','limit=0','archive=deleted','limit=1.5'])assert.throws(()=>parseEventFilters(new URLSearchParams(q)));
 assert.deepEqual(normalizeEventFilters({types:['well.restored.v1','manual_check.saved.v1']} ).types,['manual_check.saved.v1','well.restored.v1']);
 assert.throws(()=>normalizeEventFilters({types:[]}));assert.throws(()=>normalizeEventFilters({well_id:12}));
});
test('RFC3339 offsets preserve all six source microseconds and range ordering',()=>{
 assert.equal(normalizeEventTimestamp('2026-10-22T15:00:01.123456+03:00'),'2026-10-22T12:00:01.123456Z');
 assert.equal(normalizeEventTimestamp('2026-01-01T00:00:00-01:00'),'2026-01-01T01:00:00.000000Z');
 for(const value of ['2026-02-30T00:00:00Z','2026-01-01T00:00:00.1234567Z','2026-01-01','2026-01-01T00:00:00+24:00'])assert.throws(()=>normalizeEventTimestamp(value));
 assert.throws(()=>normalizeEventFilters({from:'2026-01-01T00:00:00.000002Z',to:'2026-01-01T00:00:00.000001Z'}));
 const url=buildEventsURL({from:'2026-10-22T15:00:01.123456+03:00'});assert.equal(new URL(url,'http://local').searchParams.get('from'),'2026-10-22T12:00:01.123456Z');
});
test('limits include complete locator, opaque token and escaped prefix/filter overhead',()=>{
 const id='e1.'+'A'.repeat(2045);assert.equal(buildEventURL(id,'spa').length,2056);assert.throws(()=>buildEventURL(id+'A','spa'));
 assert.ok(buildEventsURL({},'A'.repeat(2048)));assert.throws(()=>buildEventsURL({},'A'.repeat(2049)));
 assert.equal(assertEventTarget('/'+'a'.repeat(4095)).length,4096);assert.throws(()=>assertEventTarget('/'+'a'.repeat(4096)));
 const base=buildEventsURL({},'A'.repeat(2048));const prefix='/'+'p'.repeat(4096-base.length+'/api/v1'.length-1);
 assert.equal(buildEventsURL({},'A'.repeat(2048),prefix).length,4096);assert.throws(()=>buildEventsURL({},'A'.repeat(2048),prefix+'p'));
 assert.throws(()=>buildEventURL('e1.bad/../x','api'));assert.throws(()=>buildEventsURL({},'opaque+unsafe'));
});
