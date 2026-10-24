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
  null/[]/0. Новые access identity/revision/epoch — decimal strings; старые
  числовые поля не меняют JSON shape (точный mapping ниже).
- Direct role и group selectors поддерживают **множественный выбор**: `RoleIDs` /
  `GroupIDs` — массивы, выбранное видно chips и checkbox selection. Удаление
  одного chip снимает только это назначение; inherited roles остаются read-only.
  Single-select старого трёхзначного legacy enum здесь не используется.
- Assignments/account projections содержат actual direct roles и groups,
  включая пустые. Не восстанавливать их из `permission_sources`; sources
  объясняют права и сохраняют все пути. Нет implicit viewer при отсутствии ролей.
- Только server search/limit/opaque cursor/revision; нет глобальных status/org/
  role/group фильтров по одной странице, bulk или произвольного page number.
  Counts берутся из ответа сервера, unknown — «—».
- Полная замена `MemberIDs` группы требует baseline всех cursor pages на одной
  revision. Поиск не снимает невидимых участников. До полной загрузки baseline
  запись состава блокируется; stale cursor требует явного обновления с draft.

### Подтверждённый HTTP shape · 23.10.2026

Сверены OpenAPI и действующие transport/domain/service/read projections.
Основные DTO уточнены документацией. Единственное дополнение source —
согласованный поиск над таблицей Preview, без смены существующих frame IDs.

| Значение | Фактический wire и использование |
| --- | --- |
| User identity / revision | `access_id`, `access_revision` — точные decimal strings в Account-shaped ответах и authenticated self/login `principal`. Row key, user URL и `change.user.id/revision` используют именно их. Старые `Account.id/revision`, `Principal.account_id` остаются JSON numbers; не преобразовывать их в canonical ID через `String()`/`Number()` после возможного округления. |
| Role/group identity | `id`, `revision` в role/group/summary/membership — decimal strings; `role_ids`, `group_ids`, `member_ids` состоят из строк. Org reference IDs тоже строки, включая `"0"` и отрицательные значения. |
| Назначения | В HTTP нет отдельного `assignments`: flattened `role_ids`, `direct_roles`, `group_ids`, `groups`, уникальные `roles` сохраняют actual empty roles/groups. `permission_keys` / `permission_sources` описывают union/provenance; массивы и map не null. |
| Список пользователей | `GET /api/v1/auth/users?access_version=1` → `{items,next_cursor,total_visible,graph_revision}`. Без version сохраняется старый Account[] protocol. Новая карточка — `GET /api/v1/auth/users/{access_id}`. |
| Участники группы | `GET /api/v1/auth/groups/{group_id}/members` → та же account-shaped page, включая canonical user fields, но только доступные управляющему участники. |
| Groups/roles | List/detail содержат определения и IDs назначений; `AccessGroup`/`AccessRole` не содержат aggregate member/dependency counts. В списке групп неизвестный count — «—»; в открытой разрешённой member page используется её `total_visible`. После поиска это count совпадений, а не всего состава. Не делать fan-out чтение всех участников ради колонок списка и не вычислять total из загруженных rows. |

Self/session, managed card/list и group-member page используют согласованные
account/authorization views; frontend не обогащает ответ отдельными management
queries для реконструкции grants. Own role/group summaries могут быть доступны
в self при недоступном assignable definition — их наличие не открывает editor.
Четыре read операции реализованы `AccountViewStore` и `GroupMemberViewStore`.

Preview: `POST /api/v1/auth/access/preview` с `{access_version:1,change}`;
`change` содержит ровно один user/role/group variant, пароль отсутствует.
Handler принимает `search`, `limit` (default 50, max 100), `cursor`,
`graph_revision` через query. Согласованный поиск «Поиск по имени или логину»
фильтрует только `items` **на сервере до пагинации**; общие impact counters и
fingerprint сохраняются для всего изменения. Поиск сбрасывает cursor, но не draft
или receipt; очистка возвращает полный список последствий. Клиентский поиск по
одной загруженной странице не добавляется. Apply применяет весь Change, даже
если поиск вернул пустой список. Search обычных user/role/group/member lists
работает отдельно. Для следующих preview страниц сохраняется тот же draft и
revision. Response: receipt `graph_revision/actor_epoch/fingerprint`, counters,
`self_affected`, `items` и `next_cursor`; у items before/after содержат flattened
assignments, `active`, org и технический `scope`. Описание query параметров
preview совпадает с актуальным OpenAPI. Server filtering подтверждён backend
`d49f055`; это не только декларация query parameters.

