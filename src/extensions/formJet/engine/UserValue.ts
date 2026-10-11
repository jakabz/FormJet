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

/** A kiválasztottak neve szövegként (csak olvasható megjelenítéshez). */
export function formatUserValue(value: string | undefined): string {
  return parseUserValue(value)
    .map((entry) => entry.text)
    .join('; ');
}
