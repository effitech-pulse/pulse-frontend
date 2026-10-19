const page=await figma.getNodeByIdAsync('337:4168');await figma.setCurrentPageAsync(page);
if(page.children.some(n=>n.name==='15 / Несколько каналов'))throw new Error('Extension already exists; inspect before editing');
const base=await figma.getNodeByIdAsync('337:5179');
const primary=await figma.getNodeByIdAsync('3:38'),secondary=await figma.getNodeByIdAsync('3:40'),fieldMaster=await figma.getNodeByIdAsync('42:70');
for(const n of [base,primary,secondary,fieldMaster])for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);
const vars=Object.fromEntries((await figma.variables.getLocalVariablesAsync()).map(v=>[v.name,v]));
const styles=await figma.getLocalTextStylesAsync();const made=[],changed=[],removed=[],links=[],screens={},customText=[];
function track(n){made.push(n.id);if('children'in n)for(const c of n.children)track(c);return n;}
function paint(k){return figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:1,g:1,b:1}},'color',vars['color/'+k]);}
function box(parent,name,w,dir='VERTICAL',bg=null,pad=0,gap=16){const n=figma.createAutoLayout(dir);made.push(n.id);n.name=name;n.resize(w,10);n.primaryAxisSizingMode=dir==='VERTICAL'?'AUTO':'FIXED';n.counterAxisSizingMode=dir==='VERTICAL'?'FIXED':'AUTO';n.itemSpacing=gap;n.paddingLeft=n.paddingRight=n.paddingTop=n.paddingBottom=pad;n.fills=bg?[paint(bg)]:[];parent.appendChild(n);return n;}
function txt(p,s,w,size=14,col='ink',weight=false){const n=figma.createText();made.push(n.id);n.fontName={family:'Roboto',style:weight?'Medium':'Regular'};n.fontSize=size;n.lineHeight={unit:'PIXELS',value:size===28?40:20};n.characters=s;n.name=s.slice(0,70);n.fills=[paint(col)];p.appendChild(n);n.resize(w,20);n.textAutoResize='HEIGHT';customText.push(n);return n;}
function row(p,w=1152,gap=12){const n=box(p,'Строка',w,'HORIZONTAL',null,0,gap);n.counterAxisAlignItems='CENTER';return n;}
function panel(p,title,w=1152){const n=box(p,title||'Панель',w,'VERTICAL','surface',20,16);n.strokes=[paint('border')];n.setBoundVariable('cornerRadius',vars.radius);if(title)txt(n,title,w-40,16,'ink',true);return n;}
function button(p,label,target=null,active=false,w=0){const n=(active?primary:secondary).createInstance();p.appendChild(n);const key=Object.keys((active?primary:secondary).componentPropertyDefinitions)[0];n.setProperties({[key]:label});n.name=label;n.resize(w||Math.max(100,label.length*7+28),40);track(n);if(target)links.push([n,target]);return n;}
function field(p,label,value,w){const n=fieldMaster.createInstance();p.appendChild(n);n.setProperties({'Label#42:0':label,'Value#42:1':value});n.resize(w,72);n.children[0].resize(w,20);n.children[1].resize(w,44);const ts=n.findAllWithCriteria({types:['TEXT']});ts[1].resize(w-24,20);track(n);return n;}
function notice(p,title,detail,bg='selected'){const n=box(p,title,1152,'VERTICAL',bg,16,4);txt(n,title,1120,14,bg==='warningBg'?'warning':'blue',true);txt(n,detail,1120,13,'muted');return n;}
function toolbar(p,active){const r=row(p,1152,8);for(const [label,key]of [['По каналам','base'],['Совместить','overlay'],['Сравнить','compare'],['Таблица','table'],['Импорт','import'],['Экспорт','export']])button(r,label,key,key===active);return r;}
function screen(key,name,title,sub,col,rr){const root=base.clone();page.appendChild(root);root.name=name;root.x=100+col*1520;root.y=4580+rr*1120;for(const n of [root,...root.findAll(()=>true)])if('reactions'in n&&n.reactions.length)n.reactions=[];const old=root.findOne(n=>n.name==='Содержание');old.remove();track(root);const main=root.children[1];const p=box(main,'Содержание',1216,'VERTICAL',null,32,16);txt(p,title,1152,28,'ink',true);txt(p,sub,1152,14,'muted');toolbar(p,key);screens[key]=root;return p;}
function legend(p,w,labels){const r=row(p,w,20);for(let i=0;i<labels.length;i++)txt(r,'━ '+labels[i],(w-40)/labels.length,13,['blue','warning','success'][i],true);}
function graph(p,w,h,options={}){const f=figma.createFrame();made.push(f.id);p.appendChild(f);f.name='График · редактируемые векторные линии';f.resize(w,h);f.fills=[];f.clipsContent=false;
 function rect(x,y,ww,hh,c){const n=figma.createRectangle();made.push(n.id);f.appendChild(n);n.x=x;n.y=y;n.resize(ww,hh);n.fills=[paint(c)];return n;}
 const l=48,r=w-20,t=16,b=h-36;const labels=options.normal?['+20%','+10%','0%']:['40','30','20'];for(let j=0;j<3;j++){const y=t+j*(b-t)/2;rect(l,y,r-l,1,'border');const n=txt(f,labels[j],42,12,'muted');n.x=0;n.y=y-10;}
 for(let k=0;k<3;k++){const points=[];for(let i=0;i<70;i++){let value=.42+.1*Math.sin(i*.22+k*.7)+.025*Math.sin(i*1.7+k)+k*.05;if(options.period===2)value+=Math.max(0,i-25)*.003;if(options.normal)value=.25+Math.max(0,i-8)*(.003+k*.0015)+.035*Math.sin(i*.3+k);points.push([l+i*(r-l)/69,b-value*(b-t)]);}const v=figma.createVector();made.push(v.id);f.appendChild(v);v.name=['Канал A','Канал B','Канал C'][k];v.vectorPaths=[{windingRule:'NONE',data:points.map((a,i)=>(i?'L':'M')+a[0].toFixed(2)+' '+a[1].toFixed(2)).join(' ')}];v.fills=[];v.strokes=[paint(['blue','warning','success'][k])];v.strokeWeight=2;}
 if(options.cursor){const x=l+(r-l)*.58;rect(x,t,1,b-t,'muted');const tip=box(f,'Значения под курсором',244,'VERTICAL','surface',12,4);tip.x=x+12;tip.y=20;tip.strokes=[paint('border')];txt(tip,options.normal?'15.10 · 14:20 · исходные значения':'15.10.2026 · 14:20:00',220,12,'muted');for(const s of options.normal?['Частота: 50,0 Гц · +0,0%','Ток A: 31,4 А · +8,3%','Температура: 82,1 °C · +12,5%']:['Ток A: 31,4 А','Ток B: 30,8 А','Ток C: 31,1 А'])txt(tip,s,220,13);}
 const dates=options.compare?['0 ч','56 ч','112 ч','168 ч']:['08.10','10.10','12.10','15.10'];dates.forEach((s,i)=>{const n=txt(f,s,64,12,'muted');n.x=l+i*(r-l-64)/3;n.y=h-24;});return f;}
