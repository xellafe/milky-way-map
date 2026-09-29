import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

/**
 * Endonyms (each language named in itself) — intentionally NOT translated:
 * a language picker should read the same regardless of the active locale, so
 * users can find their language even when the UI is in one they can't read.
 */
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  it: 'Italiano',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

function normalize(lng: string): SupportedLanguage {
  const base = lng.split('-')[0] as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
}

/**
 * Language selector (SPEC §6.8): a globe button opening a menu of the five
 * supported languages. Implements the WAI-ARIA menu-button pattern — keyboard
 * operable (arrows / Home / End / Enter / Escape), focus returns to the button
 * on close, current language marked with aria-checked (menuitemradio).
 * Choice persists for the session only (i18next sessionStorage cache).
 */
export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const current = normalize(i18n.language);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // On open, move focus to the active language item.
  useEffect(() => {
    if (!open) return;
    const index = SUPPORTED_LANGUAGES.indexOf(current);
    itemRefs.current[index]?.focus();
  }, [open, current]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(lng: SupportedLanguage) {
    void i18n.changeLanguage(lng);
    close();
  }

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  }

  function focusItem(index: number) {
    const n = SUPPORTED_LANGUAGES.length;
    const wrapped = ((index % n) + n) % n;
    itemRefs.current[wrapped]?.focus();
  }

  function onItemKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(index + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(0);
        break;
      case 'End':
        e.preventDefault();
        focusItem(SUPPORTED_LANGUAGES.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        // Leaving the menu by Tab closes it without stealing focus back.
        close(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className="absolute top-4 right-4 z-40">
      <button
        ref={buttonRef}
        type="button"
        data-testid="language-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('language.menuLabel')}: ${LANGUAGE_NAMES[current]}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKeyDown}
        className="flex items-center gap-1.5 rounded border border-hud-accent/30 bg-white/5 px-2.5 py-2 font-hud text-sm text-hud-text hover:bg-white/10"
      >
        <span aria-hidden>🌐</span>
        <span className="font-hud-mono">{current.toUpperCase()}</span>
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-label={t('language.menuLabel')}
          data-testid="language-menu"
          className="hud-panel absolute right-0 mt-1 min-w-40 overflow-hidden rounded-lg py-1 font-hud"
        >
          {SUPPORTED_LANGUAGES.map((lng, index) => (
            <li key={lng} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={lng === current}
                data-testid={`language-option-${lng}`}
                tabIndex={lng === current ? 0 : -1}
                onClick={() => choose(lng)}
                onKeyDown={(e) => onItemKeyDown(e, index)}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-hud-text hover:bg-white/10 focus:bg-white/15 focus:outline-none"
              >
                {LANGUAGE_NAMES[lng]}
                {lng === current && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
