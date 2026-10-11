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

/**
 * Többértékű keresőmező megjelenítése: mindig nyitott jelölőnégyzetes lista, lenyíló lista,
 * vagy `auto` (legfeljebb 8 választható elemnél jelölőnégyzetes lista, efelett lenyíló).
 */
export type LookupDisplay = 'auto' | 'checklist' | 'dropdown';
export const LOOKUP_DISPLAYS: LookupDisplay[] = ['auto', 'checklist', 'dropdown'];
/** `auto` módban eddig az elemszámig jelenik meg jelölőnégyzetes lista. */
export const LOOKUP_CHECKLIST_MAX: number = 8;

/** A mellékletek megjelenítése: soronként egy fájl, vagy tömören, egymás mellett. */
export type AttachmentsDisplay = 'list' | 'compact';
export const ATTACHMENTS_DISPLAYS: AttachmentsDisplay[] = ['list', 'compact'];

export type Density = 'comfortable' | 'compact';
export const DENSITIES: Density[] = ['comfortable', 'compact'];

export type SectionHeaderStyle = 'underline' | 'bar' | 'plain';
export const SECTION_HEADER_STYLES: SectionHeaderStyle[] = ['underline', 'bar', 'plain'];

// Stílus: a színek hex értékek (#rgb vagy #rrggbb). Szabad CSS szándékosan nem adható meg.

export type GradientType = 'linear' | 'radial';
export const GRADIENT_TYPES: GradientType[] = ['linear', 'radial'];

/** Kétszínű színátmenet. A sugaras átmenet középről indul kifelé. */
export interface IGradient {
  type: GradientType;
  /** Csak lineárisnál: irány fokban, 0–360. Alapértelmezés: 180 (fentről lefelé). */
  angle?: number;
  /** Kezdő és záró szín (hex). */
  colors: [string, string];
}

/** Háttér és keret; a formon, a szekción és a mezőn is megadható. */
export interface IBoxStyle {
  background?: string;
  /** Ha meg van adva, ez látszik az egyszínű háttér helyett. */
  backgroundGradient?: IGradient;
  borderColor?: string;
  /** Keretvastagság képpontban, 0–8. Alapértelmezés: 1, ha van keretszín. */
  borderWidth?: number;
  /** Lekerekítés képpontban, 0–24. Alapértelmezés: 4. */
  borderRadius?: number;
}

export interface IFormStyle extends IBoxStyle {
  /** A form címének és a szekciófejléceknek a színe. */
  accentColor?: string;
  /** A form maximális szélessége képpontban. */
  maxWidth?: number;
  density?: Density;
  sectionHeader?: SectionHeaderStyle;
}

export interface ISectionStyle extends IBoxStyle {
  /** Hiányában a form accentColor értéke érvényes. */
  headerColor?: string;
}

export interface IFieldStyle extends IBoxStyle {
  labelColor?: string;
}

/** Módonkénti stílus: a `base` minden módban érvényes, a mód kulcsa csak az eltérést tartalmazza. */
export interface IModeStyles<T> {
  base?: T;
  new?: T;
  edit?: T;
  display?: T;
}

/**
 * Kapcsolódó elemek: egy másik (azonos webhelyen lévő) lista azon elemei, amelyek `matchField` mezője
 * megegyezik a szülő elem `sourceField` értékével. Csak olvasható felsorolás.
 */
export interface IRelatedListConfig {
  /** A kapcsolódó lista GUID-ja. Üres, amíg a tervezőben nincs kiválasztva. */
  listId: string;
  /** A kapcsolódó lista mezőjének InternalName-je. */
  matchField: string;
  /** Ennek a listának a mezője (InternalName), vagy `ID` a szülő elem azonosítójához. */
  sourceField: string;
  /** A megjelenített oszlopok (a kapcsolódó lista mezőinek InternalName-je), sorrendben. */
  columns: string[];
  /** Hiányában azonosító szerint rendez. */
  sortField?: string;
  /** Alapértelmezés: növekvő. */
  sortAscending?: boolean;
  /** 1–500; alapértelmezés: 30. */
  rowLimit?: number;
  /** „Új elem” gomb, amely a kapcsolódó lista új elem formját nyitja meg. */
  showNewButton?: boolean;
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
  /** A mezők alatt egy másik lista kapcsolódó elemei jelennek meg. New módban nem látszik. */
  related?: IRelatedListConfig;
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
  /** Többértékű keresőmező megjelenítése. Hiányában `auto`. */
  lookupDisplay?: LookupDisplay;
  /** A mellékletek megjelenítése. Hiányában `list`. */
  attachmentsDisplay?: AttachmentsDisplay;
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