function table(p,headers,widths,rows){const w=widths.reduce((a,b)=>a+b,0),wrap=box(p,'Таблица измерений',w,'VERTICAL',null,0,0);for(const [i,cells]of [headers,...rows].entries()){const r=row(wrap,w,0);r.paddingTop=r.paddingBottom=i?14:10;if(i===0)r.fills=[paint('canvas')];cells.forEach((s,j)=>txt(r,String(s),widths[j],i?13:12,i?'ink':'muted',!i));const d=figma.createRectangle();made.push(d.id);wrap.appendChild(d);d.resize(w,1);d.fills=[paint('border')];}return wrap;}

let p=screen('overlay','15 / Несколько каналов','Демо-001 · несколько каналов','Настройка «Токи фаз» · 8–15 октября 2026 · демонстрационные данные',0,0);
let c=panel(p,'Настройка графика'),r=row(c,1112);button(r,'Токи Ia, Ib, Ic','picker',false,210);button(r,'Исходные значения',null,true,210);button(r,'Разные единицы','normal',false,180);button(r,'Сохранить вид',null,false,180);
txt(c,'На общей оси: токи фаз A, B и C · единица измерения — А',1112,13,'muted');
c=panel(p,'Токи фаз · А');legend(c,1112,['Фаза A · Ia','Фаза B · Ib','Фаза C · Ic']);graph(c,1112,290,{cursor:true});
notice(p,'Единый курсор и управление каналами','Нажатие на название в легенде скрывает канал. Выделение интервала и масштабирование применяются ко всем видимым линиям.');
r=row(p);button(r,'Сравнить другой период','compare',true,240);button(r,'Открыть таблицу','table',false,190);button(r,'Экспортировать','export',false,190);

