// Feltétel tömeges beállítása: ugyanaz a láthatósági, csak olvasható (gombnál letiltó) vagy kötelező feltétel
// egyszerre több mezőre. A meglévő feltétel felülírható, kiegészíthető (ÉS / VAGY), vagy törölhető.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { Condition, IFieldConfig, IFormConfig } from '../models/IFormConfig';

export type BulkConditionProperty = 'visibleWhen' | 'readOnlyWhen' | 'requiredWhen';

export const BULK_CONDITION_PROPERTIES: BulkConditionProperty[] = ['visibleWhen', 'readOnlyWhen', 'requiredWhen'];

/** `replace`: felülírja; `and` / `or`: a meglévővel ÉS / VAGY kapcsolatba teszi; `clear`: törli. */
export type BulkConditionMode = 'replace' | 'and' | 'or' | 'clear';

/** Két feltétel összekapcsolása; az azonos fajta csoportot kiteríti, hogy a vizuális szerkesztő is kezelje. */
export function combineConditions(existing: Condition | undefined, added: Condition, match: 'all' | 'any'): Condition {
  if (!existing) {
    return added;
  }
  const items = (condition: Condition): Condition[] =>
    match === 'all' && 'all' in condition ? condition.all : match === 'any' && 'any' in condition ? condition.any : [condition];
  const combined: Condition[] = [...items(existing), ...items(added)];
  return match === 'all' ? { all: combined } : { any: combined };
}

/**
 * A feltétel beállítása a megadott mezőkön (InternalName vagy felirat / gomb azonosító). A mezők többi beállítása
 * változatlan marad; `clear`-nél és az üres eredménynél a feltétel kimarad a konfigurációból.
 */
export function applyConditionToFields(
  config: IFormConfig,
  names: string[],
  property: BulkConditionProperty,
  condition: Condition | undefined,
  mode: BulkConditionMode
): IFormConfig {
  if (mode !== 'clear' && condition === undefined) {
    return config;
  }
  const fields: Record<string, IFieldConfig> = { ...config.fields };
  names.forEach((name) => {
    const current: IFieldConfig = fields[name] ?? {};
    let next: Condition | undefined;
    if (mode === 'clear' || condition === undefined) {
      next = undefined;
    } else if (mode === 'replace') {
      next = condition;
    } else {
      next = combineConditions(current[property], condition, mode === 'and' ? 'all' : 'any');
    }
    const updated: IFieldConfig = { ...current };
    if (next === undefined) {
      delete updated[property];
    } else {
      updated[property] = next;
    }
    fields[name] = updated;
  });
  return { ...config, fields };
}
