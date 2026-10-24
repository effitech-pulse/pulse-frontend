# Дизайн рабочего интерфейса Pulse

## Портал · 21.10.2026

Актуальный пользовательский runtime — `http://127.0.0.1:8088/`. Обзор, список
и карточка перенесены в первой волне; тревоги, проверка файла, журнал,
интеграции, система и вход — во второй. Журнал сверки Light/Dark Figma, границ API и
проверок сохранён в локальном workspace: `../tasks/pulse-frontend/docs/portal-rest-2026-10-21.md`.

Источник тестовой выборки — **Pulse Connector**. Переключение рабочих/показательных
фондов, отдельный presentation-экран и автономный demo-entrypoint удалены из
рабочего приложения. Сервер возвращает единую разрешённую выборку; клиент не
фильтрует её по историческому `fund_type`. Старые enum в HTTP/исторических данных
сохранены только для совместимости и проверки прав. В существующих аккаунтах
`scope.funds` не расширяется. Сохранённые результаты и ID не мигрируют.


Статус сверки: 19.10.2026. Основной источник UI — [Figma «Пульс скважины — рабочий интерфейс»](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho), `file_key=km4tIbp3LnMTRrV6yi6Qho`. Пользователь подтвердил файл 19.10.2026; исходная ссылка сохранена в [README](README.md). Наличие макета не означает готовность API. Изменение документации не меняет live Figma или React.

## Текущая реализация

Светлая навигация, синий акцент, компактная типографика, радиус 4 px и спокойные границы; цвета тревоги/нормы сохраняют семантику. Общая композиция навигации, контекстная шапка, темы и обзор фонда перенесены из Figma 18.10.2026: полоса показателей, очередь внимания, качество данных и последний расчёт. Данные приходят из API; числа макетов не копируются в рабочие ответы. Это частичный перенос, а не визуальная приёмка всех экранов.

Токены: `src/theme/designTokens.ts`; Ant Design: `src/theme/antdTheme.ts`. ThemeProvider сохраняет выбор, Roboto хранится локально. Полные формы и состояния фокуса/загрузки/ошибок проверяются на реализованном приложении, а не выводятся из наличия Ant Design.

В коде есть Access/AuthProvider, сохранённые ManualChecks, ReviewPanel с комментариями/историей, регистрация инцидентов и WellHistoryPanel для жизненного цикла. Local RBAC реализован; документированный локальный Docker остаётся legacy. Профиль отображает серверные права; колокольчик показывает текущие новые тревоги и ошибки источников. Полная доставка/прочтение уведомлений не реализованы.

## Целевые и исторические материалы

[HANDOFF](design/HANDOFF.md) разделяет рабочие возможности и незавершённый перенос. [v4/BUSINESS_CASES](design/v4/BUSINESS_CASES.md) и макеты v3/v4 — продуктовые цели и прототипы; их формы регистрации/рассылок/статистики не объявляются работающими API. Общая цель — перенос рабочих состояний и разрешений с сохранением реальных данных, ошибок и прав.

Следующие цели описаны в [статусе handbook](../pulse-backend/docs/project-handbook/chapters/02-status.md) и [traceability](../pulse-backend/docs/project-handbook/chapters/19-traceability.md) соседнего backend: единый фонд/Connector, порядок карточки, общий файловый сценарий, предметный журнал, приёмка входа, уведомления и остальные экраны. Для standalone checkout эти межмодульные документы доступны после получения backend; локальная точка входа остаётся README/HANDOFF. Очередь документации A не разрешает реализацию этих продуктовых фаз.

## Проверка изменений

### F1 — карточка существующего результата, 20.10.2026

Одобренная композиция отражена в Figma до реализации. Исходные `3:53` и dark `136:470` сохранены; версии F1: [Риски Light](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=696-328), [Сведения Light](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=696-528), [Риски Dark](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=696-1766), [Сведения Dark](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=696-2040). Это ограниченные варианты карточки; значения в макете демонстрационные.

React использует Ant Tabs в порядке Риски→Телеметрия→Проверки→Отказы→История→Сведения. `overview` сохранён для Рисков; неизвестная/отсутствующая вкладка открывает Риски. Переключение добавляет запись истории и сохраняет все query-параметры и hash. Посещённые панели остаются смонтированы; их формы, права и выбранная сохранённая проверка продолжают использовать существующие компоненты.

Паспорт, классификация и осложнения находятся в Сведениях; ID Pulse, номер, НГДУ и статус остаются в шапке. Паспорт показывает текущую карточку, а не её состояние на дату выбранного ML run. Риски, история окон и объяснение используют прежние immutable результаты, peak/latest/value_source и null-семантику. Вкладки не запускают новый расчёт.

