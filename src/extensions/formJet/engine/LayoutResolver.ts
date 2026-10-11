// Séma + konfiguráció + mód + értékek → megjelenítendő form.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import {
  CONFIG_SCHEMA_VERSION,
  FORM_MODES,
  FormMode,
  IFieldConfig,
  IFieldPlacement,
  IFieldStyle,
  IFormConfig,
  IFormStyle,
  IRelatedListConfig,
  ISectionConfig,
  ISectionStyle,
  LOOKUP_DISPLAYS,
  LookupDisplay
} from '../models/IFormConfig';
import { FormValues, IFieldSchema } from '../models/IFieldSchema';
import { evaluate, joinMultiValue, validateCondition } from './ConditionEngine';
import { formatDateValue, parseDateValue, roundToTimeStep } from './DateFormat';
import { engineStrings, format } from './EngineStrings';
import { resolveNumberDefault } from './NumberFormat';
import { isRelatedComplete, parseRelated } from './RelatedList';
import { parseFieldStyles, parseFormStyles, parseSectionStyles, resolveModeStyle } from './FormStyle';

/** Mezőtípusok, amelyekhez a FieldRenderer szerkesztő vezérlőt ad. A többi csak olvasható. */
const EDITABLE_TYPES: string[] = ['Text', 'Note', 'Number', 'Currency', 'Choice', 'MultiChoice', 'Boolean', 'DateTime', 'User', 'UserMulti', 'URL'];

/** Típusok, amelyeknél a séma DefaultValue-ja New módban kezdőértékként használható. */
const SCHEMA_DEFAULT_TYPES: string[] = ['Text', 'Note', 'Number', 'Currency', 'Choice', 'MultiChoice', 'Boolean'];

const MAX_COLUMNS: number = 4;

export interface IResolvedField {
  name: string;
  schema: IFieldSchema;
  label: string;
  description?: string;
  placeholder?: string;
  /** Többértékű keresőmező megjelenítése. */
  lookupDisplay: LookupDisplay;
  colSpan: number;
  /** A szekció láthatóságát is tartalmazza. */
  visible: boolean;
  readOnly: boolean;
  required: boolean;
  /** Az aktuális módban érvényes stílus. */
  style: IFieldStyle;
}

export interface IResolvedSection {
  id: string;
  title?: string;
  description?: string;
  columns: number;
  collapsible: boolean;
  collapsed: boolean;
  visible: boolean;
  style: ISectionStyle;
  /** Kapcsolódó elemek beállítása; New módban nincs (a szülő elem még nem létezik). */
  related?: IRelatedListConfig;
  fields: IResolvedField[];
}

export interface IResolvedForm {
  mode: FormMode;
  title?: string;
  style: IFormStyle;
  labelPosition: 'top' | 'left';
  sections: IResolvedSection[];
  /** A konfigurációban szereplő, de a sémában nem létező mezők. */
  missingFields: string[];
}

export interface IParseConfigResult {
  config?: IFormConfig;
  error?: string;
}

/** Van-e szerkesztő vezérlő a mezőhöz. */
export function isEditableField(schema: IFieldSchema): boolean {
  if (schema.ReadOnlyField) {
    return false;
  }
  if (schema.TypeAsString === 'Lookup' || schema.TypeAsString === 'LookupMulti') {
    // Csak a listára mutató keresőmezőhöz van választó.
    return schema.LookupListId !== undefined;
  }
  return EDITABLE_TYPES.indexOf(schema.TypeAsString) !== -1;
}

function inMode(modes: FormMode[] | undefined, mode: FormMode, whenMissing: boolean): boolean {
  return modes ? modes.indexOf(mode) !== -1 : whenMissing;
}

function clampColumns(value: number | undefined): number {
  const columns: number = Math.floor(value ?? 1);
  return isNaN(columns) ? 1 : Math.max(1, Math.min(MAX_COLUMNS, columns));
}

