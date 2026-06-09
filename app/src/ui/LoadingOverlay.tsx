import { useTranslation } from 'react-i18next';
import { useGalaxyMapStore } from '../state/store';

/** Star-catalog loading / error overlay (progress in [0,1], Intl-formatted). */
export function LoadingOverlay() {
  const { t, i18n } = useTranslation();
  const status = useGalaxyMapStore((s) => s.dataStatus);
  const progress = useGalaxyMapStore((s) => s.dataProgress);

  if (status === 'ready') return null;

  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(progress);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      role="status"
      aria-live="polite"
      data-testid="loading-overlay"
    >
      <p className="text-lg text-white/80">
        {status === 'error' ? t('errors.dataLoadFailed') : t('ui.loadingStars', { percent })}
      </p>
    </div>
  );
}
