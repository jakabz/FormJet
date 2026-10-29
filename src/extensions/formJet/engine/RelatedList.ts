// Kapcsolódó elemek: a beállítás ellenőrzése, a párosító érték előkészítése és a CAML lekérdezés; feladatkezelésnél
// a hozzárendelt elemek lekérdezése, a megnyithatóság és a felugró ablak gombjainak kiválasztása.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { FormValues } from '../models/IFieldSchema';
import {
  Condition,
  IRelatedListConfig,
  IRelatedTaskConfig,
  ITaskButton,
  ITaskButtonRule,
  ITaskFieldConfig
} from '../models/IFormConfig';
import { IFieldAssignment } from '../models/IListCommands';
import { evaluate, parseNumber, validateCondition } from './ConditionEngine';
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
export function isRelatedComplete(config: IRelatedListConfig | undefined, withoutColumns: boolean = false): config is IRelatedListConfig {
  return (
    !!config &&
    config.listId !== '' &&
    config.matchField !== '' &&
    config.sourceField !== '' &&
    (withoutColumns || config.columns.length > 0)
  );
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
  const task: IRelatedTaskConfig | undefined = parseTask(input.task, `${path}.task`);
  if (task) config.task = task;
  return config;
}

function parseCondition(value: unknown, path: string): Condition | undefined {
  if (value === undefined) {
    return undefined;
  }
  const error: string | undefined = validateCondition(value, path);
  if (error) {
    throw new Error(error);
  }
  return value as Condition;
}

/** Mezőértékek listája (`{ field, value }`); a félkész (mező nélküli) sor megmarad. */
function parseAssignments(input: unknown, path: string): IFieldAssignment[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw new Error(format(engineStrings().MustBeArray, path));
  }
  const values: IFieldAssignment[] = input.map((item: unknown, i: number) => {
    if (!isRecord(item)) {
      throw new Error(format(engineStrings().MustBeObject, `${path}[${i}]`));
    }
    return {
      field: parseFieldName(item.field, `${path}[${i}].field`),
      value: typeof item.value === 'string' ? item.value : ''
    };
  });
  return values.length > 0 ? values : undefined;
}

function parseTaskButton(input: unknown, path: string): ITaskButton {
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const button: ITaskButton = { label: typeof input.label === 'string' ? input.label : '' };
  if (input.primary === true) button.primary = true;
  if (input.commentRequired === true) button.commentRequired = true;
  const taskValues: IFieldAssignment[] | undefined = parseAssignments(input.taskValues, `${path}.taskValues`);
  if (taskValues) button.taskValues = taskValues;
  const itemValues: IFieldAssignment[] | undefined = parseAssignments(input.itemValues, `${path}.itemValues`);
  if (itemValues) button.itemValues = itemValues;
  return button;
}

/** A feladatkezelés beállításainak ellenőrzése. A félkész beállítás (még nincs személy mező) is menthető. */
function parseTask(input: unknown, path: string): IRelatedTaskConfig | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const task: IRelatedTaskConfig = { assignedField: parseFieldName(input.assignedField, `${path}.assignedField`) };
  const openWhen: Condition | undefined = parseCondition(input.openWhen, `${path}.openWhen`);
  if (openWhen) task.openWhen = openWhen;
  const titleField: string = parseFieldName(input.titleField, `${path}.titleField`);
  if (titleField !== '') task.titleField = titleField;
  const descriptionField: string = parseFieldName(input.descriptionField, `${path}.descriptionField`);
  if (descriptionField !== '') task.descriptionField = descriptionField;
  const commentField: string = parseFieldName(input.commentField, `${path}.commentField`);
  if (commentField !== '') task.commentField = commentField;
  if (input.fields !== undefined) {
    if (!Array.isArray(input.fields)) {
      throw new Error(format(engineStrings().MustBeArray, `${path}.fields`));
    }
    const fields: ITaskFieldConfig[] = [];
    input.fields.forEach((item: unknown, i: number) => {
      if (!isRecord(item)) {
        throw new Error(format(engineStrings().MustBeObject, `${path}.fields[${i}]`));
      }
      const name: string = parseFieldName(item.field, `${path}.fields[${i}].field`);
      if (name !== '' && !fields.some((field) => field.field === name)) {
        fields.push(item.editable === true ? { field: name, editable: true } : { field: name });
      }
    });
    if (fields.length > 0) task.fields = fields;
  }
  if (input.buttonRules !== undefined) {
    if (!Array.isArray(input.buttonRules)) {
      throw new Error(format(engineStrings().MustBeArray, `${path}.buttonRules`));
    }
    const rules: ITaskButtonRule[] = input.buttonRules.map((item: unknown, i: number) => {
      const rulePath: string = `${path}.buttonRules[${i}]`;
      if (!isRecord(item)) {
        throw new Error(format(engineStrings().MustBeObject, rulePath));
      }
      if (item.buttons !== undefined && !Array.isArray(item.buttons)) {
        throw new Error(format(engineStrings().MustBeArray, `${rulePath}.buttons`));
      }
      const rule: ITaskButtonRule = {
        buttons: ((item.buttons as unknown[] | undefined) ?? []).map((button, j) => parseTaskButton(button, `${rulePath}.buttons[${j}]`))
      };
      const when: Condition | undefined = parseCondition(item.when, `${rulePath}.when`);
      if (when) rule.when = when;
      return rule;
    });
    if (rules.length > 0) task.buttonRules = rules;
  }
  return task;
}

