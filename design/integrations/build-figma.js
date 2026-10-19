// Выполняется через Figma Plugin API. Макеты используют существующие компоненты Пульса.
const pageName = 'Интеграции и телеметрия · v1';
if (figma.root.children.some(p => p.name === pageName)) throw new Error('Page exists; inspect before rebuilding');
const sourceNav = await figma.getNodeByIdAsync('43:940');
const sourceHeader = await figma.getNodeByIdAsync('43:989');
const components = {};
for (const [key,id] of Object.entries({primary:'3:38',secondary:'3:40',normal:'3:46',watch:'3:44',alert:'3:42',nav:'3:50',active:'3:48',field:'42:70'})) components[key] = await figma.getNodeByIdAsync(id);
const fonts = new Map();
for (const root of [sourceNav,sourceHeader,...Object.values(components)]) for (const t of root.findAllWithCriteria({types:['TEXT']})) for (const s of t.getStyledTextSegments(['fontName'])) fonts.set(JSON.stringify(s.fontName),s.fontName);
for (const f of [...fonts.values(),{family:'Roboto',style:'Regular'},{family:'Roboto',style:'Medium'}]) await figma.loadFontAsync(f);
const vars = Object.fromEntries((await figma.variables.getLocalVariablesAsync()).map(v=>[v.name,v]));
const styles = Object.fromEntries((await figma.getLocalTextStylesAsync()).map(s=>[s.name.split('/').pop(),s]));
const page = figma.createPage(); page.name=pageName; await figma.setCurrentPageAsync(page);
const created=[page.id], links=[], screens={}, actionNodes={};
function track(n) { created.push(n.id); if ('children' in n) for (const c of n.children) track(c); return n; }
function paint(key) {return figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:1,g:1,b:1}},'color',vars['color/'+key]);}
function fill(n,key) {n.fills=[paint(key)];}
function stroke(n) {n.strokes=[paint('border')]; n.strokeWeight=1;}
function box(parent,name,w,dir='VERTICAL',bg=null,pad=0,gap=16) {
  const n=figma.createAutoLayout(dir); created.push(n.id); n.name=name; n.resize(w,10); n.primaryAxisSizingMode=dir==='VERTICAL'?'AUTO':'FIXED'; n.counterAxisSizingMode=dir==='VERTICAL'?'FIXED':'AUTO'; n.itemSpacing=gap; n.paddingLeft=n.paddingRight=n.paddingTop=n.paddingBottom=pad; n.fills=[];
  if(bg) fill(n,bg); if(parent) parent.appendChild(n); return n;
}
function text(parent,value,w=0,size=14,color='ink',medium=false) {
  const n=figma.createText(); created.push(n.id); n.fontName={family:'Roboto',style:medium?'Medium':'Regular'}; n.fontSize=size; n.characters=value; n.name=value.slice(0,70); n.lineHeight={unit:'PIXELS',value:size<=14?20:Math.ceil(size*1.3)}; fill(n,color); parent.appendChild(n);
  if(w) {n.resize(w,20); n.layoutSizingHorizontal='FIXED'; n.textAutoResize='HEIGHT';} return n;
}
function row(p,w,gap=12) {const n=box(p,'Строка',w,'HORIZONTAL',null,0,gap); n.counterAxisAlignItems='CENTER';return n;}
function panel(p,title,w=1152) {const n=box(p,title,w,'VERTICAL','surface',20,16); stroke(n); n.setBoundVariable('cornerRadius',vars.radius); if(title)text(n,title,w-40,16,'ink',true); return n;}
function btn(p,label,kind='secondary',target=null,w=0) {
  const n=track(components[kind].createInstance()); p.appendChild(n); n.name=label; const t=n.findAllWithCriteria({types:['TEXT']})[0]; t.characters=label; n.resize(w||Math.max(100,label.length*7.4+32),40); if(target)links.push([n,target]); return n;
}
function badge(p,label,kind='normal') {const n=track(components[kind].createInstance());p.appendChild(n);n.findAllWithCriteria({types:['TEXT']})[0].characters=label;n.resize(Math.max(82,label.length*7+24),26);return n;}
function field(p,label,value,w=540) {
  const n=track(components.field.createInstance()); p.appendChild(n); n.resize(w,72); const ts=n.findAllWithCriteria({types:['TEXT']}); ts[0].characters=label; ts[0].resize(w,20); ts[1].characters=value;ts[1].resize(w-24,20);const input=n.children[1];input.resize(w,44); return n;
}
function notice(p,title,detail,kind='selected',w=1152) {const n=box(p,title,w,'VERTICAL',kind,16,4);n.setBoundVariable('cornerRadius',vars.radius);text(n,title,w-32,14,kind==='dangerBg'?'danger':kind==='warningBg'?'warning':'blue',true);if(detail)text(n,detail,w-32,13,'muted');return n;}
function table(p,heads,widths,rows) {
  const w=widths.reduce((a,b)=>a+b,0); const wrap=box(p,'Таблица',w,'VERTICAL',null,0,0);
  function tr(cells,header=false) {const r=row(wrap,w,0);r.paddingTop=r.paddingBottom=header?10:14;if(header)fill(r,'canvas');r.strokes=[paint('border')];r.strokeBottomWeight=1;r.strokeTopWeight=r.strokeLeftWeight=r.strokeRightWeight=0;
    cells.forEach((c,i)=>{const cell=box(r,'Ячейка',widths[i],'VERTICAL',null,0,2);cell.paddingLeft=8;cell.paddingRight=8;if(typeof c==='object')badge(cell,c.text,c.kind);else text(cell,String(c),widths[i]-16,header?12:13,header?'muted':(i===0?'blue':'ink'),header);});return r;}
  tr(heads,true);return rows.map(c=>tr(c));
}
function screen(key,title,subtitle,col,r) {
  const root=box(null,key,1440,'HORIZONTAL','canvas',0,0);page.appendChild(root);root.resize(1440,1024);root.layoutSizingVertical='FIXED';root.x=100+col*1520;root.y=100+r*1120;root.clipsContent=true;
  const nav=track(sourceNav.clone());root.appendChild(nav);nav.resize(224,1024);
  for(const n of [nav,...nav.findAll(()=>true)]) if('reactions' in n && n.reactions.length)n.reactions=[];
  for(const n of nav.findAllWithCriteria({types:['FRAME']})) if(n.name==='Система'){n.fills=[];for(const t of n.findAllWithCriteria({types:['TEXT']}))fill(t,'ink');}
  const entry=track(components.active.createInstance());entry.name='Интеграции';entry.findAllWithCriteria({types:['TEXT']})[0].characters='Интеграции';nav.insertChild(10,entry);entry.resize(192,42);links.push([entry,'sources']);
  const spacer=nav.children.find(n=>n.name==='Гибкий отступ');if(spacer)spacer.layoutSizingVertical='FILL';
  const main=box(root,'Рабочая область',1216,'VERTICAL',null,0,0);const head=track(sourceHeader.clone());main.appendChild(head);
  head.findAllWithCriteria({types:['TEXT']})[0].characters=key==='telemetry'||key==='zoom'?'Скважины / Демо-001 / Телеметрия':'Система / Интеграции';
  // Новые макеты имеют собственный сценарий; переходы старого хедера не наследуем.
  for(const n of [head,...head.findAll(()=>true)]) if('reactions' in n && n.reactions.length)n.reactions=[];
  const body=box(main,'Содержание',1216,'VERTICAL',null,32,20); text(body,title,1152,28,'ink',true);text(body,subtitle,1152,14,'muted');
  screens[key]=root;return body;
}
function tabs(p,active='Источники') {const r=row(p,1152,8); for(const [label,target] of [['Источники','sources'],['Словарь полей','mapping'],['Демо-симулятор','simulator'],['Журнал сбора','status']])btn(r,label,label===active?'primary':'secondary',target);}
function steps(p,current) {const r=row(p,1152,16);['Тип источника','Подключение','Словарь полей','Сбор и запуск'].forEach((s,i)=>text(r,`${i+1}. ${s}`,270,13,i===current?'blue':'muted',i===current));}
function stats(p,values) {const r=row(p,1152,16);for(const [label,value,detail] of values){const c=panel(r,'',276);text(c,label,236,12,'muted');text(c,value,236,28,'ink',true);text(c,detail,236,12,'muted');}}

