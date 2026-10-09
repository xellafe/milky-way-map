import { useTranslation } from 'react-i18next';

/** One label/value row of a data list; a null value reads n/a (never a made-up number). */
export function DataRow({
  label,
  value,
  note,
  warnNote = false,
  testId,
}: {
  label: string;
  value: string | null;
  note?: string;
  warnNote?: boolean;
  testId?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex justify-between gap-4 border-b border-hud-accent/20 py-1.5"
      data-testid={testId}
    >
      <dt className="text-hud-muted">{label}</dt>
      <dd className="text-right font-hud-mono text-hud-bright">
        {value ?? t('panel.na')}
        {note && value !== null && (
          <span className={`ml-1 text-xs ${warnNote ? 'text-hud-warn' : 'text-hud-muted'}`}>
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}
