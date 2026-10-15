// A form változói: egyszer definiált, név szerint újrahasznosítható értékek a feltételekhez.
// Feltétel fajta: igen / nem (`1` / `0`) a meglévő feltételszerkezettel; érték fajta: egy mező élő vagy mentett
// értéke, átalakításokkal (szövegrész, számmá alakítás, …). A feltételekben `[Var:<név>]` mezőként hivatkozhatók,
// és egymásra is épülhetnek; a kiértékelés függőségi sorrendben történik, a körkörös hivatkozás üres / nem értéket ad.
// Kódot nem futtatunk: csak a VARIABLE_TRANSFORMS előre megírt átalakításai alkalmazhatók.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { FormValues } from '../models/IFieldSchema';
import {
  Condition,
  IConditionalValue,
  IFieldCondition,
  IFormConfig,
  IFormVariable,
  VARIABLE_TRANSFORMS,
  VariableTransform
} from '../models/IFormConfig';
import { evaluate, parseNumber, validateCondition } from './ConditionEngine';
import { engineStrings, format } from './EngineStrings';

const VARIABLE_NAME: RegExp = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const VARIABLE_REF: RegExp = /^\[Var:([A-Za-z][A-Za-z0-9_]{0,63})\]$/;
/** A mező belső neve (a forrásmezőhöz). */
const FIELD_NAME: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

const TRUE_VALUE: string = '1';
const FALSE_VALUE: string = '0';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Érvényes változónév: betűvel kezdődik, utána betű, szám vagy aláhúzás (legfeljebb 64 karakter). */
export function isVariableName(name: string): boolean {
  return VARIABLE_NAME.test(name);
}

/** A változóra hivatkozó „mezőnév” a feltételekben. */
export function variableRef(name: string): string {
  return `[Var:${name}]`;
}

/** A változó neve, ha a mezőnév változóhivatkozás. */
export function parseVariableRef(field: string): string | undefined {
  const match: RegExpMatchArray | null = field.match(VARIABLE_REF);
  return match ? match[1] : undefined;
}

/** A feltétel mezőfeltételeinek átalakítása (például átnevezésnél); a szerkezet változatlan marad. */
export function mapCondition(condition: Condition, map: (field: IFieldCondition) => IFieldCondition): Condition {
  if ('all' in condition) {
    return { all: condition.all.map((child) => mapCondition(child, map)) };
  }
  if ('any' in condition) {
    return { any: condition.any.map((child) => mapCondition(child, map)) };
  }
  if ('not' in condition) {
    return { not: mapCondition(condition.not, map) };
  }
  return map(condition);
}

function collectRefs(condition: Condition | undefined, found: string[]): void {
  if (!condition) {
    return;
  }
  mapCondition(condition, (field) => {
    const name: string | undefined = parseVariableRef(field.field);
    if (name !== undefined && found.indexOf(name) === -1) {
      found.push(name);
    }
    return field;
  });
}

/** Azok a változók, amelyekre a változó közvetlenül hivatkozik. */
export function variableDependencies(variable: IFormVariable): string[] {
  const found: string[] = [];
  if (variable.kind === 'condition') {
    collectRefs(variable.when, found);
  }
  return found;
}

/**
 * A kiértékelés sorrendje: minden változó a tőle függők előtt. A körkörös hivatkozásban érintett (vagy arra épülő)
 * változók a `cyclic` listába kerülnek; ezek értéke üres / nem.
 */
export function variableOrder(variables: Record<string, IFormVariable>): { order: string[]; cyclic: string[] } {
  const order: string[] = [];
  const cyclic: string[] = [];
  const state: Record<string, 'visiting' | 'done' | 'cyclic'> = {};
  const visit = (name: string): boolean => {
    if (state[name] === 'done') {
      return true;
    }
    if (state[name] === 'visiting' || state[name] === 'cyclic') {
      return false;
    }
    state[name] = 'visiting';
    // A nem létező változóra való hivatkozás nem hiba: az értéke egyszerűen üres.
    const ok: boolean = variableDependencies(variables[name])
      .filter((dependency) => variables[dependency] !== undefined)
      .map(visit)
      .every((result) => result);
    if (ok) {
      state[name] = 'done';
      order.push(name);
    } else {
      state[name] = 'cyclic';
      cyclic.push(name);
    }
    return ok;
  };
  Object.keys(variables).forEach(visit);
  return { order, cyclic };
}

