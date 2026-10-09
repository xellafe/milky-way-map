import { useId, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from './Badge';
import type { Tick } from '../../lib/gaugeScale';
import { Gauge } from './Gauge';

/** Label + value + gauge. `value === null` shows "n/a" and an empty gauge. */
export function StatTile({
  label,
  value,
  unit,
  estimate = false,
  position,
  variant,
  ticks,
  zones,
  fill,
  verdict,
  compact = false,
  testId,
}: {
  label: string;
  value: string | null;
  unit?: string;
  estimate?: boolean;
  position: number | null;
  variant?: 'track' | 'spectral';
  ticks?: readonly Tick[];
  zones?: ComponentProps<typeof Gauge>['zones'];
  fill?: boolean;
  /** Plain-language reading shown under the value. */
  verdict?: string;
  compact?: boolean;
  testId?: string;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const text = value === null ? t('panel.na') : unit ? `${value} ${unit}` : value;
  return (
    <div data-testid={testId} className={`bg-hud-accent/5 ${compact ? 'p-1.5' : 'p-2'}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-1">
        <span id={labelId} className="text-xs text-hud-muted">
          {label}
        </span>
        {estimate && value !== null && <Badge tone="warn">{t('panel.estimate')}</Badge>}
      </div>
      <div
        className={`font-hud-mono whitespace-nowrap text-hud-bright ${compact ? 'text-sm' : 'text-base'}`}
      >
        {text}
      </div>
      {verdict && (
        <div data-testid={`${testId}-verdict`} className="text-xs text-hud-muted">
          {verdict}
        </div>
      )}
      <Gauge
        position={value === null ? null : position}
        variant={variant}
        ticks={ticks}
        zones={zones}
        fill={fill}
        valueText={text}
        labelledBy={labelId}
      />
    </div>
  );
}
