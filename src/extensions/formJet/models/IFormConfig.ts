// A FormConfigurations listában tárolt konfiguráció sémája.
// Séma módosításakor: schemaVersion emelés + migráció a parseConfig-ban (engine/LayoutResolver.ts).

import type { IFieldAssignment } from './IListCommands';

export type FormMode = 'new' | 'edit' | 'display';

export const FORM_MODES: FormMode[] = ['new', 'edit', 'display'];

// 1 → 2: szövegelemek (`texts`). A szerkezet csak bővült, az 1-es konfiguráció változtatás nélkül érvényes.
// 2 → 3: változók (`variables`). Szintén csak bővülés, a 2-es konfiguráció átalakítás nélkül érvényes.
// 3 → 4: testreszabható alsó gombsor (`footer`). Csak bővülés; hiányában a `saveMode` szerinti beépített gombok látszanak.
// 4 → 5: a kapcsolódó elemek önálló, a szakaszokban elhelyezhető elemek lettek (`texts`, `kind: related`), feladatkezeléssel.
//        A szakasz régi `related` beállítását a parseConfig alakítja át (`RelatedList.migrateSectionRelated`).
export const CONFIG_SCHEMA_VERSION: 5 = 5;

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
  /** A cella szövegének színe; a tervezőben szövegelemnél állítható. */
  textColor?: string;
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
 * megegyezik a szülő elem `sourceField` értékével. A felsorolás csak olvasható; feladatkezelésnél (`task`) a
 * hozzárendelt feladat felugró ablakban elvégezhető.
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
  /** Feladatkezelés: a hozzárendelt elemek (feladatok) felugró ablakban elvégezhetők. */
  task?: IRelatedTaskConfig;
}

/**
 * A kapcsolódó elemek feladatként kezelése. Látni mindenki látja a felsorolást; megnyitni csak az tudja, akihez (vagy
 * akinek a SharePoint csoportjához) a feladatot rendelték. Ez kényelmi szűrés, nem jogosultsági határ.
 */
export interface IRelatedTaskConfig {
  /** A kapcsolódó lista személy mezője (User / UserMulti), amely a hozzárendelést tárolja. Üres, amíg nincs kiválasztva. */
  assignedField: string;
  /** A feladat mezőire (InternalName) vonatkozó feltétel: ha nem teljesül, a feladat nem nyitható meg (például elvégezve). */
  openWhen?: Condition;
  /** Feladat megtekintése: a nem kitölthető sorok is megnyithatók, csak olvasható felugró ablakban (Bezárás gombbal). */
  allowView?: boolean;
  /** A felugró ablak címe: a feladat ezen mezőjének értéke. Hiányában a `Title`. */
  titleField?: string;
  /** A felugró ablakban a cím alatt megjelenő leírás mezője. */
  descriptionField?: string;
  /** Többsoros szöveg mező: a megjegyzés ebbe kerül (felülírja). Hiányában nincs megjegyzés. */
  commentField?: string;
  /** További mezők a felugró ablakban, sorrendben. */
  fields?: ITaskFieldConfig[];
  /** A gombok szabályai: az első teljesülő szabály gombjai jelennek meg. */
  buttonRules?: ITaskButtonRule[];
}

export interface ITaskFieldConfig {
  /** A feladat mezőjének InternalName-je. */
  field: string;
  /** Kitölthető a felugró ablakban (különben csak megjelenik). */
  editable?: boolean;
}

/**
 * A felugró ablak gombjai egy feltételhez. A feltétel az eredeti elem mentett mezőit (InternalName), a környezeti
 * változókat és a feladat mezőit (`[Task:<InternalName>]`) látja. Feltétel nélkül a szabály mindig teljesül.
 */
export interface ITaskButtonRule {
  when?: Condition;
  buttons: ITaskButton[];
}

