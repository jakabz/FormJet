// User / UserMulti mező form-string értéke: JSON tömb, elemenként a `Key` a bejelentkezési név (claims),
// csoportnál a csoport neve. A FieldValuesForEdit a megjelenítendő nevet is visszaadja.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

export interface IUserEntry {
  /** A mentéskor visszaírt kulcs. */
  key: string;
  /** Megjelenítendő név. */
  text: string;
  /** Másodlagos szöveg, jellemzően az e-mail-cím. */
  secondaryText?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** A form-string értelmezése. Üres vagy nem értelmezhető értékre üres tömb. */
export function parseUserValue(value: string | undefined): IUserEntry[] {
  if (!value || value.trim() === '') {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // Nem JSON: pontosvesszővel elválasztott bejelentkezési nevek (claims) is előfordulhatnak.
    parsed = value
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.indexOf('|') !== -1)
      .map((part) => ({ Key: part }));
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const entries: IUserEntry[] = [];
  parsed.forEach((item: unknown) => {
    if (!isRecord(item)) {
      return;
    }
    const key: string | undefined = text(item.Key);
    if (!key || entries.some((entry) => entry.key === key)) {
      return;
    }
    const entityData: Record<string, unknown> = isRecord(item.EntityData) ? item.EntityData : {};
    entries.push({
      key,
      text: text(item.DisplayText) ?? text(entityData.Title) ?? key,
      secondaryText: text(entityData.Email) ?? text(item.Description)
    });
  });
  return entries;
}

/** A mentésre kerülő form-string. Üres kiválasztásra üres szöveg, hogy a kötelezőség ellenőrzése működjön. */
export function serializeUserValue(entries: IUserEntry[]): string {
  if (entries.length === 0) {
    return '';
  }
  // A megjelenítendő név is bekerül, hogy a mentetlen érték csak olvasható módban is névvel jelenjen meg;
  // a SharePoint a Key alapján azonosít.
  return JSON.stringify(entries.map((entry) => ({ Key: entry.key, DisplayText: entry.text })));
}

/** A bejelentkezett felhasználó adatai a `[me]` kezdőérték feloldásához. */
export interface ICurrentUser {
  /** Bejelentkezési név (UPN) vagy teljes claims név. */
  loginName: string;
  displayName: string;
  email?: string;
}

const ME_TOKEN: string = '[me]';
/** A SharePoint Online felhasználói claims előtagja; a névkereső találatainak kulcsa is ilyen alakú. */
const CLAIMS_PREFIX: string = 'i:0#.f|membership|';

function currentUserEntry(user: ICurrentUser): IUserEntry {
  const login: string = user.loginName.trim();
  return {
    key: login.indexOf('|') !== -1 ? login : CLAIMS_PREFIX + login,
    text: user.displayName || login,
    secondaryText: user.email || undefined
  };
}

/**
 * Személy mező kezdőértéke form-stringként. A forrás lehet kész form-string (JSON tömb), vagy pontosvesszővel
 * elválasztott lista, amelynek elemei: `[me]` (a bejelentkezett felhasználó), e-mail-cím, bejelentkezési név
 * vagy csoportnév. Az e-mail-címet és a nevet a SharePoint mentéskor oldja fel. Egyértékű mezőnél csak az első
 * elem számít. Üres szöveg, ha nincs használható elem.
 */
export function resolveUserDefault(raw: string, multiple: boolean, currentUser?: ICurrentUser): string {
  let entries: IUserEntry[] = [];
  let isJson: boolean = false;
  try {
    isJson = Array.isArray(JSON.parse(raw));
  } catch {
    isJson = false;
  }
  if (isJson) {
    entries = parseUserValue(raw);
  } else {
    raw
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .forEach((part) => {
        let entry: IUserEntry | undefined;
        if (part.toLowerCase() === ME_TOKEN) {
          entry = currentUser && currentUser.loginName.trim() !== '' ? currentUserEntry(currentUser) : undefined;
        } else {
          entry = { key: part, text: part };
        }
        const key: string | undefined = entry?.key.toLowerCase();
        if (entry && !entries.some((item) => item.key.toLowerCase() === key)) {
          entries.push(entry);
        }
      });
  }
  return serializeUserValue(multiple ? entries : entries.slice(0, 1));
}

/** A kiválasztottak neve szövegként (csak olvasható megjelenítéshez). */
export function formatUserValue(value: string | undefined): string {
  return parseUserValue(value)
    .map((entry) => entry.text)
    .join('; ');
}
