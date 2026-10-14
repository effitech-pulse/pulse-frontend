import { Skeleton, Tooltip, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { mlApi } from '@/api/ml';

/** SHAP-вклады признаков: положительный (красный) толкает риск вверх,
 *  отрицательный (зелёный) — вниз. Ширина бара ∝ |вкладу|. */
export function ExplainBars({ wellId, topN = 6 }: { wellId: number; topN?: number }) {
  const q = useQuery({
    queryKey: ['ml-explain', wellId, topN],
    queryFn: () => mlApi.explain(wellId, topN),
  });

  if (q.isLoading) return <Skeleton active paragraph={{ rows: 4 }} title={false} />;
  if (q.isError || !q.data?.contributions.length)
    return <Typography.Text type="secondary">Объяснение недоступно.</Typography.Text>;

  const maxAbs = Math.max(...q.data.contributions.map((c) => Math.abs(c.shap)), 1e-9);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {q.data.contributions.map((c) => {
        const up = c.shap >= 0;
        const width = (Math.abs(c.shap) / maxAbs) * 100;
        return (
          <Tooltip
            key={c.feature}
            // подпись в строке обрезается по ширине, и производные признаки
            // («…: к уровню месторождения») выглядят одинаково — полное имя
            // показываем в подсказке первым
            title={`${c.label} · ${c.feature} = ${c.value.toFixed(3)} · вклад ${
              c.shap >= 0 ? '+' : ''
            }${c.shap.toFixed(3)}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 230,
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {c.label}
              </span>
              <div style={{ flex: 1, background: '#f0f2f5', borderRadius: 4, height: 10 }}>
                <div
                  style={{
                    width: `${width}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: up ? '#d64545' : '#2e9e6b',
                  }}
                />
              </div>
              <span
                style={{
                  width: 64,
                  textAlign: 'right',
                  fontSize: 12,
                  color: up ? '#d64545' : '#2e9e6b',
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
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Красное толкает риск вверх, зелёное — вниз (TreeSHAP по последнему окну).
      </Typography.Text>
    </div>
  );
}
