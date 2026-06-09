import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadExoplanets, searchHosts } from '../data/exoplanets';
import { isNamesIndexReady, searchStars } from '../data/namesIndex';
import type { StarCoreData } from '../data/starData';
import { useGalaxyMapStore } from '../state/store';

interface ResultItem {
  key: string;
  label: string;
  kind: 'star' | 'host';
  starIndex: number | null;
  hostname?: string;
  unanchored?: boolean;
}

/**
 * Minimal search (M3, expanded in M4): proper names + HD/HIP/Gl ids from the
 * classic index, plus exoplanet host names — the accessible route to systems
 * not anchored to a catalog star, e.g. TRAPPIST-1 (SPEC §5.3, §6.9).
 */
export function SearchBox({ stars }: { stars: StarCoreData | null }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  // Bumped when async catalogs (names index / exoplanets) finish loading,
  // so an already-typed query re-runs against the fresh data.
  const [dataVersion, setDataVersion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectStar = useGalaxyMapStore((s) => s.selectStar);
  const selectHost = useGalaxyMapStore((s) => s.selectHost);
  const requestFlyTo = useGalaxyMapStore((s) => s.requestFlyTo);

  const results = useMemo<ResultItem[]>(() => {
    void dataVersion; // re-derive when async catalogs land
    if (query.trim().length < 2) return [];
    const starResults: ResultItem[] = searchStars(query).map((r) => ({
      key: `star-${r.index}`,
      label: r.label,
      kind: 'star',
      starIndex: r.index,
    }));
    const seen = new Set(starResults.map((r) => r.starIndex));
    const hostResults: ResultItem[] = searchHosts(query)
      .filter((h) => !(h.matched && h.starIndex !== null && seen.has(h.starIndex)))
      .map((h) => ({
        key: `host-${h.hostname}`,
        label: h.hostname,
        kind: 'host',
        starIndex: h.starIndex,
        hostname: h.hostname,
        unanchored: !h.matched,
      }));
    return [...starResults, ...hostResults];
  }, [query, dataVersion]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  const choose = (item: ResultItem) => {
    if (item.kind === 'host' && item.unanchored && item.hostname) {
      selectHost(item.hostname);
    } else if (item.starIndex !== null) {
      selectStar(item.starIndex);
      if (stars) {
        const i = item.starIndex * 3;
        requestFlyTo([stars.position[i]!, stars.position[i + 1]!, stars.position[i + 2]!]);
      }
    }
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      choose(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div className="absolute top-4 left-4 z-10 w-80" role="search">
      <input
        ref={inputRef}
        type="text"
        value={query}
        role="combobox"
        aria-expanded={showList}
        aria-controls="search-results"
        aria-autocomplete="list"
        placeholder={t('ui.searchPlaceholder')}
        data-testid="search-input"
        className="w-full rounded-lg bg-zinc-900/90 px-3 py-2 text-sm text-white placeholder-white/40 shadow-xl backdrop-blur outline-none focus:ring-2 focus:ring-sky-400"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          // Host search needs exoplanets.json; fetch lazily on first focus.
          loadExoplanets()
            .then(() => setDataVersion((v) => v + 1))
            .catch(() => {});
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id="search-results"
          role="listbox"
          data-testid="search-results"
          className="mt-1 overflow-hidden rounded-lg bg-zinc-900/95 text-sm shadow-xl backdrop-blur"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-white/50">
              {isNamesIndexReady() ? t('ui.searchNoResults') : t('ui.loading')}
            </li>
          )}
          {results.map((item, i) => (
            <li key={item.key} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-white hover:bg-white/10 ${
                  i === activeIndex ? 'bg-white/10' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(item);
                }}
              >
                <span>{item.label}</span>
                {item.unanchored && (
                  <span className="ml-2 text-xs text-amber-300">{t('ui.searchUnanchored')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