export interface ITaskButton {
  label: string;
  primary?: boolean;
  /** A megjegyzés kitöltése kötelező ennél a gombnál. */
  commentRequired?: boolean;
  /** A feladat mezőinek beállítása (a kezdőérték formátumában; `{Mező}` az eredeti elem mentett értéke). */
  taskValues?: IFieldAssignment[];
  /** Az eredeti (az űrlapon megnyitott) elem mezőinek beállítása; csak ezek mentődnek, az űrlap más módosítása nem. */
  itemValues?: IFieldAssignment[];
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
  /**
   * A cím és a leírás feltételes értékei, sorrendben: az első teljesülő szabály értéke érvényes,
   * ha egyik sem teljesül, a `title`, illetve a `description`.
   */
  conditional?: Partial<Record<SectionConditionalProperty, IConditionalValue[]>>;
  /** Rácsoszlopok száma, 1–4. */
  columns: number;
  collapsible?: boolean;
  collapsed?: boolean;
  /** Hiányában mindhárom módban látszik. */
  visibleIn?: FormMode[];
  visibleWhen?: Condition;
  /** Ha teljesül, a szakasz minden mezője csak olvasható (a gombjai letiltottak); a mezők saját beállítása mellett. */
  readOnlyWhen?: Condition;
  style?: IModeStyles<ISectionStyle>;
  fields: IFieldPlacement[];
}

/** A mező feltételhez köthető szöveges beállításai. */
export type ConditionalProperty = 'label' | 'description' | 'placeholder' | 'defaultValue';

export const CONDITIONAL_PROPERTIES: ConditionalProperty[] = ['label', 'description', 'placeholder', 'defaultValue'];

/** A szekció feltételhez köthető szöveges beállításai. */
export type SectionConditionalProperty = 'title' | 'description';

export const SECTION_CONDITIONAL_PROPERTIES: SectionConditionalProperty[] = ['title', 'description'];

/** Feltételes érték: ha a feltétel teljesül, a beállítás ezt az értéket veszi fel. */
export interface IConditionalValue {
  /** Hiányában a szabály félkész, és nem érvényesül. */
  when?: Condition;
  value: string;
}