let p=screen('sources','Источники данных','Подключайте телеметрию, проверяйте качество и управляйте сбором.',0,0);tabs(p);
let r=row(p,1152);text(r,'Подключения организации',732,18,'ink',true);btn(r,'Загрузить файл','secondary','files',184);btn(r,'Добавить источник','primary','choose',212);
stats(p,[['Активные источники','2 из 4','1 ошибка · 1 приостановлен'],['Скважины с данными','124','Связаны с реестром'],['Последний сбор','14:32:05','Измерения до 14:32:00'],['Качество приёма','99,6%','За последние 24 часа']]);
let card=panel(p,'Подключённые источники');
let rows=table(card,['Источник / тип','Состояние','Измерения до','Сбор','Действие'],[330,190,220,160,212],[['Промысловая телеметрия · ClickHouse',{text:'Работает',kind:'normal'},'15.10.2026 14:32:00','1 минута','Открыть →'],['Демо-стенд · JSON API',{text:'Демо',kind:'watch'},'15.10.2026 14:32:00','5 секунд','Открыть →'],['Архив · PostgreSQL',{text:'Ошибка',kind:'alert'},'15.10.2026 13:55:00','15 минут','Разобрать →'],['Резерв · MySQL',{text:'Пауза',kind:'watch'},'14.10.2026 18:00:00','15 минут','Настроить →']]);
rows.forEach((n,i)=>links.push([n,i===2?'error':'status']));
notice(p,'Нужен разовый анализ?','Загрузите Excel, CSV или Parquet. Перед расчётом можно проверить колонки и связать их со словарём.');

