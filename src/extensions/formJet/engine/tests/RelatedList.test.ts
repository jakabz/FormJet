import { IFormConfig, IRelatedListConfig } from '../../models/IFormConfig';
import { parseConfig, resolveForm } from '../LayoutResolver';
import { buildRelatedViewXml, getRowLimit, isRelatedComplete, normalizeMatchValue } from '../RelatedList';
import { configJson, sampleSchema } from './helpers';

const LIST_ID: string = '11111111-1111-1111-1111-111111111111';
const related: IRelatedListConfig = {
  listId: LIST_ID,
  matchField: 'RequestNumber',
  sourceField: 'Title',
  columns: ['Title', 'InvoiceDate', 'Amount'],
  sortField: 'InvoiceDate',
  sortAscending: false,
  rowLimit: 20
};

function parseRelatedSection(config: unknown, fields: unknown[] = []): ReturnType<typeof parseConfig> {
  return parseConfig(configJson({ sections: [{ id: 's', columns: 1, fields, related: config }] }));
}

describe('RelatedList', () => {
  describe('buildRelatedViewXml', () => {
    it('szöveges párosítás: az érték XML-ben biztonságosan szerepel', () => {
      const xml = buildRelatedViewXml(related, 'Text', "IG-2026/001 <A&B> 'x'") as string;
      expect(xml).toContain("<Value Type='Text'>IG-2026/001 &lt;A&amp;B&gt; &apos;x&apos;</Value>");
      expect(xml).toContain("<FieldRef Name='InvoiceDate' Ascending='FALSE'/>");
      expect(xml).toContain("<FieldRef Name='ID'/><FieldRef Name='Title'/>");
      // Eggyel több sort kérünk, hogy kiderüljön, van-e még.
      expect(xml).toContain('<RowLimit>21</RowLimit>');
    });

    it('szám: a form-string számmá alakul; alapértelmezett rendezés és sorkorlát', () => {
      const xml = buildRelatedViewXml({ ...related, sortField: undefined, sortAscending: undefined, rowLimit: undefined }, 'Number', '1 234') as string;
      expect(xml).toContain("<Value Type='Number'>1234</Value>");
      expect(xml).toContain("Name='ID' Ascending='TRUE'");
      expect(xml).toContain('<RowLimit>31</RowLimit>');
    });

    it('keresőmező: a hivatkozott elem azonosítója szerint', () => {
      expect(buildRelatedViewXml(related, 'Lookup', '42')).toContain("LookupId='TRUE'/><Value Type='Lookup'>42</Value>");
    });

    it('nincs lekérdezés üres vagy nem értelmezhető párosító értékre, illetve nem támogatott típusra', () => {
      expect(buildRelatedViewXml(related, 'Text', '  ')).toBeUndefined();
      expect(buildRelatedViewXml(related, 'Text', undefined)).toBeUndefined();
      expect(buildRelatedViewXml(related, 'Number', 'abc')).toBeUndefined();
      expect(buildRelatedViewXml(related, 'Counter', '1,5')).toBeUndefined();
      expect(buildRelatedViewXml(related, 'Note', 'x')).toBeUndefined();
    });

    it('nem belső névnek megfelelő mezőnév nem kerülhet a lekérdezésbe', () => {
      expect(buildRelatedViewXml({ ...related, columns: ["Title'/><x"] }, 'Text', 'a')).toBeUndefined();
      expect(buildRelatedViewXml({ ...related, matchField: 'A B' }, 'Text', 'a')).toBeUndefined();
    });
  });

  it('normalizeMatchValue', () => {
    expect(normalizeMatchValue('Number', '1 234')).toBe('1234');
    expect(normalizeMatchValue('Number', '1234,5')).toBe('1234.5');
    expect(normalizeMatchValue('Counter', '40')).toBe('40');
    expect(normalizeMatchValue('Text', '  abc ')).toBe('abc');
  });

  it('isRelatedComplete / getRowLimit', () => {
    expect(isRelatedComplete(related)).toBe(true);
    expect(isRelatedComplete({ ...related, columns: [] })).toBe(false);
    expect(isRelatedComplete({ ...related, listId: '' })).toBe(false);
    expect(isRelatedComplete(undefined)).toBe(false);
    expect(getRowLimit(related)).toBe(20);
    expect(getRowLimit({ ...related, rowLimit: undefined })).toBe(30);
  });

  describe('ellenőrzés a parseConfig-ban', () => {
    it('hibás beállítás elutasítva, a hiba útvonallal jön', () => {
      expect(parseRelatedSection({ listId: 'Szamlak', matchField: 'A', columns: ['B'] }).error).toContain('sections[0].related.listId');
      expect(parseRelatedSection({ listId: '', matchField: "A'/><Or>", columns: [] }).error).toContain('matchField');
      expect(parseRelatedSection({ listId: '', matchField: 'A', columns: ['B C'] }).error).toContain('columns[0]');
      expect(parseRelatedSection({ listId: '', matchField: 'A', columns: ['B'], rowLimit: 5000 }).error).toContain('rowLimit');
      expect(parseRelatedSection({ listId: '', matchField: 'A', columns: 'B' }).error).toBeDefined();
      expect(parseRelatedSection('x').error).toBeDefined();
    });

    it('normalizálás: kisbetűs listaazonosító, ismétlődő oszlop egyszer, ismeretlen kulcs kimarad', () => {
      const config = parseRelatedSection({
        listId: 'AAAAAAAA-1111-1111-1111-111111111111',
        matchField: 'A',
        sourceField: 'Title',
        columns: ['B', 'B', 'C'],
        showNewButton: true,
        extra: 1
      }).config as IFormConfig;
      expect(config.sections[0].related).toEqual({
        listId: 'aaaaaaaa-1111-1111-1111-111111111111',
        matchField: 'A',
        sourceField: 'Title',
        columns: ['B', 'C'],
        showNewButton: true
      });
    });

    it('félkész beállítás menthető; mezők nélkül a szekció rejtett, mezőkkel látszik', () => {
      const schema = sampleSchema();
      const onlyRelated = parseRelatedSection({ listId: '', matchField: '', columns: [] }).config as IFormConfig;
      expect(onlyRelated.sections[0].related?.sourceField).toBe('ID');
      expect(resolveForm(schema, onlyRelated, 'edit', {}).sections[0].visible).toBe(false);
      const withFields = parseRelatedSection({ listId: '', matchField: '', columns: [] }, [{ field: 'Title' }]).config as IFormConfig;
      expect(resolveForm(schema, withFields, 'edit', {}).sections[0].visible).toBe(true);
    });

    it('kapcsolódó elemek nélküli szekció változatlan', () => {
      expect((parseRelatedSection(undefined, [{ field: 'Title' }]).config as IFormConfig).sections[0].related).toBeUndefined();
    });
  });
});
