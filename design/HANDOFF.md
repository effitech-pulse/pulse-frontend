# Дизайн и передача рабочего интерфейса Pulse

## Портал · 21.10.2026

Актуальный пользовательский runtime — `http://127.0.0.1:8088/`. Обзор, список
и карточка перенесены в первой волне; тревоги, проверка файла, журнал,
интеграции, система и вход — во второй. Журнал сверки Light/Dark Figma, границ API и
проверок сохранён в локальном workspace: `../../tasks/pulse-frontend/docs/portal-rest-2026-10-21.md`.

Источник тестовой выборки — **Pulse Connector**. Переключение рабочих/показательных
фондов, отдельный presentation-экран и автономный demo-entrypoint удалены из
рабочего приложения. Сервер возвращает единую разрешённую выборку; клиент не
фильтрует её по историческому `fund_type`. Старые enum в HTTP/исторических данных
сохранены только для совместимости и проверки прав. В существующих аккаунтах
`scope.funds` не расширяется. Сохранённые результаты и ID не мигрируют.


Основной источник UI — [Figma «Пульс скважины — рабочий интерфейс»](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho), `file_key=km4tIbp3LnMTRrV6yi6Qho`, подтверждён пользователем 19.10.2026. [README](../README.md) содержит точный исходный URL; [DESIGN](../DESIGN.md) — токены и правила реализации.

## Сверка текущего статуса — 19.10.2026

| Область | Подтверждённая реализация | Ограничения / целевой объём |
|---|---|---|
| Оболочка/обзор | Навигация Figma 3:52, контекстная шапка, темы, профиль; обзор с показателями/очередью/качеством/последним расчётом | Перенос частичный; все макеты/разрешения/состояния ещё не приняты |
| Карточка/телеметрия | ID Pulse, текущие риски/SHAP, каналы, A/B, таблица, файлы и недостаточность данных; F1 20.10: шесть вкладок реализованы, см. ниже | Историческое ограничение F1; browser QA текущего переноса21.10 приведён выше |
| Проверки/заключения | Сохранённая ManualChecks, версия модели/входа; ReviewPanel: ответственный, комментарий, conclusion, revision/request_id и история | Единый файловый сценарий и измеряемый прогресс длительных заданий требуют отдельной спецификации |
| Отказы/жизненный цикл | IncidentsTab для события с датой; версии паспорта, архив/восстановление и история карточки | Полный процесс ремонтов и экспорт технологического отчёта не объявлены завершёнными |
| Доступ | AuthProvider, local-сеансы, роли admin/technologist/viewer и серверный scope; экран accounts | Текущий локальный Compose legacy; самостоятельная регистрация, восстановление и OIDC ещё не подключены |
| Журнал/уведомления | HTTP-аудит, отдельные histories проверок/review/карточки, колокольчик текущей очереди | Общая предметная лента, прочтение/доставка/история уведомлений и почтовые рассылки не завершены |
| Реестр/агрегаты | Фильтры/сортировка, импорт/экспорт и архив; эксплуатационные счётчики по реализованным API | Единый пользовательский набор из 100 скважин и полная эксплуатационная статистика требуют дальнейшей работы |

Основания: `src/auth/AuthProvider.tsx`, `src/api/access.ts`, `src/components/telemetry/ManualChecks.tsx`, `src/components/wells/IncidentsTab.tsx`, `src/components/wells/WellHistoryPanel.tsx`, `src/pages/WellDetailPage.tsx`. Межмодульный [статус](../../pulse-backend/docs/project-handbook/chapters/02-status.md) и [traceability](../../pulse-backend/docs/project-handbook/chapters/19-traceability.md) находятся в соседнем backend; в standalone checkout локальные README/DESIGN и исходники остаются доступными без grant.

## Правила рабочего UI

### F1 — передача 20.10.2026

| Узел / состояние | Figma Light / Dark | Реализация / проверка |
|---|---|---|
| Существующие исходные карточки | `3:53` / `136:470` | Сохранены без изменения |
| Риски + шесть вкладок | `696:328` / `696:1766` | `WellDetailPage`: прежние риск/окна/ExplainBars, идентичный selected run; 37 тестов PASS, build PASS |
| Сведения | `696:528` / `696:2040` | Все 8 полей Descriptions, классификация и таблица осложнений перенесены; ошибки классификации видны вместо немого «—» |
| Мобильная строка 390px | `696:713` / `696:2299` | Ant Tabs с клавиатурой/локальным перемещением, тема фокуса, reduced motion; таблица осложнений scroll x=560 |
| Ошибка + код обращения | `696:733` / `696:2319` | `PageSpin`, `toApiError`: валидный header 16–64 safe ASCII; отдельный текст, без body fallback / подмены бизнес request_id |
| Loading / empty / insufficient / archived / inactive / forbidden | Прежние состояния компонентов; F1 меняет размещение | Существующие PageSpin/Empty/объяснения/архивный notice; unit проверяют честные null и отсутствие выдуманных графиков/SHAP |
| Saved check / 409 / роли | Существующие ManualChecks/ReviewPanel/IncidentsTab/WellHistoryPanel | Формы и API не менялись, visited panels сохраняются; реальные mounted/browser сценарии в финальном прогоне координатора |