p=screen('choose','Добавить источник','Выберите, откуда система будет получать данные.',1,0);steps(p,0);
for(const items of [[['JSON API','Получать данные по API или принимать JSON от системы заказчика.','json'],['База данных','ClickHouse, PostgreSQL или MySQL. Подключение с правом чтения.','database']],[['Файл','Excel, CSV и Parquet. Разовая загрузка с предпросмотром.','files'],['Демо-симулятор','Синтетическая телеметрия для проверки полного пути данных.','simulator']]]){r=row(p,1152,20);for(const [title,desc,target] of items){card=panel(r,title,566);text(card,desc,526,14,'muted');btn(card,'Выбрать','secondary',target);}}
notice(p,'Один формат внутри системы','Для любого источника нужно указать идентификатор скважины, время измерения и сопоставить параметры.');btn(p,'Назад к источникам','secondary','sources',200);

p=screen('json','Подключение JSON API','Новый источник · настройки подключения',2,0);steps(p,1);
card=panel(p,'Способ обмена');r=row(card,1112);btn(r,'Получать из API','primary');btn(r,'Принимать JSON','secondary','push');
r=row(card,1112,24);field(r,'Название источника','Телеметрия промысла');field(r,'Адрес API','https://telemetry.example/api/measurements');
r=row(card,1112,24);field(r,'Авторизация','Bearer token   ▾');field(r,'Токен доступа','••••••••••••••••••••••••');
r=row(card,1112,24);field(r,'Массив записей в ответе','data.measurements');field(r,'Продолжение выборки','Курсор next_cursor   ▾');
text(card,'Будут запрашиваться новые записи после последнего подтверждённого курсора.',1112,13,'muted');
r=row(card,1112);btn(r,'Проверить подключение','secondary','mapping',228);badge(r,'Ответ получен · 200 OK');
notice(p,'Образец получен','В ответе 120 записей · 3 скважины · время содержит часовой пояс. Настройте словарь перед запуском.','successBg');
r=row(p,1152);btn(r,'Назад','secondary','choose');btn(r,'Далее: словарь полей','primary','mapping',224);