Input «Поиск по имени или логину» над таблицей Preview: Light
[898:3950](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=898-3950), Dark
[898:3945](https://www.figma.com/design/km4tIbp3LnMTRrV6yi6Qho?node-id=898-3945).
Это instances существующего scoped Pulse Input `883:2402`, 876×70 в desktop
контенте 920px. Preview source 960×977, padding 20px, gap 16px. На narrow input
сжимается до доступной ширины; таблица прокручивается локально. Tab идёт через
поиск и cursor controls к Apply; поиск не скрывает предупреждения/self impact или
нижние действия. Нулевой результат — Empty search со «Сбросить поиск», при прежних
общих счётчиках. Аннотации source фиксируют серверную фильтрацию, стабильные counters/
fingerprint, сохранение draft и receipt, сброс cursor и доступность footer.

Modern POST/PUT/DELETE отправляют `{access_version:1,change,graph_revision,
actor_epoch,fingerprint}`; при user password change `password` — отдельное
write-only поле wrapper. `reset_password` остаётся частью user Change.
`change.user.id/revision` берутся из текущих `access_id/access_revision`.
Modern response: `{user,role,group,graph_revision,affected_users}`, отсутствующие
variants null; создание 201, изменение/удаление 200. Использовать возвращённый
committed `user`, а не собирать его из preview after или повторных definition
queries. Старые legacy writes возвращают отдельный совместимый Account shape.

В compat preview/modern mutations дают 503, новый editor остаётся недоступным;
это не отсутствие пользователей. В enforce старый POST даёт 409; небезопасный
старый PUT также 409. Не повторять modern draft через legacy role/scope body.
Строгие modern/mixed поля и некорректные decimal strings дают 400; прежний 422
для malformed legacy JSON остаётся совместимым validation response. Обработка
отказов сохраняет разрешённый draft и существующий auth cleanup.

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

Source self-check обеих тем и mobile выполнен. После добавления Preview search:
906 nodes / 372 texts / 129 instances по теме, Roboto-only, 0 image fills, Dark mode `128:0`. Clipping и disconnected
text properties исправлены scoped компонентами. Original kit и System сохранены.
Измерены конкретные сочетания токенов, полный WCAG-аудит не заявляется.

HTTP DTO backend Task 4 сверен по реализованным serializer/read seams и OpenAPI;
canonical fields / assignments / counts / compatibility matched. Preview search
сверен с backend fix и source обеих тем; API-semantic handoff завершён.
Последующие проверки: frontend tests/build, grants/transfers/empty assignments,
membership cursor preservation, stale preview, last manager, 401 cleanup,
Light/Dark, keyboard/zoom/contrast/reduced motion и runtime visual match.

### Task 9 · runtime source checkpoint · 23.10.2026

React source реализует `/system/access?tab=users|groups|roles`; `/accounts`
перенаправляет туда. Списки и редакторы используют actual source Users
`880:1502` / `890:3428`, Groups `880:1645` / `890:3595`, Roles `880:1788` /
`890:3752`; user editor `880:1931` / `890:3919`, role `880:1932` / `890:4002`,
group `880:1933` / `890:4064`, Preview `880:1934` / `890:4152`, mobile
`880:1936` / `880:1937`. Новый source не создавался. Использованы существующий
shell, Roboto, semantic tokens и Ant Design; изображения макетов не входят в UI.

На изолированной SPA с перехватом HTTP проверены Light/Dark списков, редакторов
и Preview; ширины 390/1024/1280/1440, 44px controls, local table scroll,
viewport-bounded drawer и footer; keyboard tablist, focus trap, Escape, dirty
close/Back, server search, unknown counts/loading, empty/error/forbidden,
409 draft/receipt invalidation без retry/write, disabled, legacy scope/model,
401/epoch cleanup. Source snapshots сопоставлены по композиции, отступам,
типографике, токенам и порядку полей. Runtime rows, названия подразделений и
размер каталога зависят от API; при отсутствии reference label выводится точный
ID. Невидимые permissions не вызывают дополнительных management queries.
Числа примеров Figma не переносятся в ответы сервера.

Evidence хранится во внешней workspace-задаче
`rbac-configurable-2026-10-23/execution/plan/task-9-browser/`: реальные SPA
screenshots, воспроизводимый Playwright script и `evidence.json`. Это source/
mocked HTTP checkpoint. **Live acceptance с настоящими management endpoints
ожидает изолированный backend gate6; итоговое независимое frontend review
выполняется по поручению координатора.** Рабочий runtime и БД не изменялись.

Профиль в прежней строке показывает actual modern roles/groups, включая пустые;
legacy enum используется только для legacy/absent model. Декоративные loading
icons скрыты от accessibility tree, Verify/Apply имеют стабильные русские имена
и aria-busy. Финальная mock-матрица: 24 сценария, 36 screenshots с проверкой
целевой геометрии drawer до съёмки; browser page errors — 0.


### Task 8–9 · исправления после единого review · 23.10.2026

Focused runtime checkpoint исправляет замечания FR-01–09: graph/display refresh
сохраняет конфликтный черновик, настоящая identity/authz epoch смена очищает его;
Back удерживается во время Preview/Apply; последний Preview search владеет
результатом при обратном порядке ответов. FULL guards требуют всей организации
и обоих фондов только для соответствующих серверных операций. References-only
principal открывает справочники без wells/risks queries. Новые grants ограничены
raw permission keys actor, существующие selections и fragments сохраняются.
Для existing user global manager может явно выбрать «Подразделение не назначено».
Ошибки полей связаны через aria-invalid/describedby и фокусируют неверное поле;
кнопка снятия назначения измерена 44×44 CSS px.

Внешние evidence: `execution/plan/frontend-fixes-browser/` в той же задаче,
18 focused intercepted-HTTP сценариев / 0 page errors. Исходные Figma nodes,
композиция, токены и theme mappings сохранены; новые макеты не создавались.
Это исправленный source checkpoint для того же reviewer; live backend
acceptance и его итоговый verdict по-прежнему ожидаются.


Focused followup FR-01-R/FR-10: наблюдаемая смена graph revision инвалидирует
также первый in-flight Preview без receipt; Change сохраняется. Новый Preview
может вернуть более свежий граф, чем self-profile, и принимается без сравнения
с устаревшим closure. Icon-only actions НГДУ/цехов имеют русские contextual
aria-label (действие, название, ID); сами icons остаются декоративными.
Три narrow browser cases / 0 page errors и два rendered-name tests находятся
во внешнем `execution/plan/frontend-fixes-followup-browser/`. Source composition
не менялась; live acceptance по-прежнему pending backend gate.

### Task 8–9 · итоговая frontend-приёмка · 23.10.2026

Этот итог заменяет pending-статусы checkpoints выше. Единый назначенный frontend
reviewer принял source `c20ba6ee46ff7b081cf29808fbd9285e0daf87f3` и live evidence;
все FR и LIVE-GAP-01 закрыты. Проверки принятого кода: 118 tests PASS,
TypeScript/Vite build PASS.

В реальной изолированной SPA с Gin/Access/Postgres backend
`5812b409c11636b2ecaa00985289ea8d900703d6` проверены шесть групп сценариев:
постоянные роли/группы, union и перекрывающиеся источники, локальная область
управления и скрытие недоступных пользователей, перевод между подразделениями
с отзывом сеанса, stale409 с сохранением черновика и запрет удаления последнего
manager с очисткой private state при настоящей смене сеанса. Отдельно подтверждён
успешный local leader write: Preview200 → PUT200 → committed GET200,
без изменения назначений, подразделения и active. Page errors — 0.
Auth/management endpoints и PostgreSQL были настоящими; подменялся только
внешний ML. Обе временные backend fixtures и frontend/Chrome остановлены;
координатор подтвердил отсутствие обеих тестовых схем после cleanup.

Прежние source/theme/responsive/keyboard evidence сохраняют силу. Native browser
zoom200%, screen reader/VoiceOver и полный runtime contrast audit не проверены;
полное WCAG-соответствие не заявляется. Итоговая frontend-приёмка не заменяет
общий workspace backend full gate, который на момент этой записи ещё pending.
Рабочие deployment и activation не выполнялись. Сведения выше самостоятельны:
standalone checkout не требует внешних task-артефактов для сборки или тестов.

### Role rows · runtime checkpoint · 24.10.2026

Новый source file `km4tIbp3LnMTRrV6yi6Qho`: form desktop Light923:2520 /
Dark927:5116; mobile923:2720 /927:5415; full-page Preview923:2620 /927:5274;
states923:2721 /927:5499; narrow group923:2722 /927:5598. По запросу пользователя
24.10 удалены прежние редакторы ролей880:1932 /890:4002 и групп880:1933 /890:4064.
Актуальные списки, user editor, состояния и общий kit сохранены. Role editor
использует отдельную страницу, group drawer — форму без назначения ролей.
Новых UI raster/assets, design-system/dependency изменений нет: shell и
Ant controls переиспользованы, semantic selected token привязан только внутри
role page к source Light/Dark значениям.

Сохранены query URLs /system/access?tab=roles&entity=roles&id=new|<decimal>
и copy=1. Name/description и typed stable rows принадлежат AccountsPage draft;
backend wire остаётся flat permission_keys. «Проверить изменения» вызывает
Preview, «Сохранить роль» — actual Apply. Ноль строк допустим; added incomplete
row показывает associated field error и focus. Add — blue text/link с44px целью.
Existing unknown/ungrantable keys read-only; actor prerequisites ограничивают
новый выбор, partial roles разрешены без auto grants. Existing delete-role
capability сохранена в действиях формы. Для group форма не запрашивает roles:
existingrole_ids точно сохраняются, new[], полный member baseline/участники
работают по прежнему contract. Нейтральный общий callout не обещает назначения
ролей в форме группы.

Проверки принятого implementation checkpoint:127 tests PASS, TypeScript/Vite
build PASS; реальные DOM interactions SPA с intercepted API проверяют stable
rows/add/remove/resource reset/selection, full-page form/Preview, empty/incomplete,
readonly/unknown/copy, actor dependencies, group immutable IDs+member pagination,
409/graph/epoch/403/401/pending/unknown outcome и focus return. Source Light/Dark
1440/390 сопоставлены, дополнительные320/768/1024 не имеют document overflow.
Это UI-only mocked-backend QA новой формы; прежнее real API evidence не
выдаётся за новый live run. Изолированный Vite3049 и Chrome остановлены.

Native keyboard установленного Ant Design5.29.3/rc-select14.16.8 проверен через
Arrow/Enter/Escape и typing search. Home/End option jump библиотекой не
поддерживается; по решению координатора остаётся native input semantics, без
synthetic-key/private API wrapper. Source keyboard annotations уточнены тем же
правилом. Add/Remove/Preview heading/Back/Cancel восстанавливают focus; page не
создаёт focus trap, confirm dialog остаётся modal. Native browser200%, SR/VoiceOver
и полный runtime contrast остаются вне выполненных проверок. Единое scoped review
приняло implementation `639fca0c40b943eb0b463ae8cf4d8c80cfd61ac2` со статусом
ACCEPTED, блокирующих дефектов — 0. Приёмка относится к описанному UI-only diff
и mocked-API evidence; новый real API run и полный прежний RBAC review не
выполнялись. Необязательные P3 о плотности подсказок и фоне двухстрочного chip
зафиксированы без расширения отложенного пользователем дизайна.

### Role rows · настоящий API · 24.10.2026

Последняя форма дополнительно проверена с настоящими Gin/Access/Postgres:
frontend9887a03 (код639fca0), backend0ace525. Шесть сквозных сценариев PASS,
page errors0: создание роли с двумя ресурсами и несколькими действиями,
редактирование и повторное чтение, назначение нескольких прямых ролей,
сохранение права через группу после снятия прямой роли, изменение группы без
role picker с сохранением role IDs и полного состава, вход сотрудника с union
и доступом только к скважине своего НГДУ/цеха (чужая скважина404).

Auth/management HTTP не перехватывались; подменён только внешний ML, не
участвующий в этих сценариях. Native Select проверен через поиск, Arrow/Enter
и Escape. Новые Preview200, role POST201, role/user/group PUT200 сверены
с последующим серверным чтением. Дополнительно повторены127 frontend tests,
TypeScript/Vite build и backend make check/build — PASS. Полный прежний backend
integration suite и независимые ревью неизменённого кода не повторялись.

Проверка использовала отдельную временную схему тестовой БД localhost55432;
fixture завершиласьexit0, схема удалена (read-only COUNT0), свои Vite5189,
API18088 и headless Chrome остановлены. Рабочая БД и приложение8088 не
переключались; ветки сохранены для последующего переноса. Прежние ограничения
ручного accessibility/zoom/contrast QA остаются в силе.

### USERS-PAGE · source implementation checkpoint · 24.10.2026

Новые editable frames: file `km4tIbp3LnMTRrV6yi6Qho`, профиль Light976:3547,
редактирование Light976:3667, создание Light976:3895. Прочитаны high-fidelity
context и screenshots. Исходные shell/icons/Roboto/Ant Design переиспользованы;
Figma raster в UI не добавляется. Исправляемая designer height1 проблема
свободных TEXT не переносится в CSS: применяется нормальная высота строк28/40,
14/20 и13/20 с интервалами20px между панелями и16px внутри.

UserEditorPage — только route wrapper; AccountsPage остаётся единственным
владельцем draft/password/Preview/Apply/private epoch. `/accounts` compatibility
и access tabs сохранены; старые user entity-query URLs переводятся в страницу.
Успех возвращает к users-tab с поиском. На профиль-only успехе инвалидируются
оба кэша access и people. Формы не пишут пароль/черновик в URL или storage.

Руководитель выбирается через safe directory search/cursor, включая отключённые
аккаунты. Выбранный ID сохраняется вне текущей страницы и отдельно читается
для подписи; self исключён, цикл проверяет сервер. Неподдерживаемый старым API
профиль не получает выдуманную revision. Изменение только метаданных показывает
profile_change при items[] и server session_effect=none, без обещания отзыва.

409/422 сохраняют draft и инвалидируют receipt. Неопределённый сетевой исход
не повторяет запись: явное чтение показывает сохранённую managed запись,
сохраняя черновик и пароль в памяти. Для create поиск точного логина проходит
все необходимые управленческие страницы на одной graph revision. Загрузка
серверной версии отдельно подтверждается и очищает draft/password; пароль
невозможно проверить чтением. Настоящая смена private epoch/401 очищает память
через существующий AuthProvider. Reload/Back и pending защищены guard.

Unit/SSR/transport tests подтверждают profile revision/payload/Unicode/null,
сохранение multiple assignments, zero-permission routing, отсутствие security
данных в safe markup, inactive manager, endpoint/query routing и profile-only
Preview. Browser/live/theme/mobile проверяет координатор на изолированном
runtime; до его evidence полное runtime визуальное соответствие не заявляется.
Ручной SR/VoiceOver, native zoom200% и полный contrast audit не выполнены.

Финальная дизайнерская передача подтвердила те же три Light desktop IDs и PNG
после autogrow fix. Создание directory/Dark/mobile source не подтверждено из-за
Figma transport error; возможный partial batch в wrapper975:3546 не повторялся.
Новые IDs этих вариантов отсутствуют. Список использует текущие table/card
conventions, Dark и320/390px — существующие Pulse tokens/breakpoints и явные
адаптивные правила передачи. Их runtime проверка принадлежит координатору.

USERS-PAGE pre-review corrections: exact422 validation_error сообщения
«Цикл руководителей недопустим» и «Руководитель не найден» связаны с manager
полем и ссылкой из summary; форма возвращается из Preview к полю, draft остаётся.
Generic «Некорректный профиль сотрудника» связывается с manager только при
детерминированной self-reference в текущем typed draft, иначе остаётся summary.
Маршрут new/edit/profile фокусирует свой заголовок один раз при открытии,
перерисовка формы/загрузка профиля не перехватывает фокус у поля. Own profile
использует canonical access_id; legacy numeric fallback разрешён только для
положительного Number.isSafeInteger, иначе ссылка отсутствует.

USERS-PAGE source recovery завершён: прежний OPEN transport статус выше
заменён подтверждёнными editable кадрами и12designer PNG. Каталог
Light981:3743/Dark981:4409, desktop profile/edit/create Dark981:3891/981:3997/
981:4203; mobile profile Light981:4534/Dark981:4640, edit Light981:4746/
Dark981:4952. Scope оригинального kit и прежних ролей/групп сохранён.
Frontend дополнительно прочитал high-fidelity contexts/screenshots каталога
обеих тем и mobile profile Light; runtime сравнение поздних вариантов остаётся
обязанностью координатора. Source availability больше не является блокером.

Scoped review corrections F1–F4: после подтверждения найденного create readback
открывается canonical edit найденного ID с server account/profile revisions,
назначениями и сохранённым поиском списка. При отсутствии записи отдельное
подтверждение начинает новую операцию с сохранённым содержимым и очищенным
паролем; автоматического повторения записи нет. Возврат в каталог теперь
семантическая ссылка с44px зоной; мобильный каталог сохраняет имя/ссылку/статус
руководителя и честный null. CSS checkbox row scoped только к people toolbar.

Runtime correction F5: CUA320px на разрешённых name120/title200 и workplace200
подтвердил переполнение страницы длинными строками. Profile и mobile people
получили локальный inherited overflow-wrap:anywhere, shrinkable containers и
links с max-width100%/normal whitespace. Имя, subtitle/отдел, имя/должность
руководителя и поля карточки остаются целиком читаемыми; truncation/скрытие
или горизонтальная прокрутка страницы не применяются. CSS проверяется живым
320/390px повтором координатора, не source-snapshot тестом.

### USER-EDITOR-COLLAPSE · source implementation · 24.10.2026

Существующие шесть editor/create кадров обновлены только заголовками:
edit1440 Light976:3667/Dark981:3997; create1440 Light976:3895/Dark981:4203;
edit390 Light981:4746/Dark981:4952. Closed320 board1016:4236 включает
Light1016:4237/Dark1016:4396. Header source1016:4218, closed1016:4262/4275/4285.
Прочитаны high-fidelity context и screenshots header/обеих closed320 тем.

UserEditorSection использует независимые native details без общего name,
default-open и всегда смонтированный body. Summary — одна44px цель: заголовок
16/22, action13/19, ширина action88px, gap12px; panel padding20desktop/16narrow,
body gap16. Native open state не хранится в draft/URL/storage и не изменяет
preview receipt/password/permissions/search. Private/target key создаёт новые
sections; обычные controlled rerenders не сбрасывают native collapse.

revealAccessField раскрывает ancestor details снаружи внутрь до focus/scroll.
Один helper подключён к AccessFieldError effect, повторному summary-link и
post-render возврату пользователя из Preview к имени. Delayed focus проверяет
private ticket и актуальный sequence, затем ищет текущий DOM target. Различие
workplace_department и security department сохраняется через прежние IDs.
Preview lifecycle/условный remount не переделывался; role editor back неизменён.

Unit/source-execution/SSR проверки покрывают reveal order, повторное раскрытие,
все field IDs, текущие3sections/default-open/mounted fields, сохранение
черновика/пароля/assignments, server422 и guard позднего фокуса. Native keyboard,
collapse→rerender state, hidden Tab order и320/390 геометрию проверяет координатор
на настоящем CUA runtime; один SSR не является доказательством этих свойств.

### USER-ORGANIZATION-TREE · source implementation · 24.10.2026

Source: wrapper1019:4196; desktop1022:4253/1022:4481,
390px1022:4671/1022:4885, row family1022:4226, responsive search1022:4247,
long320 leaf1022:5099. Прочитаны final designer handoff и high-fidelity
context/screenshots desktop Light, обеих390тем и320long proof. Directory source
981:3743/981:4409 сохраняет список и получает только44px переключатель.

Search/include_inactive общие для list/structure; list cursor сбрасывается при
возврате. Дерево читает один GET /api/v1/people/organization/tree, без cursor-all
fallback, Account/manager API и клиентской группировки страницы. Strict complete,
arrays/counts/positive string int64 parser не показывает partial/malformed200.
404/405/501 имеют unsupported state и явный возврат к списку;400/generic errors,
typed503too_large/timeout и401/403 отличаются. Counts относятся к совпавшим
сотрудникам снимка, не штатной численности. Политика5k/8MiB/5s — серверные
защитные границы, не измеренная production capacity.

Null узлы сохраняют все уровни и отличаются от реального placeholder-name.
Точные серверные keys/order сохранены. Все организации исходно свёрнуты;
поиск не инициирует expand-all. Branch buttons и employee profile Links имеют
44px минимум; Arrow/Home/End управляют roving focus, Enter/Space ветвей native,
листья открываются Enter. Visible rows измеряются ResizeObserver, окно620desktop/
520mobile ограничивает DOM и учитывает auto-height/long labels. Один focused row
может оставаться смонтированным вне viewport, предотвращая потерю фокуса при
прокрутке; keyboard moves прокручивают к актуальной строке.

Tree query key включает privateEpoch, normalized search и inactive; успешная
профильная invalidation ['people'] уже охватывает новый вид. Новая выборка/reset
response очищает expansion/measurements; фильтр/private scope размонтирует старый
subtree. Error state скрывает stale data. Native auth boundary и cancellation
signal защищают поздние ответы. CSS scoped к people tree; collapse editor не менялся.

Unit/transport/SSR/source-state проверки отделены от CUA: root проверяет old API
unsupported→new API,320/390 Light/Dark, keyboard, long rows и bounded DOM на
настоящем fixture. Реальные latency/RAM и полный accessibility audit не заявлены.
