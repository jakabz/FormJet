// Szám form-string a web területi beállításai (kultúra) szerint.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

const PLAIN_NUMBER: RegExp = /^-?\d+(\.\d+)?$/;
/** Ennyi értékes jegyre kerekítünk, hogy a lebegőpontos szorzás zaja (0.07 × 100) ne látsszon. */
const SIGNIFICANT_DIGITS: number = 12;

const separatorCache: Record<string, string> = {};

/** A kultúra tizedesjele, pl. hu-HU: `,`, en-US: `.`. */
export function getDecimalSeparator(culture: string): string {
  if (separatorCache[culture] === undefined) {
    let separator: string = '.';
    try {
      // Az 1,5 formázott alakjában a két számjegy közötti jel a tizedesjel.
      const formatted: string = new Intl.NumberFormat(`${culture}-u-nu-latn`).format(1.5);
      const match: RegExpMatchArray | null = formatted.match(/1(\D+)5/);
      separator = match ? match[1] : '.';
    } catch {
      // Ismeretlen kultúra: marad a pont.
    }
    separatorCache[culture] = separator;
  }
  return separatorCache[culture];
}

/** Szám → form-string a kultúra tizedesjelével, ezres tagolás nélkül. */
export function formatNumberValue(value: number, culture: string): string {
  const rounded: number = Number(value.toPrecision(SIGNIFICANT_DIGITS));
  return String(rounded).replace('.', getDecimalSeparator(culture));
}

/**
 * Szám mező sémabeli alapértéke form-stringként. A SharePoint az alapértéket kultúrafüggetlen alakban
 * (tizedesponttal), százalékos mezőnél törtként tárolja (25% → `0.25`); a form a kultúra tizedesjelével,
 * százalékos mezőnél százalékértékként (`25`) várja. Nem egyszerű számot (pl. képletet) változatlanul ad vissza.
 */
export function resolveNumberDefault(raw: string, culture: string, percentage: boolean): string {
  const text: string = raw.trim();
  if (!PLAIN_NUMBER.test(text)) {
    return raw;
  }
  const value: number = Number(text);
  return formatNumberValue(percentage ? value * 100 : value, culture);
}

export interface ICurrencyAffix {
  symbol: string;
  /** A pénznem jele a szám előtt vagy után áll. */
  position: 'prefix' | 'suffix';
}

/**
 * A pénznem mező `CurrencyLocaleId` (LCID) értékéhez tartozó nyelvi beállítás és pénznem.
 * Az LCID-ből a böngésző nem tudja kiolvasni a pénznemet, ezért a gyakori értékeket itt soroljuk fel;
 * ismeretlen LCID-nél a mező jel nélkül jelenik meg.
 */
const CURRENCY_LOCALES: Record<number, [string, string]> = {
  1038: ['hu-HU', 'HUF'],
  1033: ['en-US', 'USD'],
  2057: ['en-GB', 'GBP'],
  6153: ['en-IE', 'EUR'],
  4105: ['en-CA', 'CAD'],
  3084: ['fr-CA', 'CAD'],
  3081: ['en-AU', 'AUD'],
  5129: ['en-NZ', 'NZD'],
  7177: ['en-ZA', 'ZAR'],
  16393: ['en-IN', 'INR'],
  1081: ['hi-IN', 'INR'],
  1031: ['de-DE', 'EUR'],
  3079: ['de-AT', 'EUR'],
  2055: ['de-CH', 'CHF'],
  4108: ['fr-CH', 'CHF'],
  1036: ['fr-FR', 'EUR'],
  2060: ['fr-BE', 'EUR'],
  2067: ['nl-BE', 'EUR'],
  1043: ['nl-NL', 'EUR'],
  1040: ['it-IT', 'EUR'],
  3082: ['es-ES', 'EUR'],
  2058: ['es-MX', 'MXN'],
  2070: ['pt-PT', 'EUR'],
  1046: ['pt-BR', 'BRL'],
  1032: ['el-GR', 'EUR'],
  1035: ['fi-FI', 'EUR'],
  1061: ['et-EE', 'EUR'],
  1062: ['lv-LV', 'EUR'],
  1063: ['lt-LT', 'EUR'],
  1051: ['sk-SK', 'EUR'],
  1060: ['sl-SI', 'EUR'],
  1050: ['hr-HR', 'EUR'],
  1045: ['pl-PL', 'PLN'],
  1029: ['cs-CZ', 'CZK'],
  1048: ['ro-RO', 'RON'],
  1058: ['uk-UA', 'UAH'],
  1053: ['sv-SE', 'SEK'],
  1044: ['nb-NO', 'NOK'],
  1030: ['da-DK', 'DKK'],
  1055: ['tr-TR', 'TRY'],
  1037: ['he-IL', 'ILS'],
  1041: ['ja-JP', 'JPY'],
  2052: ['zh-CN', 'CNY'],
  1042: ['ko-KR', 'KRW']
};

const affixCache: Record<number, ICurrencyAffix | undefined> = {};

/** A pénznem jele és helye (a szám előtt vagy után) a mező beállítása szerint; ismeretlen LCID-re `undefined`. */
export function getCurrencyAffix(localeId: number | undefined): ICurrencyAffix | undefined {
  if (localeId === undefined || !CURRENCY_LOCALES[localeId]) {
    return undefined;
  }
  if (!(localeId in affixCache)) {
    const [locale, currency] = CURRENCY_LOCALES[localeId];
    let affix: ICurrencyAffix | undefined;
    try {
      const formatted: string = new Intl.NumberFormat(`${locale}-u-nu-latn`, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(1);
      // Az „1” formázott alakjából a számjegy előtti vagy utáni rész a pénznem jele.
      const index: number = formatted.indexOf('1');
      const before: string = formatted.slice(0, index).trim();
      const after: string = formatted.slice(index + 1).trim();
      if (index !== -1 && (before || after)) {
        affix = before ? { symbol: before, position: 'prefix' } : { symbol: after, position: 'suffix' };
      }
    } catch {
      // A böngésző nem ismeri a nyelvi beállítást: a mező jel nélkül jelenik meg.
    }
    affixCache[localeId] = affix;
  }
  return affixCache[localeId];
}
