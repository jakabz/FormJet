// Feltételes értékek: a mező címkéje, leírása, helykitöltő szövege és kezdőértéke, valamint a szekció címe és leírása
// feltételtől függően más lehet.
// Beállításonként szabályok sorrendezett listája; az első teljesülő szabály értéke érvényes.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { FormValues } from '../models/IFieldSchema';
import { Condition, IConditionalValue } from '../models/IFormConfig';
import { evaluate, validateCondition } from './ConditionEngine';
import { engineStrings, format } from './EngineStrings';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Az első teljesülő szabály értéke; `undefined`, ha nincs ilyen (ekkor a beállítás alapértéke érvényes).
 * A feltétel nélküli (félkész) szabály nem érvényesül.
 */
export function pickConditionalValue(rules: IConditionalValue[] | undefined, values: FormValues): string | undefined {
  if (!rules) {
    return undefined;
  }
  for (let i: number = 0; i < rules.length; i++) {
    if (rules[i].when !== undefined && evaluate(rules[i].when, values)) {
      return rules[i].value;
    }
  }
  return undefined;
}

/** Feltételes értékeket hordozó beállítás (mező vagy szekció); a `K` a feltételhez köthető tulajdonságok neve. */
export interface IConditionalHolder<K extends string> {
  conditional?: Partial<Record<K, IConditionalValue[]>>;
}

/** A mező vagy szekció adott beállításának érvényes (feltétellel rendelkező) szabályai. */
export function countConditionalValues<K extends string>(config: IConditionalHolder<K> | undefined, property: K): number {
  return (config?.conditional?.[property] ?? []).filter((rule) => rule.when !== undefined).length;
}

/** A mező vagy szekció adott beállításának szabályai lecserélve; az üres lista és az üres `conditional` kimarad a konfigurációból. */
export function setConditionalValues<K extends string, T extends IConditionalHolder<K>>(
  config: T,
  property: K,
  rules: IConditionalValue[]
): T {
  const conditional: Partial<Record<K, IConditionalValue[]>> = { ...(config.conditional ?? {}) };
  if (rules.length > 0) {
    conditional[property] = rules;
  } else {
    delete conditional[property];
  }
  const next: T = { ...config };
  if (Object.keys(conditional).length > 0) {
    next.conditional = conditional;
  } else {
    delete next.conditional;
  }
  return next;
}

/**
 * A konfiguráció egy `conditional` részének ellenőrzése a megadott tulajdonságokra (mező vagy szekció);
 * hibás tartalomra kivételt dob (a parseConfig kezeli).
 */
export function parseConditional<K extends string>(
  input: unknown,
  path: string,
  properties: K[]
): Partial<Record<K, IConditionalValue[]>> | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const result: Partial<Record<K, IConditionalValue[]>> = {};
  properties.forEach((property) => {
    const rules: unknown = input[property];
    if (rules === undefined) {
      return;
    }
    if (!Array.isArray(rules)) {
      throw new Error(format(engineStrings().MustBeArray, `${path}.${property}`));
    }
    const parsed: IConditionalValue[] = rules.map((rule: unknown, index: number) => {
      const rulePath: string = `${path}.${property}[${index}]`;
      if (!isRecord(rule)) {
        throw new Error(format(engineStrings().MustBeObject, rulePath));
      }
      const item: IConditionalValue = { value: typeof rule.value === 'string' ? rule.value : '' };
      if (rule.when !== undefined) {
        const error: string | undefined = validateCondition(rule.when, `${rulePath}.when`);
        if (error) {
          throw new Error(error);
        }
        item.when = rule.when as Condition;
      }
      return item;
    });
    if (parsed.length > 0) {
      result[property] = parsed;
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
}
