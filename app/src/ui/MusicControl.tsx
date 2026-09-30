/* eslint-disable react-refresh/only-export-components --
   Task 2.2 (SPEC §4.1) requires useMusic() and MusicPanel to live together in
   this file: the hook owns the <audio> ref/state (mounted once in
   ControlDock, outside any panel) and MusicPanel is its dock panel content.
   Splitting them into separate files for fast-refresh purity would scatter
   one small, tightly-coupled feature across two files for no reader benefit. */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { HudSlider } from './hud/HudInputs';
import { HudPanel } from './hud/HudPanel';

const DEFAULT_VOLUME = 0.4;

/**
 * Looping background music: play/pause + volume state, and the
 * autoplay-on-first-gesture fallback (browsers block autoplay with sound
 * until a user gesture — we try to start on mount and otherwise on the first
 * pointer/key event). `audioRef` is attached to the `<audio>` element, which
 * ControlDock mounts outside any panel so playback survives panel open/close
 * and view changes. `excludeRef` marks the container (dock icon + panel)
 * whose own gestures must not trigger the fallback — otherwise a deliberate
 * first click on the music icon/controls could race an unwanted autoplay.
 */
export function useMusic(): {
  audioRef: RefObject<HTMLAudioElement | null>;
  excludeRef: RefObject<HTMLElement | null>;
  playing: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (v: number) => void;
  onPlay: () => void;
  onPause: () => void;
} {
  const audioRef = useRef<HTMLAudioElement>(null);
  const excludeRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = DEFAULT_VOLUME;
    const onGesture = (event: Event) => {
      removeListeners();
      if (excludeRef.current?.contains(event.target as Node)) return;
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
    excludeRef,
    playing,
    volume,
    toggle,
    setVolume,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
  };
}

/** Music dock panel content: play/pause + volume (Task 2.2). */
export function MusicPanel({
  playing,
  volume,
  onToggle,
  onVolume,
}: {
  playing: boolean;
  volume: number;
  onToggle: () => void;
  onVolume: (v: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <HudPanel
      id="dock-panel-music"
      aria-label={t('dock.music')}
      data-testid="music-control"
      className="flex items-center gap-2"
    >
      <button
        type="button"
        data-testid="music-toggle"
        aria-label={playing ? t('music.pause') : t('music.play')}
        onClick={onToggle}
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
        onChange={(event) => onVolume(Number(event.target.value))}
      />
    </HudPanel>
  );
}
