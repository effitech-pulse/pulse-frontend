# Пульс скважины — интерфейс

React, Ant Design и Vite. Требуется Node.js 20+.

```sh
npm ci
npm run dev
npm run build
```

Разработка: http://localhost:3000, API проксируется на http://localhost:8000. Для размещения готовой сборки dist/ настройте reverse proxy /api и /health к бэкенду. Локальные файлы телеметрии и веса модели сюда не входят.


## GitHub CI

Workflow `.github/workflows/ci.yml` запускается на push в `main`, pull request, тег `v*` и вручную. Собирает статический сайт в `dist/` и сохраняет артефакт на 30 дней. Развёртывание и загрузка рабочих данных не включены. Секреты для CI не требуются.