/** Egy átalakítás alkalmazása az értékre. */
export function applyTransform(value: string, transform: VariableTransform): string {
  switch (transform.type) {
    case 'substring':
      return transform.length === undefined
        ? value.substr(Math.max(0, transform.start))
        : value.substr(Math.max(0, transform.start), Math.max(0, transform.length));
    case 'number': {
      const parsed: number = parseNumber(value);
      return isNaN(parsed) ? '' : String(parsed);
    }
    case 'trim':
      return value.trim();
    case 'lower':
      return value.toLowerCase();
    case 'upper':
      return value.toUpperCase();
    default:
      return value;
  }
}

/**
 * A változók értéke `[Var:<név>]` kulcsokkal. A `values` a feltételek által látott értékek (mezők és környezeti
 * változók), a `savedValues` a mentett (betöltéskori) értékek az érték fajtájú, mentett forrású változókhoz.
 */
export function evaluateVariables(
  variables: Record<string, IFormVariable> | undefined,
  values: FormValues,
  savedValues: FormValues
): FormValues {
  const result: FormValues = {};
  if (!variables) {
    return result;
  }
  const { order, cyclic } = variableOrder(variables);
  cyclic.forEach((name) => {
    result[variableRef(name)] = variables[name].kind === 'condition' ? FALSE_VALUE : '';
  });
  let current: FormValues = { ...values, ...result };
  order.forEach((name) => {
    const variable: IFormVariable = variables[name];
    let value: string;
    if (variable.kind === 'condition') {
      // Feltétel nélkül a változó értéke nem (az üres feltétel egyébként mindig igaz lenne).
      value = variable.when !== undefined && evaluate(variable.when, current) ? TRUE_VALUE : FALSE_VALUE;
    } else {
      const source: string = variable.field ? (variable.saved ? savedValues : values)[variable.field] ?? '' : '';
      value = (variable.transforms ?? []).reduce(applyTransform, source);
    }
    result[variableRef(name)] = value;
    current = { ...current, [variableRef(name)]: value };
  });
  return result;
}

function parseTransform(input: unknown, path: string): VariableTransform {
  if (!isRecord(input) || (VARIABLE_TRANSFORMS as unknown[]).indexOf(input.type) === -1) {
    throw new Error(format(engineStrings().InvalidOption, `${path}.type`, VARIABLE_TRANSFORMS.join(', ')));
  }
  if (input.type === 'substring') {
    const start: number = typeof input.start === 'number' && input.start >= 0 ? Math.floor(input.start) : 0;
    const transform: VariableTransform = { type: 'substring', start };
    if (typeof input.length === 'number' && input.length >= 0) {
      transform.length = Math.floor(input.length);
    }
    return transform;
  }
  return { type: input.type as 'number' | 'trim' | 'lower' | 'upper' };
}

/** A konfiguráció `variables` részének ellenőrzése; hibás tartalomra kivételt dob (a parseConfig kezeli). */
export function parseVariables(input: unknown, path: string): Record<string, IFormVariable> | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const variables: Record<string, IFormVariable> = {};
  Object.keys(input).forEach((name) => {
    const itemPath: string = `${path}.${name}`;
    const item: unknown = input[name];
    if (!isVariableName(name) || !isRecord(item) || (item.kind !== 'condition' && item.kind !== 'value')) {
      throw new Error(format(engineStrings().InvalidVariable, itemPath));
    }
    if (item.kind === 'condition') {
      const variable: IFormVariable = { kind: 'condition' };
      if (item.when !== undefined) {
        const error: string | undefined = validateCondition(item.when, `${itemPath}.when`);
        if (error) {
          throw new Error(error);
        }
        variable.when = item.when as Condition;
      }
      variables[name] = variable;
      return;
    }
    const variable: IFormVariable = { kind: 'value' };
    if (item.field !== undefined && item.field !== '') {
      if (typeof item.field !== 'string' || !FIELD_NAME.test(item.field)) {
        throw new Error(format(engineStrings().InvalidFieldName, `${itemPath}.field`));
      }
      variable.field = item.field;
    }
    if (item.saved === true) {
      variable.saved = true;
    }
    if (item.transforms !== undefined) {
      if (!Array.isArray(item.transforms)) {
        throw new Error(format(engineStrings().MustBeArray, `${itemPath}.transforms`));
      }
      const transforms: VariableTransform[] = item.transforms.map((transform: unknown, index: number) =>
        parseTransform(transform, `${itemPath}.transforms[${index}]`)
      );
      if (transforms.length > 0) {
        variable.transforms = transforms;
      }
    }
    variables[name] = variable;
  });
  return Object.keys(variables).length > 0 ? variables : undefined;
}

