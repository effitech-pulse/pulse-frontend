// Пакетное создание тёмных вариантов с сохранением компонентов и геометрии.
const batchStart = 0;
const batchEnd = 7;
const source=await figma.getNodeByIdAsync('337:4168');
await figma.setCurrentPageAsync(source);
const pageName='Интеграции и телеметрия · Dark';
let target=figma.root.children.find(p=>p.name===pageName);
const created=[];
if(!target){target=figma.createPage();target.name=pageName;created.push(target.id);}
const coll=(await figma.variables.getLocalVariableCollectionsAsync()).find(c=>c.id==='VariableCollectionId:3:2');
const vars=Object.fromEntries((await figma.variables.getLocalVariablesAsync()).map(v=>[v.name,v]));
const fonts=new Map();
const sources=source.children.slice(batchStart,batchEnd);
for(const s of sources)for(const t of s.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName']))fonts.set(JSON.stringify(seg.fontName),seg.fontName);
for(const f of fonts.values())await figma.loadFontAsync(f);
const pairs=[];
for(const s of sources){
  const name=s.name+' · Dark';
  if(target.children.some(n=>n.name===name))throw new Error('Screen exists; inspect before retrying: '+name);
  const d=s.clone();target.appendChild(d);d.name=name;d.x=s.x;d.y=s.y;
  d.setExplicitVariableModeForCollection(coll,'128:0');
  const nodes=[d,...d.findAll(()=>true)];
  for(const n of nodes){created.push(n.id);if('reactions'in n&&n.reactions.length)n.reactions=[];}
  // Затемнение под панелью выбора каналов должно оставаться тёмным.
  if(s.id==='350:535')for(const n of d.children.filter(n=>n.type==='RECTANGLE')){
    n.fills=[figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',vars['color/backdrop'])];
    n.opacity=.6;
  }
  pairs.push({sourceId:s.id,id:d.id,name:d.name,width:d.width,height:d.height,texts:d.findAllWithCriteria({types:['TEXT']}).length,instances:d.findAllWithCriteria({types:['INSTANCE']}).length});
}
return {pageId:target.id,createdNodeIds:created.join(' '),screens:pairs};
