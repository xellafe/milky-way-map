import { useTranslation } from 'react-i18next';
import musicUrl from '../assets/background-music.mp3';
import { formatNumber } from '../lib/format';
import { useGalaxyMapStore } from '../state/store';
import { FiltersPanel } from './FiltersPanel';
import { Dock, type DockItem } from './hud/Dock';
import { MusicPanel, useMusic } from './MusicControl';
import { OptionsPanel } from './OptionsPanel';
import { ViewTogglesPanel } from './ViewTogglesPanel';

function FiltersIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h16M7 12h10M10 19h4"
      />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth="1.6" />
    </svg>
  );
}

function OptionsIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="3" strokeWidth="1.6" />
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.5-7.5-2.1 2.1M8.6 15.4l-2.1 2.1m0-11 2.1 2.1m8.8 8.8 2.1 2.1"
      />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}

/**
 * Bottom control dock (#3): gathers Filters/View/Options/Music
 * into one icon row, one panel open at a time. Mounted in App OUTSIDE the
 * galaxy/system view switch so the audio element and its playback state
 * survive view changes; the dock shows Filters/View/Options/Music in the
 * galaxy view and only Options/Music in the System View.
 */
export function ControlDock() {
  const { t, i18n } = useTranslation();
  const view = useGalaxyMapStore((s) => s.view);
  const visibleCount = useGalaxyMapStore((s) => s.visibleCount);
  const { audioRef, playing, volume, toggle, setVolume, onPlay, onPause } = useMusic();

  const musicItem: DockItem = {
    id: 'music',
    label: t('dock.music'),
    icon: <MusicIcon />,
    testId: 'music-toggle-panel',
    musicZone: true,
    content: (
      <MusicPanel playing={playing} volume={volume} onToggle={toggle} onVolume={setVolume} />
    ),
  };
  const optionsItem: DockItem = {
    id: 'options',
    label: t('dock.options'),
    icon: <OptionsIcon />,
    testId: 'options-toggle',
    content: <OptionsPanel />,
  };

  const items: DockItem[] =
    view === 'galaxy'
      ? [
          {
            id: 'filters',
            label: t('dock.filters'),
            icon: <FiltersIcon />,
            testId: 'filters-toggle',
            badge:
              visibleCount !== null ? (
                <span
                  className="rounded border border-hud-accent/40 bg-black/70 px-1 font-hud-mono text-[10px] text-hud-muted"
                  data-testid="visible-count"
                >
                  {formatNumber(visibleCount, i18n.language)}
                </span>
              ) : undefined,
            content: <FiltersPanel />,
          },
          {
            id: 'view',
            label: t('dock.view'),
            icon: <ViewIcon />,
            testId: 'view-toggle',
            content: <ViewTogglesPanel />,
          },
          optionsItem,
          musicItem,
        ]
      : [musicItem, optionsItem];

  return (
    <div>
      <audio
        ref={audioRef}
        src={musicUrl}
        loop
        preload="none"
        data-testid="music-audio"
        onPlay={onPlay}
        onPause={onPause}
      />
      <Dock items={items} label={t('dock.label')} />
    </div>
  );
}
