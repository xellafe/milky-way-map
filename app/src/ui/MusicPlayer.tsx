import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import musicUrl from '../assets/background-music.mp3';
import { nextIndex, prevIndex, type Track } from '../lib/playlist';
import { useCompactViewport } from '../lib/viewport';
import { useGalaxyMapStore } from '../state/store';
import { HudSlider } from './hud/HudInputs';
import { HudPanel } from './hud/HudPanel';

const DEFAULT_VOLUME = 0.4;
const MUSIC_SELECTOR = '[data-music-zone]';
const PLAYLIST: [Track, ...Track[]] = [{ src: musicUrl, titleKey: 'music.tracks.soundtrack' }];
const CONTROLS_ID = 'music-player-controls';

const BUTTON_CLASS =
  'rounded border border-hud-accent/30 bg-white/5 px-1.5 py-0.5 font-hud text-sm text-hud-text hover:bg-white/10';

/**
 * Playlist playback: play/pause, volume, prev/next, and the
 * autoplay-on-first-gesture fallback (browsers block autoplay with sound
 * until a user gesture — we try to start on mount and otherwise on the first
 * pointer/key event). Gestures inside the music controls (MUSIC_SELECTOR) do
 * not trigger the fallback, otherwise a deliberate first click there could
 * race an unwanted autoplay; gestures anywhere else still start the music.
 */
function useMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [trackIndex, setTrackIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = DEFAULT_VOLUME;
    const onGesture = (event: Event) => {
      removeListeners();
      if ((event.target as Element | null)?.closest?.(MUSIC_SELECTOR)) return;
      audio.play().catch(() => {});
    };
    const removeListeners = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    audio.play().catch(() => {
      window.addEventListener('pointerdown', onGesture);
      window.addEventListener('keydown', onGesture);
    });
    return removeListeners;
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  const setVolume = (value: number) => {
    setVolumeState(value);
    if (audioRef.current) audioRef.current.volume = value;
  };

  /**
   * Same target index restarts the track; otherwise switch src. Resumes only
   * if it was playing — or `forcePlay`, because an ended track reports paused.
   */
  const goTo = (index: number, forcePlay = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    const resume = forcePlay || !audio.paused;
    if (index === indexRef.current) audio.currentTime = 0;
    else {
      indexRef.current = index;
      setTrackIndex(index);
      audio.src = (PLAYLIST[index] ?? PLAYLIST[0]).src;
    }
    if (resume) audio.play().catch(() => {});
  };

  return {
    audioRef,
    playing,
    volume,
    track: PLAYLIST[trackIndex] ?? PLAYLIST[0],
    toggle,
    setVolume,
    prev: () => goTo(prevIndex(indexRef.current, PLAYLIST.length)),
    next: () => goTo(nextIndex(indexRef.current, PLAYLIST.length)),
    onEnded: () => goTo(nextIndex(indexRef.current, PLAYLIST.length), true),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
  };
}

/**
 * Bottom-right music player. Mounted in App outside the galaxy/system view
 * switch so the <audio> element and its playback state survive view changes;
 * the <audio> stays mounted while collapsed so collapsing never stops playback.
 */
export function MusicPlayer() {
  const { t } = useTranslation();
  const {
    audioRef,
    playing,
    volume,
    track,
    toggle,
    setVolume,
    prev,
    next,
    onEnded,
    onPlay,
    onPause,
  } = useMusic();
  const expanded = useGalaxyMapStore((s) => s.musicExpanded);
  const setExpanded = useGalaxyMapStore((s) => s.setMusicExpanded);
  // Compact: the expanded player and a dock panel compete for the same band;
  // the player yields when the viewport shrinks into compact with a panel open.
  const compact = useCompactViewport();
  useEffect(() => {
    const { musicExpanded, dockPanel } = useGalaxyMapStore.getState();
    if (compact && musicExpanded && dockPanel) setExpanded(false);
  }, [compact, setExpanded]);

  const collapseRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  // The clicked button unmounts and drops focus: hand it to the opposite one.
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (expanded ? collapseRef : expandRef).current?.focus();
  }, [expanded]);

  const change = (value: boolean) => {
    moveFocus.current = true;
    setExpanded(value);
  };

  return (
    <HudPanel
      aria-label={t('music.label')}
      data-hud="music-player"
      data-testid="music-control"
      data-music-zone
      data-expanded={expanded}
      padding="px-2 py-1"
      className={`absolute bottom-4 right-4 z-20 ${expanded ? 'w-64 max-lg:bottom-20 max-lg:max-w-[calc(100%-2rem)]' : ''}`}
    >
      <audio
        ref={audioRef}
        src={PLAYLIST[0].src}
        preload="none"
        data-testid="music-audio"
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
      />
      {expanded ? (
        <div id={CONTROLS_ID} className="flex flex-col gap-1">
          <p data-testid="music-title" className="truncate font-hud text-xs text-hud-text">
            <span className="sr-only">{t('music.nowPlaying')}: </span>
            {t(track.titleKey)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="music-prev"
              aria-label={t('music.prev')}
              onClick={prev}
              className={BUTTON_CLASS}
            >
              <span aria-hidden>⏮</span>
            </button>
            <button
              type="button"
              data-testid="music-toggle"
              aria-label={playing ? t('music.pause') : t('music.play')}
              onClick={toggle}
              className={BUTTON_CLASS}
            >
              <span aria-hidden>{playing ? '❚❚' : '▶'}</span>
            </button>
            <button
              type="button"
              data-testid="music-next"
              aria-label={t('music.next')}
              onClick={next}
              className={BUTTON_CLASS}
            >
              <span aria-hidden>⏭</span>
            </button>
            <HudSlider
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label={t('music.volume')}
              data-testid="music-volume"
              className="min-w-0 flex-1"
              onChange={(event) => setVolume(Number(event.target.value))}
            />
            <button
              ref={collapseRef}
              type="button"
              data-testid="music-collapse"
              aria-label={t('music.collapse')}
              aria-expanded={true}
              aria-controls={CONTROLS_ID}
              onClick={() => change(false)}
              className={BUTTON_CLASS}
            >
              <span aria-hidden>▾</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={expandRef}
          type="button"
          data-testid="music-expand"
          aria-label={t('music.expand')}
          aria-expanded={false}
          aria-controls={CONTROLS_ID}
          onClick={() => change(true)}
          className={BUTTON_CLASS}
        >
          <span aria-hidden>♪</span>
        </button>
      )}
    </HudPanel>
  );
}
