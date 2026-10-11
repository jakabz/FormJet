import { formatNumberValue, getCurrencyAffix, getDecimalSeparator, resolveNumberDefault } from '../NumberFormat';

describe('NumberFormat', () => {
  it('a kultúra tizedesjele; ismeretlen kultúránál pont', () => {
    expect(getDecimalSeparator('hu-HU')).toBe(',');
    expect(getDecimalSeparator('en-US')).toBe('.');
    expect(getDecimalSeparator('de-DE')).toBe(',');
    expect(getDecimalSeparator('xx-rossz!')).toBe('.');
  });

  it('formatNumberValue: a kultúra tizedesjelével, ezres tagolás és lebegőpontos zaj nélkül', () => {
    expect(formatNumberValue(1234.5, 'hu-HU')).toBe('1234,5');
    expect(formatNumberValue(1234.5, 'en-US')).toBe('1234.5');
    expect(formatNumberValue(0.07 * 100, 'hu-HU')).toBe('7');
  });

  it('resolveNumberDefault: százalékos mezőnél a tárolt törtből százalékérték lesz', () => {
    expect(resolveNumberDefault('0.25', 'hu-HU', true)).toBe('25');
    expect(resolveNumberDefault('0.07', 'hu-HU', true)).toBe('7');
    expect(resolveNumberDefault('0.125', 'hu-HU', true)).toBe('12,5');
    expect(resolveNumberDefault('0.125', 'en-US', true)).toBe('12.5');
    expect(resolveNumberDefault('-0.5', 'hu-HU', true)).toBe('-50');
  });

  it('resolveNumberDefault: a tizedespont a kultúra tizedesjelére cserélődik', () => {
    expect(resolveNumberDefault('0.25', 'hu-HU', false)).toBe('0,25');
    expect(resolveNumberDefault('0.25', 'en-US', false)).toBe('0.25');
    expect(resolveNumberDefault('100', 'hu-HU', false)).toBe('100');
  });

  it('resolveNumberDefault: a nem egyszerű szám (például képlet) változatlan marad', () => {
    expect(resolveNumberDefault('=1+1', 'hu-HU', true)).toBe('=1+1');
    expect(resolveNumberDefault('abc', 'hu-HU', false)).toBe('abc');
  });

  it('getCurrencyAffix: a pénznem jele és helye a nyelvi azonosítóból', () => {
    expect(getCurrencyAffix(1038)).toEqual({ symbol: 'Ft', position: 'suffix' });
    expect(getCurrencyAffix(1033)).toEqual({ symbol: '$', position: 'prefix' });
    expect(getCurrencyAffix(2057)).toEqual({ symbol: '£', position: 'prefix' });
    expect(getCurrencyAffix(1031)).toEqual({ symbol: '€', position: 'suffix' });
  });

  it('getCurrencyAffix: ismeretlen vagy hiányzó azonosítóra nincs jel', () => {
    expect(getCurrencyAffix(9999)).toBeUndefined();
    expect(getCurrencyAffix(undefined)).toBeUndefined();
  });
});
