// JSON alapú feladat: a felugró ablak mezőit a feladat kérés-oszlopának JSON-ja (pl. RequestJSON) írja le, a kitöltött
// értékek ugyanebben a szerkezetben a válasz-oszlopba (pl. ResponseJSON) kerülnek. Ha a válasz már ki van töltve, az
// ablak azt mutatja. A JSON ismeretlen részei (pl. taskType, a mezők további tulajdonságai) változatlanul visszaíródnak.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

/** A JSON-ban leírt mező típusa (a `type` értékéből; az ismeretlen típus szövegként jelenik meg). */
export type TaskJsonFieldType = 'yesno' | 'text' | 'multiline' | 'number' | 'date' | 'choice';

/** Az igen / nem mező értéke a JSON-ban. */
export const TASK_JSON_YES: string = 'yes';
export const TASK_JSON_NO: string = 'no';

export interface ITaskJsonOption {
  value: string;
  label: string;
}

export interface ITaskJsonField {
  name: string;
  label: string;
  type: TaskJsonFieldType;
  required: boolean;
  /** A kezdőérték szövegként (igen / nem mezőnél `yes`, `no` vagy üres; dátumnál `ÉÉÉÉ-HH-NN` vagy üres). */
  value: string;
  /** Választható értékek (`choice`). */
  options: ITaskJsonOption[];
  /** A mező helye a JSON `fields` tömbjében (a visszaíráshoz). */
  index: number;
}

export interface ITaskJsonForm {
  fields: ITaskJsonField[];
  /** Az eredeti JSON objektum (a visszaíráshoz, a nem ismert részekkel együtt). */
  raw: Record<string, unknown>;
}

/** A mezők hibái név szerint: `required` (kötelező, de üres) vagy `number` (nem szám). */
export type TaskJsonErrors = Record<string, 'required' | 'number'>;

const ISO_DATE: RegExp = /^(\d{4})-(\d{2})-(\d{2})/;
const NUMBER: RegExp = /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeType(value: unknown): TaskJsonFieldType {
  const type: string = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (type === 'yes/no' || type === 'yesno' || type === 'boolean' || type === 'bool') {
    return 'yesno';
  }
  return type === 'multiline' || type === 'number' || type === 'date' || type === 'choice' ? type : 'text';
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

/** Az igen / nem érték egységesítése (`true`, `igen`, `1` … → `yes`). */
function normalizeYesNo(value: unknown): string {
  const text: string = toText(value).trim().toLowerCase();
  if (text === 'yes' || text === 'true' || text === 'igen' || text === '1') {
    return TASK_JSON_YES;
  }
  return text === 'no' || text === 'false' || text === 'nem' || text === '0' ? TASK_JSON_NO : '';
}

function normalizeDate(value: unknown): string {
  const match: RegExpExecArray | null = ISO_DATE.exec(toText(value).trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function parseOptions(value: unknown): ITaskJsonOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const options: ITaskJsonOption[] = [];
  value.forEach((item: unknown) => {
    if (isRecord(item)) {
      const optionValue: string = toText(item.value ?? item.key);
      if (optionValue !== '') {
        options.push({ value: optionValue, label: toText(item.label ?? item.text) || optionValue });
      }
    } else {
      const text: string = toText(item);
      if (text !== '') {
        options.push({ value: text, label: text });
      }
    }
  });
  return options;
}

/** A kérés vagy a válasz JSON-jának értelmezése; üres vagy hibás szövegnél (vagy `fields` tömb nélkül) `undefined`. */
export function parseTaskJson(text: string | undefined): ITaskJsonForm | undefined {
  if (!text || text.trim() === '') {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(raw) || !Array.isArray(raw.fields)) {
    return undefined;
  }
  const fields: ITaskJsonField[] = [];
  raw.fields.forEach((item: unknown, index: number) => {
    if (!isRecord(item) || typeof item.name !== 'string' || item.name === '' || fields.some((field) => field.name === item.name)) {
      return;
    }
    const type: TaskJsonFieldType = normalizeType(item.type);
    fields.push({
      name: item.name,
      label: toText(item.label) || item.name,
      type,
      required: item.required === true || item.required === 'true',
      value: type === 'yesno' ? normalizeYesNo(item.value) : type === 'date' ? normalizeDate(item.value) : toText(item.value),
      options: parseOptions(item.options),
      index
    });
  });
  return { fields, raw };
}

/** A felugró ablak forrása: a kitöltött (értelmezhető) válasz, ennek hiányában a kérés. */
export function pickTaskJsonForm(requestText: string | undefined, responseText: string | undefined): ITaskJsonForm | undefined {
  return parseTaskJson(responseText) ?? parseTaskJson(requestText);
}

/** A mezők kezdőértékei név szerint. */
export function taskJsonValues(form: ITaskJsonForm): Record<string, string> {
  const values: Record<string, string> = {};
  form.fields.forEach((field) => {
    values[field.name] = field.value;
  });
  return values;
}

/** A kitöltés ellenőrzése: a kötelező mező nem lehet üres, a szám mező csak számot tartalmazhat. */
export function validateTaskJson(form: ITaskJsonForm, values: Record<string, string>): TaskJsonErrors {
  const errors: TaskJsonErrors = {};
  form.fields.forEach((field) => {
    const value: string = (values[field.name] ?? '').trim();
    if (value === '') {
      if (field.required) {
        errors[field.name] = 'required';
      }
    } else if (field.type === 'number' && !NUMBER.test(value)) {
      errors[field.name] = 'number';
    }
  });
  return errors;
}

/**
 * A válasz JSON: az eredeti JSON a kitöltött `value` értékekkel. A szám tizedesjele pont lesz, a többi érték szövegként
 * kerül be; a JSON többi része (és a nem értelmezett mezők) változatlan marad.
 */
export function buildTaskJsonResponse(form: ITaskJsonForm, values: Record<string, string>): string {
  const rawFields: unknown[] = Array.isArray(form.raw.fields) ? form.raw.fields : [];
  const fields: unknown[] = rawFields.map((item: unknown, index: number) => {
    const field: ITaskJsonField | undefined = form.fields.filter((candidate) => candidate.index === index)[0];
    if (!field || !isRecord(item)) {
      return item;
    }
    const value: string = (values[field.name] ?? '').trim();
    return { ...item, value: field.type === 'number' ? value.replace(',', '.') : field.type === 'multiline' ? values[field.name] ?? '' : value };
  });
  return JSON.stringify({ ...form.raw, fields });
}