Мобильная строка: Light `696:713`, Dark `696:2299`; адаптация использует прокрутку/клавиатуру Ant Tabs, существующие ограничения ширины и локальную прокрутку таблицы осложнений. Фокус использует цвет темы; reduced motion отключает переходы строки вкладок. Ошибка: Light `696:733`, Dark `696:2319`; отдельная строка «Код обращения» появляется только при безопасном response header `X-Request-ID`, не из тела или бизнес-поля `request_id`.

Новый source-level прогон: `npm test` — 37 PASS; `npm run build` — PASS. Финальная проверка браузером относится к собранному из этих исходников изолированному профилю `8088/8018`; до её выполнения полное визуальное соответствие не заявляется. Матрица и ограничения — в HANDOFF.

`npm test` проверяет чистые функции данных, `npm run build` — TypeScript/Vite. Визуальная проверка требует обеих тем, рабочих разрешений 1440/1280/1024 и состояний loading/error/empty/insufficient/conflict/forbidden. Результаты отдельных проходов и незакрытые состояния фиксируются в HANDOFF; полное соответствие Figma и WCAG не объявляется по одной успешной сборке.

### Q1/F2 — функциональная адаптация файлового сценария, 21.10.2026

Существующие upload grid/dropzone/result cards, Ant Input/Select/Table/Button/Alert/Spin
используются для capability-gated synthetic flow. Новый shell, палитра и визуальная
композиция не вводятся. В «Проверках» последовательные секции «Проверки за период» и
«Мои проверки файлов» используют независимые cursor stacks. Pending/running/retry/cancel
показываются текстом в одной polite/atomic status region, без прогресса в процентах и ETA.
Файл, parse spec и комментарии находятся только в памяти текущего сеанса.

Источник UI остаётся Figma. Новые live F2 variants не созданы и не прочитаны; синхронизация
Figma и полное визуальное соответствие не заявляются. Source anchors: upload `3:54`,
result `337:5542`, error `19:1898`, insufficient `19:1928`, processing `19:1958`.
`363:2057` описывает подготовленный export, не успешный результат ML.

## Управление доступом · RBAC · 23.10.2026

Новая композиция отражена в Figma до React: «Система / Управление доступом»,
вкладки «Пользователи · Группы пользователей · Роли». Исходные System `833:3319`
и `833:4204` сохранены. Это source для реализации; наличие макетов не включает
RBAC editor или backend enforcement.

| Поверхность / размер | Light | Dark |
| --- | --- | --- |
| Пользователи · 1440×1024 | [880:1502](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=880-1502) | [890:3428](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=890-3428) |
| Группы · 1440×1024 | [880:1645](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=880-1645) | [890:3595](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=890-3595) |
| Роли · 1440×1024 | [880:1788](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=880-1788) | [890:3752](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=890-3752) |
| Пользователь / перевод · 600×1418 | [880:1931](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=880-1931) | [890:3919](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=890-3919) |
| Редактор роли · актуальный 24.10 · 1440×1024 | [923:2520](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=923-2520) | [927:5116](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=927-5116) |
| Редактор группы · актуальный 24.10 · 760×1063 | [923:2722](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=923-2722) | [927:5598](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=927-5598) |
| Предпросмотр · 960×977 | [880:1934](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=880-1934) | [890:4152](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=890-4152) |
| Состояния и правила · 1440×1427 | [880:1935](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=880-1935) | [890:4227](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=890-4227) |
| Пользователи · 390×976 | [880:1936](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=880-1936) | [890:4293](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=890-4293) |
| Пользователь / перевод · 390×1492 | [880:1937](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=880-1937) | [890:4333](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=890-4333) |

Roboto, плоские панели, радиус 4px и Ant controls сохранены. Использованы
существующие Pulse semantic variables и text styles. Локальные адаптации
[883:2396](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=883-2396)
исправляют переносы и связи text properties таблиц/полей; исходный kit не меняется.
По теме: 906 nodes, 372 текстовых слоя, 129 instances, 0 image fills.

Контраст muted/canvas в Light — 4.37:1; новые подписи страницы и mobile footer
используют ink. Muted/surface — 4.77:1, primary blue/white — 4.55:1. Границы новых
адаптированных полей используют muted, фокус — theme blue; disabled выделен
отдельно. Это проверка конкретных токенов, а не WCAG-аудит всего приложения.

Персональный org отделён от direct/group grants. Поиск и cursor pages опираются
на сервер; глобальные фильтры по одной странице и bulk отсутствуют. Preview,
Apply, actual assignments и состояния описаны в [HANDOFF](design/HANDOFF.md).

