// Kapcsolódó elemek: a webhely listái, egy lista mezői, és a párosított elemek lekérdezése.

import { buildRelatedViewXml, getRowLimit, ID_FIELD } from '../engine/RelatedList';
import { IRelatedListConfig } from '../models/IFormConfig';
import { getSP } from './sp';

export interface IListInfo {
  id: string;
  title: string;
}

export interface IListFieldInfo {
  /** InternalName. */
  name: string;
  title: string;
  /** TypeAsString. */
  type: string;
}

export interface IRelatedRow {
  id: number;
  /** Megjelenítésre szánt szöveg oszloponként, InternalName szerint. */
  values: Record<string, string>;
}

export interface IRelatedData {
  columns: IListFieldInfo[];
  rows: IRelatedRow[];
  /** A sorkorlátnál több elem felel meg a feltételnek. */
  hasMore: boolean;
  displayFormUrl: string;
  newFormUrl: string;
}

/** A beállításban szereplő párosító mező nem létezik, vagy a típusa szerint nem lehet párosítani. */
export class RelatedMatchFieldError extends Error {
  public constructor(fieldName: string) {
    super(fieldName);
    Object.setPrototypeOf(this, RelatedMatchFieldError.prototype);
  }
}

/** Mezők, amelyeknek oszlopként vagy párosító mezőként nincs értelme. */
const EXCLUDED_TYPES: string[] = ['Computed', 'Attachments', 'ContentTypeId', 'ModStat', 'Guid', 'File', 'ThreadIndex'];
const EXCLUDED_NAMES: string[] = ['ContentType', 'AppAuthor', 'AppEditor', 'ComplianceAssetId', 'ItemChildCount', 'FolderChildCount'];

interface IRawField {
  InternalName: string;
  Title: string;
  TypeAsString: string;
}

const fieldCache: Record<string, Promise<IListFieldInfo[]> | undefined> = {};

export async function getLists(): Promise<IListInfo[]> {
  const lists = (await getSP().web.lists.filter('Hidden eq false').select('Id', 'Title').orderBy('Title')()) as Array<{
    Id: string;
    Title: string;
  }>;
  return lists.map((list) => ({ id: list.Id.toLowerCase(), title: list.Title }));
}

/** Egy lista választható mezői. Az eredményt a munkamenet idejére megjegyezzük. */
export function getListFields(listId: string): Promise<IListFieldInfo[]> {
  const cached: Promise<IListFieldInfo[]> | undefined = fieldCache[listId];
  if (cached) {
    return cached;
  }
  const request: Promise<IListFieldInfo[]> = (async () => {
    const raw = (await getSP()
      .web.lists.getById(listId)
      .fields.filter('Hidden eq false')
      .select('InternalName', 'Title', 'TypeAsString')()) as IRawField[];
    const fields: IListFieldInfo[] = raw
      .filter(
        (field) =>
          EXCLUDED_TYPES.indexOf(field.TypeAsString) === -1 &&
          EXCLUDED_NAMES.indexOf(field.InternalName) === -1 &&
          field.InternalName.charAt(0) !== '_'
      )
      .map((field) => ({ name: field.InternalName, title: field.Title, type: field.TypeAsString }));
    if (!fields.some((field) => field.name === ID_FIELD)) {
      fields.unshift({ name: ID_FIELD, title: ID_FIELD, type: 'Counter' });
    }
    return fields;
  })();
  fieldCache[listId] = request;
  // Hibás kérést nem jegyzünk meg, hogy újra lehessen próbálni.
  request.catch(() => {
    delete fieldCache[listId];
  });
  return request;
}

/** A renderListDataAsStream cellaértéke megjelenítendő szövegként (személy és keresőmező tömbként érkezik). */
function toText(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value
      .map(toText)
      .filter((text) => text !== '')
      .join(', ');
  }
  if (typeof value === 'object') {
    const item = value as { title?: unknown; lookupValue?: unknown; Label?: unknown };
    return toText(item.title ?? item.lookupValue ?? item.Label);
  }
  return String(value);
}

/**
 * A szülő elemhez párosított elemek. A lekérdezés a felhasználó nevében fut,
 * így csak azok az elemek jönnek vissza, amelyekhez joga van.
 */
export async function getRelatedItems(config: IRelatedListConfig, sourceValue: string | undefined): Promise<IRelatedData> {
  const list = getSP().web.lists.getById(config.listId);
  const [info, fields] = await Promise.all([
    list.select('DefaultDisplayFormUrl', 'DefaultNewFormUrl')() as Promise<{
      DefaultDisplayFormUrl: string;
      DefaultNewFormUrl: string;
    }>,
    getListFields(config.listId)
  ]);

  const byName: Record<string, IListFieldInfo> = {};
  fields.forEach((field) => {
    byName[field.name] = field;
  });
  const matchField: IListFieldInfo | undefined = byName[config.matchField];
  if (!matchField) {
    throw new RelatedMatchFieldError(config.matchField);
  }

  // A listából időközben törölt oszlop kimarad.
  const columns: IListFieldInfo[] = config.columns.map((name) => byName[name]).filter((field) => field !== undefined);
  const forms = { displayFormUrl: info.DefaultDisplayFormUrl, newFormUrl: info.DefaultNewFormUrl };

  const viewXml: string | undefined = buildRelatedViewXml(
    { ...config, columns: columns.map((column) => column.name) },
    matchField.type,
    sourceValue
  );
  if (!viewXml) {
    // Nincs párosító érték: nincs mit lekérdezni.
    return { columns, rows: [], hasMore: false, ...forms };
  }

  const data = (await list.renderListDataAsStream({ ViewXml: viewXml })) as { Row?: Array<Record<string, unknown>> };
  const limit: number = getRowLimit(config);
  const rawRows: Array<Record<string, unknown>> = data.Row ?? [];
  const rows: IRelatedRow[] = rawRows.slice(0, limit).map((row) => {
    const values: Record<string, string> = {};
    columns.forEach((column) => {
      values[column.name] = toText(row[column.name]);
    });
    return { id: parseInt(toText(row[ID_FIELD]), 10), values };
  });
  return { columns, rows, hasMore: rawRows.length > limit, ...forms };
}
