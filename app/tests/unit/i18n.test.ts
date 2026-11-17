import { describe, expect, it } from 'vitest';

import de from '../../src/i18n/locales/de.json';
import en from '../../src/i18n/locales/en.json';
import es from '../../src/i18n/locales/es.json';
import fr from '../../src/i18n/locales/fr.json';
import it_ from '../../src/i18n/locales/it.json';

type LocaleTree = { [key: string]: string | LocaleTree };

function keyPaths(tree: LocaleTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : keyPaths(value, path);
  });
}

const locales: Record<string, LocaleTree> = { it: it_, es, fr, de };

describe('i18n locales', () => {
  const enKeys = keyPaths(en).sort();

  it('en has at least one key', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  for (const [lang, tree] of Object.entries(locales)) {
    it(`${lang} has exactly the same key set as en`, () => {
      expect(keyPaths(tree).sort()).toEqual(enKeys);
    });

    it(`${lang} has no empty strings`, () => {
      const empty = keyPaths(tree).filter((path) => {
        const value = path
          .split('.')
          .reduce<
            LocaleTree | string
          >((node, part) => (typeof node === 'string' ? node : (node[part] ?? '')), tree);
        return typeof value === 'string' && value.trim() === '';
      });
      expect(empty).toEqual([]);
    });
  }

  it.each(['ui.searchLoadFailed', 'filters.loadFailed'])(
    'en defines the loader error key %s (#36)',
    (key) => {
      expect(enKeys).toContain(key);
    },
  );

  const placeholders = (value: string) =>
    [...value.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?(\w+)\s*\/?>/g)]
      .map((m) => (m[1] ? `{{${m[1]}}}` : `<${m[2]}>`))
      .sort();

  function leaves(tree: LocaleTree, prefix = ''): Record<string, string> {
    return Object.fromEntries(
      Object.entries(tree).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof value === 'string' ? [[path, value]] : Object.entries(leaves(value, path));
      }),
    );
  }

  const REMOVED_KEYS = [
    'ui.appName',
    'language.label',
    'system.type',
    'music.nowPlaying',
    'welcome.guide.move.upDown',
    'welcome.guide.move.roll',
  ];

  it('no locale keeps a removed key', () => {
    for (const tree of [en, ...Object.values(locales)]) {
      expect(keyPaths(tree).filter((k) => REMOVED_KEYS.includes(k))).toEqual([]);
    }
  });

  for (const [lang, tree] of Object.entries(locales)) {
    it(`${lang} keeps the placeholders and tags of every en value`, () => {
      const own = leaves(tree);
      for (const [key, value] of Object.entries(leaves(en))) {
        expect(placeholders(own[key]!), `${lang}:${key}`).toEqual(placeholders(value));
      }
    });
  }

  it('fr joins value, unit and colons with no-break spaces', () => {
    const f = leaves(fr);
    const NBSP = ' ';
    expect(f['units.valueUnit']).toBe(`{{value}}${NBSP}{{unit}}`);
    expect(f['units.lyPerS']).toContain(`${NBSP}a.l./s`);
    expect(f['units.approx']).toBe(`≈${NBSP}{{value}}`);
    expect(f['system.typeValue']).toContain(`Type${NBSP}:`);
    expect(f['language.menuLabelCurrent']).toContain(`${NBSP}:`);
    expect(f['music.nowPlayingTitle']).toContain(`${NBSP}:</sr>`);
    expect(f['system.daysPerSecond']).toBe(`{{value}}${NBSP}jours/s`);
  });

  it('fr has no plain space before : ; ? ! nor inside guillemets', () => {
    const bad = Object.entries(leaves(fr)).filter(([, v]) => / [:;?!»]|« /.test(v));
    expect(bad).toEqual([]);
  });
});
