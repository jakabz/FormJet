// A vizuális feltételszerkesztő modellje: a Condition és a szerkeszthető sorok közötti átalakítás.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.
//
// Vizuálisan szerkeszthető: egyetlen mezőfeltétel, vagy `all` / `any` csoport, amelynek elemei mezőfeltételek vagy
// újabb (beágyazott) `all` / `any` csoportok. A `not` csak JSON-ként szerkeszthető.

import {
  Condition,
  CONDITION_OPERATORS,
  ConditionOperator,
  ConditionScalar,
  ConditionValue,
  IFieldCondition
} from '../models/IFormConfig';

export type ConditionMatch = 'all' | 'any';

/** Egy szerkeszthető sor. Lehet félkész (mező vagy érték nélkül); ilyenkor nem kerül a feltételbe. */
export interface IConditionRow {
  field: string;
  op: ConditionOperator;
  /** Az érték szövegként; `in` operátornál a vesszővel elválasztott értékek. */
  text: string;
  /** Az `in` operátor értékei. */
  values: string[];
  /** Az eredeti érték, amíg a sor értékét nem szerkesztették: így a típusa (szám, logikai) változatlan marad. */
  raw?: ConditionValue;
}

/** Beágyazott csoport: saját „minden / bármelyik” kapcsolattal és elemekkel. */
export interface IConditionGroup {
  kind: 'group';
  match: ConditionMatch;
  rows: ConditionItem[];
}

/** A szerkesztő egy eleme: mezőfeltétel-sor vagy beágyazott csoport. */
export type ConditionItem = IConditionRow | IConditionGroup;

export interface IConditionRows {
  match: ConditionMatch;
  rows: ConditionItem[];
}

export function isConditionGroup(item: ConditionItem): item is IConditionGroup {
  return (item as IConditionGroup).kind === 'group';
}

/** Új, üres csoport egy üres sorral (a felhasználó azonnal kitöltheti). */
export function createEmptyGroup(match: ConditionMatch = 'any'): IConditionGroup {
  return { kind: 'group', match, rows: [createEmptyRow()] };
}

const NO_VALUE_OPERATORS: ConditionOperator[] = ['empty', 'notEmpty'];
const NUMERIC_TYPES: string[] = ['Number', 'Currency', 'Integer', 'Counter'];
const PLAIN_NUMBER: RegExp = /^-?\d+(\.\d+)?$/;

/** Kell-e érték az operátorhoz. */
export function operatorNeedsValue(op: ConditionOperator): boolean {
  return NO_VALUE_OPERATORS.indexOf(op) === -1;
}