p=screen('mapping','Словарь полей источника','Телеметрия промысла · профиль «JSON промысла» · версия 1, черновик',3,0);steps(p,2);
card=panel(p,'Сопоставление и преобразование');
table(card,['Поле JSON','Параметр системы','Преобразование','Проверка'],[270,362,300,180],[['equipment.id','Скважина → внешний ID','Связать с реестром',{text:'3 найдены',kind:'normal'}],['timestamp','Время измерения','ISO 8601 · UTC → МСК',{text:'Корректно',kind:'normal'}],['values.frequency','Частота · F_out','Гц · ×1 +0',{text:'50,0 Гц',kind:'normal'}],['values.intake_pressure','Давление на приёме','кПа → кгс/см²',{text:'32,1 кгс/см²',kind:'normal'}],['values.insulation','Изоляция · R_izol','9999 → пропуск',{text:'Пропуск',kind:'watch'}],['values.pressure_setpoint','Уставка давления','Уставка · вне измерений',{text:'Уставка',kind:'watch'}]]);
r=row(card,1112);btn(r,'Добавить сопоставление');btn(r,'Проверить на образце','secondary','mapping',222);
notice(p,'Проверка образца: 120 записей','Принято 118 · отклонено 2: не указан ID скважины. Нули сохранены; 4 маркера датчика заменены пропусками.','warningBg');
text(p,'Новое поле можно сохранить для графиков. Доступность прогноза определяется требованиями модели.',1152,13,'muted');
r=row(p,1152);btn(r,'Назад','secondary','json');btn(r,'Сохранить и продолжить','primary','schedule',240);

p=screen('schedule','Сбор и запуск','Телеметрия промысла · завершение настройки',0,1);steps(p,3);
card=panel(p,'Частота получения данных');r=row(card,1112);for(const s of ['5 секунд','1 минута','15 минут','Свой интервал'])btn(r,s,s==='1 минута'?'primary':'secondary');
r=row(card,1112,24);field(r,'При первом запуске','Догрузить последние 30 суток');field(r,'После ошибки','Повторить с задержкой, сохранить позицию');
card=panel(p,'Подготовка и диагностика');r=row(card,1112,24);field(r,'Сетка для подготовки','По профилю модели');field(r,'Запуск диагностики','После обновления полного окна');
text(card,'Частота запросов, временная сетка и пересчёт риска настраиваются отдельно. Частый опрос не добавляет измерения в источнике.',1112,13,'muted');
notice(p,'Перед запуском','Источник проверен · профиль полей v1 · 3 скважины связаны · часовой пояс задан.');
r=row(p,1152);btn(r,'Назад','secondary','mapping');btn(r,'Сохранить и запустить','primary','status',230);

p=screen('status','Телеметрия промысла','JSON API · профиль v1 · обновление раз в минуту',1,1);tabs(p,'Журнал сбора');
r=row(p,1152);badge(r,'Работает');text(r,'Следующий запрос: 14:33:05',540,14,'muted');btn(r,'Приостановить');btn(r,'Настроить','secondary','json');
stats(p,[['Последний запрос','14:32:05','Успешно · 240 мс'],['Последнее измерение','14:32:00','Задержка: 5 секунд'],['Принято за сутки','86 400','Повторов: 120 · без дублей'],['Скважины','3','Все связаны с реестром']]);
card=panel(p,'Последние циклы сбора');table(card,['Время запроса','Результат','Принято','Пропущено','Пояснение'],[220,180,150,170,392],[['14:32:05',{text:'Успешно',kind:'normal'},'60','0','Новые записи сохранены'],['14:31:05',{text:'Успешно',kind:'normal'},'58','2','Без ID скважины · образец в журнале'],['14:30:05',{text:'Повтор',kind:'watch'},'0','60','Записи уже получены'],['14:29:05',{text:'Успешно',kind:'normal'},'60','0','Позиция сбора сохранена']]);
notice(p,'Данные готовы для просмотра','Расчёт риска: недостаточно истории у 1 скважины. Остальные доступны для запуска диагностики.','warningBg');
r=row(p,1152);btn(r,'Открыть телеметрию','primary','telemetry',220);btn(r,'Источники','secondary','sources');

