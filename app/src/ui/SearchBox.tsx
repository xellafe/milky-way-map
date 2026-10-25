import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getExoplanetsStatus, loadExoplanets, searchHosts } from '../data/exoplanets';
import { looksLikeCatalogId, searchByCatalogId } from '../data/idSearch';
import {
  getNamesIndexStatus,
  loadNamesIndex,
  searchStars,
  type StarSearchResult,
} from '../data/namesIndex';
import { getStarCore } from '../data/starCoreStore';
import { useLayoutMode } from '../lib/viewport';
import { useGalaxyMapStore } from '../state/store';

interface ResultItem {
  key: string;
  label: string;
  kind: 'star' | 'host';
  starIndex: number | null;
  hostname?: string;
  unanchored?: boolean;
}

interface IdResults {
  query: string;
  items: StarSearchResult[];
  failed: boolean;
}

// ms of typing pause before results and Gaia/TYC lookups run (#37): skips the
// work and the bucket fetches for intermediate keystrokes; UX choice (not data).
const SEARCH_DEBOUNCE_MS = 100;

/** DOM id of a result option; host names may contain characters invalid in ids. */
function optionId(key: string): string {
  return `search-option-${key.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/** Star, catalog-id and host results for one query; ids only if resolved for it. */
function buildResults(query: string, idResults: IdResults | null): ResultItem[] {
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
  // Results and id lookups follow the query once typing pauses; the input stays live.
  const [searchQuery, setSearchQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  // Phone (#25): the box is an icon until tapped, then fills the top bar up to help / language.
  const phone = useLayoutMode() !== 'desktop';
  const [fieldShown, setFieldShown] = useState(false);
  const collapsed = phone && !fieldShown;
  // Bumped when async catalogs (names index / exoplanets) finish loading,
  // so an already-typed query re-runs against the fresh data.
  const [dataVersion, setDataVersion] = useState(0);
  // Exact Gaia/TYC id lookups resolve asynchronously (on-demand bucket fetch);
  // results are keyed by query so stale answers are ignored.
  const [idResults, setIdResults] = useState<IdResults | null>(null);

  useEffect(() => {
    if (query === searchQuery) return;
    const timer = setTimeout(() => setSearchQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchQuery]);

  useEffect(() => {
    if (!looksLikeCatalogId(searchQuery)) return;
    let cancelled = false;
    searchByCatalogId(searchQuery)
      .then((items) => {
        if (!cancelled) setIdResults({ query: searchQuery, items, failed: false });
      })
      .catch((error: unknown) => {
        console.warn('catalog id bucket load failed', error);
        if (!cancelled) setIdResults({ query: searchQuery, items: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  // Set by Esc: the focused input unmounts, so focus goes back to the icon (keyboard a11y).
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (fieldShown) inputRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      openButtonRef.current?.focus();
    }
  }, [fieldShown]);
  const selectStar = useGalaxyMapStore((s) => s.selectStar);
  const enterSystemView = useGalaxyMapStore((s) => s.enterSystemView);
  const requestFlyTo = useGalaxyMapStore((s) => s.requestFlyTo);

  const results = useMemo<ResultItem[]>(() => {
    void dataVersion; // re-derive when async catalogs land
    return buildResults(searchQuery, idResults);
  }, [searchQuery, dataVersion, idResults]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));
  // Statuses are module-level; dataVersion bumps re-render when a load settles.
  const idCurrent = idResults?.query === searchQuery ? idResults : null;
  const catalogStatuses = [getNamesIndexStatus(), getExoplanetsStatus()];
  const loadFailed = catalogStatuses.includes('error') || idCurrent?.failed === true;
  const loadPending =
    catalogStatuses.some((st) => st !== 'ready') || (looksLikeCatalogId(searchQuery) && !idCurrent);

  const choose = (item: ResultItem) => {
    if (item.kind === 'host' && item.unanchored && item.hostname) {
      // No catalog star to anchor a card to (#23): straight to the System View.
      enterSystemView(item.hostname);
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
    setSearchQuery('');
    setFieldShown(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Clamped at 0: before results load, length - 1 would be -1 and select nothing (#41).
      setActive((a) => Math.max(0, Math.min(a + 1, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      // Before the debounce settles, pick from results for what is typed now.
      const current = query === searchQuery ? results : buildResults(query, idResults);
      const item = current[Math.min(activeIndex, current.length - 1)];
      if (!item) return;
      e.preventDefault();
      choose(item);
    } else if (e.key === 'Escape') {
      // Mark handled so the dock's document-level Esc listener ignores it.
      e.preventDefault();
      setOpen(false);
      restoreFocus.current = true;
      setFieldShown(false);
      inputRef.current?.blur();
    }
  };

  // Hides at once when the query is cleared; appears once the first results are computed.
  const showList = open && query.trim().length >= 2 && searchQuery.trim().length >= 2;

  if (collapsed) {
    return (
      <div role="search">
        <button
          ref={openButtonRef}
          type="button"
          data-testid="search-open"
          aria-label={t('ui.searchOpen')}
          onClick={() => setFieldShown(true)}
          className="hud-card flex h-11 w-11 items-center justify-center text-hud-text"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="11" cy="11" r="6.5" strokeWidth="1.6" />
            <path strokeWidth="1.6" strokeLinecap="round" d="m16 16 4.5 4.5" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={phone ? 'min-w-0 flex-1' : 'absolute top-4 left-4 z-10 w-80'} role="search">
      <input
        ref={inputRef}
        type="text"
        value={query}
        role="combobox"
        aria-expanded={showList}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={
          showList && results.length > 0 ? optionId(results[activeIndex]!.key) : undefined
        }
        placeholder={t('ui.searchPlaceholder')}
        data-testid="search-input"
        data-hud="search"
        className={`hud-card w-full px-3 ${phone ? 'h-11 text-base' : 'py-2 text-sm'} font-hud text-hud-text placeholder-hud-muted outline-none focus:ring-2 focus:ring-hud-accent`}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          // Host search needs exoplanets.json; fetch lazily on first focus. Both
          // loaders are no-ops once loaded and retry after a failure (#36).
          const bump = () => setDataVersion((v) => v + 1);
          for (const [name, load] of [
            ['names index', loadNamesIndex],
            ['exoplanets', loadExoplanets],
          ] as const) {
            load().then(bump, (error: unknown) => {
              console.warn(`${name} load failed`, error);
              bump();
            });
          }
          // A retry flips the status from error to loading synchronously.
          bump();
        }}
        onBlur={() => {
          // A combobox popup closes on blur; the query stays and onFocus reopens it (#41).
          setOpen(false);
          if (phone && query === '') setFieldShown(false);
        }}
        onKeyDown={onKeyDown}
      />
      {/* Outside the listbox, which only admits options; kept mounted so the
          change is announced (SPEC §6.9). */}
      <p role="status" className="sr-only">
        {showList && results.length === 0 && loadFailed ? t('ui.searchLoadFailed') : ''}
      </p>
      {showList && (
        <ul
          id="search-results"
          role="listbox"
          data-testid="search-results"
          className={`hud-card font-hud text-sm ${
            phone
              ? // Spans the top bar (the nearest positioned ancestor), scrolls inside the viewport.
                // 5rem = 80 px: top bar height plus gap kept free below the viewport top; aesthetic choice (not data).
                'absolute inset-x-2 top-full mt-1 max-h-[calc(100dvh-5rem)] overflow-y-auto'
              : 'mt-1 overflow-hidden'
          }`}
        >
          {/* A listbox only admits options: the empty state is a disabled one. */}
          {results.length === 0 &&
            (loadFailed ? (
              <li
                role="option"
                aria-selected={false}
                aria-disabled
                data-testid="search-error"
                className="px-3 py-2 text-hud-warn"
              >
                {t('ui.searchLoadFailed')}
              </li>
            ) : (
              <li
                role="option"
                aria-selected={false}
                aria-disabled
                className="px-3 py-2 text-hud-muted"
              >
                {loadPending ? t('ui.loading') : t('ui.searchNoResults')}
              </li>
            ))}
          {results.map((item, i) => (
            // The option itself is the pointer target (no nested button); preventDefault keeps
            // focus in the input so blur does not close the list before the choice.
            <li
              key={item.key}
              id={optionId(item.key)}
              role="option"
              aria-selected={i === activeIndex}
              className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 ${phone ? 'min-h-11' : ''} text-left text-hud-text ${
                i === activeIndex ? 'bg-white/10' : ''
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
            >
              <span>{item.label}</span>
              {item.unanchored && (
                <span className="ml-2 text-xs text-hud-warn">{t('ui.searchUnanchored')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
