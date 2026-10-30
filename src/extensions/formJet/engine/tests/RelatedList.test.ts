import { IFormConfig, IRelatedListConfig, IRelatedTaskConfig } from '../../models/IFormConfig';
import { collectGroupIds } from '../ConditionContext';
import { parseConfig, resolveForm } from '../LayoutResolver';
import {
  buildAssignedViewXml,
  buildRelatedViewXml,
  getRowLimit,
  isRelatedComplete,
  isTaskEnabled,
  isTaskOpenable,
  normalizeMatchValue,
  noteToPlainText,
  pickTaskButtons,
  taskConditionValues
} from '../RelatedList';
import { addTextElement, isRelatedElement } from '../TextElement';
import { configJson, getField, sampleSchema } from './helpers';

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
  it('noteToPlainText: a rich text HTML sima szöveggé válik, a sima szöveg változatlan', () => {
    expect(noteToPlainText('Első sor\nMásodik <b nélkül')).toBe('Első sor\nMásodik <b nélkül');
    expect(
      noteToPlainText('<div class="ExternalClassA"><p>Szia&nbsp;&amp; üdv<br>két sor</p><p>&lt;tag&gt; &#233; &#x151;</p><script>x</script></div>')
    ).toBe('Szia & üdv\nkét sor\n<tag> é ő\nx');
    expect(noteToPlainText('<p></p>')).toBe('');
  });

  describe('buildRelatedViewXml', () => {
    it('szöveges párosítás: az érték XML-ben biztonságosan szerepel', () => {
      const xml = buildRelatedViewXml(related, 'Text', "IG-2026/001 <A&B> 'x'") as string;
      expect(xml).toContain("<Value Type='Text'>IG-2026/001 &lt;A&amp;B&gt; &apos;x&apos;</Value>");
      expect(xml).toContain("<FieldRef Name='InvoiceDate' Ascending='FALSE'/>");
      expect(xml).toContain("<FieldRef Name='ID'/><FieldRef Name='Title'/>");
      // Eggyel több sort kérünk, hogy kiderüljön, van-e még.
      expect(xml).toContain('<RowLimit>21</RowLimit>');
      // A mappákban lévő elemek is (a mappák nélkül).
      expect(xml.indexOf("<View Scope='Recursive'><Query>")).toBe(0);
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

  describe('ellenőrzés és átalakítás a parseConfig-ban', () => {
    it('hibás beállítás elutasítva, a hiba útvonallal jön', () => {
      expect(parseRelatedSection({ listId: 'Szamlak', matchField: 'A', columns: ['B'] }).error).toContain('related:1.related.listId');
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
      expect(config.texts?.['related:1'].related).toEqual({
        listId: 'aaaaaaaa-1111-1111-1111-111111111111',
        matchField: 'A',
        sourceField: 'Title',
        columns: ['B', 'C'],
        showNewButton: true
      });
    });

    it('régi konfiguráció: a szakasz beállítása önálló elem lesz a szakasz végén, teljes szélességben', () => {
      const result = parseConfig(
        configJson({
          schemaVersion: 4,
          sections: [
            { id: 'a', title: 'Számlák', columns: 2, fields: [{ field: 'Title' }], related },
            { id: 'b', columns: 1, fields: [], related: { listId: '', matchField: '', columns: [] } }
          ],
          // A már foglalt azonosítót nem írja felül.
          texts: { 'related:1': { kind: 'related', name: 'Meglévő' } }
        })
      );
      const config = result.config as IFormConfig;
      expect(config.schemaVersion).toBe(5);
      expect(config.sections[0].fields).toEqual([{ field: 'Title' }, { field: 'related:2', colSpan: 2 }]);
      expect(config.sections[1].fields).toEqual([{ field: 'related:3' }]);
      expect(config.texts?.['related:2']).toEqual({ kind: 'related', name: 'Számlák', related });
      expect(config.texts?.['related:3'].name).toBe('b');
      expect(config.texts?.['related:1'].name).toBe('Meglévő');
      expect((config.sections[0] as unknown as Record<string, unknown>).related).toBeUndefined();
    });

    it('az 5-ös konfigurációban a szakasz related beállítása nem alakul át (ismeretlen kulcsként kimarad)', () => {
      const config = parseConfig(
        configJson({ schemaVersion: 5, sections: [{ id: 's', columns: 1, fields: [], related }] })
      ).config as IFormConfig;
      expect(config.texts).toBeUndefined();
      expect(config.sections[0].fields).toEqual([]);
    });

    it('félkész beállítás menthető; az elem a szakaszban mezőként szerepel, New módban is', () => {
      const schema = sampleSchema();
      const config = parseRelatedSection({ listId: '', matchField: '', columns: [] }).config as IFormConfig;
      expect(config.texts?.['related:1'].related?.sourceField).toBe('ID');
      const edit = resolveForm(schema, config, 'edit', {});
      expect(edit.sections[0].visible).toBe(true);
      expect(isRelatedElement(getField(edit, 'related:1').schema)).toBe(true);
      // Új elemnél is látszik (a helye jelzi, hogy ott jelennek meg majd a kapcsolódó elemek).
      expect(getField(resolveForm(schema, config, 'new', {}), 'related:1').visible).toBe(true);
    });

    it('kapcsolódó elemek nélküli szekció változatlan', () => {
      expect((parseRelatedSection(undefined, [{ field: 'Title' }]).config as IFormConfig).texts).toBeUndefined();
    });

    it('a kapcsolódó elem azonosítója és fajtája összetartozik', () => {
      const raw = (texts: unknown): string => configJson({ schemaVersion: 5, texts });
      expect(parseConfig(raw({ 'related:1': { name: 'x', related } })).error).toContain('related:1');
      expect(parseConfig(raw({ 'text:1': { kind: 'related', name: 'x', related } })).error).toContain('text:1');
      expect(parseConfig(raw({ 'related:1': { kind: 'related', name: 'x' } })).config?.texts?.['related:1'].related?.listId).toBe('');
    });
  });

  describe('feladatkezelés', () => {
    const task: IRelatedTaskConfig = {
      assignedField: 'AssignedTo',
      openWhen: { field: 'Status', op: 'ne', value: 'Elvégezve' },
      allowView: true,
      commentField: 'Comment',
      fields: [{ field: 'DueDate' }, { field: 'Result', editable: true }],
      buttonRules: [
        {
          when: { field: 'ApprovalStatus', op: 'eq', value: 'A' },
          buttons: [
            { label: 'B', primary: true, taskValues: [{ field: 'Status', value: 'Elvégezve' }], itemValues: [{ field: 'ApprovalStatus', value: 'D' }] },
            { label: 'C', commentRequired: true }
          ]
        },
        { when: { field: '[Task:Kind]', op: 'eq', value: 'Ellenőrzés' }, buttons: [{ label: 'E' }, { label: 'F' }] },
        { buttons: [{ label: 'Kész' }, { label: '' }] }
      ]
    };

    it('a beállítás ellenőrzése: félkész is menthető, a hibás mezőnév és feltétel elutasítva', () => {
      const parse = (value: unknown): ReturnType<typeof parseConfig> =>
        parseConfig(configJson({ schemaVersion: 5, texts: { 'related:1': { kind: 'related', name: 'x', related: { ...related, task: value } } } }));
      expect(parse(task).config?.texts?.['related:1'].related?.task).toEqual(task);
      expect(parse({}).config?.texts?.['related:1'].related?.task).toEqual({ assignedField: '' });
      expect(parse({ assignedField: 'A', allowView: 'yes' }).config?.texts?.['related:1'].related?.task).toEqual({ assignedField: 'A' });
      expect(parse({ assignedField: 'A B' }).error).toContain('task.assignedField');
      expect(parse({ assignedField: 'A', openWhen: { field: 'X', op: 'between' } }).error).toBeDefined();
      expect(parse({ assignedField: 'A', buttonRules: [{ buttons: [{ label: 'x', taskValues: [{ field: "x'" }] }] }] }).error).toContain(
        'buttonRules[0].buttons[0].taskValues[0].field'
      );
    });

    it('isTaskEnabled: csak kiválasztott személy mezővel', () => {
      expect(isTaskEnabled({ ...related, task })).toBe(true);
      expect(isTaskEnabled({ ...related, task: { assignedField: '' } })).toBe(false);
      expect(isTaskEnabled(related)).toBe(false);
    });

    it('a hozzárendelt elemek lekérdezése: párosítás ÉS (a felhasználó VAGY a csoportja)', () => {
      const single = buildAssignedViewXml({ ...related, task }, 'Text', 'IG-1', 'User') as string;
      expect(single).toContain(
        "<Where><And><Eq><FieldRef Name='RequestNumber'/><Value Type='Text'>IG-1</Value></Eq>" +
          "<Or><Eq><FieldRef Name='AssignedTo' LookupId='TRUE'/><Value Type='Integer'><UserID/></Value></Eq>" +
          "<Membership Type='CurrentUserGroups'><FieldRef Name='AssignedTo'/></Membership></Or></And></Where>"
      );
      expect(single).toContain("<ViewFields><FieldRef Name='ID'/></ViewFields>");
      expect(buildAssignedViewXml({ ...related, task }, 'Text', 'IG-1', 'UserMulti')).toContain('<Includes>');
      // Nem személy mező, nincs feladatkezelés, vagy nincs párosító érték: nincs lekérdezés.
      expect(buildAssignedViewXml({ ...related, task }, 'Text', 'IG-1', 'Text')).toBeUndefined();
      expect(buildAssignedViewXml(related, 'Text', 'IG-1', 'User')).toBeUndefined();
      expect(buildAssignedViewXml({ ...related, task }, 'Text', '', 'User')).toBeUndefined();
    });

    it('megnyithatóság: a feladat mezői szerint; feltétel nélkül mindig', () => {
      expect(isTaskOpenable(task, { Status: 'Folyamatban' })).toBe(true);
      expect(isTaskOpenable(task, { Status: 'Elvégezve' })).toBe(false);
      expect(isTaskOpenable({ assignedField: 'AssignedTo' }, { Status: 'Elvégezve' })).toBe(true);
    });

    it('gombok: az első teljesülő szabály gombjai, az elem és a feladat mezői szerint', () => {
      const pick = (item: Record<string, string>, taskValues: Record<string, string>): string[] =>
        pickTaskButtons(task, taskConditionValues(item, taskValues)).map((button) => button.label);
      expect(pick({ ApprovalStatus: 'A' }, { Kind: 'Ellenőrzés' })).toEqual(['B', 'C']);
      expect(pick({ ApprovalStatus: 'D' }, { Kind: 'Ellenőrzés' })).toEqual(['E', 'F']);
      // A feltétel nélküli szabály az alapértelmezés; a felirat nélküli gomb kimarad.
      expect(pick({ ApprovalStatus: 'D' }, { Kind: 'Másik' })).toEqual(['Kész']);
      expect(pickTaskButtons({ assignedField: 'X' }, {})).toEqual([]);
    });

    it('a feladatok feltételeiben hivatkozott csoportok tagságát is lekérdezzük', () => {
      const config = parseConfig(
        configJson({
          schemaVersion: 5,
          texts: {
            'related:1': {
              kind: 'related',
              name: 'x',
              related: { ...related, task: { assignedField: 'A', buttonRules: [{ when: { field: '[Group:7]', op: 'eq', value: true }, buttons: [] }] } }
            }
          }
        })
      ).config as IFormConfig;
      expect(collectGroupIds(config)).toEqual([7]);
    });
  });

  it('új kapcsolódó elem: üres beállítással, a szakasz végére, teljes szélességben', () => {
    const base = parseConfig(configJson({ sections: [{ id: 's', columns: 3, fields: [{ field: 'Title' }] }] })).config as IFormConfig;
    const added = addTextElement(base, 'Feladatok', 's', 'related');
    expect(added.id).toBe('related:1');
    expect(added.config.texts?.['related:1']).toEqual({
      kind: 'related',
      name: 'Feladatok',
      related: { listId: '', matchField: '', sourceField: 'ID', columns: [] }
    });
    expect(added.config.sections[0].fields).toEqual([{ field: 'Title' }, { field: 'related:1', colSpan: 3 }]);
    // Visszaolvasva ugyanaz (a JSON fül és a mentés is ezt látja).
    expect(parseConfig(JSON.stringify(added.config)).config?.texts).toEqual(added.config.texts);
  });

  it('letiltva a feladatok nem nyithatók meg (a feloldott elem csak olvasható), megtekintéskor is működik', () => {
    const config = parseConfig(
      configJson({
        schemaVersion: 5,
        sections: [{ id: 's', columns: 1, fields: [{ field: 'related:1' }] }],
        texts: { 'related:1': { kind: 'related', name: 'x', related } },
        fields: { 'related:1': { readOnlyIn: ['edit'] } }
      })
    ).config as IFormConfig;
    const schema = sampleSchema();
    expect(getField(resolveForm(schema, config, 'edit', {}), 'related:1').readOnly).toBe(true);
    const display = getField(resolveForm(schema, config, 'display', {}), 'related:1');
    expect(display.readOnly).toBe(false);
    expect(display.required).toBe(false);
    expect(display.related).toEqual(related);
  });
});