p=screen('simulator','Демо-симулятор','Покажите поступление JSON и изменение параметров на демонстрационной скважине.',2,1);tabs(p,'Демо-симулятор');
notice(p,'Демонстрационные данные','Скважина Демо-001 · изолированный демо-источник · ускоренное воспроизведение предыстории.','warningBg');
r=row(p,1152,20);let left=panel(r,'Сценарий воспроизведения',566);field(left,'Сценарий','Постепенная деградация   ▾',526);text(left,'Другие сценарии: нормальная работа, остановка, потеря связи, сбой датчика.',526,13,'muted');field(left,'Скорость','1 секунда = 15 минут истории',526);field(left,'Отправка JSON','Каждые 5 секунд',526);r=row(left,526);btn(r,'Запустить демо','primary','telemetry',192);btn(r,'Пауза');
let right=panel(p.children[p.children.length-1],'Пример отправляемого JSON',566);
text(right,'{\n  "equipment": { "id": "demo-001" },\n  "timestamp": "2026-10-15T11:32:00Z",\n  "values": {\n    "frequency": 50.0,\n    "current_a": 31.4,\n    "intake_pressure": 3148,\n    "winding_temperature": 82.1\n  }\n}',526,14,'ink');badge(right,'Отправлено 240 записей');text(right,'Последняя отправка: 14:32:05 · профиль JSON демо v1',526,13,'muted');
notice(p,'Риск рассчитывает модель','Для демонстрации загружается предыстория. Выбор сценария не задаёт заранее значение риска.');

