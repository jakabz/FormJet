// Elem olvasása (FieldValuesForEdit / FieldValuesAsText) és mentése (validateUpdateListItem).
// Minden érték form-string formátumú; ne válts típusonkénti REST payloadra.

import { IListItemFormUpdateValue } from '@pnp/sp/lists';
import * as strings from 'FormJetFormCustomizerStrings';

import { serializeLookupValue } from '../engine/LookupValue';
import { serializeUrlValue } from '../engine/UrlValue';
import { FieldErrors, FormValues } from '../models/IFieldSchema';
import { getSP } from './sp';

export interface IItemData {
  /** FieldValuesForEdit: form-string értékek, ezeket írjuk vissza. */
  values: FormValues;
  /** FieldValuesAsText: megjelenítésre szánt szöveg. */
  displayValues: FormValues;
  /** Az ütközésvizsgálat alapja. */
  modified: string;
  contentTypeId?: string;
}

export interface ISaveTarget {
  listId: string;
  /** Hiányában új elem készül. */
  itemId?: number;
  /** Új elemnél a tartalomtípus. */
  contentTypeId?: string;
  /** Új elemnél a célmappa szerverrelatív útvonala (alapesetben a lista gyökere). */
  folderPath?: string;
}

export interface ISaveResult {
  itemId?: number;
  /** Mezőnkénti szerveroldali hibák. Ha nem üres, a mentés nem történt meg. */
  errors: FieldErrors;
}

/** A REST válasz kulcsaiban az `_` karakter `_x005f_`-ként jön; ez alakítja vissza. */
export function decodeKeys(input: Record<string, unknown>): FormValues {
  const result: FormValues = {};
  Object.keys(input).forEach((key) => {
    if (key.indexOf('odata.') === 0 || key === '__metadata') {
      return;
    }
    const value: unknown = input[key];
    result[key.replace(/_x005f_/g, '_')] = value === null || value === undefined ? '' : String(value);
  });
  return result;
}

export async function load(listId: string, itemId: number): Promise<IItemData> {
  const item = getSP().web.lists.getById(listId).items.getById(itemId);
  const [meta, forEdit, asText] = await Promise.all([
    item.select('Id', 'Modified', 'ContentTypeId')() as Promise<{ Modified: string; ContentTypeId?: string }>,
    item.fieldValuesForEdit() as Promise<Record<string, unknown>>,
    item.fieldValuesAsText() as Promise<Record<string, unknown>>
  ]);
  return {
    values: decodeKeys(forEdit),
    displayValues: decodeKeys(asText),
    modified: meta.Modified,
    contentTypeId: meta.ContentTypeId
  };
}

interface IUserInfo {
  Name?: string;
  Title?: string;
  EMail?: string | null; // eslint-disable-line @rushstack/no-new-null
}

/** Egy lekérdezésben legfeljebb ennyi személy mezőt bontunk ki (a SharePoint korlátozza a kibontott mezők számát). */
const USER_FIELDS_PER_REQUEST: number = 8;

function toUserFormString(value: unknown): string {
  const users: IUserInfo[] = Array.isArray(value) ? (value as IUserInfo[]) : value ? [value as IUserInfo] : [];
  const entries = users
    .filter((user) => !!user && !!user.Name)
    .map((user) => ({ Key: user.Name, DisplayText: user.Title || user.Name, EntityData: { Email: user.EMail || '' } }));
  return entries.length > 0 ? JSON.stringify(entries) : '';
}

/**
 * A személy mezők értéke form-stringként (JSON tömb, `Key` = bejelentkezési név, csoportnál a csoport neve).
 * A FieldValuesForEdit ezeknél a mezőknél nem ad megbízhatóan visszaírható értéket, ezért külön kérdezzük le.
 * Sikertelen lekérdezésnél az adott mezők kimaradnak, és a FieldValuesForEdit értéke marad érvényben.
 */
