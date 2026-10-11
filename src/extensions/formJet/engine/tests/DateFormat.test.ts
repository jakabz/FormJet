import {
  formatDateValue,
  getCalendarNames,
  getDateTemplate,
  getFirstDayOfWeek,
  parseDateValue,
  roundToTimeStep
} from '../DateFormat';

function time(date: Date | undefined): number | undefined {
  return date?.getTime();
}

describe('DateFormat', () => {
  const sample: Date = new Date(2026, 9, 10, 14, 5);

  it('a kultúra szerinti dátumminta', () => {
    expect(getDateTemplate('hu-HU')).toBe('yyyy. MM. dd.');
    expect(getDateTemplate('en-US')).toBe('MM/dd/yyyy');
    expect(getDateTemplate('en-GB')).toBe('dd/MM/yyyy');
    expect(getDateTemplate('de-DE')).toBe('dd.MM.yyyy');
    // Ismeretlen kultúra: az angol (amerikai) minta.
    expect(getDateTemplate('xx-invalid!')).toBe('MM/dd/yyyy');
  });

  it('formázás: dátum, illetve dátum 24 órás idővel', () => {
    expect(formatDateValue(sample, 'hu-HU', true)).toBe('2026. 10. 10.');
    expect(formatDateValue(sample, 'hu-HU', false)).toBe('2026. 10. 10. 14:05');
    expect(formatDateValue(sample, 'en-US', true)).toBe('10/10/2026');
    expect(formatDateValue(sample, 'en-US', false)).toBe('10/10/2026 14:05');
  });

  it('oda-vissza alakítás több kultúrán', () => {
    ['hu-HU', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'ja-JP', 'sv-SE', 'xx-invalid!'].forEach((culture) => {
      expect(time(parseDateValue(formatDateValue(sample, culture, false), culture))).toBe(sample.getTime());
      expect(time(parseDateValue(formatDateValue(sample, culture, true), culture))).toBe(new Date(2026, 9, 10).getTime());
    });
  });

  it('értelmezés: kezdő nullák nélkül, idővel, 12 órás alakban is', () => {
    expect(time(parseDateValue('2026.3.5', 'hu-HU'))).toBe(new Date(2026, 2, 5).getTime());
    expect(time(parseDateValue('2026. 03. 05. 9:30', 'hu-HU'))).toBe(new Date(2026, 2, 5, 9, 30).getTime());
    expect(time(parseDateValue('3/5/2026 2:30 PM', 'en-US'))).toBe(new Date(2026, 2, 5, 14, 30).getTime());
    expect(time(parseDateValue('3/5/2026 12:15 AM', 'en-US'))).toBe(new Date(2026, 2, 5, 0, 15).getTime());
  });

  it('a nap és a hónap sorrendje a kultúrát követi', () => {
    expect(time(parseDateValue('05/03/2026', 'en-GB'))).toBe(new Date(2026, 2, 5).getTime());
    expect(time(parseDateValue('05/03/2026', 'en-US'))).toBe(new Date(2026, 4, 3).getTime());
  });

  it('érvénytelen dátum, szöveg és üres érték elutasítva', () => {
    expect(parseDateValue('2026. 02. 31.', 'hu-HU')).toBeUndefined();
    expect(parseDateValue('holnap', 'hu-HU')).toBeUndefined();
    expect(parseDateValue('[today]', 'hu-HU')).toBeUndefined();
    expect(parseDateValue('', 'hu-HU')).toBeUndefined();
    expect(parseDateValue(undefined, 'hu-HU')).toBeUndefined();
  });

  it('naptárnevek és a hét első napja', () => {
    const names = getCalendarNames('hu-HU');
    expect(names.months).toHaveLength(12);
    expect(names.days).toHaveLength(7);
    expect(names.months[0]).toBe('január');
    expect(names.days[0]).toBe('vasárnap');
    expect(getFirstDayOfWeek('hu-HU')).toBe(1);
    expect(getFirstDayOfWeek('en-US')).toBe(0);
  });

  it('roundToTimeStep: a legközelebbi 5 percre kerekít, éjfél előtt a következő napra vált', () => {
    const rounded = (h: number, m: number, s: number = 0): Date => roundToTimeStep(new Date(2026, 9, 11, h, m, s));
    expect(rounded(10, 23).getTime()).toBe(new Date(2026, 9, 11, 10, 25).getTime());
    expect(rounded(10, 22).getTime()).toBe(new Date(2026, 9, 11, 10, 20).getTime());
    expect(rounded(10, 25).getTime()).toBe(new Date(2026, 9, 11, 10, 25).getTime());
    expect(rounded(10, 27, 29).getTime()).toBe(new Date(2026, 9, 11, 10, 25).getTime());
    expect(rounded(10, 27, 30).getTime()).toBe(new Date(2026, 9, 11, 10, 30).getTime());
    expect(rounded(23, 58).getTime()).toBe(new Date(2026, 9, 12, 0, 0).getTime());
  });
});
