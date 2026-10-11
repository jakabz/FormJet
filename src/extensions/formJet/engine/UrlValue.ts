// URL (hivatkozás vagy kép) mező form-string értéke: `cím, leírás`. A címben szereplő vessző duplázva áll.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

export interface IUrlValue {
  url: string;
  description: string;
}

const SEPARATOR: string = ', ';
/** Megnyitható címek: webcím, e-mail, vagy webhelyen belüli (perjellel kezdődő) útvonal. */
const SAFE_URL: RegExp = /^(https?:\/\/|mailto:|\/(?!\/))/i;

/** Megjeleníthető-e a cím hivatkozásként (a `javascript:` és hasonló sémák nem). */
export function isSafeUrl(url: string): boolean {
  return SAFE_URL.test(url.trim());
}

/** A form-string értelmezése. Üres értékre üres cím és leírás. */
export function parseUrlValue(value: string | undefined): IUrlValue {
  const text: string = (value ?? '').trim();
  if (text === '') {
    return { url: '', description: '' };
  }
  // Az első olyan `, ` a határ, amely nem duplázott vessző része.
  let index: number = -1;
  for (let i: number = 0; i < text.length - 1; i++) {
    if (text[i] === ',') {
      if (text[i + 1] === ',') {
        i++;
      } else if (text[i + 1] === ' ') {
        index = i;
        break;
      }
    }
  }
  const rawUrl: string = index === -1 ? text : text.slice(0, index);
  const url: string = rawUrl.replace(/,,/g, ',').trim();
  const description: string = index === -1 ? '' : text.slice(index + SEPARATOR.length).trim();
  return { url, description: description === url ? '' : description };
}

/** A mentésre kerülő form-string. Üres címre üres szöveg, hogy a kötelezőség ellenőrzése működjön. */
export function serializeUrlValue(value: IUrlValue): string {
  const url: string = value.url.trim();
  if (url === '') {
    return '';
  }
  // Leírás nélkül a SharePoint is a címet mutatja leírásként.
  return `${url.replace(/,/g, ',,')}${SEPARATOR}${value.description.trim() || url}`;
}
