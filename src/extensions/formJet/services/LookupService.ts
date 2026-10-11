// A keresőmező (lookup) választható elemei a hivatkozott listából.

import { getSP } from './sp';

/** Ennyi elemet töltünk be választhatónak; nagyobb listánál a többi nem jelenik meg a listában. */
export const LOOKUP_OPTION_LIMIT: number = 2000;

export interface ILookupOption {
  id: number;
  text: string;
}

export interface ILookupOptions {
  options: ILookupOption[];
  /** A hivatkozott listában több elem van, mint amennyit betöltöttünk. */
  hasMore: boolean;
}

const cache: Record<string, Promise<ILookupOptions> | undefined> = {};

function toText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

async function query(listId: string, showField: string): Promise<ILookupOptions> {
  const items = getSP().web.lists.getById(listId).items;
  const select: string[] = showField === 'Id' || showField === 'ID' ? ['Id'] : ['Id', showField];
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (await items.select(...select).orderBy(showField).top(LOOKUP_OPTION_LIMIT + 1)()) as Array<Record<string, unknown>>;
  } catch {
    // Nem minden mezőtípus szerint lehet rendezni; ilyenkor rendezés nélkül kérdezünk, és itt rendezünk.
    rows = (await items.select(...select).top(LOOKUP_OPTION_LIMIT + 1)()) as Array<Record<string, unknown>>;
  }
  const options: ILookupOption[] = rows.slice(0, LOOKUP_OPTION_LIMIT).map((row) => {
    const id: number = Number(row.Id);
    return { id, text: toText(row[showField]) || `#${id}` };
  });
  options.sort((a, b) => a.text.localeCompare(b.text));
  return { options, hasMore: rows.length > LOOKUP_OPTION_LIMIT };
}

/** A választható elemek. Az eredményt a munkamenet idejére megjegyezzük. */
export function getLookupOptions(listId: string, showField: string | undefined): Promise<ILookupOptions> {
  const field: string = showField || 'Title';
  const key: string = `${listId}|${field}`;
  const cached: Promise<ILookupOptions> | undefined = cache[key];
  if (cached) {
    return cached;
  }
  const request: Promise<ILookupOptions> = query(listId, field);
  cache[key] = request;
  // Hibás kérést nem jegyzünk meg, hogy újra lehessen próbálni.
  request.catch(() => {
    delete cache[key];
  });
  return request;
}
