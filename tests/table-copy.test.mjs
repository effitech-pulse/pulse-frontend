import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDependency} from './load-dependency.mjs';
function harness(clipboard){
 const slots=[];let cursor=0;const messages=[];let reads=0;const jsx=(type,props)=>({type,props});
 const Button=()=>{},Modal=()=>{},Input=()=>{};Input.TextArea=Input;
 const auth={privateBlocked:false,capturePrivate:()=>({current:()=>true})};
 const boundaries={react:{useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=value;}];}},'react/jsx-runtime':{jsx,jsxs:jsx},antd:{Button,Modal,Input,App:{useApp:()=>({message:{success:text=>messages.push(text)}})}},'@/auth/AuthProvider':{useAuth:()=>auth}};
 const component=loadDependency('@/components/common/CopyTableSelectionButton',new URL('../src/components/common/CopyTableSelectionButton.tsx',import.meta.url).pathname,boundaries);
 const render=()=>{cursor=0;return component.CopyTableSelectionButton({getLink:()=>{reads++;return 'https://pulse.test/wells?table.x=encoded';},clipboard});};
 return {render,Button,Modal,Input,messages,get reads(){return reads;},auth};
}
function nodes(tree){return [tree,...(Array.isArray(tree?.props?.children)?tree.props.children:[tree?.props?.children]).filter(Boolean).flatMap(nodes)];}
test('copy is explicit, reports success and leaves selection/navigation untouched',async()=>{
 const writes=[];const h=harness({writeText:async value=>writes.push(value)});let tree=h.render();
 assert.equal(h.reads,0);await nodes(tree).find(n=>n.type===h.Button).props.onClick();
 assert.deepEqual(writes,['https://pulse.test/wells?table.x=encoded']);assert.equal(h.messages.length,1);
});
for(const clipboard of [null,{writeText:async()=>{throw Error('denied');}}])test('clipboard failure exposes readonly selectable link and closes fallback',async()=>{
 const h=harness(clipboard);await nodes(h.render()).find(n=>n.type===h.Button).props.onClick();
 let tree=h.render();const modal=nodes(tree).find(n=>n.type===h.Modal);assert.equal(modal.props.open,true);
 const input=nodes(tree).find(n=>n.type===h.Input);assert.equal(input.props.readOnly,true);assert.equal(input.props.value,'https://pulse.test/wells?table.x=encoded');
 let selected=false;input.props.onFocus({target:{select(){selected=true;}}});assert.equal(selected,true);
 modal.props.onCancel();assert.equal(nodes(h.render()).find(n=>n.type===h.Modal).props.open,false);
});
