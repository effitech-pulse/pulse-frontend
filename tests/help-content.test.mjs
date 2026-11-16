import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchHelp,resolveHelp} from '../src/lib/help.ts';
const guides=['user-guide','business-guide'].map(id=>JSON.parse(readFileSync(new URL(`../src/content/help/${id}.json`,import.meta.url),'utf8')));
test('published catalogue has unique, resolvable deep links and local safe article links',()=>{
 assert.deepEqual(guides.map(g=>g.articles.length),[13,8]);
 for(const guide of guides){const ids=new Set();for(const article of guide.articles){assert.match(article.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.ok(!ids.has(article.id));ids.add(article.id);assert.equal(resolveHelp(guides,guide.id,article.id).kind,'article');assert.ok(article.sections.length>0);
 for(const section of article.sections)for(const link of section.links??[]){assert.match(link.to,/^\/(?!\/)/);assert.ok(!/[<>\\]/.test(link.to));if(link.to.startsWith('/help/')){const [, ,g,a]=link.to.split('/');assert.notEqual(resolveHelp(guides,g,a).kind,'not-found',link.to);}}
 }}
});
test('real catalogue finds technical terms in body beyond titles and summaries',()=>{
 assert.ok(searchHelp(guides,'9999').some(r=>r.article.id==='telemetry-and-quality'));
 assert.ok(searchHelp(guides,'ознакомился').some(r=>r.article.id==='getting-started'));
 assert.equal(resolveHelp(guides,'business-guide','alerts-and-review').kind,'not-found');
});