Ссылки на варианты: `https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=<id-с-дефисом>`. Новые варианты показывают только согласованную F1 композицию, исходные графики и демо-значения не являются рабочими ML-данными. Оболочка, существующие графики/формы и их прежние расхождения с макетом вне F1 не перерабатывались; полное пиксельное соответствие всего приложения не заявляется.

Инвентарь: шапка сохраняет ID/номер/НГДУ/статус и admin-ссылку источников; Риски сохраняют два существующих блока оценки и окон; Телеметрия, Проверки, Отказы и История повторно используют прежние компоненты; в Сведения перенесены паспорт, классификация и осложнения. Нет новых writes, API, jobs или ML fallback. Старые URL keys и run/check сохранены; пользовательский переход push с Back/Forward, unknown→overview без переписывания остального URL.

Браузерный harness подготовлен координатору в `/private/tmp/pulse-o1-f1-20261020/f1-browser.cjs` (не исходник продукта): фактические saved run30/32 и saved check; обе темы 1440→390→1440, local scroll/focus, query/hash/history/reload, archived/inactive, scoped роли. HTTP error/transport и 409 retry отдельно помечены controlled fixtures; 409 перехватывает PUT и не изменяет backend. На момент передачи harness проверен `node --check`, но ещё не выполнен на новой assembled сборке. Предыдущий PREP browser PASS не подменяет этот этап.

Оценка модели, ярус и обработка независимы; подозрение не равно фактическому отказу. Недостаточность данных не равна норме. Качество на обзоре относится к последнему окну модели, а не к текущей связи. Порог и число окон читаются из метаданных; низкий последний риск не сбрасывает накопленный ярус.

Пропуски показываются разрывами, валидные нули сохраняются. Заполненный признак не называется реальным измерением; value_source и неизвестный источник старого ответа показываются честно. ID Pulse отличается от внешних идентификаторов. При 409 UI сохраняет черновик и показывает конфликт, не повторяет изменение с новой revision незаметно. Закрытие уведомления не меняет заключение.

## Исторические макеты и прототипы

Исходный handoff предшествовал переносу рабочих возможностей. Он перечислял роли, ответственного, комментарии/историю и событие отказа как будущие API-дополнения; теперь их статус приведён в таблице выше. Расширение v4: [бизнес-сценарии](v4/BUSINESS_CASES.md), [экраны/границы](v4/README.md). Макеты 1440/1280/1024, их значения демонстрационные.

Архивный прототип иллюстрировал путь «обзор→скважина→форма→результат→очередь», без настоящего ввода/загрузки/сохранения. Правило автоматического скрытия попапов через 4 секунды относилось к этому прототипу, а не к надёжной обработке уведомлений приложения. Figma-переходы не доказывают работу API, серверной истории или доставки.

## История проверки и оставшаяся приёмка

Запись прохода **18.10.2026**: production TypeScript/Vite build, 11 тестов импорта/экспорта/фильтров; browser QA оболочки, обзора, Light/Dark и текущей очереди через Docker. Это сохранённое свидетельство того прохода, не новый запуск всех проверок в рамках DOC-02. Исторический профиль8080 выведен из эксплуатации21.10.2026; актуальный портал: `http://127.0.0.1:8088/`. Автопрогон выключен.

Для следующего UI-изменения designer согласует с architect-analyst контракт и границы, затем фиксирует проверку рабочих сценариев, тем, разрешений и всех состояний. Полная сверка Figma, доступность, публичный onboarding, рассылки и эксплуатационная статистика остаются отдельными критериями. Очередь A изменяет документацию и не запускает эти продуктовые фазы.

## Q1/F2 — сохранённый synthetic file flow, 21.10.2026

Функциональная адаптация существующей композиции согласована. Новые F2 live variants
остаются OPEN; их наличие/синхронизация с Figma не заявляются.

Реализация: `FileJobUpload` использует исходный File, явные parsing/mapping поля и
ограниченный локальный preview. `fileJobsApi` обращается только к dedicated endpoints,
сохраняет well ID строкой и небезопасные JSON int64 без округления. StableFileSubmission
удерживает один request_id для неизменной операции при double click/потере 202.
`FileJobPanel` различает accepted/pending/queued/running/retry_wait/cancel_requested и
terminal states; status GET не вычисляет ML. Poll 2с→5с после минуты, network backoff≤30с,
pause hidden, refresh focus/online. Отмена — отдельный POST, не AbortController.