Source visual self-check обеих тем и 390px выполнен. HTTP DTO сверены с реализацией:
новый user UI использует строковые `access_id` / `access_revision`, сохраняя старые
числовые поля для совместимости; назначения приходят в flattened projections.
В списке групп без серверного member count показывается «—», а не число макета.
Preview search фильтрует серверные строки до пагинации; общие счётчики и
fingerprint не меняются. Точные wire shapes и staged ответы — в HANDOFF.
Browser QA, keyboard/zoom, runtime reduced motion и интеграция проверяются при реализации. Имена и значения
макетов иллюстративны, в API/runtime не копируются.

### Редактор ролей · 24.10.2026

Актуальная форма создания/редактирования/копии роли и её Preview расположены
в main content System shell. Source form Light `923:2520` / Dark `927:5116`,
mobile `923:2720` / `927:5415`, Preview `923:2620` / `927:5274` в прежнем Figma
`km4tIbp3LnMTRrV6yi6Qho`. Это заменяет прежнюю checkbox-форму роли в Drawer;
user/group drawers и списки сохраняют прежнюю композицию.

Форма: название, необязательное описание, повторяемые строки «Ресурс →
Привилегии» с exact server keys и множественным выбором. Resource уникален;
смена ресурса сбрасывает только действия его строки. «+ Добавить привилегии» —
лёгкое blue text/link действие без рамки/fill, с 44px tap area. Строки сохраняют
локальные IDs через Preview/Back/409; даже пустая добавленная строка делает
форму dirty и инвалидирует receipt. Ноль строк допустим, незавершённая строка
требует заполнения или удаления. Unknown/ungrantable existing keys показываются
read-only и сохраняются; prerequisites не добавляются автоматически. Новые
options проверяют raw actor key и его транзитивные prerequisites по каталогу.

Scoped resource/action controls используют Ant Design, существующие Roboto и
semantic tokens; поля44px, metadata720px max-width100%, resource280px на desktop,
под768px строки вертикальные. Chips переносятся, Preview table имеет локальный
scroll. Group source `923:2722` / `927:5598`: role picker удалён, existing
role_ids сохраняются неизменными, new group []; membership не перепроектирован.

Клавиатура соответствует установленным Ant Design5.29.3 / rc-select14.16.8:
ArrowUp/Down, Enter, Escape и typing search; кнопки сохраняют стандартный Tab и
Enter/Space. Home/End не переводят active option в начало/конец списка, а следуют
нативному поведению поискового input. Это принятое ограничение, без custom
wrapper/private API. Focus после Add/Remove, Preview heading и возврата к
редактированию/списку проверен в runtime. Native zoom200%, SR и полный contrast
аудит не заявляются.

## Профиль сотрудника и страницы пользователя · 24.10.2026

Источник новых поверхностей в том же Figma: [профиль Light976:3547](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=976-3547), [редактирование Light976:3667](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=976-3667), [создание Light976:3895](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=976-3895).

Пользователь открывается на `/system/access/users/new` либо
`/system/access/users/:id/edit`. Три последовательные секции: «Сотрудник»,
«Учётная запись», «Доступ». Плоские панели до960px, поля до560px, Roboto,
существующие semantic tokens, интервалы20/16px и44px controls. Рабочие
организация/подразделение/отдел независимы от области скважин; multiple roles,
группы и источники прав сохранены. Проверить→Применить использует общий поток
AccountsPage. Нулевое влияние на права не скрывает profile diff и не блокирует
Apply при действующем receipt. Влияние на сеансы определяется сервером.

`/people` и `/people/:id` используют отдельную безопасную проекцию, включая
nullable место работы и руководителя. Логин и security-поля туда не переносятся.
Имя в управленческом списке ведёт в безопасный профиль, «Настроить» — в редактор.
Новый пункт «Сотрудники» доступен authenticated local-сеансу без management прав.
Список сохраняет существующие table/mobile card conventions; role/group UI
не перерабатывается. Проверки и ограничения runtime перечислены в HANDOFF.

Новые Light desktop source проверены designer после исправления высоты TEXT.
Directory/Dark/mobile Figma variants остаются OPEN: транспортная ошибка не
позволила подтвердить выполнение batch. Новых IDs этих вариантов не заявляем.
Dark/adaptive реализация следует существующим Pulse-токенам и переданным
правилам; её browser QA отдельно выполняет координатор.

### Восстановленный source · актуально после передачи v2

