import { useTranslation } from 'react-i18next';
import type { CardMode } from '../../state/store';

/** Base / Advanced switch of an object card (#23); the card owns the state and the transition. */
export function CardModeToggle({
  cardMode,
  onSelect,
}: {
  cardMode: CardMode;
  onSelect: (mode: CardMode) => void;
}) {
  const { t } = useTranslation();
  const button = (mode: CardMode) => (
    <button
      type="button"
      aria-pressed={cardMode === mode}
      data-testid={`card-mode-${mode}`}
      onClick={() => onSelect(mode)}
      className={`flex-1 px-2 py-0.5 font-hud-mono text-xs ${
        cardMode === mode
          ? 'bg-hud-accent/30 text-hud-bright'
          : 'text-hud-muted hover:text-hud-text'
      }`}
    >
      {t(`card.${mode}`)}
    </button>
  );
  return (
    <div role="group" aria-label={t('card.modeLabel')} className="flex border border-hud-accent/30">
      {button('base')}
      {button('advanced')}
    </div>
  );
}