`ManualChecks` разделяет q1/period reader до запросов; file history и period history не
смешивают данные/курсоры. `SavedFileCheckResult` сохраняет null/0/false/value_source,
insufficient и provenance/decision rule в typed ответе. Review переиспользует текущую
форму на dedicated path; 409 сохраняет комментарий и поля, явная загрузка серверной
версии меняет revision для следующего осознанного сохранения.

AuthProvider размонтирует subtree при новом session epoch; file-запросы получают abort
signal и проверяют epoch перед применением ответа. Login/logout/401/изменение actor,
роли/scope очищают private cache и память. Private 403/404 закрывает private subtree до
нового входа; разрешённые period checks остаются доступны. Sidebar допускает технолога
на file page; feature off оставляет legacy sync admin-only.

Source/unit/build и browser evidence фиксируются отдельно. Успешная сборка не является
визуальной приёмкой, synthetic backend proof или проверкой всех состояний. Подробные
рабочие артефакты QA находятся вне product checkout в каталоге задач workspace.

## RBAC · передача source 23.10.2026

Владелец source: designer; реализация передаётся frontend-developer через
координатора. Постоянные ручные группы и навигация внутри «Системы» приняты
пользователем. Source создан до React; таблица 20 frames с Light/Dark/390px
ссылками и размерами — в [DESIGN](../DESIGN.md). Исходные `833:3319` / `833:4204`
сохранены, новые варианты редактируемые. Наличие макетов не активирует RBAC.

### Визуальная основа

Pulse Button `745:333`, Input `746:330`, Select `746:397`, Checkbox `746:535`,
Card `747:340`, Table row `747:369`; Roboto и существующие text styles/semantic
variables коллекции «Пульс / Токены». Scoped adaptations
[883:2396](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=883-2396)
исправляют text property bindings и размеры, сохраняя исходный дизайн-кит.

При 1440px sidebar 224px, workspace 1216px, content 1152px; panel padding 20px,
внутренняя таблица 1112px, header 44px, sample data row 80px. Длинный runtime
контент может увеличить высоту строки. Title 28/40, body 14/20, радиус 4px;
section gap 20px страницы / 16px формы, поля и действия 44px. В новых полях border
использует muted (4.77:1 на white), focus — blue. Новые подписи на canvas
используют ink: muted/canvas 4.37:1 ниже цели. Primary blue/white — 4.55:1.

User editor: drawer `min(600px, 100vw)`. Его 1418px source — весь прокручиваемый
контент, а не высота viewport. Role/group editor — композиция 760px, preview —
960px с ограничением viewport. Footer внутри overlay не перекрывает focus;
scroll padding учитывает его высоту. Большой каталог прав открывается в полном
представлении с возвратом, без вложенного drawer.

### Навигация, полномочия и API

- «Система / Управление доступом», один ряд «Пользователи · Группы пользователей ·
  Роли». Только разрешённые вкладки и queries; при единственной вкладке лишний
  переключатель не нужен. Вкладка, поиск и карточка поддерживают ссылку и Back.
- Чтение определяется `users.read`, `roles.read`, `groups.read`. При
  `access_model=legacy` новый editor недоступен. Enum `role` не авторизует UI.
- User metadata/status/password требуют `users.update`; direct roles —
  `users.roles.assign`; membership — `users.groups.assign`; org —
  `users.scope.assign`, с prerequisites. Без permission поле read-only и payload
  сохраняет текущие назначения. Create требует явного org, без `none`.
- Role/group definitions требуют manage + `access.manage_global`. Local manager
  меняет безопасное membership человека из user form. Group members требуют
  также `users.read`; чужие IDs/total/counts не раскрываются.
- Подразделение задаёт данные, роли — действия, группа — совместное назначение
  ролей. Смена НГДУ сбрасывает старый цех. Scope/direct/group changes сохраняются
  одним Apply, без автоматического повышения. Существующая reference pair без
  wells допустима. Технические `scope`/`funds` UI не редактирует.
- Legacy org показывается с расшифровкой; обычная правка опускает Organization.
  Existing `none`/сложную область явно исправляет global manager. Сохраняются
  null/[]/0. IDs/revisions/epochs нового DTO — decimal strings.
- Assignments/account projections содержат actual direct roles и groups,
  включая пустые. Не восстанавливать их из `permission_sources`; sources
  объясняют права и сохраняют все пути. Нет implicit viewer при отсутствии ролей.
