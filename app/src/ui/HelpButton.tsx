import { useTranslation } from 'react-i18next';
import { useGalaxyMapStore } from '../state/store';
import { HudButton } from './hud/HudButton';

export function HelpButton() {
  const { t } = useTranslation();
  const setOpen = useGalaxyMapStore((s) => s.setWelcomeOpen);
  return (
    <HudButton
      variant="secondary"
      aria-label={t('welcome.helpButton')}
      data-testid="help-button"
      onClick={() => setOpen(true)}
    >
      ?
    </HudButton>
  );
}