p=screen('normal','16 / Каналы с разными единицами','Демо-001 · сопоставление параметров','Частота, ток и температура на одном графике · демонстрационные данные',1,0);
c=panel(p,'Шкалы и преобразование');r=row(c,1112);button(r,'Изменение от начала',null,true,230);button(r,'Две оси Y',null,false,150);button(r,'Токи фаз','overlay',false,150);
txt(c,'База: первое валидное значение каждого канала в выбранном периоде. Исходные единицы сохранены в подсказке и таблице.',1112,13,'muted');
c=panel(p,'Изменение относительно начала периода · %');legend(c,1112,['Частота · F_out','Ток фазы A · Ia','Температура ПЭД']);graph(c,1112,290,{normal:true,cursor:true});
notice(p,'Разные единицы — отдельные шкалы или относительное изменение','До двух единиц можно показать на левой и правой осях Y. При нулевой базе относительное изменение недоступно; исходные нули сохраняются.');

p=screen('compare','17 / Сравнение периодов','Демо-001 · сравнение периодов','Один набор каналов и настроек для обоих периодов · демонстрационные данные',2,0);
r=row(p);button(r,'По времени от начала',null,true,228);button(r,'По календарю',null,false,170);button(r,'Общие шкалы: вкл.',null,false,210);button(r,'Каналы: Ia, Ib, Ic','picker',false,200);
r=row(p,1152,20);r.counterAxisAlignItems='MIN';
for(const [i,label,date]of [[1,'Период A · исходный','01.10.2026 — 07.10.2026'],[2,'Период B · сравнение','08.10.2026 — 14.10.2026']]){const c=panel(r,label,566);field(c,'Период · МСК',date,526);legend(c,526,['Ia · А','Ib · А','Ic · А']);graph(c,526,260,{compare:true,period:i});txt(c,i===1?'Средний ток A: 29,1 А':'Средний ток A: 31,4 А · +7,9%',526,14,'ink',true);}
notice(p,'Синхронные курсор и масштаб','Оба периода: 168 часов · одинаковые каналы и шкалы. По горизонтали — часы от начала; подсказки показывают исходную дату каждого периода.');
r=row(p);button(r,'Таблица значений','table',false,210);button(r,'Экспорт двух периодов','export',true,240);

p=screen('table','18 / Табличные данные','Демо-001 · таблица телеметрии','Те же каналы, период и фильтры, что на графике · часовой пояс МСК',3,0);
c=panel(p,'Параметры просмотра');r=row(c,1112);field(r,'Временной интервал','15.10.2026 · 14:20–14:25',350);field(r,'Представление','Исходные измерения   ▾',350);field(r,'Качество','Все записи   ▾',388);
txt(c,'Альтернатива: регулярная сетка с указанием шага и агрегации. Интерполяция не включается автоматически.',1112,12,'muted');
c=panel(p,'Измерения · показано 6 из 361');table(c,['Время · 15.10.2026','Ia · А','Ib · А','Ic · А','F_out · Гц','Качество'],[260,140,140,140,150,282],[['14:20:00','31,4','30,8','31,1','50,0','Корректно'],['14:20:01','31,5','30,9','31,2','50,0','Корректно'],['14:20:02','—','30,9','31,1','50,0','Нет измерения Ia'],['14:20:03','31,3','30,7','31,0','50,0','Корректно'],['14:20:04','31,4','30,8','31,2','50,0','Корректно'],['14:20:05','0,0','0,0','0,0','0,0','Остановка · валидные нули']]);
r=row(c,1112);txt(r,'Страница 1 из 61 · по 6 строк · всего 361 запись',760,12,'muted');button(r,'Предыдущая');button(r,'Следующая');
r=row(p);button(r,'Вернуться к графику','overlay',false,220);button(r,'Импорт файла','import',false,180);button(r,'Экспорт выборки','export',true,200);

