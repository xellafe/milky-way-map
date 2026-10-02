import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import musicUrl from '../assets/background-music.mp3';
import { HudSlider } from './hud/HudInputs';
import { HudPanel } from './hud/HudPanel';

const DEFAULT_VOLUME = 0.4;
const MUSIC_SELECTOR = '[data-music-zone]';

/**
 * Looping background music: play/pause + volume state, and the
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

  return {
    audioRef,
    playing,
    volume,
    toggle,
    setVolume,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
  };
}

/**
 * Always-visible music controls (top-right, next to the language selector).
 * Mounted in App outside the galaxy/system view switch so the <audio> element
 * and its playback state survive view changes.
 */
export function MusicControl() {
  const { t } = useTranslation();
  const { audioRef, playing, volume, toggle, setVolume, onPlay, onPause } = useMusic();
  return (
    <HudPanel
      aria-label={t('music.label')}
      data-testid="music-control"
      data-music-zone
      padding="px-2 py-1"
      className="flex items-center gap-2"
    >
      <audio
        ref={audioRef}
        src={musicUrl}
        loop
        preload="none"
        data-testid="music-audio"
        onPlay={onPlay}
        onPause={onPause}
      />
      <button
        type="button"
        data-testid="music-toggle"
        aria-label={playing ? t('music.pause') : t('music.play')}
        onClick={toggle}
        className="rounded border border-hud-accent/30 bg-white/5 px-1.5 py-0.5 font-hud text-sm text-hud-text hover:bg-white/10"
      >
        <span aria-hidden>{playing ? '❚❚' : '▶'}</span>
      </button>
      <HudSlider
        min={0}
        max={1}
        step={0.05}
        value={volume}
        aria-label={t('music.volume')}
        data-testid="music-volume"
        className="w-32"
        onChange={(event) => setVolume(Number(event.target.value))}
      />
    </HudPanel>
  );
}