/** A vesszővel elválasztott szöveg értékei, üres elemek nélkül. */
export function splitValues(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export function createEmptyRow(): IConditionRow {
  return { field: '', op: 'eq', text: '', values: [] };
}

function isFieldCondition(condition: Condition): condition is IFieldCondition {
  const candidate = condition as Partial<IFieldCondition>;
  return typeof candidate.field === 'string' && CONDITION_OPERATORS.indexOf(candidate.op as ConditionOperator) !== -1;
}

function toRow(condition: IFieldCondition): IConditionRow {
  const value: ConditionValue | undefined = condition.value;
  const values: string[] = Array.isArray(value) ? value.map(String) : [];
  const text: string = Array.isArray(value) ? values.join(', ') : value === undefined ? '' : String(value);
  return { field: condition.field, op: condition.op, text, values, raw: value };
}

/** Egy `all` / `any` csoport elemei; `undefined`, ha valahol `not` (vagy ismeretlen szerkezet) van benne. */
function toGroupRows(condition: Condition): IConditionRows | undefined {
  const group = condition as { all?: Condition[]; any?: Condition[] };
  const match: ConditionMatch | undefined = Array.isArray(group.all) ? 'all' : Array.isArray(group.any) ? 'any' : undefined;
  const items: Condition[] | undefined = match ? group[match] : undefined;
  if (!match || !items) {
    return undefined;
  }
  const rows: ConditionItem[] = [];
  for (let i: number = 0; i < items.length; i++) {
    if (isFieldCondition(items[i])) {
      rows.push(toRow(items[i] as IFieldCondition));
      continue;
    }
    const nested: IConditionRows | undefined = toGroupRows(items[i]);
    if (!nested) {
      return undefined;
    }
    rows.push({ kind: 'group', match: nested.match, rows: nested.rows });
  }
  return { match, rows };
}

/**
 * A feltétel szerkeszthető sorai (beágyazott csoportokkal). `undefined`, ha a feltétel vizuálisan nem szerkeszthető
 * (`not` van benne). Hiányzó feltételre üres sorlista.
 */
export function toConditionRows(condition: Condition | undefined): IConditionRows | undefined {
  if (!condition) {
    return { match: 'all', rows: [] };
  }
  if (isFieldCondition(condition)) {
    return { match: 'all', rows: [toRow(condition)] };
  }
  return toGroupRows(condition);
}

function typed(text: string, fieldType: string | undefined, op: ConditionOperator): ConditionScalar {
  if (fieldType === 'Boolean' && (text === 'true' || text === 'false')) {
    return text === 'true';
  }
  const numeric: boolean = (fieldType !== undefined && NUMERIC_TYPES.indexOf(fieldType) !== -1) || op === 'gt' || op === 'lt';
  return numeric && PLAIN_NUMBER.test(text) ? Number(text) : text;
}

/** A sorból képzett mezőfeltétel; `undefined`, ha a sor félkész (nincs mező, vagy hiányzik a szükséges érték). */
export function rowToCondition(row: IConditionRow, fieldType: string | undefined): IFieldCondition | undefined {
  if (row.field === '') {
    return undefined;
  }
  if (!operatorNeedsValue(row.op)) {
    return { field: row.field, op: row.op };
  }
  if (row.raw !== undefined) {
    return { field: row.field, op: row.op, value: row.raw };
  }
  if (row.op === 'in') {
    const values: string[] = row.values.length > 0 ? row.values : splitValues(row.text);
    return values.length === 0
      ? undefined
      : { field: row.field, op: row.op, value: values.map((value) => typed(value, fieldType, row.op)) };
  }
  const text: string = row.text.trim();
  return text === '' ? undefined : { field: row.field, op: row.op, value: typed(text, fieldType, row.op) };
}

/**
 * A sorokból képzett feltétel: a félkész sorok és az üres csoportok kimaradnak; egyetlen kész elem önmagában áll,
 * több elem csoportot alkot (a beágyazott csoportok ugyanígy). `undefined`, ha nincs kész elem.
 */
export function fromConditionRows(model: IConditionRows, typeOf: (field: string) => string | undefined): Condition | undefined {
  const conditions: Condition[] = [];
  model.rows.forEach((item) => {
    const condition: Condition | undefined = isConditionGroup(item)
      ? fromConditionRows({ match: item.match, rows: item.rows }, typeOf)
      : rowToCondition(item, typeOf(item.field));
    if (condition) {
      conditions.push(condition);
    }
  });
  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  return model.match === 'any' ? { any: conditions } : { all: conditions };
}

/** A sor operátorának váltása; az érték az új operátorhoz igazodik. */
export function changeRowOperator(row: IConditionRow, op: ConditionOperator): IConditionRow {
  if (op === row.op) {
    return row;
  }
  if (op === 'in') {
    const values: string[] = row.values.length > 0 ? row.values : splitValues(row.text);
    return { field: row.field, op, text: values.join(', '), values };
  }
  if (row.op === 'in') {
    return { field: row.field, op, text: row.values[0] ?? '', values: [] };
  }
  // Skalár operátorok között az érték (és az eredeti típusa) megmarad.
  return { ...row, op };
}
