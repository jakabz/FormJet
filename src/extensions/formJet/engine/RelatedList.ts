// Kapcsolódó elemek szekció: a beállítás ellenőrzése, a párosító érték előkészítése és a CAML lekérdezés.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { IRelatedListConfig } from '../models/IFormConfig';
import { parseNumber } from './ConditionEngine';
import { engineStrings, format } from './EngineStrings';

/** A szülő elem azonosítója mint forrásmező, illetve a kapcsolódó lista azonosító mezője. */
export const ID_FIELD: string = 'ID';

export const DEFAULT_ROW_LIMIT: number = 30;
export const MIN_ROW_LIMIT: number = 1;
export const MAX_ROW_LIMIT: number = 500;

const GUID: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A mezőnevek a CAML lekérdezésbe kerülnek, ezért csak belső névnek megfelelő érték engedhető meg.
const FIELD_NAME: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A párosítás módja a kapcsolódó lista párosító mezőjének típusa szerint. */
export type MatchKind = 'text' | 'number' | 'lookup';

const MATCH_VALUE_TYPES: Record<string, { kind: MatchKind; camlType: string }> = {
  Text: { kind: 'text', camlType: 'Text' },
  Choice: { kind: 'text', camlType: 'Text' },
  Number: { kind: 'number', camlType: 'Number' },
  Currency: { kind: 'number', camlType: 'Number' },
  Integer: { kind: 'number', camlType: 'Integer' },
  Counter: { kind: 'number', camlType: 'Counter' },
  Lookup: { kind: 'lookup', camlType: 'Lookup' }
};

/** Mezőtípusok, amelyek szerint párosítani lehet (a kapcsolódó listában és ebben a listában is). */
export const MATCHABLE_TYPES: string[] = Object.keys(MATCH_VALUE_TYPES);

export function isMatchableType(typeAsString: string): boolean {
  return MATCH_VALUE_TYPES[typeAsString] !== undefined;
}

export function isListId(value: unknown): value is string {
  return typeof value === 'string' && GUID.test(value);
}

export function isFieldName(value: unknown): value is string {
  return typeof value === 'string' && FIELD_NAME.test(value);
}

/** Ki van-e töltve minden, ami a lekérdezéshez kell. A tervezőben a félkész beállítás is menthető. */
export function isRelatedComplete(config: IRelatedListConfig | undefined): config is IRelatedListConfig {
  return !!config && config.listId !== '' && config.matchField !== '' && config.sourceField !== '' && config.columns.length > 0;
}

export function getRowLimit(config: IRelatedListConfig): number {
  return config.rowLimit ?? DEFAULT_ROW_LIMIT;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Üres szöveg megengedett (félkész beállítás); a nem üres értéknek érvényes belső névnek kell lennie. */
function parseFieldName(value: unknown, path: string): string {
  if (value === undefined || value === '') {
    return '';
  }
  if (!isFieldName(value)) {
    throw new Error(format(engineStrings().InvalidFieldName, path));
  }
  return value;
}

/** A szekció `related` részének ellenőrzése. Hibás értékre kivételt dob (a parseConfig kapja el). */
export function parseRelated(input: unknown, path: string): IRelatedListConfig | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  if (input.listId !== undefined && input.listId !== '' && !isListId(input.listId)) {
    throw new Error(format(engineStrings().InvalidListId, `${path}.listId`));
  }
  if (input.columns !== undefined && !Array.isArray(input.columns)) {
    throw new Error(format(engineStrings().MustBeArray, `${path}.columns`));
  }
  const columns: string[] = [];
  ((input.columns as unknown[] | undefined) ?? []).forEach((column, i) => {
    const name: string = parseFieldName(column, `${path}.columns[${i}]`);
    if (name !== '' && columns.indexOf(name) === -1) {
      columns.push(name);
    }
  });

  const config: IRelatedListConfig = {
    listId: typeof input.listId === 'string' ? input.listId.toLowerCase() : '',
    matchField: parseFieldName(input.matchField, `${path}.matchField`),
    sourceField: parseFieldName(input.sourceField, `${path}.sourceField`) || ID_FIELD,
    columns
  };
  const sortField: string = parseFieldName(input.sortField, `${path}.sortField`);
  if (sortField !== '') config.sortField = sortField;
  if (input.sortAscending === false) config.sortAscending = false;
  if (input.rowLimit !== undefined) {
    const limit: unknown = input.rowLimit;
    if (typeof limit !== 'number' || !isFinite(limit) || limit < MIN_ROW_LIMIT || limit > MAX_ROW_LIMIT) {
      throw new Error(format(engineStrings().InvalidNumber, `${path}.rowLimit`, MIN_ROW_LIMIT, MAX_ROW_LIMIT));
    }
    config.rowLimit = Math.floor(limit);
  }
  if (input.showNewButton === true) config.showNewButton = true;
  return config;
}

/**
 * A szülő elem értékének átalakítása a párosító mező típusához.
 * `undefined`, ha nincs mivel párosítani (üres érték, vagy szám helyett szöveg).
 */
export function normalizeMatchValue(matchFieldType: string, rawValue: string | undefined): string | undefined {
  const spec = MATCH_VALUE_TYPES[matchFieldType];
  const raw: string = (rawValue ?? '').trim();
  if (!spec || raw === '') {
    return undefined;
  }
  if (spec.kind === 'text') {
    return raw;
  }
  const value: number = parseNumber(raw);
  if (isNaN(value)) {
    return undefined;
  }
  // Azonosítónál és keresőmezőnél csak egész szám értelmes.
  if (spec.kind === 'lookup' || spec.camlType !== 'Number') {
    return value === Math.floor(value) ? String(value) : undefined;
  }
  return String(value);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * A kapcsolódó elemek CAML nézete. Eggyel több sort kér a korlátnál, hogy látsszon, van-e még elem.
 * `undefined`, ha a párosító mező típusa nem támogatott, vagy nincs párosító érték.
 */
export function buildRelatedViewXml(
  config: IRelatedListConfig,
  matchFieldType: string,
  rawValue: string | undefined
): string | undefined {
  const spec = MATCH_VALUE_TYPES[matchFieldType];
  const value: string | undefined = normalizeMatchValue(matchFieldType, rawValue);
  if (!spec || value === undefined || !isRelatedComplete(config)) {
    return undefined;
  }
  // A mezőnevek ellenőrzése itt is megtörténik, mert a tervező a parseConfig megkerülésével is adhat beállítást.
  const names: string[] = [config.matchField, ...config.columns].concat(config.sortField ? [config.sortField] : []);
  if (!names.every(isFieldName)) {
    return undefined;
  }

  const lookupId: string = spec.kind === 'lookup' ? " LookupId='TRUE'" : '';
  const where: string =
    `<Where><Eq><FieldRef Name='${config.matchField}'${lookupId}/>` +
    `<Value Type='${spec.camlType}'>${escapeXml(value)}</Value></Eq></Where>`;
  const orderBy: string =
    `<OrderBy><FieldRef Name='${config.sortField ?? ID_FIELD}' ` +
    `Ascending='${config.sortAscending === false ? 'FALSE' : 'TRUE'}'/></OrderBy>`;
  const viewFields: string = [ID_FIELD, ...config.columns]
    .filter((name, i, all) => all.indexOf(name) === i)
    .map((name) => `<FieldRef Name='${name}'/>`)
    .join('');

  return (
    `<View><Query>${where}${orderBy}</Query>` +
    `<ViewFields>${viewFields}</ViewFields>` +
    `<RowLimit>${getRowLimit(config) + 1}</RowLimit></View>`
  );
}
