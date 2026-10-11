// Lookup / LookupMulti mező form-string értéke.
// Egyértékű: a hivatkozott elem azonosítója (`5`). Többértékű: `5;#;#6;#` (azonosító;#cím párok, a cím üres).
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

const SEPARATOR: string = ';#';
const GUID: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A mezőséma `LookupList` értékéből a lista GUID-ja; `undefined`, ha nem listára mutat (pl. `UserInfo`, `Self`). */
export function normalizeLookupListId(lookupList: string | undefined): string | undefined {
  const id: string = (lookupList ?? '').replace(/[{}]/g, '').trim();
  return GUID.test(id) ? id.toLowerCase() : undefined;
}

/**
 * A hivatkozott elemek azonosítói. Elfogadja a `5`, `5;#Cím`, `5;#Cím;#6;#Cím2` és `5;#;#6;#` alakot is:
 * az azonosító;#cím párokból a páros helyen álló egész számokat veszi.
 */
export function parseLookupValue(value: string | undefined): number[] {
  if (!value || value.trim() === '') {
    return [];
  }
  const ids: number[] = [];
  value.split(SEPARATOR).forEach((part, index) => {
    const text: string = part.trim();
    if (index % 2 === 0 && /^\d+$/.test(text)) {
      const id: number = parseInt(text, 10);
      if (id > 0 && ids.indexOf(id) === -1) {
        ids.push(id);
      }
    }
  });
  return ids;
}

/** A mentésre kerülő form-string. Üres kiválasztásra üres szöveg, hogy a kötelezőség ellenőrzése működjön. */
export function serializeLookupValue(ids: number[], multiple: boolean): string {
  if (ids.length === 0) {
    return '';
  }
  return multiple ? ids.map((id) => `${id}${SEPARATOR}`).join(SEPARATOR) : String(ids[0]);
}
