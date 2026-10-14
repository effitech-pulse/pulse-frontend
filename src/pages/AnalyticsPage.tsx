import { Alert, Button, Select, Space, Spin, Typography } from 'antd';
import { ExportOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useAnalyticsStatus, useEmbedUrl } from '@/hooks/useAnalytics';
import { PageSpin } from '@/components/common/PageSpin';

const PAGE_HEIGHT = 'calc(100vh - 64px)'; // вычитаем высоту шапки AppLayout

function SetupHint() {
  return (
    <Alert
      type="info"
      showIcon
      message="Аналитика (Metabase) не настроена"
      description={
        <Space direction="vertical" size={4}>
          <span>Чтобы включить конструктор графиков и дашборды:</span>
          <Typography.Text>
            1. Поднимите Metabase: <code>make metabase-up</code> (откроется на{' '}
            <a href="http://localhost:3001" target="_blank" rel="noreferrer">
              localhost:3001
            </a>
            ).
          </Typography.Text>
          <Typography.Text>
            2. Пройдите мастер, добавьте источник данных Postgres (host <code>postgres-data</code>,
            port <code>5432</code>, БД <code>data_db</code>, пользователь <code>data_user</code>).
          </Typography.Text>
          <Typography.Text>
            3. Соберите дашборд, включите <i>Embedding</i> (Admin → Settings → Embedding), включите
            статическое встраивание у дашборда.
          </Typography.Text>
          <Typography.Text>
            4. Заполните в <code>.env</code>: <code>METABASE_SITE_URL</code>,{' '}
            <code>METABASE_EMBED_SECRET</code>, <code>METABASE_DASHBOARDS</code> и перезапустите API.
            Подробности — в <code>docs/ANALYTICS.md</code>.
          </Typography.Text>
        </Space>
      }
    />
  );
}

export function AnalyticsPage() {
  const status = useAnalyticsStatus();
  const [dashboardId, setDashboardId] = useState<number | null>(null);

  const dashboards = status.data?.dashboards ?? [];

  // Выбрать первый дашборд, как только список загрузится.
  useEffect(() => {
    if (dashboardId == null && dashboards.length > 0) setDashboardId(dashboards[0].id);
  }, [dashboards, dashboardId]);

  const embed = useEmbedUrl(status.data?.enabled ? dashboardId : null);

  // URL Metabase берём из origin подписанной ссылки (без отдельной настройки на фронте).
  const metabaseOrigin = useMemo(() => {
    if (!embed.data?.url) return null;
    try {
      return new URL(embed.data.url).origin;
    } catch {
      return null;
    }
  }, [embed.data?.url]);

  if (status.isLoading || status.error) {
    return (
      <div style={{ padding: 24 }}>
        <PageSpin loading={status.isLoading} error={status.error}>
          <span />
        </PageSpin>
      </div>
    );
  }

  if (!status.data?.enabled) {
    return (
      <div style={{ padding: 24 }}>
        <SetupHint />
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          showIcon
          message="Дашборды не указаны"
          description="Metabase подключён, но список встраиваемых дашбордов пуст. Заполните METABASE_DASHBOARDS в .env (см. docs/ANALYTICS.md)."
        />
      </div>
    );
  }

  return (
    <div style={{ height: PAGE_HEIGHT, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}
      >
        <Space>
          {metabaseOrigin && (
            <>
              <Button
                icon={<PlusOutlined />}
                href={`${metabaseOrigin}/dashboard/new`}
                target="_blank"
                rel="noreferrer"
              >
                Создать дашборд
              </Button>
              <Button
                icon={<ExportOutlined />}
                href={metabaseOrigin}
                target="_blank"
                rel="noreferrer"
              >
                Открыть Metabase
              </Button>
            </>
          )}
          <Select
            style={{ minWidth: 260 }}
            value={dashboardId ?? undefined}
            onChange={setDashboardId}
            options={dashboards.map((d) => ({ value: d.id, label: d.name }))}
          />
        </Space>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {embed.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : embed.error ? (
          <Alert
            type="error"
            showIcon
            style={{ margin: 16 }}
            message="Не удалось получить дашборд"
            description="Проверьте, что дашборд существует, у него включено статическое встраивание, а METABASE_EMBED_SECRET совпадает с секретом Metabase."
          />
        ) : embed.data ? (
          <iframe
            key={embed.data.url}
            title="Metabase dashboard"
            src={embed.data.url}
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          />
        ) : null}
      </div>
    </div>
  );
}