- Только server search/limit/opaque cursor/revision; нет глобальных status/org/
  role/group фильтров по одной странице, bulk или произвольного page number.
  Counts берутся из ответа сервера, unknown — «—».
- Полная замена `MemberIDs` группы требует baseline всех cursor pages на одной
  revision. Поиск не снимает невидимых участников. До полной загрузки baseline
  запись состава блокируется; stale cursor требует явного обновления с draft.

### Предпросмотр и состояния

User/role/group, включая metadata-only: «Проверить изменения» → read-only preview
→ «Применить изменения». Любая правка draft сбрасывает receipt. Modern write
идёт в соответствующий endpoint; generic apply endpoint не предполагается.
Пароль передаётся отдельно при записи, не попадает в preview/Change/audit/URL/storage.

Preview содержит before/after assignments, права, scope и все источники. Пустая
роль/группа видна как изменение назначения при прежнем union. Счётчики не
суммируются: `AssignedUsers` — уникальные before OR after; `ChangedUsers` —
permissions, org/funds или active; `DisabledUsers` — inactive after среди
затронутых. Labels: «Затронуто пользователей / Права изменятся / Среди затронутых
отключены». Sources-only/name/password могут завершить сеанс при нуле ChangedUsers;
Apply `AffectedUsers` означает invalidation count. `SelfAffected` выделяется.

Для group/role: «Подразделения участников не изменятся». Пользователь видит
предупреждение о завершении затронутых сеансов. 409 сохраняет допустимый draft и
предлагает «Обновить предпросмотр», без скрытой записи с новой revision. Удаление
назначенной роли не становится forced cascade. Last-manager отказ объясняется
полным набором полномочий и active, а не названием «Администратор».

| Состояние | Light / Dark node | Поведение |
| --- | --- | --- |
| Loading | `883:2872` / `890:4231` | Skeleton; unknown «—»; запись ждёт baseline/options |
| Empty search | `883:2879` / `890:4234` | Отличается от ошибки/первого запуска, «Сбросить поиск» |
| Error | `883:2886` / `890:4237` | Inline retry, не пустой список |
| Forbidden | `883:2893` / `890:4240` | Без закрытых участников/counts, stale subtree закрывается |
| Conflict 409 | `883:2900` / `890:4243` | Draft и явное обновление preview |
| Last manager | `883:2903` / `890:4246` | Понятный серверный отказ |
| Disabled/focus/legacy org/local | `880:1935` / `890:4227` | State board с variants и правилами |
| Direct/inherited/transfer | `880:1931` / `890:3919` | Org, direct и group отдельно; inherited read-only |
| Mobile list/form | `880:1936`, `880:1937` / `890:4293`, `890:4333` | 390px, controls 44px, целые labels |

Неопределённый сетевой результат Apply требует перечитать данные, а не заявлять
неуспех и повторять запись вслепую. 401/epoch change очищает private cache/draft/
receipt; поздний ответ не возвращает их в DOM. Успех — после server Apply.
Audit открывается по собственному разрешению, не по одному management permission.

### Адаптация, доступность и приёмка

Существующие breakpoints shell: sidebar ниже 992px, content padding 32/24/16px
по текущему CSS. Narrow toolbar/поля — одна колонка; tabs прокручиваются локально
с видимыми selection/focus. Имя, org и статус первичны, наборы grants раскрываются
в карточке. Group/preview table scroll локален; документ не растёт по горизонтали.
Форма и preview ограничены viewport. 390px показывает полный контент; 320/768/
1024/1280 и zoom 200% проверяются на реализации.

Tablist/tab/tabpanel с Arrow/Home/End, labels и accessible names обязательны.
Drawer переносит/удерживает/возвращает focus; dirty close предлагает продолжить
либо отменить draft. Escape не означает Apply. Validation summary ведёт к полю.
Loading/success — polite announcement; ошибки не исчезают по таймеру. Статусы
обозначаются текстом; touch ≥44px, sticky действия не скрывают focus. Reduced
motion отключает необязательные переходы. Статический Figma не доказывает runtime.

Source self-check обеих тем и mobile выполнен: 902 nodes / 370 texts / 128 instances
по теме, Roboto-only, 0 image fills, Dark mode `128:0`. Clipping и disconnected
text properties исправлены scoped компонентами. Original kit и System сохранены.
Измерены конкретные сочетания токенов, полный WCAG-аудит не заявляется.

Перед реализацией координатор сверяет финальный HTTP DTO backend Task 4.
Последующие проверки: frontend tests/build, grants/transfers/empty assignments,
membership cursor preservation, stale preview, last manager, 401 cleanup,
Light/Dark, keyboard/zoom/contrast/reduced motion и runtime visual match.
