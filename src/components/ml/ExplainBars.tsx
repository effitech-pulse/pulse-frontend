import { Skeleton, Tooltip, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { mlApi, type MlContribution } from '@/api/ml';
import { formatSnapshotTime } from '@/lib/displayTime';

/** SHAP-вклады признаков: положительный (красный) толкает риск вверх,
 *  отрицательный (зелёный) — вниз. Ширина бара ∝ |вкладу|. */
export function ExplainBars({ wellId, topN = 6, contributions, windowKind = contributions === undefined ? 'latest' : 'unknown', windowEnd = null }: {
  wellId: number | null;
  topN?: number;
  contributions?: MlContribution[];
  windowKind?: 'peak' | 'latest' | 'unknown';
  windowEnd?: string | null;
}) {
  const q = useQuery({
    queryKey: ['ml-explain', wellId, topN],
    queryFn: () => mlApi.explain(wellId!, topN),
    enabled: contributions === undefined && wellId !== null,
  });

  const items = contributions?.slice(0, topN) ?? q.data?.contributions;
  if (contributions === undefined && q.isLoading) return <Skeleton active paragraph={{ rows: 4 }} title={false} />;
  if (!items?.length)
    return <Typography.Text type="secondary">Объяснение недоступно.</Typography.Text>;

  const maxAbs = Math.max(...items.map((c) => Math.abs(c.shap)), 1e-9);
  const explanationWindow = windowKind === 'peak' ? 'TreeSHAP по окну максимального сырого score'
    : windowKind === 'latest' ? 'TreeSHAP по последнему окну' : 'Окно объяснения не передано';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((c) => {
        const up = c.shap >= 0;
        const width = (Math.abs(c.shap) / maxAbs) * 100;
        const source = c.value_source === 'computed' ? 'Рассчитано по данным' : c.value_source === 'training_median' ? 'Медиана обучения' : c.value_source === 'zero_fallback' ? 'Заполнение нулём' : 'Источник не передан';
        const tooltip = `${c.label} · ${c.feature} = ${c.value.toFixed(3)} · ${source} · вклад ${c.shap >= 0 ? '+' : ''}${c.shap.toFixed(3)}`;
        return (
          <Tooltip
            key={c.feature}
            // подпись в строке обрезается по ширине, и производные признаки
            // («…: к уровню месторождения») выглядят одинаково — полное имя
            // показываем в подсказке первым
            title={tooltip}
          >
            <div aria-label={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 'min(45%, 230px)',
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {c.label}
              </span>
              <div style={{ flex: 1, background: 'var(--pulse-canvas)' , borderRadius: 4, height: 10 }}>
                <div
                  style={{
                    width: `${width}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: up ? 'var(--pulse-danger)' : 'var(--pulse-success)',
                  }}
                />
              </div>
              <span
                style={{
                  width: 64,
                  textAlign: 'right',
                  fontSize: 12,
                  color: up ? 'var(--pulse-danger)' : 'var(--pulse-success)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {up ? '+' : ''}
                {c.shap.toFixed(2)}
              </span>
            </div>
          </Tooltip>
        );
      })}
      <Typography.Text title={windowEnd ?? undefined} type="secondary" style={{ fontSize: 12 }}>
        Красное толкает риск вверх, зелёное — вниз ({explanationWindow}{windowKind !== 'unknown' ? ` · ${windowEnd ? formatSnapshotTime(windowEnd) : 'дата не передана'}` : ''}).
      </Typography.Text>
    </div>
  );
}