export interface IFieldConfig {
  label?: string;
  description?: string;
  placeholder?: string;
  /**
   * Feltételes értékek beállításonként, sorrendben: az első teljesülő szabály értéke érvényes, ha egyik sem
   * teljesül, a beállítás alapértéke (`label`, `description`, …). A kezdőérték szabályai New módban,
   * a megnyitáskor értékelődnek ki egyszer.
   */
  conditional?: Partial<Record<ConditionalProperty, IConditionalValue[]>>;
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

/**
 * Mező nélküli elem: felirat (a formon megjelenő, formázás nélküli szöveg), gomb vagy kapcsolódó elemek felsorolása,
 * amely mögött nincs SharePoint mező.
 * A szekciókban mezőként helyezhető el (egyszer); a láthatósága és a stílusa a `fields` azonos kulcsú
 * bejegyzésében van.
 */
export interface ITextElement {
  /** Az elem fajtája; hiányában felirat (sima szöveg). */
  kind?: LayoutElementKind;
  /** Megnevezés. Feliratnál csak a tervezőben látszik; gombnál ez a gomb felirata. */
  name: string;
  /** Feliratnál a formon megjelenő szöveg; a sortörések megmaradnak. */
  content?: string;
  /** Gombnál a megnyitandó cím; csak `http(s)://`, `mailto:` vagy webhelyen belüli cím lehet (`isSafeUrl`). */
  url?: string;
  /** Gombnál: a cím új lapon nyílik meg. */
  newTab?: boolean;
  /** Gombnál: Fluent UI ikonnév (betűk és számok), a felirat mellett jelenik meg. */
  icon?: string;
  /** Gombnál: kiemelt (elsődleges, kék) gomb. */
  primary?: boolean;
  /**
   * Gombnál: kattintásra sorban lefutó lépések. Ha van lépés, a gomb a címet nem nyitja meg.
   * A mentés és a bezárás lezárja a sort: utánuk nem fut le több lépés.
   */
  actions?: ButtonAction[];
  /** Kapcsolódó elemeknél: a lista, a párosítás, az oszlopok és a feladatkezelés. */
  related?: IRelatedListConfig;
}

/** A gomb egy lépése: mező értékének beállítása, mentés vagy bezárás. */
export type ButtonAction =
  | {
      type: 'setValue';
      /** A mező InternalName-je. */
      field: string;
      /** Az érték a kezdőérték formátumában (form-string; dátumnál `[today]`, személynél `[me]` is). */
      value: string;
    }
  /** Mentés; alapból utána bezár. `keepOpen`: az űrlap nyitva marad (új elemnél a létrehozott elem szerkesztésével). */
  | { type: 'save'; keepOpen?: boolean }
  | { type: 'close' };

export type ButtonActionType = ButtonAction['type'];

export const BUTTON_ACTION_TYPES: ButtonActionType[] = ['setValue', 'save', 'close'];

/** A mező nélküli elemek fajtái: felirat (sima szöveg), gomb és kapcsolódó elemek. */
export type LayoutElementKind = 'text' | 'button' | 'related';

export interface IFormConfig {
  schemaVersion: 5;
  listId: string;
  contentTypeId: string;
  title?: string;
  /** A 'left' még nincs megvalósítva a renderelőben. */
  labelPosition?: 'top' | 'left';
  /**
   * A mentés gombjai. Hiányában `default`: Mentés (ment és bezár) + Mégse. `extended`: Mentés (ment, az űrlap nyitva
   * marad) + Mentés és bezárás + Mégse.
   */
  saveMode?: SaveMode;
  style?: IModeStyles<IFormStyle>;
  sections: ISectionConfig[];
  /** Kulcs: a mező InternalName-je. */
  fields: Record<string, IFieldConfig>;
  /** Szövegelemek. Kulcs: az elem azonosítója (`text:` előtaggal), a szekciókban ezzel hivatkozható. */
  texts?: Record<string, ITextElement>;
  /**
   * A form változói, név szerint. A feltételekben mezőként hivatkozhatók (`[Var:<név>]`), így egy szabály egyszer
   * definiálható, és sok mezőnél, szekciónál újrahasznosítható.
   */
  variables?: Record<string, IFormVariable>;
  /**
   * Az alsó gombsor: gombelemek (`texts`, `kind: 'button'`) azonosítói sorrendben. Ezek nem szerepelnek a szakaszokban.
   * Hiányában a `saveMode` szerinti beépített gombok látszanak (Mentés, [Mentés és bezárás], Mégse / Bezárás).
   */
  footer?: string[];
}

export type SaveMode = 'default' | 'extended';

export const SAVE_MODES: SaveMode[] = ['default', 'extended'];

/** A változó fajtája: igen / nem értékű feltétel, vagy egy mező (átalakított) értéke. */
export type FormVariableKind = 'condition' | 'value';

/**
 * Egy változó. Feltétel fajtánál az értéke igen / nem (`1` / `0`); érték fajtánál a forrásmező élő vagy mentett
 * értéke, az átalakítások sorrendben alkalmazva.
 */
export interface IFormVariable {
  kind: FormVariableKind;
  /** Feltétel fajtánál: hiányában a változó értéke nem. */
  when?: Condition;
  /** Érték fajtánál: a forrásmező InternalName-je. */
  field?: string;
  /** Érték fajtánál: a mező mentett (betöltéskori) értéke az élő (éppen beírt) helyett. Új elemnél üres. */
  saved?: boolean;
  /** Érték fajtánál: sorban alkalmazott átalakítások. */
  transforms?: VariableTransform[];
}

/** Egy átalakítás a változó értékén. Új fajta: típus + `VARIABLE_TRANSFORMS` + `FormVariables.applyTransform` + szerkesztő. */
export type VariableTransform =
  /** Szövegrész: `start`-tól (0-tól számolva) legfeljebb `length` karakter; hossz nélkül a szöveg végéig. */
  | { type: 'substring'; start: number; length?: number }
  /** Számmá alakítás (szóköz és tizedesvessző is lehet benne); nem szám esetén üres. */
  | { type: 'number' }
  | { type: 'trim' }
  | { type: 'lower' }
  | { type: 'upper' };

export type VariableTransformType = VariableTransform['type'];

export const VARIABLE_TRANSFORMS: VariableTransformType[] = ['substring', 'number', 'trim', 'lower', 'upper'];
