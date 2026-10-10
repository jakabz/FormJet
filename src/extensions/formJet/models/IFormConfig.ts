// A FormConfigurations listában tárolt konfiguráció sémája.
// Séma módosításakor: schemaVersion emelés + migráció a parseConfig-ban (engine/LayoutResolver.ts).

export type FormMode = 'new' | 'edit' | 'display';

export const FORM_MODES: FormMode[] = ['new', 'edit', 'display'];

export const CONFIG_SCHEMA_VERSION: 1 = 1;

export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'in' | 'empty' | 'notEmpty';

export const CONDITION_OPERATORS: ConditionOperator[] = ['eq', 'ne', 'gt', 'lt', 'contains', 'in', 'empty', 'notEmpty'];

export type ConditionScalar = string | number | boolean;
export type ConditionValue = ConditionScalar | ConditionScalar[];

export interface IFieldCondition {
  /** A mező InternalName-je. */
  field: string;
  op: ConditionOperator;
  value?: ConditionValue;
}

export interface IAllCondition {
  all: Condition[];
}

export interface IAnyCondition {
  any: Condition[];
}

export interface INotCondition {
  not: Condition;
}

export type Condition = IAllCondition | IAnyCondition | INotCondition | IFieldCondition;

export interface IFieldPlacement {
  /** A mező InternalName-je. */
  field: string;
  colSpan?: number;
}

export interface ISectionConfig {
  id: string;
  title?: string;
  description?: string;
  /** Rácsoszlopok száma, 1–4. */
  columns: number;
  collapsible?: boolean;
  collapsed?: boolean;
  /** Hiányában mindhárom módban látszik. */
  visibleIn?: FormMode[];
  visibleWhen?: Condition;
  fields: IFieldPlacement[];
}

export interface IFieldConfig {
  label?: string;
  description?: string;
  placeholder?: string;
  /** Hiányában mindhárom módban látszik. */
  visibleIn?: FormMode[];
  readOnlyIn?: FormMode[];
  /** Csak szigorít: a SharePoint szerint kötelező mező nem tehető opcionálissá. */
  requiredIn?: FormMode[];
  visibleWhen?: Condition;
  readOnlyWhen?: Condition;
  requiredWhen?: Condition;
  /** Kezdőérték New módban, form-string formátumban. */
  defaultValue?: string;
}

export interface IFormConfig {
  schemaVersion: 1;
  listId: string;
  contentTypeId: string;
  title?: string;
  /** A 'left' még nincs megvalósítva a renderelőben. */
  labelPosition?: 'top' | 'left';
  sections: ISectionConfig[];
  /** Kulcs: a mező InternalName-je. */
  fields: Record<string, IFieldConfig>;
}
