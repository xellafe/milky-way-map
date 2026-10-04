import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isWelcomeDismissed, setWelcomeDismissed } from '../lib/welcome';
import { useGalaxyMapStore } from '../state/store';
import { HudButton } from './hud/HudButton';

const GUIDE_ROWS = ['look', 'move', 'zoom', 'select', 'search', 'system', 'dock'] as const;

/**
 * Modal welcome guide (#12). Native <dialog>: showModal() gives focus trap,
 * Escape and focus restore to the opener for free. Every close path (button,
 * Escape) funnels through onClose, which persists the checkbox.
 */
export function WelcomeDialog() {
  const { t } = useTranslation();
  const open = useGalaxyMapStore((s) => s.welcomeOpen);
  const setOpen = useGalaxyMapStore((s) => s.setWelcomeOpen);
  const ref = useRef<HTMLDialogElement>(null);
  const [dontShow, setDontShow] = useState(isWelcomeDismissed);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDontShow(isWelcomeDismissed());
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid="welcome-dialog"
      aria-labelledby="welcome-title"
      className="hud-panel rounded-hud m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto p-6"
      onClose={() => {
        setWelcomeDismissed(dontShow);
        setOpen(false);
      }}
    >
      <h2 id="welcome-title" className="text-hud-bright text-xl">
        {t('welcome.title')}
      </h2>
      <p className="mt-2 text-sm">{t('welcome.description')}</p>
      <h3 className="text-hud-bright mt-4 text-base">{t('welcome.guideTitle')}</h3>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        {GUIDE_ROWS.map((row) => (
          <div key={row} className="contents">
            <dt>{t(`welcome.guide.${row}.action`)}</dt>
            <dd className="text-hud-muted text-right">
              {row === 'move' ? (
                <>
                  <kbd>W</kbd>
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd>, <kbd>R</kbd>/<kbd>F</kbd> {t('welcome.guide.move.upDown')},{' '}
                  <kbd>Q</kbd>/<kbd>E</kbd> {t('welcome.guide.move.roll')}
                </>
              ) : (
                t(`welcome.guide.${row}.command`)
              )}
            </dd>
          </div>
        ))}
      </dl>
      <form method="dialog" className="mt-5 flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="welcome-dont-show"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
          />
          {t('welcome.dontShowAgain')}
        </label>
        <HudButton type="submit" data-testid="welcome-start">
          {t('welcome.start')}
        </HudButton>
      </form>
    </dialog>
  );
}