/** A feladat mezőjére hivatkozó változó a gombszabályok feltételeiben; a szögletes zárójel miatt nem ütközik mezőnévvel. */
export function taskVariable(fieldName: string): string {
  return `[Task:${fieldName}]`;
}

/** Be van-e kapcsolva a feladatkezelés (ki van választva a hozzárendelés mezője). */
export function isTaskEnabled(config: IRelatedListConfig): config is IRelatedListConfig & { task: IRelatedTaskConfig } {
  return !!config.task && config.task.assignedField !== '';
}

/**
 * Megnyitható-e a hozzárendelt feladat: az `openWhen` a feladat mezőit (és a környezeti változókat) látja.
 * Feltétel nélkül minden hozzárendelt feladat megnyitható.
 */
export function isTaskOpenable(task: IRelatedTaskConfig, taskValues: FormValues, contextValues: FormValues = {}): boolean {
  return !task.openWhen || evaluate(task.openWhen, { ...contextValues, ...taskValues });
}

/** A gombszabályok kiértékeléséhez: az eredeti elem értékei (és a környezeti változók) + a feladat mezői előtaggal. */
export function taskConditionValues(itemValues: FormValues, taskValues: FormValues): FormValues {
  const values: FormValues = { ...itemValues };
  Object.keys(taskValues).forEach((name) => {
    values[taskVariable(name)] = taskValues[name];
  });
  return values;
}

/** A felugró ablak gombjai: az első teljesülő szabály gombjai (a felirat nélküli gomb kimarad). */
export function pickTaskButtons(task: IRelatedTaskConfig, values: FormValues): ITaskButton[] {
  const rule: ITaskButtonRule | undefined = (task.buttonRules ?? []).filter((item) => !item.when || evaluate(item.when, values))[0];
  return rule ? rule.buttons.filter((button) => button.label.trim() !== '') : [];
}

/**
 * Régi (4-es és korábbi) konfiguráció: a szakasz `related` beállítása önálló kapcsolódó elem lesz a `texts`-ben,
 * a szakasz végén, teljes szélességben. A bemenet nyers (még nem ellenőrzött) JSON; a változatlan részeket érintetlenül
 * hagyja, az ellenőrzés utána a parseConfig dolga.
 */
export function migrateSectionRelated(input: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(input.sections) || !input.sections.some((section) => isRecord(section) && section.related !== undefined)) {
    return input;
  }
  const texts: Record<string, unknown> = isRecord(input.texts) ? { ...input.texts } : {};
  let n: number = 1;
  const sections: unknown[] = input.sections.map((section: unknown) => {
    if (!isRecord(section) || section.related === undefined) {
      return section;
    }
    while (texts[`related:${n}`] !== undefined) {
      n++;
    }
    const id: string = `related:${n}`;
    texts[id] = {
      kind: 'related',
      name: typeof section.title === 'string' && section.title !== '' ? section.title : String(section.id ?? id),
      related: section.related
    };
    const next: Record<string, unknown> = { ...section };
    delete next.related;
    const placement: Record<string, unknown> = { field: id };
    if (typeof section.columns === 'number' && section.columns > 1) {
      placement.colSpan = section.columns;
    }
    next.fields = (Array.isArray(section.fields) ? section.fields : []).concat([placement]);
    return next;
  });
  return { ...input, sections, texts };
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
  return buildViewXml(config, matchFieldType, rawValue);
}