export function resolveForm(
  schema: IFieldSchema[],
  config: IFormConfig,
  mode: FormMode,
  values: FormValues
): IResolvedForm {
  const schemaByName: Record<string, IFieldSchema> = {};
  schema.forEach((field) => {
    schemaByName[field.InternalName] = field;
  });

  const placed: Record<string, boolean> = {};
  const missingFields: string[] = [];

  const sections: IResolvedSection[] = config.sections.map((section) => {
    const columns: number = clampColumns(section.columns);
    const related: IRelatedListConfig | undefined = mode === 'new' ? undefined : section.related;
    // Ha a szekcióban csak kapcsolódó elemek lennének, de azok nem jeleníthetők meg, a szekció sem látszik.
    const nothingToShow: boolean =
      section.fields.length === 0 && section.related !== undefined && !isRelatedComplete(related);
    const sectionVisible: boolean =
      !nothingToShow && inMode(section.visibleIn, mode, true) && evaluate(section.visibleWhen, values);
    const fields: IResolvedField[] = [];

    section.fields.forEach((placement) => {
      const fieldSchema: IFieldSchema | undefined = schemaByName[placement.field];
      if (!fieldSchema) {
        if (missingFields.indexOf(placement.field) === -1) {
          missingFields.push(placement.field);
        }
        return;
      }
      if (placed[placement.field]) {
        return; // egy mező csak egyszer jelenhet meg, az első elhelyezés számít
      }
      placed[placement.field] = true;

      const fieldConfig: IFieldConfig = config.fields[placement.field] ?? {};
      const visible: boolean =
        sectionVisible && inMode(fieldConfig.visibleIn, mode, true) && evaluate(fieldConfig.visibleWhen, values);
      const readOnly: boolean =
        mode === 'display' ||
        !isEditableField(fieldSchema) ||
        inMode(fieldConfig.readOnlyIn, mode, false) ||
        (fieldConfig.readOnlyWhen !== undefined && evaluate(fieldConfig.readOnlyWhen, values));
      // A kötelezőség csak szigorítható: a séma Required értéke mindig érvényes.
      const required: boolean =
        mode !== 'display' &&
        (fieldSchema.Required ||
          inMode(fieldConfig.requiredIn, mode, false) ||
          (fieldConfig.requiredWhen !== undefined && evaluate(fieldConfig.requiredWhen, values)));

      fields.push({
        name: placement.field,
        schema: fieldSchema,
        label: fieldConfig.label || fieldSchema.Title,
        description: fieldConfig.description ?? fieldSchema.Description,
        placeholder: fieldConfig.placeholder,
        lookupDisplay: fieldConfig.lookupDisplay ?? 'auto',
        colSpan: Math.min(clampColumns(placement.colSpan), columns),
        visible,
        readOnly,
        required,
        style: resolveModeStyle(fieldConfig.style, mode)
      });
    });

    return {
      id: section.id,
      title: section.title,
      description: section.description,
      columns,
      collapsible: !!section.collapsible,
      collapsed: !!section.collapsible && !!section.collapsed,
      visible: sectionVisible,
      style: resolveModeStyle(section.style, mode),
      related,
      fields
    };
  });

  return {
    mode,
    title: config.title,
    style: resolveModeStyle(config.style, mode),
    labelPosition: config.labelPosition ?? 'top',
    sections,
    missingFields
  };
}

/** A feloldott form összes mezője megjelenési sorrendben. */
export function flattenFields(form: IResolvedForm): IResolvedField[] {
  const result: IResolvedField[] = [];
  form.sections.forEach((section) => {
    section.fields.forEach((field) => result.push(field));
  });
  return result;
}

/** A séma azon mezői, amelyek egyetlen szekcióban sem szerepelnek. */
export function unplacedFields(schema: IFieldSchema[], config: IFormConfig): IFieldSchema[] {
  const placed: Record<string, boolean> = {};
  config.sections.forEach((section) => {
    section.fields.forEach((placement) => {
      placed[placement.field] = true;
    });
  });
  return schema.filter((field) => !placed[field.InternalName]);
}

/** Alapértelmezett elrendezés: minden mező egy szekcióban, egy oszlopban. */
export function createDefaultConfig(listId: string, contentTypeId: string, schema: IFieldSchema[]): IFormConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    listId,
    contentTypeId,
    sections: [
      {
        id: 'default',
        columns: 1,
        fields: schema.map((field) => ({ field: field.InternalName }))
      }
    ],
    fields: {}
  };
}

const TODAY_TOKEN: string = '[today]';
const ISO_DATE: RegExp = /^\d{4}-\d{2}-\d{2}(T|$)/;

/**
 * Dátum mező kezdőértéke form-stringként. A forrás lehet `[today]`, ISO dátum (a SharePoint a rögzített
 * alapértelmezett dátumot így tárolja), vagy már a web formátumában megadott dátum.
 * `undefined`, ha az érték nem értelmezhető dátumként (például számított alapérték).
 */