/** A konfiguráció minden feltételének átalakítása (szekciók, mezők, feltételes értékek, változók). */
export function mapConfigConditions(config: IFormConfig, map: (field: IFieldCondition) => IFieldCondition): IFormConfig {
  const mapOptional = (condition: Condition | undefined): Condition | undefined =>
    condition === undefined ? undefined : mapCondition(condition, map);
  const mapRules = <K extends string>(
    rules: Partial<Record<K, IConditionalValue[]>> | undefined
  ): Partial<Record<K, IConditionalValue[]>> | undefined => {
    if (!rules) {
      return undefined;
    }
    const next: Partial<Record<K, IConditionalValue[]>> = {};
    (Object.keys(rules) as K[]).forEach((key) => {
      next[key] = (rules[key] ?? []).map((rule) => (rule.when ? { ...rule, when: mapCondition(rule.when, map) } : rule));
    });
    return next;
  };
  const strip = <T extends object>(input: T): T => {
    const source = input as Record<string, unknown>;
    Object.keys(source).forEach((key) => {
      if (source[key] === undefined) {
        delete source[key];
      }
    });
    return input;
  };

  const fields: IFormConfig['fields'] = {};
  Object.keys(config.fields).forEach((name) => {
    const field = config.fields[name];
    fields[name] = strip({
      ...field,
      visibleWhen: mapOptional(field.visibleWhen),
      readOnlyWhen: mapOptional(field.readOnlyWhen),
      requiredWhen: mapOptional(field.requiredWhen),
      conditional: mapRules(field.conditional)
    });
  });
  const next: IFormConfig = {
    ...config,
    sections: config.sections.map((section) =>
      strip({
        ...section,
        visibleWhen: mapOptional(section.visibleWhen),
        readOnlyWhen: mapOptional(section.readOnlyWhen),
        conditional: mapRules(section.conditional)
      })
    ),
    fields
  };
  if (config.variables) {
    const variables: Record<string, IFormVariable> = {};
    Object.keys(config.variables).forEach((name) => {
      const variable: IFormVariable = config.variables?.[name] as IFormVariable;
      variables[name] = strip({ ...variable, when: mapOptional(variable.when) });
    });
    next.variables = variables;
  }
  return next;
}

/** A változó átnevezése; a rá hivatkozó feltételek is az új nevet kapják. */
export function renameVariable(config: IFormConfig, from: string, to: string): IFormConfig {
  if (from === to || !config.variables?.[from] || config.variables[to]) {
    return config;
  }
  const renamed: IFormConfig = mapConfigConditions(config, (field) =>
    field.field === variableRef(from) ? { ...field, field: variableRef(to) } : field
  );
  // A sorrend megmarad: a változók a tervezőben a felvétel sorrendjében látszanak.
  const variables: Record<string, IFormVariable> = {};
  Object.keys(renamed.variables ?? {}).forEach((name) => {
    variables[name === from ? to : name] = (renamed.variables ?? {})[name];
  });
  return { ...renamed, variables };
}

/** Új, egyedi változónév a megadott alapból (`Valtozo1`, `Valtozo2`, …). */
export function newVariableName(config: IFormConfig, base: string): string {
  let n: number = Object.keys(config.variables ?? {}).length + 1;
  while (config.variables?.[`${base}${n}`]) {
    n++;
  }
  return `${base}${n}`;
}
