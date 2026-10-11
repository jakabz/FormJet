// Felügyelt metaadat (TaxonomyFieldType / TaxonomyFieldTypeMulti) mező form-string értéke: `Címke|TermGuid;`,
// több értéknél egymás után (`A|guid1;B|guid2;`).
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

export interface ITermRef {
  /** A kifejezés azonosítója (GUID, kisbetűvel). */
  id: string;
  label: string;
}

/** Egy választható kifejezés a kifejezéskészletből. */
export interface ITermOption extends ITermRef {
  /** A kifejezés teljes útvonala a készleten belül, pl. `Európa > Magyarország > Budapest`. */
  path: string;
}

const GUID: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPTY_GUID: string = '00000000-0000-0000-0000-000000000000';
// `Címke|guid` párok; a címke előtt állhat a SharePoint belső sorszáma (`5;#Címke|guid`).
const TERM_PAIR: RegExp = /([^;#|]*)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/** A mezőséma azonosítójából érvényes GUID; `undefined` üres vagy csupa nulla értékre. */
export function normalizeTermGuid(value: string | undefined): string | undefined {
  const id: string = (value ?? '').replace(/[{}]/g, '').trim().toLowerCase();
  return GUID.test(id) && id !== EMPTY_GUID ? id : undefined;
}

/** A form-string értelmezése. Elfogadja a `Címke|guid`, `A|g1;B|g2;` és `1;#A|g1;#2;#B|g2` alakot is. */
export function parseTaxonomyValue(value: string | undefined): ITermRef[] {
  const terms: ITermRef[] = [];
  if (!value) {
    return terms;
  }
  TERM_PAIR.lastIndex = 0;
  let match: RegExpExecArray | null = TERM_PAIR.exec(value);
  while (match) {
    const id: string = match[2].toLowerCase();
    if (id !== EMPTY_GUID && !terms.some((term) => term.id === id)) {
      terms.push({ id, label: match[1].trim() });
    }
    match = TERM_PAIR.exec(value);
  }
  return terms;
}

/** A mentésre kerülő form-string. Üres kiválasztásra üres szöveg, hogy a kötelezőség ellenőrzése működjön. */
export function serializeTaxonomyValue(terms: ITermRef[], multiple: boolean): string {
  const list: ITermRef[] = multiple ? terms : terms.slice(0, 1);
  // A címkében az elválasztó karakterek nem szerepelhetnek.
  return list.map((term) => `${term.label.replace(/[;|]/g, ' ').trim()}|${term.id};`).join('');
}

/** A kiválasztott kifejezések címkéi szövegként (csak olvasható megjelenítéshez). */
export function formatTaxonomyValue(value: string | undefined): string {
  return parseTaxonomyValue(value)
    .map((term) => term.label)
    .filter((label) => label !== '')
    .join('; ');
}