export function resolveDateDefault(raw: string, culture: string, dateOnly: boolean, now: Date): string | undefined {
  const text: string = raw.trim();
  if (text.toLowerCase() === TODAY_TOKEN) {
    // Csak dátum mezőnél a mai nap; dátum + idő mezőnél a mostani időpont, az időválasztó lépésközére kerekítve.
    const today: Date = dateOnly ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : roundToTimeStep(now);
    return formatDateValue(today, culture, dateOnly);
  }
  if (ISO_DATE.test(text)) {
    const date: Date = new Date(text);
    return isNaN(date.getTime()) ? undefined : formatDateValue(date, culture, dateOnly);
  }
  const parsed: Date | undefined = parseDateValue(text, culture);
  return parsed ? formatDateValue(parsed, culture, dateOnly) : undefined;
}

/**
 * Kezdőértékek New módban: a konfig defaultValue-ja, ennek hiányában a séma DefaultValue-ja
 * (egyszerű típusoknál és dátumnál). A dátum a web kultúrája szerinti form-stringgé alakul.
 */
export function getInitialValues(
  schema: IFieldSchema[],
  config: IFormConfig,
  culture: string = 'en-US',
  now: Date = new Date()
): FormValues {
  const values: FormValues = {};
  schema.forEach((field) => {
    const configured: string | undefined = config.fields[field.InternalName]?.defaultValue;
    if (field.TypeAsString === 'DateTime') {
      const raw: string | undefined = configured ?? field.DefaultValue;
      const value: string | undefined = raw ? resolveDateDefault(raw, culture, field.DateOnly !== false, now) : undefined;
      if (value !== undefined) {
        values[field.InternalName] = value;
      }
    } else if (configured !== undefined) {
      values[field.InternalName] = configured;
    } else if (field.DefaultValue && (field.TypeAsString === 'Number' || field.TypeAsString === 'Currency')) {
      values[field.InternalName] = resolveNumberDefault(field.DefaultValue, culture, !!field.Percentage);
    } else if (field.DefaultValue && SCHEMA_DEFAULT_TYPES.indexOf(field.TypeAsString) !== -1) {
      values[field.InternalName] =
        field.TypeAsString === 'MultiChoice' ? joinMultiValue([field.DefaultValue]) : field.DefaultValue;
    }
  });
  return values;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseModes(value: unknown, path: string): FormMode[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((mode) => (FORM_MODES as unknown[]).indexOf(mode) === -1)) {
    throw new Error(format(engineStrings().InvalidModes, path));
  }
  return value as FormMode[];
}

function parseCondition<T>(value: unknown, path: string): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  const error: string | undefined = validateCondition(value, path);
  if (error) {
    throw new Error(error);
  }
  return value as T;
}

function parseSection(input: unknown, index: number): ISectionConfig {
  const path: string = `sections[${index}]`;
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  if (!Array.isArray(input.fields)) {
    throw new Error(format(engineStrings().MustBeArray, `${path}.fields`));
  }
  const fields: IFieldPlacement[] = input.fields.map((placement: unknown, i: number) => {
    if (!isRecord(placement) || typeof placement.field !== 'string' || placement.field === '') {
      throw new Error(format(engineStrings().MissingField, `${path}.fields[${i}]`));
    }
    const result: IFieldPlacement = { field: placement.field };
    if (typeof placement.colSpan === 'number') {
      result.colSpan = clampColumns(placement.colSpan);
    }
    return result;
  });

  const section: ISectionConfig = {
    id: typeof input.id === 'string' && input.id !== '' ? input.id : `section-${index + 1}`,
    columns: clampColumns(typeof input.columns === 'number' ? input.columns : 1),
    fields
  };
  const title: string | undefined = optionalString(input.title);
  const description: string | undefined = optionalString(input.description);
  const visibleIn: FormMode[] | undefined = parseModes(input.visibleIn, `${path}.visibleIn`);
  const visibleWhen = parseCondition<ISectionConfig['visibleWhen']>(input.visibleWhen, `${path}.visibleWhen`);
  if (title !== undefined) section.title = title;
  if (description !== undefined) section.description = description;
  if (input.collapsible === true) section.collapsible = true;
  if (input.collapsed === true) section.collapsed = true;
  if (visibleIn) section.visibleIn = visibleIn;
  if (visibleWhen) section.visibleWhen = visibleWhen;
  const style = parseSectionStyles(input.style, `${path}.style`);
  if (style) section.style = style;
  const related = parseRelated(input.related, `${path}.related`);
  if (related) section.related = related;
  return section;
}

