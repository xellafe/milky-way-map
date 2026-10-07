import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { prefersReducedMotion } from '../../lib/motion';
import { useGalaxyMapStore } from '../../state/store';
import { CardModeToggle } from './CardModeToggle';
import { CloseButton } from './CloseButton';
import { HudCard } from './HudCard';

/**
 * Card of a selected object (star, planet): `base` always, `advanced` as a
 * second column in Advanced mode. Widths (224 / 470 px) and their animation
 * live in `.object-card` (index.css).
 */
export function ObjectCard({
  title,
  subtitle,
  onClose,
  closeTestId,
  base,
  advanced,
  footer,
  testId,
  titleTestId,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  closeTestId: string;
  base: ReactNode;
  advanced: ReactNode;
  footer?: ReactNode;
  testId: string;
  titleTestId: string;
}) {
  const { t } = useTranslation();
  const mode = useGalaxyMapStore((s) => s.cardMode);
  const setCardMode = useGalaxyMapStore((s) => s.setCardMode);
  // Advanced -> Base keeps the column mounted while it fades out and the card narrows;
  // the mode flips when the narrowing ends (index.css, .object-card[data-leaving]).
  const [leaving, setLeaving] = useState(false);
  const select = (next: 'base' | 'advanced') => {
    if (next === 'base' && mode === 'advanced' && !prefersReducedMotion()) {
      setLeaving(true);
      return;
    }
    setLeaving(false);
    setCardMode(next);
  };
  return (
    <HudCard
      as="section"
      aria-label={title}
      data-testid={testId}
      data-hud="selection-card"
      data-mode={mode}
      data-leaving={leaving ? '' : undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'card-narrow') {
          setLeaving(false);
          setCardMode('base');
        }
      }}
      className="object-card pointer-events-auto relative flex"
    >
      <CloseButton onClick={onClose} label={t('overlay.close')} testId={closeTestId} />
      <div className="flex w-56 min-w-0 flex-col gap-2 overflow-y-auto p-2">
        <div>
          <h3 className="pr-6 font-hud text-sm text-hud-bright" data-testid={titleTestId}>
            {title}
          </h3>
          {subtitle && <div className="text-xs text-hud-muted">{subtitle}</div>}
        </div>
        <CardModeToggle cardMode={leaving ? 'base' : mode} onSelect={select} />
        {base}
        {footer}
      </div>
      {mode === 'advanced' && (
        <div
          data-testid="card-advanced"
          // Scrollable: needs keyboard access (axe scrollable-region-focusable).
          tabIndex={0}
          role="region"
          aria-label={t('card.advanced')}
          className="card-advanced min-w-0 flex-1 overflow-y-auto border-l border-hud-accent/20 p-2 pt-7 text-sm"
        >
          {advanced}
        </div>
      )}
    </HudCard>
  );
}
