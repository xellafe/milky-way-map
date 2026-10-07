import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadExoplanets, searchHosts } from '../data/exoplanets';
import { looksLikeCatalogId, searchByCatalogId } from '../data/idSearch';
import { isNamesIndexReady, searchStars, type StarSearchResult } from '../data/namesIndex';
import { getStarCore } from '../data/starCoreStore';
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
 * Star positions come from starCoreStore, not props (see store docs).
 */
export function SearchBox() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  // Bumped when async catalogs (names index / exoplanets) finish loading,
  // so an already-typed query re-runs against the fresh data.
  const [dataVersion, setDataVersion] = useState(0);
  // Exact Gaia/TYC id lookups resolve asynchronously (on-demand bucket fetch);
  // results are keyed by query so stale answers are ignored.
  const [idResults, setIdResults] = useState<{ query: string; items: StarSearchResult[] } | null>(
    null,
  );

  useEffect(() => {
    if (!looksLikeCatalogId(query)) return;
    let cancelled = false;
    searchByCatalogId(query)
      .then((items) => {
        if (!cancelled) setIdResults({ query, items });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [query]);
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
    const catalogIdResults: ResultItem[] =
      idResults?.query === query
        ? idResults.items
            .filter((r) => !seen.has(r.index))
            .map((r) => ({
              key: `id-${r.index}`,
              label: r.label,
              kind: 'star' as const,
              starIndex: r.index,
            }))
        : [];
    return [...starResults, ...catalogIdResults, ...hostResults];
  }, [query, dataVersion, idResults]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  const choose = (item: ResultItem) => {
    if (item.kind === 'host' && item.unanchored && item.hostname) {
      selectHost(item.hostname);
    } else if (item.starIndex !== null) {
      selectStar(item.starIndex);
      const core = getStarCore();
      if (core) {
        const i = item.starIndex * 3;
        requestFlyTo([core.position[i]!, core.position[i + 1]!, core.position[i + 2]!]);
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
      // Mark handled so the dock's document-level Esc listener ignores it.
      e.preventDefault();
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
        data-hud="search"
        className="hud-card w-full px-3 py-2 font-hud text-sm text-hud-text placeholder-hud-muted outline-none focus:ring-2 focus:ring-hud-accent"
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
          className="hud-card mt-1 overflow-hidden font-hud text-sm"
        >
          {results.length === 0 && (
            <li className="px-3 py-2 text-hud-muted">
              {isNamesIndexReady() ? t('ui.searchNoResults') : t('ui.loading')}
            </li>
          )}
          {results.map((item, i) => (
            <li key={item.key} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-hud-text hover:bg-white/10 ${
                  i === activeIndex ? 'bg-white/10' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(item);
                }}
              >
                <span>{item.label}</span>
                {item.unanchored && (
                  <span className="ml-2 text-xs text-hud-warn">{t('ui.searchUnanchored')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
