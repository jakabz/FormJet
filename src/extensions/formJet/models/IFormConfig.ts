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

export type Density = 'comfortable' | 'compact';
export const DENSITIES: Density[] = ['comfortable', 'compact'];

export type SectionHeaderStyle = 'underline' | 'bar' | 'plain';
export const SECTION_HEADER_STYLES: SectionHeaderStyle[] = ['underline', 'bar', 'plain'];

// Stílus: a színek hex értékek (#rgb vagy #rrggbb). Szabad CSS szándékosan nem adható meg.

export interface IFormStyle {
  /** A form címének és a szekciófejléceknek a színe. */
  accentColor?: string;
  background?: string;
  /** A form maximális szélessége képpontban. */
  maxWidth?: number;
  density?: Density;
  sectionHeader?: SectionHeaderStyle;
}

export interface ISectionStyle {
  background?: string;
  borderColor?: string;
  /** Hiányában a form accentColor értéke érvényes. */
  headerColor?: string;
}

export interface IFieldStyle {
  background?: string;
  labelColor?: string;
}

/** Módonkénti stílus: a `base` minden módban érvényes, a mód kulcsa csak az eltérést tartalmazza. */
export interface IModeStyles<T> {
  base?: T;
  new?: T;
  edit?: T;
  display?: T;
}

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
  style?: IModeStyles<ISectionStyle>;
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
  style?: IModeStyles<IFieldStyle>;
}

export interface IFormConfig {
  schemaVersion: 1;
  listId: string;
  contentTypeId: string;
  title?: string;
  /** A 'left' még nincs megvalósítva a renderelőben. */
  labelPosition?: 'top' | 'left';
  style?: IModeStyles<IFormStyle>;
  sections: ISectionConfig[];
  /** Kulcs: a mező InternalName-je. */
  fields: Record<string, IFieldConfig>;
}
