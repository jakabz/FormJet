// A tartalomtípus mezői, és a tartalomtípus feloldása New módban.

import * as strings from 'FormJetFormCustomizerStrings';

import { IFieldSchema } from '../models/IFieldSchema';
import { getSP } from './sp';

/** Mezők, amelyeket a form nem kezel mezőként. */
const EXCLUDED_FIELDS: string[] = ['ContentType', 'Attachments'];

const FOLDER_CONTENT_TYPE_PREFIX: string = '0x0120';

interface IRawField {
  InternalName: string;
  Title: string;
  TypeAsString: string;
  Required?: boolean;
  ReadOnlyField?: boolean;
  Hidden?: boolean;
  Description?: string;
  DefaultValue?: string | null; // eslint-disable-line @rushstack/no-new-null
  Choices?: unknown;
  FillInChoice?: boolean;
  MaxLength?: number;
  RichText?: boolean;
  NumberOfLines?: number;
  /** DateTime mezőnél: 0 = csak dátum, 1 = dátum és idő. */
  DisplayFormat?: number;
}

/** A `Choices` REST verziótól függően tömb vagy `{ results: [] }`. */
export function normalizeChoices(choices: unknown): string[] | undefined {
  if (Array.isArray(choices)) {
    return choices.map(String);
  }
  const results: unknown = (choices as { results?: unknown } | undefined)?.results;
  return Array.isArray(results) ? results.map(String) : undefined;
}

export async function resolveContentTypeId(listId: string, contentTypeId: string | undefined): Promise<string> {
  if (contentTypeId) {
    return contentTypeId;
  }
  const contentTypes = (await getSP().web.lists.getById(listId).contentTypes.select('StringId')()) as Array<{
    StringId: string;
  }>;
  const first = contentTypes.find((ct) => ct.StringId.indexOf(FOLDER_CONTENT_TYPE_PREFIX) !== 0);
  if (!first) {
    throw new Error(strings.NoContentType);
  }
  return first.StringId;
}

export async function getFields(listId: string, contentTypeId: string): Promise<IFieldSchema[]> {
  const raw = (await getSP()
    .web.lists.getById(listId)
    .contentTypes.getById(contentTypeId)
    .fields.filter('Hidden eq false')()) as IRawField[];

  return raw
    .filter((field) => !field.Hidden && EXCLUDED_FIELDS.indexOf(field.InternalName) === -1)
    .map((field) => ({
      InternalName: field.InternalName,
      Title: field.Title,
      TypeAsString: field.TypeAsString,
      Required: !!field.Required,
      ReadOnlyField: !!field.ReadOnlyField,
      Description: field.Description || undefined,
      DefaultValue: field.DefaultValue || undefined,
      Choices: normalizeChoices(field.Choices),
      FillInChoice: field.FillInChoice,
      MaxLength: field.MaxLength,
      RichText: field.RichText,
      NumberOfLines: field.NumberOfLines,
      DateOnly: field.TypeAsString === 'DateTime' ? field.DisplayFormat !== 1 : undefined
    }));
}