p=screen('export','19 / Экспорт телеметрии','Экспорт данных','Выберите состав файла перед выгрузкой · демонстрационные данные',0,1);
c=panel(p,'Что экспортировать');r=row(c,1112);field(r,'Объём','Выбранные каналы и период',540);field(r,'Источник выборки','Текущий вид / сравнение периодов',548);
r=row(c,1112);field(r,'Каналы','Ia, Ib, Ic · 3 параметра',540);field(r,'Период','08.10.2026 — 15.10.2026',548);
c=panel(p,'Формат и представление');r=row(c,1112);button(r,'CSV',null,true);button(r,'Excel (.xlsx)');button(r,'Parquet');
r=row(c,1112);field(r,'Значения','Исходные значения в единицах источника',540);field(r,'Время','ISO 8601 с часовым поясом · МСК',548);
txt(c,'Для регулярной сетки укажите шаг и способ агрегации. В режиме сравнения файл содержит метку периода A/B и исходное время каждой записи.',1112,13,'muted');
notice(p,'Состав выгрузки','Идентификатор скважины, время, выбранные каналы и признаки качества. Пропуски остаются пустыми, валидные нули сохраняются.');
r=row(p);button(r,'Назад к данным','table',false,190);button(r,'Подготовить файл','ready',true,210);

p=screen('import','20 / Импорт телеметрии','Импорт файла телеметрии','Добавьте историю и проверьте её до сохранения или запуска диагностики.',1,1);
c=panel(p,'Выберите файл');txt(c,'Перетащите Excel, CSV или Parquet',1112,20,'ink',true);txt(c,'Поддерживаются .xlsx, .csv, .parquet. Для CSV доступны выбор кодировки и разделителя.',1112,14,'muted');button(c,'Выбрать файл','preview',true,190);
c=panel(p,'Назначение импорта');r=row(c,1112);field(r,'Назначение','Добавить историю к скважине',540);field(r,'Скважина','Демо-001 · проверить ID в файле',548);
r=row(c,1112);field(r,'При совпадении измерений','Показать конфликты в предпросмотре',540);field(r,'Профиль полей','JSON демо v1 / выбрать профиль',548);
notice(p,'Сначала предпросмотр','Покажем колонки, единицы, время, пропуски и совпадения. Запись истории выполняется отдельным действием после проверки.');button(p,'Отменить','table');

p=screen('ready','21 / Файл подготовлен','Файл готов к выгрузке','Экспорт выбранной телеметрии · состояние прототипа',2,1);
notice(p,'Файл подготовлен','demo-001_2026-10-08_2026-10-15.csv · 3 канала · исходные значения');
c=panel(p,'Параметры файла');table(c,['Поле','Значение'],[350,762],[['Скважина','Демо-001'],['Период','08.10.2026 — 15.10.2026'],['Каналы','Токи фаз Ia, Ib, Ic'],['Время','ISO 8601 · +03:00'],['Пропуски и нули','Пропуски пустые · нули сохранены']]);
txt(c,'В приложении кнопка запустит скачивание. В Figma показан только сценарий подготовки файла.',1112,13,'muted');r=row(p);button(r,'Скачать файл',null,true,190);button(r,'Изменить параметры','export',false,220);button(r,'Вернуться к данным','table',false,220);

// Режимы доступны и из ранее созданных графиков.
for(const id of ['337:5179','337:5361']){const s=await figma.getNodeByIdAsync(id);const body=s.findOne(n=>n.name==='Содержание');const old=body.children[3];removed.push(old.id);old.remove();const tools=toolbar(body,'base');body.insertChild(3,tools);changed.push(body.id);}
screens.base=base;screens.picker=await figma.getNodeByIdAsync('350:535');screens.preview=await figma.getNodeByIdAsync('337:5542');
for(const [n,k]of links){let owner=n;while(owner.parent&&owner.parent.type!=='PAGE')owner=owner.parent;if(owner.id===screens[k].id)continue;await n.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:screens[k].id,navigation:'NAVIGATE',transition:null}]}]);}
for(const t of customText){const style=styles.find(s=>s.fontSize===t.fontSize&&s.fontName.style===t.fontName.style);if(style)await t.setTextStyleIdAsync(style.id);t.textAutoResize='HEIGHT';}
const newScreens=Object.entries(screens).filter(([k])=>!['base','picker','preview'].includes(k)).map(([key,n])=>({key,id:n.id,name:n.name,text:n.findAllWithCriteria({types:['TEXT']}).length,instances:n.findAllWithCriteria({types:['INSTANCE']}).length,bottom:(()=>{const c=n.findOne(a=>a.name==='Содержание');return c.absoluteBoundingBox.y+c.height-n.absoluteBoundingBox.y;})()}));
return {pageId:page.id,createdNodeIds:[...new Set(made)].join(' '),mutatedNodeIds:changed,removedNodeIds:removed,screens:newScreens,links:links.length};