function plot(p,title,unit,values,options={}) {
  const w=options.w||1112,h=options.h||132;const block=box(p,title,w,'VERTICAL',null,0,4);let rr=row(block,w);text(rr,title,w-180,13,'ink',true);text(rr,unit,160,12,'muted');
  const area=figma.createFrame();created.push(area.id);block.appendChild(area);area.name='График / '+title;area.resize(w,h);area.fills=[];area.clipsContent=false;
  function rect(x,y,ww,hh,col){const n=figma.createRectangle();created.push(n.id);area.appendChild(n);n.x=x;n.y=y;n.resize(ww,hh);fill(n,col);return n;}
  const chartLeft=52,chartW=w-72;for(let j=0;j<3;j++){rect(chartLeft,12+j*(h-32)/2,chartW,1,'border');const label=text(area,String(values[0]+(2-j)*values[1]),45,11,'muted');label.x=0;label.y=3+j*(h-32)/2;}
  if(options.selection){const sel=rect(chartLeft+chartW*.42,0,chartW*.22,h-12,'selected');sel.opacity=.7;}
  const v=figma.createVector();created.push(v.id);area.appendChild(v);const points=[];for(let i=0;i<70;i++){const base=.42+Math.sin(i*.4)*.035+Math.sin(i*1.9)*.02;const trend=options.rising?Math.max(0,i-30)*.009:options.falling?-Math.max(0,i-30)*.007:0;points.push([chartLeft+i*chartW/69,Math.max(5,Math.min(h-20,(h-25)*(1-base-trend)))]);}v.vectorPaths=[{windingRule:'NONE',data:points.map((a,i)=>(i?'L':'M')+a[0].toFixed(2)+' '+a[1].toFixed(2)).join(' ')}];v.fills=[];v.strokes=[paint(options.color||'blue')];v.strokeWeight=2;
  if(options.cursor){rect(chartLeft+chartW*.62,0,1,h-12,'muted');const tip=box(area,'Подсказка',230,'VERTICAL','surface',10,2);stroke(tip);tip.x=chartLeft+chartW*.64;tip.y=4;text(tip,'15.10.2026 · 14:20:00',210,12,'muted');text(tip,options.cursor,210,13,'ink',true);}
  const axis=row(block,w,0);for(const date of options.zoom?['14:00','14:10','14:20','14:30']:['01.10','05.10','10.10','15.10'])text(axis,date,w/4,11,'muted');return area;
}
function telemetry(key,isZoom,col,rrr) {
 const p=screen(key,isZoom?'Телеметрия · выбранный участок':'Демо-001 · телеметрия','Синтетические данные · JSON демо · измерения до 15.10.2026 14:32:00',col,rrr);
 let r=row(p,1152,8);btn(r,'Обзор');btn(r,'Телеметрия','primary','telemetry');btn(r,'События');text(r,'Обновление: 5 секунд',430,13,'muted');badge(r,'Демо', 'watch');
 r=row(p,1152,12);btn(r,'Электрика','primary');btn(r,'Давления');btn(r,'Температуры');btn(r,'Вибрации');btn(r,'Дебит');btn(r,'Выбрать параметры');
 let c=panel(p,'',1152);c.itemSpacing=10;r=row(c,1112);text(r,isZoom?'15 октября · 14:00–14:30':'1–15 октября 2026 · 15 суток',630,14,'ink',true);btn(r,'Выделить участок','secondary','zoom',200);btn(r,'Сбросить масштаб','secondary','telemetry',200);
 plot(c,'Частота', 'Гц', [48,2],{h:100,selection:!isZoom,zoom:isZoom});
 plot(c,'Ток фазы A', 'А', [28,4],{h:100,rising:true,cursor:'Ток фазы A: 31,4 А',zoom:isZoom});
 plot(c,'Температура обмотки ПЭД','°C',[60,15],{h:100,rising:true,color:'warning',zoom:isZoom});
 plot(c,'Риск по окнам модели','%', [0,50],{h:80,rising:true,color:'danger',zoom:isZoom});
 text(p,'Общий курсор · выделение интервала · увеличение колёсиком · перенос по времени · пропуски показаны разрывами',1152,12,'muted');
 return p;
}
telemetry('telemetry',false,3,1);
telemetry('zoom',true,0,2);

p=screen('files','Загрузка файла телеметрии','Разовая проверка или добавление истории к подключённому источнику.',1,2);
steps(p,2);card=panel(p,'Файл и назначение');r=row(card,1112,24);field(r,'Файл','telemetry_demo.parquet · 18,4 МБ');field(r,'Назначение','Разовая проверка моделью   ▾');
text(card,'Поддерживаются Excel (.xlsx), CSV и Parquet. Для CSV можно указать разделитель и кодировку.',1112,13,'muted');
card=panel(p,'Предпросмотр и словарь');table(card,['Колонка файла','Параметр системы','Пример'],[330,440,342],[['well_id','Идентификатор скважины','demo-001'],['timestamp','Время · UTC','2026-10-15T11:32:00Z'],['frequency','Частота · F_out','50,0 Гц'],['current_a','Ток фазы A · Ia','31,4 А']]);
notice(p,'Данные проверены','15 суток · 3 скважины · 12 каналов. Проверка достаточности для модели выполняется отдельно.','successBg');
r=row(p,1152);btn(r,'Выбрать другой файл');btn(r,'Изменить словарь','secondary','mapping',200);btn(r,'Открыть графики','primary','telemetry',200);

