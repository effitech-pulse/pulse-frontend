import test from 'node:test';import assert from 'node:assert/strict';
test('selected docs navigation scrolls only its own aside and leaves a visible link in place',async()=>{
 const {revealHelpNavigation}=await import('../src/components/help/helpNavigation.ts');
 const scroller={scrollTop:80,getBoundingClientRect:()=>({top:100,bottom:410})};
 revealHelpNavigation(scroller,{getBoundingClientRect:()=>({top:380,bottom:460})});assert.equal(scroller.scrollTop,130);
 revealHelpNavigation(scroller,{getBoundingClientRect:()=>({top:80,bottom:120})});assert.equal(scroller.scrollTop,110);
 revealHelpNavigation(scroller,{getBoundingClientRect:()=>({top:180,bottom:240})});assert.equal(scroller.scrollTop,110);
 revealHelpNavigation(null,null);
});
test('initial aside intersection with viewport reveals a link below the visible window edge',async()=>{
 const {revealHelpNavigation}=await import('../src/components/help/helpNavigation.ts');
 const scroller={scrollTop:0,getBoundingClientRect:()=>({top:76,bottom:1075})};
 revealHelpNavigation(scroller,{getBoundingClientRect:()=>({top:975,bottom:1032})},1000);
 assert.equal(scroller.scrollTop,32);
});