/**
 * A kapcsolódó elemek közül a bejelentkezett felhasználóhoz rendeltek (csak az azonosítójuk): a személy mezőben ő maga
 * szerepel, vagy egy SharePoint csoport, amelynek tagja. A tagságot a SharePoint dönti el (`Membership`).
 * `undefined`, ha nincs feladatkezelés, a hozzárendelés mezője nem személy mező, vagy nincs mivel párosítani.
 */
export function buildAssignedViewXml(
  config: IRelatedListConfig,
  matchFieldType: string,
  rawValue: string | undefined,
  assignedFieldType: string
): string | undefined {
  if (!isTaskEnabled(config) || !isFieldName(config.task.assignedField)) {
    return undefined;
  }
  const name: string = config.task.assignedField;
  let user: string;
  if (assignedFieldType === 'User') {
    user = `<Eq><FieldRef Name='${name}' LookupId='TRUE'/><Value Type='Integer'><UserID/></Value></Eq>`;
  } else if (assignedFieldType === 'UserMulti') {
    user = `<Includes><FieldRef Name='${name}' LookupId='TRUE'/><Value Type='Integer'><UserID/></Value></Includes>`;
  } else {
    return undefined;
  }
  const assigned: string = `<Or>${user}<Membership Type='CurrentUserGroups'><FieldRef Name='${name}'/></Membership></Or>`;
  // Csak az azonosító kell; a sorkorlát ugyanaz, mint a felsorolásé.
  return buildViewXml({ ...config, columns: [] }, matchFieldType, rawValue, assigned);
}

function buildViewXml(
  config: IRelatedListConfig,
  matchFieldType: string,
  rawValue: string | undefined,
  /** További feltétel a párosítás mellé (ÉS kapcsolattal). */
  extraWhere?: string
): string | undefined {
  const spec = MATCH_VALUE_TYPES[matchFieldType];
  const value: string | undefined = normalizeMatchValue(matchFieldType, rawValue);
  if (!spec || value === undefined || !isRelatedComplete(config, extraWhere !== undefined)) {
    return undefined;
  }
  // A mezőnevek ellenőrzése itt is megtörténik, mert a tervező a parseConfig megkerülésével is adhat beállítást.
  const names: string[] = [config.matchField, ...config.columns].concat(config.sortField ? [config.sortField] : []);
  if (!names.every(isFieldName)) {
    return undefined;
  }

  const lookupId: string = spec.kind === 'lookup' ? " LookupId='TRUE'" : '';
  const match: string = `<Eq><FieldRef Name='${config.matchField}'${lookupId}/><Value Type='${spec.camlType}'>${escapeXml(value)}</Value></Eq>`;
  const where: string = `<Where>${extraWhere ? `<And>${match}${extraWhere}</And>` : match}</Where>`;
  const orderBy: string =
    `<OrderBy><FieldRef Name='${config.sortField ?? ID_FIELD}' ` +
    `Ascending='${config.sortAscending === false ? 'FALSE' : 'TRUE'}'/></OrderBy>`;
  const viewFields: string = [ID_FIELD, ...config.columns]
    .filter((name, i, all) => all.indexOf(name) === i)
    .map((name) => `<FieldRef Name='${name}'/>`)
    .join('');

  return (
    // A mappákba rendezett elemek is kellenek: a Recursive minden mappában keres, de magukat a mappákat nem adja vissza.
    `<View Scope='Recursive'><Query>${where}${orderBy}</Query>` +
    `<ViewFields>${viewFields}</ViewFields>` +
    `<RowLimit>${getRowLimit(config) + 1}</RowLimit></View>`
  );
}
