// Séma + konfiguráció + mód + értékek → megjelenítendő form.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import {
  CONFIG_SCHEMA_VERSION,
  FORM_MODES,
  FormMode,
  IFieldConfig,
  IFieldPlacement,
  IFormConfig,
  ISectionConfig
} from '../models/IFormConfig';
import { FormValues, IFieldSchema } from '../models/IFieldSchema';
import { evaluate, joinMultiValue, validateCondition } from './ConditionEngine';

/** Mezőtípusok, amelyekhez a FieldRenderer szerkesztő vezérlőt ad. A többi csak olvasható. */
const EDITABLE_TYPES: string[] = ['Text', 'Note', 'Number', 'Currency', 'Choice', 'MultiChoice', 'Boolean', 'DateTime'];

/** Típusok, amelyeknél a séma DefaultValue-ja New módban kezdőértékként használható. */
const SCHEMA_DEFAULT_TYPES: string[] = ['Text', 'Note', 'Number', 'Currency', 'Choice', 'MultiChoice', 'Boolean'];

const MAX_COLUMNS: number = 4;

export interface IResolvedField {
  name: string;
  schema: IFieldSchema;
  label: string;
  description?: string;
  placeholder?: string;
  colSpan: number;
  /** A szekció láthatóságát is tartalmazza. */
  visible: boolean;
  readOnly: boolean;
  required: boolean;
}

export interface IResolvedSection {
  id: string;
  title?: string;
  description?: string;
  columns: number;
  collapsible: boolean;
  collapsed: boolean;
  visible: boolean;
  fields: IResolvedField[];
}

export interface IResolvedForm {
  title?: string;
  labelPosition: 'top' | 'left';
  sections: IResolvedSection[];
  /** A konfigurációban szereplő, de a sémában nem létező mezők. */
  missingFields: string[];
}

export interface IParseConfigResult {
  config?: IFormConfig;
  error?: string;
}

/** Van-e szerkesztő vezérlő a mezőhöz. A rich text Note értéke HTML, ezért csak olvasható. */
export function isEditableField(schema: IFieldSchema): boolean {
  if (schema.ReadOnlyField) {
    return false;
  }
  if (schema.TypeAsString === 'Note' && schema.RichText) {
    return false;
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
    const sectionVisible: boolean = inMode(section.visibleIn, mode, true) && evaluate(section.visibleWhen, values);
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
        colSpan: Math.min(clampColumns(placement.colSpan), columns),
        visible,
        readOnly,
        required
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
      fields
    };
  });

  return {
    title: config.title,
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

/** Kezdőértékek New módban: a konfig defaultValue-ja, ennek hiányában egyszerű típusoknál a séma DefaultValue-ja. */
export function getInitialValues(schema: IFieldSchema[], config: IFormConfig): FormValues {
  const values: FormValues = {};
  schema.forEach((field) => {
    const configured: string | undefined = config.fields[field.InternalName]?.defaultValue;
    if (configured !== undefined) {
      values[field.InternalName] = configured;
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
    throw new Error(`${path}: a megengedett értékek: new, edit, display.`);
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
    throw new Error(`${path}: objektumnak kell lennie.`);
  }
  if (!Array.isArray(input.fields)) {
    throw new Error(`${path}.fields: tömbnek kell lennie.`);
  }
  const fields: IFieldPlacement[] = input.fields.map((placement: unknown, i: number) => {
    if (!isRecord(placement) || typeof placement.field !== 'string' || placement.field === '') {
      throw new Error(`${path}.fields[${i}]: hiányzik a "field" (a mező InternalName-je).`);
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
  return section;
}

function parseFieldConfig(input: unknown, name: string): IFieldConfig {
  const path: string = `fields.${name}`;
  if (!isRecord(input)) {
    throw new Error(`${path}: objektumnak kell lennie.`);
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
  if (visibleIn) field.visibleIn = visibleIn;
  if (readOnlyIn) field.readOnlyIn = readOnlyIn;
  if (requiredIn) field.requiredIn = requiredIn;
  if (visibleWhen) field.visibleWhen = visibleWhen;
  if (readOnlyWhen) field.readOnlyWhen = readOnlyWhen;
  if (requiredWhen) field.requiredWhen = requiredWhen;
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
    return { error: `Hibás JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isRecord(input)) {
    return { error: 'A konfiguráció gyökere objektum kell legyen.' };
  }

  // Migráció: régebbi schemaVersion esetén itt kell az `input`-ot az aktuális szerkezetre alakítani.
  if (input.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    return { error: `Ismeretlen sémaverzió: ${String(input.schemaVersion)}.` };
  }

  try {
    if (!Array.isArray(input.sections)) {
      throw new Error('sections: tömbnek kell lennie.');
    }
    if (input.fields !== undefined && !isRecord(input.fields)) {
      throw new Error('fields: objektumnak kell lennie.');
    }
    const sections: ISectionConfig[] = input.sections.map(parseSection);
    const usedIds: Record<string, boolean> = {};
    sections.forEach((section) => {
      if (usedIds[section.id]) {
        throw new Error(`A szekció azonosítója nem egyedi: ${section.id}.`);
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
    return { config };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
