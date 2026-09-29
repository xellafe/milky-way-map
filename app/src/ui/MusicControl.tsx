import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import musicUrl from '../assets/background-music.mp3';
import { HudSlider } from './hud/HudInputs';

const DEFAULT_VOLUME = 0.4;

/**
 * Looping background music with play/pause and volume. Lives outside the
 * galaxy/system view switch so playback survives view changes.
 * Browsers block autoplay with sound until a user gesture: we try to start on
 * mount and otherwise on the first pointer/key event — unless that gesture is
 * on this control itself (the user is about to choose explicitly).
 */
export function MusicControl() {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = DEFAULT_VOLUME;
    const onGesture = (event: Event) => {
      removeListeners();
      if (containerRef.current?.contains(event.target as Node)) return;
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

  const changeVolume = (value: number) => {
    setVolume(value);
    if (audioRef.current) audioRef.current.volume = value;
  };

  return (
    <div
      ref={containerRef}
      data-testid="music-control"
      className="hud-panel absolute top-4 right-24 z-40 flex items-center gap-2 rounded-lg px-2 py-1"
    >
      <audio
        ref={audioRef}
        src={musicUrl}
        loop
        preload="none"
        data-testid="music-audio"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {/*
       * Native button, not HudButton: HudButton hardcodes px-3 py-1.5 padding
       * that a className override cannot reliably shrink (same-specificity
       * conflict resolved by stylesheet order, not by prop precedence — see
       * the time-log-mode fix in SystemOverlay). This compact icon toggle
       * needs to stay small so it doesn't grow into the options-toggle
       * button's fixed position (`right-24` vs `right-[15rem]`, unchanged
       * from before the restyle).
       */}
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
        className="w-20"
        onChange={(event) => changeVolume(Number(event.target.value))}
      />
    </div>
  );
}
