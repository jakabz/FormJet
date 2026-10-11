// Közös segédfüggvények a motor egységtesztjeihez.

import { IFieldSchema } from '../../models/IFieldSchema';
import { IFormConfig } from '../../models/IFormConfig';
import { flattenFields, IResolvedField, IResolvedForm, parseConfig } from '../LayoutResolver';

// A tesztek Node alatt futnak; a fájlrendszert a példa konfiguráció beolvasásához használjuk.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs: { readFileSync(path: string, encoding: string): string } = require('fs');

/** Mezőséma a tesztekhez; a nem megadott tulajdonságok alapértéket kapnak. */
export function field(name: string, type: string, extra: Partial<IFieldSchema> = {}): IFieldSchema {
  return { InternalName: name, Title: name, TypeAsString: type, Required: false, ReadOnlyField: false, ...extra };
}

/** A samples/config-example.json mezőinek megfelelő séma. */
export function sampleSchema(): IFieldSchema[] {
  return [
    field('Title', 'Text', { Required: true }),
    field('Category', 'Choice', { Choices: ['Irodaszer', 'Informatika'] }),
    field('Amount', 'Currency'),
    field('NeededBy', 'DateTime'),
    field('Urgent', 'Boolean'),
    field('Justification', 'Note'),
    field('Approver', 'User'),
    field('ApprovalStatus', 'Choice'),
    field('ApprovalComment', 'Note')
  ];
}

/** A példa konfiguráció nyers szövege. A tesztek a projekt gyökeréből futnak. */
export function readSampleConfig(): string {
  return fs.readFileSync('samples/config-example.json', 'utf8');
}

export function loadSampleConfig(): IFormConfig {
  const result = parseConfig(readSampleConfig());
  if (!result.config) {
    throw new Error(`A példa konfiguráció hibás: ${result.error}`);
  }
  return result.config;
}

/** Minimális, érvényes konfiguráció szövege a megadott részekkel kiegészítve. */
export function configJson(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    listId: '',
    contentTypeId: '',
    sections: [{ id: 's', columns: 1, fields: [] }],
    fields: {},
    ...patch
  });
}

export function getField(form: IResolvedForm, name: string): IResolvedField {
  const found: IResolvedField | undefined = flattenFields(form).filter((item) => item.name === name)[0];
  if (!found) {
    throw new Error(`Nincs ilyen mező a feloldott formon: ${name}`);
  }
  return found;
}