export async function loadUserValues(listId: string, itemId: number, fieldNames: string[]): Promise<FormValues> {
  const item = getSP().web.lists.getById(listId).items.getById(itemId);
  const result: FormValues = {};
  const requests: Array<Promise<void>> = [];
  for (let start: number = 0; start < fieldNames.length; start += USER_FIELDS_PER_REQUEST) {
    const names: string[] = fieldNames.slice(start, start + USER_FIELDS_PER_REQUEST);
    const selects: string[] = [];
    names.forEach((name) => selects.push(`${name}/Name`, `${name}/Title`, `${name}/EMail`));
    requests.push(
      (item.select(...selects).expand(...names)() as Promise<Record<string, unknown>>)
        .then((data) => {
          names.forEach((name) => {
            result[name] = toUserFormString(data[name]);
          });
        })
        .catch(() => undefined)
    );
  }
  await Promise.all(requests);
  return result;
}

export interface ILookupFieldRef {
  name: string;
  multiple: boolean;
}

function toLookupIds(value: unknown): number[] {
  const raw: unknown = (value as { results?: unknown } | undefined)?.results ?? value;
  const list: unknown[] = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return list.map(Number).filter((id) => id > 0);
}

/**
 * A keresőmezők értéke form-stringként, a hivatkozott elemek azonosítójából (`<mező>Id`).
 * Sikertelen lekérdezésnél az adott mezők kimaradnak, és a FieldValuesForEdit értéke marad érvényben.
 */
export async function loadLookupValues(listId: string, itemId: number, fields: ILookupFieldRef[]): Promise<FormValues> {
  const item = getSP().web.lists.getById(listId).items.getById(itemId);
  const result: FormValues = {};
  try {
    const data = (await item.select(...fields.map((field) => `${field.name}Id`))()) as Record<string, unknown>;
    fields.forEach((field) => {
      result[field.name] = serializeLookupValue(toLookupIds(data[`${field.name}Id`]), field.multiple);
    });
  } catch {
    // Marad a FieldValuesForEdit értéke.
  }
  return result;
}

/**
 * A hivatkozás (URL) mezők értéke form-stringként, a mező `Url` és `Description` részéből.
 * Sikertelen lekérdezésnél az adott mezők kimaradnak, és a FieldValuesForEdit értéke marad érvényben.
 */
export async function loadUrlValues(listId: string, itemId: number, fieldNames: string[]): Promise<FormValues> {
  const item = getSP().web.lists.getById(listId).items.getById(itemId);
  const result: FormValues = {};
  try {
    const data = (await item.select(...fieldNames)()) as Record<string, unknown>;
    fieldNames.forEach((name) => {
      const value = data[name] as { Url?: string; Description?: string } | null | undefined;
      result[name] = serializeUrlValue({ url: value?.Url ?? '', description: value?.Description ?? '' });
    });
  } catch {
    // Marad a FieldValuesForEdit értéke.
  }
  return result;
}

export async function getModified(listId: string, itemId: number): Promise<string> {
  const meta = (await getSP().web.lists.getById(listId).items.getById(itemId).select('Modified')()) as {
    Modified: string;
  };
  return meta.Modified;
}

/**
 * Mentés. A `changed` csak a látható, szerkeszthető és módosult mezőket tartalmazhatja;
 * ezt a hívó (FormHost.save) biztosítja.
 */
export async function save(target: ISaveTarget, changed: FormValues): Promise<ISaveResult> {
  const formValues: IListItemFormUpdateValue[] = Object.keys(changed).map((name) => ({
    FieldName: name,
    FieldValue: changed[name]
  }));
  const list = getSP().web.lists.getById(target.listId);

  let results: IListItemFormUpdateValue[];
  if (target.itemId !== undefined) {
    results = await list.items.getById(target.itemId).validateUpdateListItem(formValues);
  } else {
    if (target.contentTypeId) {
      formValues.push({ FieldName: 'ContentTypeId', FieldValue: target.contentTypeId });
    }
    results = await list.addValidateUpdateItemUsingPath(formValues, target.folderPath ?? '');
  }

  const errors: FieldErrors = {};
  let itemId: number | undefined = target.itemId;
  results.forEach((result) => {
    if (result.HasException && result.FieldName) {
      errors[result.FieldName] = result.ErrorMessage || strings.UnknownError;
    }
    if (itemId === undefined) {
      if (result.ItemId) {
        itemId = result.ItemId;
      } else if (result.FieldName === 'Id' && result.FieldValue) {
        itemId = parseInt(result.FieldValue, 10);
      }
    }
  });
  return { itemId, errors };
}