function parseFieldConfig(input: unknown, name: string): IFieldConfig {
  const path: string = `fields.${name}`;
  if (!isRecord(input)) {
    throw new Error(format(engineStrings().MustBeObject, path));
  }
  const field: IFieldConfig = {};
  const label: string | undefined = optionalString(input.label);
  const description: string | undefined = optionalString(input.description);
  const placeholder: string | undefined = optionalString(input.placeholder);
  const defaultValue: string | undefined = optionalString(input.defaultValue);
  const visibleIn: FormMode[] | undefined = parseModes(input.visibleIn, `${path}.visibleIn`);
  const readOnlyIn: FormMode[] | undefined = parseModes(input.readOnlyIn, `${path}.readOnlyIn`);
  const requiredIn: FormMode[] | undefined = parseModes(input.requiredIn, `${path}.requiredIn`);
  const visibleWhen = parseCondition<IFieldConfig['visibleWhen']>(input.visibleWhen, `${path}.visibleWhen`);
  const readOnlyWhen = parseCondition<IFieldConfig['readOnlyWhen']>(input.readOnlyWhen, `${path}.readOnlyWhen`);
  const requiredWhen = parseCondition<IFieldConfig['requiredWhen']>(input.requiredWhen, `${path}.requiredWhen`);
  if (label !== undefined) field.label = label;
  if (description !== undefined) field.description = description;
  if (placeholder !== undefined) field.placeholder = placeholder;
  if (defaultValue !== undefined) field.defaultValue = defaultValue;
  if (input.lookupDisplay !== undefined) {
    if (LOOKUP_DISPLAYS.indexOf(input.lookupDisplay as LookupDisplay) === -1) {
      throw new Error(format(engineStrings().InvalidOption, `${path}.lookupDisplay`, LOOKUP_DISPLAYS.join(', ')));
    }
    // Az alapértelmezést nem tároljuk.
    if (input.lookupDisplay !== 'auto') field.lookupDisplay = input.lookupDisplay as LookupDisplay;
  }
  if (visibleIn) field.visibleIn = visibleIn;
  if (readOnlyIn) field.readOnlyIn = readOnlyIn;
  if (requiredIn) field.requiredIn = requiredIn;
  if (visibleWhen) field.visibleWhen = visibleWhen;
  if (readOnlyWhen) field.readOnlyWhen = readOnlyWhen;
  if (requiredWhen) field.requiredWhen = requiredWhen;
  const style = parseFieldStyles(input.style, `${path}.style`);
  if (style) field.style = style;
  return field;
}

/**
 * A tárolt JSON értelmezése és ellenőrzése. Hibás tartalomra nem dob, hanem `error`-t ad vissza;
 * a hívó ilyenkor az alapértelmezett elrendezést használja.
 */
export function parseConfig(raw: string): IParseConfigResult {
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    return { error: format(engineStrings().InvalidJson, e instanceof Error ? e.message : String(e)) };
  }
  if (!isRecord(input)) {
    return { error: engineStrings().RootMustBeObject };
  }

  // Migráció: régebbi schemaVersion esetén itt kell az `input`-ot az aktuális szerkezetre alakítani.
  if (input.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    return { error: format(engineStrings().UnknownSchemaVersion, String(input.schemaVersion)) };
  }

  try {
    if (!Array.isArray(input.sections)) {
      throw new Error(format(engineStrings().MustBeArray, 'sections'));
    }
    if (input.fields !== undefined && !isRecord(input.fields)) {
      throw new Error(format(engineStrings().MustBeObject, 'fields'));
    }
    const sections: ISectionConfig[] = input.sections.map(parseSection);
    const usedIds: Record<string, boolean> = {};
    sections.forEach((section) => {
      if (usedIds[section.id]) {
        throw new Error(format(engineStrings().DuplicateSectionId, section.id));
      }
      usedIds[section.id] = true;
    });

    const fields: Record<string, IFieldConfig> = {};
    const rawFields: Record<string, unknown> = input.fields ?? {};
    Object.keys(rawFields).forEach((name) => {
      fields[name] = parseFieldConfig(rawFields[name], name);
    });

    const config: IFormConfig = {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      listId: optionalString(input.listId) ?? '',
      contentTypeId: optionalString(input.contentTypeId) ?? '',
      sections,
      fields
    };
    const title: string | undefined = optionalString(input.title);
    if (title !== undefined) config.title = title;
    if (input.labelPosition === 'top' || input.labelPosition === 'left') config.labelPosition = input.labelPosition;
    const style = parseFormStyles(input.style, 'style');
    if (style) config.style = style;
    return { config };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