p=screen('database','Подключение базы данных','Новый источник · чтение телеметрии из БД',2,2);steps(p,1);
card=panel(p,'Параметры подключения');r=row(card,1112);btn(r,'ClickHouse','primary');btn(r,'PostgreSQL');btn(r,'MySQL');
r=row(card,1112,24);field(r,'Название источника','Промысловая телеметрия');field(r,'Сервер и порт','telemetry.internal:8443');
r=row(card,1112,24);field(r,'База / схема','production');field(r,'Таблица или представление','telemetry_readonly');
r=row(card,1112,24);field(r,'Пользователь','pulse_reader');field(r,'Пароль','••••••••••••••••');
r=row(card,1112,24);field(r,'Защищённое соединение','TLS · проверять сертификат');field(r,'Поле продолжения выборки','measured_at + record_id');
notice(p,'Подключение с правом чтения','Сначала проверим соединение и получим образец строк. Затем сопоставим поля, скважины и единицы измерения.');
r=row(p,1152);btn(r,'Назад','secondary','choose');btn(r,'Проверить и продолжить','primary','mapping',248);

p=screen('error','Архив · PostgreSQL','Последний успешный сбор: 15.10.2026 13:55:00',3,2);tabs(p,'Журнал сбора');
notice(p,'Не удалось подключиться к источнику','Время ожидания соединения истекло. Следующая попытка через 1 минуту.','dangerBg');
stats(p,[['Источник','Недоступен','С 14:00:05'],['Последние данные','13:55:00','Данные устаревают'],['Повторные попытки','3','Позиция сбора сохранена'],['Скважины','24','Требуется восстановить сбор']]);
card=panel(p,'Что можно сделать');text(card,'Проверьте доступность сервера из сети системы и настройки подключения. После восстановления сбор продолжится с последней подтверждённой позиции.',1112,14,'ink');r=row(card,1112);btn(r,'Повторить проверку','primary','status',212);btn(r,'Настройки подключения','secondary','database',236);
notice(p,'История остаётся доступной','Графики показывают время последних измерений. Отсутствие новых данных не означает нормальную работу оборудования.','warningBg');btn(p,'К списку источников','secondary','sources',220);

p=screen('push','Приём JSON от системы заказчика','Новый источник · система заказчика отправляет измерения',0,3);steps(p,1);
card=panel(p,'Способ обмена');r=row(card,1112);btn(r,'Получать из API','secondary','json');btn(r,'Принимать JSON','primary');
field(card,'Название источника','Телеметрия от системы заказчика',1112);field(card,'Адрес приёма · пример','https://pulse.example/api/v1/telemetry/ingest',1112);r=row(card,1112,24);field(r,'Ключ источника','••••••••••••••••••••••••');field(r,'Ожидаемая частота поступления','Не реже 1 минуты');
text(card,'Для входящего потока задаётся ожидаемая свежесть данных. Интервал отправки настраивается на стороне заказчика.',1112,13,'muted');
notice(p,'Проверка тестового пакета','После получения образца можно проверить поля, единицы и связь со скважинами.');r=row(p,1152);btn(r,'Назад','secondary','choose');btn(r,'Образец получен: настроить поля','primary','mapping',304);

let linked=0;
for(const [node,target] of links) {
  let owner=node; while(owner.parent && owner.parent.type!=='PAGE')owner=owner.parent;
  if(owner.id===screens[target].id)continue;
  await node.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:screens[target].id,navigation:'NAVIGATE',transition:null,resetScrollPosition:true}]}]); linked++;
}
page.flowStartingPoints=[{nodeId:screens.sources.id,name:'Источники → подключение → телеметрия'}];
const summary=Object.fromEntries(Object.entries(screens).map(([k,n])=>[k,{id:n.id,name:n.name,width:n.width,height:n.height,texts:n.findAllWithCriteria({types:['TEXT']}).length,instances:n.findAllWithCriteria({types:['INSTANCE']}).length}]));
return {pageId:page.id,createdNodeIds:[...new Set(created)].join(' '),screens:summary,prototypeLinks:linked,editable:true};
