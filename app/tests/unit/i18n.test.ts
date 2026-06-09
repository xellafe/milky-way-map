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
});