Прежний OPEN-статус Figma выше закрыт designer recovery. Новые проверенные
узлы: каталог Light981:3743/Dark981:4409; desktop профиль Dark981:3891,
редактирование Dark981:3997, создание Dark981:4203; mobile профиль
Light981:4534/Dark981:4640, mobile редактор Light981:4746/Dark981:4952.
Предыдущие Light IDs сохранены. Каталог остаётся безопасной проекцией;
мобильные карточки содержат руководителя и его safe link/status либо «Не указан».
Изменения независимого ревью сохраняют источники: возврат из профиля — единая
44px ссылка; checkbox каталога имеет локальное row alignment без изменения
стилей labels прочих разделов.

### Сворачиваемые секции пользователя · 24.10.2026

Три верхние секции create/edit независимо скрываются native details/summary,
изначально открыты; содержимое остаётся смонтированным. Заголовок16/22 и действие
«Скрыть»/«Отобразить»13/19 составляют одну44px цель. Использованы те же source
edit976:3667/981:3997, create976:3895/981:4203, mobile981:4746/981:4952;
[320px Light1016:4237](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=1016-4237)
и [Dark1016:4396](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=1016-4396)
показывают закрытое состояние. Токены и остальные разделы сохранены.

### Автоматическая структура сотрудников · 24.10.2026

Новый read-only вид «Структура» рядом со «Списком» в `/people`: source file
km4tIbp3LnMTRrV6yi6Qho, desktop Light1022:4253/Dark1022:4481,
mobile Light1022:4671/Dark1022:4885, row family1022:4226 и long320 proof1022:5099.
Организация→подразделение→отдел→сотрудники производятся сервером из профилей.
Это не дерево руководителей и не область скважин. Изначально «Список»,
организации в структуре свёрнуты; поиск не раскрывает ветви автоматически.

Один complete snapshot API, counts текущей отфильтрованной выборки, отдельные
null placeholders и точные серверные keys. Строки auto-height с44px минимумом,
indent12px/уровень и52px switcher-space листа. Перенос длинных строк сохраняет
весь текст. Измеряемая virtual window ограничивает DOM при переменной высоте,
focused row остаётся смонтированным вне окна. Токены/Roboto и прежний список
сохранены; новые растровые assets/библиотеки не добавлены.


## Графическая структура сотрудников · 24.10.2026

Актуальный renderer `/people` → «Структура» — карточки с линиями по workplace,
вместо исторического списка с отступами. Figma file `km4tIbp3LnMTRrV6yi6Qho`,
wrapper1033:4536: [Light1440](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=1034-4566),
Dark1440 1037:4652; Light390 1037:4821 / Dark390 1037:4994;
long320 Light1037:5168 / Dark1037:5188; card family1034:4540.
API/complete parser/people query/auth/errors/list/profile/editor сохранены.

Card248world, minheight88; обычный branch110/employee88, padding12top/sides8bottom,
border1/radius12, gap104 между subtree,24 между уровнями/сотрудниками и left rail24.
Parent над первой дочерней колонкой; сотрудники отдела одной вертикальной колонкой,
общий rail связывает их с отделом. Full raw strings wrap, autoheight измеряется в
world units. HTML native branch button / employee Link и декоративные SVG connectors
используют один geometry;2D card/edge clipping + один pinned active ограничивают DOM.
5000 сотрудников могут дать20000 logical nodes; нет paging/discard/fake root.

Первый существующий org/div/dept путь раскрыт при100%; соседние branches закрыты.
Zoom50–200%, step25, toolbar44px вне transform; min88world даёт44screen при50%.
«По центру» →100% activecard, иначе initialpath, без сброса expansion/query/focus.
Viewport640desktop/520mobile имеет внутреннюю2D прокрутку; background mouse drag
после5px threshold, native scroll/touch и browser zoom сохранены. Управление tree
клавиатурой использует preorder; отложенные measurements уточняют target camera,
wheel/pointer/touch/выход focus снимают keyboard intent. Измерения mounted карточек
применяются одной пачкой на animation frame, чтобы mount→measure→camera не создавал
неограниченную вложенную цепочку React commits; cleanup отменяет позднюю пачку.
Private/query scope remount
сбрасывает локальную camera/expansion/measurements; snapshot refresh сохраняет
surviving active key. Независимое CUA проверяет geometry/focus/scroll/темы/320/390;
unit/SSR не заменяют браузерное evidence. Новых raster assets/dependencies нет.

Scaled spacer ограничивает overflow внутренних world/SVG точными logical bounds;
viewport-sized SVG overlay не расширяет native scroll extent вслед за camera.
Zoom clamp по scaled bounds и reveal active после world-center anchor сохраняют
активную карточку видимой, включая collapsed forest, который уже viewport.
