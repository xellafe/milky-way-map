import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildPlaylist, nextIndex, prevIndex } from '../lib/playlist';
import { useCompactViewport } from '../lib/viewport';
import { useGalaxyMapStore } from '../state/store';
import { HudSlider } from './hud/HudInputs';
import { HudCard } from './hud/HudCard';

const DEFAULT_VOLUME = 0.4;
const MUSIC_SELECTOR = '[data-music-zone]';
// Files dropped in assets/musics/ become the playlist at build time.
const PLAYLIST = buildPlaylist(
  import.meta.glob<string>('../assets/musics/*.{mp3,m4a,ogg}', {
    query: '?url',
    import: 'default',
    eager: true,
  }),
);
const CONTROLS_ID = 'music-player-controls';

const BUTTON_CLASS =
  'rounded-hud border border-hud-accent/30 bg-white/5 px-1.5 py-0.5 font-hud text-sm text-hud-text hover:bg-white/10';

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
  const [index, setIndex] = useState(0);
  // Set by goTo, consumed after the new src has been rendered.
  const resumeRef = useRef(false);

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

  useEffect(() => {
    if (!resumeRef.current) return;
    resumeRef.current = false;
    audioRef.current?.play().catch(() => {});
  }, [index]);

  /**
   * Same target index restarts the track; otherwise switch track (the src follows
   * the index). Resumes only if it was playing — or `forcePlay`, because an ended
   * track reports paused.
   */
  const goTo = (target: number, forcePlay = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    const resume = forcePlay || !audio.paused;
    if (target === index) {
      audio.currentTime = 0;
      if (resume) audio.play().catch(() => {});
    } else {
      resumeRef.current = resume;
      setIndex(target);
    }
  };

  return {
    audioRef,
    playing,
    volume,
    track: PLAYLIST[index],
    toggle,
    setVolume,
    prev: () => goTo(prevIndex(index, PLAYLIST.length)),
    next: () => goTo(nextIndex(index, PLAYLIST.length)),
    onEnded: () => goTo(nextIndex(index, PLAYLIST.length), true),
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

  if (!track) return null;

  return (
    <HudCard
      as="section"
      aria-label={t('music.label')}
      data-hud="music-player"
      data-testid="music-control"
      data-music-zone
      data-expanded={expanded}
      className={`absolute bottom-4 right-4 z-20 px-2 py-1 ${expanded ? 'w-64 max-lg:bottom-20 max-lg:max-w-[calc(100%-2rem)]' : ''}`}
    >
      <audio
        ref={audioRef}
        src={track.src}
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
            {track.title}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="music-prev"
              aria-label={t('music.prev')}
              onClick={prev}
              className={BUTTON_CLASS}
            >
              <span aria-hidden>⏮&#xFE0E;</span>
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
              <span aria-hidden>⏭&#xFE0E;</span>
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
    </HudCard>
  );
}
