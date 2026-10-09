import { useEffect, useState, type ReactNode } from 'react';
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
  // Advanced -> Base: the mode is stored at the click (a close during the exit must not
  // leave Advanced persisted), while `leaving` keeps the column mounted until the
  // narrowing ends (index.css, .object-card[data-leaving]).
  const [leaving, setLeaving] = useState(false);
  const select = (next: 'base' | 'advanced') => {
    setLeaving(next === 'base' && mode === 'advanced' && !prefersReducedMotion());
    setCardMode(next);
  };
  // React has no onAnimationCancel; a cancelled narrowing would otherwise keep the column forever.
  useEffect(() => {
    if (!leaving) return;
    const onCancel = (e: AnimationEvent) => {
      if (e.animationName === 'card-narrow') setLeaving(false);
    };
    document.addEventListener('animationcancel', onCancel);
    return () => document.removeEventListener('animationcancel', onCancel);
  }, [leaving]);
  const showAdvanced = mode === 'advanced' || leaving;
  return (
    <HudCard
      as="section"
      aria-label={title}
      data-testid={testId}
      data-hud="selection-card"
      data-mode={showAdvanced ? 'advanced' : 'base'}
      data-leaving={leaving ? '' : undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'card-narrow') {
          setLeaving(false);
        }
      }}
      className="object-card pointer-events-auto relative flex"
    >
      <CloseButton onClick={onClose} label={t('overlay.close')} testId={closeTestId} />
      {/* min-w: the fixed-width Advanced column overflows while the card widens; without it the base column would shrink and reflow (#23). */}
      <div className="flex w-56 min-w-[calc(14rem-2*var(--card-stroke,0px))] flex-col gap-2 overflow-y-auto p-2">
        <div>
          <h3 className="pr-6 font-hud text-sm text-hud-bright" data-testid={titleTestId}>
            {title}
          </h3>
          {subtitle && <div className="text-xs text-hud-muted">{subtitle}</div>}
        </div>
        <CardModeToggle cardMode={mode} onSelect={select} />
        {base}
        {footer}
      </div>
      {showAdvanced && (
        <div
          data-testid="card-advanced"
          // Scrollable: needs keyboard access (axe scrollable-region-focusable).
          tabIndex={0}
          role="region"
          aria-label={t('card.advanced')}
          className="card-advanced flex-none overflow-y-auto border-l border-hud-accent/20 p-2 pt-7 text-sm"
        >
          {advanced}
        </div>
      )}
    </HudCard>
  );
}
