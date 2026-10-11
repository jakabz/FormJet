// DateTime form-string ↔ Date, a web területi beállításai (kultúra) szerint.
// A dátumok "falióra" értékek a web időzónájában: nincs időzóna-átváltás, ugyanazt írjuk vissza, amit kaptunk.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

const FALLBACK_TEMPLATE: string = 'MM/dd/yyyy';
const DAYS_IN_WEEK: number = 7;

const templateCache: Record<string, string> = {};

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function formatter(culture: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    // Latin számjegyek és Gergely-naptár, bármi is a kultúra alapértelmezése.
    return new Intl.DateTimeFormat(`${culture}-u-nu-latn-ca-gregory`, options);
  } catch {
    return new Intl.DateTimeFormat('en-US', options);
  }
}

/** Az időválasztó lépésköze percben; az alapértelmezett „most” időpont is erre kerekül. */
export const TIME_STEP_MINUTES: number = 5;

/** Az időpont a legközelebbi lépésközre kerekítve (10:23 → 10:25, 10:22 → 10:20), másodpercek nélkül. */
export function roundToTimeStep(date: Date, stepMinutes: number = TIME_STEP_MINUTES): Date {
  const stepMs: number = stepMinutes * 60000;
  const midnight: Date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sinceMidnight: number = date.getTime() - midnight.getTime();
  // A nap kezdetétől számolunk, így az óraátállítás napján is a falióra szerinti percre kerekítünk.
  return new Date(midnight.getTime() + Math.round(sinceMidnight / stepMs) * stepMs);
}

/** A kultúra rövid dátummintája, pl. hu-HU: `yyyy. MM. dd.`, en-US: `MM/dd/yyyy`. */
export function getDateTemplate(culture: string): string {
  if (templateCache[culture] === undefined) {
    // Egy olyan dátumot formázunk, amelynek minden része egyértelműen felismerhető.
    const sample: string = formatter(culture, { year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(3333, 10, 22))
      .replace(/[‎‏]/g, '');
    const recognized: boolean = ['3333', '11', '22'].every((part) => sample.indexOf(part) !== -1);
    templateCache[culture] = recognized
      ? sample.replace('3333', 'yyyy').replace('11', 'MM').replace('22', 'dd')
      : FALLBACK_TEMPLATE;
  }
  return templateCache[culture];
}

/** Date → form-string. Az idő mindig 24 órás `HH:mm`, mert azt minden kultúra egyértelműen értelmezi. */
export function formatDateValue(date: Date, culture: string, dateOnly: boolean): string {
  const text: string = getDateTemplate(culture)
    .replace('yyyy', String(date.getFullYear()))
    .replace('MM', pad(date.getMonth() + 1))
    .replace('dd', pad(date.getDate()));
  return dateOnly ? text : `${text} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Form-string (vagy a felhasználó által begépelt szöveg) → Date. Nem értelmezhető szövegre undefined. */
export function parseDateValue(text: string | undefined, culture: string): Date | undefined {
  if (!text) {
    return undefined;
  }
  const numbers: string[] | null = text.match(/\d+/g);
  if (!numbers || numbers.length < 3) {
    return undefined;
  }
  const template: string = getDateTemplate(culture);
  const order: string[] = ['yyyy', 'MM', 'dd'].sort((a, b) => template.indexOf(a) - template.indexOf(b));
  const part = (token: string): number => parseInt(numbers[order.indexOf(token)], 10);

  let year: number = part('yyyy');
  const month: number = part('MM');
  const day: number = part('dd');
  if (year < 100) {
    year += 2000;
  }

  let hours: number = numbers.length > 3 ? parseInt(numbers[3], 10) : 0;
  const minutes: number = numbers.length > 4 ? parseInt(numbers[4], 10) : 0;
  // 12 órás formátum (pl. "2:30 PM", "du. 2:30").
  if (/(^|[^a-z])(pm|p\.m\.|du\.)/i.test(text) && hours < 12) {
    hours += 12;
  } else if (/(^|[^a-z])(am|a\.m\.|de\.)/i.test(text) && hours === 12) {
    hours = 0;
  }
  if (hours > 23 || minutes > 59) {
    return undefined;
  }

  const date: Date = new Date(year, month - 1, day, hours, minutes);
  // A Date túlcsordul (pl. február 31. → március 3.); az ilyen bevitel érvénytelen.
  const valid: boolean = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : undefined;
}

export interface ICalendarNames {
  months: string[];
  shortMonths: string[];
  /** Vasárnappal kezdődik. */
  days: string[];
  shortDays: string[];
}

/** Hónap- és napnevek a megadott (felületi) nyelven. */
export function getCalendarNames(culture: string): ICalendarNames {
  const monthNames = (style: 'long' | 'short'): string[] => {
    const format: Intl.DateTimeFormat = formatter(culture, { month: style });
    return Array.from({ length: 12 }, (_, month) => format.format(new Date(2023, month, 1)));
  };
  const dayNames = (style: 'long' | 'narrow'): string[] => {
    const format: Intl.DateTimeFormat = formatter(culture, { weekday: style });
    // 2023. január 1. vasárnap volt.
    return Array.from({ length: DAYS_IN_WEEK }, (_, day) => format.format(new Date(2023, 0, 1 + day)));
  };
  return { months: monthNames('long'), shortMonths: monthNames('short'), days: dayNames('long'), shortDays: dayNames('narrow') };
}

interface IWeekInfo {
  firstDay?: number;
}

interface ILocaleWithWeekInfo {
  weekInfo?: IWeekInfo;
  getWeekInfo?: () => IWeekInfo;
}

/** A hét első napja a kultúra szerint (0 = vasárnap). Ha a böngésző nem tudja megmondani, hétfő. */
export function getFirstDayOfWeek(culture: string): number {
  const LocaleCtor = (Intl as unknown as { Locale?: new (tag: string) => ILocaleWithWeekInfo }).Locale;
  try {
    if (LocaleCtor) {
      const locale: ILocaleWithWeekInfo = new LocaleCtor(culture);
      const firstDay: number | undefined = (locale.getWeekInfo ? locale.getWeekInfo() : locale.weekInfo)?.firstDay;
      if (typeof firstDay === 'number') {
        return firstDay % DAYS_IN_WEEK; // az Intl 7-tel jelöli a vasárnapot
      }
    }
  } catch {
    // ismeretlen kultúra: marad az alapértelmezés
  }
  return 1;
}
