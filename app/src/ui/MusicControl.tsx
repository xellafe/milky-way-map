import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import musicUrl from '../assets/background-music.mp3';

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
      className="absolute top-4 right-24 z-40 flex items-center gap-2 rounded-lg bg-zinc-900/90 px-2 py-1 text-sm text-white shadow-xl backdrop-blur"
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
      <button
        type="button"
        data-testid="music-toggle"
        aria-label={playing ? t('music.pause') : t('music.play')}
        className="rounded px-1.5 py-0.5 hover:bg-white/10"
        onClick={toggle}
      >
        <span aria-hidden>{playing ? '❚❚' : '▶'}</span>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        aria-label={t('music.volume')}
        data-testid="music-volume"
        className="w-20 accent-white"
        onChange={(event) => changeVolume(Number(event.target.value))}
      />
    </div>
  );
}
