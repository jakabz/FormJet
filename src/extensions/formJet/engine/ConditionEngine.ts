// visibleWhen / readOnlyWhen / requiredWhen feltételek kiértékelése.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import {
  Condition,
  ConditionScalar,
  CONDITION_OPERATORS,
  IFieldCondition
} from '../models/IFormConfig';
import { FormValues } from '../models/IFieldSchema';

const MULTI_SEPARATOR: string = ';#';

/** MultiChoice form-string (`;#A;#B;#`) elemei. Egyszerű értéknél egyelemű, üresnél üres tömb. */
export function splitMultiValue(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value.split(MULTI_SEPARATOR).filter((part) => part.length > 0);
}

/** Elemek → MultiChoice form-string. Üres listára üres szöveg. */
export function joinMultiValue(items: string[]): string {
  return items.length === 0 ? '' : MULTI_SEPARATOR + items.join(MULTI_SEPARATOR) + MULTI_SEPARATOR;
}

function isMultiValue(value: string): boolean {
  return value.indexOf(MULTI_SEPARATOR) !== -1;
}

export function isEmptyValue(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') {
    return true;
  }
  if (value.trim() === '[]') {
    return true; // üres User / UserMulti
  }
  return isMultiValue(value) && splitMultiValue(value).length === 0;
}

/** Szám értelmezése; kezeli a szóközt és a tizedesvesszőt (`1 234,5`). Hibás értékre NaN. */
export function parseNumber(value: ConditionScalar | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value === undefined || typeof value === 'boolean') {
    return NaN;
  }
  let text: string = value.replace(/[\s  ]/g, '');
  if (text === '') {
    return NaN;
  }
  const comma: number = text.lastIndexOf(',');
  const dot: number = text.lastIndexOf('.');
  if (comma !== -1 && dot !== -1) {
    // Mindkettő szerepel: az utolsó a tizedesjel, a másik ezres elválasztó.
    text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (comma !== -1) {
    text = text.replace(',', '.');
  }
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : NaN;
}

function normalize(value: ConditionScalar): string {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  const text: string = String(value).trim().toLowerCase();
  if (text === 'true') {
    return '1';
  }
  if (text === 'false') {
    return '0';
  }
  return text;
}

function scalarEquals(actual: string, expected: ConditionScalar): boolean {
  return normalize(actual) === normalize(expected);
}

export function evalField(condition: IFieldCondition, values: FormValues): boolean {
  const actual: string = values[condition.field] ?? '';
  const expected = condition.value;

  switch (condition.op) {
    case 'empty':
      return isEmptyValue(actual);
    case 'notEmpty':
      return !isEmptyValue(actual);
    case 'eq':
    case 'ne': {
      const equal: boolean = expected !== undefined && !Array.isArray(expected) && scalarEquals(actual, expected);
      return condition.op === 'eq' ? equal : !equal;
    }
    case 'gt':
    case 'lt': {
      if (expected === undefined || Array.isArray(expected)) {
        return false;
      }
      const left: number = parseNumber(actual);
      const right: number = parseNumber(expected);
      if (isNaN(left) || isNaN(right)) {
        return false;
      }
      return condition.op === 'gt' ? left > right : left < right;
    }
    case 'contains': {
      if (expected === undefined || Array.isArray(expected)) {
        return false;
      }
      if (isMultiValue(actual)) {
        return splitMultiValue(actual).some((item) => scalarEquals(item, expected));
      }
      return actual.toLowerCase().indexOf(String(expected).toLowerCase()) !== -1;
    }
    case 'in': {
      if (!Array.isArray(expected)) {
        return false;
      }
      const candidates: string[] = isMultiValue(actual) ? splitMultiValue(actual) : [actual];
      return candidates.some((item) => expected.some((option) => scalarEquals(item, option)));
    }
    default:
      return false;
  }
}

/** Feltétel kiértékelése a form aktuális értékein. Hiányzó feltétel igaz. */
export function evaluate(condition: Condition | undefined, values: FormValues): boolean {
  if (!condition) {
    return true;
  }
  if ('all' in condition) {
    return condition.all.every((child) => evaluate(child, values));
  }
  if ('any' in condition) {
    return condition.any.some((child) => evaluate(child, values));
  }
  if ('not' in condition) {
    return !evaluate(condition.not, values);
  }
  return evalField(condition, values);
}

function isScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** Ellenőrzi egy ismeretlen (JSON-ból jövő) érték feltétel-szerkezetét. Hiba esetén üzenet, egyébként undefined. */
export function validateCondition(input: unknown, path: string = 'feltétel'): string | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return `${path}: objektumnak kell lennie.`;
  }
  const record = input as Record<string, unknown>;

  const groupKey: string | undefined = 'all' in record ? 'all' : 'any' in record ? 'any' : undefined;
  if (groupKey) {
    const children: unknown = record[groupKey];
    if (!Array.isArray(children)) {
      return `${path}.${groupKey}: tömbnek kell lennie.`;
    }
    for (let i: number = 0; i < children.length; i++) {
      const error: string | undefined = validateCondition(children[i], `${path}.${groupKey}[${i}]`);
      if (error) {
        return error;
      }
    }
    return undefined;
  }
  if ('not' in record) {
    return validateCondition(record.not, `${path}.not`);
  }

  if (typeof record.field !== 'string' || record.field === '') {
    return `${path}: hiányzik a "field" (a mező InternalName-je).`;
  }
  const op: unknown = record.op;
  if (typeof op !== 'string' || (CONDITION_OPERATORS as string[]).indexOf(op) === -1) {
    return `${path}: ismeretlen operátor (${String(op)}).`;
  }
  if (op === 'empty' || op === 'notEmpty') {
    return undefined;
  }
  if (op === 'in') {
    return Array.isArray(record.value) && record.value.every(isScalar)
      ? undefined
      : `${path}: az "in" operátor "value" értéke tömb kell legyen.`;
  }
  return isScalar(record.value) ? undefined : `${path}: a "value" szöveg, szám vagy logikai érték kell legyen.`;
}
