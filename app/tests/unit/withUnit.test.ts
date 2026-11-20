import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import de from '../../src/i18n/locales/de.json';
import en from '../../src/i18n/locales/en.json';
import es from '../../src/i18n/locales/es.json';
import fr from '../../src/i18n/locales/fr.json';
import it_ from '../../src/i18n/locales/it.json';
import { withUnit } from '../../src/lib/withUnit';

const NBSP = ' ';

describe('withUnit', () => {
  beforeAll(async () => {
    await i18next.init({
      lng: 'en',
      resources: {
        en: { translation: en },
        it: { translation: it_ },
        es: { translation: es },
        fr: { translation: fr },
        de: { translation: de },
      },
      interpolation: { escapeValue: false },
    });
  });

  it('returns null for a missing value so the caller shows n/a', () => {
    expect(withUnit(i18next.getFixedT('en'), null, 'K')).toBeNull();
  });

  it('joins value and unit with a plain space in English', () => {
    expect(withUnit(i18next.getFixedT('en'), '5', 'K')).toBe('5 K');
  });

  it('joins value and unit with a no-break space in French', () => {
    expect(withUnit(i18next.getFixedT('fr'), '5', 'K')).toBe(`5${NBSP}K`);
  });
});
